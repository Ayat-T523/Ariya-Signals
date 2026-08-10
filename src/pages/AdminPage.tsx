import { Info } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAllAssets, getAssetLexicon, type DbAsset } from '../lib/db'
import type { LexiconRow } from '../lib/deterministic/lexicon'
import { competitorsData } from '../data/kalvista'

/**
 * Every row here is read live from Supabase. It used to be a hardcoded array of
 * three drugs, which had already drifted from the database it claimed to
 * describe: it listed 'SHP643' and 'PHVS416' where asset_lexicon actually holds
 * 'SHP-643' and 'PHVS-719', and it mixed therapy-area words ('bradykinin',
 * 'HELP trial') in among the drug synonyms. An admin page whose whole job is to
 * show what the system tracks cannot be a separate hand-maintained copy of it.
 *
 * The synonyms column reads asset_lexicon (inn + brand_name + synonyms), which
 * is precisely what the ingest resolver matches on in
 * scripts/lib/signal-gate.mjs. Reading assets.synonyms instead would render a
 * plausible list that is not the one doing the matching.
 */

/** Shown wherever the database has no value. Never a guess. */
const UNKNOWN = '—'

/**
 * Drop case-insensitive repeats, keeping the first spelling seen.
 *
 * asset_lexicon.synonyms often restates the inn and brand_name (garadacimab's
 * synonyms are ['garadacimab', 'Andembry', 'garadacimab-gxii']), so a naive
 * concatenation shows each twice. The resolver lower-cases every term into a Map
 * key, so the repeats are harmless there; here they would read as a bug.
 */
function dedupeTerms(terms: string[]): string[] {
  const seen = new Set<string>()
  return terms.filter(term => {
    const key = term.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Turn a stored enum into prose: 'acute_treatment' reads as 'Acute treatment'.
 * Purely mechanical, so no value is invented and unrecognised values still show.
 */
function humaniseEnum(value: string | null): string | null {
  if (!value) return null
  const spaced = value.replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

interface TrackedAsset {
  inn: string
  brandName: string | null
  company: string | null
  therapeuticAreaTags: string[]
  mechanism: string | null
  indication: string | null
  /** Exactly the terms the ingest resolver matches on for this asset. */
  monitoredTerms: string[]
  posture: string | null
  /** True when no asset_lexicon row exists, so nothing is matched for it. */
  unmonitored: boolean
}

/** Join live assets to their lexicon rows and editorial posture. */
function buildTrackedAssets(
  assets: DbAsset[],
  lexicon: LexiconRow[],
): TrackedAsset[] {
  const byInn = new Map(lexicon.map(row => [row.inn.toLowerCase(), row]))
  const competitors = competitorsData as Array<{ id: string; name: string; strategicPosture?: string }>
  const compById = new Map(competitors.map(c => [c.id, c]))

  return assets
    .map(asset => {
      const row = byInn.get(asset.inn.toLowerCase())
      const comp = asset.competitor_id ? compById.get(asset.competitor_id) : undefined
      const monitoredTerms = row
        ? dedupeTerms([row.inn, row.brand_name, ...(row.synonyms ?? [])].filter(Boolean) as string[])
        : []
      return {
        inn: asset.inn,
        brandName: row?.brand_name ?? null,
        // Editorial company name when the slug is known, else the manufacturer
        // string as ingested. Both are real; neither is inferred.
        company: comp?.name ?? asset.manufacturer_current ?? null,
        // indication_tags is stored permissively (every CT.gov condition term and
        // DailyMed indication term), so it repeats freely: 'HAE' alongside 'hae'.
        therapeuticAreaTags: dedupeTerms(asset.indication_tags ?? []),
        mechanism: asset.mechanism,
        indication: humaniseEnum(asset.indication_type),
        monitoredTerms,
        posture: comp?.strategicPosture ?? null,
        unmonitored: monitoredTerms.length === 0,
      }
    })
    .sort((a, b) => a.inn.localeCompare(b.inn))
}

const POSTURE_STYLE: Record<string, { bg: string; text: string }> = {
  'Incumbent to displace':    { bg: 'rgba(5,10,68,0.08)',    text: 'rgba(5,10,68,0.70)' },
  'Adjacent oral competitor': { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Emerging direct threat':   { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
}

const MAX_VISIBLE_TAGS = 5

/** Pill list, capped. Renders an explicit note when the list is empty. */
function TagCell({ tags, emptyNote }: { tags: string[]; emptyNote: string }) {
  if (tags.length === 0) {
    return (
      <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'rgba(5,10,68,0.40)' }}>
        {emptyNote}
      </span>
    )
  }
  const visible = tags.slice(0, MAX_VISIBLE_TAGS)
  const overflow = tags.length - MAX_VISIBLE_TAGS
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }} title={tags.join(', ')}>
      {visible.map(s => (
        <span key={s} style={{
          display: 'inline-block', padding: '2px 7px', borderRadius: '9999px',
          fontSize: '11px', background: 'rgba(5,10,68,0.07)', color: 'rgba(5,10,68,0.55)',
          fontWeight: 500, whiteSpace: 'nowrap',
        }}>
          {s}
        </span>
      ))}
      {overflow > 0 && (
        <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.35)', whiteSpace: 'nowrap' }}>
          +{overflow} more
        </span>
      )}
    </div>
  )
}

