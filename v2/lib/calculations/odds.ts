import type { Team, RoundKey, TournamentConfig } from './types';

/** Check if americanOdds has any non-zero values */
function hasAnyAmericanOdds(ao: Record<string, number>): boolean {
  return Object.values(ao).some((v) => v !== 0);
}

/**
 * Convert American odds to implied probability.
 * Positive odds (underdog): 100 / (odds + 100)
 * Negative odds (favorite): |odds| / (|odds| + 100)
 */
export function americanOddsToImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

/**
 * Convert implied probability back to American odds.
 */
export function impliedProbabilityToAmericanOdds(probability: number): number {
  if (probability <= 0 || probability >= 1) {
    return 0;
  }
  if (probability < 0.5) {
    return Math.round(100 / probability - 100);
  } else {
    return Math.round((-1 * (probability * 100)) / (1 - probability));
  }
}

/**
 * Devig a group of teams for a specific round.
 * Normalizes raw implied probabilities by dividing by the overround (sum of all probs).
 * Optionally caps at a previous round's devigged probability.
 *
 * @param targetSum - What the devigged probabilities should sum to.
 *   For winner (1 winner): targetSum = 1.
 *   For golf makeCut (50 advance): targetSum = 50.
 *   For NCAA R32 matchups (1 of 2 advances): targetSum = 1.
 *   Defaults to 1 for backward compatibility with bracket devigging.
 */
function devigGroup(
  teams: Team[],
  round: RoundKey,
  capRound?: RoundKey,
  targetSum: number = 1
): void {
  const overround = teams.reduce(
    (sum, t) => sum + t.rawImpliedProbabilities[round],
    0
  );
  if (overround === 0) return;

  // Only normalize when overround > targetSum (i.e., there's actual vig to remove).
  // When overround ≤ targetSum (synthetic/estimated odds with no vig), use raw
  // probabilities as-is — scaling UP would create artificially inflated probabilities.
  const scale = overround > targetSum ? targetSum / overround : 1;

  for (const team of teams) {
    team.odds[round] = Math.min(1, team.rawImpliedProbabilities[round] * scale);
    if (capRound) {
      team.odds[round] = Math.min(team.odds[round], team.odds[capRound]);
    }
  }
}

/**
 * Bracket-aware devigging (NCAA-style).
 * Each round is devigged within the appropriate grouping level
 * as defined by the tournament's BracketDevigConfig.
 */
function devigBracket(teams: Team[], config: TournamentConfig): void {
  const bc = config.bracketDevigConfig!;
  const rounds = config.rounds;

  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    const capRound = i > 0 ? rounds[i - 1].key : undefined;
    const grouping = bc.roundGroupings[round.key];

    if (grouping === 'matchup') {
      for (const group of config.groups) {
        const groupTeams = teams.filter((t) => t.group === group.key);
        for (const [seedA, seedB] of bc.matchupPairs) {
          const matchup = groupTeams.filter(
            (t) => t.seed === seedA || t.seed === seedB
          );
          if (matchup.length >= 2) {
            devigGroup(matchup, round.key);
          }
        }
      }
    } else if (grouping === 'quadrant') {
      for (const group of config.groups) {
        const groupTeams = teams.filter((t) => t.group === group.key);
        for (const quadSeeds of bc.quadrants) {
          const quad = groupTeams.filter((t) => quadSeeds.includes(t.seed));
          devigGroup(quad, round.key, capRound);
        }
      }
    } else if (grouping === 'half') {
      for (const group of config.groups) {
        const groupTeams = teams.filter((t) => t.group === group.key);
        for (const halfSeeds of bc.halves) {
          const half = groupTeams.filter((t) => halfSeeds.includes(t.seed));
          devigGroup(half, round.key, capRound);
        }
      }
    } else if (grouping === 'region') {
      for (const group of config.groups) {
        const groupTeams = teams.filter((t) => t.group === group.key);
        devigGroup(groupTeams, round.key, capRound);
      }
    } else if (grouping === 'side') {
      const leftTeams = teams.filter((t) =>
        bc.bracketSides.left.includes(t.group)
      );
      const rightTeams = teams.filter((t) =>
        bc.bracketSides.right.includes(t.group)
      );
      devigGroup(leftTeams, round.key, capRound);
      devigGroup(rightTeams, round.key, capRound);
    } else if (grouping === 'global') {
      devigGroup(teams, round.key, capRound);
    }
  }
}

/**
 * Global devigging: normalize all teams for each round.
 * Simple strategy for tournaments without bracket structure (golf, NFL).
 *
 * Uses teamsAdvancing as the target probability sum for each round.
 * For golf: makeCut probabilities should sum to ~50 (50 players make the cut),
 * top20 should sum to ~20, etc. Winner sums to 1.
 */
