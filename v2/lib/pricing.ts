/**
 * Central place for strategy-tool pricing constants.
 *
 * Until 2026-05 we had the price duplicated as literal strings in 14+ files
 * (welcome email, landing pricing card, JSON-LD offers, meta descriptions,
 * fallback values, etc.). A single price change required a 14-file sweep and
 * was prone to misses (e.g., the welcome email lagged for 3 weeks at $29.99).
 *
 * Going forward: any new place that needs to display or compute the strategy
 * price should import from here. Per-tournament overrides still live on
 * `TournamentConfig.strategyPrice` — this constant is the global default and
 * the fallback when a config is missing the field.
 */

/** Default strategy-tool price in cents. */
export const STRATEGY_PRICE_CENTS = 1499;

/** Default strategy-tool price formatted as a dollar string (no $ prefix). */
export const STRATEGY_PRICE_DOLLARS = (STRATEGY_PRICE_CENTS / 100).toFixed(2);

/** Default strategy-tool price formatted with $ prefix. */
export const STRATEGY_PRICE_LABEL = `$${STRATEGY_PRICE_DOLLARS}`;
