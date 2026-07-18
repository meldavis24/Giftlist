// Fallback price lookup via Apify actors, for sites that block plain fetches
// (Amazon, Etsy, and similar bot-protected retailers). Mirrors
// web/src/lib/apify-price.ts -- see that file for the reasoning. Paid,
// metered service: only called when the free extraction already failed.

const AMAZON_ACTOR_ID = "R5okfWVzmBtS5gUaJ"; // jaybird/amazon-product-data-scraper
const ETSY_ACTOR_ID = "5PLRL0XsXSe1fpW8q"; // saswave/etsy-product-scraper
const GENERIC_ACTOR_ID = "43imkJ5nkiEbP4281"; // khadinakbar/ecommerce-store-scraper

async function runApifyActor(actorId, input, timeoutMs) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;
    const items = await res.json();
    return Array.isArray(items) ? items : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function toPositiveNumber(value) {
  if (value == null) return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// The worker isn't bounded by a serverless function timeout, so it can afford
// a more generous default wait than the interactive web app's fallback.
export async function fetchPriceViaApify(url, timeoutMs = 60000) {
  let hostname;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }

  if (hostname.includes("amazon.")) {
    const items = await runApifyActor(AMAZON_ACTOR_ID, { startUrls: [{ url }] }, timeoutMs);
    return toPositiveNumber(items?.[0]?.price);
  }

  if (hostname === "etsy.com") {
    const items = await runApifyActor(ETSY_ACTOR_ID, { direct_urls: [url] }, timeoutMs);
    return toPositiveNumber(items?.[0]?.price) ?? toPositiveNumber(items?.[0]?.low_price);
  }

  const items = await runApifyActor(
    GENERIC_ACTOR_ID,
    { startUrls: [{ url }], maxProducts: 1, includeVariants: false, includeDescription: false },
    timeoutMs
  );
  return toPositiveNumber(items?.[0]?.price);
}
