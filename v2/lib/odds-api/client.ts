const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

export interface OddsApiOutcome {
  name: string;
  price: number; // decimal odds
}

export interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  bookmakers: OddsApiBookmaker[];
}

/**
 * Fetch NCAAB championship winner odds from The Odds API.
 * Returns outright futures odds from multiple bookmakers.
 */
export async function fetchNcaabFutures(apiKey: string): Promise<OddsApiEvent[]> {
  const sportKeys = [
    'basketball_ncaab_championship_winner',
  ];

  const results: OddsApiEvent[] = [];

  for (const sportKey of sportKeys) {
    try {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?apiKey=${apiKey}&regions=us,us2&oddsFormat=decimal&markets=outrights`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          results.push(...data);
        } else if (data && typeof data === 'object') {
          results.push(data as OddsApiEvent);
        }
      }
    } catch {
      // Silently skip unavailable markets
    }
  }

  return results;
}
