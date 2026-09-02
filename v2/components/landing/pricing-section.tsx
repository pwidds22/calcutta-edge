import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Check, ArrowRight } from 'lucide-react'
import { STRATEGY_PRICE_DOLLARS, STRATEGY_PRICE_MAX_DOLLARS } from '@/lib/pricing'
import { getFeaturedInfo } from '@/lib/tournaments/featured'

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
    highlighted: false,
  },
  {
    name: 'Strategy Analytics',
    price: `$${STRATEGY_PRICE_DOLLARS}`,
    priceDetail: `One-time, per event · $${STRATEGY_PRICE_MAX_DOLLARS} for the season-long NFL pool`,
    description: 'See what every team is actually worth before you bid.',
    features: [
      'Everything in Free, plus:',
      'Devigged odds from books and prediction markets',
      'Fair value calculations',
      'Suggested bid prices',
      'Round-by-round P&L projections',
      'Live strategy overlay during auction',
    ],
    cta: 'Get the Edge',
    highlighted: true,
  },
]

export function PricingSection() {
  // Same deep link as the hero: these buttons are a conversion point too, and a
  // bare /register drops the tournament the visitor came for.
  const featured = getFeaturedInfo()
  const hostHref = featured?.hostHref ?? '/register'

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
                <Link href={hostHref}>
                  {tier.cta}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {/* Custom Calcuttas are built by hand, so they're a conversation rather
            than a checkout button — a mailto keeps it honest about that. */}
        <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
          <h3 className="text-sm font-semibold text-white">
            Want a Calcutta for something we don&apos;t support yet?
          </h3>
          <p className="mt-1.5 text-sm text-white/50">
            Any sport or event — a golf trip, a club championship, the Olympics, your
            fantasy league&apos;s draft. We&apos;ll build the board, source the odds, and set up
            the payout structure for you — from $74.99.
          </p>
          <a
            href="mailto:support@calcuttaedge.com?subject=Custom%20Calcutta%20request"
            className="mt-3 inline-block text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            support@calcuttaedge.com →
          </a>
        </div>
      </div>
    </section>
  )
}
