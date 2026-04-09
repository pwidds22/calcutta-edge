'use client';

import { useState } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import {
  calculateSettlement,
  type ParticipantSettlement,
} from '@/lib/auction/live/settlement';
import { Calculator, ChevronDown, ChevronRight, DollarSign } from 'lucide-react';

interface SettlementCalculatorProps {
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  config: TournamentConfig;
  payoutRules: PayoutRules;
}

export function SettlementCalculator({
  soldTeams,
  baseTeams,
  config,
  payoutRules,
}: SettlementCalculatorProps) {
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null);

  const settlement = calculateSettlement(soldTeams, baseTeams, config, payoutRules);

  const toggleExpand = (id: string) => {
    setExpandedParticipant((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Calculator className="size-4 text-white/40" />
        <h3 className="text-sm font-semibold text-white/60">
          Settlement Calculator
        </h3>
      </div>

      {/* Payout structure reference */}
      <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">
          Per-Win Payout Structure (Pot: ${settlement.actualPot.toLocaleString()})
        </p>
        <div className="flex flex-wrap gap-2">
          {settlement.roundLabels.map(({ key, label }) => {
            const pct = payoutRules[key] ?? 0;
            const amount = settlement.actualPot * (pct / 100);
            return (
              <div
                key={key}
                className="rounded-md bg-white/[0.04] px-2.5 py-1 text-center"
              >
                <span className="text-[10px] text-white/30">{label}</span>
                <p className="text-xs font-mono font-medium text-emerald-400">
                  ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-[9px] text-white/20">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Participant breakdown */}
      <div className="space-y-2">
        {settlement.participants.map((p) => (
          <ParticipantCard
            key={p.participantId}
            participant={p}
            roundLabels={settlement.roundLabels}
            isExpanded={expandedParticipant === p.participantId}
            onToggle={() => toggleExpand(p.participantId)}
          />
        ))}
      </div>
    </div>
  );
}

function ParticipantCard({
  participant,
  roundLabels,
  isExpanded,
  onToggle,
}: {
  participant: ParticipantSettlement;
  roundLabels: Array<{ key: string; label: string }>;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Find the earliest round where a single team's payout covers the participant's total spend.
  // This is realistic: "if your best team reaches [round], you break even overall."
  const breakEvenRound = roundLabels.find(({ key }) =>
    participant.teams.some((t) => (t.roundPayouts[key] ?? 0) >= participant.totalOwed)
  );

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="size-3.5 text-white/30" />
          ) : (
            <ChevronRight className="size-3.5 text-white/30" />
          )}
          <div>
            <span className="text-sm font-medium text-white">
              {participant.participantName}
            </span>
            <span className="ml-2 text-xs text-white/30">
              {participant.teamCount} team{participant.teamCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/30">Owes</p>
          <p className="text-sm font-mono font-medium text-red-400">
            ${participant.totalOwed.toLocaleString()}
          </p>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-white/[0.04] px-4 py-3 space-y-3">
          {/* Break-even indicator */}
          {breakEvenRound ? (
            <div className="flex items-center gap-1.5 text-xs">
              <DollarSign className="size-3 text-emerald-400" />
              <span className="text-white/50">
                Breaks even if any team reaches{' '}
                <span className="text-emerald-400 font-medium">
                  {breakEvenRound.label}
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <DollarSign className="size-3 text-amber-400" />
              <span className="text-white/50">
                Needs deep runs to break even
              </span>
            </div>
          )}

          {/* Per-team breakdown */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/25">
                  <th className="px-2 py-1.5 text-left">Team</th>
                  <th className="px-2 py-1.5 text-right">Paid</th>
                  {roundLabels.map(({ key, label }) => (
                    <th key={key} className="px-2 py-1.5 text-right">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {participant.teams.map((team) => (
                  <tr
                    key={team.teamId}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">
                      <span className="text-white/25 mr-1">({team.seed})</span>
                      {team.teamName}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-white/50">
                      ${team.purchasePrice.toLocaleString()}
                    </td>
                    {roundLabels.map(({ key }) => {
                      const profit = team.roundProfits[key] ?? 0;
                      return (
                        <td
                          key={key}
                          className={`px-2 py-1.5 text-right font-mono ${
                            profit >= 0
                              ? 'text-emerald-400'
                              : 'text-red-400/70'
                          }`}
                        >
                          {profit >= 0 ? '+' : ''}
                          ${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
