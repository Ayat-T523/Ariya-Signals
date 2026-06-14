# Release Flow — Ariya Signals

## Branch model

```
iteration-3  (active development)
     │
     │  PR / manual merge after review
     ▼
demo-stable  ← Vercel production project points HERE
```

| Branch | Purpose | Vercel project | Who pushes |
|---|---|---|---|
| `iteration-3` | Day-to-day dev, iteration, fixes | Preview URLs (auto) | Ayat / dev team |
| `demo-stable` | Client-facing production | `ariya-signals` (production) | Release manager only, after checklist |

**The client-facing domain must only ever point at `demo-stable`.** Daily work on `iteration-3` auto-generates ephemeral Vercel preview URLs (e.g. `ariya-signals-git-iteration-3-phamax.vercel.app`) — these are internal-only and must not be shared with clients.

---

## Step-by-step release flow

### 1 — Develop and review on `iteration-3`

```bash
# All dev work happens here
git switch iteration-3
# … make changes, commit …
git push origin iteration-3
```

Vercel auto-deploys a **preview URL** for every push. Share the preview URL internally for review. Do NOT share preview URLs with clients.

### 2 — Verify the preview

Run the QA checklist in `docs/qa-report.md` against the preview URL:
- All 13 routes load without blank screen
- No console errors
- Correct client strings (company label, asset name, TA)
- Export buttons work
- Onboarding modal fires on first visit

### 3 — Merge to `demo-stable`

Once satisfied, merge `iteration-3` → `demo-stable`:

```bash
git switch demo-stable
git merge --no-ff iteration-3 -m "release: merge iteration-3 → demo-stable ($(date +%Y-%m-%d))"
git push origin demo-stable
```

Vercel detects the push to `demo-stable` and deploys to production automatically.

### 4 — Verify production

Open the production URL and spot-check:
- War Room loads with correct greeting and asset name
- TopBar shows correct illustrative-data badge
- Help modal shows correct version string (e.g. `Ariya Signals demo · v1.0.0`)

### 5 — Tag the release (optional but recommended)

```bash
git tag -a v1.0.0 -m "Release v1.0.0 — initial client demo"
git push origin v1.0.0
```

Update `APP_VERSION` in `src/config/demo-config.ts` before tagging so the version shown in the help modal matches the tag.

---

## Rollback

If a deploy to `demo-stable` breaks something:

**Option A — Instant Vercel rollback (preferred)**
1. Open Vercel dashboard → project `ariya-signals`
2. Deployments tab → find the last good deploy
3. Click ••• → **Promote to Production**

Takes ~10 seconds. No git changes needed.

**Option B — Git revert**
```bash
git switch demo-stable
git revert HEAD --no-edit
git push origin demo-stable
```

Use this if the broken deploy introduced a data or config change that also needs unwinding.

---

## Version bumping

`APP_VERSION` lives in `src/config/demo-config.ts`. Bump it before any client-facing release:

```ts
export const APP_VERSION = 'v1.1.0'
```

The string appears in the help modal footer: `Ariya Signals demo · v1.1.0`. This lets the Phamax team identify exactly which build a client is seeing during a support call.

Suggested semver convention:
- **Patch** (`v1.0.1`): bug fixes, copy corrections, data updates
- **Minor** (`v1.1.0`): new features, new tab, UI restructure
- **Major** (`v2.0.0`): full rebrand, new vertical, new auth system

---

## Client branch model (multi-client)

Each client gets their own branch for config + data customisation. See `docs/client-customisation.md` for full steps.

| Client | Branch | Vercel project | Production domain |
|---|---|---|---|
| Pharma Inc (HAE) | `demo-stable` | `ariya-signals-hae` | TBD |
| Next client | `client/<name>` → `demo-stable-<name>` | `ariya-signals-<name>` | TBD |

The `demo-stable` pattern repeats per client: a locked production branch that only receives promoted, reviewed merges.

---

*Last updated: 2026-06-14*
