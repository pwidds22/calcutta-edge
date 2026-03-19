import type { SoldTeam } from './use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import type { PropResult } from '@/lib/tournaments/props';
import { calculateLeaderboard } from './actual-payouts';

// ─── Types ────────────────────────────────────────────────────────

export interface ParticipantBalance {
  id: string;
  name: string;
  totalSpent: number;
  totalEarned: number;
  netBalance: number; // positive = owed money, negative = owes money
}

export interface Payment {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export interface SettlementResult {
  actualPot: number;
  totalDistributed: number;
  balances: ParticipantBalance[];
  payments: Payment[];
  isSettled: boolean; // true if all balances are zero (tournament fully resolved)
}

// ─── Core Algorithm ───────────────────────────────────────────────

/**
 * Calculate actual net balances and simplified payment plan.
 *
 * Net balance = totalEarned - totalSpent
 * - Positive: participant is owed money (won more than they paid)
 * - Negative: participant owes money (paid more than they won)
 *
 * The commissioner collects from debtors and pays creditors.
 * We simplify by matching largest debtor → largest creditor.
 */
export function calculateActualSettlement(
  soldTeams: SoldTeam[],
  baseTeams: BaseTeam[],
  results: TournamentResult[],
  config: TournamentConfig,
  payoutRules: PayoutRules,
  propResults: PropResult[] = []
): SettlementResult {
  const leaderboard = calculateLeaderboard(
    soldTeams,
    baseTeams,
    results,
    config,
    payoutRules,
    propResults
  );

  const balances: ParticipantBalance[] = leaderboard.entries.map((entry) => ({
    id: entry.participantId,
    name: entry.participantName,
    totalSpent: entry.totalSpent,
    totalEarned: entry.totalEarned,
    netBalance: entry.netPL, // Uses eliminated-cost-only P&L from calculateLeaderboard
  }));

  // Sort by netBalance ascending (biggest debtors first)
  balances.sort((a, b) => a.netBalance - b.netBalance);

  const totalDistributed = balances.reduce((sum, b) => sum + b.totalEarned, 0);
  const payments = simplifyDebts(balances);
  const isSettled = balances.every(
    (b) => Math.abs(b.netBalance) < 0.01
  );

  return {
    actualPot: leaderboard.actualPot,
    totalDistributed,
    balances,
    payments,
    isSettled,
  };
}

/**
 * Splitwise-style debt simplification.
 * Minimizes the number of transactions needed to settle all balances.
 *
 * Algorithm:
 * 1. Separate into debtors (negative balance) and creditors (positive balance)
 * 2. Sort debtors by amount owed (ascending = most negative first)
 * 3. Sort creditors by amount owed (descending = most positive first)
 * 4. Match largest debtor with largest creditor
 * 5. Create a payment for min(|debt|, credit)
 * 6. Adjust balances and repeat
 */
function simplifyDebts(balances: ParticipantBalance[]): Payment[] {
  // Work with copies to avoid mutating input
  const debtors: Array<{ id: string; name: string; amount: number }> = [];
  const creditors: Array<{ id: string; name: string; amount: number }> = [];

  for (const b of balances) {
    if (b.netBalance < -0.01) {
      debtors.push({ id: b.id, name: b.name, amount: Math.abs(b.netBalance) });
    } else if (b.netBalance > 0.01) {
      creditors.push({ id: b.id, name: b.name, amount: b.netBalance });
    }
  }

  // Sort: largest amounts first
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const payments: Payment[] = [];
  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];
    const transferAmount = Math.min(debtor.amount, creditor.amount);

    if (transferAmount > 0.01) {
      payments.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: Math.round(transferAmount * 100) / 100,
      });
    }

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount < 0.01) di++;
    if (creditor.amount < 0.01) ci++;
  }

  return payments;
}
