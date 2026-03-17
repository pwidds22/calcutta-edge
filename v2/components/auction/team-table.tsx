'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useAuction } from '@/lib/auction/auction-context';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TeamTableRow, BundleRow } from './team-table-row';
import { BUNDLE_PRESETS } from '@/lib/tournaments/bundles';
import { ArrowUpDown, Lock } from 'lucide-react';
import type { GroupFilter, StatusFilter, SortOption, BundlePreset } from '@/lib/calculations/types';

const PREVIEW_SEED_CUTOFF = 2; // Show seeds 1-2 (8 teams) in free preview

const STATUSES: StatusFilter[] = ['All', 'Available', 'Taken', 'My Teams'];

export function TeamTable() {
  const { state, dispatch, filteredTeams, effectivePotSize, config, bundles, bundlePreset, hasPaid } = useAuction();

  const groups: GroupFilter[] = config
    ? ['All', ...config.groups.map((g) => g.key)]
    : ['All'];

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'seed', label: 'Seed' },
    { value: 'name', label: 'Name' },
    { value: 'valuePercentage', label: 'Value' },
    { value: 'group', label: config?.groupLabel ?? 'Group' },
  ];

  const handlePriceChange = useCallback(
    (teamId: number, price: number) => {
      dispatch({ type: 'UPDATE_PURCHASE_PRICE', teamId, price });
    },
    [dispatch]
  );

  const handleMyTeamToggle = useCallback(
    (teamId: number, isMyTeam: boolean) => {
      dispatch({ type: 'TOGGLE_MY_TEAM', teamId, isMyTeam });
    },
    [dispatch]
  );

  const toggleSortDirection = () => {
    dispatch({
      type: 'SET_SORT',
      option: state.sortOption,
      direction: state.sortDirection === 'asc' ? 'desc' : 'asc',
    });
  };

  const rounds = config?.rounds ?? [];

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={state.groupFilter}
          onValueChange={(v) =>
            dispatch({ type: 'SET_GROUP_FILTER', filter: v as GroupFilter })
          }
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={config?.groupLabel ?? 'Group'} />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={state.statusFilter}
          onValueChange={(v) =>
            dispatch({ type: 'SET_STATUS_FILTER', filter: v as StatusFilter })
          }
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={state.sortOption}
          onValueChange={(v) =>
            dispatch({
              type: 'SET_SORT',
              option: v as SortOption,
              direction: state.sortDirection,
            })
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={toggleSortDirection} className="h-9 w-9">
          <ArrowUpDown className="h-4 w-4" />
        </Button>

        <Input
          type="text"
          placeholder={`Search ${config?.teamLabel?.toLowerCase() ?? 'team'}s...`}
          value={state.searchTerm}
          onChange={(e) =>
            dispatch({ type: 'SET_SEARCH_TERM', term: e.target.value })
          }
          className="w-[180px]"
        />

        <Select
          value={bundlePreset}
          onValueChange={(v) =>
            dispatch({ type: 'SET_BUNDLE_PRESET', preset: v as BundlePreset })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Bundling" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(BUNDLE_PRESETS) as BundlePreset[]).map((key) => (
              <SelectItem key={key} value={key}>
                {BUNDLE_PRESETS[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          {filteredTeams.length} {config?.teamLabel?.toLowerCase() ?? 'team'}s
          {bundles.length > 0 && ` (${bundles.length} bundle${bundles.length !== 1 ? 's' : ''})`}
        </span>
      </div>

      {/* Legend for sub-values */}
      <p className="text-[11px] text-muted-foreground">
        Each round column shows <span className="text-emerald-400">profit</span>/<span className="text-red-400">loss</span> if the team reaches that round. Below: <span className="text-white/70">probability of reaching that round</span>. Hover for more detail.
      </p>

      {/* Data table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {/* Group headers */}
            <TableRow className="bg-muted/50">
              <TableHead colSpan={3} className="text-center text-xs font-semibold">
                {config?.teamLabel ?? 'Team'} Info
              </TableHead>
              <TableHead colSpan={rounds.length} className="text-center text-xs font-semibold">
                Profit After Reaching Round
              </TableHead>
              <TableHead colSpan={3} className="text-center text-xs font-semibold">
                Value Info
              </TableHead>
              <TableHead rowSpan={2} className="text-center text-xs font-semibold align-middle">
                Mine
              </TableHead>
            </TableRow>
            {/* Column headers */}
            <TableRow>
              <TableHead className="px-2 text-xs w-12">Seed</TableHead>
              <TableHead className="px-2 text-xs">{config?.teamLabel ?? 'Team'}</TableHead>
              <TableHead className="px-2 text-xs w-16">{config?.groupLabel ?? 'Group'}</TableHead>
              {rounds.map((round) => (
                <TableHead key={round.key} className="px-2 text-center text-xs" title={round.payoutLabel ?? round.label}>
                  {round.label}
                </TableHead>
              ))}
              <TableHead className="px-2 text-right text-xs" title="Suggested bid (95% of fair value)">Bid</TableHead>
              <TableHead className="px-2 text-right text-xs" title="Fair value based on odds and pot size">Fair Val</TableHead>
              <TableHead className="px-2 text-right text-xs w-24" title="Actual purchase price">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bundles.length > 0 ? (
              <>
                {/* Unbundled teams */}
                {(() => {
                  const bundledTeamIds = new Set(bundles.flatMap((b) => b.teamIds));
                  const unbundledTeams = filteredTeams.filter((t) => !bundledTeamIds.has(t.id));
                  // Filter bundles to only those with at least one member in filteredTeams
                  const visibleBundles = bundles.filter((b) =>
                    b.teamIds.some((id) => filteredTeams.some((t) => t.id === id))
                  );

                  // Interleave: unbundled teams first, then bundles at the end
                  // (bundles are typically low seeds, so they naturally sort after higher-seeded unbundled teams)
                  return (
                    <>
                      {unbundledTeams.map((team) => (
                        <TeamTableRow
                          key={team.id}
                          team={team}
                          payoutRules={state.payoutRules}
                          potSize={effectivePotSize}
                          onPriceChange={handlePriceChange}
                          onMyTeamToggle={handleMyTeamToggle}
                          locked={!hasPaid && team.seed > PREVIEW_SEED_CUTOFF}
                        />
                      ))}
                      {visibleBundles.map((bundle) => {
                        const members = bundle.teamIds
                          .map((id) => state.teams.find((t) => t.id === id))
                          .filter((t): t is typeof state.teams[number] => t != null);
                        return (
                          <BundleRow
                            key={bundle.id}
                            bundle={bundle}
                            memberTeams={members}
                            payoutRules={state.payoutRules}
                            potSize={effectivePotSize}
                            onPriceChange={handlePriceChange}
                            onMyTeamToggle={handleMyTeamToggle}
                            locked={!hasPaid && members.every((t) => t.seed > PREVIEW_SEED_CUTOFF)}
                          />
                        );
                      })}
                    </>
                  );
                })()}
              </>
            ) : (
              filteredTeams.map((team) => (
                <TeamTableRow
                  key={team.id}
                  team={team}
                  payoutRules={state.payoutRules}
                  potSize={effectivePotSize}
                  onPriceChange={handlePriceChange}
                  onMyTeamToggle={handleMyTeamToggle}
                  locked={!hasPaid && team.seed > PREVIEW_SEED_CUTOFF}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Unlock CTA for unpaid users */}
      {!hasPaid && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <Lock className="h-5 w-5 text-white/40" />
          <p className="text-sm font-medium text-white">
            See the full picture. Unlock all {filteredTeams.length} teams.
          </p>
          <p className="text-xs text-white/50">
            Fair values, bid recommendations, and profit projections for every team.
          </p>
          <Link
            href="/payment"
            className="rounded-md bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            Unlock Full Access — $29.99
          </Link>
        </div>
      )}
    </div>
  );
}
