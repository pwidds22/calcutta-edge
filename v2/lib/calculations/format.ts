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

/**
 * Display label for a team's group (NFL division, World Cup group, NCAA region).
 *
 * Stored group values are IDENTIFIERS — devig 'group' scoping and config joins
 * match on them exactly ('AFC_South', not 'AFC South') — so never rewrite them
 * in state, configs, or the DB. Format at the render site only.
 */
export function formatGroupLabel(group: string | null | undefined): string {
  return (group ?? '').replace(/_/g, ' ');
}
