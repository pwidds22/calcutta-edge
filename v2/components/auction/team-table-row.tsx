'use client';

import { memo, useCallback, useState, useEffect } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatPercent } from '@/lib/calculations/format';
import { calculateRoundProfits } from '@/lib/calculations/profits';
import { useAuction } from '@/lib/auction/auction-context';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { Team, TeamBundle, PayoutRules } from '@/lib/calculations/types';

interface TeamTableRowProps {
  team: Team;
  payoutRules: PayoutRules;
  potSize: number;
  onPriceChange: (teamId: number, price: number) => void;
  onMyTeamToggle: (teamId: number, isMyTeam: boolean) => void;
  locked?: boolean;
  indented?: boolean;
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
        title={`${formatPercent(odds)} chance to reach this round\n${formatPercent(roundValue)} of pot → adds ${roundValue > 0 ? '$' + (roundValue * 10000).toFixed(0) : '$0'} to fair value per $10k pot`}
      >
        {formatPercent(odds)}
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
  indented,
}: TeamTableRowProps) {
  const { config } = useAuction();
  const rounds = config?.rounds ?? [];

  const profits = config
    ? calculateRoundProfits(team.purchasePrice, payoutRules, potSize, config)
    : {};

  // Local state for price input — only dispatches on blur to prevent
  // the team from disappearing mid-edit when "Available" filter is active
  const [localPrice, setLocalPrice] = useState(team.purchasePrice || '');

  // Sync from external state changes (e.g., auto-save load)
  useEffect(() => {
    setLocalPrice(team.purchasePrice || '');
  }, [team.purchasePrice]);

  const handleLocalPriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalPrice(e.target.value);
    },
    []
  );

  const handlePriceBlur = useCallback(() => {
    const price = parseFloat(String(localPrice)) || 0;
    onPriceChange(team.id, price);
  }, [team.id, localPrice, onPriceChange]);

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
    <TableRow className={`${team.isMyTeam ? 'bg-emerald-500/10' : ''} ${indented ? 'bg-muted/10' : ''}`}>
      <TableCell className="px-2 py-1.5 text-xs">{team.seed}</TableCell>
      <TableCell className={`px-2 py-1.5 text-xs font-medium whitespace-nowrap ${indented ? 'pl-6' : ''}`}>
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
          value={localPrice}
          onChange={handleLocalPriceChange}
          onBlur={handlePriceBlur}
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

// ─── BundleRow ──────────────────────────────────────────────────────

interface BundleRowProps {
  bundle: TeamBundle;
  memberTeams: Team[];
  payoutRules: PayoutRules;
  potSize: number;
  onPriceChange: (teamId: number, price: number) => void;
  onMyTeamToggle: (teamId: number, isMyTeam: boolean) => void;
  locked?: boolean;
}