function devigGlobal(teams: Team[], config: TournamentConfig): void {
  for (let i = 0; i < config.rounds.length; i++) {
    const round = config.rounds[i];
    const capRound = i > 0 ? config.rounds[i - 1].key : undefined;
    devigGroup(teams, round.key, capRound, round.teamsAdvancing);
  }
}

/**
 * Group-based devigging: normalize within groups per round.
 * Useful for World Cup group stage or similar structures.
 */
function devigByGroup(teams: Team[], config: TournamentConfig): void {
  for (let i = 0; i < config.rounds.length; i++) {
    const round = config.rounds[i];
    const capRound = i > 0 ? config.rounds[i - 1].key : undefined;
    for (const group of config.groups) {
      const groupTeams = teams.filter((t) => t.group === group.key);
      devigGroup(groupTeams, round.key, capRound);
    }
  }
}

/**
 * Dispatch to the correct devigging strategy based on tournament config.
 */
export function devigRoundOdds(teams: Team[], config: TournamentConfig): void {
  switch (config.devigStrategy) {
    case 'bracket':
      devigBracket(teams, config);
      break;
    case 'global':
      devigGlobal(teams, config);
      break;
    case 'group':
      devigByGroup(teams, config);
      break;
    case 'none':
      // Use raw probabilities as devigged odds
      for (const team of teams) {
        for (const round of config.rounds) {
          team.odds[round.key] = team.rawImpliedProbabilities[round.key];
        }
      }
      break;
  }
}

/**
 * Fill gaps in raw implied probabilities using fallback probabilities.
 *
 * When sportsbook odds are incomplete (some players missing odds for certain
 * markets), we use DataGolf/model probabilities as fallback. But since those
 * are already devigged (no vig), we need to "re-vig" them to match the
 * sportsbook data before devigging the full set together.
 *
 * For each round:
 * 1. Compute vig factor from players WITH sportsbook odds
 * 2. For players WITHOUT odds, use fallback probability × vig factor
 * 3. Now the full set can be devigged uniformly
 */
function fillOddsGaps(
  teams: Team[],
  roundKeys: string[],
  config: TournamentConfig
): void {
  for (let i = 0; i < roundKeys.length; i++) {
    const key = roundKeys[i];
    const round = config.rounds[i];
    if (!round) continue;

    const withOdds = teams.filter((t) => t.rawImpliedProbabilities[key] > 0);
    const missing = teams.filter((t) => t.rawImpliedProbabilities[key] === 0);

    if (missing.length === 0 || withOdds.length === 0) continue;

    // No team has a fallback probability for this round — nothing to fill
    if (!missing.some((t) => t.probabilities?.[key])) continue;

    // Vig factor: how much the sportsbook inflates probabilities above fair value.
    // Expected fair sum for the subset = targetSum × (subset size / field size)
    // Vig factor = actual raw sum / expected fair sum
    const rawSum = withOdds.reduce((s, t) => s + t.rawImpliedProbabilities[key], 0);
    const expectedFairSubset = round.teamsAdvancing * (withOdds.length / teams.length);
    const vigFactor = expectedFairSubset > 0 ? rawSum / expectedFairSubset : 1;

    for (const team of missing) {
      const fallback = team.probabilities?.[key] ?? 0;
      if (fallback > 0) {
        // Re-vig the fallback probability so it blends with sportsbook data
        team.rawImpliedProbabilities[key] = fallback * vigFactor;
      }
    }
  }
}

/**
 * Calculate implied probabilities for all teams.
 * 1. Converts American odds -> raw implied probabilities (includes vig)
 * 2. Fills gaps using fallback probabilities (re-vigged to match)
 * 3. Devigs by tournament structure -> fair probabilities
 *
 * Mutates teams in place and returns them.
 */
export function calculateImpliedProbabilities(
  teams: Team[],
  config: TournamentConfig
): Team[] {
  const roundKeys = config.rounds.map((r) => r.key);

  for (const team of teams) {
    const raw: Record<string, number> = {};
    const odds: Record<string, number> = {};

    if (team.probabilities && !hasAnyAmericanOdds(team.americanOdds)) {
      // Direct probabilities only (model-based data like Evan Miya, no vig to remove)
      for (const key of roundKeys) {
        raw[key] = team.probabilities[key] ?? 0;
        odds[key] = 0;
      }
    } else {
      // Convert American odds → implied probabilities (includes vig)
      const ao = team.americanOdds;
      for (const key of roundKeys) {
        raw[key] = americanOddsToImpliedProbability(ao[key] ?? 0);
        odds[key] = 0;
      }
    }

    team.rawImpliedProbabilities = raw;
    team.odds = odds;
  }

  // Fill gaps: players missing sportsbook odds for a round get their
  // fallback (model/DG) probability re-vigged to match the book data
  fillOddsGaps(teams, roundKeys, config);

  devigRoundOdds(teams, config);

  return teams;
}
