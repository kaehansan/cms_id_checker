"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { compareCsvRows } from "@/lib/compareCsv";
import { CompareResult, CsvRow } from "@/types/qa";

type FilterMode =
  | "problems_only"
  | "missing_in_en"
  | "missing_in_th"
  | "conflicting_en_text"
  | "conflicting_th_text"
  | "all";

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [hasCompared, setHasCompared] = useState(false);
  const [error, setError] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("problems_only");

  const results: CompareResult[] = useMemo(() => {
    return compareCsvRows(rows);
  }, [rows]);

  const summary = useMemo(() => {
    return {
      total: results.length,
      bothPresent: results.filter((r) => r.status === "both_present").length,
      missingInEn: results.filter((r) => r.status === "missing_in_en").length,
      missingInTh: results.filter((r) => r.status === "missing_in_th").length,
      conflictingEnText: results.filter(
        (r) => r.status === "conflicting_en_text"
      ).length,
      conflictingThText: results.filter(
        (r) => r.status === "conflicting_th_text"
      ).length,
    };
  }, [results]);

  const totalProblems =
    summary.missingInEn +
    summary.missingInTh +
    summary.conflictingEnText +
    summary.conflictingThText;

  const filteredResults = useMemo(() => {
    switch (filterMode) {
      case "missing_in_en":
        return results.filter((r) => r.status === "missing_in_en");
      case "missing_in_th":
        return results.filter((r) => r.status === "missing_in_th");
      case "conflicting_en_text":
        return results.filter((r) => r.status === "conflicting_en_text");
      case "conflicting_th_text":
        return results.filter((r) => r.status === "conflicting_th_text");
      case "all":
        return results;
      case "problems_only":
      default:
        return results.filter((r) => r.status !== "both_present");
    }
  }, [results, filterMode]);

  function handleCompare() {
    if (!rows.length) {
      setError("Please upload a CSV file first.");
      setHasCompared(false);
      return;
    }

    setError("");
    setFilterMode("problems_only");
    setHasCompared(true);
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setError("");
    setHasCompared(false);
    setFilterMode("problems_only");

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cleanedRows = result.data.map((row) => ({
          page_name: row.page_name?.trim(),
          locale: row.locale?.trim(),
          cms_id: row.cms_id?.trim(),
          override_id: row.override_id?.trim(),
          text: row.text?.trim(),
          section_name: row.section_name?.trim(),
          source_object_path: row.source_object_path?.trim(),
        }));

        setRows(cleanedRows);
      },
      error: () => {
        setError("Failed to parse CSV file.");
        setRows([]);
      },
    });
  }

  function filterButtonClass(active: boolean) {
    return active
      ? "rounded-lg bg-black px-4 py-2 text-white"
      : "rounded-lg border border-gray-300 bg-white px-4 py-2 text-black";
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-8">
      <h1 className="mb-8 text-4xl font-bold">CMS Check</h1>

      <section className="mb-6">
        <label className="mb-3 block font-semibold">
          Upload richer extracted CSV
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="flex max-w-2xl flex-col gap-3">
          <div className="flex">
            <div className="flex-1 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-4 py-3 text-gray-700">
              {fileName || "No file selected"}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-r-lg border border-gray-300 bg-white px-5 py-3 text-black hover:bg-gray-50"
            >
              Browse File
            </button>
          </div>

          <button
            onClick={handleCompare}
            className="w-fit rounded-lg bg-black px-6 py-3 text-white"
          >
            Compare
          </button>
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </section>

      {hasCompared && (
        <section>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-6">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-500">Total IDs</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-500">Both Present</p>
              <p className="text-2xl font-bold">{summary.bothPresent}</p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-500">Missing in EN</p>
              <p className="text-2xl font-bold">{summary.missingInEn}</p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-500">Missing in TH</p>
              <p className="text-2xl font-bold">{summary.missingInTh}</p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-500">Conflicting EN</p>
              <p className="text-2xl font-bold">{summary.conflictingEnText}</p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-500">Conflicting TH</p>
              <p className="text-2xl font-bold">{summary.conflictingThText}</p>
            </div>
          </div>

          {totalProblems === 0 && (
            <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-green-800">
              No coverage or conflicting-text issues found. EN and TH both contain{" "}
              {summary.bothPresent} matched IDs.
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-3">
            <button
              onClick={() => setFilterMode("problems_only")}
              className={filterButtonClass(filterMode === "problems_only")}
            >
              Problems Only ({totalProblems})
            </button>

            <button
              onClick={() => setFilterMode("missing_in_en")}
              className={filterButtonClass(filterMode === "missing_in_en")}
            >
              Missing in EN ({summary.missingInEn})
            </button>

            <button
              onClick={() => setFilterMode("missing_in_th")}
              className={filterButtonClass(filterMode === "missing_in_th")}
            >
              Missing in TH ({summary.missingInTh})
            </button>

            <button
              onClick={() => setFilterMode("conflicting_en_text")}
              className={filterButtonClass(filterMode === "conflicting_en_text")}
            >
              Conflicting EN ({summary.conflictingEnText})
            </button>

            <button
              onClick={() => setFilterMode("conflicting_th_text")}
              className={filterButtonClass(filterMode === "conflicting_th_text")}
            >
              Conflicting TH ({summary.conflictingThText})
            </button>

            <button
              onClick={() => setFilterMode("all")}
              className={filterButtonClass(filterMode === "all")}
            >
              All Rows ({summary.total})
            </button>
          </div>

          {filteredResults.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-700">
              No rows to show for this filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border-b p-3">CMS ID</th>
                    <th className="border-b p-3">Override ID</th>
                    <th className="border-b p-3">Section</th>
                    <th className="border-b p-3">Source Object Path</th>
                    <th className="border-b p-3">EN Text</th>
                    <th className="border-b p-3">TH Text</th>
                    <th className="border-b p-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredResults.map((row) => (
                    <tr key={`${row.cmsId}-${row.status}`}>
                      <td className="border-b p-3 align-top">{row.cmsId}</td>
                      <td className="border-b p-3 align-top">
                        {row.overrideId ?? "-"}
                      </td>
                      <td className="border-b p-3 align-top">
                        {row.sectionName ?? "-"}
                      </td>
                      <td className="border-b p-3 align-top">
                        {row.sourceObjectPath ?? "-"}
                      </td>
                      <td className="border-b p-3 align-top">
                        {row.enText ?? "-"}
                      </td>
                      <td className="border-b p-3 align-top">
                        {row.thText ?? "-"}
                      </td>
                      <td className="border-b p-3 align-top">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}