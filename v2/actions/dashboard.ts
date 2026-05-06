'use server';

import { createClient } from '@/lib/supabase/server';
import { getTournament } from '@/lib/tournaments/registry';
import { getTournamentPhase } from '@/lib/tournaments/phase';
import { getTeamStatus, calculateTeamEarnings, buildPlayInLoserSet, countWinnersPerRound, adjustPayoutRulesForTies } from '@/lib/auction/live/actual-payouts';
import type { TournamentResult } from '@/actions/tournament-results';
import type { PayoutRules } from '@/lib/tournaments/types';
import type { PropResult } from '@/lib/tournaments/props';
import { getPropWinners } from '@/lib/tournaments/props';
import { normalizeName } from '@/lib/datagolf/ev';
import { fetchInPlay, fetchPreTournament, formatPlayerName } from '@/lib/datagolf/client';
import type { DataGolfInPlayPlayer } from '@/lib/datagolf/client';

export interface DashboardTeam {
  teamName: string;
  seed: number;
  group: string;
  status: 'alive' | 'eliminated' | 'champion';
  purchasePrice: number;
  earnings: number;
  roundsWon: string[];
  breakEvenRound: string | null; // First round where cumulative payout > purchase price
  leagueName: string;
  leagueId: string;
}

export interface DashboardSession {
  id: string;
  name: string;
  joinCode: string;
  status: string;
  tournamentId: string;
  tournamentName: string;
  isCommissioner: boolean;
  createdAt: string;
  participantCount: number;
  potSize: number;
  currentRound: string | null;
  currentRoundLabel: string | null;
  userTeamsCount: number;
  userTeamsAlive: number;
  userTeamsEliminated: number;
  userTotalSpent: number;
  userTotalEarned: number;
  userEliminatedCost: number;
  userNetPL: number; // earnings - eliminated teams cost (alive teams don't count as losses)
  projectedNetPL: number | null; // DataGolf projected P&L for active golf tournaments
  userTeams: DashboardTeam[];
}

