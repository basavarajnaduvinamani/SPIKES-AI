import type { DashboardPatientSnapshot, DatasetInventory } from '../dashboard/dashboardSnapshot'
import { metaField } from '../overview/patientMetaResolve'
import type { PillarName } from '../pillars/pillarAnalysis'
import type { ClinicalTone } from '../components/insights/ClinicalInsight'

export type ClinicalInsightData = { tone: ClinicalTone; text: string }

/** mmol/L — typical UK/EU hypoglycaemia threshold */
const HYPO_MMOL = 3.9
/** Severe hyperglycaemia excursion flag */
const SEVERE_HIGH_MMOL = 15

export const insightCgmSpikeCount = (nSpikes: number, nDays: number): ClinicalInsightData => {
  if (nDays <= 0) return { tone: 'neutral', text: 'No days in window for rate calculation.' }
  const perDay = nSpikes / nDays
  if (perDay >= 3) {
    return {
      tone: 'negative',
      text: `High glycemic variability burden: ~${perDay.toFixed(1)} spike events/day over ${nDays} days — review meal timing, insulin, and activity.`,
    }
  }
  if (perDay >= 1.2) {
    return {
      tone: 'warning',
      text: `Moderate spike frequency (~${perDay.toFixed(1)}/day). Consider pattern review with CGM traces.`,
    }
  }
  if (nSpikes === 0) {
    return { tone: 'positive', text: 'No algorithmic spikes detected in this window with current layer settings.' }
  }
  return {
    tone: 'positive',
    text: `Spike rate ~${perDay.toFixed(1)}/day — comparatively low burden in this dataset.`,
  }
}

export const insightCgmDipCount = (nDips: number, nDays: number): ClinicalInsightData => {
  if (nDays <= 0) return { tone: 'neutral', text: 'No days in window for rate calculation.' }
  const perDay = nDips / nDays
  if (perDay >= 2.5) {
    return {
      tone: 'negative',
      text: `Frequent dip events (~${perDay.toFixed(1)}/day) — assess hypoglycaemia risk, medications, and carbohydrate intake.`,
    }
  }
  if (perDay >= 1) {
    return { tone: 'warning', text: `Recurrent dips (~${perDay.toFixed(1)}/day) — correlate with CGM nadir and symptoms.` }
  }
  if (nDips === 0) {
    return { tone: 'positive', text: 'No dip events flagged in this window with current layer settings.' }
  }
  return { tone: 'neutral', text: `Dip rate ~${perDay.toFixed(1)}/day — interpret with clinical context.` }
}

export const insightCgmDaysAnalysed = (nDays: number): ClinicalInsightData => {
  if (nDays >= 10) {
    return { tone: 'positive', text: `${nDays} days of CGM coverage — adequate for short-term pattern review.` }
  }
  if (nDays >= 3) {
    return { tone: 'warning', text: `Only ${nDays} days of data — trends may be unstable; extend monitoring if possible.` }
  }
  return { tone: 'neutral', text: `${nDays} day(s) in analysis — interpret cautiously.` }
}

/** Lower p-value = stronger evidence in standard null-hypothesis framing; SPIKES uses p-values on event tests. */
export const insightCgmMeanConfidence = (meanConf: number): ClinicalInsightData => {
  if (!Number.isFinite(meanConf)) return { tone: 'neutral', text: 'Confidence not available.' }
  if (meanConf <= 0.05) {
    return { tone: 'positive', text: 'Mean p-value suggests strong statistical support for flagged events.' }
  }
  if (meanConf <= 0.2) {
    return { tone: 'neutral', text: 'Mean p-value in the moderate range — combine with glucose curves and clinical context.' }
  }
  return {
    tone: 'warning',
    text: 'Higher mean p-value — weaker statistical separation; interpret spikes/dips alongside raw glucose.',
  }
}

