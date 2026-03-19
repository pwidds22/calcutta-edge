'use client';

import { useState } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import { markPayment } from '@/actions/tournament-results';
import type { PropResult } from '@/lib/tournaments/props';
import {
  calculateActualSettlement,
  type Payment,
} from '@/lib/auction/live/debt-simplification';
import { ArrowRight, CheckCircle2, DollarSign, AlertTriangle, Check } from 'lucide-react';

/** Format a dollar amount — show cents only when not a whole number */
function fmt(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
}

interface SettlementMatrixProps {
  sessionId: string;
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  config: TournamentConfig;
  payoutRules: PayoutRules;
  results: TournamentResult[];
  isCommissioner: boolean;
  paymentTracking: Record<string, boolean>;
  propResults?: PropResult[];
}

export function SettlementMatrix({
  sessionId,
  soldTeams,
  baseTeams,
  config,
  payoutRules,
  results,
  isCommissioner,
  paymentTracking,
  propResults = [],
}: SettlementMatrixProps) {
  const settlement = calculateActualSettlement(
    soldTeams,
    baseTeams,
    results,
    config,
    payoutRules,
    propResults
  );

  const hasResults = results.some((r) => r.result !== 'pending');

  if (!hasResults) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 size-8 text-amber-400/50" />
        <p className="text-sm text-white/50">
          Settlement will appear once tournament results are entered.
        </p>
        <p className="mt-1 text-xs text-white/30">
          The commissioner needs to mark teams as won/lost for each round.
        </p>
      </div>
    );
  }

  const totalPayments = settlement.payments.length;
  const paidCount = settlement.payments.filter(
    (p) => paymentTracking[`${p.fromId}->${p.toId}`]
  ).length;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pot" value={`$${settlement.actualPot.toLocaleString()}`} />
        <StatCard
          label="Distributed"
          value={`$${fmt(settlement.totalDistributed)}`}
        />
        <StatCard
          label="Transactions"
          value={settlement.payments.length.toString()}
        />
        <StatCard
          label="Status"
          value={settlement.isSettled ? 'Settled' : 'In Progress'}
          valueColor={settlement.isSettled ? 'text-emerald-400' : 'text-amber-400'}
        />
      </div>

      {/* Net Balances */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Net Balances
        </h3>
        <div className="space-y-1.5">
          {settlement.balances.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`size-2 rounded-full ${
                    b.netBalance > 0.01
                      ? 'bg-emerald-400'
                      : b.netBalance < -0.01
                        ? 'bg-red-400'
                        : 'bg-white/20'
                  }`}
                />
                <span className="text-sm text-white/80">{b.name}</span>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-4 text-xs text-white/30">
                  <span>Spent: ${b.totalSpent.toLocaleString()}</span>
                  <span>Earned: ${fmt(b.totalEarned)}</span>
                </div>
                <p
                  className={`text-sm font-mono font-medium ${
                    b.netBalance > 0.01
                      ? 'text-emerald-400'
                      : b.netBalance < -0.01
                        ? 'text-red-400'
                        : 'text-white/40'
                  }`}
                >
                  {b.netBalance >= 0 ? '+' : ''}${fmt(b.netBalance)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Plan */}
      {totalPayments > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Payment Plan ({totalPayments} transaction{totalPayments !== 1 ? 's' : ''})
            </h3>
            {totalPayments > 0 && (
              <span className="text-xs text-white/40">
                <span className={paidCount === totalPayments ? 'text-emerald-400 font-medium' : ''}>
                  {paidCount}/{totalPayments} settled
                </span>
              </span>
            )}
          </div>

          {/* Progress bar */}
          {totalPayments > 0 && (
            <div className="mb-3 h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${(paidCount / totalPayments) * 100}%` }}
              />
            </div>
          )}

          <div className="space-y-2">
            {settlement.payments.map((payment, idx) => (
              <PaymentRow
                key={`${payment.fromId}-${payment.toId}-${idx}`}
                sessionId={sessionId}
                payment={payment}
                isPaid={!!paymentTracking[`${payment.fromId}->${payment.toId}`]}
                isCommissioner={isCommissioner}
              />
            ))}
          </div>
        </div>
      )}

      {/* All settled indicator */}
      {settlement.isSettled && settlement.payments.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-8">
          <CheckCircle2 className="size-8 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-400">All Settled</p>
          <p className="text-xs text-white/40">No payments needed.</p>
        </div>
      )}

      {/* All payments completed indicator */}
      {totalPayments > 0 && paidCount === totalPayments && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-6">
          <CheckCircle2 className="size-6 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-400">All Payments Settled</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  valueColor = 'text-white',
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-white/30">{label}</p>
      <p className={`text-lg font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}

function PaymentRow({
  sessionId,
  payment,
  isPaid,
  isCommissioner,
}: {
  sessionId: string;
  payment: Payment;
  isPaid: boolean;
  isCommissioner: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const paymentKey = `${payment.fromId}->${payment.toId}`;

  const handleToggle = async () => {
    setLoading(true);
    await markPayment(sessionId, paymentKey, !isPaid);
    setLoading(false);
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
        isPaid
          ? 'border-emerald-500/20 bg-emerald-500/5 opacity-60'
          : 'border-white/[0.06] bg-white/[0.02]'
      }`}
    >
      {/* Checkbox for commissioner */}
      {isCommissioner && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          className={`flex size-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
            isPaid
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-white/20 bg-white/[0.04] text-transparent hover:border-white/40'
          } ${loading ? 'opacity-50' : ''}`}
        >
          {isPaid && <Check className="size-3" />}
        </button>
      )}

      {/* Non-commissioner paid indicator */}
      {!isCommissioner && isPaid && (
        <CheckCircle2 className="size-4 flex-shrink-0 text-emerald-400" />
      )}

      <div className={`flex-1 text-right ${isPaid ? 'line-through decoration-white/20' : ''}`}>
        <p className={`text-sm font-medium ${isPaid ? 'text-white/40' : 'text-red-400'}`}>
          {payment.fromName}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ArrowRight className={`size-3.5 ${isPaid ? 'text-white/15' : 'text-white/30'}`} />
        <div className={`flex items-center gap-1 rounded-full px-3 py-1 ${
          isPaid ? 'bg-emerald-500/5' : 'bg-emerald-500/10'
        }`}>
          <DollarSign className={`size-3 ${isPaid ? 'text-emerald-400/40' : 'text-emerald-400'}`} />
          <span className={`text-sm font-mono font-medium ${
            isPaid ? 'text-emerald-400/40' : 'text-emerald-400'
          }`}>
            {fmt(payment.amount)}
          </span>
        </div>
        <ArrowRight className={`size-3.5 ${isPaid ? 'text-white/15' : 'text-white/30'}`} />
      </div>
      <div className={`flex-1 ${isPaid ? 'line-through decoration-white/20' : ''}`}>
        <p className={`text-sm font-medium ${isPaid ? 'text-white/40' : 'text-emerald-400'}`}>
          {payment.toName}
        </p>
      </div>
    </div>
  );
}
