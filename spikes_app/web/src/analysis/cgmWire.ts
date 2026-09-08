/**
 * Serializable wire format for CGM analysis results (worker → main thread).
 * Dates are epoch ms; revived to Date in hydrateCgmWorkerResult.
 */

import type { AnnotatedRow, SpikeEvent } from './spikeDetection'

export type WireSpikeEvent = Omit<SpikeEvent, 'start_time' | 'end_time' | 'peak_time'> & {
  start_time: number
  end_time: number
  peak_time: number
}

export type WireAnnotatedRow = Omit<AnnotatedRow, 'datetime'> & {
  datetime: number
}

export type WireCgmResult = {
  events: WireSpikeEvent[]
  annotated: WireAnnotatedRow[]
}

export type CgmWorkerRequest = {
  id: number
  rows: Record<string, string>[]
  columns: string[]
  patientId: string
}

export type CgmWorkerResponse =
  | { id: number; ok: true; result: WireCgmResult }
  | { id: number; ok: false; error: string }

export const wireSpikeEvent = (e: SpikeEvent): WireSpikeEvent => {
  const { start_time, end_time, peak_time, ...rest } = e
  return {
    ...rest,
    start_time: start_time.getTime(),
    end_time: end_time.getTime(),
    peak_time: peak_time.getTime(),
  }
}

export const wireAnnotatedRow = (r: AnnotatedRow): WireAnnotatedRow => {
  const { datetime, ...rest } = r
  return {
    ...rest,
    datetime: datetime.getTime(),
  }
}

export const hydrateSpikeEvent = (w: WireSpikeEvent): SpikeEvent => {
  const { start_time, end_time, peak_time, ...rest } = w
  return {
    ...rest,
    start_time: new Date(start_time),
    end_time: new Date(end_time),
    peak_time: new Date(peak_time),
  }
}

export const hydrateAnnotatedRow = (w: WireAnnotatedRow): AnnotatedRow => {
  const { datetime, ...rest } = w
  return {
    ...rest,
    datetime: new Date(datetime),
  }
}

export const hydrateCgmWorkerResult = (raw: WireCgmResult): { events: SpikeEvent[]; annotated: AnnotatedRow[] } => ({
  events: raw.events.map(hydrateSpikeEvent),
  annotated: raw.annotated.map(hydrateAnnotatedRow),
})