export const insightCgmPeakSpike = (maxGlucose: number, hasSpikes: boolean): ClinicalInsightData => {
  if (!hasSpikes) return { tone: 'neutral', text: 'No spike events — peak glucose not derived from events.' }
  if (maxGlucose >= SEVERE_HIGH_MMOL) {
    return {
      tone: 'negative',
      text: `Severe hyperglycaemic excursion (peak ≥ ${SEVERE_HIGH_MMOL} mmol/L) — urgent review if consistent with symptoms.`,
    }
  }
  if (maxGlucose >= 11) {
    return { tone: 'warning', text: `Peak spike glucose ${maxGlucose.toFixed(1)} mmol/L — consider post-prandial management.` }
  }
  return { tone: 'positive', text: `Peak spike glucose ${maxGlucose.toFixed(1)} mmol/L — document if clinically expected.` }
}

export const insightCgmDipNadir = (minGlucose: number, hasDips: boolean): ClinicalInsightData => {
  if (!hasDips) return { tone: 'neutral', text: 'No dip events — nadir not derived from events.' }
  if (minGlucose < HYPO_MMOL) {
    return {
      tone: 'negative',
      text: `Dip nadir ${minGlucose.toFixed(1)} mmol/L — below common ${HYPO_MMOL} mmol/L threshold; assess hypoglycaemia risk.`,
    }
  }
  if (minGlucose < 4.5) {
    return {
      tone: 'warning',
      text: `Dip nadir ${minGlucose.toFixed(1)} mmol/L — borderline low; review with patient context.`,
    }
  }
  return { tone: 'positive', text: `Dip nadir ${minGlucose.toFixed(1)} mmol/L — no severe hypoglycaemic excursion in flagged dips.` }
}

export const insightTimeOfDayPie = (
  kind: 'spikes' | 'dips' | 'all',
  data: { name: string; value: number }[],
  sum: number,
): ClinicalInsightData | null => {
  if (sum <= 0) return null
  let best = data[0]
  for (const d of data) {
    if (d.value > best.value) best = d
  }
  const pct = (best.value / sum) * 100
  const label = best.name

  if (kind === 'spikes' && (label === 'Evening' || label === 'Night') && pct >= 35) {
    return {
      tone: 'warning',
      text: `Spikes skew toward ${label} (${pct.toFixed(0)}% of spike load) — review late-day meals, insulin, and sleep.`,
    }
  }
  if (pct >= 50) {
    return {
      tone: 'neutral',
      text: `Dominant ${kind === 'all' ? 'event' : kind === 'spikes' ? 'spike' : 'dip'} load in ${label} (${pct.toFixed(0)}% of period distribution).`,
    }
  }
  return {
    tone: 'neutral',
    text: `Largest share in ${label} (${pct.toFixed(0)}%) — compare across Morning/ afternoon/ evening/ night.`,
  }
}

export const insightDashboardCgm = (cgm: DashboardPatientSnapshot['cgm']): ClinicalInsightData | null => {
  if (!cgm.available || !cgm.hasReadings || !cgm.metrics) {
    if (cgm.available && !cgm.hasReadings) {
      return { tone: 'warning', text: 'CGM matrix present but no rows for this patient — verify Client ID alignment.' }
    }
    return null
  }
  const m = cgm.metrics
  return insightCgmSpikeCount(m.nSpikes, m.nDays)
}

export const insightDashboardPillars = (
  pillars: DashboardPatientSnapshot['pillars'],
): ClinicalInsightData | null => {
  if (!pillars.available || !pillars.summary || pillars.averageGauge === null) return null
  const avg = pillars.averageGauge
  const neg = pillars.summary.negative
  if (neg && neg.mean >= 6) {
    return {
      tone: 'negative',
      text: `High negative affect (${neg.mean.toFixed(1)}/10) alongside mean pillar ${avg.toFixed(1)} — consider mood/sleep follow-up.`,
    }
  }
  if (avg < 5) {
    return {
      tone: 'warning',
      text: `Mean pillar score ${avg.toFixed(1)}/10 — self-reported wellbeing below typical mid-range; explore barriers.`,
    }
  }
  if (avg >= 7.5) {
    return { tone: 'positive', text: `Mean pillar score ${avg.toFixed(1)}/10 — self-reported domains comparatively strong.` }
  }
  return { tone: 'neutral', text: `Mean pillar score ${avg.toFixed(1)}/10 across ${pillars.summary.n_days} days — use radar for imbalance.` }
}

