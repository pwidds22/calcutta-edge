import { SkeletonPulse } from '@/components/ui/skeleton-pulse';

export default function AuctionLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-8 w-48" />
        <SkeletonPulse className="h-5 w-32" />
      </div>

      {/* Pot size section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <SkeletonPulse className="h-4 w-24 mb-2" />
            <SkeletonPulse className="h-8 w-32" />
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <SkeletonPulse className="h-4 w-20 mb-2" />
            <SkeletonPulse className="h-6 w-16" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="p-3 border-b border-white/[0.06]">
          <SkeletonPulse className="h-8 w-full" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-white/[0.04] px-3 py-2.5"
          >
            <SkeletonPulse className="h-4 w-6" />
            <SkeletonPulse className="h-4 w-4" />
            <SkeletonPulse className="h-4 w-40" />
            <SkeletonPulse className="h-4 w-16 ml-auto" />
            <SkeletonPulse className="h-4 w-16" />
            <SkeletonPulse className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
