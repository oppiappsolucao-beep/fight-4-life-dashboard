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

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <div className="aspect-video w-full bg-black">
        {!parsed ? (
          video.videoUrl.startsWith("data:video/") ? (
            <video src={video.videoUrl} controls playsInline className="h-full w-full bg-black" />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/50">
              Formato de vídeo não suportado neste navegador.
            </div>
          )
        ) : parsed.type === "file" ? (
          <video
            src={parsed.embedUrl}
            controls
            playsInline
            className="h-full w-full bg-black"
            poster={video.thumbnailUrl ?? undefined}
          />
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
          <p className="m-0 text-xs text-white/45">
            {professorName ? `Professor: ${professorName}` : null}
            {professorName && (classDate || timeLabel) ? " • " : null}
            {classDate ? classDate : null}
            {classDate && timeLabel ? " • " : null}
            {timeLabel ? timeLabel : null}
          </p>
        ) : null}
        <h3 className="m-0 mt-2 text-lg font-semibold text-white">{video.title}</h3>
        {video.description ? (
          <p className="m-0 mt-2 text-sm leading-relaxed text-white/65">{video.description}</p>
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
          ? "border-[#e85d6f] bg-[#e85d6f]/10 shadow-[0_0_0_1px_rgba(232,93,111,0.35)]"
          : "border-white/10 bg-black/25 hover:border-white/20"
      }`}
    >
      <div className="relative aspect-video bg-black/50">
        {thumbnail ? (
          <img src={thumbnail} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/40">Aula em vídeo</div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="rounded-full bg-black/55 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white">
            Assistir
          </span>
        </span>
      </div>
      <div className="p-3">
        <p className="m-0 line-clamp-2 text-sm font-semibold text-white">{video.title}</p>
      </div>
    </button>
  );
}
