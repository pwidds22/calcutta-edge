import { NextResponse } from 'next/server'
import { createSession, joinSession, getSessionState, updateTeamOrder, deleteSession } from '@/actions/session'
import {
  placeBid, sellTeam, skipTeam, undoLastSale, startAuction, pauseAuction,
  completeAuction, openBidding, closeBidding,
} from '@/actions/bidding'
import { getTournamentResults, updateResult, bulkUpdateResults, settleTournament, markPayment, getPaymentTracking, updatePropResult } from '@/actions/tournament-results'
import { generateBundles } from '@/lib/tournaments/bundles'
import { getTournament } from '@/lib/tournaments/registry'
import { BID_INCREMENT_PRESETS } from '@/lib/auction/live/types'
import type { BundlePreset } from '@/lib/tournaments/types'

// DEV-ONLY: Execute server actions via JSON for E2E test automation.
// React server actions require FormData via hydrated form submit, which
// browser automation can't reliably trigger through Suspense boundaries.
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const { action, params } = await request.json()

  try {
    let result: unknown
    switch (action) {
      case 'createSession': {
        // Auto-generate bundles from preset if bundlePreset is provided
        const tournament = getTournament(params.tournamentId)
        if (!tournament) return NextResponse.json({ error: 'Invalid tournament' }, { status: 400 })
        const bundlePreset = (params.bundlePreset ?? 'none') as BundlePreset
        const bundles = generateBundles(bundlePreset, tournament.teams, tournament.config)
        const bidPreset = params.bidPreset ?? 'medium'
        const bidIncrements = BID_INCREMENT_PRESETS[bidPreset as keyof typeof BID_INCREMENT_PRESETS]?.values ?? BID_INCREMENT_PRESETS.medium.values
        result = await createSession({
          tournamentId: params.tournamentId,
          name: params.name,
          payoutRules: params.payoutRules,
          estimatedPotSize: params.estimatedPotSize,
          settings: {
            bundlePreset,
            bundles,
            bidIncrements: [...bidIncrements],
            timer: params.timer ?? { enabled: false },
            minimumBid: params.minimumBid ?? undefined,
          },
        })
        break
      }
      case 'joinSession':
        result = await joinSession(params.joinCode, params.displayName, params.password)
        break
      case 'getSessionState':
        result = await getSessionState(params.sessionId)
        break
      case 'updateTeamOrder':
        result = await updateTeamOrder(params.sessionId, params.teamOrder)
        break
      case 'deleteSession':
        result = await deleteSession(params.sessionId)
        break
      case 'placeBid':
        result = await placeBid(params.sessionId, params.amount)
        break
      case 'sellTeam':
        result = await sellTeam(params.sessionId)
        break
      case 'skipTeam':
        result = await skipTeam(params.sessionId)
        break
      case 'undoLastSale':
        result = await undoLastSale(params.sessionId)
        break
      case 'startAuction':
        result = await startAuction(params.sessionId)
        break
      case 'pauseAuction':
        result = await pauseAuction(params.sessionId)
        break
      case 'openBidding':
        result = await openBidding(params.sessionId)
        break
      case 'closeBidding':
        result = await closeBidding(params.sessionId)
        break
      case 'completeAuction':
        result = await completeAuction(params.sessionId)
        break
      case 'getTournamentResults':
        result = await getTournamentResults(params.sessionId)
        break
      case 'updateResult':
        result = await updateResult(params.sessionId, params.teamId, params.roundKey, params.result)
        break
      case 'bulkUpdateResults':
        result = await bulkUpdateResults(params.sessionId, params.updates)
        break
      case 'settleTournament':
        result = await settleTournament(params.sessionId)
        break
      case 'markPayment':
        result = await markPayment(params.sessionId, params.paymentKey, params.paid)
        break
      case 'getPaymentTracking':
        result = await getPaymentTracking(params.sessionId)
        break
      case 'updatePropResult':
        result = await updatePropResult(
          params.sessionId,
          params.propKey,
          params.propLabel,
          params.winnerParticipantId,
          params.winnerTeamId ?? null,
          params.metadata ?? '',
          params.payoutPercentage
        )
        break
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
