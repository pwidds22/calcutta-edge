# Calcutta Edge - Claude Code Context

## Project Overview
Calcutta Edge (calcuttaedge.com) is a Calcutta auction platform — free live auction hosting + paid strategy analytics ($29.99/event). Supports March Madness, golf majors, NFL playoffs, and custom tournaments.

**Business model**: Free hosting (distribution flywheel) + paid strategy ($29.99/event) + custom solutions ($200-500+)

## Quick Start
```bash
cd v2
npm run dev       # Next.js dev server (port 3000)
npm run build     # Production build (run before deploy)
npm test          # Vitest unit tests (41 tests)
npm run lint      # ESLint
```

## Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind CSS, shadcn/ui) |
| Hosting | Vercel — auto-deploys on push to `main` |
| Database | Supabase PostgreSQL (project: `xtkdwyrxllqmgoedfotf`, us-east-1) |
| Auth | Supabase Auth (`@supabase/ssr`, cookie-based sessions) |
| Real-time | Supabase Realtime (Broadcast + Presence for live auctions) |
| Payments | Stripe (Payment Links + webhooks) |

## Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only (webhooks, admin operations)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe server-side
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL` — Stripe client-side
- `NEXT_PUBLIC_SITE_URL` — for password reset emails (set to `https://calcuttaedge.com`)

## Key Directories
```
v2/                         # Next.js app (root dir on Vercel)
  app/                      # App Router pages and layouts
    (auth)/                 # Login, register, forgot/reset password
    (protected)/            # Auth-required pages
      auction/              # Strategy tool (free preview + paid full access)
      host/                 # Commissioner: dashboard, create, manage sessions
      join/                 # Join live auction by code
      live/[sessionId]/     # Live auction participant view
      profile/              # User profile + upgrade CTA
      payment/              # Stripe payment page
    api/webhooks/stripe/    # Stripe webhook handler
  lib/
    calculations/           # Core math: odds, values, profits, pot, normalize (41 tests)
    tournaments/            # Tournament configs, registry, payout presets
    auction/                # Strategy state (useReducer + Context + auto-save)
    auction/live/           # Live auction: types, timer, channel, settlement, export
    supabase/               # Client helpers: client, server, middleware, admin, broadcast
    stripe/                 # Stripe config (lazy init)
  components/
    auction/                # Strategy tool UI (6 components)
    live/                   # Live auction UI (19 components)
    landing/                # Landing page sections (8 components)
    layout/                 # Navbar, AppNavbar, Footer
    auth/                   # Login, register, forgot/reset password forms
    ui/                     # shadcn/ui primitives
  actions/                  # Server actions: auth, auction, session, bidding
  supabase/migrations/      # SQL migrations (2 files)
```

## Database Tables
- `profiles` — extends `auth.users` (email, has_paid, payment_date)
- `auction_data` — per-user strategy tool state (teams jsonb, payout_rules, pot_size, event_type)
- `auction_sessions` — live auction rooms (status, team order, settings, timer, highest bid)
- `auction_participants` — per-session membership (display names)
- `auction_bids` — full bid history (is_winning_bid flag)

## Architecture Patterns

### Auth Flow
Register → Supabase Auth cookie → middleware checks session → redirect to `/auction`

### Payment Flow
User clicks "Unlock" → Stripe Payment Link → `checkout.session.completed` webhook → `profiles.has_paid = true`

### Free Preview
`/auction` is auth-only (not payment-gated). Seeds 1-2 show full data; seeds 3+ blurred with CSS `blur-[3px]`. Upgrade banner for unpaid users.

### Live Auction Flow
Commissioner creates session → participants join via 6-char code → real-time bidding via Supabase Broadcast → DB is source of truth for reconnection → `sellTeam()` auto-syncs to strategy tool's `auction_data`

### Tournament System
Config-driven: adding a tournament = one file in `v2/lib/tournaments/configs/`. Registry provides `getTournament(id)`, `getActiveTournament()`, `listTournaments()`. Devigging strategies: `bracket` (NCAA), `global` (golf/NFL), `group` (World Cup), `none` (custom).

### Core Calculations
- **Team value**: `SUM(odds[round] * payoutRules[round] / 100)`
- **Fair value**: `valuePercentage * potSize`
- **Pot inference**: `totalPaid / totalValuePercentage`
- **Round profit**: `cumulativePayout[round] - purchasePrice`
- **Odds devigging**: American → implied probabilities → structure-aware vig removal

## Anti-Patterns (DO NOT DO THESE)

