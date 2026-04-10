'use client';

import { useState, useMemo } from 'react';
import type { SoldTeam } from '@/lib/auction/live/use-auction-channel';
import type { EnabledProp } from '@/lib/tournaments/props';
import type { PropResult, PropWinner } from '@/lib/tournaments/props';
import { getPropWinners } from '@/lib/tournaments/props';
import type { BaseTeam } from '@/lib/tournaments/types';
import { updatePropResult } from '@/actions/tournament-results';
import { Dice5, CheckCircle2, Save, AlertTriangle, Search } from 'lucide-react';

interface PropsEntryProps {
  sessionId: string;
  enabledProps: EnabledProp[];
  propResults: PropResult[];
  soldTeams: SoldTeam[];
  baseTeams: BaseTeam[];
  isCommissioner: boolean;
  actualPot: number;
  isGolf?: boolean;
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
  isGolf = false,
  onPropResultUpdate,
}: PropsEntryProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});

  // Golf mode: track selected team IDs (golfers) — derive participant IDs from them
  // Non-golf mode: track selected participant IDs directly
  const [localEdits, setLocalEdits] = useState<
    Record<string, { selectedTeamIds: number[]; selectedParticipantIds: string[]; metadata: string }>
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

  // Build team→owner mapping
  const teamOwnerMap = useMemo(() => {
    const map = new Map<number, { ownerId: string; ownerName: string }>();
    for (const sold of soldTeams) {
      map.set(sold.teamId, { ownerId: sold.winnerId, ownerName: sold.winnerName });
    }
    return map;
  }, [soldTeams]);

  // Build golfer list (baseTeams that are sold, with owner info)
  const golfers = useMemo(() => {
    if (!isGolf) return [];
    return baseTeams
      .filter((t) => teamOwnerMap.has(t.id))
      .map((t) => {
        const owner = teamOwnerMap.get(t.id)!;
        return {
          teamId: t.id,
          name: t.name,
          seed: t.seed,
          group: t.group,
          ownerId: owner.ownerId,
          ownerName: owner.ownerName,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [isGolf, baseTeams, teamOwnerMap]);

  // Get existing result for a prop
  const getResult = (propKey: string): PropResult | undefined =>
    propResults.find((r) => r.key === propKey);

  // Get local edit state (or initialize from existing result)
  const getEditState = (propKey: string) => {
    if (localEdits[propKey]) return localEdits[propKey];
    const existing = getResult(propKey);
    if (existing) {
      const winners = getPropWinners(existing);
      return {
        selectedTeamIds: winners.filter((w) => w.teamId).map((w) => w.teamId!),
        selectedParticipantIds: winners.map((w) => w.participantId),
        metadata: existing.metadata ?? '',
      };
    }
    return { selectedTeamIds: [] as number[], selectedParticipantIds: [] as string[], metadata: '' };
  };

  // Non-golf: toggle participant
  const toggleParticipant = (propKey: string, participantId: string) => {
    const edit = getEditState(propKey);
    const current = edit.selectedParticipantIds;
    const updated = current.includes(participantId)
      ? current.filter((id) => id !== participantId)
      : [...current, participantId];
    setLocalEdits((prev) => ({
      ...prev,
      [propKey]: { ...edit, selectedParticipantIds: updated },
    }));
  };

  // Golf: toggle golfer (team) — tracks team ID and derives participant
  const toggleGolfer = (propKey: string, teamId: number) => {
    const edit = getEditState(propKey);
    const current = edit.selectedTeamIds;
    const updated = current.includes(teamId)
      ? current.filter((id) => id !== teamId)
      : [...current, teamId];
    // Derive unique participant IDs from selected teams
    const participantIds = [...new Set(updated.map((tid) => teamOwnerMap.get(tid)?.ownerId).filter(Boolean))] as string[];
    setLocalEdits((prev) => ({
      ...prev,
      [propKey]: { ...edit, selectedTeamIds: updated, selectedParticipantIds: participantIds, metadata: edit.metadata },
    }));
  };

  const handleSave = async (prop: EnabledProp) => {
    const edit = getEditState(prop.key);
    const hasWinners = isGolf ? edit.selectedTeamIds.length > 0 : edit.selectedParticipantIds.length > 0;
    if (!hasWinners) {
      setError(`Select at least one winner for "${prop.label}"`);
      return;
    }

    setSaving(prop.key);
    setError(null);

    // Build winners array — golf mode includes teamId
    const winners: PropWinner[] = isGolf
      ? edit.selectedTeamIds.map((tid) => ({
          participantId: teamOwnerMap.get(tid)?.ownerId ?? '',
          teamId: tid,
        }))
      : edit.selectedParticipantIds.map((pid) => ({
          participantId: pid,
        }));

    const firstWinner = winners[0];

    const result = await updatePropResult(
      sessionId,
      prop.key,
      prop.label,
      firstWinner.participantId,
      firstWinner.teamId ?? null,
      edit.metadata,
      prop.percentage,
      winners
    );

    if (result.error) {
      setError(result.error);
    } else {
      onPropResultUpdate?.({
        key: prop.key,
        label: prop.label,
        winnerParticipantId: firstWinner.participantId,
        winnerTeamId: firstWinner.teamId ?? null,
        winners,
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

  // Build team name lookup
  const teamNameMap = new Map(baseTeams.map((t) => [t.id, t.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/70">Prop Bets</h3>
        <span className="text-[10px] text-white/30">
          {propResults.filter((r) => r.winnerParticipantId || (r.winners && r.winners.length > 0)).length} / {enabledProps.length} resolved
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
          const existingWinners = existing ? getPropWinners(existing) : [];
          const isResolved = existingWinners.length > 0;
          const edit = getEditState(prop.key);
          const payout = actualPot * (prop.percentage / 100);
          const splitCount = isGolf ? edit.selectedTeamIds.length : edit.selectedParticipantIds.length;

          // Build winner display names
          const winnerNames = existingWinners.map((w) => {
            if (w.teamId) {
              const golferName = teamNameMap.get(w.teamId);
              const ownerName = participantMap.get(w.participantId) ?? 'Unknown';
              return golferName ? `${golferName} (${ownerName})` : ownerName;
            }
            return participantMap.get(w.participantId) ?? 'Unknown';
          });

          // Filter golfers by search query for this prop
          const query = (searchQuery[prop.key] ?? '').toLowerCase();
          const filteredGolfers = query
            ? golfers.filter((g) =>
                g.name.toLowerCase().includes(query) ||
                g.ownerName.toLowerCase().includes(query)
              )
            : golfers;

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
                    {splitCount > 1 && (
                      <span className="text-amber-400/60 ml-1">
                        (split {splitCount} ways = ${Math.round(payout / splitCount).toLocaleString()} each)
                      </span>
                    )}
                  </p>
                </div>

                {isResolved && !isCommissioner && (
                  <div className="text-right">
                    <p className="text-xs text-emerald-400 font-medium">
                      {winnerNames.join(', ')}
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
                  {isGolf ? (
                    /* Golf mode: search and select golfers */
                    <div>
                      <label className="block text-[10px] text-white/40 mb-1.5">
                        Golfer(s) <span className="text-white/20">— search by name, select multiple for ties</span>
                      </label>
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-white/25" />
                        <input
                          type="text"
                          value={searchQuery[prop.key] ?? ''}
                          onChange={(e) =>
                            setSearchQuery((prev) => ({ ...prev, [prop.key]: e.target.value }))
                          }
                          placeholder="Search golfers..."
                          className="h-8 w-full rounded border border-white/10 bg-white/[0.04] pl-7 pr-2 text-xs text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none"
                        />
                      </div>
                      {/* Selected golfers chips */}
                      {edit.selectedTeamIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {edit.selectedTeamIds.map((tid) => {
                            const golferName = teamNameMap.get(tid) ?? `Team ${tid}`;
                            const ownerName = teamOwnerMap.get(tid)?.ownerName ?? '';
                            return (
                              <span
                                key={tid}
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-400"
                              >
                                {golferName}
                                <span className="text-white/30">({ownerName})</span>
                                <button
                                  type="button"
                                  onClick={() => toggleGolfer(prop.key, tid)}
                                  className="ml-0.5 text-white/30 hover:text-white/60"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {/* Golfer grid */}
                      <div className="max-h-48 overflow-y-auto rounded border border-white/[0.06] bg-white/[0.01]">
                        {filteredGolfers.map((g) => {
                          const isSelected = edit.selectedTeamIds.includes(g.teamId);
                          return (
                            <button
                              key={g.teamId}
                              type="button"
                              onClick={() => toggleGolfer(prop.key, g.teamId)}
                              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs border-b border-white/[0.03] last:border-0 transition-colors ${
                                isSelected
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'text-white/60 hover:bg-white/[0.03]'
                              }`}
                            >
                              <span>
                                {isSelected && <CheckCircle2 className="inline size-3 mr-1" />}
                                {g.name}
                              </span>
                              <span className="text-[10px] text-white/25">{g.ownerName}</span>
                            </button>
                          );
                        })}
                        {filteredGolfers.length === 0 && (
                          <p className="px-3 py-2 text-[10px] text-white/25">No golfers match "{query}"</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Non-golf: participant toggle buttons */
                    <div>
                      <label className="block text-[10px] text-white/40 mb-1.5">
                        Winner(s) <span className="text-white/20">— select multiple for ties</span>
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {participants.map((p) => {
                          const isSelected = edit.selectedParticipantIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleParticipant(prop.key, p.id)}
                              className={`rounded-md border px-2.5 py-1.5 text-xs text-left transition-colors ${
                                isSelected
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                                  : 'border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.04]'
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="inline size-3 mr-1" />}
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

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
                      placeholder={isGolf ? 'e.g. "Rory McIlroy, Sam Burns — 65 (-5)"' : 'e.g. "14-seed Colgate beat 3-seed Baylor by 12"'}
                      className="h-8 w-full rounded border border-white/10 bg-white/[0.04] px-2 text-xs text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSave(prop)}
                    disabled={saving === prop.key || !( isGolf ? edit.selectedTeamIds.length > 0 : edit.selectedParticipantIds.length > 0)}
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
