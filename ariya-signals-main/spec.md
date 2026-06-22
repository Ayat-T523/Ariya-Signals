# Ariya Signals: Prototype Spec for KalVista Demo

**Version:** 1.0 (prototype / fake data)
**Purpose:** Pitch asset for KalVista. Used to validate the "portal first, AI second" Ariya Signals concept (a Competitive Intelligence War Room) and gather structured feedback before committing to a production build.
**Audience:** Implementer (Claude Code or a developer). Read this whole document before writing code.

---

## 1. Context (read this first)

### 1.1 The product
A web app that is the single entry point for a pharma company's competitive intelligence. The user opens one competitor and instantly sees what they're doing, what matters, and what it means for us.

### 1.2 The demo scenario
- **User company:** KalVista Pharmaceuticals
- **Therapeutic area scope:** Hereditary Angioedema (HAE) only. This is a hard scope. Nothing in this prototype shows data outside HAE, even for competitors with broader portfolios.
- **Tracked competitors:** Takeda, BioCryst, Pharvaris
- **User persona:** A KalVista CI / commercial strategy lead. Assume they know HAE intimately.

### 1.3 Design principle (non-negotiable)
**Portal first, AI second.** The app must be fully usable and valuable with zero AI interaction. AI is surfaced as buttons inside the structured views, never as the primary navigation or the landing experience. If a user cannot get value without typing a question, the prototype has failed.

### 1.4 Data integrity principle
Every data point in this prototype is illustrative. The schema and structure reflect real pharma CI practice. The specific numbers, quotes, and signals are fabricated for demo purposes. The UI must include a persistent visual indicator that data is illustrative (see §8).

### 1.5 Scope limits
Out of scope for this prototype:
- Real authentication (use a hardcoded user)
- Real data APIs (all data is local JSON)
- Market access / pricing / reimbursement content (deferred to a later phase)
- Live LLM calls (AI buttons exist but show a placeholder modal)
- Backend / database (static files only)
- Mobile responsiveness beyond "doesn't break" (desktop is the primary target)

---

## 2. Tech stack

- **Framework:** React + Vite (fast dev server, simple static build)
- **Styling:** Tailwind CSS
- **Routing:** React Router
- **Charts:** Recharts (for small inline visualizations like pipeline timelines and sales trends)
- **Icons:** lucide-react
- **State:** React state + context. No Redux, no backend. Mock data imported from JSON.
- **Deployment target:** Static site (Vercel / Netlify / any static host)
- **No backend, no database, no auth library.** Hardcode the user as KalVista.

Keep dependencies minimal. If a library isn't listed above, don't add it without a reason.

---

## 3. Information architecture

### 3.1 Navigation
Left sidebar, persistent across all views. Five items in this order:

1. **My War Room** (landing / dashboard): `/`
2. **Competitors** (list of tracked competitors, each opens a profile): `/competitors`, `/competitors/:id`
3. **CI Portal** (browse by topic): `/portal`, with sub-tabs: Events, Reports & Earnings, Market Developments
4. **Alerts** (full alerts list and history): `/alerts`
5. **Ask** (AI layer landing): `/ask`

### 3.2 Persistent header elements
Across the top of every page:
- Left: Ariya Signals wordmark (use the signature gradient: see §7.3). Small "by phamax" tag below in muted text.
- Right: Bell icon (alerts count), "Ask" button (opens the Ask modal from anywhere), user avatar (static: "Kurt, KalVista")
- A thin ribbon below the header: "Illustrative data: not for clinical or commercial decisions."

### 3.3 Page-level "Ask" presence
Every major section has a "Summarize this" or "Ask about this" button inline (not only in the header). This reinforces "AI enhances structure, doesn't replace it."

---

## 4. Page specs

### 4.1 My War Room (landing)

**Purpose:** Orient the user in 5 seconds. Answer "what should I pay attention to today?"

**Layout (top to bottom):**

1. **Greeting strip**: "Good morning, Kurt. Here's what happened in HAE while you were away." Includes last-refreshed timestamp.

