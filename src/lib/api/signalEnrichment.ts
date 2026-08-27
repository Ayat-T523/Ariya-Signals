/**
 * signalEnrichment.ts — Intelligence Feed AI enrichment read client (V1,
 * 2026-08-27 checkpoint, report section 1; correctness fix, third pass:
 * cache identity must include the canonical Disease Area, never
 * evidence_id alone).
 *
 * Talks to POST /api/landscape/signal-enrichment on the Ariya HTTP API
 * (ariya-lightci-python/intelligence_signal_enrichment.py's enrich_signals()
 * + api_server.py's own `_handle_signal_enrichment_post()`). Sends ONLY the
 * same factual fields the UI already displays for each Signal -- the
 * backend can enrich strictly from what's given, never from anything the
 * frontend hasn't already shown as fact. Groq/Gemini stay server-side;
 * this client never sees an API key.
 *
 * `disease_area_id` is REQUIRED and must be the SAME canonical Disease
 * Area identifier (e.g. a MONDO id, from resolveCanonicalIndicationId())
 * already used for every other landscape-scoped read in Portal.tsx --
 * never the mutable `disease_area_name` display label. `why_related`
 * answers "why is this shown in THIS landscape", so the backend's cache
 * is keyed by (evidence_id, disease_area_id) together; sending a stable
 * evidence_id with an inconsistent/missing disease_area_id risks either a
 * spurious cache miss (harmless -- just re-enriches) or, if ever wrongly
 * hand-rolled elsewhere, a cross-landscape relevance leak. This client
 * itself never invents a fallback id -- see Portal.tsx's own gating on
 * canonicalIndicationId before calling this at all.
 *
 * A network/API failure here must never hide the factual Signal it was
 * asked to enrich -- callers treat a rejected promise (or a missing
 * evidence_id in the response) the same as an explicit `status:
 * 'unavailable'` entry: render the Signal as-is, with no AI text.
 */
import { apiPost } from './client'

export interface SignalEnrichmentRequestItem {
  evidence_id: string
  disease_area_id: string
  company_name: string
  asset_name?: string | null
  disease_area_name?: string | null
  information_category: string
  occurred_at: string
  source_label: string
  title: string
  description?: string | null
}

export interface SignalEnrichmentResult {
  status: 'ok' | 'unavailable'
  headline?: string
  summary?: string
  why_related?: string
}

export async function fetchSignalEnrichment(
  signals: SignalEnrichmentRequestItem[],
): Promise<Record<string, SignalEnrichmentResult>> {
  if (signals.length === 0) return {}
  const raw = await apiPost<{ items: Record<string, SignalEnrichmentResult> }>(
    '/api/landscape/signal-enrichment', { signals },
  )
  return raw.items ?? {}
}
