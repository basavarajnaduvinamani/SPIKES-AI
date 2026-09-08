import { detectEvents, reshapeWideToLong } from './spikeDetection'
import {
  wireAnnotatedRow,
  wireSpikeEvent,
  type CgmWorkerRequest,
  type CgmWorkerResponse,
  type WireCgmResult,
} from './cgmWire'

self.onmessage = (e: MessageEvent<CgmWorkerRequest>) => {
  const { id, rows, columns, patientId } = e.data
  try {
    const long = reshapeWideToLong(rows, columns)
    const { events, annotated } = detectEvents(long, patientId, {
      mode: 'both',
      direction: 'both',
    })
    const result: WireCgmResult = {
      events: events.map(wireSpikeEvent),
      annotated: annotated.map(wireAnnotatedRow),
    }
    const out: CgmWorkerResponse = { id, ok: true, result }
    ;(self as unknown as { postMessage: (m: CgmWorkerResponse) => void }).postMessage(out)
  } catch (err) {
    const out: CgmWorkerResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
    ;(self as unknown as { postMessage: (m: CgmWorkerResponse) => void }).postMessage(out)
  }
}
