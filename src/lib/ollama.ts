/**
 * ollama.ts — client-side Ollama client for the live "Ask InForm" modal.
 *
 * Mirrors scripts/lib/buildCleanHeadline.mjs's calling convention (same
 * /api/generate endpoint, same non-streaming request shape) but reads
 * VITE_-prefixed env vars since this runs in the browser, not a Node script.
 * Local-only: only reachable when the browser and the Ollama server share a
 * machine/network, which is fine for local dev and not meant to survive a
 * real deployed build talking to someone else's laptop.
 */

const OLLAMA_HOST = import.meta.env.VITE_OLLAMA_HOST ?? 'http://localhost:11434'
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL ?? 'llama3.1'
const TIMEOUT_MS = 45_000

export class OllamaError extends Error {}

export async function askOllama(systemPrompt: string, userPrompt: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: systemPrompt,
        prompt: userPrompt,
        stream: false,
        options: { temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new OllamaError(`Could not reach the local Ollama server at ${OLLAMA_HOST}. Make sure "ollama serve" (or the Ollama app) is running.`)
  }
  if (!res.ok) throw new OllamaError(`Ollama responded with an error (HTTP ${res.status}).`)

  const data = await res.json()
  const text = (data.response ?? '').trim()
  if (!text) throw new OllamaError('Ollama returned an empty response.')
  return text
}
