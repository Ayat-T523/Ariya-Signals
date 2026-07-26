# InForm (working title) — Product System Map

**Medical Affairs AI Platform · Three-Component System · April 2026**

---

## What the Product Is

A medical affairs AI platform that unifies three distinct capabilities — active research intelligence, structured content creation, and passive market monitoring — into a single product for pharmaceutical and healthcare organisations.

Primary users: medical affairs teams, medical writers, marketers, communications professionals, brand managers, MLR reviewers.

The product's central promise: users should feel genuinely helped and enjoy using it, while everything it produces is compliant, evidence-backed, and brand-correct.

---

## The Three Components

Navigation is by component. Users may use one, two, or all three depending on their role.

---

### Component 1: Chat
**The primary entry point. The connective tissue of the entire product.**

Users come to chat. No setup required to start — the chat works immediately with a default context. Everything else in the product can be initiated from, or surfaced within, the chat interface.

**What it does:**
- Natural language queries answered with cited, synthesised responses
- Source selection is an optional, contextual feature — users can pin specific internal or external sources at any point mid-conversation, not as a prerequisite. Without source selection, the AI reasons from a default context.
- The **citation panel** is a dedicated transparency layer that lives alongside the chat. It exposes the full evidence trail behind every response — source documents, citation depth, document previews, individual document summarisation. This is not a simple footnote system; it is an extensive feature set in its own right.
- Document generation lives within chat: users can request PPT, Word documents, briefs, communication materials, flyers, emails directly from a conversation. The AI uses the conversation context as the content brief.
- Conversation history is persistent and accessible.

**Collections — optional initiative-level workspaces within Chat:**
Collections are named workspaces that group related conversations, artifacts, and sources under a shared initiative context (e.g. "EU GERD Submission 2026", "Advisory Board Dec 2026"). They are entirely optional — independent conversations coexist in the sidebar under Recent with no pressure to use Collections.

Each Collection has three tabs:
- **Conversations** — the full chat history for this Collection
- **Artifacts** — a read-only filtered view of Content assets generated from this Collection's conversations (not a separate store — reads from Content using `collection_id` metadata)
- **Sources** — the document set configured for this Collection

Collections carry a source mode: **Restrict** (AI answers only from Collection documents) or **Prioritise** (AI weights Collection documents but draws from the full library). Set at Collection level, overridable per conversation.

Created with name only. Description, team members, instructions, and document set are all optional and addable after creation.

**Source types available in-conversation:**
- Internal: document collections, dashboards, CRM data
- External: PubMed, ClinicalTrials.gov, web sources

**As the connective tissue:**
- Dashboard alerts surface here as prompts: *"Competitive activity detected for [Product] — want to investigate?"*
- Content creation is initiated here: *"Turn this summary into a flyer"* opens the content creation flow
- The chat is where users land and where most daily work happens
- All Chat-generated assets land in Content unconditionally. `collection_id` metadata (present when generated inside a Collection, absent otherwise) powers the Artifacts tab filter. Content is the single source of truth — Chat surfaces asset status only.

**Navigation and screen structure:**
- Top bar: logo (left) · primary nav centred (Chat · Content · Insights · Library) · search + avatar (right)
- Sidebar: contextual to the active section. In Chat: Collections list + Recent conversations. Bottom dock: Help · Settings ⚙ · Notifications 🔔 · Profile avatar
- Settings panel (⚙): Preferences (language, display density, response format) · AI Memory · Role · Notifications configuration
- Notifications panel (🔔): Insights Hub alerts, asset expiry warnings, review stage updates, upload complete, team activity

---

### Component 2: Content
**A dedicated workspace for structured, governed content creation.**

Separate from chat, with its own workflow. For users who need to produce brand-compliant, MLR-ready communication assets at scale.

**Workflow:**
1. **Brand Guidelines** — Define the visual and verbal identity: logo variants, colour palette (hex values), full typographic hierarchy (not just heading/body — H1, H2, Body, Caption, CTA), brand imagery. Brand guidelines go through their own approval lifecycle before being applied.
2. **Templates** — Build structural templates using the canvas editor. Templates incorporate brand settings, merge tags (personalisation variables for sender, recipient, dynamic content), and AI-generated variable fields. Templates go through approval rounds.
3. **Approval Rounds** — All assets (and brand guidelines, and templates) follow the lifecycle: Draft → In Review → Approved → Returned. "Rejected" is not the right term for the regulated medical affairs context — content is returned for revision, not rejected outright. MLR reviewers have their own experience within this flow.
4. **Prompt-Driven Design** — Once a template and brand are approved, users generate assets by prompting against the template framework. The same template serves multiple use cases and markets through the merge tag personalisation system.

