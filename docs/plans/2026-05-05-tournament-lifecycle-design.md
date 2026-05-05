# Tournament Lifecycle Foundation — Design

**Date:** 2026-05-05
**Status:** Approved, ready for implementation plan
**Driver:** Manual tournament transitions are killing project momentum. Masters ended ~3 weeks ago but the homepage, strategy selector, and dashboard still treat it as live. PGA Championship starts May 15 (10 days). Without a foundation that makes transitions automatic, every event becomes a fire drill and the project dies.

## Problem

Today, every tournament transition requires editing TypeScript files and redeploying across 4 surfaces:

1. **Homepage hero** ([hero-section.tsx](v2/components/landing/hero-section.tsx)) hardcodes "Masters 2026 — Tournament Starts April 9".
2. **Strategy page selector** ([auction/page.tsx](v2/app/(protected)/auction/page.tsx)) shows ALL tournaments including ones that have ended (March Madness 2026, Kentucky Derby 2026 which never ran). Locked pills are dead — clicking does nothing.
3. **Dashboard active leagues** ([dashboard.ts](v2/actions/dashboard.ts)) shows every session a user joined regardless of completion status. Old March Madness leagues clutter the active list.
4. **Events page** ([events/page.tsx](v2/app/events/page.tsx)) splits by `isActive` boolean only — no concept of "completed" or "past."

Root cause: tournaments only have an `isActive: boolean` flag with no concept of phase. Every transition is manual code + deploy.

Secondary problem: adding a new tournament requires (a) writing a config file, (b) creating a Stripe Product in the dashboard, (c) creating a Payment Link, (d) adding an env var to Vercel, (e) redeploying. Five steps per event, plus odds-data preparation. Custom requests from users are too slow to act on.

## Goals

1. Tournament transitions become **fully date-driven** — no code edits needed when a tournament ends or a new one begins.
2. Adding a new tournament drops to **one config file + one script run + one deploy**.
3. The **strategy page URL** is `/strategy` (currently `/auction`) — clearer for paid product positioning.
4. **Locked tournaments are conversion opportunities** — clicking a locked pill routes to checkout for that event.
5. **PGA Championship (May 15) ships safely** — Phase 1 must be deployable by May 14.

## Non-Goals

- Self-serve tournament creation by end users.
- Database-backed tournament configs (custom tournaments stay code-based).
- Migrating existing 4 paid users to a new payment model — they keep what they paid for.
- Refactoring the strategy analytics engine itself.

---

## Architecture

### 1. Tournament Phase Model

`TournamentConfig` gains three fields:

```ts
export interface TournamentConfig {
  // ... existing fields ...
  startDate: string;       // existing — first round of play (ISO date)
  hostingOpensAt?: string; // existing — when hosts can create auctions
  endDate: string;         // NEW — last day of competition (ISO date, required)
  archiveAt?: string;      // NEW — when to fully hide; default endDate + 30 days
  phaseOverride?: TournamentPhase; // NEW — escape hatch (weather delays, etc.)
}

export type TournamentPhase =
  | 'upcoming'   // hosting not yet open
  | 'hostable'   // hosts can create auctions, no live data yet
  | 'live'       // tournament in progress, results syncing
  | 'completed'  // ended, visible in past leagues, frozen
  | 'archived';  // fully hidden from selectors and dashboard
```

`isActive: boolean` is **deprecated but kept** as a computed alias matching its current semantics. Today, configs are flagged `isActive: true` from `hostingOpensAt` through end-of-tournament (covering both the bookable window and the in-progress window), so the alias becomes:

```ts
get isActive(): boolean {
  const phase = getTournamentPhase(this);
  return phase === 'hostable' || phase === 'live';
}
```

Call sites that currently check `isActive` keep working without behavior changes. They migrate to phase-aware helpers (`listSelectorTournaments()`, `getTournamentPhase()`) over time.

### 2. Phase Derivation

New helper `getTournamentPhase(config, now = new Date()): TournamentPhase`:

