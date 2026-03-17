# Static Sportsbook Odds Sources Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the live Odds API integration with static sportsbook data (FanDuel, DraftKings, Pinnacle) that provides accurate per-round probabilities for all 68 teams, plus blend mode and custom odds editing.

**Architecture:** Three raw odds data files store American odds from screenshots. A devigging pipeline converts them to fair probabilities at init time using binary YES/NO, outright, regional, and matchup devig methods. The existing `SET_ODDS_SOURCE` reducer action swaps probabilities — zero changes to core calculation engine.

**Tech Stack:** TypeScript, Next.js (existing), no new dependencies

---

### Task 1: Create FanDuel Raw Odds Data File

**Files:**
- Create: `v2/lib/tournaments/data/fanduel-2026.ts`

**Step 1: Create the data file with raw American odds**

The file exports raw American odds organized by market type. Each team is keyed by internal team ID (from team-rankings-2026.ts mapping). Odds structure:

```typescript
export interface RawBinaryOdds { yes: number; no: number | null; }
export interface RawMatchupOdds { teamA: number; teamAId: number; teamB: number; teamBId: number; }

export const FANDUEL_2026 = {
  updatedAt: '2026-03-17T18:09:00Z',
  // S16: YES/NO binary pairs (devig with binary method)
  s16: Record<teamId, RawBinaryOdds>,
  // E8: YES/NO binary pairs
  e8: Record<teamId, RawBinaryOdds>,
  // F4: YES/NO binary pairs (some missing NO side)
  f4: Record<teamId, RawBinaryOdds>,
  // F2: YES only (outright devig)
  f2: Record<teamId, number>, // American odds
  // Champ: YES only (outright devig)
  champ: Record<teamId, number>,
  // R32: Matchup moneylines
  r32Matchups: RawMatchupOdds[],
};
```

All 68 teams × all available rounds from user's screenshots. See conversation for exact odds values.

**Step 2: Verify TypeScript compiles**
Run: `cd v2 && npx tsc --noEmit`

**Step 3: Commit**
```bash
git add v2/lib/tournaments/data/fanduel-2026.ts
git commit -m "feat: add FanDuel raw odds data (S16/E8/F4/F2/Champ + R64 matchups)"
```

---

### Task 2: Create DraftKings Raw Odds Data File

**Files:**
- Create: `v2/lib/tournaments/data/draftkings-2026.ts`

**Step 1: Create the data file**

DraftKings has all rounds in a single table format. Some values use fractional notation (e.g., "55-1" = +5500 American). Store all as American odds integers.

```typescript
export interface DKTeamOdds {
  champ: number;   // American odds
  f2: number;
  f4: number;
  e8: number;
  s16: number;
  r32: number;     // "Next Game" moneyline
}

export const DRAFTKINGS_2026 = {
  updatedAt: '2026-03-17T00:00:00Z',
  teams: Record<teamId, DKTeamOdds>,
};
```

68 teams × 6 rounds. Convert fractional "55-1" to +5500 American format.

**Step 2: Verify TypeScript compiles**
Run: `cd v2 && npx tsc --noEmit`

**Step 3: Commit**

---

### Task 3: Create Pinnacle Raw Odds Data File

**Files:**
- Create: `v2/lib/tournaments/data/pinnacle-2026.ts`

**Step 1: Create the data file**

Pinnacle has: champ (outright), F4 (regional winners × 4 regions), S16 (YES/NO ~28 teams), R64 matchup moneylines.

```typescript
export const PINNACLE_2026 = {
  updatedAt: '2026-03-17T00:00:00Z',
  champ: Record<teamId, number>,           // American odds
  // Regional winner = F4 probability, devig per-region
  f4Regions: {
    East: Record<teamId, number>,
    Midwest: Record<teamId, number>,
    South: Record<teamId, number>,
    West: Record<teamId, number>,
  },
  // S16: YES/NO binary (subset of teams)
  s16: Record<teamId, { yes: number; no: number }>,
  // R64 matchup moneylines
  r32Matchups: Array<{ teamAId: number; teamA: number; teamBId: number; teamB: number }>,
};
```

**Step 2: Verify TypeScript compiles**
**Step 3: Commit**

---

### Task 4: Build Unified Devigging Pipeline

**Files:**
- Create: `v2/lib/tournaments/devig-pipeline.ts`
- Modify: `v2/lib/odds-api/devig.ts` (add `americanToImplied` export)
- Test: `v2/lib/tournaments/__tests__/devig-pipeline.test.ts`

**Step 1: Write failing tests**

Test each devig method:
- `americanToImplied(+200)` → 0.3333
- `americanToImplied(-200)` → 0.6667
- `devigMatchup(teamA: -150, teamB: +130)` → [0.5952, 0.4048] (approx)
- `devigBinaryAmerican(yes: -700, no: +534)` → ~0.8740
- `devigOutrightAmerican([+350, +380, ...])` → probabilities summing to 1.0
- `devigRegionalAmerican({Duke: -121, UConn: +624, ...})` → regional probs sum to 1.0
- `estimateVigAndDevig(yesOdds, avgOverround)` → reasonable fair prob