function PostureBadge({ posture }: { posture: string | null }) {
  // Posture is editorial positioning from competitors.json. An asset with no
  // owning competitor slug has none, and that is shown as absent rather than
  // filled in with a default that would read as a judgement we did not make.
  if (!posture) {
    return (
      <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'rgba(5,10,68,0.40)' }}>
        Not classified
      </span>
    )
  }
  const cfg = POSTURE_STYLE[posture] ?? { bg: 'rgba(5,10,68,0.06)', text: 'rgba(5,10,68,0.65)' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '9999px',
      fontSize: '11px', fontWeight: 700,
      background: cfg.bg, color: cfg.text, whiteSpace: 'nowrap',
    }}>
      {posture}
    </span>
  )
}

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <Info
        size={13}
        color="rgba(5,10,68,0.35)"
        strokeWidth={1.8}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      />
      {visible && (
        <div style={{
          position: 'absolute', left: '20px', top: '-4px', zIndex: 50,
          background: 'rgba(5,10,68,0.92)', color: '#FFFFFF',
          borderRadius: '8px', padding: '8px 12px',
          fontSize: '12px', lineHeight: '1.55',
          width: '280px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          {text}
        </div>
      )}
    </span>
  )
}

const TH = ({ children, width }: { children: React.ReactNode; width?: string }) => (
  <th style={{
    padding: '10px 14px', textAlign: 'left',
    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'rgba(5,10,68,0.45)',
    borderBottom: '1.5px solid rgba(5,10,68,0.08)',
    background: '#FAFBFD',
    width,
  }}>
    {children}
  </th>
)

const TD = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{
    padding: '14px', fontSize: '13px', color: 'rgba(5,10,68,0.75)',
    borderBottom: '1px solid rgba(5,10,68,0.06)',
    verticalAlign: 'top',
    lineHeight: '1.5',
    ...style,
  }}>
    {children}
  </td>
)

