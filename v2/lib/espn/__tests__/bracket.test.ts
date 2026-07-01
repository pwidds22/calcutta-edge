import { describe, it, expect } from 'vitest';
import { buildBracket } from '../bracket';
import type { SoccerMatch } from '../soccer';

// ─── fixture helpers ─────────────────────────────────────────────

function match(overrides: Partial<SoccerMatch> & { date: string; stage: string }): SoccerMatch {
  return {
    homeTeamId: null,
    awayTeamId: null,
    homeName: '',
    awayName: '',
    homeScore: null,
    awayScore: null,
    status: 'scheduled',
    winnerTeamId: null,
    ...overrides,
  } as SoccerMatch;
}

function placeholder(prevLabel: string, n: number, kind: 'Winner' | 'Loser' = 'Winner'): string {
  return `${prevLabel} ${n} ${kind}`;
}

/** 16 scheduled R32 matches, chronological (teams 1..32, match i = teams 2i-1 v 2i). */
function scheduledR32(): SoccerMatch[] {
  return Array.from({ length: 16 }, (_, i) =>
    match({
      date: `2026-06-28T${String(10 + i).padStart(2, '0')}:00Z`,
      stage: 'round-of-32',
      homeTeamId: 2 * i + 1,
      awayTeamId: 2 * i + 2,
      homeName: `Team ${2 * i + 1}`,
      awayName: `Team ${2 * i + 2}`,
    })
  );
}

/** R16 fixtures mirroring the real 2026 feed's non-adjacent pairings, all placeholders. */
const R16_FIFA_PAIRS: [number, number][] = [
  [1, 4], [3, 6], [2, 5], [7, 8], [11, 12], [9, 10], [14, 16], [13, 15],
];
function placeholderR16(): SoccerMatch[] {
  return R16_FIFA_PAIRS.map(([h, a], i) =>
    match({
      date: `2026-07-04T${String(10 + i).padStart(2, '0')}:00Z`,
      stage: 'round-of-16',
      homeName: placeholder('Round of 32', h),
      awayName: placeholder('Round of 32', a),
    })
  );
}

const QF_PAIRS: [number, number][] = [[1, 2], [5, 6], [3, 4], [7, 8]];
function placeholderQF(): SoccerMatch[] {
  return QF_PAIRS.map(([h, a], i) =>
    match({
      date: `2026-07-09T${String(10 + i).padStart(2, '0')}:00Z`,
      stage: 'quarterfinals',
      homeName: placeholder('Round of 16', h),
      awayName: placeholder('Round of 16', a),
    })
  );
}

function placeholderSF(): SoccerMatch[] {
  return [
    match({ date: '2026-07-14T19:00Z', stage: 'semifinals', homeName: placeholder('Quarterfinal', 1), awayName: placeholder('Quarterfinal', 2) }),
    match({ date: '2026-07-15T19:00Z', stage: 'semifinals', homeName: placeholder('Quarterfinal', 3), awayName: placeholder('Quarterfinal', 4) }),
  ];
}

function placeholderFinalAndThird(): SoccerMatch[] {
  return [
    match({ date: '2026-07-18T21:00Z', stage: '3rd-place-match', homeName: placeholder('Semifinal', 1, 'Loser'), awayName: placeholder('Semifinal', 2, 'Loser') }),
    match({ date: '2026-07-19T19:00Z', stage: 'final', homeName: placeholder('Semifinal', 1), awayName: placeholder('Semifinal', 2) }),
  ];
}

function fullPlaceholderFeed(): SoccerMatch[] {
  return [...scheduledR32(), ...placeholderR16(), ...placeholderQF(), ...placeholderSF(), ...placeholderFinalAndThird()];
}

// ─── tests ───────────────────────────────────────────────────────

