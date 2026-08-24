import { listHostableTournaments } from '@/lib/tournaments/registry';
import { CreateSessionForm } from '@/components/live/create-session-form';

interface CreateSessionPageProps {
  searchParams: Promise<{ tournament?: string }>;
}

export default async function CreateSessionPage({ searchParams }: CreateSessionPageProps) {
  const tournaments = listHostableTournaments();
  const params = await searchParams;
  const initialTournamentId = params.tournament ?? undefined;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <CreateSessionForm
        tournaments={tournaments}
        initialTournamentId={initialTournamentId}
      />
    </div>
  );
}
