# InForm — First-Round Ideation Checklist

**Status key:** ✅ Decided · ⚠️ Partially covered · ❌ Not yet addressed

---

## Product Level

| Item | Status | Notes |
|------|--------|-------|
| Product vision and problem statement | ✅ | Compliant content operations platform for regulated medical communications |
| Target users and roles | ✅ | Medical affairs, marketing, regulatory, market access, MLR reviewers, admins |
| Core use cases / jobs to be done | ✅ | Research/query, content creation, passive market intelligence |
| Product architecture | ✅ | Three independent components, Chat as connective tissue |
| Navigation model | ✅ | By component, sidebar for chat history |
| Product name | ⚠️ | InForm or Verity.ai — not yet finalised |
| Platform and device targets | ❌ | Web assumed but not decided. Mobile/responsive not discussed |
| Admin and permissions model | ⚠️ | Admin role mentioned for templates and brand guidelines. Admin panel noted but not defined |
| Onboarding / first-time user experience | ❌ | Not covered for any component |
| Success metrics and KPIs | ❌ | Not discussed |
| Technical constraints documented | ⚠️ | Ingestion pipeline noted. Broader constraints not documented |

---

## Chat Component

| Item | Status | Notes |
|------|--------|-------|
| Primary entry point and home screen | ✅ | Chat IS the home. No separate homepage |
| Core interaction model | ✅ | Conversational, no setup required |
| Source selection model | ✅ | Contextual, mid-conversation, `@` + `+` trigger, inline picker |
| Default context (no source selected) | ✅ | AI scans entire library |
| Citation panel — structure and features | ✅ | Two levels: overview → detail. Passage-level transparency |
| Tooltip design | ✅ | Verbatim + Source label + counter |
| Document generation model | ✅ | Inline card for preview, separate view for complex docs |
| Layout model | ✅ | Progressive — two columns default, three when citation panel open |
| AI character and tone | ✅ | Colleague voice, role-adaptive behaviour by department |
| AI relational memory | ✅ | Learns user preferences, visible and user-controlled |
| AI epistemic personality | ✅ | Specific and honest about uncertainty |
| Knowledge gap flagging (Level 1 + 2) | ✅ | In-response + proactive surfacing |
| Conversation history | ✅ | Sidebar with search, naming, pin, delete |
| Dashboard alerts in Chat | ✅ | Proactive AI message on new conversation, sidebar indicator |
| File upload model | ✅ | Originates in Chat, ingestion pipeline, AI follows up when ready |
| Personalised seeded prompts | ✅ | Based on user context and history, not static |
| Streaming and generation state | ✅ | Step-by-step status visible during complex generation |
| Stop generation | ✅ | Required |
| Regenerate and response feedback | ✅ | Regenerate + thumbs up/down |
| Response design — long outputs | ✅ | Collapsible sections, section-level copy, table export |
| Conversation sharing | ✅ | Share response or full conversation with colleague |
| Saved insights / bookmarks | ✅ | Lightweight save action on responses |
| Editing a sent message | ✅ | Edit + regenerate |
| Source chip placement | ⚠️ | Deferred — needs visual to decide above vs. inside input |
| User role and preference configuration | ❌ | Where and how is this set? Onboarding + settings surface not designed |
| AI memory visibility and editing | ❌ | Profile/memory view not designed |
| Multi-language support | ❌ | Scope decision needed |
| Compliance audit trail | ❌ | Scope decision needed |
| Onboarding / first-time experience | ❌ | New user with empty library, no history |
| Error states | ❌ | No relevant documents found, AI uncertainty, connection errors |
| Empty library state | ❌ | What happens when there are no documents to search? |

---

## Content Component

| Item | Status | Notes |
|------|--------|-------|
| Core workflow | ✅ | Brand Guidelines → Templates → Approval → Prompt-driven creation |
| User roles | ✅ | Creators, brand admins, template admins, MLR reviewers |
| Asset types supported | ✅ | Email, press release, flyer, sales collateral, PPT, Word, engagement email |
| Asset creation model | ✅ | Guided prompting with scaffold per asset type |
| AI clarifying question (one max) | ✅ | Single most critical gap only |
| Brand guidelines auto-extraction | ✅ | From uploaded PDF, admin reviews and confirms |
| Brand guidelines auto-application | ✅ | Inferred from user profile, manual override available |
| Template editor permissions | ✅ | Admin/authorised users only |
| Post-generation editing | ✅ | Content + layout editing, locked elements, prompt-based editing |
| Locked elements behaviour | ✅ | Subtle visual treatment, informative lock message |
| Approval lifecycle | ✅ | Draft → In Review → Approved → Returned |
| Export gating | ✅ | Approved assets only, system-enforced |
| Chat to Content handoff | ✅ | Finished asset to Draft in Content, user stays in Chat |
| My Library IA | ❌ | Status tabs, card design, filters, actions per status not designed |
| Reviewer experience | ❌ | Reading view, inline comments, Approve/Return decision, comment required on return |
| Multi-round approval tracking | ❌ | How rounds are shown to creator and reviewer |
| Brand guidelines setup experience | ⚠️ | Auto-extraction defined. Full setup flow not designed |
| Admin panel | ⚠️ | Mentioned for audit/metrics. Scope and IA not defined |
| Onboarding for new teams | ❌ | No guidelines or templates exist yet — what does the user see? |
| Prompt scaffold ownership | ❌ | Who defines and maintains scaffolds per asset type? |
| Source Chat conversation tracing | ❌ | Scope decision needed for reviewers |
| Connection between Dashboard and Content | ❌ | Can Lighthouse insights feed into content creation as briefs? |

