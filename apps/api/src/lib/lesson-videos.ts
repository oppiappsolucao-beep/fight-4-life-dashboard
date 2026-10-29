import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "./prisma.js";
import { ensureUploadsDir, getUploadsRoot } from "./student-photos.js";
import { isVideoDataUrl } from "./modalities.js";

const DATA_URL_RE = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const FFMPEG_TIMEOUT_MS = 3 * 60 * 1000;

const inflight = new Map<string, Promise<string>>();

function extensionFromMime(mime: string): string {
  const normalized = mime.toLowerCase();
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("quicktime") || normalized.includes("mov")) return "mov";
  if (normalized.includes("ogg")) return "ogv";
  if (normalized.includes("mp4")) return "mp4";
  return "bin";
}

function runCommand(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
    }, FFMPEG_TIMEOUT_MS);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > 4000) stdout = stdout.slice(-4000);
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    };

    proc.on("error", (error) => {
      stderr += error.message;
      finish(error.message.includes("ENOENT") ? 127 : 1);
    });
    proc.on("close", (code) => finish(code ?? 1));
  });
}

async function probeStreams(filePath: string): Promise<{ videoCodec: string; pixFmt: string; audioCodec: string } | null> {
  const video = await runCommand("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name,pix_fmt",
    "-of",
    "csv=p=0",
    filePath,
  ]);
  if (video.code !== 0) return null;

  const [videoCodec = "", pixFmt = ""] = video.stdout.trim().split(",");
  const audio = await runCommand("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=codec_name",
    "-of",
    "csv=p=0",
    filePath,
  ]);
  const audioCodec = audio.code === 0 ? audio.stdout.trim() : "";
  if (!videoCodec) return null;
  return { videoCodec, pixFmt, audioCodec };
}

function browserCanPlay(streams: { videoCodec: string; pixFmt: string; audioCodec: string }): boolean {
  const videoOk = streams.videoCodec === "h264" && (streams.pixFmt === "yuv420p" || streams.pixFmt === "yuvj420p");
  const audioOk = !streams.audioCodec || streams.audioCodec === "aac" || streams.audioCodec === "mp3";
  return videoOk && audioOk;
}

