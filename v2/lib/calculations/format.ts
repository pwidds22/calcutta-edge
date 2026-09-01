/**
 * Format a number as currency ($X.XX).
 */
export function formatCurrency(value: number): string {
  return '$' + value.toFixed(2);
}

/**
 * Format a number as a percentage (X.XX%).
 */
export function formatPercent(value: number, decimals = 2): string {
  return (value * 100).toFixed(decimals) + '%';
}

/** The slice of TournamentConfig this module needs — kept structural so
 *  format.ts stays dependency-free (and client-bundle-safe). */
interface GroupLabelConfig {
  groups?: Array<{ key: string; label: string }>;
}

/**
 * Display label for a team's group (NFL division, World Cup group, NCAA region).
 *
 * Stored group values are IDENTIFIERS — devig 'group' scoping and config joins
 * match on them exactly ('AFC_South', not 'AFC South') — so never rewrite them
 * in state, configs, or the DB. Format at the render site only.
 *
 * Pass the tournament config when it's in scope: `config.groups[].label` is the
 * declared display name (it's what bundle titles already use), and it covers
 * labels an underscore-swap can't derive — golf's lowercase keys ('favorites'
 * → 'Favorites'). The swap remains the fallback for configless sites (e.g.
 * dashboard team rows) and unknown keys.
 */
export function formatGroupLabel(
  group: string | null | undefined,
  config?: GroupLabelConfig | null
): string {
  if (!group) return '';
  const label = config?.groups?.find((g) => g.key === group)?.label;
  return label ?? group.replace(/_/g, ' ');
}

/** Minimal shape needed to know how to display a round's `odds` value. */
export interface OddsDisplayRound {
  flatRate?: boolean;
  unitLabel?: string;
}

/**
 * Format a round's `odds` value for display. Most rounds store a 0–1
 * probability of reaching that round, formatted as a percent. A `flatRate`
 * round (e.g. NFL's per-win bonus) stores an expected COUNT instead (e.g.
 * 10.52 expected wins) — running that through formatPercent reads as
 * nonsense ("1051.82%"), so show the count with its unit noun instead.
 * Shared by the strategy table AND the live strategy overlay — the overlay
 * once had its own inline `(odds * 100)%` and shipped "822.6%".
 */
export function formatRoundOdds(value: number, round: OddsDisplayRound): string {
  if (round.flatRate) {
    const noun = round.unitLabel ?? 'unit';
    return `${value.toFixed(1)} ${noun}${value === 1 ? '' : 's'}`;
  }
  return formatPercent(value);
}

/** Tooltip phrasing for a round's odds value — "chance to reach this round"
 *  is nonsense for a flatRate round's expected win count. */
export function formatRoundOddsTooltip(value: number, round: OddsDisplayRound): string {
  if (round.flatRate) {
    const noun = round.unitLabel ?? 'unit';
    return `${value.toFixed(2)} expected ${noun}${value === 1 ? '' : 's'}`;
  }
  return `${formatPercent(value)} chance to reach this round`;
}
