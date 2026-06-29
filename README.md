# CMS ID Checker

Fullstack QA helper for comparing Agoda CMS-tagged strings between English and Thai snapshots.

## Workflow

```text
Saved Agoda HTML -> Python extractor -> richer CSV -> Next.js checker -> backend run log -> CSV export
```

## Run The App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Extract CMS Strings From Saved HTML

The extractor converts saved HTML files that contain visible CMS markers into the CSV format expected by the app.

Default input filenames:

```text
home__en-us__showcmsid.html.html
home__th-th__showcmsid.html.html
```

Run:

```bash
python scripts/extract_cms_from_html.py --out cms_extracted_richer_data.csv
```

Or pass explicit files:

```bash
python scripts/extract_cms_from_html.py \
  --html home__en-us__showcmsid.html.html \
  --html home__th-th__showcmsid.html.html \
  --out cms_extracted_richer_data.csv
```

The output columns are:

```text
page_name, locale, cms_id, override_id, text, section_name, source_object_path
```

## Compare And Log Runs

1. Log in with a demo name and email.
2. Upload the richer CSV.
3. Click Compare.
4. Review buckets such as Matched, Repeated ID, Missing EN, Missing TH, Override, and Invalid Row.
5. Export the filtered report as CSV.

Each comparison run is saved through `app/api/run-logs/route.ts` to `data/run-logs.json`. The runtime log file is ignored by git.
