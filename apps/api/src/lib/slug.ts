export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function uniqueTenantSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = slugify(base) || "academia";
  if (!(await exists(slug))) return slug;

  for (let i = 2; i <= 99; i++) {
    const candidate = `${slug}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }

  return `${slug}-${Date.now().toString(36)}`;
}
