'use client';

import { useState } from 'react';
import { updateSessionSettings } from '@/actions/session';
import type { TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { SessionSettings } from '@/lib/auction/live/types';
import {
  BID_INCREMENT_PRESETS,
  type BidIncrementPreset,
} from '@/lib/auction/live/types';
import { getPayoutPresets } from '@/lib/tournaments/payout-presets';
import {
  X,
  Timer,
  DollarSign,
  Trophy,
  ChevronDown,
  ChevronUp,
  Zap,
  Save,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type PayoutMode = 'balanced' | 'topHeavy' | 'withProps' | 'custom';

interface EditSettingsModalProps {
  sessionId: string;
  config: TournamentConfig;
  currentPayoutRules: PayoutRules;
  currentEstimatedPotSize: number;
  currentSettings: SessionSettings;
  onClose: () => void;
  onSaved: (updates: {
    payoutRules: PayoutRules;
    estimatedPotSize: number;
    settings: SessionSettings;
  }) => void;
}

export function EditSettingsModal({
  sessionId,
  config,
  currentPayoutRules,
  currentEstimatedPotSize,
  currentSettings,
  onClose,
  onSaved,
}: EditSettingsModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pot + min bid
  const [potSize, setPotSize] = useState(String(currentEstimatedPotSize));
  const [minimumBid, setMinimumBid] = useState(String(currentSettings.minimumBid ?? 0));

  // Bid increment preset — detect which preset matches current values
  const detectBidPreset = (): BidIncrementPreset => {
    const current = currentSettings.bidIncrements;
    if (!current) return 'medium';
    for (const [key, preset] of Object.entries(BID_INCREMENT_PRESETS)) {
      if (
        preset.values.length === current.length &&
        preset.values.every((v, i) => v === current[i])
      ) {
        return key as BidIncrementPreset;
      }
    }
    return 'medium';
  };
  const [bidPreset, setBidPreset] = useState<BidIncrementPreset>(detectBidPreset);

  // Timer
  const [timerEnabled, setTimerEnabled] = useState(currentSettings.timer?.enabled ?? false);
  const [initialDuration, setInitialDuration] = useState(
    String(currentSettings.timer?.initialDurationSec ?? 20)
  );
  const [resetDuration, setResetDuration] = useState(
    String(currentSettings.timer?.resetDurationSec ?? 8)
  );
  const [autoMode, setAutoMode] = useState(currentSettings.autoMode ?? false);

  // Payout rules
  const presets = getPayoutPresets(config.id);
  const [payoutMode, setPayoutMode] = useState<PayoutMode>('custom');
  const [customRules, setCustomRules] = useState<PayoutRules>({ ...currentPayoutRules });
  const [showCustomEditor, setShowCustomEditor] = useState(false);

  const rounds = config.rounds ?? [];
  const propBets = config.propBets ?? [];

  const getActiveRules = (): PayoutRules => {
    if (payoutMode === 'custom') return customRules;
    return presets[payoutMode]?.rules ?? config.defaultPayoutRules ?? {};
  };

  const activeRules = getActiveRules();
  const totalPercent =
    rounds.reduce((sum, r) => sum + (activeRules[r.key] ?? 0) * r.teamsAdvancing, 0) +
    propBets.reduce((sum, p) => sum + (activeRules[p.key] ?? 0), 0);

  const handlePresetSelect = (mode: PayoutMode) => {
    setPayoutMode(mode);
    if (mode !== 'custom' && presets[mode]) {
      setCustomRules({ ...presets[mode].rules });
    }
  };

  const handleCustomRuleChange = (key: string, value: string) => {
    setCustomRules((prev) => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const payoutRules = getActiveRules();
    const settingsUpdate: Partial<SessionSettings> = {
      bidIncrements: [...BID_INCREMENT_PRESETS[bidPreset].values],
      timer: {
        enabled: timerEnabled,
        initialDurationSec: Math.max(5, Math.min(120, Number(initialDuration) || 20)),
        resetDurationSec: Math.max(3, Math.min(30, Number(resetDuration) || 8)),
      },
      autoMode: timerEnabled && autoMode,
      minimumBid: Math.max(0, Number(minimumBid) || 0) || undefined,
    };

    const result = await updateSessionSettings(sessionId, {
      payoutRules,
      estimatedPotSize: Number(potSize) || 10000,
      settings: settingsUpdate,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
    } else {
      onSaved({
        payoutRules,
        estimatedPotSize: Number(potSize) || 10000,
        settings: { ...currentSettings, ...settingsUpdate },
      });
      onClose();
    }
  };

  const presetEntries = Object.entries(presets) as [PayoutMode, (typeof presets)[string]][];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="size-5" />
        </button>

        <h2 className="text-lg font-semibold text-white mb-1">Edit Auction Settings</h2>
        <p className="text-xs text-white/40 mb-5">
          Changes apply to all participants immediately.
        </p>

        <div className="space-y-5">
          {/* Estimated Pot Size */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              Estimated Pot Size
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">$</span>
              <input
                type="number"
                value={potSize}
                onChange={(e) => setPotSize(e.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] pl-7 pr-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Minimum Bid */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              Minimum Bid
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">$</span>
              <input
                type="number"
                value={minimumBid}
                onChange={(e) => setMinimumBid(e.target.value)}
                min={0}
                className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] pl-7 pr-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Payout Rules */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              <Trophy className="inline size-3.5 mr-1" />
              Payout Structure
            </label>
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

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-white/30">
                Total:{' '}
                <span className={`font-medium ${Math.abs(totalPercent - 100) < 0.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
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

            {showCustomEditor && (
              <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
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
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">%</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-white/20">
                        {round.teamsAdvancing} teams = {((customRules[round.key] ?? 0) * round.teamsAdvancing).toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bid Increments */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              <DollarSign className="inline size-3.5 mr-1" />
              Quick Bid Buttons
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(BID_INCREMENT_PRESETS) as [BidIncrementPreset, (typeof BID_INCREMENT_PRESETS)[BidIncrementPreset]][]).map(
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
          </div>

          {/* Timer */}
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
              <div className={`h-5 w-9 rounded-full p-0.5 transition-colors ${timerEnabled ? 'bg-emerald-500' : 'bg-white/20'}`}>
                <div className={`size-4 rounded-full bg-white transition-transform ${timerEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>

            {timerEnabled && (
              <div className="mt-2 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Initial countdown</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={initialDuration}
                        onChange={(e) => setInitialDuration(e.target.value)}
                        min={5}
                        max={120}
                        className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 pr-8 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">sec</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Reset on new bid</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={resetDuration}
                        onChange={(e) => setResetDuration(e.target.value)}
                        min={3}
                        max={30}
                        className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 pr-8 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">sec</span>
                    </div>
                  </div>
                </div>

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
                    <span className="text-sm">{autoMode ? 'Auto-auction enabled' : 'Auto-auction (hands-free)'}</span>
                  </div>
                  <div className={`h-5 w-9 rounded-full p-0.5 transition-colors ${autoMode ? 'bg-amber-500' : 'bg-white/20'}`}>
                    <div className={`size-4 rounded-full bg-white transition-transform ${autoMode ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
