import type { SoldTeam } from './use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import type { PropResult } from '@/lib/tournaments/props';
import { getPropWinners } from '@/lib/tournaments/props';

// ─── Types ────────────────────────────────────────────────────────

export interface TeamResult {
  teamId: number;
  teamName: string;
  seed: number;
  group: string;
  purchasePrice: number;
  ownerId: string;
  ownerName: string;
  status: 'alive' | 'eliminated' | 'champion';
  roundsWon: string[];
  eliminatedInRound: string | null;
  earnings: number;
}

export interface PropEarning {
  propKey: string;
  propLabel: string;
  amount: number;
}

export interface LeaderboardEntry {
  participantId: string;
  participantName: string;
  totalSpent: number;
  totalEarned: number;
  netPL: number;
  teamsOwned: number;
  teamsAlive: number;
  teamsEliminated: number;
  teams: TeamResult[];
  propEarnings: PropEarning[];
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  actualPot: number;
  completedRounds: string[];
  currentRound: string | null;
  isTournamentComplete: boolean;
}

// ─── Play-In Loser Detection ────────────────────────────────────

/**
 * Build a set of team IDs that lost their play-in game.
 * Play-in pairs share the same seed+group. If one team in a pair has a 'won'
 * result for the first round, the other team lost the play-in and is eliminated.
 * This handles the case where ESPN sync skips First Four games.
 */
export function buildPlayInLoserSet(
  allTeams: BaseTeam[],
  results: TournamentResult[],
  config: TournamentConfig
): Set<number> {
  const losers = new Set<number>();
  const firstRound = config.rounds[0]?.key;
  if (!firstRound) return losers;

  const resultMap = buildResultMap(results);

  // Group teams by seed+group to find play-in pairs
  const byKey = new Map<string, BaseTeam[]>();
  for (const team of allTeams) {
    const key = `${team.group}-${team.seed}`;
    const arr = byKey.get(key);
    if (arr) arr.push(team);
    else byKey.set(key, [team]);
  }

  for (const [, pairTeams] of byKey) {
    if (pairTeams.length < 2) continue;
    // If any team in the pair has ANY result for round 1 (won or lost in R64),
    // it means they survived the play-in — all others are play-in losers.
    const survivorExists = pairTeams.some(
      (t) => resultMap.has(`${t.id}:${firstRound}`)
    );
    if (survivorExists) {
      for (const t of pairTeams) {
        if (!resultMap.has(`${t.id}:${firstRound}`)) {
          losers.add(t.id);
        }
      }
    }
  }

  return losers;
}

// ─── Pure Calculation Functions ───────────────────────────────────

/**
 * Get team IDs that are "alive" entering a given round.
 * A team is alive if it has won all previous rounds (or there are no previous rounds).
 *
 * `playInLosers` (optional): teams knocked out in a game the feed never records —
 * March Madness First Four losers, whose elimination is inferred from their
 * partner's first-round row (`buildPlayInLoserSet`). They are alive for NOTHING,
 * including the first round: ESPN skips First Four games (`lib/espn/scoreboard.ts`),
 * so they can never be resolved and would otherwise sit "alive but unresolved"
 * forever, permanently blocking `getCompletedRounds`. Omitting the argument
 * reproduces the previous behavior exactly.
 */
export function getAliveTeamsForRound(
  soldTeamIds: number[],
  results: TournamentResult[],
  config: TournamentConfig,
  roundKey: string,
  playInLosers?: Set<number>
): number[] {
  const roundIndex = config.rounds.findIndex((r) => r.key === roundKey);
  if (roundIndex < 0) return [];

  const eligible = playInLosers?.size
    ? soldTeamIds.filter((id) => !playInLosers.has(id))
    : soldTeamIds;

  // Parallel/bonus rounds (e.g. soccer "win group") are over the whole field —
  // every sold team is eligible, independent of the advancement ladder.
  if (config.rounds[roundIndex].parallel) return [...eligible];

  // For the first round, all sold teams are alive
  if (roundIndex === 0) return [...eligible];

  // For subsequent rounds, a team must have won ALL previous LADDER rounds.
  // Parallel rounds do NOT gate advancement, so they're excluded here.
  const previousRounds = config.rounds
    .slice(0, roundIndex)
    .filter((r) => !r.parallel)
    .map((r) => r.key);
  const resultMap = buildResultMap(results);

  return eligible.filter((teamId) => {
    return previousRounds.every((prevRound) => {
      const result = resultMap.get(`${teamId}:${prevRound}`);
      return result === 'won';
    });
  });
}