2. **Alerts row (3 cards visible)**: the 3 most recent/important alerts. Each card has:
    - Competitor badge (color-coded per competitor: see §7)
    - Alert type icon (trial update, publication, deal, exec move, label update)
    - One-line headline
    - Two-line "What happened" summary
    - Two-line "Why it matters for KalVista" annotation (distinct visual style: highlighted background)
    - Timestamp (relative: "2 hours ago")
    - "View full signal" link
    - Link "See all alerts" leads to `/alerts`

3. **Tracked Competitors grid (3 cards)**: Takeda, BioCryst, Pharvaris. Each card shows:
    - Competitor name and logo placeholder
    - Strategic posture label (see §6.3: "Incumbent to displace", "Adjacent oral competitor", "Emerging direct threat")
    - Count of HAE assets in development
    - Most recent activity date
    - "Activity this quarter" mini-indicator (small bar or dot cluster)
    - Click → competitor profile

4. **This Week in HAE strip**: horizontal list of 4-5 events (conference presentations, publications, label updates). Each is a small card: source, headline, date. Click → event detail modal or CI Portal.

5. **Quick asks row**: 3-4 suggested questions (buttons). When clicked, they open the Ask modal pre-filled. Examples:
    - "Summarize this week across all competitors"
    - "How does Pharvaris's phase III design compare to ours?"
    - "Which competitors are most active in Europe this quarter?"

### 4.2 Competitor Profile (the hero screen)

This is the most important screen. Spend proportional effort here.

**URL:** `/competitors/:id` (ids: `takeda`, `biocryst`, `pharvaris`)

**Layout:**

#### Header block
- Company logo placeholder + name
- Strategic posture label (same as on War Room)
- One-sentence "company-in-HAE" description (static, from data)
- "Watch / Unwatch" toggle (persistent via localStorage)
- **"Summarize for me" button** (AI: opens placeholder modal per §5)

#### Executive summary card (directly below header)
A prominent card with 3-4 sentences of plain-language context on what the competitor is doing in HAE this quarter. Static text per competitor (not AI-generated). Styled to look like an AI-generated summary (soft background, subtle "AI-generated" tag) to set expectations for where live AI will appear later.

#### Tab bar: six tabs in this order:
1. **Pipeline**
2. **Marketed Products**
3. **Activity by Country**
4. **Key Events**
5. **Strategic Signals**
6. **What It Means for Us** ← tied to KalVista portfolio context

Each tab is spec'd below.

##### Tab 1: Pipeline
- Visual: horizontal timeline / phase chart showing each HAE asset by phase (Preclinical → Phase I → Phase II → Phase III → Filed → Approved). Use Recharts or a custom SVG.
- Late-stage emphasis: Phase III and Filed columns are visually prominent (larger, bolder).
- Table below timeline: Asset name, mechanism, indication (HAE subtype: prophylaxis / on-demand / both), phase, most recent milestone, expected next milestone, ClinicalTrials.gov IDs (as text, no live links needed in prototype).
- Each row expandable to show trial design summary (primary endpoint, enrollment, design key points) and a "Compare to our asset" button (AI: placeholder).

##### Tab 2: Marketed Products
- Card per product. For each: product name, molecule, mechanism, route of administration, indication (prophylaxis / on-demand), approval year, approved geographies (flags or list).
- Small revenue trend chart (last 3-4 years, illustrative).
- "Label updates" sub-list: dated entries of label changes, each with a one-line "implication" note.
- Pharvaris has zero marketed products: show an empty state: "No marketed HAE products. Lead asset in late-stage development: see Pipeline tab."

##### Tab 3: Activity by Country
- Simple map OR a table (table is fine for prototype: simpler). Columns: Country, Product(s) available, Estimated patient share, Recent activity, Notes.
- Focus on 6-8 key HAE markets: US, Germany, France, UK, Italy, Spain, Japan, Canada.
- Visual highlight of markets where the competitor is strongest (color intensity).

