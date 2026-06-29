import {
  CompareResult,
  CompareStatus,
  CompareSummary,
  CsvRow,
  EN_LOCALE,
  TH_LOCALE,
} from "@/types/qa";
import { normalizeOverride, normalizeText, uniqueNonEmpty } from "@/lib/normalize";

export function compareCsvRows(rows: CsvRow[]): CompareResult[] {
  const results: CompareResult[] = [];
  const validRows: CsvRow[] = [];

  for (const row of rows) {
    const cmsId = row.cms_id?.trim();
    const locale = row.locale?.trim().toLowerCase() ?? "";
    const isKnownLocale = locale === EN_LOCALE || locale === TH_LOCALE;

    if (!cmsId || !isKnownLocale) {
      results.push(
        makeUnpairedResult(
          cmsId ?? "",
          row,
          !cmsId ? "Missing cms_id" : `Unknown locale: "${locale}"`
        )
      );
      continue;
    }

    validRows.push(row);
  }

  const groups = new Map<string, CsvRow[]>();

  for (const row of validRows) {
    const cmsId = row.cms_id?.trim() ?? "";
    groups.set(cmsId, [...(groups.get(cmsId) ?? []), row]);
  }

  for (const [cmsId, group] of groups) {
    const enGroup = group.filter(
      (row) => row.locale?.trim().toLowerCase() === EN_LOCALE
    );
    const thGroup = group.filter(
      (row) => row.locale?.trim().toLowerCase() === TH_LOCALE
    );

    const enVariants = uniqueNonEmpty(enGroup.map((row) => row.text));
    const thVariants = uniqueNonEmpty(thGroup.map((row) => row.text));
    const enOverrides = uniqueOverrides(enGroup);
    const thOverrides = uniqueOverrides(thGroup);
    const metadataRow = enGroup[0] ?? thGroup[0];

    let status: CompareStatus;
    let note: string | null = null;

    if (enVariants.length === 0 && thVariants.length > 0) {
      status = "MISSING_EN";
      note = "Thai text exists, but English text is missing or empty.";
    } else if (thVariants.length === 0 && enVariants.length > 0) {
      status = "MISSING_TH";
      note = "English text exists, but Thai text is missing or empty.";
    } else if (enVariants.length > 1 || thVariants.length > 1) {
      status = "AMBIGUOUS";
      note = `Same cms_id has multiple text variants (EN: ${enVariants.length}, TH: ${thVariants.length}).`;
    } else if (!sameSet(enOverrides, thOverrides)) {
      status = "OVERRIDE_MISMATCH";
      note = `Override mismatch (EN: ${enOverrides.join(", ") || "-"} / TH: ${
        thOverrides.join(", ") || "-"
      }).`;
    } else {
      status = "MATCHED";
    }

    results.push({
      cmsId,
      status,
      overrideId: enOverrides[0] ?? thOverrides[0] ?? null,
      sectionName: metadataRow?.section_name?.trim() || null,
      sourceObjectPath: metadataRow?.source_object_path?.trim() || null,
      locationHint: metadataRow?.location_hint?.trim() || null,
      enText: enVariants[0] ?? null,
      thText: thVariants[0] ?? null,
      enVariants,
      thVariants,
      enOverrides,
      thOverrides,
      note,
    });
  }

  return sortResults(results);
}

function uniqueOverrides(rows: CsvRow[]): string[] {
  return [
    ...new Set(
      rows.map((row) => normalizeOverride(row.override_id)).filter(Boolean)
    ),
  ];
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;

  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function makeUnpairedResult(
  cmsId: string,
  row: CsvRow,
  reason: string
): CompareResult {
  const locale = row.locale?.trim().toLowerCase();
  const isEnglish = locale === EN_LOCALE;
  const isThai = locale === TH_LOCALE;
  const normalizedText = normalizeText(row.text);

  return {
    cmsId: cmsId || "(no id)",
    status: "UNPAIRED_RAW",
    overrideId: normalizeOverride(row.override_id) || null,
    sectionName: row.section_name?.trim() || null,
    sourceObjectPath: row.source_object_path?.trim() || null,
    locationHint: row.location_hint?.trim() || null,
    enText: isEnglish ? normalizedText || null : null,
    thText: isThai ? normalizedText || null : null,
    enVariants: isEnglish && normalizedText ? [normalizedText] : [],
    thVariants: isThai && normalizedText ? [normalizedText] : [],
    enOverrides: [],
    thOverrides: [],
    note: reason,
  };
}

const STATUS_ORDER: Record<CompareStatus, number> = {
  AMBIGUOUS: 0,
  OVERRIDE_MISMATCH: 1,
  MISSING_EN: 2,
  MISSING_TH: 3,
  UNPAIRED_RAW: 4,
  MATCHED: 5,
};

function sortResults(results: CompareResult[]): CompareResult[] {
  return [...results].sort((left, right) => {
    const statusOrder = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusOrder !== 0) return statusOrder;

    const leftId = Number(left.cmsId);
    const rightId = Number(right.cmsId);

    if (!Number.isNaN(leftId) && !Number.isNaN(rightId)) {
      return leftId - rightId;
    }

    return left.cmsId.localeCompare(right.cmsId);
  });
}

export function summarize(results: CompareResult[]): CompareSummary {
  const count = (status: CompareStatus) =>
    results.filter((result) => result.status === status).length;
  const matched = count("MATCHED");

  return {
    total: results.length,
    matched,
    missingEn: count("MISSING_EN"),
    missingTh: count("MISSING_TH"),
    overrideMismatch: count("OVERRIDE_MISMATCH"),
    ambiguous: count("AMBIGUOUS"),
    unpairedRaw: count("UNPAIRED_RAW"),
    totalProblems: results.length - matched,
  };
}
