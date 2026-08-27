import type { BaseTeam } from '@/lib/tournaments/types';

/**
 * ESPN NFL standings parsing. PURE — no fetch, no clock, no I/O of any kind.
 * The network layer is `nfl-client.ts`; the sync route composes the two.
 *
 * Everything here feeds real-money settlement: `regularSeasonWins` pays a flat
 * rate per win and is ~28% of the pot on the default preset, so a silently
 * wrong number pays the wrong people. Every ambiguity below is resolved in the
 * direction of "fail loudly" rather than "settle something plausible".
 */

// ── ESPN wire shape — only the fields we read ─────────────────────────────

export interface EspnStandingsStat {
  name?: string;
  type?: string;
  /** Numerics live here. Record-shaped stats put a string in displayValue and
   *  leave this null (or, for divisionRecord, a meaningless 0). */
  value?: number | null;
  displayValue?: string;
}

export interface EspnStandingsEntry {
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
  };
  /** An ARRAY of ~22 stats, not an object keyed by name. */
  stats?: EspnStandingsStat[];
}

export interface EspnStandingsNode {
  name?: string;
  abbreviation?: string;
  standings?: {
    /** 1 preseason | 2 regular | 3 postseason. NOT present at the top level —
     *  ESPN hangs it off each division node's `standings`. */
    seasonType?: number;
    entries?: EspnStandingsEntry[];
  };
  children?: EspnStandingsNode[];
}

export interface EspnStandings extends EspnStandingsNode {
  season?: { year?: number };
}

/**
 * The weekly scoreboard, as much of it as the completeness sweep needs.
 *
 * `season` and `week` are echoed back by ESPN, which is what lets the client
 * prove it got the week it asked for. A canceled game reports
 * `name: 'STATUS_CANCELED'` with `completed: false` (verified: BUF @ CIN,
 * week 17 of 2022) — which is exactly why "all 272 games final" can never be
 * used as a season-complete gate.
 */
export interface EspnNflScoreboard {
  season?: { year?: number; type?: number };
  week?: { number?: number };
  events?: Array<{
    id?: string;
    shortName?: string;
    date?: string;
    status?: { type?: { name?: string; state?: string; completed?: boolean } };
  }>;
}

// ── Our normalized shape ──────────────────────────────────────────────────

export interface NflTeamStanding {
  /** ESPN's numeric team id — stable across seasons, unlike names. */
  espnId: number;
  /** ESPN's abbreviation: JAX (never JAC), WSH (never WAS). */
  abbreviation: string;
  /** ESPN displayName. Joins our config `name` exactly — no alias map needed
   *  (verified against the live feed for 2022 and 2025). */
  name: string;
  /** ESPN's division node name, e.g. 'NFC South'. Our config `group` is the
   *  same string with spaces replaced by underscores. */
  division: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  /** 1-16 per CONFERENCE. `0` is ESPN's "season not started" sentinel — not
   *  null, not absent. */
  playoffSeed: number;
  /** wins + 0.5 * ties. The ONLY correct scalar for ranking records: in 2022
   *  CHI went 3-14-0 (3.0) and HOU 3-13-1 (3.5); raw wins ties them. Always a
   *  multiple of 0.5, so exact === comparison is safe. */
  units: number;
  gamesPlayed: number;
}

export interface NflStandings {
  seasonYear: number | null;
  seasonType: number | null;
  teams: NflTeamStanding[];
}

export interface NflSyncResultRow {
  teamId: number;
  roundKey: string;
  /** No 'pending' member by design — the type enforces that we never write one. */
  result: 'won' | 'lost';
  resultCount?: number;
}

export interface SeasonResultsOptions {
  /**
   * The regular season is over and division winners are final.
   *
   * The CALLER decides this, from the week 1-18 scoreboard sweep. Never infer
   * it from the standings: 2022 played 271 games, not 272 (a canceled
   * Bills-Bengals game that was never made up), so both "272 units" and "all 32
   * teams at 17 games" are gates that would simply never fire.
   */
  seasonComplete?: boolean;
}

// ── Stat reading ──────────────────────────────────────────────────────────

/**
 * A displayValue like '5-1', '14-3' or '9-8-0' is a win-loss record, not a
 * number. ESPN puts six of these in the same `stats` array as the real
 * numerics. `overall` / `Home` / `Road` / `vs. Div.` / `vs. Conf.` carry
 * `value: null`, but `divisionRecord` carries a genuine `value: 0.0` alongside
 * `displayValue: '5-1'` — so a plain `.value` read returns a confident,
 * completely wrong 0.
 *
 * A leading '-' (pointDifferential '-170') is deliberately NOT matched: the
 * pattern requires a digit before the dash.
 */
const RECORD_SHAPED = /^\d+-\d+(-\d+)?$/;

/** Matches `divisionWinner.teamsAdvancing` in the NFL season config. */
const NFL_DIVISION_COUNT = 8;

/**
 * The numeric value of a stat, looked up by exact `name`. Returns null when the
 * stat is absent, non-numeric, or a record string wearing a number's clothes.
 */