##### Tab 4: Key Events
- Chronological list (most recent first) of conference presentations, publications, regulatory milestones, corporate events.
- Each entry: date, event type icon, source (e.g., "HAEi 2026 Conference", "NEJM", "FDA"), headline, 2-sentence summary, link placeholder.
- Filter chips at top: All | Conferences | Publications | Regulatory | Corporate
- 8-15 events per competitor in the mock data.

##### Tab 5: Strategic Signals
- Grouped by type, each with 2-4 illustrative entries:
    - **Deals & partnerships** (HAE-relevant only)
    - **Hiring signals**: label each entry clearly as "Illustrative: requires LinkedIn data" to set expectations for the paid version
    - **Public statements** (earnings call quotes, press releases: all fabricated, <15 words each)
    - **Observed strategy shifts**
- Each entry has a "Why this matters" one-liner.

##### Tab 6: What It Means for Us
This is the differentiator tab. It ties this competitor to KalVista's portfolio explicitly.
- Top: "Overlap with KalVista portfolio": a small matrix or card layout. KalVista assets on one axis, competitor assets on the other, with cells labeled: Direct competitor / Adjacent / No overlap.
- Middle: "Key strategic questions": 3-5 questions KalVista should be asking about this competitor, with a one-paragraph answer each. Static text.
- Bottom: "Suggested actions": 2-3 bulleted suggestions (e.g., "Monitor Pharvaris phase III readout expected Q2 2026", "Review BioCryst's real-world evidence strategy for Orladeyo").
- Each section has an "Ask for more detail" button (AI: placeholder).

### 4.3 Competitors list page
Simple grid of the three competitor cards. Same card design as the War Room grid, slightly larger. Add a disabled "+ Add competitor" card at the end with tooltip: "Available in paid version."

### 4.4 CI Portal

**URL:** `/portal`

Three sub-tabs: the doc specifies these exactly:

#### Tab 1: Events
- Calendar view (month grid) of HAE-relevant events: conferences, regulatory dates, earnings calls, PDUFA dates.
- Upcoming events list below the calendar.
- Each event: date, type, title, attending competitors (tagged), expected topics.
- 10-15 events spanning the current and next quarter.

#### Tab 2: Reports & Earnings
- List of reports: earnings call transcripts, investor day highlights, analyst reports.
- Filterable by competitor.
- Each entry: date, source, competitor tag, title, 3-sentence extract focused on HAE-relevant content only, "View details" button (placeholder).
- 8-12 entries.

#### Tab 3: Market Developments
- Chronological feed of HAE market-level developments: guideline updates, payer decisions (non-detailed: not market access), patient advocacy news, epidemiology updates.
- Each entry: date, type, headline, 2-sentence summary.
- 8-10 entries.

### 4.5 Alerts page

**URL:** `/alerts`

- Full list of alerts (20-30 entries in mock data) in reverse chronological order.
- Filters at top: All | Unread | By competitor (multi-select) | By type (trial updates, publications, deals, exec moves, label updates, other)
- Same alert card design as the War Room row, but denser.
- Mark-as-read toggle per alert (use localStorage to persist).

### 4.6 Ask

**URL:** `/ask`

Since we are button-only (no live AI), this page is:
- A large "Ask anything about your competitive landscape" input box (non-functional: on submit, shows a modal: "AI responses will be available in a future build. For this prototype, use the structured views to explore data.")
- Below: grid of ~12 example questions organized into categories (Pipeline, Commercial, Strategic, Regulatory). Clicking one also triggers the placeholder modal.
- A note at the bottom: "The Ask layer will be grounded in your tracked competitors, your portfolio, and validated data sources. It will not answer questions outside that context."

---

## 5. AI button behavior (prototype)

All AI buttons in the prototype open the same modal:

**Modal content:**
- Title: "AI response: prototype placeholder"
- Body: "In the production version, this button will generate a grounded answer using your competitor data, KalVista portfolio context, and validated sources. For this prototype, we're focused on validating the structure and data coverage."
- Single CTA button: "Got it: back to the view"

Track which button was clicked (console log or a counter in state) so feedback sessions can ask "which AI buttons did people want to click?" This is valuable signal.

Every AI button should be clearly marked with a small sparkle/star icon and a subtle color treatment to distinguish it from regular UI.

