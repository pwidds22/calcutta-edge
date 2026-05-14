import { redirect } from 'next/navigation';
import { getSessionState } from '@/actions/session';
import { getTournament } from '@/lib/tournaments/registry';
import { getOddsRegistry } from '@/lib/tournaments/registry';
import { ParticipantView } from '@/components/live/participant-view';

export default async function LiveAuctionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const result = await getSessionState(sessionId);
  if ('error' in result) redirect('/host');

  // Commissioners go to their control panel
  if (result.isCommissioner) redirect(`/host/${sessionId}`);

  const tournament = getTournament(result.session.tournament_id);
  if (!tournament) redirect('/host');

  const oddsRegistry = await getOddsRegistry(result.session.tournament_id);

  // Prefer the frozen snapshot from session creation when present, so this
  // view is immune to later config changes (e.g., an odds refresh that
  // reshuffles team IDs).
  const baseTeams =
    result.session.settings?.teamSnapshot ?? tournament.teams;

  return (
    <ParticipantView
      session={result.session}
      participants={result.participants}
      participantMap={result.participantMap}
      winningBids={result.winningBids}
      currentBids={result.currentBids}
      config={tournament.config}
      baseTeams={baseTeams}
      userId={result.userId}
      hasPaid={result.hasPaid}
      tournamentResults={result.tournamentResults}
      oddsRegistry={oddsRegistry}
    />
  );
}
