import { CompareResult, CsvRow } from "@/types/qa";

function normalizeText(value?: string) {
  return value?.trim() ?? "";
}

function uniqueNonEmptyTexts(rows: CsvRow[]) {
  return [...new Set(rows.map((row) => normalizeText(row.text)).filter(Boolean))];
}

export function compareCsvRows(rows: CsvRow[]): CompareResult[] {
  const enRows = rows.filter((row) => row.locale?.toLowerCase() === "en-us");
  const thRows = rows.filter((row) => row.locale?.toLowerCase() === "th-th");

  const enGroups = new Map<string, CsvRow[]>();
  const thGroups = new Map<string, CsvRow[]>();

  for (const row of enRows) {
    const cmsId = row.cms_id?.trim();
    if (!cmsId) continue;

    const existing = enGroups.get(cmsId) ?? [];
    existing.push(row);
    enGroups.set(cmsId, existing);
  }

  for (const row of thRows) {
    const cmsId = row.cms_id?.trim();
    if (!cmsId) continue;

    const existing = thGroups.get(cmsId) ?? [];
    existing.push(row);
    thGroups.set(cmsId, existing);
  }

  const allCmsIds = new Set([...enGroups.keys(), ...thGroups.keys()]);
  const results: CompareResult[] = [];

  for (const cmsId of allCmsIds) {
    const enGroup = enGroups.get(cmsId) ?? [];
    const thGroup = thGroups.get(cmsId) ?? [];

    const enTexts = uniqueNonEmptyTexts(enGroup);
    const thTexts = uniqueNonEmptyTexts(thGroup);

    const enRow = enGroup[0];
    const thRow = thGroup[0];

    let status: CompareResult["status"];

    if (enGroup.length === 0 && thGroup.length > 0) {
      status = "missing_in_en";
    } else if (thGroup.length === 0 && enGroup.length > 0) {
      status = "missing_in_th";
    } else if (enTexts.length > 1) {
      status = "conflicting_en_text";
    } else if (thTexts.length > 1) {
      status = "conflicting_th_text";
    } else {
      status = "both_present";
    }

    results.push({
      cmsId,
      overrideId: enRow?.override_id ?? thRow?.override_id ?? null,
      sectionName: enRow?.section_name ?? thRow?.section_name ?? null,
      sourceObjectPath:
        enRow?.source_object_path ?? thRow?.source_object_path ?? null,
      enText: enTexts[0] ?? null,
      thText: thTexts[0] ?? null,
      status,
    });
  }

  return results.sort((a, b) => Number(a.cmsId) - Number(b.cmsId));
}