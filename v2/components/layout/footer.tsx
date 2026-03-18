import Link from 'next/link'

const PRODUCT_LINKS = [
  { label: 'Host Auction', href: '/host' },
  { label: 'Join Auction', href: '/join' },
  { label: 'Strategy Analytics', href: '/auction' },
  { label: 'Blog', href: '/blog' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Sign In', href: '/login' },
  { label: 'Create Account', href: '/register' },
]

export function Footer() {
  return (
    <footer className="border-t border-white/[0.04] bg-black/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500">
                <span className="text-[11px] font-bold tracking-tight text-white font-mono">CE</span>
              </div>
              <span className="text-sm font-semibold tracking-tight text-white">Calcutta Edge</span>
            </div>
            <p className="text-sm text-white/40 leading-relaxed">
              The Calcutta auction platform. Host free. Win with analytics.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">
              Product
            </h3>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith('#') ? (
                    <a
                      href={link.href}
                      className="text-sm text-white/40 transition-colors hover:text-white/70"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-white/40 transition-colors hover:text-white/70"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">
              Contact
            </h3>
            <a
              href="mailto:support@calcuttaedge.com"
              className="text-sm text-white/40 transition-colors hover:text-white/70"
            >
              support@calcuttaedge.com
            </a>
          </div>
        </div>

        <div className="mt-10 border-t border-white/[0.04] pt-6 space-y-3">
          <p className="text-[11px] leading-relaxed text-white/15">
            Calcutta Edge is an entertainment and organizational tool. The platform does not facilitate, process, or handle any financial transactions.
            All financial decisions and pool participation are the sole responsibility of the users.
            Users must be 21 years or older in their jurisdiction.
            Not affiliated with any sportsbook or gambling operator.
            If you or someone you know has a gambling problem, call 1-800-522-4700.
          </p>
          <p className="text-xs text-white/20">
            &copy; {new Date().getFullYear()} Calcutta Edge. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
