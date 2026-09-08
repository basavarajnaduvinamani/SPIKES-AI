import { useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  Database,
  FileSpreadsheet,
  Heart,
  Leaf,
  Sparkles,
  Upload,
  UserCircle2,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { runCgmDetect } from '../analysis/cgmWorkerClient'
import { findCgmWideDataset } from '../cgm/cgmHelpers'
import {
  buildCgmDashboardSection,
  buildDatasetInventory,
  computePillarsAndProfile,
  emptyCgmDashboardSection,
  mergeDashboardSnapshot,
  type DashboardPatientSnapshot,
} from '../dashboard/dashboardSnapshot'
import { ClinicalInsight } from '../components/insights/ClinicalInsight'
import {
  insightDashboardCgm,
  insightDashboardPillars,
  insightDashboardProfile,
  insightStatFiles,
  insightStatLastUpload,
  insightStatMix,
  insightStatParticipants,
  type ClinicalInsightData,
} from '../insights/clinicalDerivation'
import { useDatasets } from '../context/DatasetProvider'
import { CohortInsightsPanel } from '../cohort/CohortInsightsPanel'

const formatRelativeTime = (ts: number | null) => {
  if (ts === null) return null
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const modules = [
  {
    title: 'CGM Spikes',
    blurb: 'Spike & dip detection, time-of-day breakdown',
    to: '/cgm',
    icon: Activity,
    accent: 'from-emerald-400/90 to-wellness-600',
  },
  {
    title: 'Patient overview',
    blurb: 'Demographics, BMI, goals & wearable context',
    to: '/overview',
    icon: Users,
    accent: 'from-teal-400/90 to-emerald-700',
  },
  {
    title: 'Lifestyle pillars',
    blurb: 'Daily gauges, balance & longitudinal trends',
    to: '/pillars',
    icon: Leaf,
    accent: 'from-green-400/85 to-wellness-800',
  },
  {
    title: 'Data upload',
    blurb: 'Add CGM matrices, metadata & self-reports',
    to: '/upload',
    icon: Upload,
    accent: 'from-sky-400/90 to-indigo-700',
  },
] as const

const CgmCardShimmer = () => (
  <div className="space-y-2.5" role="status" aria-label="Loading CGM summary">
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className="relative h-4 overflow-hidden rounded-lg bg-zinc-200/75 dark:bg-zinc-700/45"
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[45%] -translate-x-full animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/55 to-transparent dark:via-white/[0.08]"
          aria-hidden="true"
        />
      </div>
    ))}
  </div>
)

