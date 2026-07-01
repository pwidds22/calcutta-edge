'use client';

import { useMemo } from 'react';
import type { SoccerMatch } from '@/lib/espn/soccer';
import type { BracketMatch, BracketSlot } from '@/lib/espn/bracket';
import { buildBracket } from '@/lib/espn/bracket';

interface KnockoutBracketProps {
  matches: SoccerMatch[]; // knockout matches only (any order)
  ownerByTeam: Map<number, { ownerName: string; isMine: boolean }>;
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function SlotRow({
  slot,
  match,
  owner,
}: {
  slot: BracketSlot;
  match: BracketMatch;
  owner?: { ownerName: string; isMine: boolean };
}) {
  const isLive = match.status === 'in';
  const decided = match.status === 'final';
  const nameClass = slot.isPlaceholder
    ? 'italic text-white/25'
    : decided
      ? slot.isWinner
        ? 'font-semibold text-white'
        : 'text-white/35'
      : 'text-white/70';
  return (
    <div className="flex items-center justify-between gap-1">
      <span className={`flex min-w-0 items-center truncate ${nameClass}`}>
        <span className="truncate">{slot.isPlaceholder ? 'TBD' : slot.name}</span>
        {owner && !slot.isPlaceholder && (
          <span className={`ml-1 shrink-0 text-[9px] ${owner.isMine ? 'text-emerald-400/80' : 'text-white/30'}`}>
            {owner.ownerName}
          </span>
        )}
      </span>
      {slot.score !== null && (
        <span
          className={`shrink-0 tabular-nums ${
            isLive ? 'text-amber-400' : slot.isWinner ? 'font-semibold text-white' : 'text-white/40'
          }`}
        >
          {slot.score}
          {decided && slot.isWinner && match.wentToPens ? <span className="text-[9px] text-white/40"> (p)</span> : null}
        </span>
      )}
    </div>
  );
}

function MatchCard({
  match,
  ownerByTeam,
  hasLeftStub,
  hasRightStub,
}: {
  match: BracketMatch;
  ownerByTeam: KnockoutBracketProps['ownerByTeam'];
  hasLeftStub: boolean;
  hasRightStub: boolean;
}) {
  const isLive = match.status === 'in';
  const showKickoff = match.status === 'scheduled';
  return (
    <div
      className={`relative rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-xs ${
        hasLeftStub ? 'before:absolute before:right-full before:top-1/2 before:h-px before:w-2 before:bg-white/[0.08]' : ''
      } ${hasRightStub ? 'after:absolute after:left-full after:top-1/2 after:h-px after:w-2 after:bg-white/[0.08]' : ''}`}
    >
      <div className="space-y-0.5">
        <SlotRow slot={match.home} match={match} owner={match.home.teamId !== null ? ownerByTeam.get(match.home.teamId) : undefined} />
        <SlotRow slot={match.away} match={match} owner={match.away.teamId !== null ? ownerByTeam.get(match.away.teamId) : undefined} />
      </div>
      {(showKickoff || isLive) && (
        <div className="mt-0.5 flex items-center gap-1 text-[9px]">
          {isLive ? (
            <>
              <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
              <span className="text-amber-400/80">Live</span>
            </>
          ) : (
            <span className="text-white/25">{shortDate(match.date)}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pure-CSS knockout bracket. Column geometry: every column stretches to the
 * R32 column's height; pairs are nested flex-1 wrappers with justify-around,
 * which centers each parent card exactly between its two feeders (buildBracket
 * guarantees feeders are vertically adjacent). Connectors are a vertical join
 * on each pair (spanning the two card centers) plus horizontal stubs.
 */
export function KnockoutBracket({ matches, ownerByTeam }: KnockoutBracketProps) {
  const model = useMemo(() => buildBracket(matches), [matches]);
  if (model.rounds.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
        Knockout Stage
      </h3>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[880px]">
          {model.rounds.map((round, ri) => {
            const isLast = ri === model.rounds.length - 1;
            const hasLeftStub = ri > 0;
            return (
              <div key={round.stage} className="flex w-44 shrink-0 flex-col">
                <h4 className="mb-1.5 px-2 text-center text-[10px] font-medium uppercase tracking-wider text-white/40">
                  {round.label}
                </h4>
                <div className={`flex flex-1 flex-col justify-around ${hasLeftStub ? 'pl-2' : ''} ${isLast ? '' : 'pr-2'}`}>
                  {isLast ? (
                    <>
                      {round.matches.map((m) => (
                        <MatchCard key={m.id} match={m} ownerByTeam={ownerByTeam} hasLeftStub={hasLeftStub} hasRightStub={false} />
                      ))}
                      {model.thirdPlace && (
                        <div>
                          <p className="mb-1 px-1 text-[9px] uppercase tracking-wider text-white/25">Third place</p>
                          <MatchCard match={model.thirdPlace} ownerByTeam={ownerByTeam} hasLeftStub={false} hasRightStub={false} />
                        </div>
                      )}
                    </>
                  ) : (
                    chunk(round.matches, 2).map((pair, pi) => (
                      <div key={pi} className="relative flex flex-1 flex-col justify-around gap-1 py-0.5 pr-2">
                        {pair.length === 2 && (
                          <>
                            {/* vertical join between the pair's card centers */}
                            <div className="absolute bottom-1/4 right-0 top-1/4 w-px bg-white/[0.08]" />
                            {/* stub from the join's midpoint into the next column */}
                            <div className="absolute -right-2 top-1/2 h-px w-2 bg-white/[0.08]" />
                          </>
                        )}
                        {pair.map((m) => (
                          <MatchCard key={m.id} match={m} ownerByTeam={ownerByTeam} hasLeftStub={hasLeftStub} hasRightStub={pair.length === 2} />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
