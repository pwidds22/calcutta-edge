import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/config'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Stripe webhook signature verification failed:', message)
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    )
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const supabase = createAdminClient()

    const email =
      session.customer_email || session.customer_details?.email
    const rawClientRefId = session.client_reference_id

    // Parse client_reference_id — new format: "userId:tournamentId", legacy: "userId"
    let clientRefId: string | null = null
    let tournamentId = 'march_madness_2026' // default for legacy payments
    if (rawClientRefId) {
      if (rawClientRefId.includes(':')) {
        const parts = rawClientRefId.split(':')
        clientRefId = parts[0]
        tournamentId = parts[1] ?? tournamentId
      } else {
        clientRefId = rawClientRefId
      }
    }

    console.log('Processing payment — client_reference_id:', clientRefId, 'tournament:', tournamentId, 'email:', email)

    // Strategy: client_reference_id → email → recent unpaid
    let profileId: string | null = null

    // 1. Primary: client_reference_id is the Supabase user ID
    if (clientRefId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, has_paid')
        .eq('id', clientRefId)
        .single()

      if (profile) {
        profileId = profile.id
        console.log('Matched user via client_reference_id:', clientRefId)
      } else {
        console.warn('client_reference_id did not match any profile:', clientRefId)
      }
    }

    // 2. Fallback: email match
    if (!profileId && email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .single()

      if (profile) {
        profileId = profile.id
        console.log('Matched user via email:', email)
      }
    }

    // 3. Last resort: most recent unpaid user created in the last hour
    if (!profileId) {
      console.log('No match by ID or email, checking recent signups...')
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      const { data: recentProfiles } = await supabase
        .from('profiles')
        .select('id, email, has_paid, created_at')
        .eq('has_paid', false)
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(1)

      if (recentProfiles && recentProfiles.length > 0) {
        profileId = recentProfiles[0].id
        console.log('Matched recent unpaid user:', recentProfiles[0].email)
      }
    }

    if (!profileId) {
      console.error('No matching user found for payment. email:', email, 'client_reference_id:', clientRefId)
      return NextResponse.json({ received: true })
    }

    // Insert per-tournament purchase record
    const { error: purchaseError } = await supabase
      .from('paid_tournaments')
      .upsert({
        user_id: profileId,
        tournament_id: tournamentId,
        amount_cents: session.amount_total ?? 0,
        paid_at: new Date().toISOString(),
        stripe_session_id: session.id,
      }, { onConflict: 'user_id,tournament_id' })

    if (purchaseError) {
      console.error('Failed to insert paid_tournaments:', purchaseError)
    }

    // Also update legacy has_paid for backward compatibility
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        has_paid: true,
        payment_date: new Date().toISOString(),
      })
      .eq('id', profileId)

    if (updateError) {
      console.error('Failed to update profile:', updateError)
      return NextResponse.json(
        { error: 'Update failed' },
        { status: 500 }
      )
    }

    console.log('Successfully marked user as paid:', profileId, 'tournament:', tournamentId)
  }

  return NextResponse.json({ received: true })
}
