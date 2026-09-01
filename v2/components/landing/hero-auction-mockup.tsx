import { Radio, MessageCircle, Users, Trophy, Zap, TrendingUp, ListOrdered } from 'lucide-react'

/**
 * Code-drawn mockup of the live-auction room, NFL-flavored, for the landing
 * hero. Replaces the old Masters screenshot (`/images/auction-live.png`) —
 * the headline rotates to the featured tournament (NFL right now) and a golf
 * screenshot under an NFL headline read as a mismatch. Drawn in JSX rather
 * than shipped as a PNG so it stays crisp at every DPR, costs no image fetch
 * on the LCP-critical hero, and can be re-themed per season by editing data.
 *
 * Numbers are illustrative but internally coherent: the probability chips are
 * the real Kalshi-derived Chiefs odds from the NFL config, and fair value ≈
 * their share of the shown projected pot. No photos, no logos — Pat's rule.
 */

const QUEUE: Array<{ name: string; division: string; state?: 'sold' | 'current' }> = [
  { name: 'Los Angeles Rams', division: 'NFC West', state: 'sold' },
  { name: 'Buffalo Bills', division: 'AFC East', state: 'sold' },
  { name: 'Seattle Seahawks', division: 'NFC West', state: 'sold' },
  { name: 'Detroit Lions', division: 'NFC North', state: 'sold' },
  { name: 'Baltimore Ravens', division: 'AFC North', state: 'sold' },
  { name: 'Kansas City Chiefs', division: 'AFC West', state: 'current' },
  { name: 'Philadelphia Eagles', division: 'NFC East' },
  { name: 'Denver Broncos', division: 'AFC West' },
  { name: 'Los Angeles Chargers', division: 'AFC West' },
  { name: 'Green Bay Packers', division: 'NFC North' },
  { name: 'Cincinnati Bengals', division: 'AFC North' },
  { name: 'Houston Texans', division: 'AFC South' },
  { name: 'New England Patriots', division: 'AFC East' },
  { name: 'San Francisco 49ers', division: 'NFC West' },
]

// Real Kalshi-derived Chiefs probabilities from the NFL season config.
const PROB_CHIPS = [
  { label: 'Playoffs', value: '61.8%' },
  { label: 'Win Div', value: '33.2%' },
  { label: 'Conf Ch', value: '18.2%' },
  { label: 'Reach SB', value: '11.2%' },
  { label: 'Champ', value: '5.2%' },
]

const BID_HISTORY = [
  { who: 'Mike R.', amount: '$85', leading: true },
  { who: 'Sarah K.', amount: '$80' },
  { who: 'Dan W.', amount: '$70' },
]

const MY_TEAMS = [
  { name: 'Baltimore Ravens', amount: '$118' },
  { name: 'Jacksonville Jaguars', amount: '$64' },
]

const RESULTS = [
  { name: 'Los Angeles Rams', amount: '$210' },
  { name: 'Buffalo Bills', amount: '$175' },
  { name: 'Detroit Lions', amount: '$132' },
]

function PanelHeader({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-white/40">
      <Icon className="size-3" />
      {children}
    </div>
  )
}

