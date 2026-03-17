import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { loadAuctionData } from '@/actions/auction'
import { AuctionTool } from '@/components/auction/auction-tool'
import { getActiveTournament, listTournaments } from '@/lib/tournaments/registry'
import { normalizePayoutRules } from '@/lib/calculations/normalize'
import Link from 'next/link'
import { Lock } from 'lucide-react'

interface AuctionPageProps {
  searchParams: Promise<{ tournament?: string }>
}

export default async function AuctionPage({ searchParams }: AuctionPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check payment status
  const { data: profile } = await supabase
    .from('profiles')
    .select('has_paid')
    .eq('id', user.id)
    .single()

  // Always use the active tournament for the strategy tool
  // Other tournaments are shown as "Coming Soon" — not interactive
  const { config, teams: baseTeams } = getActiveTournament()

  // Get all tournaments for the selector
  const allTournaments = listTournaments()

  // Load saved auction data (null if first visit)
  const auctionData = await loadAuctionData(config.id)

  // Normalize payout rules: map legacy DB keys to current config keys
  const payoutRules = normalizePayoutRules(auctionData?.payoutRules, config)

  return (
    <div className="container mx-auto max-w-[1400px] px-4 py-6">
      {/* Tournament selector */}
      {allTournaments.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {allTournaments.map((t) => {
            const isActive = t.isActive
            if (isActive) {
              return (
                <Link
                  key={t.id}
                  href="/auction"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                >
                  {t.name}
                </Link>
              )
            }
            // Non-active tournaments: disabled "Coming Soon" pill
            const startDate = new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            return (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-white/[0.02] text-white/20 cursor-default select-none"
                title={`Coming ${startDate}`}
              >
                <Lock className="size-3 text-white/15" />
                {t.name}
                <span className="text-[10px] text-white/15 ml-0.5">{startDate}</span>
              </span>
            )
          })}
        </div>
      )}

      <AuctionTool
        initialTeams={auctionData?.teams ?? []}
        initialPayoutRules={payoutRules}
        initialPotSize={auctionData?.estimatedPotSize ?? config.defaultPotSize}
        config={config}
        baseTeams={baseTeams}
        hasPaid={profile?.has_paid ?? false}
      />
    </div>
  )
}