export function readStatValue(
  stats: EspnStandingsStat[] | undefined,
  name: string
): number | null {
  const stat = stats?.find((s) => s.name === name);
  if (!stat) return null;
  if (stat.displayValue != null && RECORD_SHAPED.test(stat.displayValue)) return null;
  return typeof stat.value === 'number' && Number.isFinite(stat.value) ? stat.value : null;
}

// ── Parsing ───────────────────────────────────────────────────────────────

/** Every node in the tree that actually carries standings entries. At
 *  `level=3` these are the eight division nodes. */
function collectGroups(node: EspnStandingsNode, out: EspnStandingsNode[]): void {
  if ((node.standings?.entries?.length ?? 0) > 0) out.push(node);
  for (const child of node.children ?? []) collectGroups(child, out);
}

/**
 * ESPN standings JSON → normalized rows. Pure.
 *
 * Deliberately does NOT read `clincher`: its value is always 0.0, the real
 * signal is a letter in displayValue, and that vocabulary is unstable across
 * seasons ('x' meant wild card in 2021, 'y' in 2022-25) and absent until the
 * season generates one. Division winners come from playoffSeed instead.
 */
export function parseStandings(json: EspnStandings): NflStandings {
  const groups: EspnStandingsNode[] = [];
  collectGroups(json, groups);

  const teams: NflTeamStanding[] = [];
  const seenEspnIds = new Set<number>();
  const seasonTypes = new Set<number>();

  for (const group of groups) {
    if (typeof group.standings?.seasonType === 'number') {
      seasonTypes.add(group.standings.seasonType);
    }
    for (const entry of group.standings?.entries ?? []) {
      const espnId = Number(entry.team?.id);
      const name = entry.team?.displayName;
      if (!Number.isFinite(espnId) || !name) continue;

      // A team appearing twice means the response mixed grouping levels (e.g.
      // league-wide AND per-division), which would double-count every win.
      if (seenEspnIds.has(espnId)) {
        throw new Error(
          `[nfl] ESPN standings listed team ${espnId} (${name}) more than once — ` +
            'the response mixed grouping levels; expected level=3 (divisions).'
        );
      }
      seenEspnIds.add(espnId);

      const required = (stat: string): number => {
        const value = readStatValue(entry.stats, stat);
        if (value == null) {
          // Defaulting to 0 here would under-credit a real team's wins in a
          // real-money settlement and look like a bad season, not a bug. A
          // missing `pointsFor` specifically is the signature of `&type=2`
          // having been used in place of `&seasontype=2` — it swaps ESPN to the
          // "expanded" stat set, which has no points columns at all.
          throw new Error(
            `[nfl] ESPN standings entry for ${name} has no numeric '${stat}'. ` +
              'Check the request is ?level=3&seasontype=2 (NOT &type=2).'
          );
        }
        return value;
      };

      const wins = required('wins');
      const losses = required('losses');
      const ties = required('ties');
      teams.push({
        espnId,
        abbreviation: entry.team?.abbreviation ?? '',
        name,
        division: group.name ?? '',
        wins,
        losses,
        ties,
        pointsFor: required('pointsFor'),
        playoffSeed: required('playoffSeed'),
        units: wins + 0.5 * ties,
        gamesPlayed: wins + losses + ties,
      });
    }
  }

  return {
    seasonYear: typeof json.season?.year === 'number' ? json.season.year : null,
    // Only trust it when every division node agrees; a mixed response is a
    // shape change we should not settle against.
    seasonType: seasonTypes.size === 1 ? [...seasonTypes][0] : null,
    teams,
  };
}

// ── Config join ───────────────────────────────────────────────────────────

/**
 * ESPN displayName → our team id, for the whole feed.
 *
 * Throws in BOTH directions rather than dropping a row. A silent name-join drop
 * is the exact failure CLAUDE.md records for the World Cup feed, and here it
 * would credit a real team zero wins in a real-money settlement — invisible in
 * the UI, which just shows a lower number. A dead sync is loud; a wrong payout
 * is not.
 */
function buildTeamIdMap(standings: NflStandings, baseTeams: BaseTeam[]): Map<string, number> {
  const idByName = new Map(baseTeams.map((t) => [t.name, t.id]));
  const unresolved = standings.teams.filter((t) => !idByName.has(t.name)).map((t) => t.name);
  if (unresolved.length > 0) {
    throw new Error(
      `[nfl] ESPN standings had ${unresolved.length} team(s) with no config match: ` +
        `${unresolved.join(', ')}. Fix the config names — do not let them settle as zero.`
    );
  }
  const feedNames = new Set(standings.teams.map((t) => t.name));
  const missing = baseTeams.filter((t) => !feedNames.has(t.name)).map((t) => t.name);
  if (missing.length > 0) {
    throw new Error(
      `[nfl] ESPN standings omitted ${missing.length} configured team(s): ${missing.join(', ')}. ` +
        'Refusing to settle a partial feed.'
    );
  }
  return idByName;
}

/**
 * Preseason records are real numbers in the same shape as regular-season ones.
 * `seasontype=2` on the request is the primary defence; this is the second one,
 * for the day a URL is edited or ESPN changes its default.
 */
