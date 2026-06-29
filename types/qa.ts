export type CompareStatus =
  | "MATCHED"
  | "MISSING_EN"
  | "MISSING_TH"
  | "OVERRIDE_MISMATCH"
  | "AMBIGUOUS"
  | "UNPAIRED_RAW";

export const EN_LOCALE = "en-us";
export const TH_LOCALE = "th-th";

export type CsvRow = {
  page_name?: string;
  locale?: string;
  cms_id?: string;
  override_id?: string;
  text?: string;
  section_name?: string;
  source_object_path?: string;
};

export type CompareResult = {
  cmsId: string;
  status: CompareStatus;
  overrideId: string | null;
  sectionName: string | null;
  sourceObjectPath: string | null;
  enText: string | null;
  thText: string | null;
  enVariants: string[];
  thVariants: string[];
  enOverrides: string[];
  thOverrides: string[];
  note: string | null;
};

export type CompareSummary = {
  total: number;
  matched: number;
  missingEn: number;
  missingTh: number;
  overrideMismatch: number;
  ambiguous: number;
  unpairedRaw: number;
  totalProblems: number;
};