---

## 6. Data spec: mock JSON

Organize mock data into separate JSON files under `src/data/`:
- `user.json`: the KalVista user context and portfolio
- `competitors.json`: the three competitor records with their nested data
- `events.json`: events for CI Portal Events tab
- `reports.json`: reports & earnings
- `market-developments.json`: market developments
- `alerts.json`: alerts for War Room and Alerts page

### 6.1 `user.json` schema

```json
{
  "company": "KalVista Pharmaceuticals",
  "user": { "name": "Kurt", "role": "Head of Competitive Intelligence" },
  "therapeuticAreas": ["HAE"],
  "portfolio": [
    {
      "id": "sebetralstat",
      "name": "Sebetralstat",
      "mechanism": "Oral plasma kallikrein inhibitor",
      "indication": "HAE on-demand",
      "phase": "Filed",
      "positioning": "First oral on-demand treatment for HAE",
      "keyEndpoints": ["Time to symptom relief", "Time to complete resolution"]
    }
  ],
  "strategicPriorities": [
    "Establish oral on-demand as new standard of care",
    "Prepare for commercial launch in US and EU",
    "Differentiate vs injectable on-demand and oral prophylaxis"
  ]
}
```

### 6.2 `competitors.json` schema

Each competitor object:

```json
{
  "id": "takeda",
  "name": "Takeda",
  "logo": "takeda.svg",
  "colorToken": "competitor-takeda",
  "strategicPosture": "Incumbent to displace",
  "oneLineDescription": "Dominant HAE franchise built on Takhzyro (SC prophylaxis); legacy portfolio from Shire acquisition.",
  "executiveSummary": "Takeda continues to defend Takhzyro's leading share in HAE prophylaxis while facing erosion from oral alternatives. Recent focus on pediatric indications and real-world evidence generation suggests a defensive lifecycle strategy. No visible moves into oral on-demand, leaving KalVista's lane uncontested for now.",

  "pipeline": [
    {
      "assetId": "TAK-XXX",
      "name": "TAK-XXX (illustrative)",
      "mechanism": "Next-gen anti-pKal mAb",
      "indicationSubtype": "HAE prophylaxis",
      "phase": "Phase II",
      "latestMilestone": "Phase II enrollment ongoing",
      "nextMilestone": "Interim readout expected Q4 2026",
      "trialIds": ["NCT0XXXXXXX"],
      "trialDesignSummary": "Randomized, double-blind, placebo-controlled. Primary endpoint: monthly HAE attack rate over 26 weeks. ~80 patients. Adults and adolescents."
    }
  ],

  "marketedProducts": [
    {
      "name": "Takhzyro",
      "molecule": "Lanadelumab",
      "mechanism": "Anti-pKal monoclonal antibody",
      "route": "SC",
      "indication": "HAE prophylaxis",
      "approvalYear": 2018,
      "geographies": ["US", "EU", "Japan", "Canada"],
      "revenueTrend": [
        { "year": 2022, "revenue": 980 },
        { "year": 2023, "revenue": 1110 },
        { "year": 2024, "revenue": 1180 },
        { "year": 2025, "revenue": 1210 }
      ],
      "labelUpdates": [
        { "date": "2023-02-15", "change": "Pediatric indication expansion (ages 2-11)", "implication": "Extends patient reach; complicates KalVista pediatric strategy." }
      ]
    }
  ],

  "activityByCountry": [
    {
      "country": "US",
      "products": ["Takhzyro", "Firazyr"],
      "estimatedPatientShare": "~55% of prophylaxis market (illustrative)",
      "recentActivity": "Expanded MSL team in Q3 2025; launched new patient support program.",
      "strength": "high"
    }
  ],

  "keyEvents": [
    {
      "date": "2026-03-14",
      "type": "publication",
      "source": "Journal of Allergy and Clinical Immunology",
      "headline": "Long-term safety of lanadelumab in pediatric HAE: 3-year open-label extension",
      "summary": "Authors report sustained efficacy and favorable safety profile in pediatric patients through 156 weeks. Supports pediatric label and long-term adherence narrative."
    }
  ],

  "strategicSignals": {
    "deals": [
      { "date": "2025-11-08", "headline": "Takeda extends HAEi patient advocacy partnership", "whyItMatters": "Reinforces patient community ties ahead of competitive oral launches." }
    ],
    "hiring": [
      { "date": "2026-01-20", "headline": "New VP, Rare Immunology Commercial hired from Sanofi (illustrative)", "whyItMatters": "Signals commercial reinforcement; watch for launch-readiness moves.", "dataSourceNote": "Illustrative: requires LinkedIn data" }
    ],
    "publicStatements": [
      { "date": "2026-02-10", "source": "Q4 2025 earnings call", "quote": "HAE remains a cornerstone franchise.", "whyItMatters": "Continued strategic commitment; no signal of portfolio exit." }
    ],
    "strategyShifts": [
      { "date": "2026-01-15", "observation": "Increased investment in real-world evidence generation for Takhzyro.", "whyItMatters": "Defensive move: building switching barriers against oral alternatives." }
    ]
  },

  "whatItMeansForUs": {
    "overlap": [
      { "ourAsset": "Sebetralstat", "theirAsset": "Takhzyro", "relationship": "Adjacent", "note": "Different modality (oral on-demand vs SC prophylaxis), but competes for same patient budget." }
    ],
    "keyQuestions": [
      {
        "question": "Will Takeda develop an oral on-demand asset?",
        "answer": "No visible program to date. Their pipeline investment has concentrated on prophylaxis mAbs. This supports KalVista's first-mover advantage in oral on-demand: at least 3-4 years of runway before a Takeda entrant would be credible."
      }
    ],
    "suggestedActions": [
      "Monitor Takeda's real-world evidence publications for positioning claims that could blunt oral narrative.",
      "Track MSL activity in key US and EU accounts where Takhzyro dominates."
    ]
  }
}
```

