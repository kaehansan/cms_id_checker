import { z } from "zod";
import { extractCmsRows, HtmlInput, rowsToCsv } from "@/lib/cmsExtractor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_HTML_BYTES = 5 * 1024 * 1024;

const jsonInputSchema = z.object({
  inputs: z
    .array(
      z.object({
        html: z.string().min(1),
        fileName: z.string().optional(),
        pageName: z.string().optional(),
        locale: z.string().optional(),
      })
    )
    .min(1)
    .optional(),
  url: z.string().url().optional(),
  urls: z.array(z.string().url()).min(1).optional(),
  pageName: z.string().optional(),
  locale: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const inputs = await readInputs(request);

    if (inputs.length === 0) {
      return Response.json(
        { error: "Provide at least one HTML file, pasted HTML block, or URL." },
        { status: 400 }
      );
    }

    const rows = extractCmsRows(inputs);
    const csv = rowsToCsv(rows);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildOutputName(rows.length)}"`,
        "X-CMS-Extracted-Rows": String(rows.length),
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to extract CMS rows from HTML.",
      },
      { status: 400 }
    );
  }
}

async function readInputs(request: Request): Promise<HtmlInput[]> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    const html = formData.get("html");
    const pageName = stringValue(formData.get("pageName"));
    const locale = stringValue(formData.get("locale"));
    const inputs: HtmlInput[] = [];

    for (const file of files) {
      if (file.size > MAX_HTML_BYTES) {
        throw new Error(`${file.name} is larger than 5MB.`);
      }

      inputs.push({
        html: await file.text(),
        fileName: file.name,
        pageName,
        locale,
      });
    }

    if (typeof html === "string" && html.trim()) {
      inputs.push({
        html,
        fileName: "pasted-html.html",
        pageName,
        locale,
      });
    }

    return inputs;
  }

  const parsed = jsonInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new Error("Invalid extractor request payload.");
  }

  const urls = parsed.data.urls ?? (parsed.data.url ? [parsed.data.url] : []);

  if (urls.length > 0) {
    return Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url, {
          headers: { "User-Agent": "cms-check-app-extractor" },
        });

        if (!response.ok) {
          throw new Error(`${url} failed with HTTP ${response.status}.`);
        }

        const html = await response.text();
        const inferred = inferUrlMetadata(url);

        return {
          html,
          fileName: inferred.fileName,
          pageName: parsed.data.pageName ?? inferred.pageName,
          locale: parsed.data.locale ?? inferred.locale,
        };
      })
    );
  }

  return parsed.data.inputs ?? [];
}

function stringValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildOutputName(rowCount: number): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  return `cms_extracted_${rowCount}_rows_${stamp}.csv`;
}

function inferUrlMetadata(url: string): {
  fileName: string;
  pageName: string;
  locale: string;
} {
  const parsedUrl = new URL(url);
  const segments = parsedUrl.pathname.split("/").filter(Boolean);
  const decodedUrl = decodeURIComponent(url);
  const locale =
    segments.find((segment) => /^[a-z]{2}-[a-z]{2}$/i.test(segment)) ??
    decodedUrl.match(/(?:^|\/)([a-z]{2}-[a-z]{2})(?:\/|\?|$)/i)?.[1] ??
    (parsedUrl.hostname.endsWith("agoda.com") && segments.length === 0
      ? "en-us"
      : undefined);
  const pageSegments = segments.filter((segment) => segment !== locale);
  const pageName = pageSegments[0] ?? "home";

  return {
    fileName: `${pageName}__${locale ?? "unknown"}__showcmsid.html`,
    pageName,
    locale: locale?.toLowerCase() ?? "unknown",
  };
}
