# Design Decisions Log

**InForm (working title) — Medical Affairs AI Platform**
Running record of design decisions made during ideation. To be used as the basis for design rationale documentation.

---

## Product-Level Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| P1 | Product has three independent components: Chat, Content, Insights Dashboard | Different user roles may only use one component. Not sequential stages. | Apr 2026 |
| P2 | Top-level navigation is by component, not by project. Collections are an optional organisational layer within Chat only — not a navigation paradigm. **Revised Apr 2026.** | Top-level project navigation adds a decision gate before users can do anything. Collections provide initiative-level grouping within Chat (conversations, artifacts, sources) without becoming a prerequisite or changing how the product is navigated at the top level. | Apr 2026 |
| P3 | Chat is the connective tissue (Option B) | More intuitive than a shared context/project layer. Requires less learning. Daily interaction point is the chat. | Apr 2026 |
| P4 | Product name direction: InForm or Verity.ai | "InForm" — wordplay: to inform (research/chat) + to give form (content creation). "Verity" — truth, verification, fits regulated medical context. Not yet finalised. | Apr 2026 |

---

## Chat Component Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| C1 | Default context: AI scans entire library when no source is selected | Users should never be blocked from asking a question. Source selection is a precision tool, not a gate. | Apr 2026 |
| C2 | Source selection is contextual — applied at any point mid-conversation, not a prerequisite | Reduces friction. Keeps the entry experience simple. Advanced users can still scope precisely. | Apr 2026 |
| C3 | Sidebar model for conversation history | Familiar pattern. Allows persistent access to prior conversations without disrupting the current one. | Apr 2026 |
| C4 | Separate homepage (not the chat) as the landing screen | Chat home ≠ product home. The homepage is the unified view across all three components. | Apr 2026 |
| C5 | Document generation: inline card for preview, separate view for complex documents | Inline keeps context for simple outputs (briefs, summaries). Separate view is appropriate for full PPT/Word documents without disrupting the conversation. | Apr 2026 |
| C6 | AI voice and tone: sounds like a colleague flagging something interesting or urgent | Not a tool reporting data. A smart colleague who notices things, has context, and communicates with appropriate urgency. | Apr 2026 |
| C7 | Seeded prompts on the new conversation state are personalised, not static | Personalised prompts based on the user's product, market, and recent activity are genuinely useful. Generic prompts teach the user nothing. Requires product memory of user context. | Apr 2026 |
| C8 | Source chips are inside the input bar — two-row interior layout (bottom row). **Resolved.** | Chips above the bar create a disconnected floating row that doesn't read as part of the bar's state. Interior placement unifies scope configuration and query input into one R3 surface. The three-state chip system (default / 1–2 individual / 3+ condensed pill) handles overflow without horizontal scroll. | Apr 2026 |
| C9 | Citation panel has two levels: overview (all sources) → detail (one source) | Overview gives the user the full picture of everything the AI drew from. Detail gives passage-level transparency for a specific source. Clicking a citation in the overview drills into its detail. Back button returns to overview. | Apr 2026 |
| C10 | Overview level shows: document name, year, market, passage count per source | Passage count ("4 passages") signals how heavily the AI relied on each source before the user clicks in. Helps users prioritise which source to verify first. | Apr 2026 |
| C11 | Detail level shows verbatim passages stacked (not paginated), with section/page location for each | Full panel has space to show all passages at once. Pagination is for the compact tooltip only where space is constrained. Each passage shows the section heading or page number so users know exactly where in the document it appears. | Apr 2026 |
| C12 | Tooltip shows verbatim text + "Source:" label + document title + "1 of 3" counter | "Source:" label removes ambiguity about what's below the divider. Counter replaces dots — tells users how many passages exist and where they are. For same-document multiple pages, source label includes page number. | Apr 2026 |
| C13 | Tooltip passages can be from different pages of the same document or from multiple documents | As user paginates, the document title in the source label changes when the source changes. Page number shown when multiple passages are from the same document. | Apr 2026 |

---

## Homepage Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| H1 | ~~Homepage as unifying surface~~ — **Reverted. Chat IS the home screen.** | Most users arrive with a task. A homepage creates a decision point before they can do anything. Dashboard alerts aren't daily so the homepage would often be stale. Progressive disclosure: Chat is simple on day one, Content and Dashboard are discovered when needed. Only power users benefit from an aggregated home view — the majority don't. | Apr 2026 |
| H2 | Dashboard alerts surface inside Chat as proactive AI messages | Without a homepage, alerts need to reach the user contextually — as a colleague-style prompt when opening a new conversation or when the alert is relevant to current research. This is more useful than a homepage card because it arrives with context. | Apr 2026 |