```
if config.phaseOverride is set → return it
if now < hostingOpensAt        → upcoming
if now < startDate             → hostable
if now ≤ endDate               → live
if now < archiveAt (default endDate + 30d) → completed
otherwise                      → archived
```

All boundaries are inclusive on the lower end, exclusive on the upper end except `endDate` (inclusive — a tournament is live through the end of its final day).

### 3. Registry API

`v2/lib/tournaments/registry.ts` adds:

```ts
listTournamentsByPhase(): Record<TournamentPhase, TournamentEntry[]>
getFeaturedTournament(): TournamentEntry  // live > soonest hostable > soonest upcoming
listSelectorTournaments(): TournamentEntry[]  // live + hostable + upcoming, sorted by date
listPastTournaments(): TournamentEntry[]  // completed only, sorted by endDate desc
getTournamentPhase(id: string): TournamentPhase
```

`getActiveTournament()` (existing) is kept as alias for `getFeaturedTournament()` to minimize call-site churn.

### 4. Programmatic Stripe Setup

New file `v2/scripts/sync-stripe-products.ts` and `npm run stripe:sync`:

For each tournament config with `strategyPrice`:
1. Look up Stripe Products by `metadata.tournament_id === config.id`.
2. If missing, create Product with name = `Strategy Access — {config.name}` and metadata `{ tournament_id, sport }`.
3. If missing or price changed, create new Price (Stripe Prices are immutable; old Price gets archived).
4. Write the resulting `priceId` map into `v2/lib/tournaments/stripe-products.generated.ts`, which is committed to git.

The generated file shape:

```ts
export const STRIPE_PRICE_IDS: Record<string, string> = {
  pga_championship_2026: 'price_xxx',
  us_open_golf_2026: 'price_yyy',
  // ...
};
```

Payment route ([app/(protected)/payment/page.tsx](v2/app/(protected)/payment/page.tsx)) switches from redirecting to a Payment Link URL to creating a Stripe Checkout Session via the Stripe SDK using the tournament's `priceId`. The session's `client_reference_id` continues to encode `userId--tournamentId` (per existing convention in [feedback_stripe_client_reference_id.md](C:\Users\pwidd\.claude\projects\C--Users-pwidd-CascadeProjects-calcutta-auction-tool\memory\feedback_stripe_client_reference_id.md)).

The existing 4 Payment Links keep working — their tournaments will hit `archived` within 30 days. New tournaments use Checkout Sessions. The webhook handler ([api/webhooks/stripe](v2/app/api/webhooks/stripe)) accepts both event types (Payment Links emit `checkout.session.completed` too).

`stripePaymentLinkEnvKey` field is removed from new configs but kept in existing configs as a fallback for backward compatibility.

### 5. Homepage Hero Refactor

`HeroSection` becomes a server component, calls `getFeaturedTournament()` and `listSelectorTournaments()`:

```tsx
<FeaturedHero tournament={featured} />
<UpcomingStrip tournaments={upcoming.slice(0, 3)} />
```

`FeaturedHero` copy is templated by phase:
- `live`: `Run your {name} Calcutta — live now.`
- `hostable`: `Run your {name} Calcutta. Tournament starts {relativeDate}.`
- `upcoming`: `Hosting opens {relativeDate} for the {name} Calcutta.`

The colored badge styling (currently amber for Masters) becomes phase-driven:
- `live` → emerald with pulsing dot
- `hostable` → amber with countdown
- `upcoming` → slate

Empty state — if no tournaments are in `live`/`hostable`/`upcoming` for the next 30 days — falls back to evergreen copy: `Run your Calcutta auction — any sport, any tournament.`

`UpcomingStrip` is a horizontal row of small cards showing the next 2-3 events with `name`, `startDate`, and a "Learn more" link to `/events`.

### 6. Strategy Page (renamed from `/auction`)

File moves:
- `v2/app/(protected)/auction/` → `v2/app/(protected)/strategy/`

