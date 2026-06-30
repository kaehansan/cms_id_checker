export type HtmlInput = {
  html: string;
  fileName?: string;
  pageName?: string;
  locale?: string;
};

export type CmsExtractedRow = {
  page_name: string;
  locale: string;
  cms_id: string;
  override_id: string;
  text: string;
  section_name: string;
  source_object_path: string;
  location_hint: string;
};

export const CMS_EXTRACTOR_FIELDS = [
  "page_name",
  "locale",
  "cms_id",
  "override_id",
  "text",
  "section_name",
  "source_object_path",
  "location_hint",
] as const;

const CMS_BLOCK_PATTERN =
  /\[CMS ID:\s*(\d+)\](?:,\s*\[Override ID:\s*(\d+)\])?\s*:\s*/gi;

const ROOT_PATTERNS: Array<[string, string, string]> = [
  ["agoda.reactHeader.menuViewModel", "header", "agoda.reactHeader.menuViewModel"],
  [
    "agoda.reactHeader.logoAndLinksMenu",
    "header_product_nav",
    "agoda.reactHeader.logoAndLinksMenu",
  ],
  ["agoda.reactHeader.covidBanner", "covid_banner", "agoda.reactHeader.covidBanner"],
  ["window.searchBoxReact", "hero_search_box", "window.searchBoxReact"],
  ["window.flightSearchBoxReact", "flights_search_box", "window.flightSearchBoxReact"],
  ["window.carsSearchBoxReact", "cars_search_box", "window.carsSearchBoxReact"],
  [
    "window.homePageParams.prominentAppDownloadBanner",
    "app_download_banner",
    "window.homePageParams.prominentAppDownloadBanner",
  ],
  [
    "window.homePageParams.homeComponent",
    "home_component",
    "window.homePageParams.homeComponent",
  ],
  ["footerProps", "footer", "footerProps"],
];

const SUBSECTION_RULES: Array<[string, string, string]> = [
  ["vipBarTranslations", "vip_bar", "vipBarTranslations"],
  [
    "loyaltyGuestBannerTranslations",
    "loyalty_guest_banner",
    "loyaltyGuestBannerTranslations",
  ],
  ["pendingReviewsBanner", "pending_reviews_banner", "pendingReviewsBanner"],
  [
    "travelRestrictionBannerContainerTranslations",
    "travel_restriction_banner",
    "travelRestrictionBannerContainerTranslations",
  ],
  ["funnelCarouselsTranslations", "funnel_carousels", "funnelCarouselsTranslations"],
  ["longStayPromotionBanner", "long_stay_banner", "longStayPromotionBanner"],
  ["featuredProperties", "featured_properties", "featuredProperties"],
  ["agodaNumbers", "agoda_numbers", "agodaNumbers"],
  ["footerSeoLinksGroups", "footer_seo_links", "footerSeoLinksGroups"],
];

const KNOWN_LOCATION_HINTS: Record<string, string> = {
  "343673": "Flights tab > child age dropdown",
};

const SECTION_LOCATION_HINTS: Record<string, string> = {
  header: "Header > navigation or account controls",
  header_product_nav: "Header > product navigation",
  covid_banner: "Top page banner > travel notice",
  hero_search_box: "Hero search box > booking widget",
  flights_search_box: "Flights search box > flight search form",
  cars_search_box: "Cars search box > car rental form",
  app_download_banner: "App download banner",
  home_component: "Homepage content",
  footer: "Footer",
  footer_seo_links: "Footer > SEO links",
};

type Marker = {
  position: number;
  sectionName: string;
  sourceObjectPath: string;
};

export function extractCmsRows(inputs: HtmlInput[]): CmsExtractedRow[] {
  return dedupeRows(inputs.flatMap((input) => extractRowsFromHtml(input)));
}

export function rowsToCsv(rows: CmsExtractedRow[]): string {
  const header = CMS_EXTRACTOR_FIELDS.join(",");
  const body = rows.map((row) =>
    CMS_EXTRACTOR_FIELDS.map((field) => csvCell(row[field])).join(",")
  );

  return ["\uFEFF" + header, ...body].join("\r\n");
}