### Supabase
- **DON'T** use service role key on the client — bypasses RLS
- **DON'T** create clients without `@supabase/ssr` cookie handling
- **DON'T** skip RLS policies on tables with user data
- **DON'T** put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*` variables
- **DON'T** write self-referencing RLS policies — causes PostgreSQL infinite recursion. Use `SECURITY DEFINER` functions instead (see `is_session_participant()`)

### Supabase Realtime
- **DON'T** use `realtime:` prefix on broadcast topics — HTTP API silently drops messages. Use raw channel name: `auction:{sessionId}`
- **DON'T** render Presence state without deduplication — multiple entries per user from multiple connections. Always deduplicate by `userId`

### Stripe
- **DON'T** hardcode Payment Link URLs — use `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL` env var
- **DON'T** modify webhook handling without testing with `stripe listen --forward-to`
- **DON'T** remove the fallback "recent unpaid user" logic without implementing `client_reference_id`
- **DON'T** set webhook URL without `www` — Vercel redirects `calcuttaedge.com` → `www.calcuttaedge.com` (307), and Stripe doesn't follow redirects. Use `https://www.calcuttaedge.com/api/webhooks/stripe`

### Vercel / Build
- **DON'T** put Windows-only `*-win32-x64-msvc` packages in `dependencies` or `devDependencies` — use `optionalDependencies` or Vercel Linux build fails with EBADPLATFORM
- **DON'T** initialize Stripe SDK at module level — lazy init with `getStripe()` or build fails without env vars

### Live Auction Auto-Mode
- **DON'T** add a state transition to `bidding_status: 'waiting'` without calling `autoOpenBidding()` when `settings.autoMode` is true — auction will freeze. Every flow (start, sell, skip, undo) must check this.
- **DON'T** use `closeBidding()` for "Close Early" in auto-mode — it only sets status to 'closed' with nothing to trigger the sell. Use `autoAdvance()` (atomic close+sell+advance).

### Live Auction UI
- **DON'T** display odds/values in `team-spotlight.tsx` — it's identity-only. All numbers go in `strategy-overlay.tsx` (single source of truth).
- **DON'T** read `americanOdds` directly in UI components — some tournaments use `probabilities` instead (March Madness 2026 has `ODDS_UNUSED` = all zeros). Always use `initializeTeams()` output which handles both.
- **DON'T** show a compact/abbreviated strategy view for bundles — bundle members must get the same full round-by-round odds grid as individual teams.

### Git
- **DON'T** commit `.env` files or secrets
- **DON'T** force push to main
- **DON'T** make commits with vague messages

## Workflow
1. **Plan first** — enter plan mode for any non-trivial task (3+ steps)
2. **Use subagents** — offload research and parallel work
3. **Test calculations** — core math functions must have unit tests
4. **Verify before done** — run build, check tests, prove it works
5. **Use Context7 MCP** — look up Supabase, Next.js, Stripe docs before guessing
6. **Update anti-patterns** — after any correction from user, capture the lesson

## Key Reference Documents
- `ROADMAP.md` — Product strategy, phased build plan, revenue targets
- `CLAUDE_BLUEPRINT.md` — Market research, competitive analysis, payout structures
- `CLAUDE_RESEARCH1.md` / `CLAUDE_RESEARCH2.md` — Market analysis, strategic playbook

## Legacy Stack (Express + MongoDB)
Still live on Render at the repo root. Node.js + Express + MongoDB + JWT auth + vanilla JS. The `v2/` directory is the active codebase — all new development happens there. Legacy will be deprecated after March Madness 2026 launch.

## Session Notes (2026-03-17)

### Completed (2026-03-17 — Odds + Live Auction Polish Session)
- **Static sportsbook odds pipeline** — replaced broken live Odds API with devigged FanDuel, DraftKings, Pinnacle data (`v2/lib/tournaments/devig-pipeline.ts`, `v2/lib/tournaments/data/`)
- **5 odds sources** — Evan Miya, TeamRankings, FanDuel, DraftKings, Pinnacle with proper devigging (binary YES/NO, outright with expectedWinners, matchup, regional)
- **Custom odds editor** — user can enter custom probabilities per team in strategy tool (`v2/components/auction/odds-source-selector.tsx`)
- **103 unit tests passing** — including 38 devig pipeline tests + 5 cross-source validation tests
- **Auto-mode start fix** — eliminated race condition: `startAuction()` now sets `bidding_status='open'` directly when autoMode is on, skipping intermediate 'waiting' state (`v2/actions/bidding.ts`)
- **Live auction odds source selector** — dropdown in strategy overlay lets participants pick their preferred odds source during live bidding (`v2/components/live/strategy-overlay.tsx`)
- **Blend mode in live auction** — custom weight sliders for all 5 sources, localStorage-persisted
- **Suggested bid %** — configurable 50-100% slider (default 95%), shown as amber metric in strategy overlay, localStorage-persisted
- **Odds registry plumbing** — `getOddsRegistry()` in registry.ts, threaded through page → view → strategy-overlay for both commissioner and participant views
- **Deleted live Odds API** — removed `v2/app/api/odds/ncaab/route.ts` and `v2/lib/odds-api/client.ts`
- **Commits**: `6195db6`, `3d0e2cf`, `8269e94`, `1febc0f` — all deployed to Vercel

