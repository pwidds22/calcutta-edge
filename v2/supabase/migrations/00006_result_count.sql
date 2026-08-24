-- Per-unit results: a round may pay a flat rate per unit (NFL: one payout per
-- regular-season win) rather than once per team. NULL means 1, so every existing
-- golf / World Cup row is unaffected. Numeric so a tie can count 0.5.
alter table public.tournament_results
  add column if not exists result_count numeric;

comment on column public.tournament_results.result_count is
  'Units won in this round. NULL = 1. NFL per-win rounds store the win total; a tie counts 0.5.';
