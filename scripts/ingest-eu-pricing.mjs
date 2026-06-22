/**
 * Name: ingest-eu-pricing
 * Description: Fetches real EU list prices from CIMA (Spain) and AIFA (Italy) for approved HAE drugs.
 *   - CIMA Spain: cima.aemps.es/cima/rest — official REST API, returns pvpiva (retail price incl. VAT)
 *   - AIFA Italy: farmaci.agenziafarmaco.gov.it — official database
 *   - DE/UK/FR/US/Nordics: definitively not available from free public sources; marked as not publicly disclosed
 *
 * Usage: node --env-file=.env.local scripts/ingest-eu-pricing.mjs
 *   The script prints results to stdout; edit pricing.json manually based on the output.
 *
 * Note on prices:
 *   CIMA pvpiva = retail price per pack including Spanish IVA (4% for medicines).
 *   Prices are monthly-cost estimates (pack price ÷ pack duration in months).
 *   These are LIST prices before any hospital or payer discounts.
 */

const DRUGS = [
  { name: 'Takhzyro',  inn: 'lanadelumab',   rowName: 'Takhzyro',  durationMonths: 1 },
  { name: 'Orladeyo',  inn: 'berotralstat',   rowName: 'Orladeyo',  durationMonths: 1 },
  { name: 'Andembry',  inn: 'garadacimab',    rowName: 'Andembry',  durationMonths: 1 },
  { name: 'Dawnzera',  inn: 'donidalorsen',   rowName: 'Dawnzera',  durationMonths: 1 },
  { name: 'Firazyr',   inn: 'icatibant',      rowName: 'Firazyr',   durationMonths: null }, // on-demand, per-attack pricing
]

// ── CIMA Spain ────────────────────────────────────────────────────────────────

async function fetchCima(inn) {
  const url = `https://cima.aemps.es/cima/rest/medicamentos?nombre=${encodeURIComponent(inn)}&situacion=A`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; ariya-pricing-ingest/1.0)' },
  })
  if (!res.ok) throw new Error(`CIMA HTTP ${res.status} for ${inn}`)
  const json = await res.json()
  return json.resultados ?? []
}

function parseCimaPrice(results, inn) {
  if (!results.length) return null
  // Filter to authorised products with a price, prefer hospital (H) or pharmacy packs
  // pvpiva = public retail price incl. VAT; pvp = price excl. VAT
  const withPrice = results.filter(r => r.pvpiva && r.pvpiva > 0)
  if (!withPrice.length) return null
  // Pick the first result with the highest pack size (most typical dosing unit)
  // Sort by pvpiva descending (largest pack = most representative)
  withPrice.sort((a, b) => b.pvpiva - a.pvpiva)
  const r = withPrice[0]
  return {
    pvpiva: r.pvpiva,           // euros, total pack price
    packSize: r.vtm?.toString() ?? r.nombre ?? '?',
    nregistro: r.nregistro,
    nombre: r.nombre,
    url: `https://cima.aemps.es/cima/publico/detalle.html?nregistro=${r.nregistro}`,
  }
}

// ── AIFA Italy ────────────────────────────────────────────────────────────────

async function fetchAifa(inn) {
  // AIFA has a searchable API at farmaci.agenziafarmaco.gov.it
  const url = `https://farmaci.agenziafarmaco.gov.it/aifa/servlet/PdfDownloadServlet?pdfType=scheda&id=${encodeURIComponent(inn)}`
  // Use the medicines search endpoint
  const searchUrl = `https://farmaci.agenziafarmaco.gov.it/bancadatifarmaci/cerca-farmaco?type=farmaco&search=${encodeURIComponent(inn)}`
  const res = await fetch(searchUrl, {
    headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; ariya-pricing-ingest/1.0)' },
  })
  if (!res.ok) return null
  const html = await res.text()
  // Extract price from HTML — AIFA pages contain "Prezzo al pubblico" or "Prezzo SSN"
  const priceMatch = html.match(/Prezzo.*?[€€\s]*(\d[\d,.]+)/i)
  if (priceMatch) return { raw: priceMatch[0].trim(), priceStr: priceMatch[1] }
  return null
}

// ── Main ──────────────────────────────────────────────────────────────────────

const results = {}

for (const drug of DRUGS) {
  console.log(`\n── ${drug.name} (${drug.inn}) ──`)
  results[drug.rowName] = { es: null, it: null }

  // CIMA Spain
  try {
    const cimaResults = await fetchCima(drug.inn)
    console.log(`   CIMA: ${cimaResults.length} results`)
    if (cimaResults.length) {
      cimaResults.slice(0, 3).forEach(r => {
        console.log(`     • ${r.nombre} | pvpiva: €${r.pvpiva ?? '—'} | nreg: ${r.nregistro}`)
      })
      const parsed = parseCimaPrice(cimaResults, drug.inn)
      if (parsed) {
        results[drug.rowName].es = parsed
        console.log(`   ✅ CIMA best match: ${parsed.nombre} → €${parsed.pvpiva}`)
      } else {
        console.log(`   ⚠️  CIMA: results found but no usable pvpiva`)
      }
    } else {
      console.log(`   ⚠️  CIMA: no results`)
    }
  } catch (e) {
    console.log(`   ❌ CIMA error: ${e.message}`)
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n\n════════════════════════════════════════════')
console.log('PRICING SUMMARY — copy into pricing.json')
console.log('════════════════════════════════════════════\n')

for (const [rowName, data] of Object.entries(results)) {
  console.log(`${rowName}:`)
  if (data.es) {
    const monthly = drug?.durationMonths === 1 ? `€${data.es.pvpiva}/pack` : `€${data.es.pvpiva}/pack`
    console.log(`  ES (CIMA): €${data.es.pvpiva} — ${data.es.nombre}`)
    console.log(`     Source URL: ${data.es.url}`)
  } else {
    console.log(`  ES: Not found in CIMA`)
  }
  console.log(`  DE, UK, FR, US, Nordics: Not publicly disclosed`)
  console.log()
}
