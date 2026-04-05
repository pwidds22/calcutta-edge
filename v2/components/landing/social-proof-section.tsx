const STATS = [
  {
    value: '48+',
    label: 'Auction Participants',
    detail: 'Across 5 completed auctions',
  },
  {
    value: '$19.99',
    label: 'Strategy Analytics',
    detail: 'vs $39–98 at PoolGenius',
  },
  {
    value: 'Free',
    label: 'Auction Hosting',
    detail: 'No credit card required',
  },
  {
    value: '13+',
    label: 'Odds Sources',
    detail: 'Powered by DataGolf rankings',
  },
]

export function SocialProofSection() {
  return (
    <section className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid grid-cols-2 divide-y divide-white/[0.06] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center py-6 text-center sm:py-0">
              <p className="text-3xl font-bold tracking-tight text-white font-mono sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1 text-sm font-medium text-white/70">{stat.label}</p>
              <p className="mt-0.5 text-xs text-white/30">{stat.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
