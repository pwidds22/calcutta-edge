'use client';

import { memo, useCallback } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatPercent } from '@/lib/calculations/format';
import { calculateRoundProfits } from '@/lib/calculations/profits';
import { useAuction } from '@/lib/auction/auction-context';
import type { Team, PayoutRules } from '@/lib/calculations/types';

interface TeamTableRowProps {
  team: Team;
  payoutRules: PayoutRules;
  potSize: number;
  onPriceChange: (teamId: number, price: number) => void;
  onMyTeamToggle: (teamId: number, isMyTeam: boolean) => void;
  locked?: boolean;
}

function ProfitCell({
  profit,
  odds,
  roundValue,
}: {
  profit: number;
  odds: number;
  roundValue: number;
}) {
  return (
    <TableCell className="px-2 py-1.5 text-center">
      <div
        className={`text-xs font-medium tabular-nums ${
          profit > 0 ? 'text-emerald-400' : profit < 0 ? 'text-red-400' : ''
        }`}
      >
        {formatCurrency(profit)}
      </div>
      <div
        className="text-[10px] text-muted-foreground tabular-nums cursor-help"
        title={`${formatPercent(odds)} chance to reach this round\n${formatPercent(roundValue)} of pot value from this round`}
      >
        {formatPercent(odds)} ({formatPercent(roundValue)})
      </div>
    </TableCell>
  );
}

export const TeamTableRow = memo(function TeamTableRow({
  team,
  payoutRules,
  potSize,
  onPriceChange,
  onMyTeamToggle,
  locked,
}: TeamTableRowProps) {
  const { config } = useAuction();
  const rounds = config?.rounds ?? [];

  const profits = config
    ? calculateRoundProfits(team.purchasePrice, payoutRules, potSize, config)
    : {};

  const handlePriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onPriceChange(team.id, parseFloat(e.target.value) || 0);
    },
    [team.id, onPriceChange]
  );

  const handleMyTeamToggle = useCallback(
    (checked: boolean | 'indeterminate') => {
      onMyTeamToggle(team.id, checked === true);
    },
    [team.id, onMyTeamToggle]
  );

  if (locked) {
    return (
      <TableRow className="opacity-60">
        <TableCell className="px-2 py-1.5 text-xs">{team.seed}</TableCell>
        <TableCell className="px-2 py-1.5 text-xs font-medium whitespace-nowrap">
          {team.name}
        </TableCell>
        <TableCell className="px-2 py-1.5 text-xs">{team.group}</TableCell>
        {rounds.map((round) => (
          <TableCell key={round.key} className="px-2 py-1.5 text-center">
            <div className="text-xs select-none blur-[3px]">$---.--</div>
            <div className="text-[10px] select-none blur-[3px]">--.-%</div>
          </TableCell>
        ))}
        <TableCell className="px-2 py-1.5 text-right text-xs select-none blur-[3px]">$---.--</TableCell>
        <TableCell className="px-2 py-1.5 text-right text-xs select-none blur-[3px]">$---.--</TableCell>
        <TableCell className="px-2 py-1.5">
          <Input
            type="number"
            placeholder="0"
            disabled
            className="h-7 w-20 text-right text-xs tabular-nums opacity-50"
          />
        </TableCell>
        <TableCell className="px-2 py-1.5 text-center">
          <Checkbox disabled />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className={team.isMyTeam ? 'bg-emerald-500/10' : undefined}>
      <TableCell className="px-2 py-1.5 text-xs">{team.seed}</TableCell>
      <TableCell className="px-2 py-1.5 text-xs font-medium whitespace-nowrap">
        {team.name}
      </TableCell>
      <TableCell className="px-2 py-1.5 text-xs">{team.group}</TableCell>

      {rounds.map((round) => (
        <ProfitCell
          key={round.key}
          profit={profits[round.key] ?? 0}
          odds={team.odds[round.key] ?? 0}
          roundValue={team.roundValues[round.key] ?? 0}
        />
      ))}

      <TableCell className="px-2 py-1.5 text-right text-xs font-medium tabular-nums text-emerald-400">
        {formatCurrency(team.fairValue * 0.95)}
      </TableCell>
      <TableCell className="px-2 py-1.5 text-right text-xs font-medium tabular-nums">
        {formatCurrency(team.fairValue)}
      </TableCell>
      <TableCell className="px-2 py-1.5">
        <Input
          type="number"
          min={0}
          step={1}
          value={team.purchasePrice || ''}
          onChange={handlePriceChange}
          placeholder="0"
          className="h-7 w-20 text-right text-xs tabular-nums"
        />
      </TableCell>
      <TableCell className="px-2 py-1.5 text-center">
        <Checkbox
          checked={team.isMyTeam}
          onCheckedChange={handleMyTeamToggle}
          disabled={team.purchasePrice === 0}
        />
      </TableCell>
    </TableRow>
  );
});
