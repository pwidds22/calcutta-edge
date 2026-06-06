# Calcutta Edge

## IMPORTANT: This is a customer-facing app with 100+ users. Broken deploys = broken auctions. Always verify before pushing.

## Quick Start
```bash
cd v2
npm run dev       # Next.js dev server (port 3000)
npm run build     # Production build (MUST pass before deploy)
npm test          # Vitest unit tests (175+ tests, all must pass)
npm run lint      # ESLint
```

## Stack
Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui | Vercel (auto-deploys on push to `main`) | Supabase PostgreSQL + Auth + Realtime | Stripe Payment Links + webhooks

## Workflow
1. **Plan first** — use `/plan` for any non-trivial task (3+ steps)
2. **Verify before done** — use `/verify` (build + tests + lint)
3. **Review before deploy** — use `/pre-deploy-review` before any push
4. **E2E test big features** — use `/e2e-test` before releasing major changes
5. **Update context** — use `/end-session` to save progress to MEMORY.md
6. **Capture lessons** — use `/add-antipattern` after any correction from user
7. **Use Context7 MCP** — look up Supabase, Next.js, Stripe docs before guessing

## Anti-Patterns (DO NOT DO THESE)

### Supabase
- **DON'T** use service role key on the client — bypasses RLS
- **DON'T** create clients without `@supabase/ssr` cookie handling
- **DON'T** put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*` variables
- **DON'T** write self-referencing RLS policies — use `SECURITY DEFINER` functions instead

### Supabase Realtime
- **DON'T** use `realtime:` prefix on broadcast topics — silently drops messages. Use raw channel name: `auction:{sessionId}`
- **DON'T** render Presence without deduplication by `userId`

### Stripe
- **DON'T** hardcode Payment Link URLs — use env vars
- **DON'T** use colons in `client_reference_id` — only `[a-zA-Z0-9_-]` allowed. Use `--` separator
- **DON'T** link directly to Stripe URLs — route through `/payment?tournament=X` for proper attribution
- **DON'T** check `profiles.has_paid` — use `hasTournamentAccess()` from `v2/lib/auth/tournament-access.ts`
- **DON'T** set webhook URL without `www` — Stripe doesn't follow Vercel's 307 redirect
- **DON'T** create a Payment Link via MCP `create_payment_link` and forget `after_completion` — defaults to generic "Thank you" page with no redirect. PATCH the link with `after_completion.type='redirect'` so buyers land back on `/strategy?tournament=X&purchased=1`.

### Vercel / Build
- **DON'T** put Windows-only packages in `dependencies` — use `optionalDependencies`
- **DON'T** initialize Stripe SDK at module level — lazy init with `getStripe()`
- **DON'T** use module-level side effects in `'use client'` components — use `useEffect`
- **DON'T** trust `NEXT_PUBLIC_*` env vars without `.trim()` — trailing whitespace gets baked in
- **DON'T** forget middleware allowlist for new API routes — they redirect to `/login` otherwise
- **DON'T** deploy from inside `v2/` — deploy from repo root or Vercel doubles the path

### Live Auction
- **DON'T** transition to `bidding_status: 'waiting'` without calling `autoOpenBidding()` when autoMode is on
- **DON'T** use `closeBidding()` for "Close Early" in auto-mode — use `autoAdvance()`
- **DON'T** display odds/values in `team-spotlight.tsx` — `strategy-overlay.tsx` is the single source of truth
- **DON'T** feed child components in `commissioner-view.tsx` the static `session.payout_rules` / `session.estimated_pot_size` props — the commissioner edits settings into LIVE state (`localPayoutRules` / `localPotSize`). Wire children (`TeamQueue`, `StrategyOverlay`, and any new one) to that local state or their fair values freeze while the center overlay updates. Caught 2026-06-05: the left Team Queue didn't react to pot/payout changes because it read the stale `session.*` props.
- **DON'T** read `americanOdds` directly — use `initializeTeams()` output (some tournaments use `probabilities`)
- **DON'T** forget to update first team's bid `amount` when selling bundles — split price, not full
- **DON'T** label participant-rankings UI as "Leaderboard" in golf contexts — the word collides with the real golf tournament leaderboard (Min Woo Lee, Schauffele, etc.). Use **"Standings"** for owner/participant rankings (fantasy-sports vernacular). The body of `Leaderboard.tsx` already uses "Projected Standings"; align tab labels and section headers with the body. Tab rename shipped 2026-05-14.
- **DON'T** use amber/yellow to signal "losing money" on P&L surfaces — amber reads as "warning/heads up" not "you're underwater." Use red for losses, green for gains, dim white for flat. Caught 2026-05-14 on the Live EV column: a $1 dip and a $20 dip looked identical in amber-only. Show the signed delta (`+$4.35` green / `-$11.96` red) when magnitude matters.

