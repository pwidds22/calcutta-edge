'use client';

import { useState } from 'react';
import { useAuction } from '@/lib/auction/auction-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { PayoutRules } from '@/lib/calculations/types';
import { roundBudget } from '@/lib/tournaments/payout-presets';
import { ChevronDown, ChevronUp } from 'lucide-react';

const propDescriptions: Record<string, string> = {
  lowRoundR1: 'Lowest score in Round 1 (Thursday)',
  lowRoundR2: 'Lowest score in Round 2 (Friday)',
  lowRoundR3: 'Lowest score in Round 3 (Saturday)',
  lowRoundR4: 'Lowest score in Round 4 (Sunday)',
  worstRound: 'Highest (worst) score in any single round among cut-makers',
  worstOverall: 'Highest (worst) total 4-round score among cut-makers — Dead F***ing Last',
  biggestUpset: 'Largest seed differential win in the tournament',
  highestSeed: 'Highest-seeded team to reach the Final Four',
  largestMargin: 'Team with the biggest winning margin in any single game',
  customProp: 'Commissioner-defined prop bet',
};

export function PayoutRulesEditor() {
  const { state, dispatch, config } = useAuction();
  const [isOpen, setIsOpen] = useState(false);
  // The draft holds RAW TYPED STRINGS, parsed only for the total readout and
  // on Apply. A controlled number field whose value round-trips parseFloat on
  // every keystroke corrupts decimal entry ('0.' collapses to '0', so NFL's
  // 0.1029 per-win rate was untypeable — it landed as 1029). Seeded once per
  // mount; auction-tool keys this component by league so a league switch
  // remounts it instead of Applying league A's draft onto league B.
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const r of config?.rounds ?? []) d[r.key] = String(state.payoutRules[r.key] ?? 0);
    for (const p of config?.propBets ?? []) d[p.key] = String(state.payoutRules[p.key] ?? 0);
    return d;
  });

  const rounds = config?.rounds ?? [];
  const propBets = config?.propBets ?? [];

  const draftValue = (key: string) => parseFloat(draft[key] ?? '') || 0;

  const totalPercent = rounds.reduce(
    (sum, r) => sum + roundBudget(r, draftValue(r.key)),
    0
  ) + propBets.reduce((sum, p) => sum + draftValue(p.key), 0);

  const handleChange = (key: string, value: string) => {
    // Allow only what a decimal amount can look like while typing.
    if (!/^\d*\.?\d*$/.test(value)) return;
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    const rules: PayoutRules = { ...state.payoutRules };
    for (const key of Object.keys(draft)) rules[key] = draftValue(key);
    dispatch({ type: 'UPDATE_PAYOUT_RULES', payoutRules: rules });
  };

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Payout Rules</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              Math.abs(totalPercent - 100) < 0.01
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {totalPercent.toFixed(1)}%
          </span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="border-t p-4">
          {/* 4 columns max — NFL's long tier labels wrap illegibly at 6-up.
              The min-height keeps inputs on one baseline when a wrapped label
              sits next to a single-line one. */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            {rounds.map((round) => (
              <div key={round.key}>
                <Label className="flex min-h-8 items-end text-xs leading-tight">
                  {round.payoutLabel} ({round.payoutUnits ?? round.teamsAdvancing}{' '}
                  {round.unitLabel ?? config?.teamLabel?.toLowerCase() ?? 'team'}s)
                </Label>
                <div className="relative mt-1">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={draft[round.key] ?? '0'}
                    onChange={(e) => handleChange(round.key, e.target.value)}
                    className="pr-7 text-right text-sm"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Total: {roundBudget(round, draftValue(round.key)).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>

          {propBets.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              {propBets.map((prop) => (
                <div key={prop.key}>
                  <Label className="text-xs cursor-help" title={propDescriptions[prop.key]}>{prop.label}</Label>
                  <div className="relative mt-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={draft[prop.key] ?? '0'}
                      onChange={(e) => handleChange(prop.key, e.target.value)}
                      className="pr-7 text-right text-sm"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div>
              <span className="text-sm">
                Total:{' '}
                <span
                  className={`font-semibold ${
                    Math.abs(totalPercent - 100) < 0.01
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {totalPercent.toFixed(1)}%
                </span>
              </span>
              {config?.sport === 'golf' && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Ties at tier boundaries split that tier&apos;s payout proportionally.
                </p>
              )}
            </div>
            <Button size="sm" onClick={handleApply}>
              Apply Rules
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
