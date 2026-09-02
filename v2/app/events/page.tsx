import { listTournamentsByPhase } from '@/lib/tournaments/registry';
import { TournamentCard } from '@/components/events/tournament-card';
import { PublicPageLayout } from '@/components/layout/public-page-layout';

// Derived from dates on every request, so the buckets below can never go stale
// between deploys. Without this the page is built once and keeps whatever the
// calendar looked like that day.
export const revalidate = 3600;

export const metadata = {
  title: 'Events & Tournaments | Calcutta Edge',
  description:
    'Browse Calcutta auction tournaments open for hosting — the NFL season, March Madness, golf majors, the World Cup and more. Host your auction for free.',
};

export default function EventsPage() {
  // Phase, never `config.isActive`. `isActive` is the legacy flag and it lies:
  // the PGA Championship (ended May) and the World Cup (ended July) both still
  // carry `isActive: true`, so this page filed two finished tournaments under a
  // pulsing "Live Now" badge and sorted them ABOVE the NFL season — the one
  // event a visitor can actually host right now.
  const byPhase = listTournamentsByPhase();
  const byStartDate = (a: { config: { startDate: string } }, b: { config: { startDate: string } }) =>
    a.config.startDate.localeCompare(b.config.startDate);

  const live = [...byPhase.live].sort(byStartDate);
  // Hostable and upcoming share a section: both are "coming", and the card's own
  // CTA is what distinguishes "host it now" from "opens later".
  const upcoming = [...byPhase.hostable, ...byPhase.upcoming].sort(byStartDate);
  // Completed events stay listed — they are real pages with real search value —
  // but plainly labelled as finished. Archived ones drop off entirely.
  const past = [...byPhase.completed].sort((a, b) =>
    b.config.endDate.localeCompare(a.config.endDate)
  );

  return (
    <PublicPageLayout>
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Events & Tournaments
          </h1>
          <p className="mt-3 text-base text-white/50">
            Pick a tournament, host your Calcutta auction for free, and unlock strategy analytics to dominate your pool.
          </p>
        </div>

        {/* Tournaments actually in progress right now */}
        {live.length > 0 && (
          <section className="mb-12">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Live Now</h2>
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {live.map((t) => (
                <TournamentCard
                  key={t.config.id}
                  config={t.config}
                  teamCount={t.teams.length}
                  isActive
                />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming tournaments */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Open for Hosting
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((t) => (
                <TournamentCard
                  key={t.config.id}
                  config={t.config}
                  teamCount={t.teams.length}
                />
              ))}
            </div>
          </section>
        )}

        {/* Finished events — kept for search value, honestly labelled. */}
        {past.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-lg font-semibold text-white/50">
              Recently Completed
            </h2>
            <div className="grid gap-6 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((t) => (
                <TournamentCard
                  key={t.config.id}
                  config={t.config}
                  teamCount={t.teams.length}
                />
              ))}
            </div>
          </section>
        )}

        {/* Coming soon CTA */}
        <section className="mt-16 text-center">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-8">
            <h3 className="text-lg font-semibold text-white">
              Don&apos;t see your tournament?
            </h3>
            <p className="mt-2 text-sm text-white/40">
              We&apos;re adding new events every season. Need a custom Calcutta for your group?
            </p>
            <a
              href="mailto:support@calcuttaedge.com"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Contact Us
            </a>
          </div>
        </section>
      </main>
    </PublicPageLayout>
  );
}
