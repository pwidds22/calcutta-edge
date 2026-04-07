import { Radio, Settings, Calculator, TrendingUp } from 'lucide-react'

const HOSTING_FEATURES = [
  { icon: Radio, text: 'Live real-time bidding with countdown timers' },
  { icon: Settings, text: 'Commissioner controls — pause, shuffle, set increments' },
]

const STRATEGY_FEATURES = [
  { icon: Calculator, text: 'Fair values & bid ceilings from devigged sportsbook odds' },
  { icon: TrendingUp, text: 'Live strategy overlay shows edge during your auction' },
]

export function FeaturesSection() {
  return (
    <section id="features" className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12">
          {/* Hosting column */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Free hosting
            </p>
            <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">
              No spreadsheets. No group texts.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              Create a session, share a 6-character code. Everyone joins from
              their phone. Bidding, timers, and results — all handled.
            </p>
            <ul className="mt-6 space-y-4">
              {HOSTING_FEATURES.map((f) => (
                <li key={f.text} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    <f.icon className="size-4 text-emerald-400" />
                  </div>
                  <span className="text-sm text-white/70 leading-relaxed">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Strategy column */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              Strategy analytics &middot; $19.99
            </p>
            <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">
              Know what every golfer is worth.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              We pull odds from 13+ sportsbooks, strip the vig, and calculate
              fair values based on your pool&apos;s payout structure. One smart
              bid pays for itself.
            </p>
            <ul className="mt-6 space-y-4">
              {STRATEGY_FEATURES.map((f) => (
                <li key={f.text} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 border border-amber-500/20">
                    <f.icon className="size-4 text-amber-400" />
                  </div>
                  <span className="text-sm text-white/70 leading-relaxed">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
