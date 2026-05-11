import Link from 'next/link';
import { listSelectorTournaments } from '@/lib/tournaments/registry';
import { Calendar, ArrowRight } from 'lucide-react';

const SPORT_COLORS: Record<string, string> = {
  ncaa: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  golf: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  horse_racing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  nfl: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function sportLabel(sport: string): string {
  const labels: Record<string, string> = {
    ncaa: 'NCAA',
    golf: 'Golf',
    horse_racing: 'Racing',
    nfl: 'NFL',
  };
  return labels[sport] ?? sport.toUpperCase();
}

export function EventsStripSection() {
  // Phase-aware: shows only live/hostable/upcoming events, already sorted by startDate.
  // Completed and archived tournaments auto-drop off — no manual maintenance per transition.
  const sorted = listSelectorTournaments();

  // If no upcoming events at all, hide the section entirely rather than show an empty grid.
  if (sorted.length === 0) return null;

  return (
    <section className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Upcoming events
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              One platform, every Calcutta
            </h2>
          </div>
          <Link
            href="/events"
            className="hidden items-center gap-1 text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300 sm:inline-flex"
          >
            View all events
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {sorted.slice(0, 4).map((t) => {
            const colorClass = SPORT_COLORS[t.config.sport] ?? 'bg-white/5 text-white/60 border-white/10';
            return (
              <Link
                key={t.config.id}
                href="/events"
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:border-emerald-500/20 hover:bg-white/[0.04]"
              >
                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${colorClass}`}>
                  {sportLabel(t.config.sport)}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                  {t.config.name}
                </h3>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-white/30">
                  <Calendar className="size-3" />
                  {formatDate(t.config.startDate)}
                </div>
                <p className="mt-1 text-[11px] text-white/30">
                  {t.teams.length} {t.config.teamLabel}{t.teams.length !== 1 ? 's' : ''}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
          >
            View all events
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
