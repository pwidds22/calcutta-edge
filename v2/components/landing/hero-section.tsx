import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Timer, Users, TrendingUp } from 'lucide-react'

function AuctionPreview() {
  return (
    <div className="relative">
      {/* Emerald glow effect behind card */}
      <div className="absolute -inset-6 rounded-3xl bg-emerald-500/[0.07] blur-3xl" />

      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-card shadow-2xl shadow-emerald-500/[0.05]">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/40" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400/40" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/40" />
          <div className="ml-3 flex-1 rounded-md bg-white/[0.04] px-3 py-1">
            <span className="text-[10px] text-white/30 font-mono">calcuttaedge.com/live/abc123</span>
          </div>
        </div>

        {/* Live auction header */}
        <div className="border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Live Auction</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-white/40">
                <Users className="size-3" />
                <span className="text-[10px] font-mono">12 online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Team spotlight */}
        <div className="border-b border-white/[0.06] px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">Now Bidding</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-white/[0.06] text-[10px] font-bold font-mono text-white/50">1</span>
                <span className="text-lg font-bold text-white">Duke</span>
                <span className="text-xs text-white/30">East</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">Current Bid</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400 font-mono">$1,450</p>
            </div>
          </div>

          {/* Timer bar */}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 animate-timer-pulse" />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center gap-1 text-white/30">
              <Timer className="size-3" />
              <span className="text-[10px] font-mono">15s remaining</span>
            </div>
          </div>
        </div>

        {/* Bid ladder */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/30 mb-2">Recent Bids</p>
          <div className="space-y-1.5">
            {[
              { name: 'Mike', amount: '$1,450', time: '3s ago', highlight: true },
              { name: 'Sarah', amount: '$1,400', time: '8s ago', highlight: false },
              { name: 'Jake', amount: '$1,350', time: '14s ago', highlight: false },
            ].map((bid) => (
              <div key={bid.amount} className={`flex items-center justify-between rounded-md px-2.5 py-1.5 ${bid.highlight ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/[0.02]'}`}>
                <span className={`text-xs font-medium ${bid.highlight ? 'text-emerald-400' : 'text-white/60'}`}>{bid.name}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono font-medium ${bid.highlight ? 'text-emerald-400' : 'text-white/60'}`}>{bid.amount}</span>
                  <span className="text-[10px] text-white/20">{bid.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy overlay hint */}
        <div className="border-t border-emerald-500/10 bg-emerald-500/[0.03] px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="size-3 text-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-400">Strategy Edge</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/40">Fair Value: <span className="text-white/60 font-mono">$1,580</span></span>
              <span className="text-[10px] text-emerald-400 font-mono">+$130 edge</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Radial gradient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-emerald-500/[0.06] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 md:pb-28 md:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Copy */}
          <div className="max-w-xl">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400"
            >
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-amber-400" />
              </span>
              March Madness 2026 &middot; Masters &middot; World Cup &amp; More
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
              Host Your Calcutta Auction.{' '}
              <span className="underline decoration-emerald-500/40 decoration-2 underline-offset-4">
                Win It Too.
              </span>
            </h1>

            <p className="mt-5 text-base leading-relaxed text-white/50 sm:text-lg">
              The only platform that runs your live auction AND gives you the
              strategy edge to dominate it. Free to host. Analytics for those
              who play to win.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild className="gap-2">
                <Link href="/register">
                  Host Free Auction
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="border-white/10 bg-transparent text-white hover:bg-white/[0.06] hover:text-white">
                <Link href="/auction">See Strategy Tool</Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-white/30">
              Free to host &middot; Strategy analytics $29.99/event
            </p>
          </div>

          {/* Right: Auction preview */}
          <div className="lg:pl-4">
            <AuctionPreview />
          </div>
        </div>
      </div>
    </section>
  )
}
