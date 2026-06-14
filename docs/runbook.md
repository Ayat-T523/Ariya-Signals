# Operations Runbook — Ariya Signals

Audience: Phamax team member managing client access to the Ariya Signals demo.

> **Status note (2026-06-14):** Clerk authentication has not yet been installed or configured. Sections 1 and 2 (invite / revoke) describe the intended production flow once Clerk is set up. The current demo has no login page — access is controlled at the Vercel level (password protection or domain restriction). All other sections (PostHog, Vercel rollback, pre-send checklist) are live.

---

## 1 — Inviting a new client

### Prerequisites
- Clerk dashboard access (ask Ayat for an invite if you don't have it)
- The client's email address and organisation name
- Agreed expiry date (recommend 30–90 days for a demo)
- The production URL for the correct Vercel project

### Steps

1. **Open Clerk dashboard** → Applications → `ariya-signals` → Users → **Invite user**

2. **Fill in the invitation form:**

   | Field | Value |
   |---|---|
   | Email | client's email address |
   | First name | (optional, shows in UI) |
   | Redirect URL | production domain (e.g. `https://demo.ariya.ai`) |

3. **Add user metadata** (Public metadata tab after the user is created):

   ```json
   {
     "organisation": "Pharma Inc",
     "expires_at": "2026-09-14",
     "internal": false
   }
   ```

   | Field | Type | Notes |
   |---|---|---|
   | `organisation` | string | Shows in any org-scoped UI; used for PostHog grouping |
   | `expires_at` | ISO date string | Gate logic reads this to show/hide the expiry banner |
   | `internal` | boolean | Set `true` for Phamax staff; affects PostHog filtering |

4. **Send the invitation** — Clerk sends a magic-link email automatically.

5. **Complete the pre-send checklist** (see section 5 below) before the client clicks the link.

### What the client receives
A magic-link email. One click opens the app and completes sign-in — no password needed. Link expires after 24 hours; if it lapses, resend from Clerk (Users → [user] → Send invitation).

---

## 2 — Revoking access

### Immediate revocation
1. Clerk dashboard → Users → find the user
2. Click **Revoke all sessions** (logs them out instantly from all devices)
3. Then **Delete user** if permanent

### Soft revocation (expiry banner only)
Update the user's `expires_at` metadata to yesterday's date. The app will show the expiry banner on next load but will not force a logout. Use this for a "demo window closing" warning; follow with hard revocation the next day.

### What is NOT revoked automatically
- Any Vercel preview URL the client bookmarked (these don't require auth in the current POC — see known limitation below)
- PostHog session data (retained per your PostHog plan's data retention policy)

> **Known limitation:** The current demo has no backend auth gate on page load. Revocation prevents Clerk-authenticated access but does not block the URL itself. To fully block access, change the Vercel project's **Password Protection** setting (Team plan required) or rotate the production domain.

---

## 3 — Checking a client's session in PostHog

1. Open PostHog → your project → **Persons**
2. Search by email (or by `organisation` property if you set it in Clerk metadata)
3. Click the person record to see:
   - **Session recordings** — replay exactly what they clicked and saw
   - **Events** — page views, prompt clicks, alert interactions, feedback submissions
   - **Properties** — `role`, `organisation`, `is_internal`

### Useful queries

**"Did the client reach the competitor profile?"**
- Events → filter by `page_viewed` where `route` contains `/competitors/`

**"Which Ask Ariya prompts did they try?"**
- Events → filter by `ariya_prompt_clicked`

**"Did they submit feedback?"**
- Events → filter by `feedback_submitted`

**"How long was their session?"**
- Session recordings → sort by duration → look for recordings with `organisation = 'Pharma Inc'`

---

## 4 — Rolling back a bad deploy in Vercel

### Instant rollback (preferred — ~10 seconds)
1. Vercel dashboard → project → **Deployments** tab
2. Find the last known-good deployment (green checkmark, timestamp before the bad deploy)
3. Click **•••** (three-dot menu) → **Promote to Production**
4. Confirm — Vercel instantly re-routes production traffic to the old build

No git changes required. The bad commit stays in git history.

### Verify the rollback
- Open the production URL in a private/incognito window
- Check the version string in the help modal (Help icon → scroll to bottom): it should show the version from the known-good build

### If the rollback itself fails
```bash
# Hard reset demo-stable to the last good tag
git switch demo-stable
git reset --hard v1.0.0        # replace with the correct tag
git push --force-with-lease origin demo-stable
```

Use `--force-with-lease` (not `--force`) so you don't accidentally overwrite a concurrent push.

---

## 5 — Pre-send checklist

Complete this before sending the magic-link to any client:

- [ ] **Test the magic link yourself** — use a personal email address you control (Gmail, Outlook — not your Phamax address) and click the link from a different browser or device
- [ ] **Verify on Edge and Safari** — Chrome is not enough; clients are often on Edge (corporate) or Safari (Mac/iPad)
- [ ] **Verify the expiry date is set** — open Clerk → user → Public metadata → confirm `expires_at` is future-dated
- [ ] **Verify the organisation label is correct** — onboarding modal should address the persona by name; War Room should show the correct company / asset / TA strings
- [ ] **Confirm the illustrative-data banner is visible** — TopBar should show the yellow/amber "Illustrative data" ribbon on every page
- [ ] **Confirm the help modal version string** — Help icon → bottom of modal → should read `Ariya Signals demo · v1.0.0` (or current version)
- [ ] **No broken tabs or blank states** — click through War Room → Competitors → one competitor profile → all 4 tabs → Intelligence → Alerts → Market Performance
- [ ] **Send the client brief** — one-page PDF explaining what the demo is, what the data represents, 3 things to try first, and who to contact (see note below)

> **GDPR note for DACH clients:** Before distributing, confirm with David/Ritu whether any competitor names, physician names, or KOL names in the data are real identifiable individuals. If any are real, replace with synthetic names before the first client invite. GDPR applies to any data about identifiable persons shared with a third party, even in a demo context.

---

## 6 — The client brief (what to send with every invite)

Send a short email or one-page PDF alongside the magic link. It should cover:

1. **What this is** — "A prototype of Ariya Signals, Phamax's competitive intelligence platform for the HAE franchise. All data is illustrative and not for clinical or commercial decisions."
2. **What the data represents** — "Signals, competitor profiles, and market events are based on publicly available information as of April 2026, structured to show how the platform would look with your real data connected."
3. **Three things to try first:**
   - Click a competitor card → explore the Pipeline and Messaging tabs
   - Open Alerts → use the competitor filter
   - Click "Ask Ariya" → try one of the suggested questions
4. **Who to contact** — ariya@phamax.ch for questions, access issues, or renewal

---

*Last updated: 2026-06-14 · Owner: Ayat Tayebulla*
