import { redirect } from 'next/navigation';
import { getSessionState } from '@/actions/session';
import { getTournament, getOddsRegistry } from '@/lib/tournaments/registry';
import { CommissionerView } from '@/components/live/commissioner-view';

export default async function CommissionerPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const result = await getSessionState(sessionId);
  if ('error' in result) redirect('/host');
  if (!result.isCommissioner) redirect(`/live/${sessionId}`);

  const tournament = getTournament(result.session.tournament_id);
  if (!tournament) redirect('/host');

  const oddsRegistry = getOddsRegistry(result.session.tournament_id);

  return (
    <CommissionerView
      session={result.session}
      participants={result.participants}
      participantMap={result.participantMap}
      winningBids={result.winningBids}
      currentBids={result.currentBids}
      config={tournament.config}
      baseTeams={tournament.teams}
      userId={result.userId}
      hasPaid={result.hasPaid}
      tournamentResults={result.tournamentResults}
      oddsRegistry={oddsRegistry}
    />
  );
}