function assertRegularSeason(standings: NflStandings): void {
  if (standings.seasonType !== 2) {
    throw new Error(
      `[nfl] refusing to settle seasonType ${standings.seasonType} — ` +
        'only 2 (regular season) may be graded. Check &seasontype=2 on the request.'
    );
  }
}

// ── Result rows ───────────────────────────────────────────────────────────

/**
 * Settlement rows derivable from the standings.
 *
 * Weekly path (the default): the `regularSeasonWins` running total only — one
 * `won` row per team carrying `resultCount: wins + 0.5 * ties`. Teams with zero
 * units get no row at all; a winless team's `lost` row, which closes the round,
 * belongs to the end-of-season pass, not to a mid-season re-upsert.
 *
 * With `seasonComplete: true` the division winners are added: one `won` and
 * three `lost` per division, chosen by lowest `playoffSeed`. Never by wins —
 * the 2025 NFC South had a three-way 8-9 tie, and a max-wins grader would emit
 * three winners into an eight-slot budget.
 */
export function computeSeasonResults(
  standings: NflStandings,
  baseTeams: BaseTeam[],
  options: SeasonResultsOptions = {}
): NflSyncResultRow[] {
  assertRegularSeason(standings);
  const idByName = buildTeamIdMap(standings, baseTeams);
  const rows: NflSyncResultRow[] = [];

  for (const team of standings.teams) {
    if (team.units <= 0) continue;
    rows.push({
      teamId: idByName.get(team.name)!,
      roundKey: 'regularSeasonWins',
      result: 'won',
      resultCount: team.units,
    });
  }

  if (options.seasonComplete) rows.push(...divisionWinnerRows(standings, idByName));
  return rows;
}

/**
 * One winner per division, by lowest playoffSeed. In the NFL the four division
 * winners take seeds 1-4 of their conference and every other team in the
 * division is 5 or worse, so the division minimum IS the division winner.
 *
 * A division is skipped entirely — never partially graded — when any of its
 * teams still carries the `playoffSeed: 0` sentinel, or when two teams somehow
 * share the minimum. Skipping leaves the round incomplete (the projection keeps
 * covering it); emitting two winners would over-distribute an eight-slot budget.
 */
function divisionWinnerRows(
  standings: NflStandings,
  idByName: Map<string, number>
): NflSyncResultRow[] {
  const byDivision = new Map<string, NflTeamStanding[]>();
  for (const team of standings.teams) {
    const list = byDivision.get(team.division);
    if (list) list.push(team);
    else byDivision.set(team.division, [team]);
  }

  // `level=3` is what groups entries by division. At level=1 ESPN returns one
  // league-wide bucket, which would silently grade a single "division winner"
  // for all 32 teams against an 8-slot budget.
  if (byDivision.size !== NFL_DIVISION_COUNT) {
    throw new Error(
      `[nfl] expected ${NFL_DIVISION_COUNT} divisions, got ${byDivision.size} ` +
        `(${[...byDivision.keys()].join(', ')}). Standings must be fetched with level=3.`
    );
  }

  const rows: NflSyncResultRow[] = [];
  for (const [division, members] of byDivision) {
    if (members.some((t) => t.playoffSeed <= 0)) continue; // seeds not assigned yet
    const best = Math.min(...members.map((t) => t.playoffSeed));
    if (members.filter((t) => t.playoffSeed === best).length !== 1) {
      console.warn(`[nfl] ${division} has no unique top playoff seed (${best}) — not graded`);
      continue;
    }
    for (const team of members) {
      rows.push({
        teamId: idByName.get(team.name)!,
        roundKey: 'divisionWinner',
        result: team.playoffSeed === best ? 'won' : 'lost',
      });
    }
  }
  return rows;
}

/**
 * Best and worst record in the league, as our team ids.
 *
 * Returns EVERY team tied at the extreme, one id each — 2025 alone had a
 * three-way tie for best (NE/DEN/SEA) and a four-way tie for worst
 * (NYJ/TEN/LV/ARI). Collapsing to a single winner with a tiebreaker, the way
 * the World Cup's computeGroupProps does, would pay one of four owners and
 * quietly keep the other three shares.
 *
 * Ranked by units, never raw wins. Empty before any game is played.
 */
export function computeRecordProps(
  standings: NflStandings,
  baseTeams: BaseTeam[]
): { bestRecord: number[]; worstRecord: number[] } {
  assertRegularSeason(standings);
  const idByName = buildTeamIdMap(standings, baseTeams);

  const played = standings.teams.filter((t) => t.gamesPlayed > 0);
  if (played.length === 0) return { bestRecord: [], worstRecord: [] };

  const unitValues = played.map((t) => t.units);
  const max = Math.max(...unitValues);
  const min = Math.min(...unitValues);
  // Units are always multiples of 0.5, so exact equality is safe here.
  const idsAt = (target: number) =>
    played
      .filter((t) => t.units === target)
      .map((t) => idByName.get(t.name)!)
      .sort((a, b) => a - b);

  return { bestRecord: idsAt(max), worstRecord: idsAt(min) };
}
