import { CompareResult, CsvRow } from "@/types/qa";

export function compareCsvRows(rows: CsvRow[]): CompareResult[] {
  const enRows = rows.filter((row) => row.locale?.toLowerCase() === "en-us");
  const thRows = rows.filter((row) => row.locale?.toLowerCase() === "th-th");

  const enMap = new Map(enRows.map((row) => [row.cms_id ?? "", row]));
  const thMap = new Map(thRows.map((row) => [row.cms_id ?? "", row]));

  const allCmsIds = new Set([
    ...enMap.keys(),
    ...thMap.keys(),
  ]);

  const results: CompareResult[] = [];

  for (const cmsId of allCmsIds) {
    if (!cmsId) continue;

    const enRow = enMap.get(cmsId);
    const thRow = thMap.get(cmsId);

    let status: CompareResult["status"];

    if (enRow && thRow) {
      status = "both_present";
    } else if (!enRow && thRow) {
      status = "missing_in_en";
    } else {
      status = "missing_in_th";
    }

    results.push({
      cmsId,
      overrideId: enRow?.override_id ?? thRow?.override_id ?? null,
      sectionName: enRow?.section_name ?? thRow?.section_name ?? null,
      sourceObjectPath:
        enRow?.source_object_path ?? thRow?.source_object_path ?? null,
      enText: enRow?.text ?? null,
      thText: thRow?.text ?? null,
      status,
    });
  }

  return results.sort((a, b) => Number(a.cmsId) - Number(b.cmsId));
}

// It:
// filters EN and TH from one CSV
// matches by cms_id
// returns richer rows for table display

// if same cms_id appears multiple times in same locale,
// Map keeps only the last one
// To be fixed.