---

## Content Component Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| CT1 | Workflow: Brand Guidelines → Templates → Approval → Prompt-driven design | Sequential governance ensures compliance before assets are produced at scale. | Apr 2026 |
| CT2 | Export gated to Approved assets only | System-enforced compliance rule, not a UI convention. Only MLR-approved content is distributable. | Apr 2026 |
| CT3 | "Returned" not "Rejected" as the failed review status | In MLR/regulatory workflows, content is returned for revision with comments — not rejected outright. "Rejected" implies permanent failure and discourages resubmission. | Apr 2026 |

---

## Chat — Additional Features

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| C13b | Layout: progressive disclosure — two columns by default, three when citation panel is open | NotebookLM/Claude three-panel layout is designed for document-centric products where sources are always the point. In this product, chat is the point and documents are context. Default two-column layout (sidebar + chat) is familiar and non-intimidating for non-tech medical users. Citation panel slides in as a third column only when the user actively opens it. Transition must be smooth — chat compresses, panel opens, no jarring shift. | Apr 2026 |
| C14 | Direct upload originates in chat, with ingestion pipeline processing time | Precision over speed — documents must go through ingestion for accuracy. Upload still happens from chat for UX continuity. AI follows up in the same conversation thread when the document is ready to query. | Apr 2026 |
| C15 | Knowledge gap flagging Level 1: specific, in-response gap statements | Generic disclaimers get ignored. Specific gaps ("no MENA data for this product") are actionable and build trust. Trained users to treat AI output as informed, not absolute. | Apr 2026 |
| C16 | Knowledge gap flagging Level 2: proactive surfacing based on query patterns | AI notices what's systematically missing across conversations and suggests filling those gaps via external source search. Makes the AI feel attentive, not just reactive. | Apr 2026 |
| C17 | Knowledge gap Level 3 (library coverage map) — **deferred to later iteration** | Power user feature. Natural evolution of Level 2 but not needed for the core design pass. Feeds into the Insights Dashboard agent capability. | Apr 2026 |
| C18 | AI character: one product identity with adaptive behaviour by user role | Consistent, trustworthy identity across all users. What changes per role: vocabulary, response structure, what the AI proactively flags, how it asks clarifying questions. Not multiple personas — one character that knows its audience. | Apr 2026 |
| C19 | Role-adaptive behaviour defined for: Medical Affairs, Marketing, Regulatory, Market Access | Medical Affairs → evidence-first, clinical precision, MLR awareness. Marketing → conclusion-first, positioning framing, competitive angles. Regulatory → compliance-forward, conservative, label-accurate. Market Access → payer language, health economics framing. | Apr 2026 |
| C20 | AI relational memory: learns user preferences over time, visible and user-controlled | The AI remembers response format preferences, working patterns, relevant products/markets. Must be transparent and editable — regulated context requires users to control what the AI knows about them. | Apr 2026 |
| C21 | Mic button is always visible in the input bar, not context-dependent | Always-visible mic avoids the cost of discovery — users shouldn't have to learn that voice input exists by stumbling on it. In a compliance context, voice may be a preferred input method (e.g., hands-free, mobile). Placing it in the right cluster of the bar's bottom row keeps it accessible without cluttering the query area. | Apr 2026 |
| C22 | Upload has two paths: drag-onto-bar (drop zone overlay) and "+ Select source → Upload file" (R7 menu) | Dual-path for different user behaviours. Drag-onto-bar is the fast path for users who are already working with a file. The menu path is discoverable for users who don't know about drag-and-drop. Both paths lead to the same ingestion pipeline (C14). | Apr 2026 |
| C23 | AI epistemic personality: specific and honest about uncertainty, never generically hedged | "The EU data strongly supports this. MENA data is thinner — treat this as preliminary for that market." Confident where justified, honest where not. Generic disclaimers train users to ignore them. Overconfident AI is dangerous in a regulated context. | Apr 2026 |
| C24 | Collections in Chat: an optional, named workspace grouping related conversations, artifacts, and sources under a shared initiative context | Medical affairs work is initiative-shaped — advisory boards, submissions, product launches. Collections group the work belonging to one initiative without acting as a gate. Independent conversations exist alongside Collections in the sidebar with no pressure to use either. | Apr 2026 |
| C25 | Collections carry optional context: instructions, document set, description, team members. Created with name only — everything else added later or not at all | Low creation friction is critical. A Collection that requires setup discourages use. The value is in the grouping, not the configuration — configuration is additive. | Apr 2026 |
| C26 | Collection source mode: Restrict (AI answers only from Collection documents) or Prioritise (AI weights Collection documents higher but draws from full library). Set at Collection level, overridable per conversation | Restrict suits compliance-critical reviews where source certainty matters. Prioritise suits ongoing research where Collection docs are the primary lens but not a hard boundary. Different initiatives have different sourcing needs. | Apr 2026 |
| C27 | Collection has three tabs: Conversations · Artifacts · Sources | Conversations: the chat history for this Collection. Artifacts: filtered view of Content assets generated from this Collection's conversations. Sources: the document set configured for this Collection. Together these give a complete picture of an initiative from within Chat. | Apr 2026 |
| C28 | Artifacts tab is a read-only filtered view into Content — not a separate data store. Chat does not store or edit assets | Content is the single source of truth for all generated assets. The Artifacts tab reads from Content; it does not write to it. Editing, reviewing, and approving assets happens in Content. Chat surfaces status only. Keeps governance clean in a compliance-sensitive product. | Apr 2026 |
| C29 | All Chat-generated assets land in Content unconditionally. `collection_id` is optional metadata — present if generated inside a Collection, absent if from an independent conversation | Content does not require `collection_id`. Assets generated outside Collections are fully valid Content assets, findable in Content's standard asset list. `collection_id` is additive — it powers the Artifacts tab filter, nothing more. An absent `collection_id` is not a null state; it is a normal Content asset. | Apr 2026 |
| C30 | Primary navigation is a centred top bar: Chat · Content · Insights · Library. Logo left, utilities right (search, avatar) | Four primary sections, always one click away from anywhere in the product. Centred in the viewport for visual balance. Sidebar freed entirely for contextual within-section content. Keeps the product feeling unified rather than component-siloed. | Apr 2026 |
| C31 | Notifications in sidebar bottom dock (bell icon between Settings ⚙ and Profile avatar), not in the top bar | Keeps the top bar minimal. Notifications are a sidebar-level utility — accessed regularly but not constantly. Clicking the bell opens the notifications panel. | Apr 2026 |
| C32 | Global search in top bar right zone. Primary trigger is ⌘K (command palette). Also accessible via search icon | Cross-component search across conversations, library documents, content assets, and insights. Single input, results scoped and labelled by component. Keyboard-first keeps the top bar clean. | Apr 2026 |
| C33 | Daily brief appears as a collapsible card in the Chat empty state on the first new conversation of the day only. Dismissible with ×. Opt-out toggle in Settings | Accommodates different entry circumstances — users coming in for a quick query dismiss it instantly. Users who want the intelligence context act on it. The brief is a card above seeded prompts, not an AI message that owns the screen. Not shown if the user already has an open conversation from today. | Apr 2026 |
| C34 | Settings panel (⚙ icon, sidebar bottom dock): Preferences (language, response format, display density) · AI Memory (reviewable and editable per entry) · Role (declared role, product, market) · Notifications configuration | Centralises all user-level configuration. Settings is a slide-in panel consistent with the source drawer pattern — user stays in context, no full-page navigation. | Apr 2026 |

