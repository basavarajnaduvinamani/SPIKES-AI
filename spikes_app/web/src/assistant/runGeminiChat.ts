import {
  createPartFromFunctionResponse,
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Chat,
  type FunctionCall,
} from '@google/genai'
import { SPIKES_ASSISTANT_SYSTEM_INSTRUCTION } from './systemInstruction'
import { executeSpikesDataTool, spikesDataToolDeclaration, type SpikesToolContext } from './spikesDataTool'
import { DEFAULT_GEMINI_MODEL } from './geminiSettings'

export type SpikesGeminiChat = Chat

export const createSpikesChatSession = (apiKey: string, modelName: string): Chat => {
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() })
  return ai.chats.create({
    model: modelName.trim() || DEFAULT_GEMINI_MODEL,
    config: {
      systemInstruction: SPIKES_ASSISTANT_SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: [spikesDataToolDeclaration] }],
      toolConfig: {
        functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
      },
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  })
}

const runToolCall = (fc: FunctionCall, ctx: SpikesToolContext): Record<string, unknown> => {
  if (fc.name === 'spikes_data') {
    const out = executeSpikesDataTool((fc.args ?? {}) as Record<string, unknown>, ctx)
    return out as Record<string, unknown>
  }
  return { error: `Unknown tool: ${fc.name}` }
}

const MAX_TOOL_ROUNDS = 10

/**
 * Sends one user turn, resolves tool calls in a loop, returns final assistant text.
 */
export const sendAssistantUserTurn = async (
  chat: Chat,
  userText: string,
  ctx: SpikesToolContext,
): Promise<{ text: string; blocked?: boolean }> => {
  const prefix =
    `[SPIKES UI context: header patient = "${ctx.defaultPatientId ?? 'none'}"; loaded CSV files = ${ctx.datasets.length}; total rows = ${ctx.totalRowCount}]\n` +
    `[Answer only SPIKES session data / app usage; refuse general knowledge — see system instruction.]\n\n`
  let response = await chat.sendMessage({ message: prefix + userText })

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const calls = response.functionCalls
    if (!calls?.length) break
    const parts = calls.map((fc, index) =>
      createPartFromFunctionResponse(
        fc.id ?? `spikes-tool-${round}-${index}-${fc.name ?? 'fn'}`,
        fc.name ?? 'unknown',
        runToolCall(fc, ctx),
      ),
    )
    response = await chat.sendMessage({ message: parts })
  }

  const text = response.text
  if (text !== undefined && text !== '') {
    return { text }
  }

  const block = response.promptFeedback?.blockReason
  return {
    text: block
      ? `Response blocked (${block}). Try rephrasing or adjust safety settings in Google AI Studio.`
      : 'No text was returned (empty or blocked candidate).',
    blocked: true,
  }
}
