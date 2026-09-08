import { Type, type FunctionDeclaration } from '@google/genai'
import { buildDatasetInventory, computeDashboardPatientSnapshot } from '../dashboard/dashboardSnapshot'
import { unionPatientIdsAcrossDatasets } from '../utils/patientIds'
import type { UploadedDataset } from '../types/dataset'

export type SpikesToolContext = {
  datasets: UploadedDataset[]
  totalRowCount: number
  defaultPatientId: string | null
}

export const spikesDataToolDeclaration: FunctionDeclaration = {
  name: 'spikes_data',
  description:
    'Access real data from the SPIKES app session in the browser (uploaded CSVs only). Use session_inventory to list participants and file mix. Use patient_snapshot for CGM spike/dip counts, pillar means/trends, and metadata profile—same computations as the dashboard. Never invent numbers.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query_type: {
        type: Type.STRING,
        format: 'enum',
        enum: ['session_inventory', 'patient_snapshot'],
        description:
          'session_inventory: list Client IDs and dataset counts. patient_snapshot: full metrics for one patient.',
      },
      patient_id: {
        type: Type.STRING,
        description:
          'For patient_snapshot: Client ID. Omit to use the patient currently selected in the app header.',
      },
    },
    required: ['query_type'],
  },
}

export const executeSpikesDataTool = (
  args: Record<string, unknown>,
  ctx: SpikesToolContext,
): object => {
  const qt = args.query_type
  if (qt === 'session_inventory') {
    return {
      patient_ids: unionPatientIdsAcrossDatasets(ctx.datasets),
      inventory: buildDatasetInventory(ctx.datasets, ctx.totalRowCount),
    }
  }
  if (qt === 'patient_snapshot') {
    const raw = args.patient_id
    const pid =
      typeof raw === 'string' && raw.trim() !== ''
        ? raw.trim()
        : ctx.defaultPatientId
    if (!pid) {
      return {
        error:
          'No patient_id and no participant selected in the app header. Pick a patient or pass patient_id.',
      }
    }
    if (ctx.datasets.length === 0) {
      return { error: 'No CSVs loaded in this session. Use the Data upload page first.' }
    }
    const snap = computeDashboardPatientSnapshot(ctx.datasets, pid)
    if (!snap) {
      return { error: `Could not build snapshot for ${pid}.` }
    }
    return { patient_id: pid, snapshot: snap }
  }
  return { error: `Invalid query_type: ${String(qt)}` }
}
