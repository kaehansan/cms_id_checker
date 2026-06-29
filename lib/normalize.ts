export function normalizeText(value?: string | null): string {
  return (value ?? "")
    .replace(/\\+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOverride(value?: string | null): string {
  return (value ?? "").trim();
}

export function uniqueNonEmpty(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      uniqueValues.push(normalized);
    }
  }

  return uniqueValues;
}
