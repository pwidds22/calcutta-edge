'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createSession } from '@/actions/session';
import type { TournamentConfig, PayoutRules, BundlePreset } from '@/lib/tournaments/types';
import {
  BID_INCREMENT_PRESETS,
  type BidIncrementPreset,
  type SessionSettings,
} from '@/lib/auction/live/types';
import { getPayoutPresets, type PayoutPreset } from '@/lib/tournaments/payout-presets';
import { BUNDLE_PRESETS, generateBundles, countAuctionItems } from '@/lib/tournaments/bundles';
import { getTournament } from '@/lib/tournaments/registry';
import { getStandardProps, type EnabledProp } from '@/lib/tournaments/props';
import { ArrowLeft, Gavel, Timer, DollarSign, Trophy, ChevronDown, ChevronUp, Zap, Lock, Layers, Dice5, Plus, X } from 'lucide-react';
import Link from 'next/link';

/** Check if a tournament's hosting window is open (pure client-side check) */
function isHostable(t: TournamentConfig): boolean {
  if (!t.hostingOpensAt) return true;
  return new Date() >= new Date(t.hostingOpensAt);
}

/** Format a date string nicely for display, e.g. "Mar 1" */
function formatGateDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface CreateSessionFormProps {
  tournaments: TournamentConfig[];
  initialTournamentId?: string;
}

type PayoutMode = 'balanced' | 'topHeavy' | 'withProps' | 'custom';