export interface DashboardData {
  sessions: DashboardSession[];
  totalPotExposure: number;
  totalEarned: number;
  totalNetPL: number;
  aliveTeams: DashboardTeam[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { sessions: [], totalPotExposure: 0, totalEarned: 0, totalNetPL: 0, aliveTeams: [] };

  // Get all sessions user is part of (hosted + joined)
  const { data: participations } = await supabase
    .from('auction_participants')
    .select('session_id, is_commissioner')
    .eq('user_id', user.id);

  if (!participations || participations.length === 0) {
    return { sessions: [], totalPotExposure: 0, totalEarned: 0, totalNetPL: 0, aliveTeams: [] };
  }

  const sessionIds = participations.map((p) => p.session_id);
  const commissionerMap = new Map(participations.map((p) => [p.session_id, p.is_commissioner]));

  // Load all sessions
  const { data: sessions } = await supabase
    .from('auction_sessions')
    .select('id, name, join_code, status, tournament_id, created_at, estimated_pot_size, payout_rules, prop_results, auction_participants(count)')
    .in('id', sessionIds)
    .order('created_at', { ascending: false });

  if (!sessions || sessions.length === 0) {
    return { sessions: [], totalPotExposure: 0, totalEarned: 0, totalNetPL: 0, aliveTeams: [] };
  }

  // Load user's winning bids across all sessions
  const { data: winningBids } = await supabase
    .from('auction_bids')
    .select('session_id, team_id, amount')
    .eq('bidder_id', user.id)
    .eq('is_winning_bid', true)
    .in('session_id', sessionIds);

  // Group bids by session
  const bidsBySession = new Map<string, Array<{ team_id: number; amount: number }>>();
  for (const bid of winningBids ?? []) {
    const list = bidsBySession.get(bid.session_id) ?? [];
    list.push({ team_id: bid.team_id, amount: Number(bid.amount) });
    bidsBySession.set(bid.session_id, list);
  }

  // Load all winning bids for actual pot calculation + tie adjustment
  const { data: allWinningBids } = await supabase
    .from('auction_bids')
    .select('session_id, team_id, amount')
    .eq('is_winning_bid', true)
    .in('session_id', sessionIds);

  const potBySession = new Map<string, number>();
  const allBidsBySession = new Map<string, Array<{ team_id: number; amount: number }>>();
  for (const bid of allWinningBids ?? []) {
    potBySession.set(bid.session_id, (potBySession.get(bid.session_id) ?? 0) + Number(bid.amount));
    const list = allBidsBySession.get(bid.session_id) ?? [];
    list.push({ team_id: bid.team_id, amount: Number(bid.amount) });
    allBidsBySession.set(bid.session_id, list);
  }

  // Load tournament results for completed sessions
  const completedIds = sessions.filter((s) => s.status === 'completed').map((s) => s.id);
  const resultsBySession = new Map<string, TournamentResult[]>();
  if (completedIds.length > 0) {
    const { data: results } = await supabase
      .from('tournament_results')
      .select('session_id, team_id, round_key, result')
      .in('session_id', completedIds);

    for (const r of results ?? []) {
      const list = resultsBySession.get(r.session_id) ?? [];
      list.push({ team_id: r.team_id, round_key: r.round_key, result: r.result });
      resultsBySession.set(r.session_id, list);
    }
  }

  // Fetch DataGolf projections for active golf sessions (best-effort, non-blocking)
  const hasActiveGolf = sessions.some(
    (s) => s.status === 'completed' && getTournament(s.tournament_id)?.config.sport === 'golf'
  );
  let dgPlayers: DataGolfInPlayPlayer[] = [];
  if (hasActiveGolf && process.env.DATAGOLF_API_KEY) {
    try {
      const inPlay = await fetchInPlay();
      const isMasters = inPlay.event_name.toLowerCase().includes('masters')
        || inPlay.event_name.toLowerCase().includes('augusta');
      if (isMasters) {
        dgPlayers = inPlay.data;
      }
    } catch {
      try {
        const preTourney = await fetchPreTournament();
        const isMasters = preTourney.event_name.toLowerCase().includes('masters')
          || preTourney.event_name.toLowerCase().includes('augusta');
        if (isMasters) {
          dgPlayers = (preTourney.baseline_history_fit ?? preTourney.baseline).map(
            (p): DataGolfInPlayPlayer => ({
              player_name: p.player_name,
              dg_id: p.dg_id,
              current_pos: null,
              current_round: 0,
              thru: null,
              today: null,
              total: null,
              win_prob: p.win,
              top_5_prob: p.top_5,
              top_10_prob: p.top_10,
              top_20_prob: p.top_20,
              make_cut_prob: p.make_cut,
            })
          );
        }
      } catch { /* DataGolf unavailable — projections will be null */ }
    }
  }

  // Build name→player lookup for projected EV
  const dgPlayerMap = new Map<string, DataGolfInPlayPlayer>();
  for (const p of dgPlayers) {
    dgPlayerMap.set(normalizeName(formatPlayerName(p.player_name)), p);
  }

  // Build dashboard sessions
  const dashboardSessions: DashboardSession[] = [];
  const allAliveTeams: DashboardTeam[] = [];

  for (const session of sessions) {
    const tournament = getTournament(session.tournament_id);
    const config = tournament?.config;
    const teams = tournament?.teams;
    const userBids = bidsBySession.get(session.id) ?? [];
    const actualPot = potBySession.get(session.id) ?? 0;
    const potSize = session.status === 'completed' ? actualPot : Number(session.estimated_pot_size);
    const results = resultsBySession.get(session.id) ?? [];
    const payoutRules = session.payout_rules as PayoutRules;
    const participantCount = (session.auction_participants as unknown as Array<{ count: number }>)?.[0]?.count ?? 0;

    // Compute per-team status and earnings
    const playInLosers = (config && teams) ? buildPlayInLoserSet(teams, results, config) : new Set<number>();
    const propResults = (session.prop_results ?? []) as PropResult[];

    // Adjust payout rules for ties (more winners than teamsAdvancing)
    const allSessionBids = allBidsBySession.get(session.id) ?? [];
    const soldTeamsForTies = allSessionBids.map((b) => ({ teamId: b.team_id, winnerId: '', winnerName: '', amount: b.amount }));
    const adjustedPayoutRules = (config && results.length > 0)
      ? adjustPayoutRulesForTies(
          payoutRules,
          countWinnersPerRound(soldTeamsForTies, results, config, playInLosers),
          config
        )
      : payoutRules;

    const userTeams: DashboardTeam[] = [];
    let userTotalEarned = 0;
    let userTotalSpent = 0;
    let userTeamsAlive = 0;
    let userTeamsEliminated = 0;
    let userEliminatedCost = 0;

    for (const bid of userBids) {
      const baseTeam = teams?.find((t) => t.id === bid.team_id);
      userTotalSpent += bid.amount;

      let status: 'alive' | 'eliminated' | 'champion' = 'alive';
      let roundsWon: string[] = [];
      let earnings = 0;

      if (config && results.length > 0) {
        const teamStatus = getTeamStatus(bid.team_id, results, config, playInLosers);
        status = teamStatus.status;
        roundsWon = teamStatus.roundsWon;
        earnings = calculateTeamEarnings(roundsWon, actualPot, adjustedPayoutRules);
      }

      userTotalEarned += earnings;
      if (status === 'alive' || status === 'champion') {
        userTeamsAlive++;
      } else if (status === 'eliminated') {
        userTeamsEliminated++;
        userEliminatedCost += bid.amount;
      }

      // Compute break-even round: first round where cumulative payout exceeds purchase price
      let breakEvenRound: string | null = null;
      if (config && payoutRules) {
        let cumulative = 0;
        for (const round of config.rounds) {
          cumulative += actualPot * ((payoutRules[round.key] ?? 0) / 100);
          if (cumulative >= bid.amount) {
            breakEvenRound = round.label;
            break;
          }
        }
      }

      // Convert round keys to display labels (milestone names)
      const roundsWonLabels = config
        ? roundsWon.map((rk) => config.rounds.find((r) => r.key === rk)?.label ?? rk)
        : roundsWon;

      const team: DashboardTeam = {
        teamName: baseTeam?.name ?? `Team ${bid.team_id}`,
        seed: baseTeam?.seed ?? 0,
        group: baseTeam?.group ?? '',
        status,
        purchasePrice: bid.amount,
        earnings,
        roundsWon: roundsWonLabels,
        breakEvenRound,
        leagueName: session.name,
        leagueId: session.id,
      };
      userTeams.push(team);
      if (status === 'alive' || status === 'champion') {
        allAliveTeams.push(team);
      }
    }

    // Add prop bet earnings for this user (count all winning slots, not just first match)
    for (const pr of propResults) {
      const winners = getPropWinners(pr);
      const myWins = winners.filter((w) => w.participantId === user.id).length;
      if (myWins > 0) {
        const fullPayout = actualPot * (pr.payoutPercentage / 100);
        const propPayout = (fullPayout / winners.length) * myWins;
        userTotalEarned += propPayout;
      }
    }

    // Determine current round
    let currentRound: string | null = null;
    let currentRoundLabel: string | null = null;
    if (config && results.length > 0) {
      for (const round of config.rounds) {
        const teamIds = userBids.map((b) => b.team_id);
        const hasAllResults = teamIds.every((id) => {
          const r = results.find((res) => res.team_id === id && res.round_key === round.key);
          return r && r.result !== 'pending';
        });
        if (!hasAllResults) {
          currentRound = round.key;
          currentRoundLabel = round.gameLabel ?? round.label;
          break;
        }
      }
    }

    // Calculate projected P&L for active golf tournaments (blended: settled + projected unsettled)
    let projectedNetPL: number | null = null;
    // Build set of settled round keys per team for blended EV
    const settledRoundsPerTeam = new Map<number, Set<string>>();
    if (config && results.length > 0) {
      for (const bid of userBids) {
        const teamStatus = getTeamStatus(bid.team_id, results, config, playInLosers);
        settledRoundsPerTeam.set(bid.team_id, new Set(teamStatus.roundsWon));
      }
    }

    const PROB_FIELDS: Array<{ ruleKey: string; probField: string }> = [
      { ruleKey: 'winner', probField: 'win_prob' },
      { ruleKey: 'top5', probField: 'top_5_prob' },
      { ruleKey: 'top10', probField: 'top_10_prob' },
      { ruleKey: 'top20', probField: 'top_20_prob' },
      { ruleKey: 'makeCut', probField: 'make_cut_prob' },
    ];

    if (config?.sport === 'golf' && dgPlayers.length > 0 && userBids.length > 0 && actualPot > 0) {
      let blendedEarnings = 0;
      let matched = false;
      for (const bid of userBids) {
        const baseTeam = teams?.find((t) => t.id === bid.team_id);
        if (!baseTeam) continue;
        const dgPlayer = dgPlayerMap.get(normalizeName(baseTeam.name));
        const settledRounds = settledRoundsPerTeam.get(bid.team_id) ?? new Set<string>();

        // Add settled earnings for this team
        const teamStatus = config && results.length > 0
          ? getTeamStatus(bid.team_id, results, config, playInLosers)
          : null;
        const settledEarnings = teamStatus
          ? calculateTeamEarnings(teamStatus.roundsWon, actualPot, adjustedPayoutRules)
          : 0;
        blendedEarnings += settledEarnings;

        // Add projected EV for unsettled rounds only
        if (dgPlayer) {
          matched = true;
          for (const { ruleKey, probField } of PROB_FIELDS) {
            if (settledRounds.has(ruleKey)) continue;
            const prob = (dgPlayer as unknown as Record<string, number | undefined>)[probField];
            const pct = payoutRules[ruleKey];
            if (prob === undefined || prob === null || !pct) continue;
            blendedEarnings += prob * actualPot * (pct / 100);
          }
        }
      }
      if (matched) {
        projectedNetPL = blendedEarnings - userTotalSpent;
      }
    }

    dashboardSessions.push({
      id: session.id,
      name: session.name,
      joinCode: session.join_code,
      status: session.status,
      tournamentId: session.tournament_id,
      tournamentName: config?.name ?? session.tournament_id,
      isCommissioner: commissionerMap.get(session.id) ?? false,
      createdAt: session.created_at,
      participantCount,
      potSize,
      currentRound,
      currentRoundLabel,
      userTeamsCount: userBids.length,
      userTeamsAlive,
      userTeamsEliminated,
      userTotalSpent,
      userTotalEarned,
      userEliminatedCost,
      // Fully completed tournaments: use totalSpent (all fates known).
      // In-progress tournaments: use eliminatedCost (alive teams may still earn).
      userNetPL: (session.status === 'completed' && currentRound === null)
        ? userTotalEarned - userTotalSpent
        : userTotalEarned - userEliminatedCost,
      projectedNetPL,
      userTeams,
    });
  }

  // Totals are lifetime — computed across ALL sessions including completed.
  const totalPotExposure = dashboardSessions.reduce((s, d) => s + d.userTotalSpent, 0);
  const totalEarned = dashboardSessions.reduce((s, d) => s + d.userTotalEarned, 0);
  const totalNetPL = dashboardSessions.reduce((s, d) => s + d.userNetPL, 0);

  // Phase 1: hide sessions for completed/archived tournaments from the active list.
  // Phase 2 will reintroduce them under a collapsible "Past Leagues" section.
  const visibleSessions = dashboardSessions.filter((session) => {
    const tournament = getTournament(session.tournamentId);
    if (!tournament) return true; // unknown tournament — keep visible to avoid orphaning
    const phase = getTournamentPhase(tournament.config);
    return phase === 'live' || phase === 'hostable' || phase === 'upcoming';
  });

  return {
    sessions: visibleSessions,
    totalPotExposure,
    totalEarned,
    totalNetPL,
    aliveTeams: allAliveTeams,
  };
}
