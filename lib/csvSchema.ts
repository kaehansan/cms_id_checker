import { z } from "zod";
import { CsvRow } from "@/types/qa";

export const REQUIRED_COLUMNS = [
  "page_name",
  "locale",
  "cms_id",
  "override_id",
  "text",
  "section_name",
  "source_object_path",
] as const;

const rowSchema = z.object({
  page_name: z.string().optional(),
  locale: z.string().optional(),
  cms_id: z.string().optional(),
  override_id: z.string().optional(),
  text: z.string().optional(),
  section_name: z.string().optional(),
  source_object_path: z.string().optional(),
});

export type ValidationResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; error: string };

export function validateCsvRows(
  rawRows: unknown[],
  headerFields: string[]
): ValidationResult {
  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !headerFields.includes(column)
  );

  if (missingColumns.length > 0) {
    return {
      ok: false,
      error: `CSV is missing required columns: ${missingColumns.join(
        ", "
      )}. Expected: ${REQUIRED_COLUMNS.join(", ")}`,
    };
  }

  const parsed = z.array(rowSchema).safeParse(rawRows);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const rowIndex =
      firstIssue?.path?.[0] !== undefined ? String(firstIssue.path[0]) : "?";

    return {
      ok: false,
      error: `Invalid CSV data at row ${rowIndex}: ${
        firstIssue?.message ?? "unknown validation error"
      }`,
    };
  }

  const rows: CsvRow[] = parsed.data.map((row) => ({
    page_name: row.page_name?.trim(),
    locale: row.locale?.trim(),
    cms_id: row.cms_id?.trim(),
    override_id: row.override_id?.trim(),
    text: row.text?.trim(),
    section_name: row.section_name?.trim(),
    source_object_path: row.source_object_path?.trim(),
  }));

  return { ok: true, rows };
}
