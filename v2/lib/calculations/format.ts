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
