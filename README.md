# CMS ID Checker

CMS ID Checker is a fullstack QA helper for reviewing Agoda CMS-tagged strings across English and Thai page snapshots. It turns saved HTML with visible CMS markers into a richer CSV, compares CMS IDs across locales, highlights strings that need review, saves comparison runs through a backend API, and exports QA reports.

The project is scoped for localization QA workflows where the full CMS integration is still in progress, but reviewers need a practical way to inspect extracted CMS strings today.

## Features

- Extract CMS-tagged strings from saved Agoda HTML into a richer CSV.
- Validate uploaded CSV files before comparison.
- Compare English and Thai strings by `cms_id`.
- Detect review buckets: matched, repeated CMS ID, missing EN, missing TH, override mismatch, and invalid rows.
- Show a Section Map that groups issues by page area, such as Header, Hero Search Box, Home Content, and Footer.
- Save each comparison run through a Next.js backend API.
- Export filtered results as CSV for review or handoff.

## Workflow

```text
Saved Agoda HTML
  -> Python extractor
  -> richer CSV
  -> Next.js checker
  -> Section Map + QA results
  -> backend run log
  -> CSV export
```

## Quick Start

### Prerequisites

- Node.js compatible with Next.js 16.
- npm.
- Python 3 for the optional HTML extraction script.

### Installation

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm run start
```

## Extract CMS Strings From Saved HTML

Use the Python extractor when you have raw HTML files saved from pages with visible CMS IDs enabled.

Default input filenames:

```text
home__en-us__showcmsid.html.html
home__th-th__showcmsid.html.html
```

Run with default inputs:

```bash
python scripts/extract_cms_from_html.py --out cms_extracted_richer_data.csv
```

Run with explicit inputs:

```bash
python scripts/extract_cms_from_html.py \
  --html home__en-us__showcmsid.html.html \
  --html home__th-th__showcmsid.html.html \
  --out cms_extracted_richer_data.csv
```

The extractor writes these columns:

```text
page_name, locale, cms_id, override_id, text, section_name, source_object_path
```

The notebook version of the extractor is kept in `extracted_richer_data.ipynb` for reference and experimentation. The reusable command-line version lives in `scripts/extract_cms_from_html.py`.

## Use The Checker

1. Log in with a demo name and email.
2. Upload a richer extracted CSV.
3. Click **Compare**.
4. Review the summary cards and Section Map.
5. Click a Section Map card to narrow results to that page area.
6. Use filters such as **Needs Review**, **Repeated ID**, or **Missing EN**.
7. Export the current filtered result set as CSV.

## Review Buckets

| Bucket | Meaning |
| --- | --- |
| Matched | EN and TH both have one normalized text value for the CMS ID. |
| Repeated ID | The same CMS ID appears with multiple distinct text values in EN or TH. This may be expected for dropdowns or repeated UI patterns, but it needs human review. |
| Missing EN | TH text exists, but EN text is missing or empty after normalization. |
| Missing TH | EN text exists, but TH text is missing or empty after normalization. |
| Override | EN and TH have different `override_id` sets for the same CMS ID. |
| Invalid Row | A raw row cannot be paired because it is missing a CMS ID or has an unsupported locale. |

## Section Map

The Section Map translates technical extraction fields into reviewer-friendly page areas. For example, `hero_search_box` becomes **Hero Search Box**.

It helps reviewers answer:

- Which page sections have issues?
- How many CMS IDs need review in each section?
- Is the issue concentrated in the search box, home content, footer, or header?

This is intentionally a section-level map, not a pixel-perfect screenshot overlay.

## Backend Run Log

Each comparison run is saved through:

```text
app/api/run-logs/route.ts
```

At runtime, logs are written to:

```text
data/run-logs.json
```

`data/run-logs.json` is ignored by git because it is local runtime data. The API currently stores run summaries in a JSON file so the project can demonstrate a backend persistence step without depending on unfinished CMS or database infrastructure.

## Project Structure

```text
app/
  api/run-logs/route.ts     Backend API for saved QA runs
  page.tsx                  Main checker UI
lib/
  compare.ts                CMS comparison and summary logic
  csvSchema.ts              CSV validation
  exportCsv.ts              CSV export helper
  normalize.ts              Text and override normalization
scripts/
  extract_cms_from_html.py  HTML-to-CSV extractor
types/
  qa.ts                     QA comparison types
  runLog.ts                 Backend run log types
```

## Technologies

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Zod
- Papa Parse
- Python standard library for HTML extraction

## Validation Commands

Run these before pushing changes:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Current Limitations

- Login is demo-only. It identifies the user for run logging but does not implement production authentication.
- Run logs are stored in a local JSON file, not Postgres.
- The Section Map shows inferred page sections, not exact pixel coordinates.
- The extractor depends on saved HTML with visible CMS markers.
- The current comparison flow focuses on EN and TH.

## Roadmap

- Move run logs from JSON file storage to Prisma/Postgres.
- Add a saved run detail page.
- Add reviewer notes or issue status per CMS ID.
- Improve section hints for common CMS IDs inside the Hero Search Box.
- Add support for more locale pairs.
- Explore screenshot overlays after the section-level workflow is stable.

## Repository Notes

This project was built as a fullstack milestone for a CMS localization QA workflow. The full CMS automation is intentionally treated as a later phase; the current app focuses on extracting, comparing, reviewing, logging, and exporting QA results.
