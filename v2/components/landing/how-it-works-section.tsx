const STEPS = [
  {
    number: '1',
    title: 'Create & share',
    description: 'Sign up free, create an auction, share the 6-character join code with your group.',
  },
  {
    number: '2',
    title: 'Auction night',
    description: 'Everyone joins from their phone. Live bidding with timers — the commissioner controls the pace.',
  },
  {
    number: '3',
    title: 'Track results',
    description: 'Follow your portfolio as the Masters plays out. Payouts calculated automatically.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Set up in 5 minutes
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="text-center sm:text-left">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm font-bold text-emerald-400 font-mono">
                {step.number}
              </span>
              <h3 className="mt-3 text-sm font-semibold text-white">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/40">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
