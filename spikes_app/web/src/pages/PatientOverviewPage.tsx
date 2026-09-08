import { useDeferredValue, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { PasswordPdfExportButton } from '../components/export/PasswordPdfExportButton'
import { ClinicalInsight } from '../components/insights/ClinicalInsight'
import {
  insightHealthGoal,
  insightOverviewBody,
  insightOverviewClinical,
  insightOverviewDemographics,
  insightOverviewLifestyle,
  insightOverviewQuickSummary,
  type ClinicalInsightData,
} from '../insights/clinicalDerivation'
import { useDatasets } from '../context/DatasetProvider'
import {
  bmiCategoryStyle,
  findMetadataDataset,
  formatMetaField,
  getPatientMetaRow,
  metaField,
} from '../overview/patientMetaResolve'

const ProfileCard = ({
  title,
  children,
  insight,
}: {
  title: string
  children: React.ReactNode
  insight?: ClinicalInsightData | null
}) => (
  <div className="flex h-full flex-col rounded-xl border border-zinc-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/50">
    <h3 className="mb-3 border-b border-zinc-200/60 pb-2 font-display text-sm font-bold text-slate-800 dark:border-zinc-600 dark:text-zinc-100">
      {title}
    </h3>
    <div className="min-h-0 flex-1 space-y-0">{children}</div>
    {insight ? (
      <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
        <ClinicalInsight tone={insight.tone}>{insight.text}</ClinicalInsight>
      </div>
    ) : null}
  </div>
)

const FieldRow = ({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) => (
  <div className="border-b border-zinc-100 py-2.5 last:border-0 dark:border-zinc-800/80">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
    <p
      className="mt-0.5 text-sm font-medium leading-snug text-slate-900 dark:text-zinc-100"
      style={valueColor ? { color: valueColor } : undefined}
    >
      {value}
    </p>
  </div>
)

export const PatientOverviewPage = () => {
  const { datasets, selectedPatientId } = useDatasets()
  const deferredPatient = useDeferredValue(selectedPatientId)

  const metaDataset = useMemo(() => findMetadataDataset(datasets), [datasets])

  const row = useMemo(() => {
    if (!metaDataset || !deferredPatient) return null
    return getPatientMetaRow(metaDataset, deferredPatient)
  }, [metaDataset, deferredPatient])

  const bmiStyle = useMemo(() => (row ? bmiCategoryStyle(row) : { label: '—', color: '#6b7280' }), [row])

  const healthGoalRaw = row ? metaField(row, 'Health Goal') : undefined
  const healthGoalDisplay =
    healthGoalRaw !== undefined && healthGoalRaw.trim() !== '' ? healthGoalRaw.trim() : null

  const overviewInsights = useMemo(() => {
    if (!row) return null
    return {
      demographics: insightOverviewDemographics(row),
      body: insightOverviewBody(row),
      clinical: insightOverviewClinical(row),
      lifestyle: insightOverviewLifestyle(row),
      quick: insightOverviewQuickSummary(bmiStyle.label, row),
    }
  }, [row, bmiStyle.label])

  const healthGoalInsight = useMemo(() => insightHealthGoal(healthGoalDisplay), [healthGoalDisplay])

  const pdfExportRef = useRef<HTMLDivElement>(null)

  /** SPIKES_app.py always shows this string in Quick Summary. */
  const dataSourceLabel = 'CGM + Metadata'

  if (!metaDataset) {
    return (
      <section className="glass-card mx-auto w-full max-w-6xl p-5 sm:p-6">
        <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
          Patient Overview
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          Upload a <strong className="font-medium">patient metadata</strong> CSV (one row per participant) on
          the Data upload page — same as SPIKES_app.py &quot;Patient Information&quot; file.
        </p>
      </section>
    )
  }

  if (!selectedPatientId) {
    return (
      <section className="glass-card mx-auto w-full max-w-6xl p-5 sm:p-6">
        <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
          Patient Overview
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Select a patient in the header.</p>
      </section>
    )
  }

  if (!row) {
    return (
      <section className="glass-card mx-auto w-full max-w-6xl p-5 sm:p-6">
        <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
          Patient Overview
        </h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200/90">
          No metadata row for <span className="font-mono font-medium">{deferredPatient}</span> in the loaded
          metadata file.
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="glass-card mb-5 border-l-4 border-l-wellness-500 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-50">
              Patient Overview
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              Participant metadata and health profile ·{' '}
              <span className="font-mono text-xs font-medium text-wellness-700 dark:text-wellness-400">
                {deferredPatient}
              </span>
            </p>
          </div>
          <PasswordPdfExportButton
            targetRef={pdfExportRef}
            filePrefix="SPIKES-Overview"
            patientId={deferredPatient}
            documentTitle={`SPIKES Patient Overview · ${deferredPatient ?? ''}`}
          />
        </div>
      </div>

      <div ref={pdfExportRef} data-pdf-export-root className="min-h-0 rounded-xl border border-transparent">
      <motion.div
        key={deferredPatient ?? 'none'}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-5"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          className="rounded-xl border border-zinc-200/80 bg-gradient-to-br from-wellness-50/90 to-white/80 p-4 dark:border-zinc-700 dark:from-wellness-950/20 dark:to-zinc-900/40"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-wellness-800 dark:text-wellness-400">
            Health Goal
          </p>
          {healthGoalDisplay ? (
            <p className="mt-2 font-display text-base font-medium leading-relaxed text-slate-800 dark:text-zinc-100">
              &ldquo;{healthGoalDisplay}&rdquo;
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
              No health goal recorded for this patient.
            </p>
          )}
          <div className="mt-3">
            <ClinicalInsight tone={healthGoalInsight.tone}>{healthGoalInsight.text}</ClinicalInsight>
          </div>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ProfileCard title="Demographics" insight={overviewInsights?.demographics}>
            <FieldRow label="Age" value={formatMetaField(row, 'Age')} />
            <FieldRow label="Sex Assigned" value={formatMetaField(row, 'Sex Assigned')} />
            <FieldRow label="Ethnicity" value={formatMetaField(row, 'Ethnicity')} />
          </ProfileCard>

          <ProfileCard title="Body Measurements" insight={overviewInsights?.body}>
            <FieldRow label="Height" value={formatMetaField(row, 'Height', { decimals: 2, suffix: ' m' })} />
            <FieldRow label="Weight" value={formatMetaField(row, 'Weight', { decimals: 1, suffix: ' kg' })} />
            <FieldRow label="BMI" value={formatMetaField(row, 'BMI', { decimals: 1 })} />
            <FieldRow label="Waist" value={formatMetaField(row, 'Waist', { decimals: 0, suffix: ' cm' })} />
            <FieldRow
              label="Waist:Height Ratio"
              value={formatMetaField(row, 'Waist:Height Ratio', { decimals: 3 })}
            />
          </ProfileCard>

          <ProfileCard title="Clinical" insight={overviewInsights?.clinical}>
            <FieldRow label="Blood Pressure" value={formatMetaField(row, 'Blood Pressure')} />
            <FieldRow label="HbA1c" value={formatMetaField(row, 'HbA1c')} />
            <FieldRow label="HbA1c Date" value={formatMetaField(row, 'HbA1c Date')} />
            <FieldRow label="Medication" value={formatMetaField(row, 'Medication')} />
          </ProfileCard>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ProfileCard title="Lifestyle" insight={overviewInsights?.lifestyle}>
            <FieldRow label="Wearable Type" value={formatMetaField(row, 'Wearable Type')} />
            <FieldRow
              label="Chronotype"
              value={formatMetaField(row, 'Night Owl / Morning Lark')}
            />
          </ProfileCard>

          <ProfileCard title="Quick Summary" insight={overviewInsights?.quick}>
            <FieldRow label="BMI Category" value={bmiStyle.label} valueColor={bmiStyle.color} />
            <FieldRow label="Data Source" value={dataSourceLabel} />
          </ProfileCard>
        </div>
      </motion.div>
      </div>
    </section>
  )
}
