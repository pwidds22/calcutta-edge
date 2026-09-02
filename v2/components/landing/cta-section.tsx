import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { getFeaturedInfo } from '@/lib/tournaments/featured'

export function CtaSection() {
  const featured = getFeaturedInfo()
  return (
    <section className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {featured?.ctaHeadline ?? 'Your next Calcutta starts here.'}
          </h2>
          <p className="mt-3 text-base text-white/50">
            Set up your group&apos;s Calcutta in 5 minutes. Free.
          </p>
          <div className="mt-6">
            <Button size="lg" asChild className="gap-2">
              <Link href={featured?.hostHref ?? '/register'}>
                {featured?.hostCtaLabel ?? 'Host Your Calcutta'}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
