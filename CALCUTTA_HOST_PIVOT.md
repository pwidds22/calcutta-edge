# Calcutta Host pivot + NFL season Calcutta — Design

**Date:** 2026-08-16
**Status:** approved design, pending implementation plan
**Context:** `MEMORY.md`, `CLAUDE.md`, background research run `wf_40064ceb-9b7`

---

## 1. Why

Calcutta Edge sells a per-tournament "edge calculator" ($14.99–$29.99). Measured outcome through 2026-08-16:

| Signal | Value |
|---|---|
| Lifetime purchases | 8 ($189.92) |
| Purchases since 2026-06-02 | 0 |
| Signups in the last 60 days | 9 |
| Leagues created (lifetime) | 39 |
| Leagues that ever sold a team | 16 (4 of those are 1-lot tests) |
| Distinct hosts | 28 · only 12 ever completed a draft · 8 hosted more than once |
| Median pot, hosts other than the owner | **$1,912** (mean $5,538, max $30,645) |
| Median spend per active bidder | $228 |

The free-host funnel works; the paid handoff does not. The pivot moves the primary sale from the calculator to **hosting**, keeps the calculator as a second SKU, and adds a season-long NFL Calcutta as the launch event. Eventual rebrand to calcuttahost.com — **not in this scope**.

**Honest caveat, recorded deliberately:** this changes *what* is sold, not *discovery*. Discovery is the actual constraint (2 signups in August, 0 outside buyers ever). The paywall is cheap insurance that is in place when demand arrives; it is not a growth lever.

---

## 2. Decisions

| Decision | Answer |
|---|---|
| Unit of sale | Flat fee per league, unlimited bidders |
| Price | **$19** |
| Gate location | The lobby-to-active transition ("Start Auction") |
| Price visibility | Shown from league creation onward — never a surprise at click time |
| Strategy tool | **Stays a separate paid SKU** ($14.99, unchanged) |
| Existing 8 buyers | Grandfathered in code; no refunds, no migration, no email |
| Existing 39 leagues | Permanently free via a hardcoded `created_at` cutover |
| Custom Calcuttas | "Any sport or event — from **$74.99**", mailto, not a pricing column |
| Launch event | NFL season 2026-27 |
| Priority | **NFL draft path working > paywall.** The paywall may land after Aug 27 |
| Rebrand | Deferred |

---

## 3. Monetization design

### 3.1 What is free vs paid

| Free forever | Requires the $19 League Pass |
|---|---|
| Create the league, pick the tournament | **Starting the auction** |
| Configure pot, payouts, props, bundles, timer | Live bidding room, timers, auto-mode |
| Generate and share the join code | Live standings + settlement matrix |
| Participants join, lobby presence | Automatic score sync and result grading |
| Reorder queue, kick, edit settings | |

The strategy/EV tool is **not** included — it remains its own $14.99 per-tournament purchase via the existing `paid_tournaments` path.

### 3.2 Price visibility

Three surfaces, so the gate is never news:

1. Create form: "Free to set up — $19 when you start the draft."
2. Persistent unlock bar in the commissioner lobby from the moment the session exists. Wire to live state (`localPayoutRules`/`localPotSize` pattern), not static `session.*` props.
3. Pricing page.

### 3.3 Schema — new table, not a reshape

```sql
create table public.paid_leagues (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references auction_sessions(id) on delete restrict,
  payer_user_id uuid not null references profiles(id),
  tournament_id text not null,
  amount_cents int not null default 0,
  stripe_checkout_session_id text unique,
  stripe_event_id text unique,
  paid_at timestamptz not null default now(),
  refunded_at timestamptz
);
```

Rationale, point by point:

- **`paid_tournaments` cannot be reused.** Its `UNIQUE(user_id, tournament_id)` means a host running two pools on one event gets a single row, and the existing `upsert(onConflict:'user_id,tournament_id')` would silently overwrite the first purchase's Stripe id and amount. Leave that table and its 8 rows untouched — they are the only record of the $189.92 and the only refund evidence.
- **Not a column on `auction_sessions`, and not in `settings` JSONB.** Commissioner UPDATE RLS is `commissioner_id = auth.uid()` with no column restriction, so a host could self-grant from the browser with the anon key.
- **`session_id UNIQUE`** is the idempotency key; `stripe_event_id UNIQUE` guards Stripe retries.
- **`ON DELETE RESTRICT`**, not CASCADE — commissioners can delete their own sessions, and CASCADE would destroy the payment record.
- **`refunded_at`** — a refunded league must re-lock. Handle `charge.refunded` in the webhook.
- **Reads go through a `SECURITY DEFINER` function returning a boolean**, not `select using (true)`, which would expose `payer_user_id` and `amount_cents` to every authenticated user.

### 3.4 Entitlement

