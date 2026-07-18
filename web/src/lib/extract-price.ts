import * as cheerio from "cheerio";

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function priceFromJsonLd($: cheerio.CheerioAPI): number | null {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const el of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse($(el).contents().text());
    } catch {
      continue;
    }
    const root = parsed as Record<string, unknown> | Record<string, unknown>[];
    const graph = !Array.isArray(root) ? (root["@graph"] as unknown[] | undefined) : undefined;
    const candidates = Array.isArray(root) ? root : [root, ...(graph ?? [])];
    for (const node of candidates as Record<string, unknown>[]) {
      if (!node || typeof node !== "object") continue;
      const type = node["@type"];
      const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
      if (!isProduct) continue;
      const offersRaw = node.offers as Record<string, unknown> | Record<string, unknown>[];
      const offers = Array.isArray(offersRaw) ? offersRaw[0] : offersRaw;
      const price = toNumber(offers?.price ?? offers?.lowPrice);
      if (price) return price;
    }
  }
  return null;
}

function priceFromMetaTags($: cheerio.CheerioAPI): number | null {
  const selectors = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
  ];
  for (const selector of selectors) {
    const price = toNumber($(selector).attr("content"));
    if (price) return price;
  }
  return null;
}

/**
 * Best-effort price extraction from a product page's HTML -- same approach as
 * worker/src/extractPrice.js. Works for retailers exposing structured data
 * (JSON-LD Product/Offer, Open Graph price meta tags); won't resolve prices
 * rendered client-side with no structured data (notably Amazon, which also
 * actively blocks non-browser requests).
 */
export function extractPrice(html: string): number | null {
  const $ = cheerio.load(html);
  return priceFromJsonLd($) ?? priceFromMetaTags($);
}

export async function fetchProductPrice(url: string): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    if (!res.ok) return null;
    return extractPrice(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