### Open Items — Chat

| # | Item | Notes |
|---|------|-------|
| OC1 | ~~Where does the user configure their role and communication preferences?~~ **Resolved — Settings panel, Role section.** | Role (Medical Affairs, Marketing, Regulatory, Market Access), product, and market configured in Settings panel (⚙ icon, sidebar bottom dock). AI can also surface confirmations inline: *"I noticed you prefer shorter responses — keep doing that?"* — confirmations feed back into AI Memory (C20/C34). |
| OC2 | ~~How is AI relational memory made visible and editable by the user?~~ **Resolved — Settings panel, AI Memory section.** | Full memory view in Settings panel: list of all remembered items (preferences, working patterns, product/market associations), each individually editable or deletable. Clear-all option available. Regulated users need full transparency and control over what the system retains. |
| OC3 | Multi-language support | Product operates across MENA, EU, LATAM. Can users query and receive responses in Arabic, French, German, Spanish? Affects IA and onboarding. Scope decision needed. |
| OC4 | Compliance audit trail | Regulated context may require a log of AI interactions linked to sources. Architecture and UX implications. In or out of scope decision needed. |

---

## Content Component Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| CT4 | Template editor is admin/authorised users only | Everyday users work with approved templates, never inside the editor. Protects brand compliance and template integrity. | Apr 2026 |
| CT5 | Asset creation uses guided prompting — pre-populated prompt scaffold per asset type, not a blank field or a form | Blank prompts fail because users don't include required detail. Forms kill conversational naturalness. Scaffold gives users placeholders that signal what's needed while keeping input freeform. AI asks one targeted clarifying question if critical information is still missing after submission. | Apr 2026 |
| CT6 | Brand guidelines auto-extracted from uploaded brand PDF, admin reviews and confirms | Manual entry introduces transcription errors and friction. Extraction from source document is more accurate. Manual entry remains as fallback. | Apr 2026 |
| CT7 | Brand guidelines auto-applied based on user profile (market, product) — manual override available | Removes a friction point from every asset creation. Users shouldn't select a brand on every asset. System infers from profile. Edge cases handled by override. | Apr 2026 |
| CT8 | Post-generation editing: user can edit content, text box sizes/shapes, some elements. Template admins can lock elements. Prompt-based editing also available for unlocked elements. | Gives users flexibility within compliance boundaries. Locked elements ensure brand and regulatory accuracy. Prompt editing ("Make the headline shorter") is accessible to non-designers. | Apr 2026 |
| CT9 | Locked elements visually distinct but quiet — subtle background tint, not intrusive. Message on interaction: "Locked by your template — contact [admin] to request changes." | Communicates intent without cluttering the canvas. Message is informative, not just restrictive. | Apr 2026 |
| CT10 | Chat to Content handoff: finished asset arrives in Content as Draft. User stays in Chat. No conversation thread attached to asset. | User's context is Chat — they shouldn't be redirected. The asset stands alone in Content. Simple and clean. | Apr 2026 |

