import Link from 'next/link'
import { LineChart, Calculator, TrendingUp, Layers } from 'lucide-react'

const FEATURES = [
  {
    icon: LineChart,
    title: 'Devigged Sportsbook Odds',
    description:
      'We strip the vig from real sportsbook lines to calculate true implied probabilities for every team, every round of the tournament.',
    detail: 'Structure-aware devigging across all tournament rounds',
  },
  {
    icon: Calculator,
    title: 'Fair Value & Bid Ceilings',
    description:
      'Know exactly what each team is worth based on your pool\'s payout structure. Get a suggested bid price so you never overpay at the table.',
    detail: 'Customizable payout rules for any pool format',
  },
  {
    icon: TrendingUp,
    title: 'Profit Projections',
    description:
      'See your projected profit at every stage of the tournament. Track how your portfolio performs round by round as the event unfolds.',
    detail: 'Round-by-round cumulative P&L tracking',
  },
  {
    icon: Layers,
    title: 'Live Strategy Overlay',
    description:
      'See fair values and edge calculations in real-time during your live auction. Know instantly if a bid is a steal or a trap.',
    detail: 'Integrated with live auction hosting',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Strategy analytics
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Know what every team is worth before you bid
          </h2>
          <p className="mt-4 text-base text-white/50">
            Pair with free hosting or use standalone. From $19.99/event.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-emerald-500/20 hover:bg-white/[0.04]"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500">
                <feature.icon className="size-5 text-white" />
              </div>
              <h3 className="text-base font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                {feature.description}
              </p>
              <p className="mt-3 text-xs font-medium text-emerald-400/50 font-mono">
                {feature.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/register"
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Try free preview &rarr;
          </Link>
        </div>
      </div>
    </section>
  )
}
