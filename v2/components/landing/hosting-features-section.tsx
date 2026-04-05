import { Radio, Sparkles, Settings, Trophy } from 'lucide-react'

const FEATURES = [
  {
    icon: Radio,
    title: 'Real-Time Bidding',
    description:
      'Live countdown timers, instant bid updates across all devices. Everyone sees what\'s happening the moment it happens.',
    detail: 'WebSocket-powered, zero lag',
  },
  {
    icon: Sparkles,
    title: 'One-Click Setup',
    description:
      'Create a session, share a 6-character code. Participants join in seconds from any device.',
    detail: 'No downloads, no installs',
  },
  {
    icon: Settings,
    title: 'Commissioner Controls',
    description:
      'Shuffle team order, set bid increments, pause and resume anytime. Run the auction your way.',
    detail: 'Full control from any device',
  },
  {
    icon: Trophy,
    title: 'Works for Any Pool',
    description:
      'March Madness, golf majors, NFL playoffs, or your own custom tournament. One platform for all Calcutta formats.',
    detail: 'Any sport, any format',
  },
]

export function HostingFeaturesSection() {
  return (
    <section id="hosting" className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Free live hosting
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything your commissioner needs. Nothing they don&apos;t.
          </h2>
          <p className="mt-4 text-base text-white/50">
            Set up in 5 minutes, run from any device, track results automatically. No spreadsheets, no shouting over each other.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-emerald-500/20 hover:bg-white/[0.04]"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500">
                <feature.icon className="size-5 text-white" />
              </div>
              <h3 className="text-base font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                {feature.description}
              </p>
              <p className="mt-3 text-xs font-medium text-emerald-400/50 font-mono">
                {feature.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
