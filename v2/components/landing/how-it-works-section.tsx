const STEPS = [
  {
    number: '01',
    title: 'Create Account',
    description: 'Free. No credit card required.',
  },
  {
    number: '02',
    title: 'Host or Join',
    description: 'Create a live auction or join one with a code. Free forever.',
  },
  {
    number: '03',
    title: 'Unlock Strategy',
    description: 'See fair values, suggested bids, and profit projections from $19.99.',
  },
  {
    number: '04',
    title: 'Dominate Your Auction',
    description: 'Bid with confidence. Track your portfolio. Win.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Set up in under 5 minutes
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className="relative flex flex-col items-center text-center lg:px-6"
            >
              {/* Connector line — dashed emerald (desktop only, not after last) */}
              {i < STEPS.length - 1 && (
                <div
                  className="absolute right-0 top-7 hidden w-full translate-x-1/2 lg:block"
                  style={{
                    height: '1px',
                    backgroundImage: 'linear-gradient(to right, oklch(0.70 0.17 162 / 0.3) 6px, transparent 6px)',
                    backgroundSize: '12px 1px',
                  }}
                />
              )}

              <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500/10">
                <span className="text-sm font-bold text-emerald-400 font-mono">{step.number}</span>
              </div>
              <h3 className="text-sm font-semibold text-white">{step.title}</h3>
              <p className="mt-2 max-w-[200px] text-sm leading-relaxed text-white/40">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