---

## Insights Hub

*(Renamed from Insights Dashboard)*

| Item | Status | Notes |
|------|--------|-------|
| Core concept | ✅ | Agent task manager + intelligence briefing. Users direct agents, agents execute and report. |
| User role | ✅ | All users — personal by default, team layer for shared intelligence |
| Agentic task types | ✅ | Monitor, Execute and Report, Investigate and Act |
| Task creation model | ✅ | Natural language, AI confirms interpretation |
| Alerts connection to Chat | ✅ | Daily brief surfaces in Chat as proactive message |
| Urgency tiers | ✅ | Critical, Important, Monitor |
| Insight actions | ✅ | Investigate in Chat, Review affected assets, Add to monitoring, Share, Dismiss, Create agentic workflow |
| Source types | ✅ | PubMed, ClinicalTrials.gov, Web (Company + KOL), CRM, Regulatory agencies, Conference abstracts, Patents, Medical news |
| Source quality control | ✅ | Full user control with tiered presets as onboarding path |
| Personal vs shared model | ✅ | Personal by default, team-level topics set by admin |
| Feedback loop | ✅ | Useful/not relevant feedback trains agent relevance model |
| Daily brief | ✅ | AI-authored, 3-5 items, curated by urgency and personal relevance |
| Scope definition / first-time experience | ❌ | Profile-inferred topics + confirmation. Detailed flow not designed |
| Hub IA and layout | ❌ | Feed, task manager, topic management — structure not designed |
| Agentic workflow creation UI | ❌ | How does the natural language task creation feel in practice? |
| Visualisations within insight cards | ❌ | Inline, contextual — not standalone charts. Detail not designed |
| Connection between Hub and Content | ⚠️ | "Investigate and Act" tasks can flag assets. Full flow not designed |

---

## Cross-Cutting Concerns

| Item | Status | Notes |
|------|--------|-------|
| Compliance requirements | ✅ | MLR, disclaimer, approval lifecycle |
| Design philosophy | ✅ | Efficiency + compliance + genuine delight |
| AI disclaimer | ✅ | System-level component, consistent across all AI-generated content screens |
| Multi-language | ✅ | Not v1 scope. Showcase language selection UI only. RTL deferred. |
| Mobile / responsive | ✅ | Desktop-first, mobile responsive. Content editing not on mobile. |
| Visual direction | ✅ | Intelligent warmth. Light mode, restrained colour, whitespace, purposeful motion. |
| Global onboarding | ✅ | Lightweight global profile setup + component-level contextual first-runs |
| Admin panel scope | ✅ | Confirmed — designed last after component detail is clear |
| Design system — visual direction | ✅ | Neumorphic + glassmorphic hybrid. Two layers: frosted glass background (nav/passive), opaque neumorphic foreground (workspace). Warm tint bias. Primary CTAs colour-filled for accessibility. See V1–V6 in Design Decisions Log. |
| Accessibility | ❌ | WCAG 2.1 AA minimum. Not yet discussed in detail. |
| Success metrics | ❌ | Not yet defined. Important for portfolio framing. |

---

## Summary

| Area | Decided | Partially covered | Not yet addressed |
|------|---------|------------------|------------------|
| Product Level | 5 | 3 | 3 |
| Chat | 21 | 1 | 7 |
| Content | 14 | 2 | 9 |
| Insights Dashboard | 3 | 1 | 6 |
| Cross-Cutting | 2 | 1 | 5 |

**Chat is the most complete.** Content has the core framework decided but the detail flows (Library, Reviewer, Onboarding) are all open. The Insights Dashboard is the least explored — the concept is clear but almost nothing is designed. Cross-cutting concerns, especially design system and accessibility, haven't been touched.

---

## Recommended Conversation Order

1. **Insights Dashboard** — define the broad picture before detailing Content further, since the two components connect
2. **Content — detail flows** — My Library, Reviewer experience, Onboarding
3. **Cross-cutting** — Design system direction, naming, accessibility, onboarding
4. **Chat — remaining open items** — Role configuration, memory visibility, error states
5. **Admin panel** — spans all three components, design last once component detail is clear