`hasLeaguePass(sessionId)` reads `paid_leagues` where `refunded_at is null`. Independent of `hasTournamentAccess()`, which continues to govern the strategy tool unchanged. No entitlement inversion; `syncAuctionData` / `reverseSyncAuctionData` are **not** touched.

Gate, in `startAuction()`: refuse when the paywall flag is on AND `session.status === 'lobby'` AND `session.created_at >= CUTOVER` AND there is no league pass.

- The `status === 'lobby'` guard is mandatory: `startAuction()` doubles as the paused-to-active **Resume** path, and gating that would strand a live auction mid-draft.
- The paywall flag is a **DB row, not an env var** — Vercel env changes require a redeploy, and `bidding.ts` has zero unit tests.

### 3.5 Checkout

Stripe **Checkout Session**, not a Payment Link: a Payment Link has one fixed price, a static `after_completion.redirect.url` that cannot return the host to `/host/{sessionId}`, and no per-purchase metadata.

`POST /api/checkout/league { sessionId }` verifies the caller is `commissioner_id`, verifies no existing `paid_leagues` row, lazily initialises Stripe via `getStripe()`, and creates a session with `client_reference_id` of `{userId}--{sessionId}` (no colons), `metadata.kind = 'league'`, and `success_url` back to `/host/{sessionId}?purchased=1`.

Webhook branches on `metadata.kind`. Resolve the payer from metadata only. Keep the legacy `--`-split strategy path intact. Webhook host must include `www`.

### 3.6 Correctness fixes required first

These are live bugs today and must land before league checkout exists:

- `app/api/webhooks/stripe/route.ts` — delete attribution fallback #3 ("most recent `has_paid=false` profile created in the last hour"). It can grant a stranger another person's purchase.
- Same file — add top-level dedupe on `event.id`. The current upsert masks Stripe retries; a per-league INSERT will not.
- `components/auction/team-table.tsx:304` — the non-bundle branch hardcodes `team.seed > PREVIEW_SEED_CUTOFF` and ignores `config.previewTeamCount`. Since `bundlePreset` defaults to `'none'`, this is the default render path, so the preview paywall leak is only fixed on the bundled branch.

### 3.7 Create form — remove archived tournaments

`app/(protected)/host/create/page.tsx` passes `listTournaments()` unfiltered, and `components/live/create-session-form.tsx:46-49` defaults to the first `isActive && isHostable` entry. `isHostable()` only asks "has hosting opened?" with no upper bound, so every finished event stays selectable forever. On 2026-08-09 a new signup created a league for PGA Championship 2026 — a major that ended May 17.

Fix: filter to `getTournamentPhase(t)` of `hostable` or `live`, drop `isActive` from the default-selection chain, and show an explicit "next event opens {date}" empty state.

---

## 4. NFL season Calcutta

### 4.1 Round model

The current config is a strict ladder in which `divisionWinner` is not `parallel`, so `getTeamStatus` marks **every wild-card team eliminated** and they can never be credited for the conference or Super Bowl round.

Replacement — parallel rounds **first** (`getCompletedRounds` breaks the loop on the first unresolved ladder round, so anything after it is never evaluated):

| Order | Key | Type | Units | Notes |
|---|---|---|---|---|
| 1 | `regularSeasonWins` | parallel, **flatRate** | 272 | one payout per win |
| 2 | `divisionWinner` | parallel | 8 | normalized within division |
| 3 | `playoffBerth` | ladder | 14 | |
| 4 | `reachDivisional` | ladder | 8 | won a wild-card game **or** held the #1 seed's bye |
| 5 | `reachConfChamp` | ladder | 4 | |
| 6 | `reachSuperBowl` | ladder | 2 | |
| 7 | `superBowl` | ladder | 1 | |

Ladder rungs are "reach round N", so each is a true subset of the previous and the bye problem dissolves.

### 4.2 Per-win payouts — engine change

The engine grades binary won/lost and has no per-unit mechanism. Additive change:

- **`tournament_results.result_count numeric null`** — null means 1, so every existing golf and World Cup row behaves identically. Numeric so a tie can count 0.5, which keeps the season total at exactly 272 and conserves the pot.
- **`calculateTeamEarnings(roundsWon, pot, rules, counts?)`** — optional 4th argument, multiplying by the count for that key, defaulting to 1. Five production call sites: `actions/dashboard.ts:287` and `:401`, `actual-payouts.ts:315`, `projected-standings.ts:184`, `soccer-standings.ts:147`. Golf and soccer pass nothing.
- **`RoundConfig.flatRate?: true`** — exempts the round from `adjustPayoutRulesForTies`, which divides a tier budget by actual winners. A flat per-win rate must never be redistributed.
- **`RoundConfig.payoutUnits?: number`** — 272 for this round. Preset sums and tie adjustment use `payoutUnits ?? teamsAdvancing`, so the existing preset test validates it unchanged.

