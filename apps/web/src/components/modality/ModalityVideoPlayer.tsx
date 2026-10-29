import { useEffect, useState } from "react";
import { parseVideoEmbed } from "../../lib/videos";
import type { LessonVideoCardItem } from "../../types/modality";

interface ModalityVideoPlayerProps {
  video: LessonVideoCardItem;
  professorName?: string | null;
  classDate?: string;
  timeLabel?: string;
}

export default function ModalityVideoPlayer({
  video,
  professorName,
  classDate,
  timeLabel,
}: ModalityVideoPlayerProps) {
  const parsed = parseVideoEmbed(video.videoUrl);
  const fileSrc = parsed?.type === "file" ? parsed.embedUrl : null;
  const [mediaState, setMediaState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setMediaState("loading");
  }, [fileSrc]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="relative aspect-video w-full bg-black">
        {!video.videoUrl.trim() ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-300">
            Não foi possível preparar o vídeo desta aula. Atualize a página ou peça ao professor para publicar de novo.
          </div>
        ) : !parsed ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-300">
            Formato de vídeo não suportado neste navegador.
          </div>
        ) : parsed.type === "file" ? (
          <>
            <video
              key={fileSrc}
              src={fileSrc ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full bg-black"
              poster={video.thumbnailUrl ?? undefined}
              onLoadedMetadata={(event) => {
                const duration = event.currentTarget.duration;
                setMediaState(Number.isFinite(duration) && duration > 0 ? "ready" : "error");
              }}
              onError={() => setMediaState("error")}
            />
            {mediaState === "loading" ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm text-slate-200">
                Preparando vídeo...
              </div>
            ) : null}
            {mediaState === "error" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center text-sm text-slate-200">
                Este vídeo não abre neste navegador. Atualize a página. Se continuar preto, o professor precisa enviar de novo.
              </div>
            ) : null}
          </>
        ) : (
          <iframe
            src={parsed.embedUrl}
            title={video.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
      <div className="p-4 sm:p-5">
        {professorName || classDate || timeLabel ? (
          <p className="m-0 text-xs text-slate-400">
            {professorName ? `Professor: ${professorName}` : null}
            {professorName && (classDate || timeLabel) ? " • " : null}
            {classDate ? classDate : null}
            {classDate && timeLabel ? " • " : null}
            {timeLabel ? timeLabel : null}
          </p>
        ) : null}
        <h3 className="m-0 mt-2 text-lg font-semibold text-[#2E496C]">{video.title}</h3>
        {video.description ? (
          <p className="m-0 mt-2 text-sm leading-relaxed text-[#2E496C]/65">{video.description}</p>
        ) : null}
      </div>
    </section>
  );
}

interface ModalityVideoCardProps {
  video: LessonVideoCardItem;
  selected?: boolean;
  onSelect: () => void;
}

export function ModalityVideoCard({ video, selected, onSelect }: ModalityVideoCardProps) {
  const thumbnail =
    video.thumbnailUrl ??
    (video.videoUrl.startsWith("data:video/") ? null : parseVideoEmbed(video.videoUrl)?.thumbnailUrl) ??
    null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`overflow-hidden rounded-2xl border text-left transition ${
        selected
          ? "border-[#5B7595] bg-[#5B7595]/10 shadow-[0_0_0_1px_rgba(91,117,149,0.35)]"
          : "border-slate-200 bg-slate-50 hover:border-slate-200"
      }`}
    >
      <div className="relative aspect-video bg-black/50">
        {thumbnail ? (
          <img src={thumbnail} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[#2E496C]/40">Aula em vídeo</div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-slate-50">
          <span className="rounded-full bg-black/55 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#2E496C]">
            Assistir
          </span>
        </span>
      </div>
      <div className="p-3">
        <p className="m-0 line-clamp-2 text-sm font-semibold text-[#2E496C]">{video.title}</p>
      </div>
    </button>
  );
}