/**
 * Determine the status of a single team based on results.
 * Pass playInLosers to correctly mark teams that lost their play-in game
 * (whose results aren't tracked directly — inferred from partner's success).
 */
export function getTeamStatus(
  teamId: number,
  results: TournamentResult[],
  config: TournamentConfig,
  playInLosers?: Set<number>
): {
  status: 'alive' | 'eliminated' | 'champion';
  roundsWon: string[];
  eliminatedInRound: string | null;
  roundCounts: Record<string, number>;
} {
  // Play-in losers are eliminated in the first round even without explicit results
  if (playInLosers?.has(teamId)) {
    return {
      status: 'eliminated',
      roundsWon: [],
      eliminatedInRound: config.rounds[0]?.key ?? null,
      roundCounts: {},
    };
  }

  const resultMap = buildResultMap(results);
  const countMap = buildCountMap(results);
  const roundsWon: string[] = [];
  const roundCounts: Record<string, number> = {};
  let eliminatedInRound: string | null = null;

  // Credit a round as won and record its unit count (defaulting to 1 — a
  // team with no result_count won the round outright, not a fraction of it).
  const credit = (key: string) => {
    roundsWon.push(key);
    roundCounts[key] = countMap.get(`${teamId}:${key}`) ?? 1;
  };

  for (const round of config.rounds) {
    const result = resultMap.get(`${teamId}:${round.key}`);
    if (round.parallel) {
      // Parallel bonus (e.g. winGroup): credit if won, but never eliminate or
      // halt the ladder walk on a loss/pending.
      if (result === 'won') credit(round.key);
      continue;
    }
    if (result === 'won') {
      credit(round.key);
    } else if (result === 'lost') {
      eliminatedInRound = round.key;
      break;
    } else {
      // No result yet — team is alive (pending or no entry)
      break;
    }
  }

  const lastRound = config.rounds[config.rounds.length - 1];
  const isChampion = roundsWon.includes(lastRound.key);

  return {
    status: isChampion ? 'champion' : eliminatedInRound ? 'eliminated' : 'alive',
    roundsWon,
    eliminatedInRound,
    roundCounts,
  };
}

/**
 * Calculate actual earnings for a team based on results entered so far.
 * Each round the team won earns: actualPot * (payoutRules[roundKey] / 100)
 *
 * `roundCounts` is optional and only matters for flat-rate per-unit rounds
 * (e.g. NFL regular-season wins, where the round pays once per win rather
 * than once for the round). Omitting it — golf and World Cup both call this
 * without a 4th argument — defaults every round to 1 unit, reproducing the
 * exact pre-existing behavior.
 */
export function calculateTeamEarnings(
  roundsWon: string[],
  actualPot: number,
  payoutRules: PayoutRules,
  roundCounts?: Record<string, number>
): number {
  return roundsWon.reduce((total, roundKey) => {
    const pct = payoutRules[roundKey] ?? 0;
    const units = roundCounts?.[roundKey] ?? 1;
    return total + actualPot * (pct / 100) * units;
  }, 0);
}

