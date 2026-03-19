'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { logout } from '@/actions/auth'
import Image from 'next/image'
import { Menu, X, TrendingUp, User, LogOut, Radio, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Strategy', href: '/auction', icon: TrendingUp },
  { label: 'Host', href: '/host', icon: Radio },
  { label: 'Profile', href: '/profile', icon: User },
]

export function AppNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/brand/calcutta_edge_180x180.png" alt="Calcutta Edge" width={28} height={28} className="rounded" priority />
          <span className="text-lg font-bold tracking-tight text-white">Calcutta Edge</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                pathname === link.href
                  ? 'bg-white/[0.06] text-white'
                  : 'text-white/50 hover:text-white'
              )}
            >
              <link.icon className="size-4" />
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop sign out */}
        <div className="hidden items-center md:flex">
          <form action={logout}>
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              className="gap-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.06]"
            >
              <LogOut className="size-3.5" />
              Sign Out
            </Button>
          </form>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/50 transition-colors hover:text-white md:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          'overflow-hidden border-t border-white/[0.06] transition-all duration-200 md:hidden',
          mobileOpen ? 'max-h-60' : 'max-h-0 border-t-0'
        )}
      >
        <div className="space-y-1 px-4 py-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                pathname === link.href
                  ? 'bg-white/[0.06] text-white'
                  : 'text-white/50 hover:bg-white/[0.04] hover:text-white'
              )}
            >
              <link.icon className="size-4" />
              {link.label}
            </Link>
          ))}
          <form action={logout} className="pt-2">
            <Button
              variant="outline"
              size="sm"
              type="submit"
              className="w-full gap-1.5 border-red-400/20 text-red-400/60 hover:bg-red-500/[0.06] hover:text-red-400"
            >
              <LogOut className="size-3.5" />
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </nav>
  )
}
