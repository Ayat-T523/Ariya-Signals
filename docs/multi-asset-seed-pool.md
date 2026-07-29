# Multi-Asset Seed Pool — Ariya Signals

**Date:** 27 July 2026
**Purpose:** The starter set of assets/indications to seed Ariya's multi-asset pool, chosen for
data richness in the sources Ariya ingests, and phased to prove the multi-asset mechanism cheaply
before expanding into new domains. Companion: `docs/ingestion-model.md` (how data gets fetched).
**Scope note:** Bavarian Nordic (vaccines) is **held** — its signal model (outbreak epidemiology,
ACIP/WHO recommendations, procurement) differs from the therapeutic pattern and needs new sources.
See §5.

---

## 1. What "rich" means here (selection criteria)

An indication earns a slot by being dense in what Ariya already pulls: many **public-company**
competitors (SEC 8-K/financials), lots of **late-stage trials** (ClinicalTrials.gov), frequent
**regulatory catalysts / PDUFA dates** (the events feed), and recent/imminent **launches** (the
competitive dynamics the War Room is built around). Every pick below has a clean
launcher-vs-incumbents-vs-emerging-threats structure — the same shape as Ekterly in HAE.

## 2. Phasing (chosen)

- **Phase 1 — prove the mechanism, cheap adjacent cluster.** HAE (built) + PNH + IgA nephropathy.
  All immunology/complement/renal — they **reuse the existing HAE ingestion sources and lexicon**,
  so per-asset cost is low and the multi-asset plumbing (`company_signal_asset_actions`, per-asset
  synthesis) gets proven on data that's cheap to gather.
- **Phase 2 — the client domains.** Cushing's syndrome (Recordati) + Atopic dermatitis (Galderma).
  Moderate lift: new endocrine / dermatology lexicons and competitor universes.
- **Phase 3 — breadth & stress test.** Obesity/GLP-1 (+ next wave: MASH, Myasthenia gravis).
  New metabolic-domain sourcing; obesity's 15+ competitor field deliberately stress-tests the
  War Room's 6-slot worklist and the competitor grid.
- **Held.** Bavarian Nordic / vaccines — different signal model (§5).

Rationale: three of your confirmed accounts (KalVista, plus PNH/IgAN which sit next to KalVista's
own class) share sources; the other two accounts (Recordati, Galderma) and the breadth picks are
deliberate domain investments. Do the cheap, mechanism-proving cluster first.

---

## 3. The pool (per indication)

Company IDs in `suggestedCompetitors` must exist in the competitor registry (`competitors.json`);
new ones are flagged **(add to registry)**. INNs/brands verified against 2026 sources (§6).

### Phase 1

**HAE — Hereditary angioedema** *(built; the template)*
Home asset: **Ekterly** (sebetralstat, KalVista). Competitors: Takeda (Takhzyro, Firazyr), BioCryst
(Orladeyo), CSL Behring (Andembry/garadacimab), Pharvaris (deucrictibant), Ionis/Otsuka
(donidalorsen), Astria (navenibart), Intellia (gene editing). 2026 catalysts: KalVista pediatric
NDA (Q3 2026), CSL garadacimab launch, donidalorsen approval.

**PNH — Paroxysmal nocturnal haemoglobinuria** *(config lexicon already real; replace fictional
"Zevaro" brand, add data)*
Home asset (pick a real POV): **Fabhalta** (iptacopan, Novartis) — or configure per-competitor.
Competitors: **AstraZeneca/Alexion** (Ultomiris/ravulizumab, Soliris/eculizumab, Voydeya/danicopan),
**Apellis/Sobi** (Empaveli/pegcetacoplan), **Roche** (PiaSky/crovalimab). 2026 catalysts: Fabhalta
uptake, crovalimab launch, danicopan add-on expansion. Sources: reuses HAE complement lexicon.
*Registry: add novartis, astrazeneca (or alexion), apellis, roche.*

