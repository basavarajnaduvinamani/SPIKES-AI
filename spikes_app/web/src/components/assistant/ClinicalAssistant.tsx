import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { SpikesGeminiChat } from '../../assistant/runGeminiChat'
import {
  FileText,
  HelpCircle,
  MessageSquare,
  Send,
  Settings2,
  X,
  KeyRound,
  Trash2,
  Loader2,
} from 'lucide-react'
import { useDatasets } from '../../context/DatasetProvider'
import {
  clearGeminiApiKey,
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODEL_OPTIONS,
  readGeminiApiKey,
  readGeminiModel,
  writeGeminiApiKey,
  writeGeminiModel,
} from '../../assistant/geminiSettings'
import { createSpikesChatSession, sendAssistantUserTurn } from '../../assistant/runGeminiChat'
import type { SpikesToolContext } from '../../assistant/spikesDataTool'
import { AssistantMarkdown } from './AssistantMarkdown'
import { isAssistantQueryOutOfScope, OUT_OF_SCOPE_REFUSAL } from '../../assistant/assistantScope'

type ChatMessage = {
  id: string
  role: 'user' | 'model'
  text: string
}

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export const ClinicalAssistant = () => {
  const { datasets, patientIds, selectedPatientId, totalRowCount } = useDatasets()
  const [panelOpen, setPanelOpen] = useState(false)
  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [settingsKey, setSettingsKey] = useState('')
  const [settingsModel, setSettingsModel] = useState(DEFAULT_GEMINI_MODEL)
  const chatRef = useRef<SpikesGeminiChat | null>(null)
  const messagesScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!panelOpen) return
    setSettingsKey(readGeminiApiKey())
    setSettingsModel(readGeminiModel())
  }, [panelOpen])

  useEffect(() => {
    if (!panelOpen || view !== 'chat') return
    const el = messagesScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [panelOpen, view, messages, busy])

  const invalidateChat = useCallback(() => {
    chatRef.current = null
  }, [])

  const datasetSignature = useMemo(() => datasets.map((d) => d.id).join('|'), [datasets])
  useEffect(() => {
    // Keep Gemini's internal chat history aligned with the current browser session data.
    invalidateChat()
  }, [datasetSignature, selectedPatientId, totalRowCount, invalidateChat])

  const handleSaveSettings = useCallback(() => {
    writeGeminiApiKey(settingsKey)
    writeGeminiModel(settingsModel)
    invalidateChat()
    setMessages([])
    setError(null)
    setView('chat')
  }, [invalidateChat, settingsKey, settingsModel])

  const handleClearKey = useCallback(() => {
    clearGeminiApiKey()
    setSettingsKey('')
    invalidateChat()
    setMessages([])
  }, [invalidateChat])

  const handleClearConversation = useCallback(() => {
    invalidateChat()
    setMessages([])
    setError(null)
  }, [invalidateChat])

  const toolContext = useMemo<SpikesToolContext>(
    () => ({
      datasets,
      totalRowCount,
      defaultPatientId: selectedPatientId,
    }),
    [datasets, totalRowCount, selectedPatientId],
  )

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || busy) return
    const apiKey = readGeminiApiKey()
    if (!apiKey.trim()) {
      setError('Add your Gemini API key in Settings (BYOK).')
      setView('settings')
      return
    }

    setError(null)
    setInput('')
    const userMsg: ChatMessage = { id: makeId(), role: 'user', text: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setBusy(true)

    try {
      const normalized = trimmed.toLowerCase()
      const wantsQuestionSuggestions =
        /(\bquestions?\b|\bwhat\b.*\bask\b|\bwhat should\b|\bhelp\b.*\bask\b)/i.test(normalized)

      if (toolContext.datasets.length === 0) {
        const text =
          "I don’t see any CSV uploads in this session yet. Upload a CGM and/or pillars CSV, then try again.\n\nGood next prompts:\n1. “What files are loaded right now?”\n2. “What data do you need to run patient metrics?”"
        setMessages((prev) => [...prev, { id: makeId(), role: 'model', text }])
        return
      }

      if (!toolContext.defaultPatientId) {
        const text =
          "CSV files are loaded, but no patient is selected in the header.\n\nGood next prompts:\n1. “List participants in this session.”\n2. “Give me a patient snapshot for the selected patient.”"
        setMessages((prev) => [...prev, { id: makeId(), role: 'model', text }])
        return
      }

      if (wantsQuestionSuggestions) {
        const pid = toolContext.defaultPatientId
        const text =
          `Here are strong questions to ask next (focused on patient ${pid}):\n\n1. “What’s the session inventory (files + participants)?”\n2. “Give me a patient snapshot summary.”\n3. “Summarize CGM spikes/dips (counts + biggest spike/dip).”\n4. “Show time-of-day patterns of spikes vs dips.”\n5. “Compute glycemic variability metrics and interpret them briefly as data.”\n6. “Summarize pillars (Sleep/Stress/Nutrition/Movement) and dominant trends.”\n7. “Which pillar(s) look most aligned with spike/dip patterns in this dataset?”\n\nAsk me any of the above and I’ll use tool-grounded data.`
        setMessages((prev) => [...prev, { id: makeId(), role: 'model', text }])
        return
      }

      if (isAssistantQueryOutOfScope(trimmed)) {
        setMessages((prev) => [...prev, { id: makeId(), role: 'model', text: OUT_OF_SCOPE_REFUSAL }])
        return
      }

      if (!chatRef.current) {
        chatRef.current = createSpikesChatSession(apiKey, readGeminiModel())
      }
      const { text } = await sendAssistantUserTurn(chatRef.current, trimmed, toolContext)
      setMessages((prev) => [...prev, { id: makeId(), role: 'model', text }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed.'
      setError(msg)
      invalidateChat()
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: 'model', text: `**Error:** ${msg}` },
      ])
    } finally {
      setBusy(false)
    }
  }, [busy, input, invalidateChat, toolContext])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend],
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="fixed bottom-12 right-4 z-90 flex items-center gap-2 rounded-full border border-zinc-200/90 bg-wellness-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-wellness-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness-400 focus-visible:ring-offset-2 sm:bottom-16 sm:px-4 sm:py-3 dark:border-zinc-600 dark:bg-wellness-700 dark:hover:bg-wellness-600 md:right-6"
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
        title="Open assistant — chat, session data, and help"
        aria-label="Open clinical assistant chat with documentation and help"
      >
        <span className="flex items-center gap-1 border-r border-white/25 pr-2 sm:gap-1.5" aria-hidden="true">
          <MessageSquare className="size-[18px] shrink-0 sm:size-5" strokeWidth={2} />
          <FileText className="size-[16px] shrink-0 opacity-90 sm:size-[18px]" strokeWidth={2} />
          <HelpCircle className="size-[16px] shrink-0 opacity-90 sm:size-[18px]" strokeWidth={2} />
        </span>
        <span className="hidden sm:inline">Assistant</span>
      </button>

      {panelOpen ? (
        <div
          className="fixed inset-0 z-95 flex justify-end"
          role="presentation"
          onClick={() => setPanelOpen(false)}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="clinical-assistant-title"
            className="relative z-96 flex h-full w-full max-w-md flex-col border-l border-zinc-200/90 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-700">
              <h2
                id="clinical-assistant-title"
                className="font-display text-sm font-semibold text-slate-900 dark:text-zinc-50"
              >
                {view === 'settings' ? 'Assistant settings' : 'SPIKES assistant'}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setView((v) => (v === 'settings' ? 'chat' : 'settings'))}
                  className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  aria-label={view === 'settings' ? 'Back to chat' : 'Open settings'}
                >
                  <Settings2 className="size-5" strokeWidth={2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  aria-label="Close assistant"
                >
                  <X className="size-5" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </div>

            {view === 'settings' ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Bring your own key (BYOK). Your key is stored only in this browser&apos;s{' '}
                  <span className="font-mono">localStorage</span>. It is sent directly to Google&apos;s
                  Generative Language API from this device—not through a SPIKES server.
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label
                      htmlFor="gemini-api-key"
                      className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500"
                    >
                      <KeyRound className="size-3.5" strokeWidth={2} aria-hidden="true" />
                      Gemini API key
                    </label>
                    <input
                      id="gemini-api-key"
                      type="password"
                      autoComplete="off"
                      value={settingsKey}
                      onChange={(e) => setSettingsKey(e.target.value)}
                      placeholder="AIza…"
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="gemini-model" className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      Model
                    </label>
                    <select
                      id="gemini-model"
                      value={settingsModel}
                      onChange={(e) => setSettingsModel(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {GEMINI_MODEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="rounded-lg bg-wellness-600 px-3 py-2 text-xs font-semibold text-white hover:bg-wellness-700 dark:bg-wellness-700 dark:hover:bg-wellness-600"
                  >
                    Save &amp; use
                  </button>
                  <button
                    type="button"
                    onClick={handleClearKey}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-zinc-600 dark:text-zinc-200"
                  >
                    Remove key from browser
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="shrink-0 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                      {patientIds.length}
                    </span>{' '}
                    participant(s) · selected{' '}
                    <span className="font-mono font-medium text-wellness-700 dark:text-wellness-400">
                      {selectedPatientId ?? '—'}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={handleClearConversation}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-500 hover:text-wellness-700 dark:hover:text-wellness-400"
                  >
                    <Trash2 className="size-3" strokeWidth={2} aria-hidden="true" />
                    New conversation
                  </button>
                </div>

                <div
                  ref={messagesScrollRef}
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-smooth px-4 py-3"
                  tabIndex={0}
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions"
                >
                  {messages.length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Ask about loaded CGM spikes, lifestyle pillars, or who is in the session. Answers use{' '}
                      <span className="font-medium text-slate-700 dark:text-zinc-300">tool-grounded</span> data from
                      your uploads—not the model&apos;s memory.
                    </p>
                  ) : null}
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'ml-6 bg-wellness-50 text-slate-900 dark:bg-wellness-950/40 dark:text-zinc-100'
                          : 'mr-6 border border-zinc-200/80 bg-zinc-50 text-slate-800 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100'
                      }`}
                    >
                      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-400">
                        {m.role === 'user' ? 'You' : 'Assistant'}
                      </p>
                      {m.role === 'user' ? (
                        <div className="whitespace-pre-wrap text-xs">{m.text}</div>
                      ) : (
                        <AssistantMarkdown content={m.text} />
                      )}
                    </div>
                  ))}
                  {busy ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                      Thinking…
                    </div>
                  ) : null}
                </div>

                {error ? (
                  <div className="shrink-0 border-t border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    {error}
                  </div>
                ) : null}

                <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="flex gap-2">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={2}
                      placeholder="Ask about this session’s data…"
                      disabled={busy}
                      className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-zinc-400 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      aria-label="Message to assistant"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={busy || !input.trim()}
                      className="self-end rounded-lg bg-wellness-600 p-2.5 text-white hover:bg-wellness-700 disabled:opacity-50 dark:bg-wellness-700 dark:hover:bg-wellness-600"
                      aria-label="Send message"
                    >
                      <Send className="size-5" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-500">
                    Not medical advice. PHI sent to Google is subject to your agreement with Google and your
                    institution&apos;s policies.
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}
    </>
  )
}
