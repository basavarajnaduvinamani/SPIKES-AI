/**
 * Detect queries that are outside SPIKES (session data + app usage + CGM/pillar interpretation).
 * Used to avoid burning tokens on general knowledge; model instruction still reinforces scope.
 */

const IN_SCOPE = new RegExp(
  [
    'spikes',
    'cgm',
    'spi?kes[- ]?\\d',
    '\\bspike\\b',
    '\\bdip\\b',
    'glucose',
    'pillar',
    'session',
    'inventory',
    'snapshot',
    'upload',
    '\\bcsv\\b',
    'participant',
    'patient',
    'client\\s*id',
    'wellness',
    'glycemic',
    'mmol',
    'hba1c',
    'time\\s+in\\s+range',
    '\\btir\\b',
    'metric',
    'cohort',
    'metadata',
    'bmi',
    'FFT',
    'baseline',
    'detection',
    'algorithm',
    'find_peaks',
    'scipy',
    'lifestyle',
    'negative\\s+affect',
    'selected\\s+in\\s+header',
    'tool',
    'loaded\\s+file',
    'data\\s+upload',
  ].join('|'),
  'i',
)

const OUT_OF_SCOPE_PATTERN = new RegExp(
  [
    '\\bwho\\s+(is|are|was|were)\\b',
    '\\bwhat\\s+is\\s+the\\s+capital\\s+of\\b',
    '\\btell\\s+me\\s+a\\s+joke\\b',
    '\\bwrite\\s+(me\\s+)?(a\\s+)?(poem|story|essay)\\b',
    '\\btranslate\\s+.+(\\s+to|\\s+into)\\s+\\w+\\b',
  ].join('|'),
  'i',
)

export const isAssistantQueryOutOfScope = (raw: string): boolean => {
  const t = raw.trim()
  if (t.length === 0) return false
  if (IN_SCOPE.test(t)) return false
  return OUT_OF_SCOPE_PATTERN.test(t)
}

export const OUT_OF_SCOPE_REFUSAL =
  'I only answer questions about **this SPIKES session**: uploaded CGM / pillars / metadata, the selected participant, and metrics returned from the app’s tools. I can’t answer general knowledge or unrelated topics. Try asking for a **session inventory**, **patient snapshot**, or a question about **spikes/dips** or **pillars** for the current data.'
