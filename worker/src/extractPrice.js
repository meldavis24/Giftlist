import * as cheerio from "cheerio";

function toNumber(value) {
  if (value == null) return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function priceFromJsonLd($) {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const el of scripts) {
    let parsed;
    try {
      parsed = JSON.parse($(el).contents().text());
    } catch {
      continue;
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(parsed?.["@graph"] ?? [])];
    for (const node of candidates) {
      if (!node || typeof node !== "object") continue;
      const type = node["@type"];
      const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
      if (!isProduct) continue;
      const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
      const price = toNumber(offers?.price ?? offers?.lowPrice);
      if (price) return price;
    }
  }
  return null;
}

function priceFromMetaTags($) {
  const selectors = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
  ];
  for (const selector of selectors) {
    const content = $(selector).attr("content");
    const price = toNumber(content);
    if (price) return price;
  }
  return null;
}

/**
 * Best-effort price extraction from a product page's HTML. Works for retailers
 * that expose structured data (JSON-LD Product/Offer, Open Graph price meta
 * tags) for SEO -- Etsy, Target, Walmart and many Shopify stores generally do.
 * Sites that render price client-side with JavaScript and no structured data
 * (Amazon in particular actively blocks non-browser requests) won't resolve
 * here; that needs a headless-browser approach or an official retailer API.
 */
export function extractPrice(html) {
  const $ = cheerio.load(html);
  return priceFromJsonLd($) ?? priceFromMetaTags($);
}
