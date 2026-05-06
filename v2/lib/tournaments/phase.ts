import type { TournamentConfig, TournamentPhase } from './types';

const DEFAULT_ARCHIVE_DAYS_AFTER_END = 30;

function parseISODate(date: string): Date {
  // Treat ISO date strings (no time component) as UTC midnight.
  return new Date(date.includes('T') ? date : `${date}T00:00:00Z`);
}

function endOfDay(date: string): Date {
  const d = parseISODate(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Compute the lifecycle phase of a tournament.
 *
 * Boundaries:
 *   - upcoming:  now < hostingOpensAt
 *   - hostable:  hostingOpensAt <= now < startDate
 *   - live:      startDate <= now <= end-of-endDate (inclusive)
 *   - completed: end-of-endDate < now < archiveAt (default: endDate + 30d)
 *   - archived:  now >= archiveAt
 *
 * If `phaseOverride` is set, returns it directly.
 * If `hostingOpensAt` is missing, the tournament is hostable from the beginning of time.
 */
export function getTournamentPhase(
  config: TournamentConfig,
  now: Date = new Date()
): TournamentPhase {
  if (config.phaseOverride) return config.phaseOverride;

  const hostingOpens = config.hostingOpensAt
    ? parseISODate(config.hostingOpensAt)
    : null;
  const startDate = parseISODate(config.startDate);
  const endDateInclusive = endOfDay(config.endDate);
  const archiveAt = config.archiveAt
    ? parseISODate(config.archiveAt)
    : addDays(endDateInclusive, DEFAULT_ARCHIVE_DAYS_AFTER_END);

  if (hostingOpens && now < hostingOpens) return 'upcoming';
  if (now < startDate) return 'hostable';
  if (now <= endDateInclusive) return 'live';
  if (now < archiveAt) return 'completed';
  return 'archived';
}

/** True when a tournament is in the bookable + active windows. Replacement for legacy `isActive`. */
export function isTournamentActive(
  config: TournamentConfig,
  now: Date = new Date()
): boolean {
  const phase = getTournamentPhase(config, now);
  return phase === 'hostable' || phase === 'live';
}