export const insightDashboardProfile = (profile: DashboardPatientSnapshot['profile']): ClinicalInsightData | null => {
  if (!profile.available) return null
  const bmi = profile.bmiCategory
  if (bmi?.label === 'Obese' || bmi?.label === 'Overweight') {
    return {
      tone: 'warning',
      text: `BMI category ${bmi.label} — align with cardiometabolic risk review and documented goals.`,
    }
  }
  if (bmi?.label === 'Normal') {
    return { tone: 'positive', text: 'BMI in normal range — still integrate with waist, HbA1c, and activity if available.' }
  }
  return { tone: 'neutral', text: 'Use full profile for medication, HbA1c, and BP context on the Patient Overview page.' }
}

export const insightPillarCard = (
  pillar: PillarName,
  mean: number | null,
  dominant: string | null,
): ClinicalInsightData => {
  if (mean === null || mean === undefined) {
    return { tone: 'neutral', text: 'Insufficient non-missing values for this pillar.' }
  }
  if (mean < 4) {
    return {
      tone: 'negative',
      text: `Low ${pillar} score (${mean.toFixed(1)}/10) — priority domain for intervention and follow-up.`,
    }
  }
  if (mean < 5.5) {
    return { tone: 'warning', text: `Below mid-range (${mean.toFixed(1)}/10) — explore contributors (sleep, stress, pain, mood).` }
  }
  if (dominant === 'declining') {
    return { tone: 'warning', text: `Trend declining — consider whether recent stressors or illness explain the drop.` }
  }
  if (dominant === 'improving') {
    return { tone: 'positive', text: 'Trend improving — reinforce behaviours that support this domain.' }
  }
  if (pillar === 'Stress' && mean >= 7) {
    return { tone: 'warning', text: 'High stress rating — link to sleep, mood, and glycaemic variability in the full record.' }
  }
  return { tone: 'positive', text: `Stable or favourable ${pillar} signal (${mean.toFixed(1)}/10) in this window.` }
}

export const insightNegativeAffect = (mean: number): ClinicalInsightData => {
  if (mean >= 7) {
    return {
      tone: 'negative',
      text: 'High negative affect load — consider screening for depression/anxiety and safety nets.',
    }
  }
  if (mean >= 5) {
    return { tone: 'warning', text: 'Elevated negative affect — correlate with sleep, stress pillar, and clinical events.' }
  }
  return { tone: 'positive', text: 'Negative affect in the lower band — still interpret with free text and context.' }
}

export const insightPillarRadarBalance = (values: number[]): ClinicalInsightData => {
  if (values.length < 2) return { tone: 'neutral', text: 'Not enough pillars to assess balance.' }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min
  if (spread >= 3.5) {
    return {
      tone: 'warning',
      text: `Wide spread (${spread.toFixed(1)} pts) between pillars — focus on the lowest domain first.`,
    }
  }
  return { tone: 'positive', text: 'Relatively balanced pillar profile — small gaps between highest and lowest domains.' }
}

export const insightStatParticipants = (n: number): ClinicalInsightData => {
  if (n === 0) return { tone: 'warning', text: 'No participants in session — upload CSVs with Client ID.' }
  if (n === 1) return { tone: 'neutral', text: 'Single participant in session — switch cohort in the header.' }
  return { tone: 'positive', text: `${n} participants in memory — suitable for multi-patient rounds review.` }
}

