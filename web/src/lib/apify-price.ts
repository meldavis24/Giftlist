// Fallback price lookup via Apify actors, for sites that block plain server-side
// fetches (Amazon, Etsy, and similar bot-protected retailers -- see README for
// why the free direct-fetch approach can't read those sites at all). This is a
// paid, metered service: only call it when the free extraction already failed.

const AMAZON_ACTOR_ID = "R5okfWVzmBtS5gUaJ"; // jaybird/amazon-product-data-scraper
const ETSY_ACTOR_ID = "5PLRL0XsXSe1fpW8q"; // saswave/etsy-product-scraper
const GENERIC_ACTOR_ID = "43imkJ5nkiEbP4281"; // khadinakbar/ecommerce-store-scraper

async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  timeoutMs: number
): Promise<unknown[] | null> {
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

function toPositiveNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * timeoutMs should stay well under the caller's own execution budget --
 * shorter for the interactive web app (bounded by the serverless function
 * timeout), longer is fine for the standalone worker.
 */
export async function fetchPriceViaApify(url: string, timeoutMs = 20000): Promise<number | null> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }

  if (hostname.includes("amazon.")) {
    const items = await runApifyActor(AMAZON_ACTOR_ID, { startUrls: [{ url }] }, timeoutMs);
    return toPositiveNumber((items?.[0] as { price?: unknown })?.price);
  }

  if (hostname === "etsy.com") {
    const items = await runApifyActor(ETSY_ACTOR_ID, { direct_urls: [url] }, timeoutMs);
    const item = items?.[0] as { price?: unknown; low_price?: unknown } | undefined;
    return toPositiveNumber(item?.price) ?? toPositiveNumber(item?.low_price);
  }

  // Generic fallback: any other site the free method couldn't read.
  const items = await runApifyActor(
    GENERIC_ACTOR_ID,
    { startUrls: [{ url }], maxProducts: 1, includeVariants: false, includeDescription: false },
    timeoutMs
  );
  return toPositiveNumber((items?.[0] as { price?: unknown })?.price);
}
