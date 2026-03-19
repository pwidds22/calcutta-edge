'use server';

import { createClient } from '@/lib/supabase/server';
import { getTournament } from '@/lib/tournaments/registry';
import { getTeamStatus, calculateTeamEarnings } from '@/lib/auction/live/actual-payouts';
import type { TournamentResult } from '@/actions/tournament-results';
import type { PayoutRules } from '@/lib/tournaments/types';

export interface DashboardTeam {
  teamName: string;
  seed: number;
  group: string;
  status: 'alive' | 'eliminated' | 'champion';
  purchasePrice: number;
  earnings: number;
  roundsWon: string[];
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
    .select('id, name, join_code, status, tournament_id, created_at, estimated_pot_size, payout_rules, auction_participants(count)')
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

  // Load all winning bids for actual pot calculation
  const { data: allWinningBids } = await supabase
    .from('auction_bids')
    .select('session_id, amount')
    .eq('is_winning_bid', true)
    .in('session_id', sessionIds);

  const potBySession = new Map<string, number>();
  for (const bid of allWinningBids ?? []) {
    potBySession.set(bid.session_id, (potBySession.get(bid.session_id) ?? 0) + Number(bid.amount));
  }

  // Load tournament results for completed sessions
  const completedIds = sessions.filter((s) => s.status === 'completed').map((s) => s.id);
  let resultsBySession = new Map<string, TournamentResult[]>();
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
        const teamStatus = getTeamStatus(bid.team_id, results, config);
        status = teamStatus.status;
        roundsWon = teamStatus.roundsWon;
        earnings = calculateTeamEarnings(roundsWon, actualPot, payoutRules);
      }

      userTotalEarned += earnings;
      if (status === 'alive' || status === 'champion') {
        userTeamsAlive++;
      } else if (status === 'eliminated') {
        userTeamsEliminated++;
        userEliminatedCost += bid.amount;
      }

      const team: DashboardTeam = {
        teamName: baseTeam?.name ?? `Team ${bid.team_id}`,
        seed: baseTeam?.seed ?? 0,
        group: baseTeam?.group ?? '',
        status,
        purchasePrice: bid.amount,
        earnings,
        roundsWon,
        leagueName: session.name,
        leagueId: session.id,
      };
      userTeams.push(team);
      if (status === 'alive' || status === 'champion') {
        allAliveTeams.push(team);
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
          currentRoundLabel = round.label;
          break;
        }
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
      userNetPL: userTotalEarned - userEliminatedCost, // Only count eliminated teams as losses
      userTeams,
    });
  }

  const totalPotExposure = dashboardSessions.reduce((s, d) => s + d.userTotalSpent, 0);
  const totalEarned = dashboardSessions.reduce((s, d) => s + d.userTotalEarned, 0);
  const totalEliminatedCost = dashboardSessions.reduce((s, d) => s + d.userEliminatedCost, 0);

  return {
    sessions: dashboardSessions,
    totalPotExposure,
    totalEarned,
    totalNetPL: totalEarned - totalEliminatedCost,
    aliveTeams: allAliveTeams,
  };
}