Redirects added in `next.config.ts`:
- `/auction` → `/strategy` (308 permanent)
- `/auction/*` → `/strategy/*` (preserves query params like `?tournament=` and `?league=`)

Updates to the page:
- Selector renders only `listSelectorTournaments()` — completed/archived events drop off automatically.
- **Locked pills become CTAs**: instead of `<span class="cursor-default">`, render `<Link href="/payment?tournament={id}">` for any tournament the user hasn't paid for. Hover state shows "Unlock $XX.XX" with the price.
- Currently-loading tournament parameter validation: if user lands on `/strategy?tournament={id}` for a `completed`/`archived` event, redirect to `/strategy` (which loads featured tournament).

Internal references to "auction" in copy that means "strategy tool" stay as-is — "auction" is still the right word for the actual auction event the tool helps with. Only the URL changes.

### 7. Dashboard Split (Active vs Past)

`getDashboardData()` joins each session against its tournament's current phase. The returned `DashboardSession` adds:

```ts
tournamentPhase: TournamentPhase;
```

UI changes in `UserDashboard`:
- **Active Leagues** section — sessions where `tournamentPhase` is `live` or `hostable`.
- **Past Leagues** section — `completed`. Collapsed by default behind a `Show past leagues ({count})` button. Expanded view shows final P&L per league.
- Sessions where `tournamentPhase === 'archived'` are filtered out entirely (still in DB, just hidden).

### 8. New Tournament Scaffolding

`npm run new-tournament <id>` (script at `v2/scripts/new-tournament.ts`):

1. Prompts for `name`, `sport`, `startDate`, `endDate`.
2. Generates `v2/lib/tournaments/configs/{id}.ts` from a sport-aware template (golf vs bracket vs horse-racing scaffolds).
3. Adds the import + registry entry in `v2/lib/tournaments/registry.ts`.
4. Prints next-step instructions: fill in teams/odds, run `npm run stripe:sync`, commit, deploy.

A new doc `CONTRIBUTING_TOURNAMENTS.md` at the repo root walks through the full flow with examples.

### 9. Initial Tournament Calendar