**Display wart:** the per-win round stores *expected wins* (e.g. 11.2) in the slot other rounds use for a probability. The value calculation is still correct, but any UI rendering that slot as a percentage shows "1120%". Needs a "proj. wins" formatting branch in the team table.

### 4.3 Props

Replace `mvp` and `mostWins` with **`bestRecord`** (most wins in the NFL) and **`worstRecord`** (fewest wins). Both grade from the same ESPN standings call the per-win grader needs. `mvp` is dropped because a player award has no team-to-owner mapping.

**Ties:** record ties are frequent in the NFL, unlike point differential. `PropResult.winners[]` already splits payouts evenly (`props.ts:23`), so the auto-grader must emit **all** tied teams rather than `find()` the first. Explicit test required.

`getStandardProps()` must gain an NFL branch. Today it returns an empty array for NFL, which means the Props tab never renders while the create form still writes prop percentages into `payoutRules` — that slice of the pot becomes permanently unclaimable. The preset regression test cannot catch this; it sums `preset.rules` directly and never calls `getStandardProps`.

### 4.4 Payout presets

Budget = `pct × payoutUnits`; props are flat. All sum to 100% within 0.5%.

**Balanced (default)** — 50% regular season / 50% playoffs. Dollars for a $4,000 pot.

| Block | Round | pct | Units | Budget | Per team @ $4k |
|---|---|---|---|---|---|
| Regular season | `regularSeasonWins` | 0.1029 | 272 | 27.99 | **$4.12 / win** |
| | `divisionWinner` | 2.00 | 8 | 16.00 | $80 |
| | `bestRecord` | 3.00 | flat | 3.00 | $120 |
| | `worstRecord` | 3.00 | flat | 3.00 | $120 |
| | | | | **49.99** | |
| Playoffs | `playoffBerth` | 0.75 | 14 | 10.50 | $30 |
| | `reachDivisional` | 1.50 | 8 | 12.00 | $60 |
| | `reachConfChamp` | 2.50 | 4 | 10.00 | $100 |
| | `reachSuperBowl` | 3.75 | 2 | 7.50 | $150 |
| | `superBowl` | 10.00 | 1 | 10.00 | $400 |
| | | | | **50.00** | |
| | | | | **99.99** | |

Every playoff rung pays less per team than the 10% champion award, and steps up as a team advances: 0.75 → 1.50 → 2.50 → 3.75 → 10.00.

Worked examples at a $4,000 pot (average team cost $125):

| Team | Earns |
|---|---|
| 14-3 division winner, wins the Super Bowl | $878 |
| 12-5 division winner, out in the divisional round | $219 |
| 11-6 wild card, loses round one | $75 |
| 9-8, misses the playoffs | $37 |
| 3-14, worst record in the league | $132 |

A 3-14 team bought for $20 outearns a 9-8 team bought for $125. That is the mechanism that keeps bad teams biddable.

**Every Week Counts** — `regularSeasonWins` 0.1471 (40.01), `divisionWinner` 2.00 × 8, best/worst 3 + 3, `playoffBerth` 0.75 × 14, `reachDivisional` 1.25 × 8, `reachConfChamp` 1.75 × 4, `reachSuperBowl` 2.25 × 2, `superBowl` 6.00. Total 100.01. Regular season 62%.

**Super Bowl Heavy** — `regularSeasonWins` 0.0625 (17.00), `divisionWinner` 2.00 × 8, best/worst 3 + 3, `playoffBerth` 0.75 × 14, `reachDivisional` 1.50 × 8, `reachConfChamp` 2.50 × 4, `reachSuperBowl` 4.75 × 2, `superBowl` 19.00. Total 100.00. Regular season 39%.

### 4.5 Odds

Kalshi, public and unauthenticated. **Do not add Kalshi keys to Vercel.**

| Round | Source | Derivation |
|---|---|---|
| `regularSeasonWins` | `KXNFLWINS-27{ABBR}` (17 "at least N" strikes) | expected wins = sum of P(at least N) |
| `divisionWinner` | `KXNFL{AFC,NFC}{EAST,NORTH,SOUTH,WEST}-27` | normalize within division to 1 |
| `playoffBerth` through `superBowl` | `KXNFLSTAGEOFELIM-27{ABBR}` | derived from one 6-leg series, monotone by construction |

Traps:

