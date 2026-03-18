'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Host Free', href: '#hosting', highlight: true },
  { label: 'Features', href: '#features', highlight: false },
  { label: 'How It Works', href: '#how-it-works', highlight: false },
  { label: 'Pricing', href: '#pricing', highlight: false },
  { label: 'Blog', href: '/blog', highlight: false },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/calcutta_edge_180x180.png" alt="Calcutta Edge" width={28} height={28} className="rounded" priority />
          <span className="text-lg font-bold tracking-tight text-white">Calcutta Edge</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors hover:text-white',
                link.highlight ? 'font-medium text-emerald-400 hover:text-emerald-300' : 'text-white/50'
              )}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" size="sm" asChild className="text-white/60 hover:text-white hover:bg-white/[0.06]">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Get Started</Link>
          </Button>
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
          mobileOpen ? 'max-h-72' : 'max-h-0 border-t-0'
        )}
      >
        <div className="space-y-1 px-4 py-3">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'block rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/[0.04] hover:text-white',
                link.highlight ? 'font-medium text-emerald-400' : 'text-white/50'
              )}
            >
              {link.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-3">
            <Button variant="outline" size="sm" asChild className="w-full border-white/10 text-white hover:bg-white/[0.06]">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild className="w-full">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
