// [CMS ID: homepage.hero.title] : Welcome to Agoda
// and converts them into

// {
//   cmsId: "homepage.hero.title",
//   text: "Welcome to Agoda",
//   locale: "EN"
// } 

import { Locale, ParsedEntry } from "@/types/qa";

export function parseSnapshot(input: string, locale: Locale): ParsedEntry[] {
  const lines = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const results: ParsedEntry[] = [];

  for (const line of lines) {
    const match = line.match(/^\[CMS ID:\s*(.+?)\]\s*:\s*(.+)$/);

    if (!match) continue;

    const [, cmsId, text] = match;

    results.push({
      cmsId: cmsId.trim(),
      text: text.trim(),
      locale,
    });
  }

  return results;
}