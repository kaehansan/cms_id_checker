from __future__ import annotations

import argparse
import csv
import os
import re
from dataclasses import dataclass
from datetime import datetime
from html import unescape
from pathlib import Path


CMS_BLOCK_PATTERN = re.compile(
    r"\[CMS ID:\s*(\d+)\](?:,\s*\[Override ID:\s*(\d+)\])?\s*:\s*",
    re.IGNORECASE,
)

ROOT_PATTERNS = [
    ("agoda.reactHeader.menuViewModel", "header", "agoda.reactHeader.menuViewModel"),
    (
        "agoda.reactHeader.logoAndLinksMenu",
        "header_product_nav",
        "agoda.reactHeader.logoAndLinksMenu",
    ),
    ("agoda.reactHeader.covidBanner", "covid_banner", "agoda.reactHeader.covidBanner"),
    ("window.searchBoxReact", "hero_search_box", "window.searchBoxReact"),
    ("window.flightSearchBoxReact", "flights_search_box", "window.flightSearchBoxReact"),
    ("window.carsSearchBoxReact", "cars_search_box", "window.carsSearchBoxReact"),
    (
        "window.homePageParams.prominentAppDownloadBanner",
        "app_download_banner",
        "window.homePageParams.prominentAppDownloadBanner",
    ),
    (
        "window.homePageParams.homeComponent",
        "home_component",
        "window.homePageParams.homeComponent",
    ),
    ("footerProps", "footer", "footerProps"),
]

SUBSECTION_RULES = [
    ("vipBarTranslations", "vip_bar", "vipBarTranslations"),
    (
        "loyaltyGuestBannerTranslations",
        "loyalty_guest_banner",
        "loyaltyGuestBannerTranslations",
    ),
    ("pendingReviewsBanner", "pending_reviews_banner", "pendingReviewsBanner"),
    (
        "travelRestrictionBannerContainerTranslations",
        "travel_restriction_banner",
        "travelRestrictionBannerContainerTranslations",
    ),
    ("funnelCarouselsTranslations", "funnel_carousels", "funnelCarouselsTranslations"),
    ("longStayPromotionBanner", "long_stay_banner", "longStayPromotionBanner"),
    ("featuredProperties", "featured_properties", "featuredProperties"),
    ("agodaNumbers", "agoda_numbers", "agodaNumbers"),
    ("footerSeoLinksGroups", "footer_seo_links", "footerSeoLinksGroups"),
]

KNOWN_LOCATION_HINTS = {
    "343673": "Flights tab > child age dropdown",
}

SECTION_LOCATION_HINTS = {
    "header": "Header > navigation or account controls",
    "header_product_nav": "Header > product navigation",
    "covid_banner": "Top page banner > travel notice",
    "hero_search_box": "Hero search box > booking widget",
    "flights_search_box": "Flights search box > flight search form",
    "cars_search_box": "Cars search box > car rental form",
    "app_download_banner": "App download banner",
    "home_component": "Homepage content",
    "footer": "Footer",
    "footer_seo_links": "Footer > SEO links",
}

CSV_FIELDS = [
    "page_name",
    "locale",
    "cms_id",
    "override_id",
    "text",
    "section_name",
    "source_object_path",
    "location_hint",
]


@dataclass(frozen=True)
class HtmlInput:
    path: Path
    page_name: str
    locale: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract CMS-tagged strings from saved Agoda HTML into richer CSV."
    )
    parser.add_argument(
        "--html",
        action="append",
        default=[],
        help=(
            "HTML file to parse. Repeat for multiple files. Filenames should look like "
            "home__en-us__showcmsid.html.html unless --page-name/--locale are supplied."
        ),
    )
    parser.add_argument(
        "--page-name",
        help="Optional page name override. Use only when parsing one --html file.",
    )
    parser.add_argument(
        "--locale",
        help="Optional locale override. Use only when parsing one --html file.",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Output CSV path. Defaults to cms_extracted_richer_data<timestamp>.csv.",
    )
    return parser.parse_args()


def parse_filename(file_path: Path) -> tuple[str, str]:
    name = file_path.name
    if name.endswith(".html.html"):
        name = name[:-10]
    elif name.endswith(".html"):
        name = name[:-5]

    parts = name.split("__")
    if len(parts) < 2:
        raise ValueError(
            f"Unexpected filename format: {file_path.name}. "
            "Expected page__locale__description.html."
        )

    return parts[0], parts[1]


