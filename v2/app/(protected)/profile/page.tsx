import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BarChart3, Mail, CreditCard, Calendar, ArrowRight } from 'lucide-react'
import { DisplayNameForm } from '@/components/profile/display-name-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Account</h1>
      <p className="mt-1 text-sm text-white/40">Manage your Calcutta Edge account.</p>

      {/* Quick action */}
      <div className="mt-8">
        <Button asChild className="gap-2">
          <Link href="/auction">
            <BarChart3 className="size-4" />
            Go to Auction Tool
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {/* Account details */}
      <div className="mt-8 space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">Account Details</h2>
        <div className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <DisplayNameForm currentName={profile?.display_name ?? null} />
          <div className="flex items-center gap-3 px-5 py-4">
            <Mail className="size-4 text-white/30" />
            <div>
              <p className="text-xs text-white/40">Email</p>
              <p className="text-sm text-white">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <CreditCard className="size-4 text-white/30" />
            <div>
              <p className="text-xs text-white/40">Payment Status</p>
              <p className="text-sm">
                {profile?.has_paid ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Unpaid
                  </span>
                )}
              </p>
            </div>
          </div>
          {profile?.payment_date && (
            <div className="flex items-center gap-3 px-5 py-4">
              <Calendar className="size-4 text-white/30" />
              <div>
                <p className="text-xs text-white/40">Payment Date</p>
                <p className="text-sm text-white">{new Date(profile.payment_date).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upgrade CTA for unpaid users */}
      {!profile?.has_paid && (
        <div className="mt-8 space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">Upgrade</h2>
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-5 py-5">
            <h3 className="text-sm font-semibold text-white">Unlock Full Strategy Access</h3>
            <p className="mt-1 text-sm text-white/50">
              Get devigged odds, fair value calculations, bid recommendations, and round-by-round profit projections for every team.
            </p>
            <Button asChild className="mt-4 gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Link href="/payment">
                Unlock — $29.99
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Support */}
      <div className="mt-8 space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">Support</h2>
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-sm text-white/50">
            Need help? Email us at{' '}
            <a href="mailto:support@calcuttaedge.com" className="text-emerald-400 hover:underline">
              support@calcuttaedge.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
