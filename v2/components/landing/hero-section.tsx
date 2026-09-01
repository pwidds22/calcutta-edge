import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { HeroAuctionMockup } from './hero-auction-mockup'
import { getFeaturedTournament } from '@/lib/tournaments/registry'
import { getTournamentPhase } from '@/lib/tournaments/phase'
import { STRATEGY_PRICE_LABEL } from '@/lib/pricing'

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
}

// Strip "2026", "2026-27", "20XX" year suffixes for conversational copy.
// "PGA Championship 2026" → "PGA Championship"
// "NFL Season 2026-27" → "NFL Season"
function cleanName(name: string): string {
  return name.replace(/\s+20\d\d(-\d\d)?$/, '')
}

interface FeaturedInfo {
  shortName: string
  fullName: string
  badgeText: string
  /** Urgency headline for the bottom CTA, e.g. "NFL Season starts September 10." */
  ctaHeadline: string
  isLive: boolean
}

// Shared with CtaSection so the top badge and the bottom CTA can never drift
// apart (the CTA used to hardcode "The Masters starts Thursday." — still live
// in September, under an NFL hero).
export function getFeaturedInfo(): FeaturedInfo | null {
  const featured = getFeaturedTournament()
  if (!featured) return null

  const phase = getTournamentPhase(featured.config)
  const fullName = featured.config.name
  const shortName = cleanName(fullName)

  if (phase === 'live') {
    return {
      shortName,
      fullName,
      badgeText: `${fullName} — Live Now`,
      ctaHeadline: `${shortName} is live right now.`,
      isLive: true,
    }
  }
  if (phase === 'hostable') {
    const dateText = formatLongDate(featured.config.startDate)
    return {
      shortName,
      fullName,
      badgeText: `${fullName} — Starts ${dateText}`,
      ctaHeadline: `${shortName} starts ${dateText}.`,
      isLive: false,
    }
  }
  if (phase === 'upcoming') {
    const opensText = formatLongDate(featured.config.hostingOpensAt ?? featured.config.startDate)
    return {
      shortName,
      fullName,
      badgeText: `${fullName} — Hosting opens ${opensText}`,
      ctaHeadline: `${shortName} is coming — hosting opens ${opensText}.`,
      isLive: false,
    }
  }
  return null
}

export function HeroSection() {
  const featured = getFeaturedInfo()
  const altText = featured
    ? `Live ${featured.shortName} Calcutta auction on Calcutta Edge — real-time bidding with strategy overlay`
    : 'Live Calcutta auction on Calcutta Edge — real-time bidding with strategy overlay'

  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pb-20 sm:pt-16 md:pb-24 md:pt-20">
        {/* Mobile-first: stack vertically, CTA first */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          {/* Phase-aware badge — auto-updates as tournaments come and go */}
          {featured && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                featured.isLive
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
              }`}
            >
              <span className="relative flex size-1.5">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    featured.isLive ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex size-1.5 rounded-full ${
                    featured.isLive ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              </span>
              {featured.badgeText}
            </span>
          )}

          <h1 className="mt-5 text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl md:text-5xl">
            {featured ? (
              <>
                Run your {featured.shortName} Calcutta{' '}
                <span className="text-emerald-400">for free.</span>
              </>
            ) : (
              <>
                Run your Calcutta auction{' '}
                <span className="text-emerald-400">for free.</span>
              </>
            )}
          </h1>

          <p className="mt-4 max-w-lg text-base leading-relaxed text-white/60 sm:text-lg">
            Live auction hosting with real-time bidding, strategy analytics
            powered by sportsbook odds, and everything your commissioner
            needs. No spreadsheets. No shouting.
          </p>

          {/* CTA buttons — visible without scrolling on mobile */}
          <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" asChild className="gap-2 text-base">
              <Link href="/register">
                Host Your Calcutta Free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="border-white/10 bg-transparent text-white hover:bg-white/[0.06] hover:text-white"
            >
              <Link href="/strategy">See Strategy Analytics</Link>
            </Button>
          </div>

          <p className="mt-3 text-xs text-white/30">
            Free to host &middot; Strategy analytics from {STRATEGY_PRICE_LABEL}/event
          </p>
        </div>

        {/* Product mockup drawn in code — follows the featured sport without
            re-shooting screenshots (the old Masters PNG sat under an NFL
            headline). No photos, no logos. */}
        <div className="mt-10 lg:mt-12">
          <div className="relative overflow-hidden rounded-xl border border-white/[0.08] shadow-2xl">
            <HeroAuctionMockup ariaLabel={altText} />
          </div>
          <p className="mt-3 text-center text-xs text-white/25">
            The live auction room — real-time bidding with the strategy overlay
          </p>
        </div>
      </div>
    </section>
  )
}