**Step 2: Implement the pipeline**

```typescript
export function americanToImplied(odds: number): number
export function devigMatchup(oddsA: number, oddsB: number): [number, number]
export function devigBinaryAmerican(yes: number, no: number): number
export function devigOutrightAmerican(odds: Record<number, number>): Record<number, number>
export function devigRegionalAmerican(odds: Record<number, number>): Record<number, number>
// For YES-only markets: estimate vig from markets that have both sides
export function estimateAvgOverround(binaryMarkets: Array<{yes: number; no: number}>): number
export function devigYesOnly(yesOdds: number, avgOverround: number): number
```

Main entry point:
```typescript
export function buildFanDuelProbabilities(): OddsSourceProbabilities
export function buildDraftKingsProbabilities(): OddsSourceProbabilities
export function buildPinnacleProbabilities(): OddsSourceProbabilities
```

Each builder:
1. Devig each round using the appropriate method
2. Fill missing rounds from Evan Miya using model ratio interpolation
3. Enforce monotonic decrease across rounds
4. Return `OddsSourceProbabilities` format

**Step 3: Run tests**
Run: `cd v2 && npx vitest run lib/tournaments/__tests__/devig-pipeline`

**Step 4: Commit**

---

### Task 5: Update Odds Source Registry

**Files:**
- Modify: `v2/lib/tournaments/odds-sources.ts`

**Step 1: Update `buildMarchMadness2026Registry()`**

- Import `buildFanDuelProbabilities`, `buildDraftKingsProbabilities`, `buildPinnacleProbabilities` from devig-pipeline
- Add FanDuel, DraftKings, Pinnacle as static sources (type: 'sportsbook', isRemote: false)
- Remove the old remote sportsbook source
- Keep blend source
- Add custom source type

```typescript
sources: [
  { id: 'evan_miya', name: 'Evan Miya', description: 'Statistical model (3/17)', type: 'model', isRemote: false },
  { id: 'team_rankings', name: 'TeamRankings', description: 'Composite model (3/17)', type: 'model', isRemote: false },
  { id: 'fanduel', name: 'FanDuel', description: 'Sportsbook (3/17)', type: 'sportsbook', isRemote: false },
  { id: 'draftkings', name: 'DraftKings', description: 'Sportsbook (3/17)', type: 'sportsbook', isRemote: false },
  { id: 'pinnacle', name: 'Pinnacle', description: 'Sharp sportsbook (3/17)', type: 'sportsbook', isRemote: false },
  { id: 'blend', name: 'Blend', description: 'Custom weighted blend', type: 'blend', isRemote: false },
  { id: 'custom', name: 'Custom', description: 'Your own probabilities', type: 'custom', isRemote: false },
],
staticData: {
  evan_miya: buildEvanMiyaData(),
  team_rankings: TEAM_RANKINGS_2026,
  fanduel: buildFanDuelProbabilities(),
  draftkings: buildDraftKingsProbabilities(),
  pinnacle: buildPinnacleProbabilities(),
},
```

**Step 2: Verify TypeScript compiles**
**Step 3: Commit**

---

### Task 6: Update Odds Source Selector UI

**Files:**
- Modify: `v2/components/auction/odds-source-selector.tsx`

**Step 1: Simplify — all sources are now static**

- Remove `fetchSportsbooks()`, `remoteData`, `sportsbooks` state, loading/error for remote
- Remove sportsbook sub-selector (no bookmaker dropdown needed — each is its own source)
- All sources use `handleStaticSource()` — no special sportsbook handler
- Keep blend panel with sliders for all 5 data sources (Evan Miya, TeamRankings, FanDuel, DK, Pinnacle)
- Add "Custom" button that opens a custom odds editor (Task 7)
- Clean icon assignments: BarChart3 for models, Globe for sportsbooks, Sliders for blend, Pencil for custom

**Step 2: Verify in browser (visual check)**
**Step 3: Commit**

---

### Task 7: Add Custom Odds Editing

**Files:**
- Create: `v2/components/auction/custom-odds-editor.tsx`
- Modify: `v2/components/auction/odds-source-selector.tsx` (add custom toggle)

**Step 1: Build a simple per-team probability override UI**

When "Custom" is selected, show a compact editor below the source selector:
- Start from whichever source was previously active (copy its probabilities as baseline)
- Searchable team list with inline number inputs for each round probability (0-100%)
- "Apply" button dispatches SET_ODDS_SOURCE with the custom probabilities
- Store custom edits in local state (not persisted to DB — session only)

**Step 2: Wire into odds-source-selector**
**Step 3: Commit**

---

### Task 8: Remove Live Odds API Route

**Files:**
- Delete: `v2/app/api/odds/ncaab/route.ts`
- Delete: `v2/lib/odds-api/client.ts`
- Keep: `v2/lib/odds-api/devig.ts` (still used by pipeline)
- Keep: `v2/lib/odds-api/team-mapping.ts` (still used for name resolution)

