import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function CtaSection() {
  return (
    <section className="relative border-t-2 border-emerald-500/30">
      {/* Green-tinted dark overlay for visual separation from footer */}
      <div className="absolute inset-0 bg-emerald-950/20" />

      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            The Masters starts this week. Your Calcutta should too.
          </h2>
          <p className="mt-4 text-base text-white/40">
            Host free. Bid smart. Win.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="gap-2">
              <Link href="/register">
                Host Your Masters Calcutta Free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="border-white/10 bg-transparent text-white hover:bg-white/[0.06] hover:text-white">
              <Link href="/auction">
                Preview Strategy Analytics
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
