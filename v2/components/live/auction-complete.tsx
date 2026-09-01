'use client';

import { useState } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import { formatGroupLabel } from '@/lib/calculations/format';
import {
  getParticipantPortfolios,
  generateCSV,
  generateTextSummary,
  downloadCSV,
} from '@/lib/auction/live/export';
import { Trophy, Download, Copy, Check, Users, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettlementCalculator } from './settlement-calculator';

interface AuctionCompleteProps {
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  sessionName: string;
  isCommissioner: boolean;
  config: TournamentConfig;
  payoutRules: PayoutRules;
}

export function AuctionComplete({
  soldTeams,
  baseTeams,
  sessionName,
  isCommissioner,
  config,
  payoutRules,
}: AuctionCompleteProps) {
  const [copied, setCopied] = useState(false);

  const totalPot = soldTeams.reduce((s, t) => s + t.amount, 0);
  const portfolios = getParticipantPortfolios(soldTeams, baseTeams);
  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));

  const prices = soldTeams.map((t) => t.amount);
  const highestSale = prices.length > 0 ? Math.max(...prices) : 0;
  const lowestSale = prices.length > 0 ? Math.min(...prices) : 0;
  const avgSale = prices.length > 0 ? totalPot / prices.length : 0;

  const highestTeam = soldTeams.find((t) => t.amount === highestSale);
  const highestTeamInfo = highestTeam ? teamMap.get(highestTeam.teamId) : null;

  const handleCopy = async () => {
    const text = generateTextSummary(soldTeams, baseTeams, sessionName);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const csv = generateCSV(soldTeams, baseTeams, sessionName);
    const filename = `${sessionName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-results.csv`;
    downloadCSV(csv, filename);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-500/20">
          <Trophy className="size-7 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Auction Complete</h2>
        <p className="mt-1 text-sm text-white/40">{sessionName}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Total Pot</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            ${totalPot.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Teams Sold</p>
          <p className="mt-1 text-lg font-bold text-white">{soldTeams.length}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Highest Sale</p>
          <p className="mt-1 text-lg font-bold text-white">
            ${highestSale.toLocaleString()}
          </p>
          {highestTeamInfo && (
            <p className="text-[10px] text-white/30">{highestTeamInfo.name}</p>
          )}
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Avg Price</p>
          <p className="mt-1 text-lg font-bold text-white">
            ${Math.round(avgSale).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5 border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied!' : 'Copy Summary'}
        </Button>
        {isCommissioner && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-1.5 border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Settlement Calculator */}
      <SettlementCalculator
        soldTeams={soldTeams}
        baseTeams={baseTeams}
        config={config}
        payoutRules={payoutRules}
      />

      {/* Participant portfolios */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Users className="size-4 text-white/40" />
          <h3 className="text-sm font-semibold text-white/60">
            Portfolios ({portfolios.length} participants)
          </h3>
        </div>
        <div className="space-y-3">
          {portfolios.map((p) => (
            <div
              key={p.name}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2">
                <span className="text-sm font-medium text-white">{p.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40">
                    {p.teams.length} team{p.teams.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-sm font-mono font-medium text-emerald-400">
                    ${p.totalSpent.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {p.teams
                  .sort((a, b) => a.seed - b.seed)
                  .map((t) => (
                    <div
                      key={t.teamName}
                      className="flex items-center justify-between px-4 py-1.5"
                    >
                      <span className="text-xs text-white/60">
                        <span className="text-white/30 mr-1">({t.seed})</span>
                        {t.teamName}
                        <span className="ml-1.5 text-white/20">{formatGroupLabel(t.group)}</span>
                      </span>
                      <span className="text-xs font-mono text-white/50">
                        ${t.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full results table */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="size-4 text-white/40" />
          <h3 className="text-sm font-semibold text-white/60">
            All Results (by seed)
          </h3>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/30">
                <th className="px-3 py-2 text-left">Team</th>
                <th className="hidden px-3 py-2 text-left sm:table-cell">Region</th>
                <th className="px-3 py-2 text-left">Owner</th>
                <th className="px-3 py-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {[...soldTeams]
                .sort((a, b) => {
                  const teamA = teamMap.get(a.teamId);
                  const teamB = teamMap.get(b.teamId);
                  return (teamA?.seed ?? 99) - (teamB?.seed ?? 99);
                })
                .map((sold, idx) => {
                  const team = teamMap.get(sold.teamId);
                  return (
                    <tr
                      key={`${sold.teamId}-${idx}`}
                      className="border-b border-white/[0.04] last:border-0"
                    >
                      <td className="px-3 py-1.5 text-white/70">
                        <span className="text-white/30 text-xs mr-1">
                          ({team?.seed})
                        </span>
                        {team?.name ?? `Team ${sold.teamId}`}
                      </td>
                      <td className="hidden px-3 py-1.5 text-xs text-white/30 sm:table-cell">
                        {formatGroupLabel(team?.group)}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-white/50">
                        {sold.winnerName}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-medium text-emerald-400">
                        ${sold.amount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