**Asset types:** Marketing email, follow-up email, press release, flyer, sales collateral, engagement email, PPT decks, Word documents — any communication format.

**Export is gated to Approved assets only.** This is a system-enforced compliance rule, not a UI convention. Formats: ZIP (OCE/Veeva), HTML, PDF.

**Receives output from Chat:** A document or brief generated in the chat can move into the Content workspace as a starting point.

---

### Component 3: Insights Dashboard (The Lighthouse)
**A passive, agent-driven intelligence layer. The product watches so the user doesn't have to.**

Users define what they want monitored. The agents do the ongoing work.

**Setup (one time):**
Users define their monitoring scope — products, competitors, therapeutic areas, regulatory topics, market landscape dimensions, specific sources or publications to track.

**What agents do continuously:**
- Scan the web and pre-defined sources for new information matching the defined scope
- Update data and surface new findings automatically
- Generate visualisations from the updated data
- Send alerts when something significant changes — competitive activity, new clinical data, regulatory updates, market shifts

**What the user sees:**
- An always-updated intelligence dashboard with AI-generated insights, not just raw data
- Visualisations that are generated and updated by the agents, not manually built
- Alerts that surface new developments worth attention

**How it connects to Chat:**
Alerts and new insights surface in the chat interface as prompts — they don't require the user to go to the Dashboard to notice them. The Dashboard space exists for deep monitoring work and reviewing the full intelligence picture. The daily touchpoint is still the chat.

---

## The Unification Model

**Chat is the connective tissue. Option B.**

The three components do not require sequential use and are not stages in a journey. They serve different user needs and different user roles. What unifies them is the chat interface acting as the daily surface where the other two components surface their output.

```
┌─────────────────────────────────────────────────────────┐
│                        CHAT                              │
│  (primary interface — where users spend most time)       │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐  ┌──────────────┐  │
│  │ Source panel │   │Citation panel│  │ Doc generator│  │
│  │ (contextual) │   │(transparency)│  │(PPT/Word/etc)│  │
│  └──────────────┘   └──────────────┘  └──────────────┘  │
│                                                          │
│  ← Dashboard alerts surface here                         │
│  → "Create asset" triggers Content workspace             │
└─────────────────────────────────────────────────────────┘
          ↓ deep work                    ↓ deep work
┌─────────────────────┐      ┌─────────────────────────────┐
│      CONTENT        │      │    INSIGHTS DASHBOARD       │
│  Brand Guidelines   │      │  Define scope               │
│  Templates          │      │  Agent-driven monitoring    │
│  Approval workflow  │      │  Auto-generated visuals     │
│  Prompt-driven gen  │      │  Alerts                     │
│  Export (Approved)  │      │  Full intelligence picture  │
└─────────────────────┘      └─────────────────────────────┘
```

---

## What the Product Needs to Design Next (Component by Component)

**Chat — Redesign from scratch**
- The chat interface as the primary home screen
- Source selection as an in-conversation contextual feature
- The citation panel as a first-class feature with its full functionality defined
- Document generation triggered from chat
- How Dashboard alerts surface in the chat
- How Content creation is initiated from chat
- All states: empty, generating, error, multi-turn, history

**Content — Redesign from scratch**
- Brand Guidelines (with live preview, full type hierarchy, hex editing, approval lifecycle)
- Template editor (cleaned of all dev artifacts, meaningful canvas states, designed merge tag insertion)
- Approval workflow — both creator and reviewer experience
- Prompt-driven asset generation
- My Library (correct MLR terminology, all asset types, real thumbnails)

**Insights Dashboard — Design from scratch**
- Scope definition experience (onboarding: what do you want to track?)
- The live dashboard with agent-generated visualisations
- Alert design and delivery
- How the intelligence connects to chat and content actions

---

## Design Principles for This Product

1. **Chat first.** If something can be done in chat, it should be. Complexity lives in the dedicated workspaces.
2. **No unnecessary steps.** Source selection is optional. Document generation starts with a prompt. Brand selection should be smart, not manual.
3. **Transparency builds trust.** The citation panel, the compliance disclaimer, the approval lifecycle — these are not compliance checkboxes, they are trust mechanisms that make the user feel safe using AI in a regulated context.
4. **The product does the watching.** The Insights Dashboard is passive. Users should not have to check it — it should surface what matters into their primary workflow.
5. **Delight is a design requirement.** Efficiency and compliance are table stakes. The product should feel genuinely good to use — responsive, intelligent, and on the user's side.