**Step 1: Delete files**
**Step 2: Verify build**
Run: `cd v2 && npm run build`
**Step 3: Commit**

---

### Task 9: Cross-Source Odds Validation

**Files:**
- Create: `v2/lib/tournaments/__tests__/odds-validation.test.ts`

**Step 1: Write validation tests**

For each of the top 20 teams (seeds 1-5), verify:
1. All 5 sources agree within reasonable bounds:
   - R32: within 10 percentage points
   - S16: within 15 percentage points
   - E8: within 15 percentage points
   - F4: within 10 percentage points
   - F2: within 10 percentage points
   - Champ: within 5 percentage points
2. Monotonic decrease: each round ≤ previous round for all teams, all sources
3. Sum check: champ probabilities across all 68 teams sum to ~1.0 (within 0.01)
4. No team has 0% for R32 through E8 unless they're a 16-seed

**Step 2: Print a comparison table for manual review**

Log a formatted table showing top 20 teams × 5 sources for each round. Flag any outlier cells (>2 standard deviations from mean across sources).

**Step 3: Run and review**
Run: `cd v2 && npx vitest run lib/tournaments/__tests__/odds-validation`

**Step 4: Fix any flagged outliers (likely team mapping issues)**
**Step 5: Commit**

---

### Task 10: Final Build & Test

**Step 1: Run full test suite**
Run: `cd v2 && npm test`

**Step 2: Run production build**
Run: `cd v2 && npm run build`

**Step 3: Commit any fixes**

---

## Team ID Reference (from team-rankings-2026.ts)

| ID | Team | Seed | Region |
|----|------|------|--------|
| 1 | Duke | 1 | East |
| 17 | Arizona | 1 | West |
| 51 | Michigan | 1 | Midwest |
| 34 | Florida | 1 | South |
| 49 | Houston | 2 | South |
| 67 | Iowa State | 2 | Midwest |
| 32 | Purdue | 2 | West |
| 45 | Illinois | 3 | South |
| 15 | Connecticut | 2 | East |
| 28 | Gonzaga | 3 | West |
| 5 | St. John's | 5 | East |
| 23 | Arkansas | 4 | West |
| 39 | Vanderbilt | 5 | South (Midwest in bracket) |
| 11 | Michigan State | 3 | East (Midwest?) |
| 21 | Wisconsin | 5 | West |
| 63 | Virginia | 3 | Midwest |
| 60 | Tennessee | 6 | Midwest |
| 9 | Louisville | 6 | South |
| 58 | Alabama | 4 | Midwest |
| 13 | UCLA | 7 | West |
| 7 | Kansas | 4 | East |
| 56 | Texas Tech | 5 | Midwest |
| 65 | Kentucky | 7 | South |
| 3 | Ohio State | 8 | East |
| 25 | BYU | 6 | West |
| 41 | Nebraska | 4 | South |
| 54 | Georgia | 8 | South |
| 38 | Iowa | 9 | West (South?) |
| 47 | Saint Mary's | 7 | South |
| 43 | North Carolina | 6 | South |
| 4 | TCU | 9 | East |
| 31 | Missouri | 10 | West |
| 37 | Clemson | 8 | West (South?) |
| 20 | Utah State | 9 | West |
| 30 | Miami (Fla.) | 7 | West |
| 66 | Santa Clara | 10 | South |
| 10 | South Florida | 11 | South |
| 26 | Texas | 11 | South? |
| 19 | Villanova | 8 | West |
| 44 | VCU | 11 | South |
| 48 | Texas A&M | 10 | South |
| 6 | Northern Iowa | 12 | East |
| 55 | Saint Louis | 9 | South |
| 61 | SMU | 11 | Midwest |
| 27 | NC State | 11 | West |
| 18 | Long Island | 16 | West |
| 68 | Tennessee State | 15 | Midwest |
| 24 | Hawaii | 13 | West |
| 22 | High Point | 12 | West |
| 33 | Queens | 15 | West |
| 12 | North Dakota State | 14 | Midwest (East?) |
| 8 | California Baptist | 13 | East |
| 29 | Kennesaw State | 14 | West |
| 40 | McNeese | 12 | South (Midwest?) |
| 46 | Penn | 14 | South |
| 64 | Wright State | 14 | Midwest |
| 2 | Siena | 16 | East |
| 50 | Idaho | 15 | South |
| 59 | Hofstra | 13 | Midwest |
| 16 | Furman | 15 | East |
| 14 | UCF | 10 | West |
| 42 | Troy | 13 | South |
| 57 | Akron | 12 | Midwest |
| 35 | Prairie View | 16 | South |
| 52 | UMBC | 16 | Midwest |
| 53 | Howard | 16 | Midwest |
| 36 | Lehigh | 16 | South |
| 62 | Miami (OH) | 11 | Midwest |

**NOTE:** Region assignments above are approximate — verify against `march-madness-2026.ts` config `group` field when building regional data.
