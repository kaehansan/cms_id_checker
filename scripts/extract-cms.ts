import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractCmsRows, HtmlInput, rowsToCsv } from "@/lib/cmsExtractor";

type CliArgs = {
  htmlPaths: string[];
  out?: string;
  pageName?: string;
  locale?: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const htmlPaths =
    args.htmlPaths.length > 0
      ? args.htmlPaths
      : ["home__en-us__showcmsid.html.html", "home__th-th__showcmsid.html.html"];

  if ((args.pageName || args.locale) && htmlPaths.length !== 1) {
    throw new Error("--page-name and --locale overrides only work with one --html file.");
  }

  const inputs: HtmlInput[] = await Promise.all(
    htmlPaths.map(async (htmlPath) => ({
      html: await readFile(htmlPath, "utf8"),
      fileName: path.basename(htmlPath),
      pageName: args.pageName,
      locale: args.locale,
    }))
  );
  const rows = extractCmsRows(inputs);
  const outPath = args.out ?? defaultOutputPath();

  await writeFile(outPath, rowsToCsv(rows), "utf8");

  console.log(`Saved: ${outPath}`);
  console.log(`Total rows: ${rows.length}`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { htmlPaths: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--html" && next) {
      args.htmlPaths.push(next);
      index += 1;
    } else if (arg === "--out" && next) {
      args.out = next;
      index += 1;
    } else if (arg === "--page-name" && next) {
      args.pageName = next;
      index += 1;
    } else if (arg === "--locale" && next) {
      args.locale = next;
      index += 1;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return args;
}

function defaultOutputPath(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  return `cms_extracted_richer_data${stamp}.csv`;
}

function printHelp() {
  console.log(`Usage:
  npm run extract:cms -- --html home__en-us__showcmsid.html.html --html home__th-th__showcmsid.html.html --out cms.csv

Options:
  --html <path>       HTML file to extract. Repeat for multiple files.
  --out <path>        Output CSV path.
  --page-name <name>  Page override for one HTML file.
  --locale <locale>   Locale override for one HTML file.
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
