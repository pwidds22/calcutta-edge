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
- **DON'T** read `americanOdds` directly — use `initializeTeams()` output (some tournaments use `probabilities`)
- **DON'T** forget to update first team's bid `amount` when selling bundles — split price, not full

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
- **DON'T** hardcode tournament IDs in cron / sync routes — the golf-sync was Masters-only in 6 places. Use the registry: `listTournamentsByPhase()` + `liveSyncMatchers` for event-name matching.
- **DON'T** trust DataGolf's in-play endpoint to be returning the event you expect — it returns whatever PGA event is currently active in betting markets, including last week's. Always verify `event_name` matches your target tournament's `liveSyncMatchers` before writing `tournament_results`.
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
