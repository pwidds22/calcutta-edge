'use client';

import { useState, useCallback } from 'react';
import type { OddsSource, OddsSourceRegistry, OddsSourceProbabilities } from '@/lib/tournaments/odds-sources';
import { blendProbabilities } from '@/lib/tournaments/odds-sources';
import { useAuction } from '@/lib/auction/auction-context';
import { BarChart3, Globe, Loader2, Sliders, ChevronDown, ChevronUp } from 'lucide-react';

interface SportsbookInfo {
  key: string;
  title: string;
  teamCount: number;
}

interface OddsApiResponse {
  bookmakers: SportsbookInfo[];
  data: Record<string, OddsSourceProbabilities>;
}

interface OddsSourceSelectorProps {
  registry: OddsSourceRegistry;
}

export function OddsSourceSelector({ registry }: OddsSourceSelectorProps) {
  const { state, dispatch } = useAuction();
  const [loading, setLoading] = useState(false);
  const [remoteData, setRemoteData] = useState<Record<string, OddsSourceProbabilities>>({});
  const [sportsbooks, setSportsbooks] = useState<SportsbookInfo[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBlend, setShowBlend] = useState(false);
  const [blendWeights, setBlendWeights] = useState<Record<string, number>>({
    evan_miya: 50,
    team_rankings: 50,
  });

  const roundKeys = state.config?.rounds.map((r) => r.key) ?? [];
  const teamIds = state.teams.map((t) => t.id);

  const fetchSportsbooks = useCallback(async () => {
    if (Object.keys(remoteData).length > 0) return remoteData;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/odds/ncaab');
      if (!res.ok) throw new Error('Failed to fetch');
      const json: OddsApiResponse = await res.json();
      if ('error' in json) throw new Error('API error');
      setSportsbooks(json.bookmakers);
      setRemoteData(json.data);
      return json.data;
    } catch {
      setError('Could not load sportsbook odds');
      return null;
    } finally {
      setLoading(false);
    }
  }, [remoteData]);

  const applySource = (sourceId: string, probs: Record<number, Record<string, number>>) => {
    dispatch({ type: 'SET_ODDS_SOURCE', sourceId, probabilities: probs });
  };

  const handleStaticSource = (source: OddsSource) => {
    if (source.id === state.oddsSource) return;
    setShowBlend(false);
    const staticData = registry.staticData[source.id];
    if (staticData) {
      applySource(source.id, staticData.teams);
    }
  };

  const handleSportsbook = async () => {
    setShowBlend(false);
    const data = await fetchSportsbooks();
    if (!data) return;

    // Auto-select first available bookmaker
    const firstKey = Object.keys(data)[0];
    if (firstKey && data[firstKey]) {
      setSelectedBook(firstKey);
      applySource(`sportsbook:${firstKey}`, data[firstKey].teams);
    } else {
      setError('No sportsbook data available');
    }
  };

  const handleBookChange = (bookKey: string) => {
    setSelectedBook(bookKey);
    const bookData = remoteData[bookKey];
    if (bookData) {
      applySource(`sportsbook:${bookKey}`, bookData.teams);
    }
  };

  const handleBlendToggle = async () => {
    if (!showBlend) {
      // Pre-fetch sportsbook data for blend availability
      await fetchSportsbooks();
      setShowBlend(true);
    } else {
      setShowBlend(false);
    }
  };

  const handleBlendApply = () => {
    const sources: Array<{ data: OddsSourceProbabilities; weight: number }> = [];

    for (const [sourceId, weight] of Object.entries(blendWeights)) {
      if (weight <= 0) continue;

      if (registry.staticData[sourceId]) {
        sources.push({ data: registry.staticData[sourceId], weight });
      } else if (remoteData[sourceId]) {
        sources.push({ data: remoteData[sourceId], weight });
      }
    }

    if (sources.length === 0) return;

    const blended = blendProbabilities(sources, teamIds, roundKeys);
    applySource('blend', blended.teams);
  };

  const isSportsbook = state.oddsSource.startsWith('sportsbook:');
  const isBlend = state.oddsSource === 'blend';

  // Available sources for blending (static + fetched sportsbooks)
  const blendSources = [
    ...registry.sources.filter((s) => s.type === 'model'),
    ...sportsbooks.map((b) => ({
      id: b.key,
      name: b.title,
      description: `${b.teamCount} teams`,
      type: 'sportsbook' as const,
      isRemote: true,
    })),
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="size-3.5 text-white/30" />
          <span className="text-[10px] uppercase tracking-wider text-white/30">Odds Source</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {/* Static model sources */}
          {registry.sources
            .filter((s) => s.type === 'model')
            .map((source) => {
              const isActive = state.oddsSource === source.id;
              return (
                <button
                  key={source.id}
                  onClick={() => handleStaticSource(source)}
                  title={source.description}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                      : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60'
                  }`}
                >
                  <BarChart3 className="size-3" />
                  {source.name}
                </button>
              );
            })}

          {/* Sportsbook toggle */}
          <button
            onClick={handleSportsbook}
            disabled={loading}
            title="Live devigged sportsbook odds"
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              isSportsbook
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60'
            }`}
          >
            {loading ? <Loader2 className="size-3 animate-spin" /> : <Globe className="size-3" />}
            Sportsbooks
          </button>

          {/* Blend toggle */}
          <button
            onClick={handleBlendToggle}
            title="Custom weighted blend of sources"
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              isBlend
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60'
            }`}
          >
            <Sliders className="size-3" />
            Blend
            {showBlend ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        </div>
        {error && <span className="text-[10px] text-red-400">{error}</span>}
      </div>

      {/* Sportsbook sub-selector */}
      {isSportsbook && sportsbooks.length > 1 && (
        <div className="flex items-center gap-1 pl-6">
          <span className="text-[10px] text-white/20 mr-1">Book:</span>
          {sportsbooks.map((b) => (
            <button
              key={b.key}
              onClick={() => handleBookChange(b.key)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                selectedBook === b.key
                  ? 'bg-white/10 text-white/70'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {b.title}
            </button>
          ))}
        </div>
      )}

      {/* Blend panel */}
      {showBlend && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Weight each source</p>
          <div className="space-y-2">
            {blendSources.map((source) => {
              const weight = blendWeights[source.id] ?? 0;
              return (
                <div key={source.id} className="flex items-center gap-3">
                  <span className="w-28 text-[11px] text-white/50 truncate">{source.name}</span>
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