Populate all three competitors (Takeda, BioCryst, Pharvaris) following this schema. Use these as seeds:

**Takeda**: see above. Incumbent. 1 marketed product featured (Takhzyro), optionally mention Firazyr briefly. 1-2 pipeline assets. Strategic posture: "Incumbent to displace."

**BioCryst**: marketed product: Orladeyo (berotralstat): oral prophylaxis, approved 2020, ~$400M revenue trajectory (illustrative). 1 pipeline asset (e.g., pediatric or extended-release formulation: illustrative). Strategic posture: "Adjacent oral competitor." Executive summary theme: proving the oral modality works in HAE: validates KalVista's oral thesis, but competes for oral-preferring patients once they're on prophylaxis.

**Pharvaris**: no marketed products. Pipeline: deucrictibant: oral B2 receptor antagonist: two programs: on-demand (Phase III, direct competitor to sebetralstat) and prophylaxis (Phase II). Strategic posture: "Emerging direct threat." Executive summary theme: the most direct future competitor to KalVista's lead asset. Key readouts expected in 2026.

### 6.3 Strategic postures
Use exactly these three labels (they map to the three competitors):
- `"Incumbent to displace"`: Takeda
- `"Adjacent oral competitor"`: BioCryst
- `"Emerging direct threat"`: Pharvaris

### 6.4 `alerts.json` schema

```json
[
  {
    "id": "alert-001",
    "timestamp": "2026-04-20T08:15:00Z",
    "competitorId": "pharvaris",
    "type": "trial-update",
    "severity": "high",
    "headline": "Pharvaris updates deucrictibant Phase III on-demand trial completion date",
    "whatHappened": "Pharvaris revised the RAPIDe-3 trial primary completion date from Q3 2026 to Q1 2026 on ClinicalTrials.gov (illustrative).",
    "whyItMatters": "Accelerated timeline could shorten KalVista's first-to-market window for oral on-demand. Worth confirming via IR channels.",
    "read": false
  }
]
```

Generate 20-30 alerts across competitors, types, and severities. Types: `trial-update`, `publication`, `deal`, `exec-move`, `label-update`, `regulatory`, `earnings`. Severities: `high`, `medium`, `low` (affects visual treatment).