describe('buildBracket', () => {
  it('derives the full feeder graph from placeholder text alone (incl. non-adjacent 14v16 / 13v15)', () => {
    const model = buildBracket(fullPlaceholderFeed());
    const r16 = model.rounds.find((r) => r.stage === 'round-of-16')!;
    // Feeders per chronological R16 match number:
    const byNumber = new Map(r16.matches.map((m) => [m.matchNumber, m.feeders]));
    expect(byNumber.get(7)).toEqual([14, 16]);
    expect(byNumber.get(8)).toEqual([13, 15]);
    expect(byNumber.get(1)).toEqual([1, 4]);
    expect(byNumber.get(3)).toEqual([2, 5]);
    // All 5 rounds present, 16/8/4/2/1 matches.
    expect(model.rounds.map((r) => r.matches.length)).toEqual([16, 8, 4, 2, 1]);
  });

  it('orders each round visually so a match’s feeders are adjacent to it', () => {
    const model = buildBracket(fullPlaceholderFeed());
    const r32 = model.rounds.find((r) => r.stage === 'round-of-32')!;
    const r16 = model.rounds.find((r) => r.stage === 'round-of-16')!;
    // R16 visual order follows QF walk: QF1(1,2), QF2(5,6), QF3(3,4), QF4(7,8)
    expect(r16.matches.map((m) => m.matchNumber)).toEqual([1, 2, 5, 6, 3, 4, 7, 8]);
    // R32 visual order = concatenated feeders of R16 visual order
    expect(r32.matches.map((m) => m.matchNumber)).toEqual([1, 4, 3, 6, 11, 12, 9, 10, 2, 5, 7, 8, 14, 16, 13, 15]);
    // Adjacency invariant: R16 visual match i is fed by R32 visual matches 2i, 2i+1
    r16.matches.forEach((m, i) => {
      const feederNums = [r32.matches[2 * i].matchNumber, r32.matches[2 * i + 1].matchNumber];
      expect(m.feeders).toEqual(feederNums);
    });
  });

  it('containment beats placeholder text once a slot is decided', () => {
    const feed = fullPlaceholderFeed();
    // Decide R32 match 4 (teams 7 v 8 → 8 wins) and put the real winner in R16
    // match 1's away slot — but with contradictory placeholder-ish home text.
    const r32m4 = feed[3];
    r32m4.status = 'final';
    r32m4.homeScore = 0;
    r32m4.awayScore = 1;
    r32m4.winnerTeamId = 8;
    const r16m1 = feed[16]; // first R16 fixture (chronologically)
    r16m1.awayTeamId = 8;
    r16m1.awayName = 'Team 8';
    // Home slot still placeholder "Round of 32 1 Winner" — text path.
    const model = buildBracket(feed);
    const r16 = model.rounds.find((r) => r.stage === 'round-of-16')!;
    const m1 = r16.matches.find((m) => m.matchNumber === 1)!;
    expect(m1.feeders).toEqual([1, 4]); // away resolved by containment to match 4
    expect(m1.away.teamId).toBe(8);
    expect(m1.away.isPlaceholder).toBe(false);
    expect(m1.home.isPlaceholder).toBe(true);
    expect(m1.home.name).toBe(''); // renders as TBD
  });

  it('missing feeder match → null feeder, no throw, other matches keep order', () => {
    const feed = fullPlaceholderFeed().filter(
      // Drop R32 match 14 (chronologically the 14th R32 fixture)
      (m, i) => !(m.stage === 'round-of-32' && i === 13)
    );
    const model = buildBracket(feed);
    const r32 = model.rounds.find((r) => r.stage === 'round-of-32')!;
    expect(r32.matches.length).toBe(15);
    const r16 = model.rounds.find((r) => r.stage === 'round-of-16')!;
    // NOTE: dropping a match shifts chronological numbering after it, so text
    // feeders referencing high numbers may dangle — they must resolve to null
    // (or a still-existing number), never crash.
    for (const m of r16.matches) {
      for (const f of m.feeders) {
        if (f !== null) expect(r32.matches.some((x) => x.matchNumber === f)).toBe(true);
      }
    }
  });

  it('splits the 3rd-place match out of the grid', () => {
    const model = buildBracket(fullPlaceholderFeed());
    expect(model.thirdPlace).not.toBeNull();
    expect(model.thirdPlace!.stage).toBe('3rd-place-match');
    for (const round of model.rounds) {
      expect(round.matches.every((m) => m.stage !== '3rd-place-match')).toBe(true);
    }
  });

  it('shootout: winner from winnerTeamId (level scores), wentToPens set', () => {
    const feed = scheduledR32();
    feed[2].status = 'final';
    feed[2].homeScore = 1;
    feed[2].awayScore = 1;
    feed[2].winnerTeamId = 6; // away wins on pens (teams 5 v 6)
    const model = buildBracket(feed);
    const m3 = model.rounds[0].matches.find((m) => m.matchNumber === 3)!;
    expect(m3.wentToPens).toBe(true);
    expect(m3.away.isWinner).toBe(true);
    expect(m3.home.isWinner).toBe(false);
  });

  it('ignores group-stage matches and returns empty rounds for a group-only feed', () => {
    const groupOnly = [match({ date: '2026-06-12T18:00Z', stage: 'group-stage', homeTeamId: 1, awayTeamId: 2, homeName: 'A', awayName: 'B' })];
    const model = buildBracket(groupOnly);
    expect(model.rounds).toEqual([]);
    expect(model.thirdPlace).toBeNull();
  });
});
