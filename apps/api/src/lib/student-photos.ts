import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./prisma.js";

const DATA_URL_RE =
  /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function defaultUploadsRoot(): string {
  // apps/api/src/lib → apps/api/uploads (dev) ou /app/uploads no container se cwd for /app
  const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  return resolve(apiRoot, "uploads");
}

export function getUploadsRoot(): string {
  return process.env.UPLOADS_DIR?.trim() || defaultUploadsRoot();
}

export async function ensureUploadsDir(): Promise<string> {
  const root = getUploadsRoot();
  await mkdir(join(root, "students"), { recursive: true });
  return root;
}

export function isDataUrlPhoto(value: string | null | undefined): boolean {
  return Boolean(value && DATA_URL_RE.test(value.trim()));
}

export function isStoredPhotoUrl(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith("/uploads/"));
}

function extensionFromMime(mime: string): string {
  const normalized = mime.toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "jpg";
}

async function removeFilesForStudent(
  tenantId: string,
  studentId: string,
): Promise<void> {
  const dir = join(getUploadsRoot(), "students", tenantId);
  if (!existsSync(dir)) return;

  try {
    const entries = await readdir(dir);
    await Promise.all(
      entries
        .filter((name) => name === studentId || name.startsWith(`${studentId}.`))
        .map((name) => unlink(join(dir, name)).catch(() => undefined)),
    );
  } catch {
    // diretório inexistente / permissão — ignora
  }
}

export async function removeStudentPhoto(
  tenantId: string,
  studentId: string,
): Promise<void> {
  await removeFilesForStudent(tenantId, studentId);
}

/**
 * Converte data URL em arquivo em disco e devolve path público `/uploads/...`.
 * Se `fotoUrl` já for path/http, mantém. `null`/vazio remove a foto.
 */
export async function persistStudentPhoto(input: {
  tenantId: string;
  studentId: string;
  fotoUrl: string | null | undefined;
}): Promise<string | null> {
  const { tenantId, studentId } = input;
  const fotoUrl = input.fotoUrl ?? null;

  if (fotoUrl === null || fotoUrl.trim() === "") {
    await removeFilesForStudent(tenantId, studentId);
    return null;
  }

  const trimmed = fotoUrl.trim();

  if (isStoredPhotoUrl(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const match = trimmed.match(DATA_URL_RE);
  if (!match) {
    throw new Error("Formato de foto inválido. Envie uma imagem JPEG, PNG ou WebP.");
  }

  const mime = match[1];
  const base64 = match[2].replace(/\s/g, "");
  const buffer = Buffer.from(base64, "base64");

  if (!buffer.length) {
    throw new Error("Foto vazia.");
  }
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw new Error("Foto muito grande (máximo 5 MB).");
  }

  const ext = extensionFromMime(mime);
  const dir = join(getUploadsRoot(), "students", tenantId);
  await mkdir(dir, { recursive: true });
  await removeFilesForStudent(tenantId, studentId);

  const filename = `${studentId}.${ext}`;
  await writeFile(join(dir, filename), buffer);

  return `/uploads/students/${tenantId}/${filename}`;
}

/** Migra fotos base64 antigas do Postgres para disco (idempotente). */
export async function migrateBase64StudentPhotos(): Promise<number> {
  await ensureUploadsDir();

  const students = await prisma.student.findMany({
    where: { fotoUrl: { startsWith: "data:image" } },
    select: { id: true, tenantId: true, fotoUrl: true },
  });

  let migrated = 0;

  for (const student of students) {
    if (!student.fotoUrl) continue;
    try {
      const stored = await persistStudentPhoto({
        tenantId: student.tenantId,
        studentId: student.id,
        fotoUrl: student.fotoUrl,
      });
      await prisma.student.update({
        where: { id: student.id },
        data: { fotoUrl: stored },
      });
      migrated += 1;
    } catch (error) {
      console.warn(
        `[photos] Falha ao migrar foto do aluno ${student.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return migrated;
}