export const insightStatFiles = (inventory: DatasetInventory): ClinicalInsightData => {
  if (inventory.totalFiles === 0) {
    return { tone: 'negative', text: 'No files loaded — upload CGM, metadata, or pillars CSVs.' }
  }
  return {
    tone: 'positive',
    text: `${inventory.totalFiles} file(s), ${inventory.totalRows.toLocaleString()} rows — session ready for analysis.`,
  }
}

export const insightStatMix = (inventory: DatasetInventory): ClinicalInsightData => {
  const { cgmWide, pillars, tabular } = inventory
  if (cgmWide + pillars + tabular === 0) {
    return { tone: 'warning', text: 'No CGM / pillar / tabular CSVs detected — check file formats.' }
  }
  if (cgmWide >= 1 && pillars >= 1 && tabular >= 1) {
    return {
      tone: 'positive',
      text: 'CGM + pillars + tabular present — ideal for integrated metabolic and lifestyle review.',
    }
  }
  if (cgmWide >= 1 && pillars >= 1) {
    return { tone: 'positive', text: 'CGM and pillars loaded — link glucose events with self-report domains.' }
  }
  if (cgmWide >= 1) {
    return { tone: 'neutral', text: 'CGM matrix present — add pillar/metadata files for richer context.' }
  }
  return { tone: 'warning', text: 'No wide CGM matrix — spike detection requires Day × time-grid CSV.' }
}

export const insightStatLastUpload = (timestamp: number | null): ClinicalInsightData => {
  if (timestamp === null) {
    return { tone: 'neutral', text: 'No uploads yet this session.' }
  }
  return { tone: 'neutral', text: 'Data held in browser memory only — refresh clears session.' }
}

