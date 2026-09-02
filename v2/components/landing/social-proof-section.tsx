export function SocialProofSection() {
  return (
    <section className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-8 text-center sm:px-10">
          <p className="text-base leading-relaxed text-white/60 italic sm:text-lg">
            &ldquo;We&apos;ve been running Calcuttas with friends for years
            using spreadsheets and group texts. Built this so anyone can
            host one without the hassle.&rdquo;
          </p>
          <p className="mt-4 text-sm font-medium text-white/40">
            — Built by Calcutta players, for Calcutta players
          </p>
          <div className="mt-6 flex items-center justify-center gap-8 text-center">
            <div>
              <p className="text-2xl font-bold text-white font-mono">Free</p>
              <p className="text-xs text-white/40">Auction hosting</p>
            </div>
            <div className="h-8 w-px bg-white/[0.08]" />
            <div>
              {/* Was "13+ Odds sources" — true of the golf/DataGolf pipeline
                  only. NFL prices come from Kalshi, a single prediction
                  market, so under an NFL hero the number was simply wrong.
                  A claim about the MATH holds for every sport we support. */}
              <p className="text-2xl font-bold text-white font-mono">Vig-free</p>
              <p className="text-xs text-white/40">Fair value pricing</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
