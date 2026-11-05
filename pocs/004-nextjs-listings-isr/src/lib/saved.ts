export const SAVED_COOKIE = "saved";
const MAX_SAVED = 50;

/** Parse the cookie value into a de-duplicated list of ids. Untrusted input. */
export function parseSaved(raw: string | undefined): string[] {
  if (!raw) return [];
  const ids = raw.split(",").filter((id) => /^[a-z0-9-]+$/.test(id));
  return [...new Set(ids)].slice(0, MAX_SAVED);
}

export function serializeSaved(ids: string[]): string {
  return ids.join(",");
}

/** Return a new list with `id` saved or unsaved. Never mutates the input. */
export function setSaved(ids: string[], id: string, saved: boolean): string[] {
  const without = ids.filter((x) => x !== id);
  return saved ? [...without, id].slice(-MAX_SAVED) : without;
}
