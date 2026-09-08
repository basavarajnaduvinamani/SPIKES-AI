export type ClinicalTone = 'positive' | 'warning' | 'negative' | 'neutral'

const toneDot: Record<ClinicalTone, string> = {
  positive: 'bg-emerald-500 shadow-[0_0_0_1px_rgb(255,255,255,0.4)] dark:bg-emerald-400',
  warning: 'bg-amber-500 shadow-[0_0_0_1px_rgb(255,255,255,0.4)] dark:bg-amber-400',
  negative: 'bg-red-500 shadow-[0_0_0_1px_rgb(255,255,255,0.4)] dark:bg-red-400',
  neutral: 'bg-zinc-400 shadow-[0_0_0_1px_rgb(255,255,255,0.3)] dark:bg-zinc-500',
}

const toneBox: Record<ClinicalTone, string> = {
  positive:
    'border-l-emerald-500 bg-emerald-50/90 text-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-50/95 dark:border-emerald-400/80',
  warning:
    'border-l-amber-500 bg-amber-50/90 text-amber-950 dark:bg-amber-950/35 dark:text-amber-50/95 dark:border-amber-400/80',
  negative:
    'border-l-red-500 bg-red-50/90 text-red-950 dark:bg-red-950/35 dark:text-red-50/95 dark:border-red-400/80',
  neutral:
    'border-l-zinc-400 bg-zinc-50/90 text-slate-800 dark:text-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-500',
}

import type { ReactNode } from 'react'

export type ClinicalInsightProps = {
  tone: ClinicalTone
  /** Short label e.g. "Clinical note" */
  label?: string
  children: ReactNode
  className?: string
}

/**
 * Doctor-facing interpretation line with green / amber / red semantic indicator.
 */
export const ClinicalInsight = ({ tone, label = 'Clinical insight', children, className = '' }: ClinicalInsightProps) => {
  return (
    <div
      className={`rounded-lg border border-zinc-200/60 border-l-4 py-2 pl-2.5 pr-2 text-[11px] leading-snug dark:border-zinc-700/80 ${toneBox[tone]} ${className}`}
      role="note"
    >
      <div className="flex gap-2">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${toneDot[tone]}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-wide text-black/70 dark:text-white/80">{label}</p>
          <p className="mt-0.5 font-medium">{children}</p>
        </div>
      </div>
    </div>
  )
}