async function remuxFaststart(inputPath: string, outputPath: string): Promise<boolean> {
  const result = await runCommand("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  return result.code === 0 && existsSync(outputPath);
}

async function transcodeToMp4(inputPath: string, outputPath: string, hasAudio: boolean): Promise<boolean> {
  const args = [
    "-y",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-dn",
    "-sn",
    "-c:v",
    "libx264",
    "-profile:v",
    "main",
    "-level",
    "4.0",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "ultrafast",
    "-crf",
    "26",
    "-vf",
    "scale=min(1280\\,iw):-2",
  ];

  if (hasAudio) {
    args.push("-map", "0:a:0", "-c:a", "aac", "-b:a", "128k");
  }

  args.push("-movflags", "+faststart", "-max_muxing_queue_size", "1024", outputPath);

  const result = await runCommand("ffmpeg", args);
  if (result.code !== 0 || !existsSync(outputPath)) {
    if (result.code !== 127) {
      console.warn("[videos] ffmpeg não conseguiu converter:", result.stderr.slice(-500));
    }
    return false;
  }
  return true;
}

async function removeOtherLessonFiles(tenantId: string, lessonId: string, keepName: string): Promise<void> {
  const dir = join(getUploadsRoot(), "lessons", tenantId);
  if (!existsSync(dir)) return;
  const entries = await readdir(dir);
  await Promise.all(
    entries
      .filter((name) => name.startsWith(`${lessonId}.`) && name !== keepName)
      .map((name) => unlink(join(dir, name)).catch(() => undefined)),
  );
}

function publicPath(tenantId: string, filename: string): string {
  return `/uploads/lessons/${tenantId}/${filename}?v=${Date.now()}`;
}

async function persistLessonVideoNow(input: {
  tenantId: string;
  lessonId: string;
  videoUrl: string;
}): Promise<string> {
  const trimmed = input.videoUrl.trim();

  if (
    trimmed.startsWith("/uploads/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }

  const match = trimmed.match(DATA_URL_RE);
  if (!match || !isVideoDataUrl(trimmed)) {
    throw new Error("Formato de vídeo inválido. Envie o arquivo ou um link http(s).");
  }

  const mime = match[1];
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length) {
    throw new Error("Vídeo vazio.");
  }
  if (buffer.length > MAX_VIDEO_BYTES) {
    throw new Error("Vídeo muito grande (máximo 15 MB).");
  }

  await ensureUploadsDir();
  const dir = join(getUploadsRoot(), "lessons", input.tenantId);
  await mkdir(dir, { recursive: true });

  const sourceName = `${input.lessonId}.source`;
  const sourcePath = join(dir, sourceName);
  await writeFile(sourcePath, buffer);

  const mp4Name = `${input.lessonId}.mp4`;
  const mp4Path = join(dir, mp4Name);
  const streams = await probeStreams(sourcePath);

  let ready = false;
  if (streams && browserCanPlay(streams)) {
    ready = await remuxFaststart(sourcePath, mp4Path);
  }
  if (!ready) {
    ready = await transcodeToMp4(sourcePath, mp4Path, Boolean(streams?.audioCodec));
  }

  if (ready) {
    await removeOtherLessonFiles(input.tenantId, input.lessonId, mp4Name);
    return publicPath(input.tenantId, mp4Name);
  }

  const fallbackName = `${input.lessonId}.${extensionFromMime(mime)}`;
  const fallbackPath = join(dir, fallbackName);
  if (fallbackPath !== sourcePath) {
    await writeFile(fallbackPath, buffer);
  }
  await removeOtherLessonFiles(input.tenantId, input.lessonId, fallbackName);
  console.warn(
    `[videos] Aula ${input.lessonId} ficou no formato original (${mime}). Instale o ffmpeg para converter vídeos de celular.`,
  );
  return publicPath(input.tenantId, fallbackName);
}

/**
 * Grava o upload em disco e devolve uma URL curta (`/uploads/lessons/...`).
 * Vídeos de celular (HEVC/MOV, átomo moov no fim) são convertidos para MP4 H.264,
 * que o Chrome, o Edge e o Safari conseguem abrir.
 */
export function persistLessonVideo(input: {
  tenantId: string;
  lessonId: string;
  videoUrl: string;
}): Promise<string> {
  const trimmed = input.videoUrl.trim();
  if (
    trimmed.startsWith("/uploads/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return Promise.resolve(trimmed);
  }

  const current = inflight.get(input.lessonId);
  if (current) return current;

  const job = persistLessonVideoNow(input).finally(() => {
    inflight.delete(input.lessonId);
  });
  inflight.set(input.lessonId, job);
  return job;
}

export async function materializeLessonVideo<
  T extends { id: string; tenantId: string; videoUrl: string },
>(lesson: T): Promise<T> {
  if (!lesson.videoUrl.startsWith("data:")) return lesson;

  try {
    const videoUrl = await persistLessonVideo({
      tenantId: lesson.tenantId,
      lessonId: lesson.id,
      videoUrl: lesson.videoUrl,
    });
    await prisma.professorLesson.update({
      where: { id: lesson.id },
      data: { videoUrl },
    });
    return { ...lesson, videoUrl };
  } catch (error) {
    console.error(
      `[videos] Falha ao preparar aula ${lesson.id}:`,
      error instanceof Error ? error.message : error,
    );
    return { ...lesson, videoUrl: "" };
  }
}

/** Converte aulas antigas salvas como base64. Idempotente. */
export async function migrateBase64LessonVideos(): Promise<number> {
  await ensureUploadsDir();

  const lessons = await prisma.professorLesson.findMany({
    where: { videoUrl: { startsWith: "data:" } },
    select: { id: true, tenantId: true, videoUrl: true },
  });

  let migrated = 0;
  for (const lesson of lessons) {
    const ready = await materializeLessonVideo(lesson);
    if (ready.videoUrl && !ready.videoUrl.startsWith("data:")) {
      migrated += 1;
    }
  }
  return migrated;
}
