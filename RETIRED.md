# Calcutta Edge — RETIRED 2026-09-11

The product is shut down. The **code is kept** so it can be restarted; the
**data is not** — read the restart checklist before assuming anything works.

## Why it was retired

No traction. The NFL season launch was the last test, and it produced nothing:

- Launch email to 154 users on 2026-09-02 → **0 signups, 0 purchases, 0 leagues drafted**
- Last organic signup: 2026-08-31. Last customer purchase: 2026-06-02.
- Lifetime: 155 users, 8 purchases / $189.92, 39 leagues created, 16 ever sold a team.

Discovery was the constraint, not the product or the price. The app worked —
408 tests passing at shutdown — but nobody arrived to use it.

## What was shut down

| Service | State | Notes |
|---|---|---|
| Supabase project `xtkdwyrxllqmgoedfotf` | **DELETED** | Returns HTTP 410 "Project removed". All data gone — users, leagues, bids, results, payment records. Not recoverable unless a backup was downloaded before deletion. |
| Resend | Cancelled | Welcome email + `scripts/send-*.ts` blasts |
| Google Workspace (Business Starter) | Cancelled | The `support@calcuttaedge.com` mailbox no longer exists |
| Vercel project `calcutta-edge` | See below | |
| Stripe account + payment links | Still live at shutdown | Deactivate the links — see below |
| Domain `calcuttaedge.com` | Kept (at time of writing) | Cheap to hold, hard to reacquire |

**At shutdown the site was half-alive:** public pages were still served from
Vercel's cache and still said "Host Your NFL Season Calcutta Free", but signup,
login and every data read failed because the database was gone. If the Vercel
project still exists, take it down rather than leave that trap up.

## State of the code

`main` = `939681b`. Everything from the final sessions is merged:

- NFL Season 2026-27 config (all 32 teams, per-win payouts, Kalshi odds as of 2026-09-02)
- "Season Only" payout preset
- League-member score sync with a 60s cooldown (`lib/auth/sync-gate.ts`)
- Four sync routes behind one auth gate; the `Bearer undefined` cron hole closed

Every tournament config is now in the past. There is nothing to host until a
new one is added.

**Two changes never executed against real data**, because the season hadn't
started when the database was deleted: the batched upsert in `/api/nfl/sync`,
and the member-sync gate itself. Both are unit-tested and reviewed. Exercise them
against a live league before trusting them.

## Restarting

Roughly in order. Nothing here is automatic.

1. **Supabase** — create a project, then apply every file in
   `v2/supabase/migrations/` in numeric order (`00001` through `00006`).
   In Auth settings, set the site URL and add the redirect
   `https://www.calcuttaedge.com/auth/callback`.
2. **Environment variables** (Vercel, and `v2/.env.local` for local dev — the
   old local file holds credentials for the deleted project):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL`, `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_NFL`
   (plus one per tournament that sets `stripePaymentLinkEnvKey`),
   `CRON_SECRET`, `DATAGOLF_API_KEY` (golf only),
   `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`.
3. **Email** — `support@calcuttaedge.com` appears in 19 files: the send-from
   address, email footers, `mailto:` links and the custom-Calcutta offer.
   Either restore that mailbox or replace the address everywhere. Resend also
   needs its sending domain re-verified in DNS.
4. **Stripe** — reactivate or recreate the payment links, and point the webhook
   at `https://www.calcuttaedge.com/api/webhooks/stripe`. It must include `www`:
   Stripe does not follow Vercel's 307 redirect.
5. **A tournament to host** — add a config. `CLAUDE.md` lists everything a new
   one needs (`PRESET_MAP`, `getStandardProps()`, a bundling scheme,
   `liveSyncMatchers`); the preset test only catches some of it.
6. **Vercel** — if the project was deleted, re-import `pwidds22/calcutta-edge`
   from GitHub with the **root directory set to `v2`**. `v2/vercel.json`
   schedules four cron jobs; they will fail loudly until the database exists.

`CLAUDE.md` holds the anti-patterns learned the hard way. Read it before
changing anything.
