import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PAYMENT_LINK_URL } from '@/lib/stripe/config'
import { Button } from '@/components/ui/button'
import { Check, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { getActiveTournament, getTournament } from '@/lib/tournaments/registry'
import { getTournamentPhase } from '@/lib/tournaments/phase'
import { hasTournamentAccess } from '@/lib/auth/tournament-access'

const FEATURES_BY_SPORT: Record<string, string[]> = {
  basketball: [
    'All 64 teams with full analytics',
    'Devigged odds from real sportsbook lines',
    'Fair value calculations',
    'Suggested bid prices',
    'Round-by-round profit projections',
    'Live strategy overlay during auctions',
    'Auto-save to your account',
  ],
  golf: [
    'All 89 golfers with full analytics',
    'Devigged odds from 13+ sportsbooks',
    'Fair value calculations per finish position',
    'Suggested bid prices',
    'Make cut, Top 20, Top 10, Top 5, Winner projections',
    'Live strategy overlay during auctions',
    'Auto-save to your account',
  ],
}

const DEFAULT_FEATURES = FEATURES_BY_SPORT.basketball

interface PaymentPageProps {
  searchParams: Promise<{ tournament?: string; returnTo?: string }>
}

export default async function PaymentPage({ searchParams }: PaymentPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Resolve tournament from query param: accept any tournament still in selector phases
  // (live/hostable/upcoming). Completed/archived tournaments fall back to featured.
  const requestedTournament = params.tournament ? getTournament(params.tournament) : null
  const requestedPhase = requestedTournament ? getTournamentPhase(requestedTournament.config) : undefined
  const isPayable = requestedPhase === 'live' || requestedPhase === 'hostable' || requestedPhase === 'upcoming'
  const { config } = (requestedTournament && isPayable)
    ? requestedTournament
    : getActiveTournament()

  // Check if already paid for this tournament — redirect back to origin
  const alreadyPaid = await hasTournamentAccess(supabase, user.id, config.id)
  if (alreadyPaid) {
    const returnTo = params.returnTo
    // Validate: must be relative path (prevent open redirect)
    const destination = (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//'))
      ? returnTo
      : `/strategy?tournament=${config.id}`
    redirect(destination)
  }

  // Build payment URL with user attribution + tournament context
  const linkEnvKey = config.stripePaymentLinkEnvKey ?? 'NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL'
  const linkUrl = process.env[linkEnvKey] ?? PAYMENT_LINK_URL
  const paymentUrl = new URL(linkUrl)
  // Encode tournament ID in client_reference_id: userId--tournamentId
  // NOTE: Stripe only allows alphanumeric, dashes, underscores. Colons are silently dropped.
  paymentUrl.searchParams.set('client_reference_id', `${user.id}--${config.id}`)
  if (user.email) {
    paymentUrl.searchParams.set('prefilled_email', user.email)
  }

  // If user came from within the app (has returnTo), skip features page → go straight to Stripe
  if (params.returnTo) {
    redirect(paymentUrl.toString())
  }

  const price = ((config.strategyPrice ?? 2999) / 100).toFixed(2)
  const features = FEATURES_BY_SPORT[config.sport] ?? DEFAULT_FEATURES

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        {/* Subtle glow behind card */}
        <div className="absolute -inset-3 rounded-2xl bg-emerald-500/[0.05] blur-2xl" />

        <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-white/[0.03] p-8 shadow-2xl shadow-emerald-500/[0.03]">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-white">Unlock Full Strategy Access</h1>
            <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              {config.badge}
            </span>
          </div>
          <p className="mt-1 text-sm text-white/40">
            You&apos;ve seen the preview. Here&apos;s the full picture &mdash; fair values,
            bid recommendations, and profit projections for every {config.teamLabel?.toLowerCase() ?? 'team'}.
          </p>

          <div className="mt-6">
            <span className="text-4xl font-bold tracking-tight text-white font-mono">${price}</span>
            <p className="mt-1 text-sm text-white/40">One-time payment &middot; {config.name}</p>
          </div>

          <ul className="mt-6 space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                <span className="text-sm text-white/70">{feature}</span>
              </li>
            ))}
          </ul>

          <Button asChild className="mt-8 w-full gap-2" size="lg">
            <Link href={paymentUrl.toString()}>
              Continue to Payment
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
