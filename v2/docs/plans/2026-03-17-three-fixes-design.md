# Three Live Auction Fixes — Design Doc
**Date**: 2026-03-17

## Fix 1: Auto-mode stuck on first team
- **Root cause**: Race condition or missing trigger when startAuction() sets waiting → autoOpenBidding()
- **Fix**: Verify flow, potentially skip intermediate 'waiting' state when autoMode is on
- **Scope**: `v2/actions/bidding.ts`, `v2/components/live/commissioner-view.tsx`

## Fix 2: Odds source selector in live auction strategy overlay
- **Design**: Compact dropdown in strategy-overlay.tsx, local state only
- **Sources**: 7 (Evan Miya, TeamRankings, FanDuel, DraftKings, Pinnacle, Blend, Custom)
- **Data flow**: Page loads registry → passes to participant-view → strategy-overlay
- **State**: useState local, no DB/broadcast changes
- **Scope**: `v2/app/(protected)/live/[sessionId]/page.tsx`, `v2/components/live/participant-view.tsx`, `v2/components/live/strategy-overlay.tsx`, `v2/lib/tournaments/odds-sources.ts`

## Fix 3: Customizable suggested bid percentage
- **Design**: Slider 50-100% in strategy overlay, default 95%, localStorage persistence
- **Calculation**: fairValue × (pct / 100)
- **Display**: New metric in strategy overlay grid, amber/gold color
- **Scope**: `v2/components/live/strategy-overlay.tsx`
