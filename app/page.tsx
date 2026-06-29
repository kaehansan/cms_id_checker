"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { compareCsvRows, summarize } from "@/lib/compare";
import { validateCsvRows } from "@/lib/csvSchema";
import { exportResultsToCsv } from "@/lib/exportCsv";
import { CompareResult, CompareStatus, CsvRow } from "@/types/qa";
import { RunLog, RunLogInput, UserSession } from "@/types/runLog";

type FilterMode = "problems_only" | CompareStatus | "all";

const STATUS_STYLE: Record<CompareStatus, string> = {
  AMBIGUOUS: "bg-amber-100 text-amber-900 ring-amber-200",
  OVERRIDE_MISMATCH: "bg-orange-100 text-orange-900 ring-orange-200",
  MISSING_EN: "bg-red-100 text-red-900 ring-red-200",
  MISSING_TH: "bg-red-100 text-red-900 ring-red-200",
  UNPAIRED_RAW: "bg-purple-100 text-purple-900 ring-purple-200",
  MATCHED: "bg-emerald-100 text-emerald-900 ring-emerald-200",
};

const FILTERS: { label: string; mode: FilterMode }[] = [
  { label: "Needs Review", mode: "problems_only" },
  { label: "Repeated ID", mode: "AMBIGUOUS" },
  { label: "Override", mode: "OVERRIDE_MISMATCH" },
  { label: "Missing EN", mode: "MISSING_EN" },
  { label: "Missing TH", mode: "MISSING_TH" },
  { label: "Invalid Row", mode: "UNPAIRED_RAW" },
  { label: "All", mode: "all" },
];

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loginName, setLoginName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);
  const [logMessage, setLogMessage] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [hasCompared, setHasCompared] = useState(false);
  const [error, setError] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("problems_only");

  const results: CompareResult[] = useMemo(() => compareCsvRows(rows), [rows]);
  const summary = useMemo(() => summarize(results), [results]);

  const filteredResults = useMemo(() => {
    if (filterMode === "all") return results;
    if (filterMode === "problems_only") {
      return results.filter((row) => row.status !== "MATCHED");
    }
    return results.filter((row) => row.status === filterMode);
  }, [results, filterMode]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
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
    await loadRunLogs(user.email);
  }

  function handleLogout() {
    setCurrentUser(null);
    setRows([]);
    setFileName("");
    setHasCompared(false);
    setError("");
    setLogMessage("");
    setRunLogs([]);
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

  async function handleCompare() {
    if (!rows.length) {
      setError("Please upload a CSV file first.");
      setHasCompared(false);
      return;
    }

    setError("");
    setFilterMode("problems_only");
    setHasCompared(true);
    await saveRunLog();
  }

  function handleExport() {
    if (!filteredResults.length) return;

    const suffix = filterMode === "all" ? "all" : filterMode.toLowerCase();
    exportResultsToCsv(filteredResults, `cms_qa_report_${suffix}.csv`);
  }

  async function loadRunLogs(userEmail: string) {
    setLogMessage("Loading saved runs...");

    try {
      const response = await fetch(
        `/api/run-logs?userEmail=${encodeURIComponent(userEmail)}`
      );
      const data = (await response.json()) as { logs?: RunLog[] };

      setRunLogs(data.logs ?? []);
      setLogMessage("");
    } catch {
      setLogMessage("Could not load saved runs from the backend.");
    }
  }

  async function saveRunLog() {
    if (!currentUser) return;

    const payload: RunLogInput = {
      fileName,
      userName: currentUser.name,
      userEmail: currentUser.email,
      total: summary.total,
      matched: summary.matched,
      totalProblems: summary.totalProblems,
      ambiguous: summary.ambiguous,
      missingEn: summary.missingEn,
      missingTh: summary.missingTh,
      overrideMismatch: summary.overrideMismatch,
      unpairedRaw: summary.unpairedRaw,
    };

    setLogMessage("Saving run to backend...");

    try {
      const response = await fetch("/api/run-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save run");
      }

      const data = (await response.json()) as { logs?: RunLog[] };
      setRunLogs(data.logs ?? []);
      setLogMessage("Run saved to backend.");
    } catch {
      setLogMessage("Run completed, but backend logging failed.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                Localization QA
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">
                CMS ID Checker
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Compare EN/TH extracted CMS strings, flag review buckets, save
                each QA run on the backend, and export the result for review.
              </p>
            </div>

            {currentUser && (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-right text-sm">
                  <p className="font-semibold">{currentUser.name}</p>
                  <p className="text-slate-500">{currentUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>

        {!currentUser ? (
          <LoginPanel
            loginName={loginName}
            loginEmail={loginEmail}
            loginError={loginError}
            onNameChange={setLoginName}
            onEmailChange={setLoginEmail}
            onSubmit={handleLogin}
          />
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Upload richer extracted CSV
                    </label>
                    <p className="mt-1 text-sm text-slate-500">
                      Required columns: page, locale, CMS ID, override, text,
                      section, and source path.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
                  >
                    Browse File
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {fileName || "No file selected"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Upload once, compare repeatedly while tuning filters.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCompare}
                    className="rounded-md bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Compare
                  </button>
                </div>

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-800">
                  Backend Log
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Each Compare run is saved through a Next API route in
                  `data/run-logs.json`, giving the project a real backend
                  persistence step without depending on unfinished CMS infra.
                </p>
                {logMessage && (
                  <p className="mt-3 rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
                    {logMessage}
                  </p>
                )}
              </div>
            </section>

            {hasCompared && (
              <section className="space-y-5">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                  <SummaryCard label="Total" value={summary.total} />
                  <SummaryCard
                    label="Matched"
                    value={summary.matched}
                    tone="green"
                  />
                  <SummaryCard
                    label="Repeated ID"
                    value={summary.ambiguous}
                    tone="amber"
                  />
                  <SummaryCard
                    label="Override"
                    value={summary.overrideMismatch}
                    tone="orange"
                  />
                  <SummaryCard
                    label="Missing EN"
                    value={summary.missingEn}
                    tone="red"
                  />
                  <SummaryCard
                    label="Missing TH"
                    value={summary.missingTh}
                    tone="red"
                  />
                  <SummaryCard
                    label="Invalid Row"
                    value={summary.unpairedRaw}
                    tone="purple"
                  />
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">QA Results</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {summary.totalProblems === 0
                          ? `No issues found across ${summary.total} CMS IDs.`
                          : `${summary.totalProblems} items need review across ${summary.total} CMS IDs.`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={!filteredResults.length}
                      className="rounded-md border border-slate-950 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Export CSV ({filteredResults.length})
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {FILTERS.map((filter) => (
                      <button
                        key={filter.mode}
                        type="button"
                        onClick={() => setFilterMode(filter.mode)}
                        className={
                          filterMode === filter.mode
                            ? "rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                            : "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        }
                      >
                        {filter.label} ({getFilterCount(filter.mode, summary)})
                      </button>
                    ))}
                  </div>

                  <ResultsTable rows={filteredResults} />
                </div>
              </section>
            )}

            <RunLogTable logs={runLogs} />
          </>
        )}
      </div>
    </main>
  );
}

function LoginPanel({
  loginName,
  loginEmail,
  loginError,
  onNameChange,
  onEmailChange,
  onSubmit,
}: {
  loginName: string;
  loginEmail: string;
  loginError: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-xl font-semibold">Log in</h2>
        <p className="mt-2 text-sm text-slate-500">
          Lightweight demo login for tracking who created each QA run.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Name</label>
            <input
              value={loginName}
              onChange={(event) => onNameChange(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              placeholder="Kae"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Email</label>
            <input
              value={loginEmail}
              onChange={(event) => onEmailChange(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              placeholder="you@example.com"
              type="email"
            />
          </div>

          {loginError && <p className="text-sm text-red-600">{loginError}</p>}

          <button
            type="submit"
            className="rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Log in
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-5">
        <h2 className="text-lg font-semibold text-cyan-950">
          Fullstack demo scope
        </h2>
        <p className="mt-2 text-sm leading-6 text-cyan-950">
          The login stays intentionally simple for mid-July. The meaningful
          fullstack feature is backend run logging: after comparison, the app
          posts a run summary to a Next API route and reloads saved history by
          user email.
        </p>
      </div>
    </section>
  );
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
  const color =
    value > 0
      ? {
          green: "text-emerald-700",
          amber: "text-amber-700",
          orange: "text-orange-700",
          red: "text-red-700",
          purple: "text-purple-700",
        }[tone ?? "green"]
      : "text-slate-900";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ResultsTable({ rows }: { rows: CompareResult[] }) {
  if (!rows.length) {
    return (
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        No rows to show for this filter.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100 text-left text-slate-700">
            <th className="border-b border-slate-200 p-3">CMS ID</th>
            <th className="border-b border-slate-200 p-3">Status</th>
            <th className="border-b border-slate-200 p-3">Section</th>
            <th className="border-b border-slate-200 p-3">EN Text</th>
            <th className="border-b border-slate-200 p-3">TH Text</th>
            <th className="border-b border-slate-200 p-3">Note</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <ResultRow key={`${row.cmsId}-${row.status}`} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultRow({ row }: { row: CompareResult }) {
  const isAmbiguous = row.status === "AMBIGUOUS";

  return (
    <tr className="align-top odd:bg-white even:bg-slate-50">
      <td className="border-b border-slate-200 p-3 font-mono">{row.cmsId}</td>
      <td className="border-b border-slate-200 p-3">
        <span
          className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${STATUS_STYLE[row.status]}`}
        >
          {statusLabel(row.status)}
        </span>
      </td>
      <td className="border-b border-slate-200 p-3">{row.sectionName ?? "-"}</td>
      <td className="border-b border-slate-200 p-3">
        {isAmbiguous ? <VariantList items={row.enVariants} /> : row.enText ?? "-"}
      </td>
      <td className="border-b border-slate-200 p-3">
        {isAmbiguous ? <VariantList items={row.thVariants} /> : row.thText ?? "-"}
      </td>
      <td className="border-b border-slate-200 p-3 text-slate-600">
        {row.note ?? "-"}
      </td>
    </tr>
  );
}

function VariantList({ items }: { items: string[] }) {
  if (!items.length) return <span>-</span>;

  return (
    <ul className="max-h-48 list-disc space-y-0.5 overflow-auto pl-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function RunLogTable({ logs }: { logs: RunLog[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Run Log</h2>
          <p className="text-sm text-slate-500">
            Saved by the backend API, filtered to the logged-in user.
          </p>
        </div>
        <p className="text-sm text-slate-500">{logs.length} saved runs</p>
      </div>

      {logs.length === 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          No saved runs yet. Upload a CSV and compare it to create the first
          backend log.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-slate-700">
                <th className="border-b border-slate-200 p-3">Time</th>
                <th className="border-b border-slate-200 p-3">File</th>
                <th className="border-b border-slate-200 p-3">Total</th>
                <th className="border-b border-slate-200 p-3">Matched</th>
                <th className="border-b border-slate-200 p-3">Needs Review</th>
                <th className="border-b border-slate-200 p-3">Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="odd:bg-white even:bg-slate-50">
                  <td className="border-b border-slate-200 p-3">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="border-b border-slate-200 p-3">
                    {log.fileName}
                  </td>
                  <td className="border-b border-slate-200 p-3">{log.total}</td>
                  <td className="border-b border-slate-200 p-3">
                    {log.matched}
                  </td>
                  <td className="border-b border-slate-200 p-3 font-semibold">
                    {log.totalProblems}
                  </td>
                  <td className="border-b border-slate-200 p-3 text-slate-600">
                    Repeated {log.ambiguous}, Missing EN {log.missingEn},
                    Missing TH {log.missingTh}, Override {log.overrideMismatch},
                    Invalid {log.unpairedRaw}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function getFilterCount(
  mode: FilterMode,
  summary: ReturnType<typeof summarize>
): number {
  switch (mode) {
    case "all":
      return summary.total;
    case "problems_only":
      return summary.totalProblems;
    case "AMBIGUOUS":
      return summary.ambiguous;
    case "OVERRIDE_MISMATCH":
      return summary.overrideMismatch;
    case "MISSING_EN":
      return summary.missingEn;
    case "MISSING_TH":
      return summary.missingTh;
    case "UNPAIRED_RAW":
      return summary.unpairedRaw;
    case "MATCHED":
      return summary.matched;
  }
}

function statusLabel(status: CompareStatus): string {
  const labels: Record<CompareStatus, string> = {
    AMBIGUOUS: "Repeated ID",
    OVERRIDE_MISMATCH: "Override",
    MISSING_EN: "Missing EN",
    MISSING_TH: "Missing TH",
    UNPAIRED_RAW: "Invalid Row",
    MATCHED: "Matched",
  };

  return labels[status];
}