export function CreateSessionForm({ tournaments, initialTournamentId }: CreateSessionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use initialTournamentId from URL if provided (and hostable), otherwise first hostable active tournament
  const defaultTournament =
    (initialTournamentId && tournaments.find((t) => t.id === initialTournamentId && isHostable(t))) ||
    tournaments.find((t) => t.isActive && isHostable(t)) ||
    tournaments.find((t) => isHostable(t)) ||
    tournaments[0];

  const [name, setName] = useState('');
  const [tournamentId, setTournamentId] = useState(defaultTournament?.id ?? '');
  const [potSize, setPotSize] = useState('10000');
  const [minimumBid, setMinimumBid] = useState('1');

  // Bundle preset + custom bundles
  const [bundlePreset, setBundlePreset] = useState<BundlePreset>('none');
  const [customBundles, setCustomBundles] = useState<import('@/lib/tournaments/types').TeamBundle[]>([]);
  const [newBundleName, setNewBundleName] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());

  // Bid increment preset
  const [bidPreset, setBidPreset] = useState<BidIncrementPreset>('medium');

  // Timer settings
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [initialDuration, setInitialDuration] = useState('20');
  const [resetDuration, setResetDuration] = useState('8');

  // Auto-auction mode (requires timer)
  const [autoMode, setAutoMode] = useState(false);

  // Optional session password
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Payout rules
  const [payoutMode, setPayoutMode] = useState<PayoutMode>('balanced');
  const [customRules, setCustomRules] = useState<PayoutRules>({});
  const [showCustomEditor, setShowCustomEditor] = useState(false);

  // Prop bets — which standard props are enabled + custom props
  const [enabledPropKeys, setEnabledPropKeys] = useState<Set<string>>(new Set());
  const [propPercentages, setPropPercentages] = useState<Record<string, number>>({});
  const [customProps, setCustomProps] = useState<Array<{ id: string; label: string; percentage: number }>>([]);
  const [showPropsSection, setShowPropsSection] = useState(false);

  const selectedTournament = tournaments.find((t) => t.id === tournamentId);
  const presets = selectedTournament ? getPayoutPresets(selectedTournament.id) : {};
  const standardProps = selectedTournament ? getStandardProps(selectedTournament.id) : [];

  const getActiveRules = (): PayoutRules => {
    if (payoutMode === 'custom') return customRules;
    return presets[payoutMode]?.rules ?? selectedTournament?.defaultPayoutRules ?? {};
  };

  const handlePresetSelect = (mode: PayoutMode) => {
    setPayoutMode(mode);
    if (mode !== 'custom' && presets[mode]) {
      setCustomRules({ ...presets[mode].rules });
    }
  };

  const handleCustomRuleChange = (key: string, value: string) => {
    setCustomRules((prev) => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const rounds = selectedTournament?.rounds ?? [];
  const propBets = selectedTournament?.propBets ?? [];
  const activeRules = getActiveRules();

  // Look up tournament teams from registry for bundle computation
  const tournamentEntry = selectedTournament ? getTournament(selectedTournament.id) : undefined;
  const tournamentTeams = tournamentEntry?.teams ?? [];

  // Compute bundles for the selected preset + tournament
  const playInBundles = selectedTournament && tournamentTeams.length > 0
    ? generateBundles(bundlePreset === 'custom' ? 'custom' : bundlePreset, tournamentTeams, selectedTournament)
    : [];
  // For custom mode, combine play-in bundles with user-defined bundles
  const currentBundles = bundlePreset === 'custom'
    ? [...playInBundles, ...customBundles]
    : playInBundles;
  const auctionItemCount = tournamentTeams.length > 0
    ? countAuctionItems(tournamentTeams, currentBundles)
    : 0;

  // IDs already in a bundle (play-in or custom) — used to filter team picker
  const bundledTeamIds = new Set(currentBundles.flatMap((b) => b.teamIds));

  // Compute prop totals from enabled props
  const enabledPropTotal = standardProps
    .filter((p) => enabledPropKeys.has(p.key))
    .reduce((sum, p) => sum + (propPercentages[p.key] ?? p.defaultPercentage), 0)
    + customProps.reduce((sum, cp) => sum + cp.percentage, 0);

  const totalPercent = rounds.reduce(
    (sum, r) => sum + (activeRules[r.key] ?? 0) * r.teamsAdvancing,
    0
  ) + propBets.reduce((sum, p) => sum + (activeRules[p.key] ?? 0), 0)
    + enabledPropTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give your auction a name');
      return;
    }
    if (!selectedTournament) {
      setError('Select a tournament');
      return;
    }
    if (!isHostable(selectedTournament)) {
      setError(`Hosting for ${selectedTournament.name} opens ${selectedTournament.hostingOpensAt ? formatGateDate(selectedTournament.hostingOpensAt) : 'later'}`);
      return;
    }

    setLoading(true);
    setError(null);

    const payoutRules = getActiveRules();

    const submitEntry = getTournament(selectedTournament.id);
    const submitTeams = submitEntry?.teams ?? [];
    // For custom mode: play-in bundles + user-defined custom bundles
    const baseBundles = submitTeams.length > 0
      ? generateBundles(bundlePreset === 'custom' ? 'custom' : bundlePreset, submitTeams, selectedTournament)
      : [];
    const bundles = bundlePreset === 'custom'
      ? [...baseBundles, ...customBundles]
      : baseBundles;

    // Build enabledProps from toggle state
    const enabledProps: EnabledProp[] = [
      ...standardProps
        .filter((p) => enabledPropKeys.has(p.key))
        .map((p) => ({
          key: p.key,
          label: p.label,
          percentage: propPercentages[p.key] ?? p.defaultPercentage,
        })),
      ...customProps.map((cp) => ({
        key: `custom_${cp.id}`,
        label: cp.label,
        percentage: cp.percentage,
        isCustom: true as const,
        customLabel: cp.label,
      })),
    ];

    const settings: SessionSettings = {
      bidIncrements: [...BID_INCREMENT_PRESETS[bidPreset].values],
      timer: {
        enabled: timerEnabled,
        initialDurationSec: Math.max(5, Math.min(120, Number(initialDuration) || 20)),
        resetDurationSec: Math.max(3, Math.min(30, Number(resetDuration) || 8)),
      },
      autoMode: timerEnabled && autoMode,
      bundles,
      bundlePreset,
      enabledProps: enabledProps.length > 0 ? enabledProps : undefined,
      minimumBid: Math.max(0, Number(minimumBid) || 0) || undefined,
    };

    const result = await createSession({
      tournamentId,
      name: name.trim(),
      payoutRules,
      estimatedPotSize: Number(potSize) || 10000,
      settings,
      password: password.trim() || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else if (result.sessionId) {
      router.push(`/host/${result.sessionId}`);
    }
  };

  const presetEntries: [PayoutMode, PayoutPreset][] = Object.entries(presets).map(
    ([key, preset]) => [key as PayoutMode, preset]
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/host"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </Link>
        <h1 className="mt-3 text-xl font-bold text-white">
          Create Live Auction
        </h1>
        <p className="mt-1 text-sm text-white/40">
          Set up your pool, invite participants, and run the auction live.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Auction name */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">
            Auction Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Office March Madness 2026"'
            className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>

        {/* Tournament */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">
            Tournament
          </label>
          <select
            value={tournamentId}
            onChange={(e) => {
              setTournamentId(e.target.value);
              // Reset payout mode when switching tournaments (presets differ per sport)
              setPayoutMode('balanced');
              setCustomRules({});
              setShowCustomEditor(false);
            }}
            className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          >
            {tournaments.map((t) => {
              const hostable = isHostable(t);
              return (
                <option key={t.id} value={t.id} disabled={!hostable} className="bg-zinc-900">
                  {t.name}{!hostable && t.hostingOpensAt ? ` — Opens ${formatGateDate(t.hostingOpensAt)}` : ''}
                </option>
              );
            })}
          </select>
          {selectedTournament && !isHostable(selectedTournament) && selectedTournament.hostingOpensAt && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400/80">
              <Lock className="size-3" />
              Hosting opens {formatGateDate(selectedTournament.hostingOpensAt)}. Check back then!
            </p>
          )}
        </div>

        {/* Estimated pot size */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">
            Estimated Pot Size
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
              $
            </span>
            <input
              type="number"
              value={potSize}
              onChange={(e) => setPotSize(e.target.value)}
              className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] pl-7 pr-3 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
          <p className="mt-1 text-xs text-white/30">
            This is just an estimate — the real pot size is calculated from actual sales.
          </p>
        </div>

        {/* Minimum Bid */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">
            Minimum Bid
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
              $
            </span>
            <input
              type="number"
              value={minimumBid}
              onChange={(e) => setMinimumBid(e.target.value)}
              min={0}
              className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] pl-7 pr-3 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
          <p className="mt-1 text-xs text-white/30">
            Floor price for all teams. Set to 0 for no minimum.
          </p>
        </div>

        {/* Team Bundling */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">
            <Layers className="inline size-3.5 mr-1" />
            Team Bundling
          </label>
          <p className="text-xs text-white/30 mb-2">
            Bundle low-seed teams together to speed up the auction.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.entries(BUNDLE_PRESETS) as [BundlePreset, typeof BUNDLE_PRESETS[BundlePreset]][]).map(
              ([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setBundlePreset(key);
                    if (key !== 'custom') {
                      setCustomBundles([]);
                      setSelectedTeamIds(new Set());
                      setNewBundleName('');
                    }
                  }}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    bundlePreset === key
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                      : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/70'
                  }`}
                >
                  <div className="text-xs font-medium">{preset.label}</div>
                  <div className="text-[10px] opacity-60">{preset.description}</div>
                </button>
              )
            )}
          </div>
          {/* Custom Bundle Builder */}
          {bundlePreset === 'custom' && selectedTournament && tournamentTeams.length > 0 && (
            <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3 space-y-3">
              {/* Existing custom bundles */}
              {customBundles.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-white/40 uppercase tracking-wide">
                    Your Bundles ({customBundles.length})
                  </p>
                  {customBundles.map((bundle) => (
                    <div
                      key={bundle.id}
                      className="flex items-center justify-between rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-white/80">{bundle.name}</span>
                        <span className="ml-2 text-[10px] text-white/30">
                          {bundle.teamIds
                            .map((id) => tournamentTeams.find((t) => t.id === id)?.name ?? `#${id}`)
                            .join(', ')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCustomBundles((prev) => prev.filter((b) => b.id !== bundle.id))
                        }
                        className="ml-2 flex-shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Create new bundle */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-white/40 uppercase tracking-wide">
                  Create Bundle
                </p>
                <input
                  type="text"
                  value={newBundleName}
                  onChange={(e) => setNewBundleName(e.target.value)}
                  placeholder="Bundle name (e.g. Bottom Seeds)"
                  className="h-8 w-full rounded border border-white/10 bg-white/[0.04] px-2.5 text-xs text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 max-h-40 overflow-y-auto">
                  {tournamentTeams
                    .filter((t) => !bundledTeamIds.has(t.id) || selectedTeamIds.has(t.id))
                    .sort((a, b) => a.seed - b.seed || a.group.localeCompare(b.group))
                    .map((team) => {
                      const isSelected = selectedTeamIds.has(team.id);
                      const isAlreadyBundled = bundledTeamIds.has(team.id) && !isSelected;
                      return (
                        <button
                          key={team.id}
                          type="button"
                          disabled={isAlreadyBundled}
                          onClick={() => {
                            setSelectedTeamIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(team.id)) next.delete(team.id);
                              else next.add(team.id);
                              return next;
                            });
                          }}
                          className={`rounded border px-2 py-1 text-left text-[10px] transition-colors ${
                            isSelected
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                              : isAlreadyBundled
                                ? 'border-white/[0.04] bg-white/[0.01] text-white/20 cursor-not-allowed'
                                : 'border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-white/10 hover:text-white/70'
                          }`}
                        >
                          <span className="font-medium">{team.seed}</span>{' '}
                          {team.name}
                        </button>
                      );
                    })}
                </div>
                {selectedTeamIds.size >= 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const ids = Array.from(selectedTeamIds);
                      const name =
                        newBundleName.trim() ||
                        ids
                          .map((id) => tournamentTeams.find((t) => t.id === id)?.name ?? `#${id}`)
                          .join(' / ');
                      setCustomBundles((prev) => [
                        ...prev,
                        {
                          id: `custom-${crypto.randomUUID().slice(0, 8)}`,
                          name,
                          teamIds: ids,
                        },
                      ]);
                      setSelectedTeamIds(new Set());
                      setNewBundleName('');
                    }}
                    className="flex items-center gap-1.5 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
                  >
                    <Plus className="size-3" />
                    Create Bundle ({selectedTeamIds.size} teams)
                  </button>
                )}
                {selectedTeamIds.size === 1 && (
                  <p className="text-[10px] text-white/30">
                    Select at least 2 teams to create a bundle
                  </p>
                )}
              </div>
            </div>
          )}

          {selectedTournament && tournamentTeams.length > 0 && (
            <p className="mt-1.5 text-xs text-white/30">
              Auction items: <span className="font-medium text-white/50">{auctionItemCount}</span>
              {currentBundles.length > 0 && (
                <span>
                  {' '}({tournamentTeams.length} teams → {auctionItemCount} items with {currentBundles.length} bundle{currentBundles.length !== 1 ? 's' : ''})
                </span>
              )}
            </p>
          )}
        </div>

        {/* Payout Rules */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">
            <Trophy className="inline size-3.5 mr-1" />
            Payout Structure
          </label>
          <p className="text-xs text-white/30 mb-2">
            How the pot is distributed across tournament rounds.
          </p>

          {/* Preset selector */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {presetEntries.map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetSelect(key)}
                className={`rounded-md border px-3 py-2 text-left transition-colors ${
                  payoutMode === key
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                    : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/70'
                }`}
              >
                <div className="text-xs font-medium">{preset.label}</div>
                <div className="text-[10px] opacity-60">{preset.description}</div>
              </button>
            ))}
          </div>

          {/* Total and customize toggle */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-white/30">
              Total payout:{' '}
              <span
                className={`font-medium ${
                  Math.abs(totalPercent - 100) < 0.5
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {totalPercent.toFixed(1)}%
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                if (!showCustomEditor) {
                  setCustomRules({ ...activeRules });
                  setPayoutMode('custom');
                }
                setShowCustomEditor(!showCustomEditor);
              }}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Customize
              {showCustomEditor ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          </div>

          {/* Custom editor */}
          {showCustomEditor && (
            <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3 space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
                {rounds.map((round) => (
                  <div key={round.key}>
                    <label className="block text-[10px] text-white/40 mb-0.5">
                      {round.payoutLabel}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={customRules[round.key] ?? 0}
                        onChange={(e) => handleCustomRuleChange(round.key, e.target.value)}
                        className="h-8 w-full rounded border border-white/10 bg-white/[0.04] px-2 pr-6 text-right text-xs text-white focus:border-emerald-500/50 focus:outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                        %
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-white/20">
                      {round.teamsAdvancing} {selectedTournament?.teamLabel?.toLowerCase() ?? 'team'}s = {((customRules[round.key] ?? 0) * round.teamsAdvancing).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>

              {propBets.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  {propBets.map((prop) => (
                    <div key={prop.key}>
                      <label className="block text-[10px] text-white/40 mb-0.5">
                        {prop.label}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={customRules[prop.key] ?? 0}
                          onChange={(e) => handleCustomRuleChange(prop.key, e.target.value)}
                          className="h-8 w-full rounded border border-white/10 bg-white/[0.04] px-2 pr-6 text-right text-xs text-white focus:border-emerald-500/50 focus:outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                          %
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prop Bets */}
        {standardProps.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowPropsSection(!showPropsSection)}
              className="flex w-full items-center justify-between mb-1.5"
            >
              <span className="flex items-center gap-1 text-sm font-medium text-white/60">
                <Dice5 className="size-3.5" />
                Prop Bets
                <span className="text-[10px] text-white/30">(optional)</span>
              </span>
              {showPropsSection ? <ChevronUp className="size-4 text-white/30" /> : <ChevronDown className="size-4 text-white/30" />}
            </button>
            <p className="text-xs text-white/30 mb-2">
              Side bets that pay out to a single winner — biggest upset, highest seed in Final Four, etc.
            </p>

            {showPropsSection && (
              <div className="space-y-3 rounded-md border border-white/10 bg-white/[0.02] p-3">
                {/* Standard props */}
                {standardProps.map((prop) => {
                  const isEnabled = enabledPropKeys.has(prop.key);
                  const pct = propPercentages[prop.key] ?? prop.defaultPercentage;
                  return (
                    <div key={prop.key} className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEnabledPropKeys((prev) => {
                            const next = new Set(prev);
                            if (next.has(prop.key)) next.delete(prop.key);
                            else next.add(prop.key);
                            return next;
                          });
                        }}
                        className={`mt-0.5 flex size-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                          isEnabled
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-white/20 bg-white/[0.04] text-transparent'
                        }`}
                      >
                        {isEnabled && (
                          <svg className="size-3" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${isEnabled ? 'text-white' : 'text-white/40'}`}>
                            {prop.label}
                          </span>
                          {isEnabled && (
                            <div className="relative">
                              <input
                                type="number"
                                min={0.5}
                                max={50}
                                step={0.5}
                                value={pct}
                                onChange={(e) =>
                                  setPropPercentages((prev) => ({
                                    ...prev,
                                    [prop.key]: parseFloat(e.target.value) || 0,
                                  }))
                                }
                                className="h-6 w-16 rounded border border-white/10 bg-white/[0.04] px-1.5 pr-5 text-right text-[11px] text-white focus:border-emerald-500/50 focus:outline-none"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-white/30">
                                %
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-white/25 mt-0.5">{prop.description}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Custom props */}
                {customProps.map((cp) => (
                  <div key={cp.id} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCustomProps((prev) => prev.filter((p) => p.id !== cp.id))}
                      className="flex size-5 flex-shrink-0 items-center justify-center rounded border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                    <input
                      type="text"
                      value={cp.label}
                      onChange={(e) =>
                        setCustomProps((prev) =>
                          prev.map((p) => (p.id === cp.id ? { ...p, label: e.target.value } : p))
                        )
                      }
                      placeholder="Prop name"
                      className="h-7 flex-1 rounded border border-white/10 bg-white/[0.04] px-2 text-xs text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        min={0.5}
                        max={50}
                        step={0.5}
                        value={cp.percentage}
                        onChange={(e) =>
                          setCustomProps((prev) =>
                            prev.map((p) =>
                              p.id === cp.id ? { ...p, percentage: parseFloat(e.target.value) || 0 } : p
                            )
                          )
                        }
                        className="h-6 w-16 rounded border border-white/10 bg-white/[0.04] px-1.5 pr-5 text-right text-[11px] text-white focus:border-emerald-500/50 focus:outline-none"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-white/30">
                        %
                      </span>
                    </div>
                  </div>
                ))}

                {/* Add custom prop button */}
                <button
                  type="button"
                  onClick={() =>
                    setCustomProps((prev) => [
                      ...prev,
                      { id: crypto.randomUUID(), label: '', percentage: 5 },
                    ])
                  }
                  className="flex items-center gap-1.5 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
                >
                  <Plus className="size-3" />
                  Add Custom Prop
                </button>

                {enabledPropTotal > 0 && (
                  <p className="text-[10px] text-white/30 pt-1 border-t border-white/[0.06]">
                    Props total: <span className="font-medium text-amber-400/70">{enabledPropTotal.toFixed(1)}%</span> of pot
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bid Increments */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">
            <DollarSign className="inline size-3.5 mr-1" />
            Quick Bid Buttons
          </label>
          <p className="text-xs text-white/30 mb-2">
            Shortcuts participants tap to raise the bid quickly.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(Object.entries(BID_INCREMENT_PRESETS) as [BidIncrementPreset, typeof BID_INCREMENT_PRESETS[BidIncrementPreset]][]).map(
              ([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBidPreset(key)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    bidPreset === key
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                      : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/70'
                  }`}
                >
                  <div className="text-xs font-medium">{preset.label}</div>
                  <div className="text-[10px] opacity-60">{preset.description}</div>
                </button>
              )
            )}
          </div>
          <p className="mt-1.5 text-xs text-white/30">
            Buttons shown: {BID_INCREMENT_PRESETS[bidPreset].values.map((v) => `+$${v}`).join(', ')}
          </p>
        </div>

        {/* Bidding Timer */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-white/60 mb-1.5">
            <Timer className="size-3.5" />
            Bidding Timer
          </label>
          <button
            type="button"
            onClick={() => {
              const next = !timerEnabled;
              setTimerEnabled(next);
              if (!next) setAutoMode(false);
            }}
            className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 transition-colors ${
              timerEnabled
                ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20'
            }`}
          >
            <span className="text-sm">
              {timerEnabled ? 'Countdown timer enabled' : 'No timer (manual close)'}
            </span>
            <div
              className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                timerEnabled ? 'bg-emerald-500' : 'bg-white/20'
              }`}
            >
              <div
                className={`size-4 rounded-full bg-white transition-transform ${
                  timerEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          {timerEnabled && (
            <div className="mt-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">
                    Initial countdown
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={initialDuration}
                      onChange={(e) => setInitialDuration(e.target.value)}
                      min={5}
                      max={120}
                      className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 pr-8 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">
                      sec
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">
                    Reset on new bid
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={resetDuration}
                      onChange={(e) => setResetDuration(e.target.value)}
                      min={3}
                      max={30}
                      className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 pr-8 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">
                      sec
                    </span>
                  </div>
                </div>
              </div>

              {/* Auto-auction mode */}
              <button
                type="button"
                onClick={() => setAutoMode(!autoMode)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 transition-colors ${
                  autoMode
                    ? 'border-amber-500/50 bg-amber-500/10 text-white'
                    : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap className={`size-3.5 ${autoMode ? 'text-amber-400' : 'text-white/40'}`} />
                  <div className="text-left">
                    <span className="text-sm">
                      {autoMode ? 'Auto-auction enabled' : 'Auto-auction (hands-free)'}
                    </span>
                    <p className="text-[10px] opacity-50">
                      {autoMode
                        ? 'Bidding opens, closes, and advances automatically'
                        : 'Commissioner controls each step manually'}
                    </p>
                  </div>
                </div>
                <div
                  className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                    autoMode ? 'bg-amber-500' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`size-4 rounded-full bg-white transition-transform ${
                      autoMode ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Optional session password */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Lock className="size-3.5 text-white/40" />
              <span className="text-sm font-medium text-white/60">Session Password</span>
              <span className="text-[10px] text-white/30">(optional)</span>
            </div>
            {showPassword ? (
              <ChevronUp className="size-4 text-white/30" />
            ) : (
              <ChevronDown className="size-4 text-white/30" />
            )}
          </button>
          {showPassword && (
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for no password"
                className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              <p className="mt-1.5 text-[11px] text-white/30">
                Participants will need this password to join. Share it separately from the join link.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Gavel className="size-4" />
          {loading ? 'Creating...' : 'Create Auction'}
        </Button>
      </form>
    </div>
  );
}