| CT11 | Review model: sequential stages, configurable by admin, multiple reviewers possible per stage | Parallel review across all stages causes conflicting feedback with no resolution hierarchy. Sequential stages map to real MLR workflow (Medical → Legal/Regulatory). Within a single stage, multiple reviewers can participate — all must approve to advance. Any return within a stage sends asset back to creator without advancing. | Apr 2026 |
| CT12 | Review stages configurable by asset type and content risk level | Low-risk internal communications may need one stage. Promotional HCP materials need full chain. Admin configures required stages per asset type. | Apr 2026 |
| CT13 | Reviewer assigned by admin, fixed per asset type. Backup/delegate reviewer configurable for unavailability | Single point of failure on reviewer side causes backlogs. Backup reviewer notified if primary hasn't acted within a defined timeframe. | Apr 2026 |
| CT14 | CRM integration (Veeva, Salesforce) — bidirectional | Inbound: CRM data feeds into Chat as a source. Outbound: approved assets pushed to Veeva Vault / CRM for distribution. Veeva treated as first-class integration — OCE-ready export formalised as a Veeva push, not just a file download. | Apr 2026 |
| CT15 | Asset expiry — configurable at approval, system-enforced | Expiry date set at approval. Alerts as expiry approaches (Insights Dashboard + in-platform notification). Expired assets move to Archived status — not exportable or distributable, enforced at system level. | Apr 2026 |
| CT16 | Template hierarchy: Company → Portfolio → Brand → Products. Templates and brand guidelines sit at Brand level. | User profile associated with product → system infers brand → auto-applies brand guidelines. Template browser reflects this hierarchy. | Apr 2026 |
| CT17 | Multiple collaborators on an asset if file is shared | Co-authorship supported. Asset has one owner but can be shared for collaborative editing. Draft visibility: only owner/collaborators and managers. | Apr 2026 |
| CT18 | Brief is AI-generated from structured questions, not manually created | Reduces dependency on user finding or writing a brief. System asks: product, indication, audience, key messages, data points with source links. | Apr 2026 |
| CT19 | Every claim and data point in a brief must be source-cited before asset generation begins | Unverified claims in the brief produce unverifiable content in the asset. Source-citing at brief stage creates an audit trail from brief → asset → review → approved material. AI can suggest data points from library but user must confirm each. Asset cannot proceed to generation until all claims are sourced. | Apr 2026 |
| CT20 | PPT and Word document editing happens inside the platform | Consistent editing experience across all asset types. No dependency on native apps. | Apr 2026 |

### Open Items — Content