### 6.5 `events.json`, `reports.json`, `market-developments.json`
Follow the structures described in §4.4. Keep each entry realistic to HAE: conferences like HAEi Global Conference, ACAAI, AAAAI; journals like JACI, NEJM, Allergy; regulatory bodies FDA, EMA, PMDA. All specific content illustrative.

---

## 7. Visual design: Ariya Signals brand system

### 7.1 Brand intent
Ariya Signals should feel like a premium pharma intelligence product: calm, clinical, and confident. Prioritize clarity, hierarchy, and whitespace over decoration. Visual tone: Ariya landing page (navy + vibrant blue + lavender panels), not a generic "analytics dashboard".

**Do:** calm palette, restrained accents, consistent rhythm, editorial spacing.
**Don't:** neon colors, heavy charts everywhere, thick borders, gradients on everything, "crypto dashboard" vibes.

### 7.2 Color system

**Core brand**

| Token | Hex | Use |
|---|---|---|
| Navy | `#050A44` | Primary ink, sidebar, strong text |
| Blue | `#0055BB` | Primary action, highlights, links |
| Bright Blue | `#1A6BFF` | Gradient top, accent |
| Lavender Surface | `#E8EAF6` | Soft panels, chips |
| Canvas | `#F7F8FC` | App background |
| White | `#FFFFFF` | Card surface |
| Phamax Red | `#D92B2B` | Rare, tiny accent only |

**Text (navy at opacity)**
- Primary text: `rgba(5,10,68,0.92)`
- Secondary text: `rgba(5,10,68,0.70)`
- Muted text: `rgba(5,10,68,0.50)`
- Hairline border (light): `rgba(5,10,68,0.10)`
- Hairline border (extra light): `rgba(5,10,68,0.06)`

**Status colors (use sparingly; avoid BI rainbow)**
- Positive / delta up: **Blue** (not green) in this product context
- Warning: `#F59E0B` (amber)
- Risk: `#E11D48` (rose)

**Mapping to product-specific needs**

| Purpose | Treatment |
|---|---|
| Competitor differentiation | Do NOT assign distinct brand colors to competitors. Use a small monochrome initial-badge or neutral tag with the competitor name. Differentiation comes from structure and content, not color coding. |
| KalVista ("ours") references | Blue (`#0055BB`) tint on a lavender panel. Never uses a unique brand color; "ours" is always shown via the Ariya system, not in a separate palette. |
| AI markers (sparkle icon, AI-touched surfaces) | Blue icon, optional faint lavender wash on the surface. No violet / purple accent; stay in-brand. |
| Alert severity | High: rose `#E11D48` left-border + small rose badge. Medium: amber `#F59E0B` left-border + small amber badge. Low: hairline border, no color. |
| "What it means for us" sections | Lavender-surface card (`#E8EAF6`). This is the signature "insight / brief" treatment. |

### 7.3 Gradients and effects

**Signature headline gradient (Ariya-style)**
Used on the wordmark and on 1 to 2 hero-level page titles (e.g., the Competitor Profile name, the War Room greeting headline). Never on body text or cards.
```
background: linear-gradient(180deg, #1A6BFF 0%, #050A44 88%);
-webkit-background-clip: text;
background-clip: text;
color: transparent;
```

**Sidebar background (if used as a filled sidebar)**
```
background: linear-gradient(180deg, #050A44 0%, #070F52 55%, #050A44 100%);
```
Optional soft radial-blue glow wash at the top-left corner for dimension.

**Canvas background washes**
Apply 1 or 2 very-low-opacity fixed radial gradients (blue / lavender) behind the canvas so it doesn't feel flat. No patterns. No noise. No textures.

### 7.4 Typography

**Font:** Inter (weights 400 / 500 / 600 / 700). Do not mix font families.

**Scale**

| Role | Size | Weight | Notes |
|---|---|---|---|
| Page title | 24 to 32px | 600 | Tight tracking. Reserve for page H1. |
| Section title | 16 to 18px | 600 | Card headers, tab headings. |
| Card label / eyebrow | 11px | 600 | Uppercase, tracking `0.16 to 0.20em`. Sits above KPIs and section titles. |
| Body | 14 to 15px | 400 to 500 | Relaxed line-height (~1.55). |
| Microcopy | 12 to 13px | 400 | Muted text color. Timestamps, captions, source labels. |

