'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuction } from './auction-context';
import { getTeamsForSave } from './auction-state';
import { saveAuctionData } from '@/actions/auction';

/**
 * Auto-save hook: debounces saves to Supabase when auction state is dirty.
 * Waits 1500ms after last change before saving.
 */
export function useAutoSave() {
  const { state, dispatch } = useAuction();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await saveAuctionData({
        teams: getTeamsForSave(state.teams),
        payoutRules: state.payoutRules,
        estimatedPotSize: state.estimatedPotSize,
        eventType: state.config?.id,
        leagueName: state.leagueName,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        dispatch({ type: 'MARK_SAVED' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [state.teams, state.payoutRules, state.estimatedPotSize, state.config?.id, state.leagueName, dispatch]);

  useEffect(() => {
    if (!state.isDirty || state.isLoading) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      save();
    }, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.isDirty, state.isLoading, save]);

  return { isSaving, lastSaved: state.lastSaved, error };
}