Existing configs get correct `endDate`:
- `march_madness_2026.endDate = '2026-04-06'` — already past, falls to `completed`.
- `masters_2026.endDate = '2026-04-12'` — already past, falls to `completed`.
- `kentucky_derby_2026.endDate = '2026-05-02'` — already past, falls to `completed` (and never ran, but that's fine — it lived in DB-zero state).
- `world_cup_2026.endDate = '2026-07-19'` — FIFA World Cup final.
- `nfl_season_2026.endDate = '2027-02-07'` — Super Bowl LXI (approximate; revise when scheduled).

New configs added in this PR:

| ID | Name | Start | End | Strategy Price |
|---|---|---|---|---|
| `pga_championship_2026` | PGA Championship 2026 | 2026-05-14 | 2026-05-17 | $19.99 |
| `us_open_golf_2026` | U.S. Open Golf 2026 | 2026-06-11 | 2026-06-14 | $19.99 |
| `open_championship_2026` | The Open Championship 2026 | 2026-07-16 | 2026-07-19 | $19.99 |
| `tour_championship_2026` | FedExCup / Tour Championship 2026 | 2026-08-20 | 2026-08-23 | $14.99 |
| `march_madness_2027` | March Madness 2027 | 2027-03-16 | 2027-04-05 | $19.99 |
| `masters_2027` | The Masters 2027 | 2027-04-08 | 2027-04-11 | $19.99 |

PGA Championship 2026 must be **fully data-ready before May 14**: full field with DataGolf odds, prop bets configured, Stripe Product created.

The other golf tournaments can ship with `hostingOpensAt` set ~3 weeks before each `startDate` — fields/odds get populated closer to each event.

### 10. Build Sequence

Three independently shippable phases:

**Phase 1 — PGA survival (deploy by May 14):**
- Phase model fields + `getTournamentPhase()` helper
- Registry refactor: new helpers, `isActive` alias
- Strategy URL rename + redirect from `/auction`
- Selector and dashboard filter by phase (completed events drop off)
- PGA Championship 2026 config + Stripe Product (manual creation OK for first one)
- Existing tournaments get `endDate` populated

**Phase 2 — conversion improvements (within 1 week of Phase 1):**
- Featured hero + secondary upcoming strip
- Locked pills become click-to-buy CTAs
- Dashboard split: active vs past leagues with collapse
- Strategy page redirect for completed-tournament URLs

**Phase 3 — full automation (when time allows, before next major event):**
- `sync-stripe-products` script + Checkout Session migration
- `new-tournament` scaffolding script
- `CONTRIBUTING_TOURNAMENTS.md` documentation
- Pre-populate full 2026/2027 calendar (US Open, Open Championship, Tour Championship, March Madness 2027, Masters 2027)

Each phase is independently deployable. Phase 1 alone solves the immediate crisis. Phase 2 and 3 land at safe times.

---

## Data Flow Examples

**A user lands on the homepage on May 10, 2026:**
1. `getFeaturedTournament()` returns PGA (phase `hostable`, soonest start date).
2. `FeaturedHero` renders amber-badged "PGA Championship 2026" with "Tournament starts May 14."
3. `UpcomingStrip` shows next 2-3 events: U.S. Open Golf, Open Championship.
4. Masters is in `completed` phase — invisible to homepage.

**A user with bookmarked `/auction?tournament=masters_2026` visits on May 10:**
1. Next.js redirect (308) sends them to `/strategy?tournament=masters_2026`.
2. Strategy page sees Masters is `completed` (or `archived`).
3. Page redirects to `/strategy` (no params), loads PGA strategy tool.
4. Selector shows: PGA (live or hostable), U.S. Open (upcoming, locked), etc. No Masters.

**A user clicks a locked tournament pill:**
1. Link routes to `/payment?tournament={id}`.
2. Payment route looks up the tournament, fetches its `priceId` from `STRIPE_PRICE_IDS`.
3. Creates a Stripe Checkout Session, redirects user to Stripe.
4. On success, webhook records purchase in `paid_tournaments`. User returns to `/strategy?tournament={id}` with full access.

**Adding a custom tournament for a customer:**
1. `npm run new-tournament invitational_2026`
2. Edit generated config: fill in `teams`, set `startDate`/`endDate`, set `strategyPrice` (or zero for free).
3. `npm run stripe:sync` — creates Stripe Product + Price, updates `stripe-products.generated.ts`.
4. Commit + push to main → Vercel auto-deploys.
5. Customer gets a link to `/strategy?tournament=invitational_2026`.

---

## Testing Strategy

- Unit tests for `getTournamentPhase()` covering all 5 phases + override + edge cases (exact `endDate` boundary, missing `archiveAt`, future-dated `phaseOverride`).
- Unit tests for registry helpers (`listSelectorTournaments`, `getFeaturedTournament`) with mocked clock.
- Integration test for payment route: locked-pill click → Checkout Session creation → mock webhook → access granted.
- Manual smoke test on Vercel preview deploy: load homepage, /strategy, /dashboard with 2026-05-10 system date and verify all 4 surfaces show correct content.
- Verify legacy `/auction` URL redirects to `/strategy` with query params preserved.

## Migration Risks & Mitigations

- **Existing 4 paid users (Masters)**: their tournament hits `completed` immediately. Their `paid_tournaments` row is preserved. They can still view past results via dashboard "Past Leagues" section.
- **Existing Masters auctions in progress**: as of May 5, the 4 active Masters auctions should already be in final settlement. After Masters hits `completed`, hosts/participants still see them under Past Leagues.
- **Stripe Payment Link → Checkout Session migration**: webhook already handles both event types. No change needed for payments in flight.
- **URL rename**: 308 redirect preserves SEO. Internal links updated in same PR. External links (blog posts, social) keep working via redirect.

## Open Questions

None — all answered during brainstorming. The unknowns left are implementation-detail (e.g., exact `archiveAt` default — going with `endDate + 30 days`).
