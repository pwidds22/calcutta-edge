'use client';

import { useEffect, useState } from 'react';
import type { PayoutRules } from '@/lib/tournaments/types';
import type { SessionSettings } from './types';

/**
 * Live view of the three session fields the commissioner can edit mid-session:
 * payout rules, estimated pot size, and settings.
 *
 * WHY THIS EXISTS: `updateSessionSettings` broadcasts SETTINGS_UPDATED, and
 * `use-auction-channel` forwards that payload to a `window.__settingsUpdate`
 * global. A global is invisible to the type checker, so "who still needs to
 * subscribe?" has no answer the compiler can give — and in practice only
 * `commissioner-view` ever registered a handler. Every participant therefore
 * dropped the broadcast entirely and kept rendering the server props captured
 * at page load: the commissioner would raise the pot in the lobby, and each
 * participant's strategy overlay went on quoting fair values off the old pot
 * for the whole auction, then settled on the old payout rules afterwards.
 *
 * Owning the subscription here means a view gets the live values by using the
 * hook, rather than by remembering to register a global. The registration is
 * still last-write-wins on one `window` key, which is safe only because the two
 * views are mutually exclusive — `/live/[sessionId]` redirects commissioners to
 * `/host/[sessionId]`, so exactly one is ever mounted.
 *
 * `initial` is read once, at mount. Re-rendering the parent with new server
 * props does NOT reset these — that is deliberate: a router refresh mid-auction
 * must not clobber a newer broadcast we have already applied.
 */
export function useLiveSessionSettings(initial: {
  payoutRules: PayoutRules;
  estimatedPotSize: number;
  settings: SessionSettings;
}) {
  const [payoutRules, setPayoutRules] = useState<PayoutRules>(initial.payoutRules);
  const [estimatedPotSize, setEstimatedPotSize] = useState<number>(initial.estimatedPotSize);
  const [settings, setSettings] = useState<SessionSettings>(initial.settings);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__settingsUpdate = (
      payload: Record<string, unknown>
    ) => {
      // `!= null`, not truthiness: an estimated pot of 0 is a value a host can
      // legitimately save, and `if (payload.estimatedPotSize)` would drop it.
      if (payload.payoutRules != null) setPayoutRules(payload.payoutRules as PayoutRules);
      if (payload.estimatedPotSize != null) {
        setEstimatedPotSize(payload.estimatedPotSize as number);
      }
      if (payload.settings != null) setSettings(payload.settings as SessionSettings);
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__settingsUpdate;
    };
  }, []);

  /** Apply a local save immediately, without waiting for our own broadcast echo. */
  const applyLocalUpdate = (updates: {
    payoutRules: PayoutRules;
    estimatedPotSize: number;
    settings: SessionSettings;
  }) => {
    setPayoutRules(updates.payoutRules);
    setEstimatedPotSize(updates.estimatedPotSize);
    setSettings(updates.settings);
  };

  return { payoutRules, estimatedPotSize, settings, applyLocalUpdate };
}