- **Join on ticker suffix, never name.** `yes_sub_title` is city-only and ambiguous ("Los Angeles C", "New York G"). Abbreviation dialects differ: Kalshi `JAC`/`WAS`/`LAR` vs ESPN `JAX`/`WSH`/`LAR`. Build one explicit map and assert 32/32 on both sides.
- **Use bid/ask mid, not `last_price_dollars`.** Untraded-but-active strikes report `"0.0000"` while quoting a real market. The existing `status !== 'active'` guard does not catch this. Assert the wins ladder is monotonically non-increasing before trusting it.
- Prices live only in `*_dollars` STRING fields.
- `fetch-nfl-odds.mjs` writes **pre-normalized `probabilities`** (scaling up as well as down), which is how we avoid the "devig never scales up" pot leak without touching shared devig code.
- Resolve the `-27` event suffix dynamically. Never reassign team `id` between runs — bundles reference creation-time ids.

### 4.6 Settlement

ESPN `site.web.api.espn.com/apis/v2/sports/football/nfl/standings?season=2026&level=3`. The `site.api...` host returns a stub, exactly like the dead soccer standings endpoint. Add a test asserting 32 entries so a silent shape regression fails loudly.

Playoff weeks are `seasontype=3&week=` **1 / 2 / 3 / 5**. Week 4 is the Pro Bowl, whose competitors are named "AFC" and "NFC" — settling it would corrupt results.

`/api/nfl/sync` follows the soccer route shape: dual-mode cron plus commissioner POST (**with** the auth gate soccer is missing), registry-driven via `liveSyncMatchers` and `matchesTournamentEvent`, fetch-once then fan out, idempotent upsert, never write `pending`. Needs a `middleware.ts` allowlist entry and a `vercel.json` cron.

Completeness gating: for each parallel round the sync must write an explicit `won` or `lost` for **all 32 teams**, or the round never completes and its budget is never distributed. Gate the regular-season rounds on all 272 games final, not on a date.

`adjustPayoutRulesForTies` must receive `getCompletedRounds()` as `onlyRounds`. A season pool sits in the partial state constantly — division titles clinch one at a time across Weeks 15-18.

### 4.7 Other config work

`liveSyncMatchers`, `strategyPrice`, **`stripePaymentLinkEnvKey`** (NFL currently falls back to the March Madness Payment Link and shows "All 64 teams" copy on a 32-team event — a must-fix now that the strategy tool stays paid), `previewTeamCount: 4`, `FEATURES_BY_SPORT.nfl`, NFL bundling branch (bundle by value, not by group — the bracket fallback currently bundles the AFC West as "longshots"), `supportsManualSync` and `syncEndpoint` NFL branches.

**Verify `endDate` against the published NFL schedule.** Do not trust memory for event dates.

**Do not delete `nfl-playoffs-2026.ts`.** A January playoff Calcutta is the second sellable event and fixes the biggest hole in this plan — otherwise nothing is chargeable between kickoff and March Madness 2027, so the $19 experiment runs exactly once. It needs a `PRESET_MAP` entry and its rules currently sum to 78%. December work; it reuses the reach-ladder shape.

---

## 5. Build order

1. **NFL draft path** (priority): rounds rewrite, `result_count` plus `flatRate` plus `payoutUnits`, three presets, `NFL_PROPS`, `fetch-nfl-odds.mjs`, NFL Payment Link plus `FEATURES_BY_SPORT`, create-form phase filter, tests.
2. **Paywall**: webhook fixes, `paid_leagues`, checkout route, gate at `startAuction`, the three price-visibility surfaces. May land after Aug 27.
3. **Copy**: landing page, JSON-LD (a live $14.99 Offer after the price moves is a rich-result lie), welcome email, `/events`. Plus a note to the 28 existing hosts that their leagues stay free — **sent before the copy changes**.
4. **In-season**: `/api/nfl/sync`, then live standings. Less urgent than it was: per-win payouts mean standings have something to show from Week 1.

Not in scope: rebrand, participant caps, admin UI for tournaments, retiring `profiles.has_paid`, subscriptions.

---

## 6. Required tests

- Wild card (berth won, `divisionWinner` lost) still reaches `superBowl`.
- All three presets sum to 100% within 0.5% using `payoutUnits ?? teamsAdvancing`.
- `calculateTeamEarnings` with no counts argument is byte-identical for golf and World Cup.
- `result_count` of 0.5 for a tie; 272 total units conserve the pot.
- Best/worst record auto-grade emits **all** tied teams.
- Kalshi abbreviation map covers 32/32 on both sides.
- ESPN standings returns 32 entries.
- `/e2e-test` a full live sale before and after the gate lands — `bidding.ts` is DB-coupled with no unit tests, and `markSingleTeamWinner` is still unverified in production.

---

## 7. Open questions

1. Super Bowl LXI's date, to set `endDate` and the sync grace window.
2. Mid-season `playoffSeed` — verified populated on final standings and 0 in preseason, never verified mid-season. If provisional in Weeks 1-10, `playoffBerth` grading needs a different signal.
3. Kalshi rate limits for a 32-event fan-out.
4. Whether Kalshi's `KXNFLWINS` rules treat a tie as a non-win, so market and settlement agree.