| # | Item | Notes |
|---|------|-------|
| OCT1 | Admin panel scope — spans all three components | Conversation tracing, review metrics, user permissions, team management, CRM integration config, expiry management. Design after component detail is clear. |
| OCT2 | Distribution step — what does the handoff to Veeva/Salesforce look like from the user's perspective? | Is it a single "Distribute" action after approval, or does the user configure distribution parameters (which HCPs, which channels, which markets)? |
| OCT3 | What is the review SLA model? | How long does a reviewer have before a backup is triggered? Who configures this? |
| OCT4 | How are review round histories shown? | Creator and reviewer both need to see what changed between rounds. Design of the version/round history view. |
| OCT5 | ~~Can a brief be initiated from a Chat conversation?~~ — **Decided: yes, brief is pre-populated from Chat** | When an asset is created from Chat, the conversation context — synthesised claims, cited data points, product/market/audience — pre-populates the brief. User reviews and confirms each field before generation. Source citations from Chat carry over automatically. Removes the gap between research and creation. |

---

## Cross-Cutting Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| X1 | Multi-language: not in scope for v1. Showcase language selection UI only. | Language support is a future capability. Portfolio shows awareness of the need without over-engineering a full multi-language flow. RTL and full translation deferred. | Apr 2026 |
| X2 | Mobile responsive, desktop-first | Full creation workflow (Content editing, canvas) not designed for mobile. Mobile-optimised for: daily brief, alert notifications, quick Chat queries. Layout adapts — sidebar collapses, citation panel becomes a bottom sheet, Insights feed becomes scrollable list. | Apr 2026 |
| X3 | Visual direction: intelligent warmth. Light mode primary, restrained purposeful colour, generous whitespace, strong typographic hierarchy, motion that communicates state not personality. | Avoids two failure modes: too cold (legacy enterprise) and too casual (consumer AI). Fits medical affairs professionals who need precision and approachability. | Apr 2026 |
| X4 | Design system: functional colour has fixed meaning — teal/indigo primary, amber/orange for urgency, green for approved, muted terracotta for returned/attention. Colour is never decorative. | In a product handling compliance-critical information, colour must always carry meaning. Decorative colour creates ambiguity. | Apr 2026 |
| X5 | Global onboarding: lightweight profile setup first (role, product, market, language preference), then component-level contextual first-runs | Two-minute setup populates personalised Chat prompts, informs brand auto-application in Content, seeds Insights Hub monitoring topics. One global setup, three contextual first-runs. | Apr 2026 |
| X6 | Admin panel scope confirmed: user management, role assignment, permissions, audit trail, CRM integration config, usage metrics, brand/template governance, review workflow configuration | Spans all three components. Designed last once component detail is clear. Referenced in portfolio governance story even if not fully designed. | Apr 2026 |
| X7 | AI disclaimer: consistent placement, formatting, and punctuation across all screens where AI-generated content appears. Dedicated design system style for AI content indicators. | Legal and trust requirement in regulated context. Cannot be designed fresh each time — must be a system-level component. | Apr 2026 |

---

## Insights Hub Decisions