def clean_text(value: str) -> str:
    value = value.strip()
    value = value.strip('",}] ')
    value = value.replace('\\"', '"')
    value = value.replace("\\u003c", "<").replace("\\u003e", ">")
    value = value.replace("\\u0027", "'").replace("\\u0026", "&")
    value = value.replace("\\n", " ").replace("\\r", " ").replace("\\t", " ")
    return re.sub(r"\s+", " ", value).strip()


def collect_markers(text: str) -> list[tuple[int, str, str]]:
    markers: list[tuple[int, str, str]] = []

    for needle, section_name, source_path in ROOT_PATTERNS + SUBSECTION_RULES:
        for match in re.finditer(re.escape(needle), text):
            markers.append((match.start(), section_name, source_path))

    return sorted(markers, key=lambda marker: marker[0])


def find_nearest_marker(
    markers: list[tuple[int, str, str]], position: int
) -> tuple[str | None, str | None]:
    best: tuple[str | None, str | None] = (None, None)

    for marker_position, section_name, source_path in markers:
        if marker_position <= position:
            best = (section_name, source_path)
        else:
            break

    return best


def infer_location_hint(
    cms_id: str, section_name: str | None, source_object_path: str | None
) -> str:
    if cms_id in KNOWN_LOCATION_HINTS:
        return KNOWN_LOCATION_HINTS[cms_id]

    if section_name and section_name in SECTION_LOCATION_HINTS:
        return SECTION_LOCATION_HINTS[section_name]

    if source_object_path:
        return source_object_path.replace(".", " > ")

    return ""


def read_value_after(text: str, start_index: int, max_len: int = 800) -> str:
    tail = text[start_index : start_index + max_len]

    if not tail:
        return ""

    if tail.startswith('"'):
        escaped = False
        output: list[str] = []

        for char in tail[1:]:
            if escaped:
                output.append(char)
                escaped = False
            elif char == "\\":
                escaped = True
                output.append(char)
            elif char == '"':
                break
            else:
                output.append(char)

        return "".join(output)

    end = len(tail)
    for char in [",", "}", "]", "\n", "\r", "<"]:
        index = tail.find(char)
        if index != -1:
            end = min(end, index)

    return tail[:end]


def extract_rows_from_html(html_input: HtmlInput) -> list[dict[str, str]]:
    text = html_input.path.read_text(encoding="utf-8", errors="ignore")
    text = unescape(text)
    markers = collect_markers(text)
    rows: list[dict[str, str]] = []

    for match in CMS_BLOCK_PATTERN.finditer(text):
        section_name, source_object_path = find_nearest_marker(markers, match.start())
        cms_id = match.group(1).strip()
        raw_text = read_value_after(text, match.end())

        rows.append(
            {
                "page_name": html_input.page_name,
                "locale": html_input.locale,
                "cms_id": cms_id,
                "override_id": match.group(2).strip() if match.group(2) else "",
                "text": clean_text(raw_text),
                "section_name": section_name or "",
                "source_object_path": source_object_path or "",
                "location_hint": infer_location_hint(
                    cms_id, section_name, source_object_path
                ),
            }
        )

    return rows


def dedupe_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, ...]] = set()
    output: list[dict[str, str]] = []

    for row in rows:
        key = tuple(row[field] for field in CSV_FIELDS)
        if key not in seen:
            seen.add(key)
            output.append(row)

    return output


def build_inputs(args: argparse.Namespace) -> list[HtmlInput]:
    html_paths = [Path(value) for value in args.html] or [
        Path("home__en-us__showcmsid.html.html"),
        Path("home__th-th__showcmsid.html.html"),
    ]

    if (args.page_name or args.locale) and len(html_paths) != 1:
        raise ValueError("--page-name and --locale overrides only work with one --html file.")

    inputs: list[HtmlInput] = []
    for html_path in html_paths:
        if args.page_name and args.locale:
            page_name, locale = args.page_name, args.locale
        else:
            page_name, locale = parse_filename(html_path)

        inputs.append(HtmlInput(path=html_path, page_name=page_name, locale=locale))

    return inputs


def default_output_path() -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return Path(f"cms_extracted_richer_data{timestamp}.csv")


def cli_path(value: str) -> Path:
    return Path(value.replace("\\", os.sep).replace("/", os.sep))


def main() -> None:
    args = parse_args()
    html_inputs = build_inputs(args)
    rows: list[dict[str, str]] = []

    for html_input in html_inputs:
        rows.extend(extract_rows_from_html(html_input))

    rows = dedupe_rows(rows)
    output_file = cli_path(args.out) if args.out else default_output_path()
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with output_file.open("w", encoding="utf-8-sig", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Saved: {output_file}")
    print(f"Total rows: {len(rows)}")


if __name__ == "__main__":
    main()
