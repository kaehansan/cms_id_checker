"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { compareCsvRows, summarize } from "@/lib/compare";
import { validateCsvRows } from "@/lib/csvSchema";
import { exportResultsToCsv } from "@/lib/exportCsv";
import { CompareResult, CompareStatus, CsvRow } from "@/types/qa";

type FilterMode = "problems_only" | CompareStatus | "all";

type UserSession = {
  name: string;
  email: string;
};

type RunLog = {
  id: string;
  fileName: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  total: number;
  matched: number;
  totalProblems: number;
  ambiguous: number;
  missingEn: number;
  missingTh: number;
  overrideMismatch: number;
  unpairedRaw: number;
};

const RUN_LOG_STORAGE_KEY = "cms-check:run-log";

const STATUS_STYLE: Record<CompareStatus, string> = {
  AMBIGUOUS: "bg-amber-100 text-amber-800",
  OVERRIDE_MISMATCH: "bg-orange-100 text-orange-800",
  MISSING_EN: "bg-red-100 text-red-800",
  MISSING_TH: "bg-red-100 text-red-800",
  UNPAIRED_RAW: "bg-purple-100 text-purple-800",
  MATCHED: "bg-green-100 text-green-800",
};

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loginName, setLoginName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [runLogs, setRunLogs] = useState<RunLog[]>(
    () => readStoredJson<RunLog[]>(RUN_LOG_STORAGE_KEY) ?? []
  );
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [hasCompared, setHasCompared] = useState(false);
  const [error, setError] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("problems_only");

  const results: CompareResult[] = useMemo(() => compareCsvRows(rows), [rows]);
  const summary = useMemo(() => summarize(results), [results]);

  const filteredResults = useMemo(() => {
    switch (filterMode) {
      case "all":
        return results;
      case "problems_only":
        return results.filter((r) => r.status !== "MATCHED");
      default:
        return results.filter((r) => r.status === filterMode);
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
    saveRunLog();
  }

  function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = loginName.trim();
    const trimmedEmail = loginEmail.trim();

    if (!trimmedName || !trimmedEmail) {
      setLoginError("Enter your name and email to continue.");
      return;
    }

    if (!trimmedEmail.includes("@")) {
      setLoginError("Enter a valid email address.");
      return;
    }

    const user = {
      name: trimmedName,
      email: trimmedEmail,
    };

    setCurrentUser(user);
    setLoginError("");
  }

  function handleLogout() {
    setCurrentUser(null);
    setRows([]);
    setFileName("");
    setHasCompared(false);
    setError("");
  }

  function saveRunLog() {
    if (!currentUser) return;

    const log: RunLog = {
      id: crypto.randomUUID(),
      fileName,
      userName: currentUser.name,
      userEmail: currentUser.email,
      createdAt: new Date().toISOString(),
      total: summary.total,
      matched: summary.matched,
      totalProblems: summary.totalProblems,
      ambiguous: summary.ambiguous,
      missingEn: summary.missingEn,
      missingTh: summary.missingTh,
      overrideMismatch: summary.overrideMismatch,
      unpairedRaw: summary.unpairedRaw,
    };

    setRunLogs((existingLogs) => {
      const nextLogs = [log, ...existingLogs].slice(0, 20);
      localStorage.setItem(RUN_LOG_STORAGE_KEY, JSON.stringify(nextLogs));
      return nextLogs;
    });
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setError("");
    setHasCompared(false);
    setFilterMode("problems_only");
    setRows([]);

    Papa.parse<unknown>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const validation = validateCsvRows(
          result.data,
          result.meta.fields ?? []
        );

        if (!validation.ok) {
          setError(validation.error);
          setRows([]);
          return;
        }

        setRows(validation.rows);
      },
      error: () => {
        setError("Failed to parse CSV file.");
        setRows([]);
      },
    });
  }

  function handleExport() {
    if (!filteredResults.length) return;

    const suffix = filterMode === "all" ? "all" : filterMode.toLowerCase();
    exportResultsToCsv(filteredResults, `cms_qa_report_${suffix}.csv`);
  }

  function filterButtonClass(active: boolean) {
    return active
      ? "rounded-lg bg-black px-4 py-2 text-white"
      : "rounded-lg border border-gray-300 bg-white px-4 py-2 text-black";
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-8">
      <header className="mb-8 flex flex-col gap-4 border-b pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold">CMS Check</h1>
          <p className="mt-2 text-sm text-gray-500">
            Compare extracted CMS strings, save QA runs, and export review
            reports.
          </p>
        </div>

        {currentUser && (
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <p className="font-semibold">{currentUser.name}</p>
              <p className="text-gray-500">{currentUser.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-black hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      {!currentUser ? (
        <section className="max-w-md rounded-lg border bg-white p-6">
          <h2 className="text-xl font-semibold">Log in</h2>
          <p className="mt-2 text-sm text-gray-500">
            Demo login for tracking who created each QA run.
          </p>

          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Name</label>
              <input
                value={loginName}
                onChange={(event) => setLoginName(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Kae"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Email</label>
              <input
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="you@example.com"
                type="email"
              />
            </div>

            {loginError && <p className="text-sm text-red-600">{loginError}</p>}

            <button
              type="submit"
              className="rounded-lg bg-black px-5 py-3 text-white"
            >
              Log in
            </button>
          </form>
        </section>
      ) : (
        <>

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
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </section>

      {hasCompared && (
        <section>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            <SummaryCard label="Total" value={summary.total} />
            <SummaryCard label="Matched" value={summary.matched} tone="green" />
            <SummaryCard
              label="Ambiguous"
              value={summary.ambiguous}
              tone="amber"
            />
            <SummaryCard
              label="Override"
              value={summary.overrideMismatch}
              tone="orange"
            />
            <SummaryCard label="Missing EN" value={summary.missingEn} tone="red" />
            <SummaryCard label="Missing TH" value={summary.missingTh} tone="red" />
            <SummaryCard
              label="Unpaired"
              value={summary.unpairedRaw}
              tone="purple"
            />
          </div>

          {summary.totalProblems === 0 ? (
            <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-green-800">
              No issues found. EN and TH both contain {summary.matched} matched
              IDs.
            </div>
          ) : (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
              Found {summary.totalProblems} item
              {summary.totalProblems === 1 ? "" : "s"} to review across{" "}
              {summary.total} CMS IDs.
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setFilterMode("problems_only")}
              className={filterButtonClass(filterMode === "problems_only")}
            >
              Problems Only ({summary.totalProblems})
            </button>

            <button
              onClick={() => setFilterMode("AMBIGUOUS")}
              className={filterButtonClass(filterMode === "AMBIGUOUS")}
            >
              Ambiguous ({summary.ambiguous})
            </button>

            <button
              onClick={() => setFilterMode("OVERRIDE_MISMATCH")}
              className={filterButtonClass(filterMode === "OVERRIDE_MISMATCH")}
            >
              Override ({summary.overrideMismatch})
            </button>

            <button
              onClick={() => setFilterMode("MISSING_EN")}
              className={filterButtonClass(filterMode === "MISSING_EN")}
            >
              Missing EN ({summary.missingEn})
            </button>

            <button
              onClick={() => setFilterMode("MISSING_TH")}
              className={filterButtonClass(filterMode === "MISSING_TH")}
            >
              Missing TH ({summary.missingTh})
            </button>

            <button
              onClick={() => setFilterMode("UNPAIRED_RAW")}
              className={filterButtonClass(filterMode === "UNPAIRED_RAW")}
            >
              Unpaired ({summary.unpairedRaw})
            </button>

            <button
              onClick={() => setFilterMode("all")}
              className={filterButtonClass(filterMode === "all")}
            >
              All Rows ({summary.total})
            </button>

            <button
              onClick={handleExport}
              disabled={!filteredResults.length}
              className="ml-auto rounded-lg border border-black bg-white px-4 py-2 text-black hover:bg-gray-50 disabled:opacity-40"
            >
              Export CSV ({filteredResults.length})
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
                    <th className="border-b p-3">Status</th>
                    <th className="border-b p-3">Section</th>
                    <th className="border-b p-3">EN Text</th>
                    <th className="border-b p-3">TH Text</th>
                    <th className="border-b p-3">Note</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredResults.map((row) => (
                    <ResultRow key={`${row.cmsId}-${row.status}`} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Run Log</h2>
          <p className="text-sm text-gray-500">{runLogs.length} saved runs</p>
        </div>

        {runLogs.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-700">
            No runs yet. Upload a CSV and compare it to create the first log.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="border-b p-3">Time</th>
                  <th className="border-b p-3">File</th>
                  <th className="border-b p-3">User</th>
                  <th className="border-b p-3">Total</th>
                  <th className="border-b p-3">Matched</th>
                  <th className="border-b p-3">Needs Review</th>
                  <th className="border-b p-3">Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {runLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="border-b p-3">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="border-b p-3">{log.fileName}</td>
                    <td className="border-b p-3">
                      <p>{log.userName}</p>
                      <p className="text-xs text-gray-500">{log.userEmail}</p>
                    </td>
                    <td className="border-b p-3">{log.total}</td>
                    <td className="border-b p-3">{log.matched}</td>
                    <td className="border-b p-3">{log.totalProblems}</td>
                    <td className="border-b p-3 text-gray-600">
                      Ambiguous {log.ambiguous}, Missing EN {log.missingEn},
                      Missing TH {log.missingTh}, Override{" "}
                      {log.overrideMismatch}, Unpaired {log.unpairedRaw}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </>
      )}
    </main>
  );
}

function readStoredJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "amber" | "orange" | "red" | "purple";
}) {
  const border = value > 0 && tone !== "green" ? "border-current" : "";
  const color =
    value > 0
      ? {
          green: "text-green-700",
          amber: "text-amber-700",
          orange: "text-orange-700",
          red: "text-red-700",
          purple: "text-purple-700",
        }[tone ?? "green"]
      : "text-gray-900";

  return (
    <div className={`rounded-lg border p-4 ${border}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ResultRow({ row }: { row: CompareResult }) {
  const isAmbiguous = row.status === "AMBIGUOUS";

  return (
    <tr className="align-top">
      <td className="border-b p-3 font-mono">{row.cmsId}</td>
      <td className="border-b p-3">
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${STATUS_STYLE[row.status]}`}
        >
          {row.status}
        </span>
      </td>
      <td className="border-b p-3">{row.sectionName ?? "-"}</td>
      <td className="border-b p-3">
        {isAmbiguous ? <VariantList items={row.enVariants} /> : row.enText ?? "-"}
      </td>
      <td className="border-b p-3">
        {isAmbiguous ? <VariantList items={row.thVariants} /> : row.thText ?? "-"}
      </td>
      <td className="border-b p-3 text-gray-600">{row.note ?? "-"}</td>
    </tr>
  );
}

function VariantList({ items }: { items: string[] }) {
  if (!items.length) return <span>-</span>;

  return (
    <ul className="list-disc space-y-0.5 pl-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
