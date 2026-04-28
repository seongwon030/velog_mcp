import { nanoid } from "nanoid";

export function toSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 80);
  return slug || nanoid(8);
}