export function HeroAuctionMockup({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="select-none pointer-events-none bg-[#0b0f0e] text-left"
    >
      {/* Top bar: league identity + join code */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-white">NFL Season Calcutta</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
            Active
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-white/60">
            Code: <span className="font-semibold text-white">7KQX2N</span>
          </span>
          <span className="hidden items-center gap-1 text-[10px] text-white/40 sm:flex">
            <Radio className="size-3 text-emerald-400" />8 online
          </span>
        </div>
      </div>

      {/* Auto-auction banner */}
      <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/[0.06] px-4 py-1.5">
        <Zap className="size-3 text-amber-400" />
        <span className="text-[10px] font-semibold text-amber-400">Auto-auction ON</span>
        <span className="hidden text-[10px] text-white/30 sm:inline">
          — bidding opens, closes, and sells automatically
        </span>
      </div>

      {/* Three-column auction room */}
      <div className="flex gap-3 p-3">
        {/* Team queue */}
        <div className="hidden w-[30%] shrink-0 flex-col rounded-lg border border-white/[0.06] bg-white/[0.015] md:flex lg:w-1/4">
          <PanelHeader icon={ListOrdered}>Team Queue (32)</PanelHeader>
          <div className="flex-1 space-y-px overflow-hidden p-1.5">
            {QUEUE.map((team, i) => (
              <div
                key={team.name}
                className={`flex items-baseline gap-1.5 rounded px-2 py-[5px] text-[10px] ${
                  team.state === 'current'
                    ? 'bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/30'
                    : ''
                }`}
              >
                <span className="w-4 shrink-0 text-right text-white/25">{i + 1}</span>
                <span
                  className={`truncate font-medium ${
                    team.state === 'current'
                      ? 'text-emerald-400'
                      : team.state === 'sold'
                        ? 'text-white/30 line-through decoration-white/20'
                        : 'text-white/70'
                  }`}
                >
                  {team.name}
                </span>
                <span className="ml-auto hidden shrink-0 text-[9px] text-white/25 lg:inline">
                  {team.division}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: current team + strategy overlay + bidding */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Current team */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
            <p className="text-[10px] text-white/40">Team 6 of 32</p>
            <h3 className="mt-0.5 text-xl font-bold text-white">Kansas City Chiefs</h3>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-medium text-white/60">
                AFC West
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
                9.9 proj. wins
              </span>
            </div>
          </div>

          {/* Strategy data overlay */}
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-3">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
              <TrendingUp className="size-3" />
              Strategy Data
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <p className="text-[9px] text-white/40">Fair Value</p>
                <p className="font-mono text-sm font-bold text-emerald-400">$102.37</p>
              </div>
              <div>
                <p className="text-[9px] text-white/40">Sug. Bid</p>
                <p className="font-mono text-sm font-bold text-amber-400">$97.25</p>
              </div>
              <div>
                <p className="text-[9px] text-white/40">Edge vs Bid</p>
                <p className="font-mono text-sm font-bold text-emerald-400">+$17.37</p>
              </div>
              <div>
                <p className="text-[9px] text-white/40">Proj. Pot</p>
                <p className="font-mono text-sm font-bold text-white">$2,500</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {PROB_CHIPS.map((chip) => (
                <div key={chip.label} className="rounded bg-white/[0.04] px-1 py-1 text-center">
                  <p className="truncate text-[8px] text-white/40">{chip.label}</p>
                  <p className="text-[10px] font-semibold text-white/80">{chip.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Timer */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
                Time Remaining
              </span>
              <span className="font-mono text-sm font-bold text-emerald-400">14s</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full w-[70%] rounded-full bg-emerald-500" />
            </div>
          </div>

          {/* Bid controls */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
            <p className="text-center text-[10px] text-white/50">
              Current bid <span className="font-mono font-semibold text-white">$85</span>
              <span className="text-white/30"> — Mike R.</span>
            </p>
            <div className="mt-2 flex gap-1.5">
              <div className="flex h-8 flex-1 items-center rounded-md border border-white/10 bg-white/[0.04] px-2.5 font-mono text-[11px] text-white/70">
                $ 90
              </div>
              <div className="flex h-8 items-center rounded-md bg-emerald-600 px-3.5 text-[11px] font-semibold text-white">
                Bid
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              {['+$1', '+$5', '+$10', '+$25'].map((inc) => (
                <div
                  key={inc}
                  className="rounded border border-white/[0.06] bg-white/[0.02] py-1 text-center font-mono text-[9px] text-white/50"
                >
                  {inc}
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-1 border-t border-white/[0.04] pt-2">
              {BID_HISTORY.map((bid) => (
                <div key={bid.who} className="flex items-center justify-between text-[10px]">
                  <span className={bid.leading ? 'text-white/70' : 'text-white/35'}>
                    {bid.who}
                    {bid.leading && <span className="ml-1.5 text-[8px] text-emerald-400">leading</span>}
                  </span>
                  <span className={`font-mono ${bid.leading ? 'text-emerald-400' : 'text-white/35'}`}>
                    {bid.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail: members, chat, my teams, results */}
        <div className="hidden w-1/4 shrink-0 flex-col gap-3 lg:flex">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015]">
            <PanelHeader icon={Users}>Members (8) · 5 online</PanelHeader>
            <div className="flex items-center gap-1 px-3 py-2">
              {['MR', 'SK', 'DW', 'PJ', 'TB'].map((initials) => (
                <span
                  key={initials}
                  className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-[7px] font-semibold text-emerald-400"
                >
                  {initials}
                </span>
              ))}
              <span className="ml-1 text-[9px] text-white/30">+3</span>
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015]">
            <PanelHeader icon={MessageCircle}>Chat</PanelHeader>
            <div className="space-y-1.5 px-3 py-2 text-[9px]">
              <p className="text-white/50">
                <span className="font-semibold text-white/70">Sarah:</span> $85 for the Chiefs is a
                steal
              </p>
              <p className="text-white/50">
                <span className="font-semibold text-white/70">Dan:</span> fair value says otherwise 👀
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015]">
            <PanelHeader icon={Trophy}>My Teams (2)</PanelHeader>
            <div className="space-y-1 px-3 py-2">
              {MY_TEAMS.map((team) => (
                <div key={team.name} className="flex items-center justify-between text-[9px]">
                  <span className="truncate text-white/60">{team.name}</span>
                  <span className="ml-2 shrink-0 font-mono text-white/40">{team.amount}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015]">
            <PanelHeader icon={ListOrdered}>Results (5)</PanelHeader>
            <div className="space-y-1 px-3 py-2">
              {RESULTS.map((team) => (
                <div key={team.name} className="flex items-center justify-between text-[9px]">
                  <span className="truncate text-white/60">{team.name}</span>
                  <span className="ml-2 shrink-0 font-mono text-emerald-400">{team.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
