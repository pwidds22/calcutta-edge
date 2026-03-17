'use client';

import { useState } from 'react';
import type { OddsSource, OddsSourceRegistry, OddsSourceProbabilities } from '@/lib/tournaments/odds-sources';
import { useAuction } from '@/lib/auction/auction-context';
import { BarChart3, Globe, Loader2 } from 'lucide-react';

interface OddsSourceSelectorProps {
  registry: OddsSourceRegistry;
}

export function OddsSourceSelector({ registry }: OddsSourceSelectorProps) {
  const { state, dispatch } = useAuction();
  const [loading, setLoading] = useState<string | null>(null);
  const [remoteData, setRemoteData] = useState<Record<string, OddsSourceProbabilities>>({});
  const [error, setError] = useState<string | null>(null);

  const handleSourceChange = async (source: OddsSource) => {
    if (source.id === state.oddsSource) return;
    setError(null);

    if (source.isRemote) {
      // Fetch from API if not already cached locally
      const cacheKey = source.bookmakerKey ?? source.id;
      if (!remoteData[cacheKey]) {
        setLoading(source.id);
        try {
          const res = await fetch('/api/odds/ncaab');
          if (!res.ok) throw new Error('Failed to fetch');
          const data: Record<string, OddsSourceProbabilities> = await res.json();

          if ('error' in data) {
            setError(`Odds API error`);
            setLoading(null);
            return;
          }

          setRemoteData(data);

          const bookData = data[cacheKey];
          if (bookData && Object.keys(bookData.teams).length > 0) {
            dispatch({
              type: 'SET_ODDS_SOURCE',
              sourceId: source.id,
              probabilities: bookData.teams,
            });
          } else {
            setError(`No ${source.name} data available`);
          }
        } catch {
          setError(`Could not load ${source.name} odds`);
        } finally {
          setLoading(null);
        }
        return;
      }

      // Use cached remote data
      const bookData = remoteData[cacheKey];
      if (bookData && Object.keys(bookData.teams).length > 0) {
        dispatch({
          type: 'SET_ODDS_SOURCE',
          sourceId: source.id,
          probabilities: bookData.teams,
        });
      } else {
        setError(`No ${source.name} data available`);
      }
    } else {
      // Static source
      const staticData = registry.staticData[source.id];
      if (staticData) {
        dispatch({
          type: 'SET_ODDS_SOURCE',
          sourceId: source.id,
          probabilities: staticData.teams,
        });
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <BarChart3 className="size-3.5 text-white/30" />
        <span className="text-[10px] uppercase tracking-wider text-white/30">Odds Source</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {registry.sources.map((source) => {
          const isActive = state.oddsSource === source.id;
          const isLoading = loading === source.id;
          const Icon = source.type === 'sportsbook' ? Globe : BarChart3;

          return (
            <button
              key={source.id}
              onClick={() => handleSourceChange(source)}
              disabled={isLoading}
              title={source.description}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                  : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60'
              }`}
            >
              {isLoading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Icon className="size-3" />
              )}
              {source.name}
            </button>
          );
        })}
      </div>
      {error && (
        <span className="text-[10px] text-red-400">{error}</span>
      )}
    </div>
  );
}