### Kalshi / Soccer / Group-Stage (added 2026-06-03, World Cup)
- **Kalshi market reads are PUBLIC (unauthenticated)** — do NOT add `KALSHI_API_KEY`/`KALSHI_PRIVATE_KEY` to Vercel for reads. Prices live in `*_dollars` STRING fields (`yes_bid_dollars`, `yes_ask_dollars`, `last_price_dollars`); the old integer-cent fields (`yes_bid`, `last_price`, `volume`) are GONE (read `undefined`). The nested-event projection omits prices — fetch via `/markets?event_ticker=` or `series_ticker=`. Join markets to nations by `yes_sub_title` (full name), NOT ticker codes (they vary 2- vs 3-letter; GB=England). Base URL `https://api.elections.kalshi.com/trade-api/v2`.
- **No "advance from group" market exists** — derive it from `KXWCSTAGEOFELIM` ("stage of elimination", 7 mutually-exclusive legs per nation): `P(advance) = 1 − P(Group Stage)`. The nation is in the EVENT title (`"USA: Stage of Elimination"`), not the market `yes_sub_title`.
- **`RoundConfig.devigScope`**: `'group'` normalizes within each group→1 (e.g. win-your-group); `'global'` normalizes across the field→`teamsAdvancing`. The `'group'` devig strategy is now scope-aware (World Cup is its only consumer). A per-group round sits OUTSIDE the global cap chain; the first global rung caps later rungs (self-heals cross-market inconsistency).
- **Soccer `seed` is within-group position (1–4), NOT a strength rank.** Three features wrongly assumed seed=rank — default sort, the Seed column, AND the free-preview paywall (`seed ≤ 2` leaked all 24 seed-1/2 teams). Use the config flags `defaultSort` / `showSeedColumn` / `previewTeamCount` (gate the preview on top-N-by-value, never on a seed cutoff).
- **`OddsSourceSelector` does NOT auto-apply the registry's `defaultSourceId`** — it applies only on user click, and `SET_INITIAL_DATA` uses the static `baseTeams`. To make live odds the DEFAULT shown, merge them into `baseTeams` at the page level (`getWorldCupLiveTeams` + `/strategy`), not via the registry/selector.

### Data
- **DON'T** assume `bidder_id` in `auction_bids` = `auction_participants.id` — it's `auth.users.id`
- **DON'T** use `config.teams` — teams live on `TournamentEntry` from `getTournament()`
- **DON'T** skip `parseTeamOrder()` at data boundaries — DB, broadcasts, and initial state all need it
- **DON'T** use `gameLabel` for advancement badges — use `label`. `gameLabel` = elimination/results only
- **Payout rules are per-position** — `top5: 5%` = each of 5 gets 5% (total 25%). Multiply by `teamsAdvancing`
- **DON'T** use `eliminatedCost` for net P&L — use `totalSpent`. Champion/alive teams still cost money. Settlement balances must sum to zero.

