/**
 * Full-route skeleton with shimmer sweep — used as Suspense fallbacks for lazy pages.
 */

type PageShimmerVariant = 'home' | 'cgm' | 'overview' | 'pillars'

type PageShimmerProps = {
  /** Announced to assistive tech */
  label: string
  variant?: PageShimmerVariant
}

const ShimmerBar = ({ className }: { className?: string }) => (
  <div
    className={`relative overflow-hidden rounded-lg bg-zinc-200/75 dark:bg-zinc-700/45 ${className ?? ''}`}
  >
    <div
      className="pointer-events-none absolute inset-y-0 left-0 w-[45%] -translate-x-full animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/55 to-transparent dark:via-white/[0.08]"
      aria-hidden="true"
    />
  </div>
)

export const PageShimmer = ({ label, variant = 'home' }: PageShimmerProps) => {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>

      <div className="glass-card relative overflow-hidden p-4 sm:p-5 lg:p-6">
        <ShimmerBar className="h-3 w-24" />
        <ShimmerBar className="mt-4 h-8 w-3/4 max-w-md" />
        <ShimmerBar className="mt-3 h-4 w-full max-w-2xl" />
        <ShimmerBar className="mt-2 h-4 w-5/6 max-w-xl" />
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ShimmerBar className="h-16 sm:h-[4.25rem]" />
          <ShimmerBar className="h-16 sm:h-[4.25rem]" />
          <ShimmerBar className="h-16 sm:h-[4.25rem]" />
          <ShimmerBar className="h-16 sm:h-[4.25rem]" />
        </div>
      </div>

      {variant === 'home' ? (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <ShimmerCard tall />
            <ShimmerCard tall />
            <ShimmerCard tall />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-tile min-h-[8.5rem] p-4">
                <ShimmerBar className="h-9 w-9 rounded-xl" />
                <ShimmerBar className="mt-3 h-4 w-2/3" />
                <ShimmerBar className="mt-2 h-3 w-full" />
                <ShimmerBar className="mt-2 h-3 w-4/5" />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {variant === 'cgm' && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ShimmerBar key={i} className="h-[4.25rem]" />
            ))}
          </div>
          <ShimmerBar className="mt-6 h-[280px] w-full rounded-xl" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ShimmerBar className="h-[200px] rounded-xl" />
            <ShimmerBar className="h-[200px] rounded-xl" />
            <ShimmerBar className="h-[200px] rounded-xl" />
          </div>
        </>
      )}

      {variant === 'overview' && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ShimmerCard tall />
          <ShimmerCard tall />
          <ShimmerBar className="h-48 w-full rounded-xl lg:col-span-2" />
        </div>
      )}

      {variant === 'pillars' && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ShimmerBar key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <ShimmerBar className="mt-4 h-14 max-w-[220px] rounded-xl" />
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ShimmerBar className="h-[300px] w-full max-w-md mx-auto rounded-xl" />
            <ShimmerBar className="h-[280px] w-full rounded-xl" />
          </div>
          <ShimmerBar className="mt-6 h-[320px] w-full rounded-xl" />
        </>
      )}

    </div>
  )
}

const ShimmerCard = ({ tall }: { tall?: boolean }) => (
  <div className="glass-card p-4 sm:p-5">
    <ShimmerBar className="h-4 w-32" />
    <ShimmerBar className={`mt-3 w-full ${tall ? 'h-28' : 'h-20'}`} />
    <ShimmerBar className="mt-2 h-3 w-2/3" />
  </div>
)