*(Renamed from "Insights Dashboard" — "Hub" better reflects the active, agent-driven model)*

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| D1 | Insights Hub is an agent task manager + intelligence briefing, not a passive dashboard | Passive dashboards make users react. This model lets users direct agents to complete tasks and receive curated intelligence. Users are in control, not just consuming. | Apr 2026 |
| D2 | Three agentic task types: Monitor (ongoing alerts), Execute and Report (scheduled outputs), Investigate and Act (multi-step cross-component tasks) | Different user needs require different agent behaviours. Monitor = set and forget. Execute and Report = scheduled deliverables. Investigate and Act = consequences routed to Chat or Content. | Apr 2026 |
| D3 | Agentic tasks defined in natural language, AI confirms interpretation | Non-technical medical affairs users cannot use workflow builders. Natural language task creation with AI confirmation is accessible to all user types. | Apr 2026 |
| D4 | Task creation IS the proactive intelligence mechanism | Rather than purely passive monitoring, users direct agents to specific tasks. The intelligence feed shows what agents found; the task manager shows what agents are doing. | Apr 2026 |
| D5 | Insights Hub alerts surface in Chat as colleague-style proactive messages | Chat remains primary daily touchpoint. Alerts arrive with context, not as raw notifications. | Apr 2026 |
| D6 | Insights Hub is personal by default, with team-level monitoring topics set by admin/team lead | Personal relevance preserved. Team intelligence not siloed. Team topics appear in everyone's feed flagged as shared. Managers see team intelligence layer, not individual personal feeds. | Apr 2026 |
| D7 | Source quality: Option A (full user control) with Option C (tiered presets) as onboarding path | Medical professionals are trained source evaluators — product supports that expertise. New users start with a tier (peer-reviewed only / peer-reviewed + established news / broad), then unlock full control. System actively suggests missing source categories. | Apr 2026 |
| D8 | Sources for Insights Hub: PubMed, ClinicalTrials.gov, Web (Company + KOL/HCP), CRM, Regulatory agency publications (FDA/EMA/country-specific), Conference abstract databases, Patent publications, Medical news (filtered) | Regulatory agency publications are the highest-value source type for this user base. Conference abstracts provide competitive intelligence before congresses. Patents signal competitor pipeline. | Apr 2026 |
| D9 | Insight actions: Investigate in Chat, Review affected assets, Add to monitoring, Share with team, Dismiss (with reason), Create agentic workflow | Each action routes to the right component with context pre-loaded. Dismiss with reason feeds back into agent relevance model. Agentic workflow action allows users to automate follow-up tasks from within an insight. | Apr 2026 |
| D10 | Daily brief: AI-authored, 3-5 items, curated by urgency and personal relevance | Forces the system to prioritise. Prevents alert fatigue. Surfaces in Chat as morning proactive message; full brief available in Insights Hub. | Apr 2026 |
| D11 | Feedback loop on every insight (useful / not relevant) trains agent relevance model per user | Calibration improves over time. Prevents alert fatigue. System learns what each user actually acts on. | Apr 2026 |

---

## Visual Design System Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| V1 | Visual system is neumorphic + glassmorphic hybrid, with two distinct layers | Creates clear hierarchy between passive product infrastructure and active workspace. Gives InForm a distinctive, premium identity that separates it from generic SaaS enterprise tools. | Apr 2026 |
| V2 | Background layer (nav sidebar, top bar, profile): frosted glass, tinted, reacts to system wallpaper | Passive components frame the workspace without competing with it. Wallpaper-reactivity makes the product feel native to the OS rather than a foreign overlay. Tint temperature must have a warm bias to maintain intelligent warmth register regardless of wallpaper behind it. | Apr 2026 |
| V3 | Foreground layer (chat surface, content canvas, insight cards, input fields): opaque with neumorphic treatment | Opaque foreground ensures content remains legible and stable regardless of wallpaper. Neumorphic shadows and soft corners create tactile depth without heaviness. This is where the user's work lives — it should feel grounded and focused. | Apr 2026 |
| V4 | Neumorphic base colour: warm near-white mid-tone (not pure white) | Pure white collapses neumorphic shadows — both highlight and depth shadow become invisible. Warm near-white (light cream-grey) anchors the palette and keeps the warm register. This base IS the product's page background. | Apr 2026 |
| V5 | Buttons: neumorphic containers for secondary/tertiary actions; colour-filled flat treatment for primary CTAs | Pure neumorphic button states (hover/active via shadow inversion only) fail WCAG 2.1 AA contrast requirements. Primary CTAs (Generate, Submit, Approve) use filled teal with neumorphic corner radius and subtle elevation. Secondary and tertiary actions use full neumorphic emboss/deboss treatment. | Apr 2026 |
| V6 | Focus indicators: explicit coloured ring on all interactive elements | Neumorphic shadow inversion alone is not sufficient for keyboard navigation visibility under WCAG 2.1 AA. All focusable elements require a visible coloured ring (not just shadow shift). Designed as a system-level component, not added per element. | Apr 2026 |

### Open Items — Visual Design System

| # | Item | Notes |
|---|------|-------|
| OV1 | Glass tint exact colour value | Must have warm bias. Specific hex to be determined during visual ideation. |
| OV2 | Neumorphic base colour exact value | Controls the entire product palette. Typical range: #E0E5EC-equivalent in warm temperature. To be defined during visual ideation. |
| OV3 | Wallpaper variants for portfolio presentation | Design 2-3 wallpapers (warm neutral, cooler, textured) to showcase glass layer adaptability. Demonstrates intentionality in portfolio presentation. |
| OV4 | Shadow values for neumorphic elements | Light shadow direction (top-left light source convention) + offset, blur, and spread values for standard vs. interactive states. |

---

*This log is updated as decisions are made. Each entry should eventually map to a rationale section in the portfolio case study.*
