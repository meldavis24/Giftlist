# GiftList

Track gift/shopping wish lists for Christmas, birthdays, graduations, anniversaries, etc.
Share lists with family, let others claim items without spoiling the surprise for the
list owner, and get notified when something on your list goes on sale.

This repo currently contains **Phase 1** of the roadmap below.

## Repo structure

- `web/` — Next.js 16 (App Router, TypeScript, Tailwind) web app
- `supabase/migrations/0001_init.sql` — full DB schema + row-level security policies

Planned, not yet built:
- `worker/` — scheduled price-check service (Phase 2)
- `extension/` — browser "add to my list" extension (Phase 2)
- `mobile/` — Expo app for native push (Phase 3)

## Phase 1 (this scaffold)

- Email/password + magic-link auth (Supabase Auth)
- Create lists per occasion
- Add items by pasting a product URL
- Invite others to a list by email (viewer or editor role)
- **Claim-privacy rule**: if someone else claims an item on *your* list, you (the
  owner) never see that it's claimed — enforced at the database level via RLS, not
  just hidden in the UI, so there's no code path that can leak it by accident
- "Buy" button opens the product page in a new tab; checkout/payment always happens
  on the retailer's own site using your browser's saved payment info — this app
  never stores card data
- Web Push notification scaffold (subscribe button, service worker, test-send API) —
  ready for Phase 2 to plug real price-drop alerts into

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a project, then in the SQL Editor
run `supabase/migrations/0001_init.sql`.

### 2. Configure environment variables

```
cd web
cp .env.local.example .env.local
```

Fill in from your Supabase project's Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (needed by the Phase 2 worker later, not by the web app yet)

Generate a Web Push key pair:

```
npx web-push generate-vapid-keys
```

Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in
`VAPID_PRIVATE_KEY`.

### 3. Run it

```
cd web
npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

## Known environment quirks

- This project lives inside a OneDrive-synced folder. OneDrive can intermittently
  lock files Next.js's build is trying to write (`EPERM: operation not permitted,
  unlink ...`). If a build fails with that error, delete `web/.next` and re-run
  `npm run build` — usually a one-off sync collision, not a real bug. If it keeps
  happening, consider excluding `web/node_modules` and `web/.next` from OneDrive
  sync (right-click the folder → "Always keep on this device" off, or add to
  OneDrive's exclusion list).
- `database.types.ts` is hand-written to match the SQL migration. Once the project
  is linked to a real Supabase project, regenerate it for accuracy:
  ```
  npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
  ```

## Roadmap

1. **Phase 1 (done):** auth, lists, manual add, sharing, claim-privacy, manual price
   refresh, push infra
2. **Phase 2:** scheduled price tracking (Amazon + 1–2 more retailers), real
   price-drop push/email alerts, browser extension for "add to my list from any page"
3. **Phase 3:** mobile app (Expo) with native push notifications
4. **Phase 4:** broader retailer support, scale-out if opened beyond family use