export function inferPageAndLocale(fileName = ""): {
  pageName: string;
  locale: string;
} {
  const normalized = fileName
    .replace(/\.html\.html$/i, "")
    .replace(/\.html$/i, "");
  const parts = normalized.split("__");

  if (parts.length >= 2) {
    return {
      pageName: parts[0] || "unknown",
      locale: parts[1] || "unknown",
    };
  }

  return { pageName: "unknown", locale: "unknown" };
}

function extractRowsFromHtml(input: HtmlInput): CmsExtractedRow[] {
  const inferred = inferPageAndLocale(input.fileName);
  const pageName = input.pageName?.trim() || inferred.pageName;
  const locale = input.locale?.trim() || inferred.locale;
  const text = decodeHtmlEntities(input.html);
  const markers = collectMarkers(text);
  const rows: CmsExtractedRow[] = [];
  const pattern = new RegExp(CMS_BLOCK_PATTERN);
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const { sectionName, sourceObjectPath } = findNearestMarker(
      markers,
      match.index
    );
    const cmsId = match[1].trim();
    const rawText = readValueAfter(text, pattern.lastIndex);

    rows.push({
      page_name: pageName,
      locale,
      cms_id: cmsId,
      override_id: match[2]?.trim() ?? "",
      text: cleanText(rawText),
      section_name: sectionName,
      source_object_path: sourceObjectPath,
      location_hint: inferLocationHint(cmsId, sectionName, sourceObjectPath),
    });
  }

  return rows;
}

function collectMarkers(text: string): Marker[] {
  const markers: Marker[] = [];

  for (const [needle, sectionName, sourceObjectPath] of [
    ...ROOT_PATTERNS,
    ...SUBSECTION_RULES,
  ]) {
    let position = text.indexOf(needle);

    while (position !== -1) {
      markers.push({ position, sectionName, sourceObjectPath });
      position = text.indexOf(needle, position + needle.length);
    }
  }

  return markers.sort((left, right) => left.position - right.position);
}

function findNearestMarker(
  markers: Marker[],
  position: number
): { sectionName: string; sourceObjectPath: string } {
  let best = { sectionName: "", sourceObjectPath: "" };

  for (const marker of markers) {
    if (marker.position > position) break;
    best = {
      sectionName: marker.sectionName,
      sourceObjectPath: marker.sourceObjectPath,
    };
  }

  return best;
}

function inferLocationHint(
  cmsId: string,
  sectionName: string,
  sourceObjectPath: string
): string {
  if (KNOWN_LOCATION_HINTS[cmsId]) return KNOWN_LOCATION_HINTS[cmsId];
  if (sectionName && SECTION_LOCATION_HINTS[sectionName]) {
    return SECTION_LOCATION_HINTS[sectionName];
  }
  if (sourceObjectPath) return sourceObjectPath.replaceAll(".", " > ");
  return "";
}

function readValueAfter(text: string, startIndex: number, maxLength = 800): string {
  const tail = text.slice(startIndex, startIndex + maxLength);

  if (!tail) return "";

  if (tail.startsWith('"')) {
    let escaped = false;
    let output = "";

    for (const char of tail.slice(1)) {
      if (escaped) {
        output += char;
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
        output += char;
      } else if (char === '"') {
        break;
      } else {
        output += char;
      }
    }

    return output;
  }

  const terminators = [",", "}", "]", "\n", "\r", "<"];
  const end = terminators.reduce((currentEnd, char) => {
    const index = tail.indexOf(char);
    return index === -1 ? currentEnd : Math.min(currentEnd, index);
  }, tail.length);

  return tail.slice(0, end);
}

function cleanText(value: string): string {
  return value
    .trim()
    .replace(/^[",}\]\s]+|[",}\]\s]+$/g, "")
    .replace(/\\"/g, '"')
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0027/g, "'")
    .replace(/\\u0026/g, "&")
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function dedupeRows(rows: CmsExtractedRow[]): CmsExtractedRow[] {
  const seen = new Set<string>();
  const output: CmsExtractedRow[] = [];

  for (const row of rows) {
    const key = CMS_EXTRACTOR_FIELDS.map((field) => row[field]).join("\u001F");
    if (!seen.has(key)) {
      seen.add(key);
      output.push(row);
    }
  }

  return output;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
