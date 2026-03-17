'use client';

import { useState } from 'react';
import type { OddsSourceRegistry, OddsSourceProbabilities } from '@/lib/tournaments/odds-sources';
import { blendProbabilities } from '@/lib/tournaments/odds-sources';
import { useAuction } from '@/lib/auction/auction-context';
import { BarChart3, Globe, Sliders, ChevronDown, ChevronUp } from 'lucide-react';

interface OddsSourceSelectorProps {
  registry: OddsSourceRegistry;
}

const SOURCE_ICONS: Record<string, typeof BarChart3> = {
  model: BarChart3,
  sportsbook: Globe,
  blend: Sliders,
  custom: Sliders,
};

export function OddsSourceSelector({ registry }: OddsSourceSelectorProps) {
  const { state, dispatch } = useAuction();
  const [showBlend, setShowBlend] = useState(false);
  const [blendWeights, setBlendWeights] = useState<Record<string, number>>({
    evan_miya: 34,
    team_rankings: 33,
    fanduel: 0,
    draftkings: 0,
    pinnacle: 33,
  });

  const roundKeys = state.config?.rounds.map((r) => r.key) ?? [];
  const teamIds = state.teams.map((t) => t.id);

  const applySource = (sourceId: string, probs: Record<number, Record<string, number>>) => {
    dispatch({ type: 'SET_ODDS_SOURCE', sourceId, probabilities: probs });
  };

  const handleSourceClick = (sourceId: string) => {
    if (sourceId === 'blend') {
      setShowBlend((prev) => !prev);
      return;
    }
    if (sourceId === 'custom') {
      // TODO: open custom odds editor
      return;
    }
    if (sourceId === state.oddsSource) return;
    setShowBlend(false);
    const data = registry.staticData[sourceId];
    if (data) {
      applySource(sourceId, data.teams);
    }
  };

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

  // Exclude blend and custom from main row — they get special treatment
  const mainSources = registry.sources.filter((s) => s.type !== 'blend' && s.type !== 'custom');
  // All data sources for blend sliders (models + sportsbooks)
  const blendSources = registry.sources.filter((s) => s.type === 'model' || s.type === 'sportsbook');

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
        </div>
      </div>

      {/* Blend panel */}
      {showBlend && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Weight each source</p>
          <div className="space-y-2">
            {blendSources.map((source) => {
              const weight = blendWeights[source.id] ?? 0;
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
                  <span className="w-8 text-right text-[11px] font-mono text-white/40">
                    {weight}
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
      )}
    </div>
  );
}