export const BundleRow = memo(function BundleRow({
  bundle,
  memberTeams,
  payoutRules,
  potSize,
  onPriceChange,
  onMyTeamToggle,
  locked,
}: BundleRowProps) {
  const { config } = useAuction();
  const rounds = config?.rounds ?? [];
  const [expanded, setExpanded] = useState(false);

  // Combined fair value = sum of member fair values
  const combinedFairValue = memberTeams.reduce((sum, t) => sum + t.fairValue, 0);
  const combinedBid = combinedFairValue * 0.95;

  // Combined price = sum of member purchase prices
  const combinedPrice = memberTeams.reduce((sum, t) => sum + t.purchasePrice, 0);

  // All members owned?
  const allMine = memberTeams.length > 0 && memberTeams.every((t) => t.isMyTeam);
  const someMine = memberTeams.some((t) => t.isMyTeam);

  // Combined profits per round = sum of member profits
  const memberProfits = memberTeams.map((t) =>
    config ? calculateRoundProfits(t.purchasePrice, payoutRules, potSize, config) : {}
  );
  const combinedProfits: Record<string, number> = {};
  for (const round of rounds) {
    combinedProfits[round.key] = memberProfits.reduce(
      (sum, p) => sum + (p[round.key] ?? 0),
      0
    );
  }

  // Combined odds per round = average of member odds (for display)
  const combinedOdds: Record<string, number> = {};
  for (const round of rounds) {
    combinedOdds[round.key] =
      memberTeams.reduce((sum, t) => sum + (t.odds[round.key] ?? 0), 0) /
      (memberTeams.length || 1);
  }

  // Local price state for the bundle input
  const [localPrice, setLocalPrice] = useState(combinedPrice || '');

  useEffect(() => {
    setLocalPrice(combinedPrice || '');
  }, [combinedPrice]);

  const handlePriceBlur = useCallback(() => {
    const newTotal = parseFloat(String(localPrice)) || 0;
    // Split proportionally by fair value among members
    const totalFV = combinedFairValue || 1;
    for (const team of memberTeams) {
      const share = combinedFairValue > 0 ? (team.fairValue / totalFV) * newTotal : newTotal / memberTeams.length;
      onPriceChange(team.id, Math.round(share * 100) / 100);
    }
  }, [localPrice, memberTeams, combinedFairValue, onPriceChange]);

  const handleMineToggle = useCallback(
    (checked: boolean | 'indeterminate') => {
      const isChecked = checked === true;
      for (const team of memberTeams) {
        onMyTeamToggle(team.id, isChecked);
      }
    },
    [memberTeams, onMyTeamToggle]
  );

  const lowestSeed = Math.min(...memberTeams.map((t) => t.seed));
  const highestSeed = Math.max(...memberTeams.map((t) => t.seed));
  const seedDisplay = lowestSeed === highestSeed ? `${lowestSeed}` : `${lowestSeed}-${highestSeed}`;

  if (locked) {
    return (
      <>
        <TableRow className="opacity-60 bg-muted/30">
          <TableCell className="px-2 py-1.5 text-xs">{seedDisplay}</TableCell>
          <TableCell className="px-2 py-1.5 text-xs font-medium whitespace-nowrap">
            <span className="inline-flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              {bundle.name}
              <span className="text-[10px] text-muted-foreground">({memberTeams.length})</span>
            </span>
          </TableCell>
          <TableCell className="px-2 py-1.5 text-xs">—</TableCell>
          {rounds.map((round) => (
            <TableCell key={round.key} className="px-2 py-1.5 text-center">
              <div className="text-xs select-none blur-[3px]">$---.--</div>
              <div className="text-[10px] select-none blur-[3px]">--.-%</div>
            </TableCell>
          ))}
          <TableCell className="px-2 py-1.5 text-right text-xs select-none blur-[3px]">$---.--</TableCell>
          <TableCell className="px-2 py-1.5 text-right text-xs select-none blur-[3px]">$---.--</TableCell>
          <TableCell className="px-2 py-1.5">
            <Input type="number" placeholder="0" disabled className="h-7 w-20 text-right text-xs tabular-nums opacity-50" />
          </TableCell>
          <TableCell className="px-2 py-1.5 text-center">
            <Checkbox disabled />
          </TableCell>
        </TableRow>
      </>
    );
  }

  return (
    <>
      {/* Bundle summary row */}
      <TableRow
        className={`cursor-pointer hover:bg-muted/40 ${allMine ? 'bg-emerald-500/10' : 'bg-muted/20'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="px-2 py-1.5 text-xs">{seedDisplay}</TableCell>
        <TableCell className="px-2 py-1.5 text-xs font-medium whitespace-nowrap">
          <span className="inline-flex items-center gap-1">
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            {bundle.name}
            <span className="text-[10px] text-muted-foreground">({memberTeams.length})</span>
          </span>
        </TableCell>
        <TableCell className="px-2 py-1.5 text-xs">—</TableCell>

        {rounds.map((round) => (
          <TableCell key={round.key} className="px-2 py-1.5 text-center">
            <div
              className={`text-xs font-medium tabular-nums ${
                combinedProfits[round.key] > 0
                  ? 'text-emerald-400'
                  : combinedProfits[round.key] < 0
                  ? 'text-red-400'
                  : ''
              }`}
            >
              {formatCurrency(combinedProfits[round.key] ?? 0)}
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {formatPercent(combinedOdds[round.key] ?? 0)}
            </div>
          </TableCell>
        ))}

        <TableCell className="px-2 py-1.5 text-right text-xs font-medium tabular-nums text-emerald-400">
          {formatCurrency(combinedBid)}
        </TableCell>
        <TableCell className="px-2 py-1.5 text-right text-xs font-medium tabular-nums">
          {formatCurrency(combinedFairValue)}
        </TableCell>
        <TableCell className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
          <Input
            type="number"
            min={0}
            step={1}
            value={localPrice}
            onChange={(e) => setLocalPrice(e.target.value)}
            onBlur={handlePriceBlur}
            placeholder="0"
            className="h-7 w-20 text-right text-xs tabular-nums"
          />
        </TableCell>
        <TableCell className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={allMine ? true : someMine ? 'indeterminate' : false}
            onCheckedChange={handleMineToggle}
            disabled={combinedPrice === 0}
          />
        </TableCell>
      </TableRow>

      {/* Expanded child rows */}
      {expanded &&
        memberTeams.map((team) => (
          <TeamTableRow
            key={team.id}
            team={team}
            payoutRules={payoutRules}
            potSize={potSize}
            onPriceChange={onPriceChange}
            onMyTeamToggle={onMyTeamToggle}
            locked={locked}
            indented
          />
        ))}
    </>
  );
});
