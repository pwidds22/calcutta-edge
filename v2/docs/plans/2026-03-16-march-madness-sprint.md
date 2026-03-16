# March Madness Sprint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship tournament results management, live chat, prop payouts, and auction QoL to production for March Madness 2026 (games started 3/17).

**Architecture:** 4 independent workstreams running in parallel. WS1 (tournament management) is ~90% built — needs migration applied, integration tested, and bugs fixed. WS2 (live chat) uses existing Supabase Broadcast. WS3 (props) extends existing payout system. WS4 (min bids + payment tracking) are small DB + UI additions.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL + Realtime + Auth), TypeScript, Tailwind, shadcn/ui

---

## Workstream 1: Tournament Management — Wire Up + Test + Deploy

### Context
All code exists but has never been tested against real data:
- Migration: `v2/supabase/migrations/00003_tournament_results.sql`
- Server actions: `v2/actions/tournament-results.ts`
- Calculations: `v2/lib/auction/live/actual-payouts.ts`
- Debt simplification: `v2/lib/auction/live/debt-simplification.ts`
- Bracket utils: `v2/lib/auction/live/bracket-utils.ts`
- Dashboard UI: `v2/components/live/tournament-dashboard.tsx`
- Sub-components: `bracket-entry.tsx`, `results-entry.tsx`, `leaderboard.tsx`, `settlement-matrix.tsx`
- Already wired into `commissioner-view.tsx:243` and `participant-view.tsx:192` (shown when auction status = completed)

### Task 1.1: Apply Migration to Production Supabase

**Step 1:** Read migration file `v2/supabase/migrations/00003_tournament_results.sql`

**Step 2:** Apply via Supabase MCP `apply_migration` tool:
- Creates `tournament_results` table with RLS policies
- Adds `tournament_status` column to `auction_sessions`
- Creates indexes for performance

**Step 3:** Verify via Supabase MCP `execute_sql`:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'tournament_results';
```

**Step 4:** Verify column added:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'auction_sessions' AND column_name = 'tournament_status';
```

### Task 1.2: Integration Test — Tournament Results CRUD

Using the dev-only `/api/test-action` route (already exists), test the full flow.

**Step 1:** Add tournament result actions to `v2/app/api/test-action/route.ts`:
- Import from `@/actions/tournament-results`: `updateResult`, `bulkUpdateResults`, `getTournamentResults`, `settleTournament`
- Add cases: `updateResult`, `bulkUpdateResults`, `getTournamentResults`, `settleTournament`

**Step 2:** Create a test session, sell 3+ teams, complete auction (reuse E2E pattern from earlier)

**Step 3:** Test result entry:
```json
{ "action": "updateResult", "params": { "sessionId": "...", "teamId": 1, "roundKey": "r32", "result": "won" } }
```

**Step 4:** Test bulk update:
```json
{ "action": "bulkUpdateResults", "params": { "sessionId": "...", "updates": [
  { "teamId": 1, "roundKey": "r32", "result": "won" },
  { "teamId": 2, "roundKey": "r32", "result": "lost" }
] } }
```

**Step 5:** Verify results via `getTournamentResults`

**Step 6:** Test settle: `{ "action": "settleTournament", "params": { "sessionId": "..." } }`

### Task 1.3: Integration Test — Leaderboard + Settlement Calculations

**Step 1:** After entering results in 1.2, call `getSessionState` and verify `tournamentResults` array is populated

**Step 2:** Navigate to `/live/[sessionId]` in preview browser, verify TournamentDashboard renders (auction is completed)

**Step 3:** Verify leaderboard tab shows correct:
- Participant rankings sorted by net P&L
- Team status (alive/eliminated)
- Earnings per team

**Step 4:** Verify settlement tab shows:
- Net balances (earned - spent)
- Simplified payment plan

### Task 1.4: Integration Test — Bracket Entry

**Step 1:** Navigate to bracket tab in TournamentDashboard

**Step 2:** Verify bracket renders with regional groups (East/West/South/Midwest)

**Step 3:** Test cascade logic: if user changes Round of 32 winner, downstream rounds should clear

**Step 4:** Fix any rendering or logic bugs discovered

