# Start here — moving Ariya Light CI to a new computer / Claude account

> **⚠️ SUPERSEDED (2026-09-08).** `ariya-lightci-python` is now on GitHub
> (`github.com/Ayat-T523/ariya-lightci-python`) with its own `HANDOFF.md` and
> a `CLAUDE.md` that auto-loads it. New protocol: `git clone`/`git pull` that
> repo, open Claude Code in it, done — no zip download, no sha256 manifest
> check, no pasting `ORIENTATION_PROMPT.md`. Kept below for reference only
> (e.g. if you ever need to re-verify an old zip artifact still sitting
> around) — don't follow it as the primary path anymore.

## 0. Naming gotcha — read this first

This same GitHub repo (`github.com/Ayat-T523/Ariya-Signals`, remote `origin`) also has an
UNRELATED branch called `ariya-light-inn-persistence` (merged into `main` via PR #9). That
branch is a feature of the **real product** (a leaner/faster "Ariya Light" mode of the actual
React/TS/Supabase app) — nothing to do with **Ariya Light CI**, the standalone Python
evidence-pipeline prototype this handoff package is about. Same "Ariya Light" name, two
completely different things. If you're picking this handoff back up, you want the Python
prototype (`ariya-lightci-python/`), not that branch.

There is also `origin/claude/ariya-lightci-two-step-eckocz` (commit `8bcb1d9`,
`BACKEND_REPLACEMENT_PLAN.md`) — a real, detailed recon of how this Python pipeline's
`FactAnswer` model could replace the Ariya-Signals app's current Supabase data layer. Recon
only, nothing implemented from it. Worth reading if you're picking up backend-replacement work
specifically (see `ORIENTATION_PROMPT.md`'s last section), otherwise ignore it.

## 1. Download these files and put them together in ONE new local folder

e.g. `~/ariya-work/` (same convention as before) — download everything below into it:

- `ariya_lightci_v1_population_evidence_foundation_20260819_1511green.zip`
- `ariya_lightci_v1_population_evidence_foundation_20260819_1511green.zip.sha256`
- `MANIFEST_sha256_population_evidence.txt`
- `BASELINE_pytest_report_population_evidence.txt`
- `ORIENTATION_PROMPT.md` (this is a prompt for you to paste into Claude Code — not a file Claude Code reads from disk)

## 2. Verify integrity, then unzip

```
cd ~/ariya-work/
sha256sum -c ariya_lightci_v1_population_evidence_foundation_20260819_1511green.zip.sha256
unzip ariya_lightci_v1_population_evidence_foundation_20260819_1511green.zip
cd ariya-lightci-python
sha256sum $(find . -type f -not -path '*/__pycache__/*' -not -path '*/.pytest_cache/*') > /tmp/check_manifest.txt
diff <(awk '{print $1}' /tmp/check_manifest.txt | sort) <(awk '{print $1}' ../MANIFEST_sha256_population_evidence.txt | sort)
```
(The `diff` should be empty. If it isn't, don't proceed — re-download. Manifest paths are
already root-relative to `ariya-lightci-python/` — e.g. `./discovery_population_evidence.py` —
so no path-prefix stripping is needed here, unlike the 2026-08-14 package's instructions.
Comparing only the hash column, not full lines, deliberately — `sha256sum` marks files
`*path` (binary mode) vs. `  path` (two-space, text mode) depending on platform/build, which
is a real, confirmed cosmetic difference between how this manifest was generated and how a
receiving machine's own `sha256sum` may format its output — not a content mismatch. A full-line
`diff` can show spurious differences here even when every file is byte-identical.)

Note: the zip's internal paths already include the `ariya-lightci-python/` top-level folder
(unlike the previous 2026-08-14 package, whose manifest paths were zip-root-relative) — `unzip`
alone recreates it as a sibling of this file, no `-d` flag needed.

One real thing this zip deliberately does NOT contain: `deploy/searxng/.env` (a live secret,
`SEARXNG_SECRET=...`) — excluded on purpose, same reason it's `.gitignore`d in the real product
repo. `deploy/searxng/.env.example` IS included, showing the expected shape; regenerate your own
`.env` locally if you need to run the SearXNG deployment.

## 3. Confirm the baseline still holds on this machine

```
pip install jsonschema --break-system-packages   # or your environment's equivalent
python3 -m pytest -q
```
Expect **1511 passed, 8 warnings** (the 8 warnings are pre-existing and unrelated — a
`bs4.XMLParsedAsHTMLWarning` in `adapters/sec_filings.py`, not a new gap). Compare against
`BASELINE_pytest_report_population_evidence.txt` if anything differs.

## 4. Clone the real product repo as a sibling directory (only needed if you continue toward STEP2-style backend-replacement work)

```
git clone https://github.com/Ayat-T523/Ariya-Signals.git
```
See the naming gotcha in §0 above before touching that repo's branches. `main` is the real
product's mainline; `BACKEND_REPLACEMENT_PLAN.md` lives on `claude/ariya-lightci-two-step-eckocz`
specifically, not on `main`.

## 5. Start Claude Code from `~/ariya-work/ariya-lightci-python/`, paste `ORIENTATION_PROMPT.md`'s contents as your first message

It briefs the new session on everything done so far — including the relationship-classification
investigation (STEP 2 → STEP 3B.1) that is this package's own reason for existing — what's real
vs. architecture-only, and the exact open questions/blockers, without asking it to redo any of
that work.
