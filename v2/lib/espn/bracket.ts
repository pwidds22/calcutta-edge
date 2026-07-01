/**
 * Knockout bracket model — pure derivation from ESPN scoreboard matches.
 *
 * ESPN publishes the ENTIRE knockout schedule up front, with placeholder
 * pseudo-teams for undetermined slots whose names encode the bracket linkage
 * ("Round of 32 11 Winner", "Semifinal 1 Loser"). Match numbering within a
 * round is chronological by kickoff (= FIFA numbering — verified live against
 * the 2026 feed by winner containment on all eight decided R16 slots).
 * Pairings are NOT chronologically adjacent (R16 pairs R32 winners
 * (1,4),(3,6),(2,5),(7,8),(11,12),(9,10),(14,16),(13,15)), so linkage — not
 * adjacency — drives both structure and visual order.
 *
 * Feeder resolution per slot, in trust order (self-healing):
 *   (a) winner containment — a real teamId in a slot IS the winner of exactly
 *       one previous-round match; immune to renumbering/reschedules.
 *   (b) placeholder text parse — for undecided slots.
 *   (c) hardcoded FIFA-2026 fallback map — only if ESPN changes its wording.
 * All three failing degrades to a null feeder; buildBracket never throws.
 */

import type { SoccerMatch } from './soccer';

export type KnockoutStage =
  | 'round-of-32'
  | 'round-of-16'
  | 'quarterfinals'
  | 'semifinals'
  | 'final';

const STAGE_ORDER: KnockoutStage[] = [
  'round-of-32',
  'round-of-16',
  'quarterfinals',
  'semifinals',
  'final',
];

const STAGE_LABELS: Record<KnockoutStage, string> = {
  'round-of-32': 'Round of 32',
  'round-of-16': 'Round of 16',
  quarterfinals: 'Quarterfinals',
  semifinals: 'Semifinals',
  final: 'Final',
};

/** ESPN placeholder names name the FEEDING stage: "Round of 32 11 Winner",
 *  "Round of 16 3 Winner", "Quarterfinal 1 Winner", "Semifinal 1 Loser". */
const PLACEHOLDER_RE = /^(round of 32|round of 16|quarterfinals?|semifinals?)\s+(\d+)\s+(winner|loser)$/i;

const PLACEHOLDER_STAGE: Record<string, KnockoutStage> = {
  'round of 32': 'round-of-32',
  'round of 16': 'round-of-16',
  quarterfinal: 'quarterfinals',
  quarterfinals: 'quarterfinals',
  semifinal: 'semifinals',
  semifinals: 'semifinals',
};

/** Last-resort FIFA-2026 feeder map (chronological match numbers), captured
 *  from the live ESPN feed 2026-07-01. Used only when containment AND the
 *  placeholder parse both fail (e.g. ESPN rewords its placeholders). */
const FIFA_2026_FEEDERS: Partial<Record<KnockoutStage, Record<number, [number, number]>>> = {
  'round-of-16': { 1: [1, 4], 2: [3, 6], 3: [2, 5], 4: [7, 8], 5: [11, 12], 6: [9, 10], 7: [14, 16], 8: [13, 15] },
  quarterfinals: { 1: [1, 2], 2: [5, 6], 3: [3, 4], 4: [7, 8] },
  semifinals: { 1: [1, 2], 2: [3, 4] },
  final: { 1: [1, 2] },
};

export interface BracketSlot {
  teamId: number | null; // config team id; null for placeholder/unresolved
  name: string; // real team name; '' when placeholder (render "TBD")
  isPlaceholder: boolean;
  score: number | null;
  isWinner: boolean; // from winnerTeamId only (shootout-safe)
}

export interface BracketMatch {
  id: string; // `${stage}-${matchNumber}`
  stage: KnockoutStage | '3rd-place-match';
  matchNumber: number; // 1-based chronological within its stage
  date: string;
  status: SoccerMatch['status'];
  wentToPens: boolean;
  home: BracketSlot;
  away: BracketSlot;
  /** matchNumbers in the PREVIOUS stage feeding [home, away]; null = unknown */
  feeders: [number | null, number | null];
}

export interface BracketRound {
  stage: KnockoutStage;
  label: string;
  matches: BracketMatch[]; // in VISUAL top-to-bottom order
}

export interface BracketModel {
  rounds: BracketRound[]; // R32 → Final, only stages present in the feed
  thirdPlace: BracketMatch | null;
}

function buildSlot(name: string, teamId: number | null, score: number | null, isWinner: boolean): BracketSlot {
  const isPlaceholder = teamId === null && (PLACEHOLDER_RE.test(name.trim()) || name.trim() === '' || /^tbd$/i.test(name.trim()));
  return { teamId, name: isPlaceholder ? '' : name, isPlaceholder, score, isWinner };
}