/**
 * Which rounds are fully completed (all alive teams have a result)?
 *
 * This gates `adjustPayoutRulesForTies`, so under-reporting completion is not
 * cosmetic — it silently switches OFF pot conservation, and a tier with fewer
 * sold winners than slots stops being scaled up to its full budget.
 *
 * Two ways a SOLD team can be alive-but-unresolvable, either of which used to
 * jam the very first round and therefore the whole ladder, forever:
 *
 *  1. Play-in losers (March Madness First Four — ESPN skips those games). Pass
 *     `playInLosers` from `buildPlayInLoserSet` and they drop out of the alive
 *     set. Every caller has it in scope.
 *
 *  2. A team the feed simply never grades: the golf sync writes rows only for
 *     players it can name-match (it reports the rest as `unmatched`), and a
 *     withdrawal before round 1 may never appear in the leaderboard at all.
 *     Nothing about the results identifies these — the row is absent exactly
 *     like a not-yet-played game's would be. So we do NOT guess from absence;
 *     we look for positive downstream evidence instead: if a LATER ladder round
 *     is itself fully resolved, the earlier rung must have finished (you cannot
 *     grade the Elite 8 before the Sweet 16 is played). That inference cannot
 *     fire mid-round — a partially-decided round leaves nothing later resolved —
 *     so the f172400 guard this branch added still holds. It restores the
 *     pre-branch behavior for a finished tournament without reopening the
 *     mid-round double-count.
 */
export function getCompletedRounds(
  soldTeamIds: number[],
  results: TournamentResult[],
  config: TournamentConfig,
  playInLosers?: Set<number>
): string[] {
  const completed: string[] = [];
  const resultMap = buildResultMap(results);

  const isResolved = (teamId: number, roundKey: string) => {
    const result = resultMap.get(`${teamId}:${roundKey}`);
    return result === 'won' || result === 'lost';
  };
  const fullyResolved = (roundKey: string) => {
    const alive = getAliveTeamsForRound(soldTeamIds, results, config, roundKey, playInLosers);
    return alive.length > 0 && alive.every((teamId) => isResolved(teamId, roundKey));
  };

  for (let i = 0; i < config.rounds.length; i++) {
    const round = config.rounds[i];

    if (round.parallel) {
      // Parallel/bonus round: completion is independent and NEVER blocks the
      // ladder. Mark it completed if every eligible team is resolved, then carry on.
      // Deliberately NOT eligible for the downstream-evidence rule below: a parallel
      // bonus is not a rung, so a graded ladder round proves nothing about it, and
      // over-crediting a half-decided one is the exact bug this branch fixed.
      if (fullyResolved(round.key)) completed.push(round.key);
      continue;
    }

    const aliveTeams = getAliveTeamsForRound(soldTeamIds, results, config, round.key, playInLosers);
    if (aliveTeams.length === 0) break;

    if (aliveTeams.every((teamId) => isResolved(teamId, round.key))) {
      completed.push(round.key);
      continue;
    }

    // Unresolved — but a fully-resolved later rung proves this one finished.
    const provenByLaterRound = config.rounds
      .slice(i + 1)
      .some((later) => !later.parallel && fullyResolved(later.key));
    if (provenByLaterRound) {
      completed.push(round.key);
      continue;
    }

    break; // Ladder rounds must complete sequentially
  }

  return completed;
}

/**
 * Get the current round (first round that doesn't have all results yet).
 */
export function getCurrentRound(
  soldTeamIds: number[],
  results: TournamentResult[],
  config: TournamentConfig,
  playInLosers?: Set<number>
): string | null {
  const completed = getCompletedRounds(soldTeamIds, results, config, playInLosers);
  const nextRoundIndex = completed.length;
  if (nextRoundIndex >= config.rounds.length) return null; // Tournament complete
  return config.rounds[nextRoundIndex].key;
}

/**
 * Build the full leaderboard from auction results + tournament results.
 * This is the main calculation engine for the tournament lifecycle.
 */
