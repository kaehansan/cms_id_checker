import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { RunLog } from "@/types/runLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "run-logs.json");

const runLogInputSchema = z.object({
  fileName: z.string().min(1),
  userName: z.string().min(1),
  userEmail: z.string().email(),
  total: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  totalProblems: z.number().int().nonnegative(),
  ambiguous: z.number().int().nonnegative(),
  missingEn: z.number().int().nonnegative(),
  missingTh: z.number().int().nonnegative(),
  overrideMismatch: z.number().int().nonnegative(),
  unpairedRaw: z.number().int().nonnegative(),
});

export async function GET(request: Request) {
  const logs = await readRunLogs();
  const userEmail = new URL(request.url).searchParams.get("userEmail");
  const visibleLogs = userEmail
    ? logs.filter((log) => log.userEmail === userEmail)
    : logs;

  return Response.json({ logs: visibleLogs });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = runLogInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid run log payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const nextLog: RunLog = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...parsed.data,
  };
  const logs = await readRunLogs();
  const nextLogs = [nextLog, ...logs].slice(0, 50);

  await writeRunLogs(nextLogs);

  return Response.json({ log: nextLog, logs: nextLogs }, { status: 201 });
}

async function readRunLogs(): Promise<RunLog[]> {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RunLog[]) : [];
  } catch {
    return [];
  }
}

async function writeRunLogs(logs: RunLog[]) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(logs, null, 2));
}
