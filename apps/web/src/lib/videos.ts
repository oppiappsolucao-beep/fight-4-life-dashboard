export type VideoEmbedType = "youtube" | "vimeo" | "file";

export interface ParsedVideoEmbed {
  type: VideoEmbedType;
  embedUrl: string;
  thumbnailUrl?: string;
}

export function parseVideoEmbed(url: string): ParsedVideoEmbed | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const youtubeMatch =
    trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/i) ??
    trimmed.match(/youtube\.com\/shorts\/([\w-]{11})/i);

  if (youtubeMatch?.[1]) {
    const id = youtubeMatch[1];
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${id}`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    };
  }

  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch?.[1]) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  if (/^https?:\/\/.+/i.test(trimmed)) {
    return {
      type: "file",
      embedUrl: trimmed,
    };
  }

  return null;
}

export function defaultThumbnail(videoUrl: string, thumbnailUrl?: string | null): string | null {
  if (thumbnailUrl) return thumbnailUrl;
  return parseVideoEmbed(videoUrl)?.thumbnailUrl ?? null;
}
