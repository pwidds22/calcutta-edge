import type { Team, RoundKey, TournamentConfig } from './types';

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
 */
function devigGroup(
  teams: Team[],
  round: RoundKey,
  capRound?: RoundKey
): void {
  const overround = teams.reduce(
    (sum, t) => sum + t.rawImpliedProbabilities[round],
    0
  );
  if (overround === 0) return;

  for (const team of teams) {
    team.odds[round] = team.rawImpliedProbabilities[round] / overround;
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
 */
function devigGlobal(teams: Team[], config: TournamentConfig): void {
  for (let i = 0; i < config.rounds.length; i++) {
    const round = config.rounds[i];
    const capRound = i > 0 ? config.rounds[i - 1].key : undefined;
    devigGroup(teams, round.key, capRound);
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
 * Calculate implied probabilities for all teams.
 * 1. Converts American odds -> raw implied probabilities (includes vig)
 * 2. Devigs by tournament structure -> fair probabilities
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

    if (team.probabilities) {
      // Direct probabilities provided (model-based data, no vig to remove)
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

  devigRoundOdds(teams, config);

  return teams;
}
