/**
 * Resolve URL de mídia (foto de aluno) para uso em <img src>.
 * Paths `/uploads/...` ficam no mesmo host da API em produção;
 * em dev o Vite faz proxy de `/uploads`.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }
  if (url.startsWith("/uploads/")) {
    return url;
  }
  return url;
}
