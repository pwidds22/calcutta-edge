# Calcutta Edge

## IMPORTANT: This is a customer-facing app with 100+ users. Broken deploys = broken auctions. Always verify before pushing.

## Quick Start
```bash
cd v2
npm run dev       # Next.js dev server (port 3000)
npm run build     # Production build (MUST pass before deploy)
npm test          # Vitest unit tests (140+ tests, all must pass)
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

### Git
- **DON'T** commit `.env` files or secrets
- **DON'T** force push to main — NEVER
- **DON'T** push without user approval — always use `/push` or `/pre-deploy-review`

## Key Reference Documents
- `ROADMAP.md` — Product strategy, phased build plan
- `MEMORY.md` (auto-memory) — Session history, project state, feature backlog
- `CLAUDE_BLUEPRINT.md` — Market research, competitive analysis
