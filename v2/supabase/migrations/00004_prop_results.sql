-- Add prop_results JSONB column to auction_sessions
-- Stores resolved prop bet results as an array of PropResult objects:
-- [{ key, label, winnerParticipantId, winnerTeamId, metadata, payoutPercentage }]
ALTER TABLE public.auction_sessions
  ADD COLUMN IF NOT EXISTS prop_results jsonb DEFAULT '[]';