### Previous Sessions
- **2026-03-17 (earlier)**: 8 bugs fixed from live testing, auto-mode fixes, strategy overlay rework, bundle parity
- **2026-03-16**: team_order text[] fix, parseTeamOrder, shuffle fix, production DB verified

### Next Steps (Priority Order)
1. **AUTO-UPDATE TOURNAMENT RESULTS** — ESPN scoreboard API (`site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard`), map team names → tournament IDs, auto-insert into `tournament_results` table. Vercel cron or commissioner "sync" button. 3 real completed auctions (35 participants) need this NOW.
2. **Welcome email on signup** — Resend API (`re_7sxsLdYq_...` key), trigger from register server action, branded HTML template matching existing email design
3. **PostHog or Vercel Analytics** — track user behavior, traffic sources, conversion funnel
4. **Stripe `client_reference_id`** — link payment to logged-in user session, not just email match
5. **Post-tournament features** — results tracking, payout management (partially built)

### Anti-Patterns Learned
- **Parse at EVERY data boundary**: DB returns text[] for team_order — must run parseTeamOrder on page load, real-time broadcasts, AND initial channel state
- **Broadcast payloads bypass server action parsing**: Always parse/transform on the client side
- **Auto-mode race condition**: Don't use two rapid broadcasts (waiting→open). Instead, set final state in one DB write and broadcast after. Applied in `startAuction()`.
- **`americanOdds` may be zeros**: March Madness 2026 uses `probabilities` field instead. Never read raw odds in UI — use `initializeTeams()` output
- **Strategy display single source of truth**: `strategy-overlay.tsx` owns all numbers, `team-spotlight.tsx` is identity-only
- **Reach-round devigging needs expectedWinners**: 16 teams reach S16, 8 reach E8, etc. — outright normalization to sum=1 is wrong for reach markets. Use `devigOutright(odds, expectedWinners)`
- **DK R32 odds are game moneylines, not futures**: Must devig as matchup pairs, not outright across 68 teams
- **npm install on Windows breaks native modules**: `npm install resend` displaced `lightningcss-win32-x64-msvc.node`. Fix: `cp node_modules/lightningcss-win32-x64-msvc/lightningcss.win32-x64-msvc.node node_modules/lightningcss/` and clear `.next` cache

## Session Notes (2026-03-17 Evening — Marketing Launch)

### Completed (2026-03-17 Evening)
- **Brand assets** — CE gavel logo added at all sizes (`v2/public/brand/`), favicon updated (`v2/app/favicon.ico`), both navbars show icon + text (`v2/components/layout/navbar.tsx`, `v2/components/layout/app-navbar.tsx`), OG/Twitter card images set (`v2/app/layout.tsx`)
- **51 emails sent via Resend** — email scripts in `v2/scripts/send-*.ts`, sent from `support@calcuttaedge.com`:
  - 14 prior Calcutta customers (launch announcement)
  - 8 Survive the Chop subscribers (cross-sell)
  - 27 completed auction users (thank you + feedback ask)
  - 2 early signups (maintenance note)
- **5 blog posts live** — 3 existing + 2 new (`v2/content/blog/calcutta-payout-rules-guide.mdx`, `v2/content/blog/calcutta-fair-value-explained.mdx`). Blog linked from navbar + footer.
- **Reddit posts** — posted to r/CollegeBasketball, r/sportsbook, r/MarchMadness (manual by user)
- **X/Twitter** — thread + standalone tweets posted, Cowork monitoring set up (manual by user)
- **Competitive research** — full landscape analysis: Calcutta Time (hosting only), PoolGenius ($39-49 analytics only, 2 articles), BettorEdge (free calc, 3-4 articles), Auction Pro (free hosting, no analytics). CE is only all-in-one.
- **Customer analysis** — 48 profiles, 44 real organic users. 3 completed auctions (35 participants, 2,061 bids). 1 organic paying customer (kshah31). Better Collective employee (svalukis) scouted the platform.
- **Resend installed** — `resend` package added to dependencies (`v2/package.json`). API key: `re_7sxsLdYq_Jz4JEMhQmHLGywuERCNegN3z`. Domain verified for `support@calcuttaedge.com`.
- **Commits**: `ef9ff6f` (brand assets), `b3d5f9e` (blog posts + nav links)