export function calculateLeaderboard(
  soldTeams: SoldTeam[],
  baseTeams: BaseTeam[],
  results: TournamentResult[],
  config: TournamentConfig,
  payoutRules: PayoutRules,
  propResults: PropResult[] = []
): LeaderboardData {
  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const actualPot = soldTeams.reduce((sum, t) => sum + t.amount, 0);
  const soldTeamIds = soldTeams.map((t) => t.teamId);

  // Pre-compute play-in losers so they show as eliminated, not alive — and so
  // round completion below ignores them. They never get a first-round row, and
  // waiting for one froze `completedRounds` at [] for every March Madness league.
  const playInLosers = buildPlayInLoserSet(baseTeams, results, config);

  const completedRounds = getCompletedRounds(soldTeamIds, results, config, playInLosers);
  const currentRound = getCurrentRound(soldTeamIds, results, config, playInLosers);
  const isTournamentComplete = completedRounds.length === config.rounds.length;

  // Precompute all team statuses + count winners per round for tie adjustment
  const teamStatusCache = new Map<
    number,
    { status: 'alive' | 'eliminated' | 'champion'; roundsWon: string[]; eliminatedInRound: string | null; roundCounts: Record<string, number> }
  >();
  const winnersPerRound = countWinnersPerRound(soldTeams, results, config, playInLosers);
  for (const sold of soldTeams) {
    teamStatusCache.set(sold.teamId, getTeamStatus(sold.teamId, results, config, playInLosers));
  }

  // Adjust payout rules when ties cause more winners than teamsAdvancing — but only
  // for COMPLETED rounds. Mid-round, redistributing a tier's whole budget among its
  // few already-decided winners double-counts the pot alongside the pending slots
  // (the soccer R16 over-credit bug, f172400).
  const adjustedPayoutRules = adjustPayoutRulesForTies(
    payoutRules,
    winnersPerRound,
    config,
    new Set(completedRounds)
  );

  // Build per-participant data
  const byParticipant = new Map<string, { name: string; teams: SoldTeam[] }>();
  for (const sold of soldTeams) {
    if (!byParticipant.has(sold.winnerId)) {
      byParticipant.set(sold.winnerId, { name: sold.winnerName, teams: [] });
    }
    byParticipant.get(sold.winnerId)!.teams.push(sold);
  }

  const entries: LeaderboardEntry[] = [];

  for (const [participantId, { name, teams }] of byParticipant) {
    const totalSpent = teams.reduce((sum, t) => sum + t.amount, 0);
    let totalEarned = 0;
    let teamsAlive = 0;
    let teamsEliminated = 0;
    const teamResults: TeamResult[] = [];

    for (const sold of teams) {
      const base = teamMap.get(sold.teamId);
      const { status, roundsWon, eliminatedInRound, roundCounts } = teamStatusCache.get(sold.teamId)!;
      const earnings = calculateTeamEarnings(roundsWon, actualPot, adjustedPayoutRules, roundCounts);
      totalEarned += earnings;

      if (status === 'alive' || status === 'champion') teamsAlive++;
      if (status === 'eliminated') teamsEliminated++;

      teamResults.push({
        teamId: sold.teamId,
        teamName: base?.name ?? `Team ${sold.teamId}`,
        seed: base?.seed ?? 0,
        group: base?.group ?? '',
        purchasePrice: sold.amount,
        ownerId: sold.winnerId,
        ownerName: sold.winnerName,
        status,
        roundsWon,
        eliminatedInRound,
        earnings,
      });
    }

    // Add prop bet earnings for this participant (split among co-winners for ties)
    // A participant may own multiple winning teams — count all their winning slots
    const participantPropEarnings: PropEarning[] = [];
    for (const pr of propResults) {
      const winners = getPropWinners(pr);
      const myWins = winners.filter((w) => w.participantId === participantId).length;
      if (myWins > 0) {
        const fullPayout = actualPot * (pr.payoutPercentage / 100);
        const propPayout = (fullPayout / winners.length) * myWins;
        participantPropEarnings.push({
          propKey: pr.key,
          propLabel: pr.label,
          amount: propPayout,
        });
        totalEarned += propPayout;
      }
    }

    entries.push({
      participantId,
      participantName: name,
      totalSpent,
      totalEarned,
      netPL: totalEarned - totalSpent,
      teamsOwned: teams.length,
      teamsAlive,
      teamsEliminated,
      teams: teamResults.sort((a, b) => a.seed - b.seed),
      propEarnings: participantPropEarnings,
    });
  }

  // Sort by net P&L descending
  entries.sort((a, b) => b.netPL - a.netPL);

  return {
    entries,
    actualPot,
    completedRounds,
    currentRound,
    isTournamentComplete,
  };
}

