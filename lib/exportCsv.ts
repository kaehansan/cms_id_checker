import Papa from "papaparse";
import { CompareResult } from "@/types/qa";

export function exportResultsToCsv(
  results: CompareResult[],
  filename = "cms_qa_report.csv"
): void {
  const rows = results.map((result) => ({
    cms_id: result.cmsId,
    status: result.status,
    note: result.note ?? "",
    override_id: result.overrideId ?? "",
    section_name: result.sectionName ?? "",
    source_object_path: result.sourceObjectPath ?? "",
    en_text: result.enText ?? "",
    th_text: result.thText ?? "",
    en_variants: result.enVariants.join(" | "),
    th_variants: result.thVariants.join(" | "),
    en_overrides: result.enOverrides.join(" | "),
    th_overrides: result.thOverrides.join(" | "),
  }));

  const csv = Papa.unparse(rows, { quotes: true });
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