function parseHbA1c(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const s = (raw as string).replace(/%/g, '').replace(/,/g, '').trim()
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function parseBp(raw: string | undefined): { sys: number; dia: number } | null {
  if (raw === undefined) return null
  const m = String(raw).match(/(\d{2,3})\s*\/\s*(\d{2,3})/)
  if (!m) return null
  const sys = Number.parseInt(m[1], 10)
  const dia = Number.parseInt(m[2], 10)
  if (!Number.isFinite(sys) || !Number.isFinite(dia)) return null
  return { sys, dia }
}

export const insightOverviewClinical = (row: Record<string, string>): ClinicalInsightData => {
  const hba1c = parseHbA1c(metaField(row, 'HbA1c'))
  if (hba1c !== null) {
    if (hba1c >= 6.5) {
      return {
        tone: 'negative',
        text: `HbA1c ${hba1c.toFixed(1)}% meets diagnostic range for diabetes on lab standards — align with clinical diagnosis.`,
      }
    }
    if (hba1c >= 5.7) {
      return {
        tone: 'warning',
        text: `HbA1c ${hba1c.toFixed(1)}% in prediabetes range — intensify lifestyle and glucose monitoring.`,
      }
    }
    return { tone: 'positive', text: `HbA1c ${hba1c.toFixed(1)}% below common prediabetes cut-off — still track trends.` }
  }

  const bp = parseBp(metaField(row, 'Blood Pressure'))
  if (bp) {
    if (bp.sys >= 140 || bp.dia >= 90) {
      return {
        tone: 'negative',
        text: `BP ${bp.sys}/${bp.dia} mmHg — stage 2 hypertension range; confirm with repeated measures.`,
      }
    }
    if (bp.sys >= 130 || bp.dia >= 80) {
      return {
        tone: 'warning',
        text: `BP ${bp.sys}/${bp.dia} mmHg — elevated; align with ACC/AHA or local targets.`,
      }
    }
    return { tone: 'positive', text: `BP ${bp.sys}/${bp.dia} mmHg — below common stage-1 threshold on this reading.` }
  }

  const med = metaField(row, 'Medication')
  if (med && med.trim() !== '') {
    return { tone: 'neutral', text: 'Medication documented — cross-check with CGM and HbA1c interpretation.' }
  }
  return { tone: 'neutral', text: 'Add HbA1c, BP, and medication for cardiometabolic triangulation.' }
}

function parseNumeric(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const n = Number.parseFloat(String(raw).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

export const insightOverviewBody = (row: Record<string, string>): ClinicalInsightData => {
  const wh =
    parseNumeric(metaField(row, 'Waist:Height Ratio')) ?? parseNumeric(metaField(row, 'Waist:Height'))
  if (wh !== null && wh > 0.5) {
    return {
      tone: 'warning',
      text: `Waist:height ${wh.toFixed(3)} — central adiposity risk marker; pair with BMI and waist circumference.`,
    }
  }
  const bmi = parseNumeric(metaField(row, 'BMI'))
  if (bmi !== null && bmi >= 30) {
    return { tone: 'negative', text: `BMI ${bmi.toFixed(1)} — obesity class; use alongside waist and comorbidities.` }
  }
  if (bmi !== null && bmi >= 25) {
    return { tone: 'warning', text: `BMI ${bmi.toFixed(1)} — overweight range; document weight trajectory.` }
  }
  return { tone: 'neutral', text: 'Anthropometrics support risk framing — interpret with ethnicity-specific cut-offs if used.' }
}

export const insightOverviewDemographics = (row: Record<string, string>): ClinicalInsightData => {
  const age = metaField(row, 'Age')
  const n = age !== undefined ? Number.parseInt(String(age).replace(/\D/g, ''), 10) : NaN
  if (Number.isFinite(n) && n >= 65) {
    return { tone: 'neutral', text: 'Older adult — consider frailty, polypharmacy, and hypoglycaemia risk in CGM review.' }
  }
  return { tone: 'neutral', text: 'Demographics anchor cohort comparisons and expected physiology.' }
}

export const insightOverviewLifestyle = (row: Record<string, string>): ClinicalInsightData => {
  const chrono = metaField(row, 'Night Owl / Morning Lark')
  if (chrono && /night|owl/i.test(chrono)) {
    return {
      tone: 'warning',
      text: 'Evening chronotype — may shift meal and insulin timing; align with CGM nocturnal patterns.',
    }
  }
  return { tone: 'neutral', text: 'Wearable and chronotype data contextualise activity and sleep-related glucose variability.' }
}

export const insightOverviewQuickSummary = (
  bmiLabel: string,
  row: Record<string, string>,
): ClinicalInsightData => {
  if (bmiLabel === 'Obese' || bmiLabel === 'Overweight') {
    return {
      tone: 'warning',
      text: `BMI category ${bmiLabel} — integrate with HbA1c, BP, and CGM variability targets.`,
    }
  }
  const hba1c = parseHbA1c(metaField(row, 'HbA1c'))
  if (hba1c !== null && hba1c < 5.7 && bmiLabel === 'Normal') {
    return { tone: 'positive', text: 'BMI normal and HbA1c below prediabetes range on file — reinforce maintenance plan.' }
  }
  return { tone: 'neutral', text: 'Use Quick Summary as a snapshot — drill into vitals and labs in the cards above.' }
}

export const insightHealthGoal = (goal: string | null): ClinicalInsightData => {
  if (!goal || goal.trim() === '') {
    return { tone: 'warning', text: 'No documented health goal — capture patient priorities for shared decision-making.' }
  }
  return {
    tone: 'positive',
    text: 'Documented goal supports alignment between CGM/pillar metrics and patient intent.',
  }
}

export const insightCohortPillarTrend = (decliningPct: number): ClinicalInsightData => {
  if (decliningPct >= 40) {
    return { tone: 'negative', text: 'Large share of declining trends — review stressors and adherence across domains.' }
  }
  if (decliningPct >= 20) {
    return { tone: 'warning', text: 'Several declining pillars — prioritise lowest-scoring domains.' }
  }
  return { tone: 'neutral', text: 'Trend mix supports selective focus on declining domains only.' }
}