// ─── Tie Adjustment ─────────────────────────────────────────────

/**
 * Adjust payout percentages so each tier's full budget is distributed
 * among the actual number of sold-team winners.
 *
 * The total budget per tier is `pct * teamsAdvancing`. Regardless of
 * whether more or fewer teams won than expected, split that budget:
 *   adjustedPct = (pct * teamsAdvancing) / actualWinners
 *
 * This ensures POT === DISTRIBUTED when all tiers have at least one winner.
 * For unsettled rounds (no winners yet), pct stays unchanged.
 *
 * `onlyRounds` (optional): restrict redistribution to these round keys — pass the
 * COMPLETED rounds for a live/in-progress view. This matters for elimination ladders
 * (soccer): mid-round, redistributing a tier's whole budget among the handful of
 * already-decided winners massively over-credits them (a single R32 winner would get
 * the entire 16-slot R16 budget), while the still-pending slots are ALSO covered by
 * the projection — double-counting the pot. Gating on completion settles decided
 * winners at the base per-slot rate and leaves pending slots to the projection.
 * Omitted (golf final settlement) → adjust every round, preserving existing behavior.
 *
 * `round.flatRate` rounds (e.g. NFL wins) are skipped entirely: their rate is a
 * fixed per-unit price set by the host, not a tier budget to redistribute — treating
 * it as one would multiply every team's payout by (expected winners / actual winners)
 * on top of the per-unit multiplication already done in calculateTeamEarnings.
 * For non-flat rounds with `payoutUnits` set, that count (not `teamsAdvancing`) is
 * the expected budget denominator — see Task 1's RoundConfig for why the two differ.
 */
export function adjustPayoutRulesForTies(
  payoutRules: PayoutRules,
  winnersPerRound: Map<string, number>,
  config: TournamentConfig,
  onlyRounds?: Set<string>
): PayoutRules {
  const adjusted = { ...payoutRules };
  for (const round of config.rounds) {
    // A flat per-unit rate is fixed — it is not a tier budget split among
    // whoever qualified, so redistributing it would inflate every payout.
    if (round.flatRate) continue;
    if (onlyRounds && !onlyRounds.has(round.key)) continue;
    const actualWinners = winnersPerRound.get(round.key) ?? 0;
    const expected = round.payoutUnits ?? round.teamsAdvancing;
    if (actualWinners > 0 && expected > 0) {
      const pct = payoutRules[round.key] ?? 0;
      adjusted[round.key] = (pct * expected) / actualWinners;
    }
  }
  return adjusted;
}

/**
 * Count how many sold teams won each round. Used by adjustPayoutRulesForTies.
 */
export function countWinnersPerRound(
  soldTeams: SoldTeam[],
  results: TournamentResult[],
  config: TournamentConfig,
  playInLosers?: Set<number>
): Map<string, number> {
  const winners = new Map<string, number>();
  for (const sold of soldTeams) {
    const { roundsWon } = getTeamStatus(sold.teamId, results, config, playInLosers);
    for (const rk of roundsWon) {
      winners.set(rk, (winners.get(rk) ?? 0) + 1);
    }
  }
  return winners;
}

// ─── Helpers ──────────────────────────────────────────────────────

function buildResultMap(results: TournamentResult[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of results) {
    map.set(`${r.team_id}:${r.round_key}`, r.result);
  }
  return map;
}

/**
 * Map team:round -> result_count, for rounds that pay per unit (e.g. NFL
 * regular-season wins). Only populated when a row actually has a count —
 * golf/World Cup rows never set result_count, so this map stays empty for them
 * and getTeamStatus's `?? 1` default reproduces the old one-per-round behavior.
 */
function buildCountMap(results: TournamentResult[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of results) {
    if (r.result_count !== undefined && r.result_count !== null) {
      map.set(`${r.team_id}:${r.round_key}`, Number(r.result_count));
    }
  }
  return map;
}
