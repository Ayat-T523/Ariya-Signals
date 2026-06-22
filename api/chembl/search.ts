const CHEMBL_BASE = 'https://www.ebi.ac.uk/chembl/api/data'
const TIMEOUT_MS = 10_000

// Shape of one molecule record returned by ChEMBL /molecule/search
// Only the fields we confirmed are present and reliable in Sprint 1 testing.
interface ChemblMolecule {
  molecule_chembl_id: string
  pref_name: string | null
  max_phase: string | null
  molecule_type: string | null
  molecule_synonyms: Array<{
    molecule_synonym: string
    syn_type: string
  }>
  atc_classifications: string[]
  usan_stem_definition: string | null
}

export interface ChemblResult {
  inn: string                  // canonical INN — primary entity key in assets table
  chembl_id: string            // stable ChEMBL identifier for cross-source linking
  max_phase: number | null     // development phase (1–4); null = unknown
  drug_type: string | null     // "Small molecule" | "Biologicals" | etc.
  synonyms: string[]           // all synonyms incl. research codes (entity resolution)
  research_codes: string[]     // subset of synonyms where syn_type = RESEARCH_CODE
  atc_codes: string[]          // ATC codes directly from ChEMBL (only present for approved drugs)
  usan_stem_label: string | null  // drug CLASS label from USAN naming committee — NOT mechanism of action
}

function parseResult(mol: ChemblMolecule): ChemblResult | null {
  // Discard entries without a preferred INN — we cannot use them as entity keys
  if (!mol.pref_name) return null

  const synonyms = (mol.molecule_synonyms ?? []).map((s) => s.molecule_synonym)
  const research_codes = (mol.molecule_synonyms ?? [])
    .filter((s) => s.syn_type === 'RESEARCH_CODE')
    .map((s) => s.molecule_synonym)

  const raw_phase = mol.max_phase ? parseFloat(mol.max_phase) : null

  return {
    inn: mol.pref_name,
    chembl_id: mol.molecule_chembl_id,
    max_phase: raw_phase !== null && !isNaN(raw_phase) ? raw_phase : null,
    drug_type: mol.molecule_type ?? null,
    synonyms,
    research_codes,
    atc_codes: mol.atc_classifications ?? [],
    usan_stem_label: mol.usan_stem_definition ?? null,
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (q.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' })
  }

  const url = `${CHEMBL_BASE}/molecule/search?q=${encodeURIComponent(q)}&format=json&limit=10`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const upstream = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!upstream.ok) {
      return res.status(502).json({
        error: 'ChEMBL API returned an error',
        upstream_status: upstream.status,
      })
    }

    const data = await upstream.json() as { molecules?: ChemblMolecule[] }
    const molecules: ChemblMolecule[] = data.molecules ?? []

    const results = molecules
      .map(parseResult)
      .filter((r): r is ChemblResult => r !== null)

    return res.status(200).json({ results, source: 'ChEMBL', query: q })
  } catch (err: any) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'ChEMBL API timed out' })
    }
    console.error('[chembl/search] fetch error:', err)
    return res.status(502).json({ error: 'Failed to reach ChEMBL API' })
  }
}
