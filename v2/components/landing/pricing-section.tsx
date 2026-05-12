import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Check, ArrowRight } from 'lucide-react'

const TIERS = [
  {
    name: 'Auction Hosting',
    price: '$0',
    priceDetail: 'Free forever',
    description: 'Everything you need to run a live Calcutta auction with your group.',
    features: [
      'Live real-time bidding',
      'Join via 6-character code',
      'Countdown timers & auto-mode',
      'Commissioner controls',
      'Works on any device',
      'Unlimited participants',
    ],
    cta: 'Host Free',
    href: '/register',
    highlighted: false,
  },
  {
    name: 'Strategy Analytics',
    price: '$14.99',
    priceDetail: 'One-time, per event',
    description: 'See what every golfer is actually worth before you bid.',
    features: [
      'Everything in Free, plus:',
      'Devigged sportsbook odds',
      'Fair value calculations',
      'Suggested bid prices',
      'Round-by-round P&L projections',
      'Live strategy overlay during auction',
    ],
    cta: 'Get the Edge',
    href: '/register',
    highlighted: true,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Free to host. Pay only for the edge.
          </h2>
          <p className="mt-3 text-sm text-white/50">
            Run your auction for free. Add strategy analytics when you want to win.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col rounded-xl border p-6 ${
                tier.highlighted
                  ? 'border-emerald-500/30 bg-white/[0.04]'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <h3 className="text-base font-semibold text-white">{tier.name}</h3>
              <p className="mt-1 text-sm text-white/40">{tier.description}</p>

              <div className="mt-4">
                <span
                  className={`text-3xl font-bold tracking-tight font-mono ${
                    tier.price === '$0' ? 'text-emerald-400' : 'text-white'
                  }`}
                >
                  {tier.price}
                </span>
                <p className="mt-0.5 text-xs text-white/40">{tier.priceDetail}</p>
              </div>

              <ul className="mt-5 flex-1 space-y-2">
                {tier.features.map((feature, i) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check
                      className={`mt-0.5 size-3.5 shrink-0 ${
                        i === 0 && tier.highlighted
                          ? 'text-white/40'
                          : 'text-emerald-400'
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        i === 0 && tier.highlighted
                          ? 'text-white/40 italic'
                          : 'text-white/70'
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                variant={tier.highlighted ? 'default' : 'outline'}
                asChild
                className={`mt-6 w-full gap-2 ${
                  !tier.highlighted
                    ? 'border-white/10 bg-transparent text-white hover:bg-white/[0.06] hover:text-white'
                    : ''
                }`}
              >
                <Link href={tier.href}>
                  {tier.cta}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