**Hierarchy rule:** default text sits at reduced-opacity navy. Reserve full-opacity navy for titles and key numeric values only. This creates hierarchy without adding colors.

**Numbers:** use `tabular-nums` for all tables, KPIs, and revenue trends.

### 7.5 Layout and spacing

**Grid philosophy**
Content-first. A user should be able to scan any screen in 2 to 3 minutes and walk away with the gist.

Prefer a two-band "At a glance" pattern for summary screens (War Room, Competitor Profile header area):
- **Row 1:** compact numeric KPIs, uniform height
- **Row 2:** narrative readouts with clamped copy and consistent card height

**Spacing**
- Card padding: 16 to 24px (use 20px as default)
- Section spacing: 28 to 40px vertical between major blocks
- Prefer generous whitespace over density. This is not Bloomberg Terminal; it's calmer.

**Sidebar**
- ~240px wide, fixed, navy-gradient background per §7.3
- Navigation items: white text at 70% opacity by default, 100% when active, with a 3px bright-blue left indicator on active
- Ariya Signals wordmark at top using the signature gradient. On a navy background the text-clip gradient won't render correctly, so use an SVG wordmark with the gradient baked in.
- Small "by phamax" mark at the bottom in muted white

### 7.6 Components

**Cards**
- Corner radius: 18 to 24px (use 20px as default)
- Border: 1px hairline `rgba(5,10,68,0.10)` (light) or `rgba(5,10,68,0.06)` (extra light) depending on nesting
- Shadow: very subtle and soft. Never dark drop shadows. Use something like `box-shadow: 0 1px 2px rgba(5,10,68,0.04), 0 8px 24px rgba(5,10,68,0.04);`
- Surfaces:
  - **Default card:** white surface
  - **Lavender card:** `#E8EAF6`, reserved for "brief / insight" moments: executive summaries, "What it means for us", AI-generated blocks, alert "why it matters" annotations

**Pills and chips**
- Fully rounded (`border-radius: 9999px`)
- Background: lavender or blue at ~10% opacity
- Text: navy or blue, weight 600
- Examples: phase labels (Phase II, Phase III), indication tags (Prophylaxis, On-demand)

**Buttons**
- **Primary:** navy pill, white text. Hover: lift 1px, slightly deepen shadow.
- **Secondary:** white background, hairline border, navy text.
- **AI buttons:** secondary style with a small blue sparkle icon on the left. Subtle lavender background tint optional.

**Tags**
- Small rounded pills, quiet, not colorful
- Therapy-area tags can use blue tint; geo / topic tags use neutral tint
- Never more than 2 chromatic tag styles on screen at once

**Importance / severity treatment**
- Subtle left-border accent (3px): amber for warning, rose for risk, hairline for neutral
- Small badge at top-right of the card
- Avoid loud fills. The card stays white or lavender; only the accents signal importance

**Empty states**
Every table, list, and tab has a designed empty state: centered message, muted text, optionally a small line icon. Never show a blank area.

### 7.7 Interaction and motion

- Hover: `transform: translateY(-1px)`, slightly stronger shadow, subtle border darkening
- Transitions: fast (150 to 200ms) and restrained
- No bouncy easing, no decorative animation, no parallax
- Emphasize predictability and calm

### 7.8 Content tone (critical; this is part of the brand)

The product's voice must match its visual language.

- Intelligence writing should be **specific and analyst-like**, not marketing.
- "Why it matters" reads like a **strategic implication**, not a summary.
- Avoid hype words: *game-changing, disruptive, revolutionary, unprecedented*. Replace with specific observations.
- Avoid hedging filler: *interestingly, notably, it's worth mentioning*. Get to the point.

Examples:

| Don't | Do |
|---|---|
| "Takeda is making major moves in HAE!" | "Takeda is defending Takhzyro share through real-world evidence generation and pediatric label extension." |
| "Pharvaris is a disruptor to watch." | "Pharvaris is the most direct future competitor to sebetralstat; RAPIDe-3 readout in 2026 is the key datapoint." |
| "This could impact our strategy." | "This shortens our first-to-market window by roughly two quarters." |

### 7.9 Illustrative data indicator

Three layers of labeling (preserved from v1.0):
1. Persistent ribbon under the header: "Illustrative data: not for clinical or commercial decisions." Ribbon is lavender-surface with muted navy text. Quiet, not alarming.
2. Any data point synthesized from non-existent sources (hiring, specific revenue) gets an inline `(illustrative)` marker in muted text.
3. Footer "About this prototype" modal as described in §1.4.

### 7.10 Page-by-page layout notes (applying the brand to each screen)

**My War Room**
- Hero greeting headline uses the signature gradient. One line, large.
- Below: "At a glance" two-band row; 3 to 4 compact KPI cards (e.g., "Alerts this week: 7", "Trials updated: 3", "Competitors active: 3"), then a row of 3 narrative readout cards (one per competitor, clamped text, equal height).
- Alerts section uses white cards with rose / amber left borders per severity. "Why it matters" lines sit on lavender strips inside each alert card.
- "This Week in HAE" is a quiet horizontal strip of small white cards. No images, just source, date, headline.

**Competitor Profile**
- Header: competitor name in signature gradient, strategic posture as a lavender pill beneath.
- Executive summary: lavender-surface card immediately below header. This is the signature "brief" treatment.
- Tab bar: navy underline for active tab, muted text for inactive. No background fills.
- Each tab's content uses white cards on canvas background.
- "What It Means for Us" tab goes heavier on lavender cards. This tab is where the "insight" tone is strongest.

**CI Portal**
- Calendar view: navy headers, white cells, events as small lavender pills with navy text. Don't color-code events by type; use small icons instead.
- Reports / Earnings / Market Developments lists: white cards with hairline dividers, muted source labels above bold headlines.

**Alerts**
- Full-width list. Each alert is a white card with severity border-left. Unread alerts have a 2px brighter hairline; no color difference otherwise.

**Ask page**
- Centered layout on canvas. Large input box with hairline border and soft lavender wash inside on focus.
- Example questions below in a 2- or 3-column grid of white chips, grouped by category with small eyebrow labels.

---

## 8. Interactions and polish

- Navigation between competitor tabs should preserve scroll position within the tab.
- Watch/unwatch toggles persist via localStorage, keyed by `kalvista-ciwarroom-watch-{competitorId}`.
- Alert read state persists via localStorage.
- All dates displayed relative when recent ("2 hours ago", "3 days ago"), absolute when older.
- Keyboard: `/` focuses the top "Ask" button; `Esc` closes modals.
- Loading states: not needed (all data is local, instant).

---

## 9. Build order (recommended for implementation)

1. Project setup: Vite + React + Tailwind + Router. Confirm static build works.
2. Layout shell: sidebar, header, ribbon, routing.
3. Mock data: create all JSON files populated with the content per §6.
4. Competitor Profile page: build this first and completely. It's the hero.
5. My War Room landing.
6. Alerts page.
7. CI Portal (three tabs).
8. Ask page.
9. AI placeholder modal (shared component).
10. Polish pass: empty states, color system refinement, keyboard shortcuts, localStorage persistence.

---

## 10. Deliverable

A working React app deployable as a static site. README should include:
- What this is (one paragraph)
- How to run locally (`npm install && npm run dev`)
- How to build for deployment (`npm run build`)
- A clear note: "Prototype with illustrative data. Do not use for real CI decisions."

---

## 11. Explicit non-goals (repeated for emphasis)

This prototype does NOT include:
- Real authentication
- Real data from ClinicalTrials.gov, FDA, GlobalData, or any other source
- Live LLM responses
- Market access, pricing, or reimbursement data
- Mobile-optimized layouts
- Account management, user roles, or permissions
- Real-time updates
- Data export
- Admin interfaces

These are all deferred to the production build, which will follow after KalVista feedback.