**IgAN — IgA nephropathy** *(new; most catalyst-dense pick)*
Home asset (pick a POV): **Filspari** (sparsentan, Travere) or a challenger. Competitors: **Vera**
(atacicept — PDUFA Jul 7 2026), **Vertex** (povetacicept — PDUFA Nov 30 2026), **Otsuka**
(sibeprenlimab — approved 2025), **Novartis** (Vanrafia/atrasentan, Fabhalta/iptacopan in IgAN),
**Calliditas/Everest** (Tarpeyo·Nefecon/budesonide). 2026 catalysts: two PDUFAs (Jul 7, Nov 30),
multiple launches — the events feed lights up. *Registry: add travere, vera, vertex, otsuka,
calliditas, novartis.*

### Phase 2 (client domains)

**Cushing's syndrome — rare endocrinology** *(Recordati)*
Home asset: **Isturisa** (osilodrostat, Recordati); also Signifor (pasireotide). Competitors:
**Corcept** (Korlym/mifepristone, relacorilant), **Xeris** (Recorlev/levoketoconazole). 2026
catalysts: Corcept relacorilant FDA decision, Isturisa label expansion (overt + non-overt Cushing's).
Clean launcher-vs-Corcept rivalry; Corcept is public → steady SEC/trial signal.
*Registry: add recordati, corcept, xeris. New endocrine lexicon needed.*

**Atopic dermatitis — immuno-dermatology** *(Galderma; the richest of the accounts)*
Home asset: **Nemluvio** (nemolizumab, Galderma). Competitors: **Sanofi/Regeneron** (Dupixent),
**AbbVie** (Rinvoq), **Pfizer** (Cibinqo), **Lilly** (Ebglyss/lebrikizumab), **Leo Pharma**
(Adbry/tralokinumab, Anzupgo/delgocitinib), **Incyte** (Opzelura). 2026 catalysts: Nemluvio
pediatric AD data, continual competitor label expansions. Crowded/blockbuster — great demo, long
competitor list. *Registry: add galderma, sanofi, regeneron, abbvie, pfizer, eli-lilly, leo-pharma,
incyte. New derm lexicon.*

### Phase 3 (breadth & stress)

**Obesity / GLP-1 — metabolic** *(richest arena in pharma; stress test)*
Home asset (pick a POV): **Zepbound** (tirzepatide, Lilly) or **Wegovy** (semaglutide, Novo).
Competitors: Lilly (retatrutide, orforglipron), Novo (oral Wegovy, amycretin, CagriSema), **Amgen**
(MariTide), **Structure** (aleniglipron), **Viking** (VK2735), **Roche**, AstraZeneca, Pfizer. 2026
catalysts: Lilly Triumph readouts, retatrutide Ph3, orforglipron filings, Novo amycretin Ph3.
15+ competitors — deliberately pressure-tests the worklist. *Registry: add eli-lilly, novo-nordisk,
amgen, structure, viking. New metabolic lexicon.*

**Next wave** *(list only; add after the mechanism scales)*
- **MASH** — Madrigal (Rezdiffra/resmetirom), Novo (semaglutide), Akero (efruxifermin), 89bio,
  Inventiva (lanifibranor — NATiV3 readout H2 2026). Launch + race dynamics.
- **Myasthenia gravis** — argenx (Vyvgart — all-serotype label May 2026), UCB (Rystiggo, Zilbrysq),
  AstraZeneca/Alexion (Ultomiris), J&J (Imaavy/nipocalimab), Regeneron (cemdisiran — Ph3 Apr 2026),
  Amgen (Uplizna). Immunology adjacency to HAE.

---

## 4. Draft `assets-config.ts` entries

Matched to the real `AssetConfig` shape. Replace the fictional `zevaro`/`chelira` brands; keep their
already-real lexicons. Competitor-POV entries can be cloned per the existing HAE pattern (one entry
per trackable asset, excluding its own company from `suggestedCompetitors`).

```ts
// PNH — real brand over the existing real lexicon (was "Zevaro")
{
  id: 'fabhalta',
  brandName: 'Fabhalta',
  innName: 'iptacopan',
  indication: 'PNH',
  indicationFull: 'Paroxysmal Nocturnal Haemoglobinuria',
  suggestedCompetitors: ['astrazeneca', 'apellis', 'roche'],   // add to registry
  lexiconInns: ['iptacopan','fabhalta','pegcetacoplan','empaveli','ravulizumab','ultomiris',
    'eculizumab','soliris','crovalimab','piasky','danicopan','voydeya'],
  lexiconTaTerms: ['pnh','paroxysmal nocturnal haemoglobinuria','complement','factor b','factor d',
    'c3','c5','haemolysis','hemolysis','complement inhibitor'],
},
// IgA nephropathy — new
{
  id: 'filspari',
  brandName: 'Filspari',
  innName: 'sparsentan',
  indication: 'IgAN',
  indicationFull: 'IgA Nephropathy',
  suggestedCompetitors: ['vera','vertex','otsuka','novartis','calliditas'],   // add to registry
  lexiconInns: ['sparsentan','filspari','atacicept','povetacicept','sibeprenlimab','atrasentan',
    'vanrafia','iptacopan','fabhalta','budesonide','nefecon','tarpeyo'],
  lexiconTaTerms: ['iga nephropathy','igan','proteinuria','upcr','april','baff','endothelin',
    'complement','glomerular','nephrology'],
},
// Cushing's — Recordati (Phase 2)
{
  id: 'isturisa',
  brandName: 'Isturisa',
  innName: 'osilodrostat',
  indication: 'CS',
  indicationFull: "Cushing's Syndrome",
  suggestedCompetitors: ['corcept','xeris'],   // add to registry
  lexiconInns: ['osilodrostat','isturisa','pasireotide','signifor','mifepristone','korlym',
    'relacorilant','levoketoconazole','recorlev','metyrapone','ketoconazole'],
  lexiconTaTerms: ["cushing's syndrome","cushing","hypercortisolism","cortisol","acth","adrenal",
    "11-beta-hydroxylase","glucocorticoid receptor"],
},
// Atopic dermatitis — Galderma (Phase 2)
{
  id: 'nemluvio',
  brandName: 'Nemluvio',
  innName: 'nemolizumab',
  indication: 'AD',
  indicationFull: 'Atopic Dermatitis',
  suggestedCompetitors: ['sanofi','abbvie','pfizer','eli-lilly','leo-pharma','incyte'],  // add to registry
  lexiconInns: ['nemolizumab','nemluvio','dupilumab','dupixent','upadacitinib','rinvoq',
    'abrocitinib','cibinqo','lebrikizumab','ebglyss','tralokinumab','adbry','delgocitinib',
    'anzupgo','ruxolitinib','opzelura'],
  lexiconTaTerms: ['atopic dermatitis','eczema','pruritus','il-31','il-13','il-4','jak',
    'prurigo nodularis','type 2 inflammation','dermatology'],
},
```

**Registry follow-up:** each new `suggestedCompetitors` id needs a company entry (name, logo,
strategic posture) wherever the existing `takeda`/`biocryst`/etc. companies are defined
(`src/data/competitors.json` and the Supabase companies source). No signal data exists for any of
these yet — that's the ingestion job (`docs/ingestion-model.md`).

---

## 5. Held: Bavarian Nordic (vaccines)

BN = Bavarian Nordic — a vaccines company (Vimkunya/chikungunya, MVA-BN mpox/smallpox, Travel Health;
RSV discontinued 2025). Held because vaccine CI runs on **outbreak epidemiology, government
procurement contracts, and public-health recommendations (CDC/ACIP, WHO)** — dimensions Ariya's
current sources (CTgov/SEC/FDA labels/PubMed) don't capture. Competitor universe is also distinct
(GSK, Pfizer, Sanofi, Moderna, Valneva, Emergent). Revisit once the therapeutic model is proven and
there's appetite to add ACIP/WHO/procurement sources — it's the deliberate test of whether Ariya
generalizes past therapeutics.

---

## 6. Sources
- HAE / KalVista: KalVista IR (KONFIDENT-KID, pediatric NDA Q3 2026).
- IgAN: DelveInsight IgAN landscape; Vertex (povetacicept PDUFA Nov 30 2026); AJMC (atacicept); Vera 8-K (atacicept PDUFA Jul 7 2026).
- MASH: BioSpace MASH pipelines; Madrigal FY2025 results.
- Myasthenia gravis: FiercePharma (argenx/UCB); DelveInsight FcRn.
- Obesity: Drug Discovery News GLP-1 2026; Endpoints obesity hub; PharmaVoice.
- Recordati / Cushing's: Recordati Q1 2026 results; Recordati Rare Diseases.
- Galderma / AD: Galderma Nemluvio FDA approval; AAD 2026.
(Full URLs in the chat thread that produced this doc.)
