'use client';

import { useState, useCallback, memo } from 'react';
import type { OddsSourceRegistry, OddsSourceProbabilities } from '@/lib/tournaments/odds-sources';
import { blendProbabilities } from '@/lib/tournaments/odds-sources';
import { useAuction } from '@/lib/auction/auction-context';
import { BarChart3, Globe, Sliders, Pencil, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

interface OddsSourceSelectorProps {
  registry: OddsSourceRegistry;
}

const SOURCE_ICONS: Record<string, typeof BarChart3> = {
  model: BarChart3,
  sportsbook: Globe,
  blend: Sliders,
  custom: Pencil,
};

// ─── Custom Odds Editor Row (memoized for perf with 68 teams) ───────────────

interface CustomRowProps {
  teamId: number;
  teamName: string;
  seed: number;
  roundKeys: string[];
  values: Record<string, string>;
  onChange: (teamId: number, roundKey: string, value: string) => void;
}

const CustomOddsRow = memo(function CustomOddsRow({
  teamName,
  seed,
  roundKeys,
  values,
  teamId,
  onChange,
}: CustomRowProps) {
  return (
    <tr className="border-b border-white/[0.03] last:border-0">
      <td className="sticky left-0 bg-[#0d1117] z-10 px-2 py-1 text-[10px] text-white/50 whitespace-nowrap">
        <span className="font-mono text-white/20 mr-1">{seed}</span>
        {teamName}
      </td>
      {roundKeys.map((rk) => (
        <td key={rk} className="px-0.5 py-1">
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={values[rk] ?? '0'}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange(teamId, rk, e.target.value)}
            className="w-14 rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-white/70 text-center
                       border border-transparent focus:border-emerald-500/40 focus:outline-none focus:bg-white/[0.06]
                       [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </td>
      ))}
    </tr>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

export function OddsSourceSelector({ registry }: OddsSourceSelectorProps) {
  const { state, dispatch } = useAuction();

  // Blend state
  const [showBlend, setShowBlend] = useState(false);
  const [blendWeights, setBlendWeights] = useState<Record<string, number>>({
    evan_miya: 34,
    team_rankings: 33,
    fanduel: 0,
    draftkings: 0,
    pinnacle: 33,
  });

  // Custom editor state
  const [showCustom, setShowCustom] = useState(false);
  const [customBase, setCustomBase] = useState('evan_miya');
  const [customDraft, setCustomDraft] = useState<Record<number, Record<string, string>>>({});

  const roundKeys = state.config?.rounds.map((r) => r.key) ?? [];
  const roundLabels = state.config?.rounds.map((r) => r.label) ?? [];
  const teamIds = state.teams.map((t) => t.id);

  // ─── Helpers ──────────────────────────────────────────────────────

  const applySource = (sourceId: string, probs: Record<number, Record<string, number>>) => {
    dispatch({ type: 'SET_ODDS_SOURCE', sourceId, probabilities: probs });
  };

  const seedDraftFromSource = useCallback(
    (sourceId: string) => {
      const data = registry.staticData[sourceId];
      if (!data) return;
      const draft: Record<number, Record<string, string>> = {};
      for (const teamId of teamIds) {
        draft[teamId] = {};
        for (const rk of roundKeys) {
          const prob = data.teams[teamId]?.[rk] ?? 0;
          draft[teamId][rk] = (prob * 100).toFixed(1);
        }
      }
      setCustomDraft(draft);
    },
    [registry.staticData, teamIds, roundKeys]
  );

  const handleDraftChange = useCallback(
    (teamId: number, roundKey: string, value: string) => {
      setCustomDraft((prev) => ({
        ...prev,
        [teamId]: { ...prev[teamId], [roundKey]: value },
      }));
    },
    []
  );

  // ─── Source Click Handler ─────────────────────────────────────────

  const handleSourceClick = (sourceId: string) => {
    if (sourceId === 'blend') {
      setShowCustom(false);
      setShowBlend((prev) => !prev);
      return;
    }
    if (sourceId === 'custom') {
      setShowBlend(false);
      const willShow = !showCustom;
      setShowCustom(willShow);
      if (willShow && Object.keys(customDraft).length === 0) {
        seedDraftFromSource(customBase);
      }
      return;
    }
    if (sourceId === state.oddsSource) return;
    setShowBlend(false);
    setShowCustom(false);
    const data = registry.staticData[sourceId];
    if (data) {
      applySource(sourceId, data.teams);
    }
  };

  // ─── Blend Apply ──────────────────────────────────────────────────

  const handleBlendApply = () => {
    const sources: Array<{ data: OddsSourceProbabilities; weight: number }> = [];
    for (const [sourceId, weight] of Object.entries(blendWeights)) {
      if (weight <= 0) continue;
      const data = registry.staticData[sourceId];
      if (data) {
        sources.push({ data, weight });
      }
    }
    if (sources.length === 0) return;
    const blended = blendProbabilities(sources, teamIds, roundKeys);
    applySource('blend', blended.teams);
  };

  // ─── Custom Apply + Validation ────────────────────────────────────

  const customValidation = (() => {
    if (Object.keys(customDraft).length === 0) return [];
    const errors: string[] = [];

    // Check champ sum
    const champKey = roundKeys[roundKeys.length - 1];
    if (champKey) {
      let champSum = 0;
      for (const rounds of Object.values(customDraft)) {
        champSum += parseFloat(rounds[champKey] ?? '0') || 0;
      }
      if (Math.abs(champSum - 100) > 5) {
        errors.push(`${champKey.toUpperCase()} probs sum to ${champSum.toFixed(1)}% (should be ~100%)`);
      }
    }

    // Check monotonic decrease (sample first 5 violations)
    let monoCount = 0;
    for (const [, rounds] of Object.entries(customDraft)) {
      let prev = 100;
      for (const rk of roundKeys) {
        const v = parseFloat(rounds[rk] ?? '0') || 0;
        if (v > prev + 0.1) {
          monoCount++;
          break;
        }
        prev = v;
      }
    }
    if (monoCount > 0) {
      errors.push(`${monoCount} team(s) have non-monotonic probabilities`);
    }

    return errors;
  })();

  const handleCustomApply = () => {
    const probs: Record<number, Record<string, number>> = {};
    for (const [tidStr, rounds] of Object.entries(customDraft)) {
      const tid = parseInt(tidStr, 10);
      probs[tid] = {};
      for (const rk of roundKeys) {
        probs[tid][rk] = (parseFloat(rounds[rk] ?? '0') || 0) / 100;
      }
    }
    applySource('custom', probs);
  };

  // ─── Source Filtering ─────────────────────────────────────────────

  // Exclude blend and custom from main row — they get special treatment
  const mainSources = registry.sources.filter((s) => s.type !== 'blend' && s.type !== 'custom');
  // All data sources for blend sliders (models + sportsbooks)
  const blendSources = registry.sources.filter((s) => s.type === 'model' || s.type === 'sportsbook');

  // Sorted teams for custom editor
  const sortedTeams = [...state.teams].sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="size-3.5 text-white/30" />
          <span className="text-[10px] uppercase tracking-wider text-white/30">Odds Source</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {/* Model + sportsbook sources */}
          {mainSources.map((source) => {
            const isActive = state.oddsSource === source.id;
            const Icon = SOURCE_ICONS[source.type] ?? BarChart3;
            return (
              <button
                key={source.id}
                onClick={() => handleSourceClick(source.id)}
                title={source.description}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60'
                }`}
              >
                <Icon className="size-3" />
                {source.name}
              </button>
            );
          })}

          {/* Blend toggle */}
          <button
            onClick={() => handleSourceClick('blend')}
            title="Custom weighted blend of sources"
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              state.oddsSource === 'blend'
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60'
            }`}
          >
            <Sliders className="size-3" />
            Blend
            {showBlend ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          {/* Custom toggle */}
          <button
            onClick={() => handleSourceClick('custom')}
            title="Enter your own probabilities"
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              state.oddsSource === 'custom'
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60'
            }`}
          >
            <Pencil className="size-3" />
            Custom
            {showCustom ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        </div>
      </div>

      {/* Blend panel */}
      {showBlend && (() => {
        const totalWeight = Object.values(blendWeights).reduce((s, w) => s + w, 0);
        return (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-white/30">Weight each source</p>
            <div className="space-y-2">
              {blendSources.map((source) => {
                const weight = blendWeights[source.id] ?? 0;
                const effectivePct = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
                return (
                  <div key={source.id} className="flex items-center gap-3">
                    <span className="w-24 text-[11px] text-white/50 truncate">{source.name}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={weight}
                      onChange={(e) =>
                        setBlendWeights((prev) => ({
                          ...prev,
                          [source.id]: parseInt(e.target.value, 10),
                        }))
                      }
                      className="flex-1 h-1 accent-emerald-500"
                    />
                    <span className="w-14 text-right text-[11px] font-mono text-white/40">
                      {weight > 0 ? (
                        <><span className="text-emerald-400/70">{effectivePct}%</span></>
                      ) : (
                        <span className="text-white/20">off</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleBlendApply}
              className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              Apply Blend
            </button>
          </div>
        );
      })()}

      {/* Custom odds editor panel */}
      {showCustom && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
          {/* Header with source selector + reset */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase tracking-wider text-white/30">Start from</label>
              <select
                value={customBase}
                onChange={(e) => {
                  setCustomBase(e.target.value);
                  seedDraftFromSource(e.target.value);
                }}
                className="rounded bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[11px] text-white/60
                           focus:outline-none focus:border-emerald-500/40"
              >
                {blendSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => seedDraftFromSource(customBase)}
              title="Reset to base source values"
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-white/30 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          </div>

          {/* Scrollable odds table */}
          <div className="max-h-72 overflow-auto rounded border border-white/[0.04]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-[#0d1117]">
                <tr className="border-b border-white/[0.06]">
                  <th className="sticky left-0 bg-[#0d1117] z-30 px-2 py-1.5 text-left text-[9px] uppercase tracking-wider text-white/30">
                    Team
                  </th>
                  {roundKeys.map((rk, i) => (
                    <th key={rk} className="px-0.5 py-1.5 text-center text-[9px] uppercase tracking-wider text-white/30">
                      {roundLabels[i] ?? rk}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map((team) => (
                  <CustomOddsRow
                    key={team.id}
                    teamId={team.id}
                    teamName={team.name}
                    seed={team.seed ?? 0}
                    roundKeys={roundKeys}
                    values={customDraft[team.id] ?? {}}
                    onChange={handleDraftChange}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Validation warnings */}
          {customValidation.length > 0 && (
            <div className="rounded bg-amber-500/[0.08] border border-amber-500/20 px-3 py-2 space-y-0.5">
              {customValidation.map((err, i) => (
                <p key={i} className="text-[10px] text-amber-400">⚠ {err}</p>
              ))}
            </div>
          )}

          {/* Apply button */}
          <button
            onClick={handleCustomApply}
            className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            Apply Custom Odds
          </button>
        </div>
      )}
    </div>
  );
}
