'use server';

import { createClient } from '@/lib/supabase/server';
import type { SavedTeamData, PayoutRules } from '@/lib/calculations/types';

export async function loadAuctionData(
  eventType: string = 'march_madness_2026',
  leagueName: string = 'My Auction'
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('auction_data')
    .select('teams, payout_rules, estimated_pot_size, league_name')
    .eq('user_id', user.id)
    .eq('event_type', eventType)
    .eq('league_name', leagueName)
    .single();

  if (error || !data) return null;

  return {
    teams: (data.teams as SavedTeamData[]) ?? [],
    payoutRules: data.payout_rules as PayoutRules,
    estimatedPotSize: data.estimated_pot_size as number,
    leagueName: data.league_name as string,
  };
}

export async function saveAuctionData(payload: {
  teams: SavedTeamData[];
  payoutRules: PayoutRules;
  estimatedPotSize: number;
  eventType?: string;
  leagueName?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated' };

  const eventType = payload.eventType ?? 'march_madness_2026';
  const leagueName = payload.leagueName ?? 'My Auction';

  const { error } = await supabase.from('auction_data').upsert(
    {
      user_id: user.id,
      event_type: eventType,
      league_name: leagueName,
      teams: payload.teams,
      payout_rules: payload.payoutRules,
      estimated_pot_size: payload.estimatedPotSize,
    },
    { onConflict: 'user_id,event_type,league_name' }
  );

  if (error) return { error: error.message };
  return { success: true };
}

export async function resetAuctionData(
  eventType: string = 'march_madness_2026',
  leagueName: string = 'My Auction'
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('auction_data')
    .delete()
    .eq('user_id', user.id)
    .eq('event_type', eventType)
    .eq('league_name', leagueName);

  if (error) return { error: error.message };
  return { success: true };
}

/** List all league names for a user + event type */
export async function listUserLeagues(
  eventType: string = 'march_madness_2026'
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('auction_data')
    .select('league_name')
    .eq('user_id', user.id)
    .eq('event_type', eventType)
    .order('league_name');

  if (error || !data) return [];

  return data.map((d) => d.league_name as string);
}

/** Rename a league */
export async function renameLeague(
  eventType: string,
  oldName: string,
  newName: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated' };

  const trimmed = newName.trim();
  if (!trimmed) return { error: 'Name cannot be empty' };
  if (trimmed.length > 40) return { error: 'Name must be 40 characters or less' };

  const { error } = await supabase
    .from('auction_data')
    .update({ league_name: trimmed })
    .eq('user_id', user.id)
    .eq('event_type', eventType)
    .eq('league_name', oldName);

  if (error) return { error: error.message };
  return { success: true };
}
