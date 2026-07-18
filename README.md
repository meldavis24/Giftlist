# GiftList

Track gift/shopping wish lists for Christmas, birthdays, graduations, anniversaries, etc.
Share lists with family, let others claim items without spoiling the surprise for the
list owner, and get notified when something on your list goes on sale.

This repo currently contains **Phase 1 and most of Phase 2** of the roadmap below.

## Repo structure

- `web/` — Next.js 16 (App Router, TypeScript, Tailwind) web app
- `worker/` — standalone Node service that scheduledly re-checks item prices and
  sends the actual push notifications when something drops
- `extension/` — Chrome/Edge (Manifest V3) extension to add the current tab to a
  list without leaving the retailer's site
- `supabase/migrations/` — full DB schema + row-level security policies

Planned, not yet built:
- `mobile/` — Expo app for native push (Phase 3)

## Features so far

- Email/password + magic-link auth (Supabase Auth)
- Create lists per occasion
- Add items by pasting a product URL, from the app or from the browser extension
- Invite others to a list by email (viewer or editor role)
- **Claim-privacy rule**: if someone else claims an item on *your* list, you (the
  owner) never see that it's claimed — enforced at the database level via RLS, not
  just hidden in the UI, so there's no code path that can leak it by accident
- "Buy" button opens the product page in a new tab; checkout/payment always happens
  on the retailer's own site using your browser's saved payment info — this app
  never stores card data
- Real price checking, two-tier (`web/src/lib/extract-price.ts` +
  `apify-price.ts`, mirrored in `worker/src/`):
  1. **Free**: fetch the page directly and read JSON-LD `Product`/`Offer` data or
     Open Graph price meta tags. Works on sites with no bot protection
     (independent/Shopify stores, etc.).
  2. **Paid fallback via Apify** (only runs if step 1 finds nothing, and only if
     `APIFY_API_TOKEN` is set): routes Amazon/Etsy URLs to actors built to get
     past their bot protection, and anything else to a generic ecommerce actor.
  Confirmed directly (not assumed) that Amazon and Etsy both block the free
  method outright with bot-detection services (DataDome, in Etsy's case) that
  return a CAPTCHA wall regardless of request headers — this is why the Apify
  fallback exists. See **Apify cost** below before turning it on.
- Manual "Check price now" button (in the app) and a scheduled worker (`worker/`,
  runs independently) both use the same extraction logic and send a real Web Push
  notification to every list member when price drops at/below the target you set
- Browser extension: pick a list, add the current tab, authenticated with a
  personal access token (`/settings/tokens`) instead of your password

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a project, then in the SQL Editor
run, in order:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_api_tokens.sql`

### 2. Configure the web app

```
cd web
cp .env.local.example .env.local
```

Fill in from your Supabase project's Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Generate a Web Push key pair (used by both `web/` and `worker/`):

```
npx web-push generate-vapid-keys
```

Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in
`VAPID_PRIVATE_KEY`.

Optionally, add `APIFY_API_TOKEN` (from your Apify account → Settings →
Integrations → API tokens) to let price checks fall back to Apify for sites
the free method can't read. Read **Apify cost** below before doing this on the
worker specifically.

```
npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

### 3. Configure and run the price-check worker

```
cd worker
cp .env.example .env
```

Fill in the same `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` and VAPID keys as
the web app. Then:

```
npm install
npm run check-once   # one-off run, good for testing or an external cron
npm start             # long-running process that re-checks on a timer
```

Deploy `worker/` anywhere that can run a long-lived Node process or a scheduled
job (Railway, Render, a cron-triggered GitHub Action, etc.) — it's independent of
the web app's hosting.

### 4. Install the browser extension

See `extension/README.md`. In short: load it unpacked in Chrome/Edge, then
configure it with your app's URL and a token generated from `/settings/tokens`.

## Apify cost

Setting `APIFY_API_TOKEN` turns on the paid fallback for sites the free method
can't read. Roughly, per check that actually falls back to Apify:

| Site type | Actor | Cost per check |
| --- | --- | --- |
| Amazon | jaybird/amazon-product-data-scraper | ~$0.008 |
| Etsy | saswave/etsy-product-scraper | ~$0.005 |
| Anything else blocked | khadinakbar/ecommerce-store-scraper | ~$0.008 |

This only fires when the free direct-fetch attempt already failed — an
unprotected site never touches Apify. But the **manual** "Check price now"
button in the app and the **scheduled worker** are both wired to this fallback,
so:

- Clicking "Check price now" on a blocked item costs a few cents each time —
  fine, since you're doing it on purpose.
- The worker re-checks **every item** on a timer (`CHECK_INTERVAL_MINUTES`).
  At the default 60 minutes, a handful of Amazon/Etsy items adds up fast (e.g.
  5 items × 24 checks/day × ~$0.007 ≈ $0.84/day, ~$25/month) purely from
  repeated re-checks that mostly find no change. **Set `CHECK_INTERVAL_MINUTES`
  to something like 720 (twice a day) or 1440 (daily) once Apify is on** —
  prices don't move hourly anyway.
- Leave `APIFY_API_TOKEN` unset if you'd rather have zero ongoing cost and
  only track sites the free method already handles.

## Known environment quirks

- This project lives inside a OneDrive-synced folder. OneDrive can intermittently
  lock files Next.js's build is trying to write (`EPERM: operation not permitted,
  unlink ...`). If a build fails with that error, delete `web/.next` and re-run
  `npm run build` — usually a one-off sync collision, not a real bug. If it keeps
  happening, consider excluding `web/node_modules` and `web/.next` from OneDrive
  sync (right-click the folder → "Always keep on this device" off, or add to
  OneDrive's exclusion list).
- `database.types.ts` is hand-written to match the SQL migrations. Once the
  project is linked to a real Supabase project, regenerate it for accuracy:
  ```
  npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
  ```
- Free-tier price extraction is best-effort and will find nothing on sites that
  render price client-side without structured data, or that block the request
  outright. The Apify fallback (see above) covers most of that gap for a cost;
  fully generic sites with unusual page structures may still fail even there.

## Roadmap

1. **Phase 1 (done):** auth, lists, manual add, sharing, claim-privacy, push infra
2. **Phase 2 (done):** scheduled price tracking + real push alerts, browser
   extension for "add to my list from any page", Apify fallback for bot-protected
   retailers (Amazon, Etsy, generic)
3. **Phase 3:** mobile app (Expo) with native push notifications
4. **Phase 4:** cross-site price search when adding an item ("is this cheaper
   elsewhere?"), scale-out if opened beyond family use
