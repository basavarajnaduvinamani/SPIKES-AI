import { detectEvents, reshapeWideToLong, type AnnotatedRow, type SpikeEvent } from './spikeDetection'
import { hydrateCgmWorkerResult, type CgmWorkerRequest, type CgmWorkerResponse } from './cgmWire'

const MAX_CACHE_ENTRIES = 8

type CachedAnalysis = { events: SpikeEvent[]; annotated: AnnotatedRow[] }

const cache = new Map<string, CachedAnalysis>()

const cacheKey = (datasetId: string, patientId: string) => `${datasetId}|${patientId.trim()}`

const touchCache = (key: string, value: CachedAnalysis) => {
  cache.delete(key)
  cache.set(key, value)
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export const peekCgmAnalysisCache = (datasetId: string, patientId: string): CachedAnalysis | null =>
  cache.get(cacheKey(datasetId, patientId)) ?? null

export const runCgmDetectSync = (
  rows: Record<string, string>[],
  columns: string[],
  patientId: string,
): CachedAnalysis => {
  const long = reshapeWideToLong(rows, columns)
  return detectEvents(long, patientId, {
    mode: 'both',
    direction: 'both',
  })
}

let worker: Worker | undefined
let nextRequestId = 1

const getWorker = (): Worker => {
  if (!worker) {
    worker = new Worker(new URL('./cgmAnalysis.worker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

export type RunCgmDetectParams = {
  datasetId: string
  rows: Record<string, string>[]
  columns: string[]
  patientId: string
}

/**
 * Runs CGM reshape + spike detection off the main thread when possible.
 * Results are LRU-cached per dataset + patient.
 */
export const runCgmDetect = async (params: RunCgmDetectParams): Promise<CachedAnalysis> => {
  const key = cacheKey(params.datasetId, params.patientId)
  const hit = cache.get(key)
  if (hit) {
    touchCache(key, hit)
    return hit
  }

  return new Promise<CachedAnalysis>((resolve, reject) => {
    const id = nextRequestId++
    const w = getWorker()

    const onMessage = (e: MessageEvent<CgmWorkerResponse>) => {
      if (e.data.id !== id) return
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)

      if (!e.data.ok) {
        reject(new Error(e.data.error))
        return
      }
      const hydrated = hydrateCgmWorkerResult(e.data.result)
      touchCache(key, hydrated)
      resolve(hydrated)
    }

    const onError = (ev: ErrorEvent) => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
      reject(ev.error ?? new Error(ev.message))
    }

    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)

    const req: CgmWorkerRequest = {
      id,
      rows: params.rows,
      columns: params.columns,
      patientId: params.patientId,
    }
    w.postMessage(req)
  }).catch(() => {
    const fallback = runCgmDetectSync(params.rows, params.columns, params.patientId)
    touchCache(key, fallback)
    return fallback
  })
}