/** Resolve one slot's feeder match number in the previous stage. */
function resolveFeeder(
  rawName: string,
  teamId: number | null,
  prevStage: KnockoutStage,
  prevMatches: BracketMatch[],
  fallback: number | null
): number | null {
  // (a) Containment — the decided slot's team won exactly one previous match.
  if (teamId !== null) {
    const byWinner = prevMatches.find(
      (m) => (m.home.isWinner && m.home.teamId === teamId) || (m.away.isWinner && m.away.teamId === teamId)
    );
    if (byWinner) return byWinner.matchNumber;
    // Team known but no decided previous match (odd feed state) — fall back to
    // participation: the previous match this team plays in.
    const byParticipant = prevMatches.find((m) => m.home.teamId === teamId || m.away.teamId === teamId);
    if (byParticipant) return byParticipant.matchNumber;
  }
  // (b) Placeholder text, validated against the expected feeding stage.
  const parsed = PLACEHOLDER_RE.exec(rawName.trim());
  if (parsed) {
    const namedStage = PLACEHOLDER_STAGE[parsed[1].toLowerCase()];
    if (namedStage === prevStage && parsed[3].toLowerCase() === 'winner') {
      const n = Number(parsed[2]);
      if (prevMatches.some((m) => m.matchNumber === n)) return n;
    }
  }
  // (c) Hardcoded FIFA map.
  if (fallback !== null && prevMatches.some((m) => m.matchNumber === fallback)) return fallback;
  return null;
}

export function buildBracket(matches: SoccerMatch[]): BracketModel {
  const knockout = matches.filter((m) => m.stage !== 'group-stage');

  const toBracketMatch = (m: SoccerMatch, stage: BracketMatch['stage'], matchNumber: number): BracketMatch => {
    const wentToPens =
      m.status === 'final' && m.homeScore !== null && m.homeScore === m.awayScore && m.winnerTeamId !== null;
    return {
      id: `${stage}-${matchNumber}`,
      stage,
      matchNumber,
      date: m.date,
      status: m.status,
      wentToPens,
      home: buildSlot(m.homeName, m.homeTeamId, m.homeScore, m.winnerTeamId !== null && m.winnerTeamId === m.homeTeamId),
      away: buildSlot(m.awayName, m.awayTeamId, m.awayScore, m.winnerTeamId !== null && m.winnerTeamId === m.awayTeamId),
      feeders: [null, null],
    };
  };

  // Per stage: chronological order = FIFA match numbering.
  const byStage = new Map<KnockoutStage, BracketMatch[]>();
  for (const stage of STAGE_ORDER) {
    const stageMatches = knockout
      .filter((m) => m.stage === stage)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m, i) => toBracketMatch(m, stage, i + 1));
    if (stageMatches.length) byStage.set(stage, stageMatches);
  }

  const thirdRaw = knockout
    .filter((m) => m.stage === '3rd-place-match')
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const thirdPlace = thirdRaw ? toBracketMatch(thirdRaw, '3rd-place-match', 1) : null;

  // Resolve feeders (needs raw names for placeholder parse — refetch from knockout list).
  const rawByStage = new Map<KnockoutStage, SoccerMatch[]>();
  for (const stage of STAGE_ORDER) {
    rawByStage.set(
      stage,
      knockout.filter((m) => m.stage === stage).sort((a, b) => a.date.localeCompare(b.date))
    );
  }
  for (let s = 1; s < STAGE_ORDER.length; s++) {
    const stage = STAGE_ORDER[s];
    const prevStage = STAGE_ORDER[s - 1];
    const stageMatches = byStage.get(stage);
    const prevMatches = byStage.get(prevStage);
    if (!stageMatches || !prevMatches) continue;
    const raws = rawByStage.get(stage)!;
    for (let i = 0; i < stageMatches.length; i++) {
      const bm = stageMatches[i];
      const raw = raws[i];
      const fifa = FIFA_2026_FEEDERS[stage]?.[bm.matchNumber] ?? null;
      bm.feeders = [
        resolveFeeder(raw.homeName, raw.homeTeamId, prevStage, prevMatches, fifa ? fifa[0] : null),
        resolveFeeder(raw.awayName, raw.awayTeamId, prevStage, prevMatches, fifa ? fifa[1] : null),
      ];
    }
  }

  // Visual ordering by recursion from the LAST present stage: a round's order is
  // each next-stage match's [homeFeeder, awayFeeder] walked top-to-bottom, so a
  // card's two feeders are always vertically adjacent to it. Unlinked matches
  // keep chronological order at the end of their column (degraded, never lost).
  const presentStages = STAGE_ORDER.filter((s) => byStage.has(s));
  const visualByStage = new Map<KnockoutStage, BracketMatch[]>();
  for (let i = presentStages.length - 1; i >= 0; i--) {
    const stage = presentStages[i];
    const stageMatches = byStage.get(stage)!;
    const nextStage = presentStages[i + 1];
    if (!nextStage) {
      visualByStage.set(stage, stageMatches); // root round: chronological
      continue;
    }
    const byNumber = new Map(stageMatches.map((m) => [m.matchNumber, m]));
    const ordered: BracketMatch[] = [];
    const seen = new Set<number>();
    for (const parent of visualByStage.get(nextStage)!) {
      for (const feeder of parent.feeders) {
        if (feeder !== null && byNumber.has(feeder) && !seen.has(feeder)) {
          ordered.push(byNumber.get(feeder)!);
          seen.add(feeder);
        }
      }
    }
    for (const m of stageMatches) if (!seen.has(m.matchNumber)) ordered.push(m);
    visualByStage.set(stage, ordered);
  }

  return {
    rounds: presentStages.map((stage) => ({
      stage,
      label: STAGE_LABELS[stage],
      matches: visualByStage.get(stage)!,
    })),
    thirdPlace,
  };
}
