import { RegisterForm } from '@/components/auth/register-form'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { safeNext } from '@/lib/auth/safe-redirect'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Validate once, here, and pass the clean value down — the form should never
  // be handed a destination the server would refuse.
  const next = safeNext((await searchParams).next)

  // An already-signed-in visitor who followed a "host an NFL Calcutta" link
  // still wants the create form, not the dashboard.
  if (user) {
    redirect(next ?? '/dashboard')
  }

  return <RegisterForm next={next ?? undefined} />
}
