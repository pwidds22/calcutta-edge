-- Per-tournament payment tracking
-- Replaces the single has_paid boolean with per-tournament purchase records
-- Keeps has_paid for backward compatibility during transition

CREATE TABLE IF NOT EXISTS paid_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tournament_id text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  paid_at timestamptz NOT NULL DEFAULT now(),
  stripe_session_id text,
  UNIQUE(user_id, tournament_id)
);

-- RLS: users can read their own purchases
ALTER TABLE paid_tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
  ON paid_tournaments FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (webhook handler)
-- Write operations restricted to service role only (webhook handler).
-- RLS policies with USING(false) block all client-side writes.
-- The service role key bypasses RLS entirely.
CREATE POLICY "Block client inserts" ON paid_tournaments FOR INSERT WITH CHECK (false);
CREATE POLICY "Block client updates" ON paid_tournaments FOR UPDATE USING (false);
CREATE POLICY "Block client deletes" ON paid_tournaments FOR DELETE USING (false);

-- Backfill: existing has_paid=true users get march_madness_2026 access
INSERT INTO paid_tournaments (user_id, tournament_id, amount_cents, paid_at)
SELECT id, 'march_madness_2026', 2999, COALESCE(payment_date, now())
FROM profiles
WHERE has_paid = true
ON CONFLICT (user_id, tournament_id) DO NOTHING;

-- Index for fast lookups
CREATE INDEX idx_paid_tournaments_user ON paid_tournaments(user_id);
