# March Madness Sprint — Design Document

**Date**: 2026-03-16
**Context**: Tournament games started 3/17. Users need post-auction features NOW.

## Scope

Four workstreams, prioritized by urgency:

1. **Wire Up + Test + Deploy Tournament Management** (CRITICAL — day 1)
2. **Live Chat During Auction** (HIGH — social engagement)
3. **Prop Payout Support** (HIGH — competitive parity)
4. **Auction QoL: Min Bids + Payment Tracking** (MEDIUM)

### Out of Scope
- Multi-odds source strategy tool (back burner)
- Silent/simultaneous auction mode
- Spectator mode
- Proxy/auto-bidding
- Social sharing cards
- Native mobile / PWA

---

## Workstream 1: Tournament Management (Wire Up + Test + Deploy)

### Current State
~90% of the code exists but has never been tested or deployed:
- DB migration: `v2/supabase/migrations/00003_tournament_results.sql`
- Server actions: `v2/actions/tournament-results.ts` (CRUD + broadcast)
- Calculation engine: `v2/lib/auction/live/actual-payouts.ts`
- Debt simplification: `v2/lib/auction/live/debt-simplification.ts`
- Bracket utils: `v2/lib/auction/live/bracket-utils.ts`
- UI: `v2/components/live/tournament-dashboard.tsx` (5-tab master)
  - `bracket-entry.tsx` (NCAA bracket with cascade)
  - `results-entry.tsx` (flat round-by-round entry)
  - `leaderboard.tsx` (rankings + earnings)
  - `settlement-matrix.tsx` (debt simplification)

### What Needs To Happen
1. Apply migration 00003 to production Supabase
2. Verify TournamentDashboard is wired into `/live/[sessionId]` page
3. Verify the commissioner/participant views show the dashboard post-auction
4. E2E test: enter results → leaderboard updates → settlement calculates
5. E2E test: bracket entry with cascade logic
6. Fix any bugs found during testing
7. Build + deploy to Vercel

### Key Risk
The code was written but never tested against real data. Expect integration bugs (type mismatches, missing props, stale imports).

---

## Workstream 2: Live Chat

### Architecture
Reuse existing Supabase Broadcast infrastructure (already powering real-time bidding).

**Transport**: New event type `CHAT_MESSAGE` on existing `auction:{sessionId}` channel.

**No DB persistence** — chat is ephemeral. Reasons:
- Avoids moderation burden and legal liability
- No new migration needed
- Keeps it simple — chat disappears on refresh
- Users can scroll back through current session's messages

### Data Model
```typescript
interface ChatMessage {
  id: string;          // crypto.randomUUID()
  userId: string;
  displayName: string;
  text: string;
  timestamp: number;   // Date.now()
}
```

### Components
- `ChatPanel` — message list + input, collapsible sidebar or bottom drawer
- Commissioner mute toggle (broadcast `CHAT_MUTED` / `CHAT_UNMUTED`)
- Visible during all phases: lobby, active, paused, completed

### Limits
- Max 500 chars per message
- Rate limit: 1 message per 2 seconds (client-side)
- Max 200 messages in memory (FIFO)

---

## Workstream 3: Prop Payout Support

### Current State
Payout presets already have prop keys: `biggestUpset`, `highestSeed`, `largestMargin`, `customProp` — but they're all set to 0 and not wired up.

### Design

**Session creation**: Add prop toggle section below payout rules. Commissioner enables/disables each prop and sets percentage.

**Results entry**: New "Props" tab in TournamentDashboard. Commissioner enters:
- Biggest upset: select winning team from dropdown of upsets
- Highest F4 seed: auto-calculated from results
- Largest margin: enter team + margin
- Custom prop: free-text label + select winner

**Settlement**: Add prop payouts to participant earnings in `calculateLeaderboard()`.

**Strategy tool**: Show prop EV in team table (e.g., "this 12-seed has X% chance of biggest upset").

### DB Changes
New table `prop_results` or extend `tournament_results` with a `prop_key` column. Simplest: add a `prop_results` JSONB column to `auction_sessions`.

---

## Workstream 4: Auction QoL

### Minimum Bid / Reserve Prices
- Add `minimumBid` to `SessionSettings` (global floor, e.g., $5)
- `placeBid()` rejects bids below minimum
- Show minimum in BidPanel UI
- Optional per-team override (commissioner sets in lobby)

### Payment Tracking
- Add `payment_status` JSONB column to `auction_sessions`
- Structure: `{ [participantId]: { paid: boolean, paidAt?: string } }`
- Commissioner toggle in settlement view: "Mark as paid"
- Visual indicator (checkmark) next to settled participants

---

## Implementation Strategy

All 4 workstreams are independent and can run in parallel via subagents.
Each agent should:
1. Read existing code thoroughly before writing
2. Run build after changes
3. Run tests if applicable
4. Report back with what was done and any issues

Workstream 1 must deploy first since games are live.