### Task 1.5: Fix Bugs + Build + Deploy

**Step 1:** Fix all bugs found in 1.2-1.4

**Step 2:** Run `npm run build` — fix any TypeScript/import errors

**Step 3:** Run `npm test` — ensure 55+ tests still pass

**Step 4:** Deploy to Vercel (auto-deploys on push to main)

---

## Workstream 2: Live Chat

### Task 2.1: Chat Message Types + Hook

**Files:**
- Create: `v2/lib/auction/live/chat-types.ts`
- Modify: `v2/lib/auction/live/use-auction-channel.ts`

**Step 1:** Create chat types:
```typescript
// v2/lib/auction/live/chat-types.ts
export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  timestamp: number;
}

export const CHAT_MAX_LENGTH = 500;
export const CHAT_RATE_LIMIT_MS = 2000;
export const CHAT_MAX_MESSAGES = 200;
```

**Step 2:** Add `CHAT_MESSAGE` and `CHAT_MUTED` event handling to `use-auction-channel.ts`:
- New state: `chatMessages: ChatMessage[]`, `chatMuted: boolean`
- On `CHAT_MESSAGE` event: prepend to messages array, trim to CHAT_MAX_MESSAGES
- On `CHAT_MUTED` event: set chatMuted state
- New function: `sendChatMessage(text: string)` — broadcasts CHAT_MESSAGE via channel
- New function: `toggleChatMute()` — commissioner only, broadcasts CHAT_MUTED

**Step 3:** Export new state and functions from the hook

### Task 2.2: ChatPanel Component

**Files:**
- Create: `v2/components/live/chat-panel.tsx`

**Step 1:** Build ChatPanel component:
- Props: `messages: ChatMessage[]`, `onSend: (text: string) => void`, `muted: boolean`, `onToggleMute?: () => void`, `isCommissioner: boolean`
- Message list: scrollable div, auto-scroll to bottom on new messages
- Input: text input + send button, disabled when muted
- Rate limiting: client-side 2s cooldown between sends
- Commissioner: mute/unmute toggle button
- Styling: dark theme, emerald accent, compact messages

**Step 2:** Wire into `commissioner-view.tsx` and `participant-view.tsx`:
- Add collapsible chat sidebar or bottom panel
- Pass channel.chatMessages, channel.sendChatMessage, etc.
- Show in ALL phases (lobby, active, paused, completed)

### Task 2.3: Server-Side Broadcast for Chat

**Files:**
- Modify: `v2/lib/supabase/broadcast.ts` (if needed)

