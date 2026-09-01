// The hero badge and CTA derive date copy ("NFL Season starts September 10.",
// "Live Now") from the wall clock; a purely static build freezes that copy at
// deploy time, so it would keep advertising a start date after kickoff.
// Revalidate hourly so phase flips surface without a deploy.
export const revalidate = 3600

import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { HeroSection } from '@/components/landing/hero-section'
import { EventsStripSection } from '@/components/landing/events-strip-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { SocialProofSection } from '@/components/landing/social-proof-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { CtaSection } from '@/components/landing/cta-section'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <EventsStripSection />
        <FeaturesSection />
        <HowItWorksSection />
        <SocialProofSection />
        <PricingSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
