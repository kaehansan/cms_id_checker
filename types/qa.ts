export type Locale = "EN" | "TH";

export type ParsedEntry = {
  cmsId: string;
  text: string;
  locale: Locale;
};

export type CompareStatus =
  | "both_present"
  | "missing_in_en"
  | "missing_in_th"
  | "conflicting_en_text"
  | "conflicting_th_text";

export type CompareResult = {
  cmsId: string;
  overrideId?: string | null;
  sectionName?: string | null;
  sourceObjectPath?: string | null;
  enText: string | null;
  thText: string | null;
  status: CompareStatus;
};

export type CsvRow = {
  page_name?: string;
  locale?: string;
  cms_id?: string;
  override_id?: string;
  text?: string;
  section_name?: string;
  source_object_path?: string;
};