### Tournaments & Lifecycle
- **DON'T** read `config.isActive` for routing/visibility decisions — use `getTournamentPhase(config)` from `v2/lib/tournaments/phase.ts`. `isActive` is the legacy boolean and only stays for migration.
- **DON'T** add a new tournament without adding entries in BOTH `PRESET_MAP` (`payout-presets.ts`) AND `liveSyncMatchers` (on the config). PRESET_MAP falls back silently to March Madness presets — caused PGA to show 10% total payout when host filled in tier values. The regression test in `__tests__/payout-presets.test.ts` catches preset-sum violations but doesn't catch a missing PRESET_MAP entry.
- **A new tournament/sport also needs `getStandardProps()` (`props.ts`) AND a bundling scheme (`bundles.ts`) for its sport** — not just PRESET_MAP + config. Missing props → the create-form Prop Bets section is hidden AND any preset's prop values are silently dropped (total falls below 100%). Missing bundling → presets generate zero items (soccer fell through to the bracket "seeds 13–16" logic; World Cup seeds are 1–4, so nothing bundled). Both caught 2026-06-02 on World Cup.
- **DON'T** hardcode tournament IDs in cron / sync routes — the golf-sync was Masters-only in 6 places. Use the registry: `listTournamentsByPhase()` + `liveSyncMatchers` for event-name matching. **Use `matchesTournamentEvent(eventName, config)` from `lib/tournaments/registry.ts` for the actual matching** — same trap struck again 2026-05-14 in `/api/golf/projections/route.ts` AND `actions/dashboard.ts` (both hardcoded `event_name.includes('masters')`, broke PGA's Leaderboard tab + dashboard projected P&L). And again 2026-05-18 in `tournament-dashboard.tsx` — the "Sync Scores" button was gated on `config.id === 'march_madness_2026' || config.id === 'masters_2026'`, leaving PGA hosts with NO escape hatch when the cron missed the final round. Use the `supportsManualSync(config)` helper, which checks `config.liveSyncMatchers` for golf and only hardcodes the basketball/March Madness fallback (because ESPN sync is sport-specific anyway). New golf tournament? Set `liveSyncMatchers` — the button auto-appears. The shared helper is the only correct way.
- **DON'T** filter the golf-sync cron on `phase === 'live' || 'hostable'` alone. Phase flips to `completed` at 00:00 UTC the day after `endDate`, but golf majors that wrap Sunday evening ET don't fully settle in DataGolf until ~midnight UTC at the earliest. The Monday-morning cron used to skip the just-ended tournament entirely, leaving Settlement stuck at ~10% distributed and Standings stuck on "Live Odds" projections forever. Use `listSyncEligibleTournaments(POST_END_SYNC_GRACE_DAYS)` from the registry — it keeps `completed` tournaments eligible for 1 day after endDate so the morning-after cron can backfill. Cron is now twice-daily (`0 0,6 * * *` = 7pm + 1am ET) so a Sunday-evening run has a chance too. Bug caught 2026-05-18 on PGA Championship.
- **DON'T** trust DataGolf's in-play endpoint to be returning the event you expect — it returns whatever PGA event is currently active in betting markets, including last week's. Always verify `event_name` matches your target tournament's `liveSyncMatchers` before writing `tournament_results`.
- **DON'T** conflate `auction_sessions.status === 'completed'` with "tournament is over" — `status='completed'` means the draft closed, which happens days before a live tournament even starts. Gate "tournament-over" UI decisions on `getTournamentPhase(config)` (live/hostable → active no matter what auction status says). Patterns like `status === 'completed' && currentRound === null` ALSO match a freshly-drafted league with zero `tournament_results` rows — if you need the "fully scored" signal specifically, add `results.length > 0`. Bug caught 2026-05-14: PGA leagues bucketed as Completed the moment their draft closed, showed `-$buyIn` P&L. Use `isCompletedDashboardSession` from `lib/dashboard/categorize.ts` for the dashboard view.
- **DON'T** hardcode strategy price strings — use `STRATEGY_PRICE_CENTS` from `v2/lib/pricing.ts` for in-app fallbacks. Per-tournament overrides still live on `TournamentConfig.strategyPrice`.
- **Payout presets MUST sum to 100%** (±0.5%). `teamsAdvancing` varies per tournament (Masters cuts at 50, PGA at 70), so per-tournament presets are required — reusing another sport's presets will break the total. Run `npm test -- payout-presets` to verify.
- **DON'T** let an odds-fetch script reassign team `id` on every re-run. Bundles in `session.settings.bundles` reference IDs that were valid at session-creation time; if `id` shifts later (e.g. rank-based reassignment + odds refresh), bundle titles drift from the chips and old sessions point at the wrong golfers. `fetch-pga-odds.mjs` now matches by `dg_id` to keep `id` stable — only `seed` reflects current rank. Two safety nets backstop this: `deriveBundleLabel()` regenerates titles from the current `teamMap` at render time, and `createSession()` writes a `teamSnapshot` into `session.settings` so future config changes can't touch existing sessions. New tournaments inherit both safety nets automatically — no per-tournament code required. Audit drift with `npx tsx scripts/diagnose-bundle-drift.ts`.

### Marketing & Emails
- **DON'T** trust LLM memory for golf-major dates — they shift week-to-week year-over-year. Verify via Chrome MCP against usopen.com / tourchampionship.com / pgachampionship.com before sending any tournament-date email.
- **DON'T** hardcode venue names in email templates — Quail Hollow (2025) ≠ Aronimink (2026). Same applies to courses for other recurring events.
- **DON'T** send email blasts without `DRY_RUN=true` first. The default in `scripts/send-pga-launch.ts` is dry — writes `.preview-*.html` (gitignored) so the body can be eyeballed in a browser before any real send.
- **DON'T** lump free + paid features in one bullet list — readers infer it's a bundle. Use explicit "What's free for every host" vs "Optional add-on" sections.
- **Excluded addresses live in script-local `EXCLUDED` sets** (spivack711, camdunn5 as of 2026-05-12). Long-term fix: `email_opt_out` column on `profiles` + unsubscribe link.

### Git
- **DON'T** commit `.env` files or secrets
- **DON'T** force push to main — NEVER
- **DON'T** push without user approval — always use `/push` or `/pre-deploy-review`
- **DON'T** assume `.env.local` exists in git worktrees — it's gitignored, so it only lives in the main checkout. For scripts that need real creds, source from the main checkout: `set -a; source ~/.../v2/.env.local; set +a; ./script.ts`

## Key Reference Documents
- `ROADMAP.md` — Product strategy, phased build plan
- `MEMORY.md` (auto-memory) — Session history, project state, feature backlog
- `CLAUDE_BLUEPRINT.md` — Market research, competitive analysis