export default function AdminPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-tracked-assets'],
    queryFn: async () => {
      const [assets, lexicon] = await Promise.all([getAllAssets(), getAssetLexicon()])
      return buildTrackedAssets(assets, lexicon ?? [])
    },
  })
  const trackedAssets = data ?? []
  const unmonitoredCount = trackedAssets.filter(a => a.unmonitored).length

  function resetOnboarding() {
    localStorage.removeItem('onboardingComplete')
    localStorage.removeItem('trackedAssets')
    window.location.reload()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>

      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          Admin — CI War Room configuration
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.45)' }}>
          Prototype configuration panel. In production, this is managed by Phamax at onboarding.
        </p>
      </div>

      {/* Section 1: Tracked assets */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid rgba(5,10,68,0.08)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 4px 12px rgba(5,10,68,0.04)',
        marginBottom: '24px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(5,10,68,0.07)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'rgba(5,10,68,0.88)' }}>
            Tracked assets
          </h2>
          <Tooltip text="Read live from the asset and lexicon tables. These are the exact terms the ingest pipeline matches on: when a source item mentions an asset's INN, brand name, or any listed synonym, the item is attributed to that asset." />
          {!isLoading && !isError && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'rgba(5,10,68,0.45)' }}>
              {trackedAssets.length} {trackedAssets.length === 1 ? 'asset' : 'assets'}
              {unmonitoredCount > 0 && ` · ${unmonitoredCount} with no monitored terms`}
            </span>
          )}
        </div>

        {isLoading && (
          <p style={{ margin: 0, padding: '32px 24px', fontSize: '13px', color: 'rgba(5,10,68,0.45)' }}>
            Loading tracked assets…
          </p>
        )}

        {isError && (
          <p style={{ margin: 0, padding: '32px 24px', fontSize: '13px', color: 'rgba(5,10,68,0.55)', lineHeight: '1.6' }}>
            Could not load tracked assets from the database. The monitoring pipeline is unaffected;
            this panel is read-only. Reload to try again.
          </p>
        )}

        {!isLoading && !isError && trackedAssets.length === 0 && (
          <p style={{ margin: 0, padding: '32px 24px', fontSize: '13px', color: 'rgba(5,10,68,0.55)', lineHeight: '1.6' }}>
            No assets are configured yet. Assets are seeded during onboarding by Phamax, and
            appear here once the asset table is populated.
          </p>
        )}

        {!isLoading && !isError && trackedAssets.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr>
                <TH width="90px">Asset (INN)</TH>
                <TH width="90px">Brand name</TH>
                <TH width="80px">Company</TH>
                <TH width="130px">Therapeutic area</TH>
                <TH width="160px">Mechanism</TH>
                <TH width="120px">Indication</TH>
                <TH>Terms monitored</TH>
                <TH width="150px">Competitor posture</TH>
              </tr>
            </thead>
            <tbody>
              {trackedAssets.map(asset => (
                <tr key={asset.inn} style={{ background: '#FFFFFF' }}>
                  <TD style={{ fontWeight: 600, color: 'rgba(5,10,68,0.88)' }}>{asset.inn}</TD>
                  <TD style={{ fontStyle: asset.brandName ? 'normal' : 'italic', color: asset.brandName ? 'rgba(5,10,68,0.75)' : 'rgba(5,10,68,0.40)' }}>
                    {asset.brandName ?? 'In development'}
                  </TD>
                  <TD>{asset.company ?? UNKNOWN}</TD>
                  <TD>
                    <TagCell tags={asset.therapeuticAreaTags} emptyNote="Not tagged" />
                  </TD>
                  <TD>{asset.mechanism ?? UNKNOWN}</TD>
                  <TD>{asset.indication ?? UNKNOWN}</TD>
                  <TD>
                    <TagCell tags={asset.monitoredTerms} emptyNote="No lexicon entry — nothing is matched for this asset" />
                  </TD>
                  <TD><PostureBadge posture={asset.posture} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Section 2: Reset state */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid rgba(5,10,68,0.08)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 4px 12px rgba(5,10,68,0.04)',
        padding: '24px',
      }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'rgba(5,10,68,0.88)' }}>
          Reset onboarding state
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'rgba(5,10,68,0.50)', lineHeight: '1.6' }}>
          To replay the onboarding + guided tour as a new user, use the "Take the tour" button in the sidebar.
          This action below fully clears local state and reloads — only use it to fully reset the demo.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={resetOnboarding}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: '12px', color: 'rgba(5,10,68,0.40)', fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Reset onboarding state
          </button>
          <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.30)' }}>
            — Clears localStorage and reloads. Next visit will trigger onboarding automatically.
          </span>
        </div>
      </div>

    </div>
  )
}