const StatPill = ({
  label,
  value,
  hint,
  insight,
}: {
  label: string
  value: string | number
  hint?: string
  insight?: ClinicalInsightData | null
}) => (
  <div className="flex h-full flex-col rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/45">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
    <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-slate-900 dark:text-zinc-50">{value}</p>
    {hint ? <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-500/90">{hint}</p> : null}
    {insight ? (
      <div className="mt-2 min-h-0 flex-1">
        <ClinicalInsight tone={insight.tone}>{insight.text}</ClinicalInsight>
      </div>
    ) : null}
  </div>
)

export const HomePage = () => {
  const { datasets, totalRowCount, patientIds, selectedPatientId } = useDatasets()
  const deferredPatient = useDeferredValue(selectedPatientId)
  const [isPending, startTransition] = useTransition()
  const [cgmSection, setCgmSection] = useState<DashboardPatientSnapshot['cgm'] | null>(null)
  const [cgmLoading, setCgmLoading] = useState(false)
  const [dashboardTab, setDashboardTab] = useState<'patient' | 'cohort'>('patient')

  const inventory = useMemo(
    () => buildDatasetInventory(datasets, totalRowCount),
    [datasets, totalRowCount],
  )

  const cgmDataset = useMemo(() => findCgmWideDataset(datasets), [datasets])

  const pillarsProfile = useMemo(
    () => (deferredPatient ? computePillarsAndProfile(datasets, deferredPatient) : null),
    [datasets, deferredPatient],
  )

  useEffect(() => {
    if (dashboardTab !== 'patient') {
      setCgmSection(null)
      setCgmLoading(false)
      return
    }
    if (!deferredPatient) {
      setCgmSection(null)
      setCgmLoading(false)
      return
    }
    if (!cgmDataset) {
      setCgmSection(null)
      setCgmLoading(false)
      return
    }
    const pid = deferredPatient.trim()
    let cancelled = false
    setCgmSection(null)
    setCgmLoading(true)
    runCgmDetect({
      datasetId: cgmDataset.id,
      rows: cgmDataset.rows,
      columns: cgmDataset.columns,
      patientId: pid,
    })
      .then(({ events, annotated }) => {
        if (cancelled) return
        startTransition(() => {
          setCgmSection(buildCgmDashboardSection(events, annotated))
        })
      })
      .finally(() => {
        if (!cancelled) setCgmLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cgmDataset, deferredPatient, dashboardTab])

  const snapshot = useMemo(() => {
    if (dashboardTab !== 'patient') return null
    if (!deferredPatient || !pillarsProfile) return null
    const pid = deferredPatient.trim()
    const cgm = cgmSection ?? emptyCgmDashboardSection()
    return mergeDashboardSnapshot(pid, pillarsProfile.pillars, pillarsProfile.profile, cgm)
  }, [deferredPatient, pillarsProfile, cgmSection, dashboardTab])

  const statInsights = useMemo(
    () => ({
      participants: insightStatParticipants(patientIds.length),
      files: insightStatFiles(inventory),
      mix: insightStatMix(inventory),
      last: insightStatLastUpload(inventory.lastUploadedAt),
    }),
    [patientIds.length, inventory],
  )

  const cgmCardInsight = useMemo(() => (snapshot ? insightDashboardCgm(snapshot.cgm) : null), [snapshot])
  const pillarsCardInsight = useMemo(
    () => (snapshot ? insightDashboardPillars(snapshot.pillars) : null),
    [snapshot],
  )
  const profileCardInsight = useMemo(
    () => (snapshot ? insightDashboardProfile(snapshot.profile) : null),
    [snapshot],
  )

  const lastUploadLabel = formatRelativeTime(inventory.lastUploadedAt)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 sm:gap-6 lg:gap-7">
      <motion.section
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card relative overflow-hidden p-4 sm:p-5 lg:p-6"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-gradient-to-br from-emerald-200/40 to-wellness-400/20 blur-3xl dark:from-emerald-900/20 dark:to-wellness-900/15"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-12 size-56 rounded-full bg-gradient-to-tr from-zinc-200/40 to-transparent blur-2xl dark:from-zinc-800/25"
          aria-hidden="true"
        />
        <div className="relative">
          <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            Dashboard
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl dark:text-zinc-50">
            {deferredPatient ? (
              <>
                <span className="text-gradient-brand">SPIKES</span>
                <span className="text-slate-400 dark:text-zinc-500"> · </span>
                <span className="font-mono text-xl sm:text-2xl lg:text-3xl">{deferredPatient}</span>
              </>
            ) : (
              <>
                Welcome to <span className="text-gradient-brand">SPIKES</span> Wellness
              </>
            )}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-zinc-400/90">
            {datasets.length === 0 ? (
              <>
                Upload CGM and self-report CSVs to unlock spike analysis, pillar trends, and patient context — the
                same data model as the Streamlit SPIKES app.
              </>
            ) : (
              <>
                At-a-glance view of loaded files and, for the selected participant, CGM events, lifestyle gauges, and
                profile fields when those uploads are present.
              </>
            )}
          </p>

          <div
            className="mt-4 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Dashboard view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={dashboardTab === 'patient'}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                dashboardTab === 'patient'
                  ? 'border-wellness-500/60 bg-wellness-50/60 text-wellness-800 dark:bg-wellness-950/20 dark:text-wellness-200'
                  : 'border-zinc-200/90 bg-white/60 text-slate-700 hover:bg-white/80 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-200'
              }`}
              onClick={() => setDashboardTab('patient')}
            >
              Patient snapshot
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dashboardTab === 'cohort'}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                dashboardTab === 'cohort'
                  ? 'border-wellness-500/60 bg-wellness-50/60 text-wellness-800 dark:bg-wellness-950/20 dark:text-wellness-200'
                  : 'border-zinc-200/90 bg-white/60 text-slate-700 hover:bg-white/80 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-200'
              }`}
              onClick={() => setDashboardTab('cohort')}
            >
              Cohort insights
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 items-stretch gap-2 sm:grid-cols-4 lg:gap-3">
            <StatPill
              label="Participants"
              value={patientIds.length}
              hint="unique Client IDs"
              insight={statInsights.participants}
            />
            <StatPill
              label="Files loaded"
              value={inventory.totalFiles}
              hint={`${inventory.totalRows.toLocaleString()} rows`}
              insight={statInsights.files}
            />
            <StatPill
              label="Data mix"
              value={
                inventory.cgmWide + inventory.pillars + inventory.tabular > 0
                  ? `${inventory.cgmWide}c · ${inventory.pillars}p · ${inventory.tabular}t`
                  : '—'
              }
              hint="CGM · pillars · tabular"
              insight={statInsights.mix}
            />
            <StatPill
              label="Last upload"
              value={lastUploadLabel ?? '—'}
              hint={inventory.lastUploadedAt ? 'session memory' : 'none yet'}
              insight={statInsights.last}
            />
          </div>

          {datasets.length > 0 && (
            <p className="mt-4 text-xs text-slate-700 dark:text-zinc-400/90">
              <span className="font-medium">{inventory.cgmWide}</span> CGM{' '}
              {inventory.cgmWide === 1 ? 'matrix' : 'matrices'},{' '}
              <span className="font-medium">{inventory.pillars}</span> pillar
              {inventory.pillars === 1 ? '' : 's'},{' '}
              <span className="font-medium">{inventory.tabular}</span> other tabular
              {inventory.unknown > 0 ? (
                <>
                  , <span className="font-medium">{inventory.unknown}</span> unclassified
                </>
              ) : null}
              .{' '}
              <Link
                to="/upload"
                className="font-medium text-wellness-700 underline underline-offset-2 hover:text-wellness-900 dark:text-wellness-400 dark:hover:text-wellness-200"
              >
                Manage uploads
              </Link>
            </p>
          )}
        </div>
      </motion.section>

      {dashboardTab === 'patient' && snapshot && deferredPatient ? (
        <motion.section
          key={deferredPatient}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          aria-labelledby="snapshot-heading"
          aria-busy={cgmLoading || isPending}
          className={`grid gap-4 lg:grid-cols-3 ${cgmLoading || isPending ? 'opacity-95' : ''}`}
        >
          <h2 id="snapshot-heading" className="sr-only">
            Selected participant snapshot
          </h2>

          <div className="glass-card flex flex-col p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/90 to-wellness-700 text-white shadow-md">
                <Activity className="size-4" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-slate-900 dark:text-zinc-50">CGM (active layers)</p>
                <p className="text-[11px] text-zinc-500">Same defaults as CGM page · all four detection layers on</p>
              </div>
            </div>
            {cgmLoading && cgmDataset ? (
              <CgmCardShimmer />
            ) : snapshot.cgm.available ? (
              snapshot.cgm.hasReadings && snapshot.cgm.metrics ? (
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
                    <span className="text-zinc-600 dark:text-zinc-400">Days analysed</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                      {snapshot.cgm.metrics.nDays}
                    </span>
                  </li>
                  <li className="flex justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
                    <span className="text-zinc-600 dark:text-zinc-400">Spikes / dips</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                      {snapshot.cgm.metrics.nSpikes} / {snapshot.cgm.metrics.nDips}
                    </span>
                  </li>
                  <li className="flex justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
                    <span className="text-zinc-600 dark:text-zinc-400">Mean confidence</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                      {snapshot.cgm.metrics.meanConf.toFixed(2)}
                    </span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span className="text-zinc-600 dark:text-zinc-400">Peak spike / dip nadir</span>
                    <span className="text-right font-mono text-xs font-semibold tabular-nums leading-snug text-slate-900 dark:text-zinc-100">
                      {snapshot.cgm.metrics.nSpikes > 0
                        ? snapshot.cgm.metrics.maxGlucoseSpike.toFixed(1)
                        : '—'}{' '}
                      /{' '}
                      {snapshot.cgm.metrics.nDips > 0
                        ? snapshot.cgm.metrics.minGlucoseDip.toFixed(1)
                        : '—'}{' '}
                      <span className="text-zinc-500">mmol/L</span>
                    </span>
                  </li>
                </ul>
              ) : (
                <p className="text-sm text-amber-800 dark:text-amber-200/90">
                  CGM file is loaded, but this participant has no readings in the matrix.
                </p>
              )
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No wide CGM upload detected. Add a Day × time-grid CSV to analyse spikes.
              </p>
            )}
            {cgmCardInsight ? (
              <div className="mt-3">
                <ClinicalInsight tone={cgmCardInsight.tone}>{cgmCardInsight.text}</ClinicalInsight>
              </div>
            ) : null}
            <Link
              to="/cgm"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-wellness-700 hover:text-wellness-900 dark:text-wellness-400 dark:hover:text-wellness-200"
            >
              Open CGM analysis
              <ArrowUpRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>

          <div className="glass-card flex flex-col p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-400/90 to-wellness-800 text-white shadow-md">
                <Heart className="size-4" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-slate-900 dark:text-zinc-50">Lifestyle pillars</p>
                <p className="text-[11px] text-zinc-500">Self-reported daily gauges (1–10)</p>
              </div>
            </div>
            {snapshot.pillars.available && snapshot.pillars.summary && snapshot.pillars.averageGauge !== null ? (
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
                  <span className="text-zinc-600 dark:text-zinc-400">Days reported</span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                    {snapshot.pillars.summary.n_days}
                  </span>
                </li>
                <li className="flex justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
                  <span className="text-zinc-600 dark:text-zinc-400">Mean across pillars</span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                    {snapshot.pillars.averageGauge.toFixed(1)}
                  </span>
                </li>
                {snapshot.pillars.summary.negative ? (
                  <li className="flex justify-between gap-2">
                    <span className="text-zinc-600 dark:text-zinc-400">Negative affect (mean)</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                      {snapshot.pillars.summary.negative.mean.toFixed(1)}
                    </span>
                  </li>
                ) : (
                  <li className="text-xs text-zinc-500">No negative-affect column in file.</li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No pillar rows for this participant. Upload self-reported metrics with gauge columns.
              </p>
            )}
            {pillarsCardInsight ? (
              <div className="mt-3">
                <ClinicalInsight tone={pillarsCardInsight.tone}>{pillarsCardInsight.text}</ClinicalInsight>
              </div>
            ) : null}
            <Link
              to="/pillars"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-wellness-700 hover:text-wellness-900 dark:text-wellness-400 dark:hover:text-wellness-200"
            >
              Open lifestyle pillars
              <ArrowUpRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>

          <div className="glass-card flex flex-col p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400/90 to-indigo-800 text-white shadow-md">
                <UserCircle2 className="size-4" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-slate-900 dark:text-zinc-50">Profile</p>
                <p className="text-[11px] text-zinc-500">From patient metadata CSV</p>
              </div>
            </div>
            {snapshot.profile.available ? (
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
                  <span className="text-zinc-600 dark:text-zinc-400">Age</span>
                  <span className="font-medium text-slate-900 dark:text-zinc-100">{snapshot.profile.age ?? '—'}</span>
                </li>
                <li className="flex justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
                  <span className="text-zinc-600 dark:text-zinc-400">Sex assigned</span>
                  <span className="font-medium text-slate-900 dark:text-zinc-100">{snapshot.profile.sex ?? '—'}</span>
                </li>
                <li className="flex justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
                  <span className="text-zinc-600 dark:text-zinc-400">BMI</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-medium tabular-nums text-slate-900 dark:text-zinc-100">
                      {snapshot.profile.bmi ?? '—'}
                    </span>
                    {snapshot.profile.bmiCategory ? (
                      <span
                        className="rounded-full px-1.5 py-px text-[10px] font-semibold"
                        style={{
                          color: snapshot.profile.bmiCategory.color,
                          backgroundColor: `${snapshot.profile.bmiCategory.color}18`,
                        }}
                      >
                        {snapshot.profile.bmiCategory.label}
                      </span>
                    ) : null}
                  </span>
                </li>
                <li>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Health goal</p>
                  <p className="mt-1 text-sm leading-snug text-slate-800 dark:text-zinc-200">
                    {snapshot.profile.healthGoal ?? '—'}
                  </p>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No metadata row for this ID. Upload a one-row-per-patient information file.
              </p>
            )}
            {profileCardInsight ? (
              <div className="mt-3">
                <ClinicalInsight tone={profileCardInsight.tone}>{profileCardInsight.text}</ClinicalInsight>
              </div>
            ) : null}
            <Link
              to="/overview"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-wellness-700 hover:text-wellness-900 dark:text-wellness-400 dark:hover:text-wellness-200"
            >
              Open patient overview
              <ArrowUpRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </motion.section>
      ) : null}

      {dashboardTab === 'cohort' ? <CohortInsightsPanel datasets={datasets} patientIds={patientIds} /> : null}

      <section aria-labelledby="modules-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="modules-heading"
              className="font-display text-sm font-semibold text-slate-900 sm:text-base dark:text-zinc-50"
            >
              Workspace
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500/80">
              Deep dives — same routes as the sidebar
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-500/85">
            <Sparkles className="size-3.5 text-wellness-600 dark:text-wellness-400" strokeWidth={2} aria-hidden="true" />
            <span>Tip: pick a patient in the header before exploring CGM and pillars.</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map(({ title, blurb, to, icon: Icon, accent }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.04 * i, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                to={to}
                className="glass-tile group relative flex h-full min-h-[8.5rem] flex-col p-4 transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wellness-500"
              >
                <div
                  className={`mb-3 flex size-9 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-md shadow-emerald-900/15 ring-1 ring-white/25 sm:size-10`}
                >
                  <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
                </div>
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-zinc-50">{title}</h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-600 dark:text-zinc-400/90">{blurb}</p>
                <span className="mt-3 inline-flex items-center gap-0.5 text-[11px] font-semibold text-wellness-700 opacity-90 transition group-hover:opacity-100 dark:text-wellness-400">
                  Open
                  <ArrowUpRight className="size-3" strokeWidth={2} aria-hidden="true" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {datasets.length > 0 ? (
        <section
          aria-labelledby="files-heading"
          className="glass-card border border-dashed border-zinc-200/90 p-4 dark:border-zinc-700/70 sm:p-5"
        >
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/50">
              <Database className="size-5 text-zinc-600 dark:text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="files-heading" className="font-display text-sm font-semibold text-slate-900 dark:text-zinc-50">
                Loaded files (session)
              </h2>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Names reflect your uploads — useful when you load CGM, metadata, and pillars from separate exports.
              </p>
              <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto text-[11px] leading-snug sm:max-h-48">
                {datasets.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-zinc-100/90 pb-1.5 last:border-0 dark:border-zinc-800/60"
                  >
                    <FileSpreadsheet className="size-3.5 shrink-0 text-zinc-400" strokeWidth={2} aria-hidden="true" />
                    <span className="font-mono font-medium text-slate-800 dark:text-zinc-200">{d.fileName}</span>
                    <span className="text-zinc-500">
                      {d.rows.length.toLocaleString()} rows ·{' '}
                      {formatRelativeTime(d.uploadedAt) ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-200/70 bg-white/60 px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900/40">
              <CalendarClock className="size-4 text-zinc-500" strokeWidth={2} aria-hidden="true" />
              <p className="text-[10px] leading-tight text-zinc-600 dark:text-zinc-400">
                Data stays in your browser until you refresh or clear uploads.
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
