import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { loadAuctionData, listUserLeagues } from '@/actions/auction'
import { AuctionTool } from '@/components/auction/auction-tool'
import { getActiveTournament, getTournament, listTournaments } from '@/lib/tournaments/registry'
import { normalizePayoutRules } from '@/lib/calculations/normalize'
import { hasTournamentAccess } from '@/lib/auth/tournament-access'
import Link from 'next/link'
import { Lock } from 'lucide-react'

interface AuctionPageProps {
  searchParams: Promise<{ tournament?: string; league?: string }>
}

export default async function AuctionPage({ searchParams }: AuctionPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Resolve tournament: use ?tournament= param if it's an active tournament, else default
  const activeTournament = getActiveTournament()
  const requestedTournament = params.tournament ? getTournament(params.tournament) : null
  const selectedTournament = (requestedTournament && requestedTournament.config.isActive)
    ? requestedTournament
    : activeTournament
  const { config, teams: baseTeams } = selectedTournament

  // Check per-tournament payment status
  const hasPaid = await hasTournamentAccess(supabase, user.id, config.id)

  // Get all tournaments for the selector
  const allTournaments = listTournaments()

  // Load league list and selected league
  const leagueList = await listUserLeagues(config.id)
  const selectedLeague = params.league ?? leagueList[0] ?? 'My Auction'

  // Load saved auction data for the selected league (null if first visit)
  const auctionData = await loadAuctionData(config.id, selectedLeague)

  // Normalize payout rules: map legacy DB keys to current config keys
  const payoutRules = normalizePayoutRules(auctionData?.payoutRules, config)

  return (
    <div className="container mx-auto max-w-[1400px] px-4 py-6">
      {/* Tournament selector */}
      {allTournaments.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {allTournaments.map((t) => {
            if (t.isActive) {
              const isSelected = t.id === config.id
              return (
                <Link
                  key={t.id}
                  href={`/auction?tournament=${t.id}`}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                      : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.06] hover:text-white/70 ring-1 ring-white/10'
                  }`}
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
        hasPaid={hasPaid}
        leagueName={selectedLeague}
        leagueList={leagueList}
      />
    </div>
  )
}
