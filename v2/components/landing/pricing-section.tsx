import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Check, ArrowRight } from 'lucide-react'

const TIERS = [
  {
    name: 'Free Hosting',
    price: '$0',
    priceDetail: 'Free forever',
    description: 'Everything you need to run a live Calcutta auction.',
    features: [
      'Create live auctions',
      'Join auctions via code',
      'Real-time bidding',
      'Countdown timers',
      'Commissioner controls',
      'Shuffle team order',
    ],
    cta: 'Get Started',
    href: '/register',
    highlighted: false,
  },
  {
    name: 'Strategy Analytics',
    price: 'From $19.99',
    priceDetail: 'One-time per event',
    description: 'The data edge nobody else at the table has.',
    badge: 'Most Popular',
    features: [
      'Everything in Free, plus:',
      'Devigged sportsbook odds',
      'Fair value calculations',
      'Suggested bid prices',
      'Round-by-round profit projections',
      'Live strategy overlay',
    ],
    cta: 'Get Started',
    href: '/register',
    highlighted: true,
  },
  {
    name: 'Custom Solutions',
    price: 'Custom',
    priceDetail: 'Tailored to your needs',
    description: 'For large pools, corporate events, or unique formats.',
    features: [
      'Custom tournament setup',
      'Dedicated support',
      'White-label options',
      'Bulk pricing',
      'Custom analytics',
    ],
    cta: 'Contact Sales',
    href: 'mailto:support@calcuttaedge.com',
    highlighted: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Free to host. Pay only for the edge.
          </h2>
          <p className="mt-4 text-base text-white/50">
            Run your auction for free. Upgrade to strategy analytics when you&apos;re ready to win.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-4">
          {TIERS.map((tier) => (
            <div key={tier.name} className="relative">
              {/* Glow behind highlighted card */}
              {tier.highlighted && (
                <div className="absolute -inset-3 rounded-2xl bg-emerald-500/[0.05] blur-2xl" />
              )}

              <div className={`relative flex h-full flex-col overflow-hidden rounded-xl border p-6 shadow-2xl ${
                tier.highlighted
                  ? 'border-emerald-500/30 bg-white/[0.04] shadow-emerald-500/[0.03] md:scale-105'
                  : 'border-white/[0.06] bg-white/[0.02] shadow-black/10'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">{tier.name}</h3>
                  {tier.badge && (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      {tier.badge}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-white/40">{tier.description}</p>

                <div className="mt-5">
                  <span className={`text-3xl font-bold tracking-tight font-mono ${tier.price === '$0' ? 'text-emerald-400' : 'text-white'}`}>{tier.price}</span>
                  <p className="mt-0.5 text-xs text-white/40">{tier.priceDetail}</p>
                </div>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {tier.features.map((feature, i) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className={`mt-0.5 size-3.5 shrink-0 ${i === 0 && tier.highlighted ? 'text-white/40' : 'text-emerald-400'}`} />
                      <span className={`text-sm ${i === 0 && tier.highlighted ? 'text-white/40 italic' : 'text-white/70'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  variant={tier.highlighted ? 'default' : 'outline'}
                  asChild
                  className={`mt-6 w-full gap-2 ${!tier.highlighted ? 'border-white/10 bg-transparent text-white hover:bg-white/[0.06] hover:text-white' : ''}`}
                >
                  <Link href={tier.href}>
                    {tier.cta}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/30">
          Pool Genius charges $39&ndash;98 for less.
        </p>
      </div>
    </section>
  )
}