## Session Notes (2026-03-18 — ESPN Auto-Results + Welcome Email + Analytics)

### Completed (2026-03-18)
- **ESPN auto-results pipeline** — `v2/lib/espn/scoreboard.ts` (API client), `v2/lib/espn/team-map.ts` (68 teams + 50+ aliases), `v2/app/api/espn/sync/route.ts` (dual-mode: cron + manual)
- **"Sync ESPN" button** — emerald button on tournament dashboard tab bar, available to ALL participants (not just commissioner). Spinner animation, status messages (success/error/no-new-results), auto-clears after 4s
- **Vercel cron job** — `v2/vercel.json` with daily schedule (`0 6 * * *`). Hobby plan limits to daily; Pro plan needed for every-10-min
- **ESPN sync broadcasts** — after upserting results, broadcasts `RESULTS_BULK_UPDATED` so all connected clients update in real-time
- **Middleware allowlist** — added `/api/espn` to middleware passthrough (was getting auth-redirected to /login)
- **Welcome email on signup** — `v2/lib/email/welcome.ts` (branded dark HTML template), wired into `v2/actions/auth.ts` signup() as fire-and-forget
- **Vercel Analytics + Speed Insights** — `@vercel/analytics` + `@vercel/speed-insights` in root layout. Zero-config, privacy-friendly
- **Vercel CLI installed** — `npm i -g vercel`, linked to `calcutta-edge` project from repo root
- **Deployed to production** — `vercel deploy --prod` from repo root (Git webhook wasn't triggering, CLI deploy worked)
- **Commits**: `2053449` (main feature), `116f574` (trigger deploy), `df8b645` (cron fix)

### Anti-Patterns Learned
- **Vercel Hobby cron limit**: Only supports daily cron jobs. `*/10 * * * *` fails deployment. Use daily schedule + manual button for real-time.
- **Vercel root directory doubling**: If project root dir is set to `v2/` in Vercel settings, running `vercel deploy` from inside `v2/` causes `v2/v2` path error. Always deploy from repo root.
- **New API routes need middleware allowlist**: Any `/api/*` route outside `/api/webhooks` or `/api/test-*` gets caught by auth middleware and redirected to `/login` (returns HTML instead of JSON).
- **Turbopack doesn't hot-reload new route files**: API routes created after `next dev` starts aren't picked up by Turbopack. Restart the dev server.
- **npm install breaks native modules**: After `npm install --legacy-peer-deps`, must re-install Windows native modules: `npm install --os=win32 @tailwindcss/oxide-win32-x64-msvc lightningcss-win32-x64-msvc --legacy-peer-deps`, then copy `.node` files into parent packages and `rm -rf .next`

### Env Vars Added to Vercel
- `CRON_SECRET` — protects the ESPN sync cron endpoint
- `RESEND_API_KEY` — enables welcome emails in production
- Analytics enabled in Vercel dashboard

### Marketing Push (2026-03-18 cont'd)
- **10 blog posts now live** — 5 new SEO posts: hosting guide, sleeper picks, tool comparison, upset picks, bracket breakdown
- **X thread drafted** — "i bid on math" angle with product screenshots
- **Ads considered**: NO on display ads (48 users too small, hurts premium positioning)

### Customer Feedback Received (2026-03-18)
- **Luke Bannon** (14 participants): Timer jump on open, last-second sniping, wants team selection + decimal payouts
- **Kunal Shah** (10 participants, PAYING CUSTOMER): Timer sniping confirmed, play-in bundle bug, wants edit-after-create + region shuffle
- Replies sent. See `memory/feedback_customer_emails_0318.md` and `memory/project_feature_requests_0318.md`

### Next Steps (Priority Order)
1. **Timer sniping fix (P0)** — server-side grace period so timer extension is guaranteed. Both customers reported.
2. **Play-in bundle grouping fix (P1)** — 16-seed play-ins should respect 13-16 grouping setting
3. **Display name in profile** — quick win, commissioners can't set display name
4. **Strategy tool** — clear values, save custom blend for auction, multi-auction saves
5. **Custom bundles** — commissioner-defined team groupings
6. **Edit auction settings post-creation**
7. **Region-based shuffle** — shuffle within one region at a time
8. **Stripe `client_reference_id`** — payment attribution
9. **Decimal payout percentages**
