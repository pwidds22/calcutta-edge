// Pure coercion logic for the flat-rate round win-count input in
// ResultsEntry (v2/components/live/results-entry.tsx). Split out so the
// value -> (result, count) decision can be unit-tested without importing
// the client component (and its React/lucide/server-action dependencies).

/** Largest number of wins a single NFL team can record in a regular season. */
export const MAX_FLAT_RATE_UNITS = 17;

export type UnitEntryDecision =
  | { action: 'skip' }
  | { action: 'save'; result: 'won' | 'lost'; count: number };

/**
 * Turns the raw text of a flat-rate win-count `<input>` into a save decision.
 *
 * - Empty or whitespace-only input means "no change" — the commissioner is
 *   mid-edit (cleared the field to retype) and blurring must NOT wipe a
 *   previously-saved count by writing 0.
 * - Non-numeric input ("abc") is also "no change" for the same reason.
 * - A real number is clamped to [0, MAX_FLAT_RATE_UNITS]. `0` is a
 *   legitimate, deliberate entry (a winless team) and always saves as
 *   'lost' with count 0 — only an *empty* field means "no change".
 */
export function resolveUnitEntry(rawValue: string): UnitEntryDecision {
  const trimmed = rawValue.trim();
  if (trimmed === '') return { action: 'skip' };

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) return { action: 'skip' };

  const count = Math.min(MAX_FLAT_RATE_UNITS, Math.max(0, parsed));
  return { action: 'save', result: count > 0 ? 'won' : 'lost', count };
}

/**
 * The stored/broadcast shape of a result's unit count.
 *
 * A 'pending' result has no count — clearing it is the whole point of going back
 * to pending. Every writer must apply this rule to BOTH the row it upserts and
 * the payload it broadcasts, or clients render a count the database does not hold
 * and it silently disappears on the next reload. `bulkUpdateResults` re-emitted
 * its raw input and diverged exactly that way.
 */
export function normalizeResultCount(
  result: 'won' | 'lost' | 'pending',
  resultCount?: number | null
): number | null {
  return result === 'pending' ? null : (resultCount ?? null);
}
