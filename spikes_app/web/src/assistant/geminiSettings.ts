export const GEMINI_API_KEY_STORAGE = 'spikes-gemini-api-key'
export const GEMINI_MODEL_STORAGE = 'spikes-gemini-model'

export const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview'

export const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (preview)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
] as const

export const readGeminiApiKey = (): string => {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(GEMINI_API_KEY_STORAGE) ?? ''
}

export const writeGeminiApiKey = (key: string) => {
  window.localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim())
}

export const clearGeminiApiKey = () => {
  window.localStorage.removeItem(GEMINI_API_KEY_STORAGE)
}

export const readGeminiModel = (): string => {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_MODEL
  const stored = window.localStorage.getItem(GEMINI_MODEL_STORAGE) ?? DEFAULT_GEMINI_MODEL
  const allowedValues = new Set<string>(GEMINI_MODEL_OPTIONS.map((o) => o.value))
  return allowedValues.has(stored) ? stored : DEFAULT_GEMINI_MODEL
}

export const writeGeminiModel = (model: string) => {
  window.localStorage.setItem(GEMINI_MODEL_STORAGE, model.trim())
}
