/**
 * Sanity check: verify that the Masters 2026 odds devig produces reasonable probabilities.
 * Scheffler at +450 should devig to ~13-15% win probability.
 */
import { describe, it, expect } from 'vitest';
import { MASTERS_2026_TEAMS } from '@/lib/tournaments/configs/masters-2026';

/** American odds → implied probability (same formula as odds-builder.ts) */
function americanToImplied(odds: number): number {
  if (odds === 0) return 0;
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

/** Devig with expected winners (same as odds-builder.ts) */
function devigGlobal(
  teams: Array<{ id: number; americanOdds: Record<string, number> }>,
  market: string,
  expectedWinners: number
): Map<number, number> {
  const implied = new Map<number, number>();
  for (const t of teams) {
    const odds = t.americanOdds[market];
    if (odds && odds !== 0) {
      implied.set(t.id, americanToImplied(odds));
    }
  }
  const total = Array.from(implied.values()).reduce((s, v) => s + v, 0);
  const scale = expectedWinners / total;
  const devigged = new Map<number, number>();
  for (const [id, prob] of implied) {
    devigged.set(id, Math.min(prob * scale, 1));
  }
  return devigged;
}

describe('Masters 2026 devig sanity check', () => {
  it('Scheffler win probability should be ~10-18% (real DraftKings odds)', () => {
    const winProbs = devigGlobal(MASTERS_2026_TEAMS, 'winner', 1);
    const schefflerWin = winProbs.get(1)!; // ID 1 = Scheffler
    // +485 with 91-player field → ~13-17% after devig
    expect(schefflerWin).toBeGreaterThan(0.08);
    expect(schefflerWin).toBeLessThan(0.20);
    console.log(`Scheffler win prob: ${(schefflerWin * 100).toFixed(2)}%`);
  });

  it('Scheffler makeCut probability should be very high (>75%)', () => {
    const cutProbs = devigGlobal(MASTERS_2026_TEAMS, 'makeCut', 50);
    const schefflerCut = cutProbs.get(1)!;
    // With real sportsbook odds, devigged makeCut is ~80% (heavy vig on cut markets)
    expect(schefflerCut).toBeGreaterThan(0.75);
    console.log(`Scheffler makeCut prob: ${(schefflerCut * 100).toFixed(2)}%`);
  });

  it('win probabilities should sum to ~1.0', () => {
    const winProbs = devigGlobal(MASTERS_2026_TEAMS, 'winner', 1);
    const sum = Array.from(winProbs.values()).reduce((s, v) => s + v, 0);
    expect(sum).toBeGreaterThan(0.95);
    expect(sum).toBeLessThan(1.05);
    console.log(`Win prob sum: ${sum.toFixed(4)}`);
  });

  it('makeCut probabilities should sum to ~50', () => {
    const cutProbs = devigGlobal(MASTERS_2026_TEAMS, 'makeCut', 50);
    const sum = Array.from(cutProbs.values()).reduce((s, v) => s + v, 0);
    expect(sum).toBeGreaterThan(48);
    expect(sum).toBeLessThan(52);
    console.log(`MakeCut prob sum: ${sum.toFixed(2)}`);
  });

  it('top5 probabilities should sum to ~5', () => {
    const top5Probs = devigGlobal(MASTERS_2026_TEAMS, 'top5', 5);
    const sum = Array.from(top5Probs.values()).reduce((s, v) => s + v, 0);
    expect(sum).toBeGreaterThan(4.8);
    expect(sum).toBeLessThan(5.2);
    console.log(`Top5 prob sum: ${sum.toFixed(2)}`);
  });

  it('Rahm (+910) should devig to ~6-12% win probability', () => {
    const winProbs = devigGlobal(MASTERS_2026_TEAMS, 'winner', 1);
    const rahmWin = winProbs.get(2)!; // ID 2 = Rahm
    expect(rahmWin).toBeGreaterThan(0.05);
    expect(rahmWin).toBeLessThan(0.15);
    console.log(`Rahm win prob: ${(rahmWin * 100).toFixed(2)}%`);
  });

  it('Fred Couples (+500000) should have tiny win probability', () => {
    const winProbs = devigGlobal(MASTERS_2026_TEAMS, 'winner', 1);
    const couplesWin = winProbs.get(91)!; // ID 91 = Couples (real odds)
    expect(couplesWin).toBeLessThan(0.001);
    console.log(`Couples win prob: ${(couplesWin * 100).toFixed(4)}%`);
  });

  it('print top 10 win probabilities for review', () => {
    const winProbs = devigGlobal(MASTERS_2026_TEAMS, 'winner', 1);
    const sorted = Array.from(winProbs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    console.log('\nTop 10 Win Probabilities:');
    for (const [id, prob] of sorted) {
      const team = MASTERS_2026_TEAMS.find(t => t.id === id);
      console.log(`  ${team?.name.padEnd(25)} ${(prob * 100).toFixed(2)}% (${(team?.americanOdds.winner ?? 0) > 0 ? '+' : ''}${team?.americanOdds.winner})`);
    }
  });
});