**Step 1:** Verify existing `broadcastToChannel()` works for chat events (it should — it's generic)

**Step 2:** Test sending and receiving chat messages between two browser tabs

### Task 2.4: Build + Test

**Step 1:** Run `npm run build`
**Step 2:** Test chat in preview browser with two sessions
**Step 3:** Verify mute/unmute works
**Step 4:** Verify rate limiting works

---

## Workstream 3: Prop Payout Support

### Task 3.1: Prop Types + DB Schema

**Files:**
- Create: `v2/lib/tournaments/props.ts`
- Modify: `v2/lib/tournaments/types.ts` (add PropConfig type if not present)

**Step 1:** Define prop types:
```typescript
export interface PropDefinition {
  key: string;           // 'biggestUpset' | 'highestSeed' | 'largestMargin' | custom
  label: string;         // 'Biggest Upset'
  description: string;
  payoutPercentage: number;
  winnerId?: string;     // participantId of winner
  winningTeamId?: number;
  metadata?: string;     // e.g. "14-seed over 3-seed, margin: 12"
}
```

**Step 2:** Add `prop_results` JSONB column to `auction_sessions` via new migration:
```sql
ALTER TABLE public.auction_sessions
  ADD COLUMN prop_results jsonb DEFAULT '[]';
```

**Step 3:** Apply migration to production

### Task 3.2: Prop Configuration in Session Creation

**Files:**
- Modify: `v2/components/live/create-session-form.tsx`
- Modify: `v2/lib/auction/live/types.ts` (add to SessionSettings)

**Step 1:** Add `enabledProps` to SessionSettings:
```typescript
enabledProps?: { key: string; label: string; percentage: number }[];
```

**Step 2:** Add prop toggles section to create-session-form:
- Standard props: Biggest Upset, Highest F4 Seed, Largest Margin
- Custom prop: text label + percentage
- Percentages must sum to ≤ 100% with round payouts

### Task 3.3: Prop Results Entry UI

**Files:**
- Create: `v2/components/live/props-entry.tsx`
- Modify: `v2/components/live/tournament-dashboard.tsx` (add Props tab)

**Step 1:** Build PropsEntry component:
- Lists enabled props for the session
- Commissioner selects winner from sold team owners
- Auto-calculated props (e.g. highest F4 seed) can be computed from results

**Step 2:** Add "Props" tab to TournamentDashboard between Results and Leaderboard

### Task 3.4: Integrate Props into Settlement

**Files:**
- Modify: `v2/lib/auction/live/actual-payouts.ts`
- Modify: `v2/lib/auction/live/debt-simplification.ts`

**Step 1:** Add prop earnings to `calculateLeaderboard()`:
- For each resolved prop, add `percentage * actualPot / 100` to winner's earnings

**Step 2:** Update settlement to include prop payouts

### Task 3.5: Server Action for Prop Results

**Files:**
- Create or modify: `v2/actions/tournament-results.ts`

**Step 1:** Add `updatePropResult(sessionId, propKey, winnerId, winningTeamId?, metadata?)`:
- Stores in `prop_results` JSONB on `auction_sessions`
- Broadcasts `PROP_RESULT_UPDATED`

**Step 2:** Add to test-action route for E2E testing

### Task 3.6: Build + Test

**Step 1:** Run `npm run build`
**Step 2:** E2E test prop flow: create session with props → complete auction → enter prop winners → verify settlement includes props

---

## Workstream 4: Auction QoL

### Task 4.1: Minimum Bid

**Files:**
- Modify: `v2/lib/auction/live/types.ts`
- Modify: `v2/actions/bidding.ts` (`placeBid` function)
- Modify: `v2/components/live/bid-panel.tsx`
- Modify: `v2/components/live/create-session-form.tsx`

**Step 1:** Add `minimumBid?: number` to SessionSettings

**Step 2:** Add minimum bid input to create-session-form (default: $1)

**Step 3:** In `placeBid()`, reject bids below `session.settings.minimumBid`:
```typescript
if (amount < (settings?.minimumBid ?? 0)) {
  return { error: `Minimum bid is $${settings.minimumBid}` };
}
```

**Step 4:** Show minimum in BidPanel UI: "Min: $5"

### Task 4.2: Payment Tracking

**Files:**
- Modify: `v2/components/live/settlement-matrix.tsx`
- Modify: `v2/actions/tournament-results.ts` (add markPayment action)

**Step 1:** Add `payment_tracking` JSONB column to `auction_sessions`:
```sql
ALTER TABLE public.auction_sessions
  ADD COLUMN payment_tracking jsonb DEFAULT '{}';
```

**Step 2:** Add server action `markPayment(sessionId, participantId, paid: boolean)`:
- Updates `payment_tracking` JSONB
- Broadcasts `PAYMENT_UPDATED`

**Step 3:** Add checkmark toggles in settlement-matrix for commissioner:
- Each payment row gets a checkbox
- Checked = green checkmark + strikethrough

**Step 4:** Show payment progress: "3/5 payments settled"

### Task 4.3: Build + Test

**Step 1:** Run `npm run build`
**Step 2:** E2E test: create session with min bid → verify low bids rejected
**Step 3:** E2E test: complete auction → mark payments → verify tracking persists

---

## Execution Strategy

All 4 workstreams are independent. Run in parallel with separate subagents:

| Workstream | Agent | Priority | Dependencies |
|-----------|-------|----------|-------------|
| WS1: Tournament Mgmt | Agent A | CRITICAL | Supabase migration first |
| WS2: Live Chat | Agent B | HIGH | None |
| WS3: Props | Agent C | HIGH | WS1 migration (shares DB) |
| WS4: QoL | Agent D | MEDIUM | None |

After all agents complete:
1. Code review agent audits all changes
2. Full build verification
3. Full E2E test suite
4. Deploy to Vercel
