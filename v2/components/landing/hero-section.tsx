import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pb-20 sm:pt-16 md:pb-24 md:pt-20">
        {/* Mobile-first: stack vertically, CTA first */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          {/* Masters badge — immediately signals relevance */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-amber-400" />
            </span>
            Masters 2026 — Tournament Starts April 9
          </span>

          <h1 className="mt-5 text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl md:text-5xl">
            Run your Masters Calcutta{' '}
            <span className="text-emerald-400">for free.</span>
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
            Free to host &middot; Strategy analytics from $19.99/event
          </p>
        </div>

        {/* Real product screenshot — not a mockup */}
        <div className="mt-10 lg:mt-12">
          <div className="relative overflow-hidden rounded-xl border border-white/[0.08] shadow-2xl">
            <Image
              src="/images/auction-live.png"
              alt="Live Masters Calcutta auction on Calcutta Edge — real-time bidding with strategy overlay"
              width={1200}
              height={675}
              className="w-full"
              priority
            />
          </div>
          <p className="mt-3 text-center text-xs text-white/25">
            Real auction — live bidding with strategy data overlay
          </p>
        </div>
      </div>
    </section>
  )
}
