'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuctionProvider, useAuction } from '@/lib/auction/auction-context';
import { useAutoSave } from '@/lib/auction/use-auto-save';
import { PotSizeSection } from './pot-size-section';
import { PayoutRulesEditor } from './payout-rules-editor';
import { SummaryStatsCards } from './summary-stats-cards';
import { TeamTable } from './team-table';
import { OddsSourceSelector } from './odds-source-selector';
import { initializeTeams } from '@/lib/calculations/initialize';
import { buildMarchMadness2026Registry } from '@/lib/tournaments/odds-sources';
import { renameLeague, resetAuctionData } from '@/actions/auction';
import { Lock, Trash2, ChevronDown, Plus, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SavedTeamData, PayoutRules, TournamentConfig, BaseTeam } from '@/lib/calculations/types';

interface AuctionToolInnerProps {
  initialTeams: SavedTeamData[];
  initialPayoutRules: PayoutRules;
  initialPotSize: number;
  config: TournamentConfig;
  baseTeams: BaseTeam[];
  hasPaid: boolean;
  leagueName: string;
  leagueList: string[];
}

function AuctionToolInner({
  initialTeams,
  initialPayoutRules,
  initialPotSize,
  config,
  baseTeams,
  hasPaid,
  leagueName,
  leagueList,
}: AuctionToolInnerProps) {
  const { state, dispatch } = useAuction();
  const { isSaving, lastSaved, error } = useAutoSave();
  const oddsRegistry = useMemo(() => buildMarchMadness2026Registry(), []);

  // Initialize on mount
  useEffect(() => {
    const teams = initializeTeams(
      baseTeams,
      initialTeams,
      initialPayoutRules,
      initialPotSize,
      config
    );
    dispatch({
      type: 'SET_INITIAL_DATA',
      teams,
      payoutRules: initialPayoutRules,
      estimatedPotSize: initialPotSize,
      config,
      leagueName,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading auction data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* League selector */}
      <LeagueSelector
        currentLeague={state.leagueName}
        leagues={leagueList}
        eventType={config.id}
        dispatch={dispatch}
      />

      {/* Upgrade banner for unpaid users */}
      {!hasPaid && (
        <div className="relative overflow-hidden rounded-lg border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0 rounded-full bg-emerald-500/20 p-2">
                <Lock className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  You&apos;re viewing a preview
                </p>
                <p className="text-xs text-white/50">
                  Unlock all {state.teams.length || 64} teams with fair values, bid recommendations, and profit projections.
                </p>
              </div>
            </div>
            <Link
              href="/payment"
              className="w-full shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-emerald-500 transition-colors sm:w-auto"
            >
              Unlock — $29.99
            </Link>
          </div>
        </div>
      )}

      {/* Status bar + Clear All */}
      <ClearAllBar
        dispatch={dispatch}
        hasPurchases={state.teams.some((t) => t.purchasePrice > 0)}
        isSaving={isSaving}
        lastSaved={lastSaved}
        saveError={error}
      />

      {/* Odds source selector */}
      <OddsSourceSelector registry={oddsRegistry} />

      {/* Pot size */}
      <PotSizeSection />

      {/* Payout rules */}
      <PayoutRulesEditor />

      {/* Summary stats */}
      <SummaryStatsCards />

      {/* Team table */}
      <TeamTable />
    </div>
  );
}

// ─── League Selector ─────────────────────────────────────────────────

function LeagueSelector({
  currentLeague,
  leagues,
  eventType,
  dispatch,
}: {
  currentLeague: string;
  leagues: string[];
  eventType: string;
  dispatch: React.Dispatch<import('@/lib/auction/auction-state').AuctionAction>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(currentLeague);
  const [deleting, setDeleting] = useState(false);

  const switchLeague = useCallback(
    (name: string) => {
      setOpen(false);
      router.push(`/auction?league=${encodeURIComponent(name)}`);
    },
    [router]
  );

  const handleCreate = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(false);
    setNewName('');
    // Navigate to the new league — it will be created on first save
    dispatch({ type: 'SET_LEAGUE_NAME', leagueName: trimmed });
    dispatch({ type: 'CLEAR_ALL_PRICES' }); // Start fresh
    router.push(`/auction?league=${encodeURIComponent(trimmed)}`);
  }, [newName, dispatch, router]);

  const handleRename = useCallback(async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === currentLeague) {
      setRenaming(false);
      return;
    }
    const result = await renameLeague(eventType, currentLeague, trimmed);
    if (result.error) return;
    setRenaming(false);
    dispatch({ type: 'SET_LEAGUE_NAME', leagueName: trimmed });
    router.push(`/auction?league=${encodeURIComponent(trimmed)}`);
  }, [renameValue, currentLeague, eventType, dispatch, router]);

  const handleDelete = useCallback(async () => {
    await resetAuctionData(eventType, currentLeague);
    setDeleting(false);
    // Switch to another league or default
    const remaining = leagues.filter((l) => l !== currentLeague);
    const next = remaining[0] ?? 'My Auction';
    router.push(`/auction?league=${encodeURIComponent(next)}`);
  }, [eventType, currentLeague, leagues, router]);

  // Only show selector if user has multiple leagues or wants to create one
  const showSelector = leagues.length > 0;

  return (
    <div className="flex items-center gap-2">
      {/* Current league display / dropdown trigger */}
      <div className="relative">
        <button
          onClick={() => { setOpen(!open); setCreating(false); setDeleting(false); }}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm font-medium text-white hover:border-white/15 transition-colors"
        >
          {renaming ? (
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              maxLength={40}
              className="bg-transparent border-none outline-none text-sm text-white w-40"
            />
          ) : (
            <>
              {currentLeague}
              {showSelector && <ChevronDown className="size-3.5 text-white/30" />}
            </>
          )}
        </button>

        {/* Dropdown */}
        {open && showSelector && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-white/[0.08] bg-[#0d1117] py-1 shadow-xl">
            {leagues.map((league) => (
              <button
                key={league}
                onClick={() => switchLeague(league)}
                className={`flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors ${
                  league === currentLeague
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'
                }`}
              >
                {league}
              </button>
            ))}
            <div className="my-1 border-t border-white/[0.06]" />
            <button
              onClick={() => { setCreating(true); setOpen(false); }}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-sm text-white/40 hover:bg-white/[0.04] hover:text-white/60"
            >
              <Plus className="size-3" />
              New League
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!renaming && !creating && !deleting && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setRenaming(true); setRenameValue(currentLeague); }}
            title="Rename league"
            className="rounded p-1 text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
          >
            <Pencil className="size-3" />
          </button>
          {leagues.length > 1 && (
            <button
              onClick={() => setDeleting(true)}
              title="Delete league"
              className="rounded p-1 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}

      {/* Create new league inline */}
      {creating && (
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setCreating(false);
            }}
            placeholder="League name..."
            autoFocus
            maxLength={40}
            className="h-7 w-44 rounded border border-white/10 bg-white/[0.04] px-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none"
          />
          <Button size="sm" onClick={handleCreate} disabled={!newName.trim()} className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700">
            Create
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)} className="h-7 px-2 text-xs text-white/40">
            Cancel
          </Button>
        </div>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-400">Delete &quot;{currentLeague}&quot;?</span>
          <Button size="sm" variant="destructive" onClick={handleDelete} className="h-6 px-2 text-xs">
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeleting(false)} className="h-6 px-2 text-xs text-white/40">
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Clear All Bar ───────────────────────────────────────────────────

function ClearAllBar({
  dispatch,
  hasPurchases,
  isSaving,
  lastSaved,
  saveError,
}: {
  dispatch: React.Dispatch<import('@/lib/auction/auction-state').AuctionAction>;
  hasPurchases: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  saveError: string | null;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <div>
        {hasPurchases && !confirming && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(true)}
            className="gap-1.5 text-xs text-white/30 hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="size-3" />
            Clear All Bids
          </Button>
        )}
        {confirming && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Reset all bid prices?</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                dispatch({ type: 'CLEAR_ALL_PRICES' });
                setConfirming(false);
              }}
              className="h-6 px-2 text-xs"
            >
              Yes, clear
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              className="h-6 px-2 text-xs text-white/40"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
      <span className="text-xs text-white/30">
        {isSaving
          ? 'Saving...'
          : lastSaved
            ? `Saved ${lastSaved.toLocaleTimeString()}`
            : ''}
        {saveError && <span className="text-red-400"> Error: {saveError}</span>}
      </span>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────

export function AuctionTool(props: AuctionToolInnerProps) {
  return (
    <AuctionProvider hasPaid={props.hasPaid}>
      <AuctionToolInner {...props} />
    </AuctionProvider>
  );
}
