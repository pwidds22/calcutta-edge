'use client';

import { useState } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { EnabledProp } from '@/lib/tournaments/props';
import type { PropResult } from '@/lib/tournaments/props';
import type { BaseTeam } from '@/lib/tournaments/types';
import { updatePropResult } from '@/actions/tournament-results';
import { Dice5, CheckCircle2, Save, AlertTriangle } from 'lucide-react';

interface PropsEntryProps {
  sessionId: string;
  enabledProps: EnabledProp[];
  propResults: PropResult[];
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  isCommissioner: boolean;
  actualPot: number;
  onPropResultUpdate?: (result: PropResult) => void;
}

export function PropsEntry({
  sessionId,
  enabledProps,
  propResults,
  soldTeams,
  baseTeams,
  isCommissioner,
  actualPot,
  onPropResultUpdate,
}: PropsEntryProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local edits — keyed by prop key
  const [localEdits, setLocalEdits] = useState<
    Record<string, { participantId: string; teamId: string; metadata: string }>
  >({});

  // Build participant list from sold teams (deduplicated)
  const participantMap = new Map<string, string>();
  for (const sold of soldTeams) {
    if (!participantMap.has(sold.winnerId)) {
      participantMap.set(sold.winnerId, sold.winnerName);
    }
  }
  const participants = Array.from(participantMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));

  // Build team lookup
  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));

  // Get existing result for a prop
  const getResult = (propKey: string): PropResult | undefined =>
    propResults.find((r) => r.key === propKey);

  // Get local edit state (or initialize from existing result)
  const getEditState = (propKey: string) => {
    if (localEdits[propKey]) return localEdits[propKey];
    const existing = getResult(propKey);
    return {
      participantId: existing?.winnerParticipantId ?? '',
      teamId: existing?.winnerTeamId?.toString() ?? '',
      metadata: existing?.metadata ?? '',
    };
  };

  const handleSave = async (prop: EnabledProp) => {
    const edit = getEditState(prop.key);
    if (!edit.participantId) {
      setError(`Select a winner for "${prop.label}"`);
      return;
    }

    setSaving(prop.key);
    setError(null);

    const result = await updatePropResult(
      sessionId,
      prop.key,
      prop.label,
      edit.participantId,
      edit.teamId ? parseInt(edit.teamId, 10) : null,
      edit.metadata,
      prop.percentage
    );

    if (result.error) {
      setError(result.error);
    } else {
      // Notify parent of update
      onPropResultUpdate?.({
        key: prop.key,
        label: prop.label,
        winnerParticipantId: edit.participantId,
        winnerTeamId: edit.teamId ? parseInt(edit.teamId, 10) : null,
        metadata: edit.metadata,
        payoutPercentage: prop.percentage,
      });
    }

    setSaving(null);
  };

  if (enabledProps.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <Dice5 className="mx-auto mb-3 size-8 text-white/20" />
        <p className="text-sm text-white/40">No prop bets configured for this session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/70">Prop Bets</h3>
        <span className="text-[10px] text-white/30">
          {propResults.filter((r) => r.winnerParticipantId).length} / {enabledProps.length} resolved
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="size-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        {enabledProps.map((prop) => {
          const existing = getResult(prop.key);
          const isResolved = !!existing?.winnerParticipantId;
          const edit = getEditState(prop.key);
          const payout = actualPot * (prop.percentage / 100);
          const winnerName = existing?.winnerParticipantId
            ? participantMap.get(existing.winnerParticipantId) ?? 'Unknown'
            : null;

          // Teams owned by the selected participant (for optional team selector)
          const selectedParticipantTeams = edit.participantId
            ? soldTeams
                .filter((s) => s.winnerId === edit.participantId)
                .map((s) => ({ id: s.teamId, name: teamMap.get(s.teamId)?.name ?? `Team ${s.teamId}` }))
            : [];

          return (
            <div
              key={prop.key}
              className={`rounded-lg border p-4 transition-colors ${
                isResolved
                  ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-white">
                      {prop.isCustom ? prop.customLabel || prop.label : prop.label}
                    </h4>
                    {isResolved && (
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {prop.percentage}% of pot = ${Math.round(payout).toLocaleString()}
                  </p>
                </div>

                {isResolved && !isCommissioner && (
                  <div className="text-right">
                    <p className="text-xs text-emerald-400 font-medium">
                      {winnerName}
                    </p>
                    {existing?.metadata && (
                      <p className="text-[10px] text-white/30 mt-0.5">
                        {existing.metadata}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Commissioner edit controls */}
              {isCommissioner && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {/* Winner selector */}
                    <div>
                      <label className="block text-[10px] text-white/40 mb-0.5">
                        Winner
                      </label>
                      <select
                        value={edit.participantId}
                        onChange={(e) =>
                          setLocalEdits((prev) => ({
                            ...prev,
                            [prop.key]: { ...edit, participantId: e.target.value, teamId: '' },
                          }))
                        }
                        className="h-8 w-full rounded border border-white/10 bg-white/[0.04] px-2 text-xs text-white focus:border-emerald-500/50 focus:outline-none"
                      >
                        <option value="" className="bg-zinc-900">
                          Select winner...
                        </option>
                        {participants.map((p) => (
                          <option key={p.id} value={p.id} className="bg-zinc-900">
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Team selector (optional — shows teams owned by selected participant) */}
                    {selectedParticipantTeams.length > 0 && (
                      <div>
                        <label className="block text-[10px] text-white/40 mb-0.5">
                          Winning Team <span className="text-white/20">(optional)</span>
                        </label>
                        <select
                          value={edit.teamId}
                          onChange={(e) =>
                            setLocalEdits((prev) => ({
                              ...prev,
                              [prop.key]: { ...edit, teamId: e.target.value },
                            }))
                          }
                          className="h-8 w-full rounded border border-white/10 bg-white/[0.04] px-2 text-xs text-white focus:border-emerald-500/50 focus:outline-none"
                        >
                          <option value="" className="bg-zinc-900">
                            Any / N/A
                          </option>
                          {selectedParticipantTeams.map((t) => (
                            <option key={t.id} value={t.id} className="bg-zinc-900">
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Metadata / notes */}
                  <div>
                    <label className="block text-[10px] text-white/40 mb-0.5">
                      Details <span className="text-white/20">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={edit.metadata}
                      onChange={(e) =>
                        setLocalEdits((prev) => ({
                          ...prev,
                          [prop.key]: { ...edit, metadata: e.target.value },
                        }))
                      }
                      placeholder='e.g. "14-seed Colgate beat 3-seed Baylor by 12"'
                      className="h-8 w-full rounded border border-white/10 bg-white/[0.04] px-2 text-xs text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSave(prop)}
                    disabled={saving === prop.key || !edit.participantId}
                    className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save className="size-3" />
                    {saving === prop.key ? 'Saving...' : isResolved ? 'Update' : 'Save Result'}
                  </button>
                </div>
              )}

              {/* Read-only participant view */}
              {!isCommissioner && !isResolved && (
                <p className="mt-2 text-[10px] text-white/25 italic">
                  Awaiting commissioner to enter result
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
