# HANDOFF — read this first

**Purpose:** this file is the current state of this project, kept current — not
a changelog (git log is the changelog, don't duplicate it here). It exists so
that switching machines or Claude/Codex accounts is just `git pull` + "read
HANDOFF.md" instead of re-explaining everything by hand.

**Update discipline:** whoever (human or agent) stops work on this repo should
update this file before stopping — overwrite stale sections, don't append a
running log. If you're an agent picking this repo back up, read this file
fully before doing anything else, and don't trust your own guesses about
"what's probably done" over what's written here.

**Last updated:** 2026-09-08, end of a Signal Dedup & Event Clustering Run 1
session (Claude Code).

---

## Current branch

`fix/lexicon-tiebreak-and-sec-deals` — **2 commits ahead of
`origin/fix/lexicon-tiebreak-and-sec-deals`, not yet pushed.** Recent work on
this branch (newest first):

- `3f88ab7` Merge `main` into this branch
- `9914652` test(lexicon): strengthen tiebreak verification with raw output + confound checks
- `73edf1a` docs(ingest): note that `api/ingest/sec-deals.ts` is unreachable
- `b5bf75d` fix(ingest): persist inn/asset_id on trial_update signals
- `f07a391` feat(ingest): lexicon-match deal and press_release signals in run-sec-deals
- `9f55fc4` feat(lexicon): add lonvo-z synonym for lonvoguran ziclumeran
- `697247a` fix(lexicon): tiebreak multi-drug matches by text position, not row order
- `ca71223` feat(lexicon): multi-drug resolver with own-competitor tiebreak (§2.2)

Working tree has uncommitted changes to `.gitignore` and `.claude/launch.json`
(not yet reviewed/committed as of this writing).

## What just happened (most recent session)

**Signal Dedup & Event Clustering — Run 1 (reconnaissance only, nothing
implemented).** Full report and 14 artifacts in
[docs/signal-dedup-run1/](docs/signal-dedup-run1/) — start with
`SIGNAL_DEDUP_CLUSTERING_RUN1_FINAL_RCA.md`. One-line summary: no unified
Signal/Evidence pipeline exists; `company_signals`/`trials`/`regulatory_events`
are three parallel stores merged by three different, inconsistent, dedup-free
paths (`Portal.tsx`, `WarRoom.tsx`, `KeyEventsTab.tsx`); found 5 confirmed
real cross-source duplicate/corroboration cases plus a source_url provenance
bug in the congress/CSL ingest paths. Verdict:
`SIGNAL_DEDUP_CLUSTERING_RUN1_RECONNAISSANCE_VALIDATED`. **Nothing from this
run has been implemented — it's recon + a recommended architecture (Option B:
additive `event_clusters` table) + a Run 2 scope, awaiting review.**

## Open threads (don't assume any of these are done or abandoned)

- **Lexicon tiebreak + SEC deals fix** (current branch, above) — appears
  complete and tested but **not pushed to origin yet**. Push (with
  confirmation) before considering it "landed."
- **Signal Dedup Run 2** (see `docs/signal-dedup-run1/SIGNAL_DEDUP_CLUSTERING_RUN1_NEXT_RUN_PLAN.md`)
  — not started, explicitly gated on review of Run 1 first.
- **Multi-Source Signal Activation** — explicitly PAUSED pending Masterdata
  V1.2 content (this was the operating context Run 1 started from). Do not
  resume without checking whether that's changed.
- **`docs/` folder has several other untracked recon docs** from earlier
  sessions (`architecture-recon-2026-08-09.md`, `deferred-bugs-and-dead-code.md`,
  `inn-persistence-edge-function-status-2026...`) — worth skimming if picking
  up related threads; not summarized here to avoid this file going stale
  faster than it's updated.

## Sibling project: `ariya-lightci-python`

A separate, unrelated-by-name-collision Python prototype (competitive-
intelligence evidence pipeline, NOT the same as this app's own
`ariya-light-inn-persistence` branch — see the naming gotcha below). It has
its **own git repo and remote** (`github.com/Ayat-T523/ariya-lightci-python`)
and, as of this session, its **own `HANDOFF.md`** — read that repo's
`HANDOFF.md`, not this section, for its actual state.

A checked-out copy of it currently sits at `./ariya-lightci-python/` inside
*this* repo's working directory (untracked here, has its own `.git`) — that's
a leftover from an old handoff method (zip transfer), not a deliberate nested-
repo setup. It's safe to leave in place or move elsewhere; just don't confuse
its untracked presence here with it being part of this app.

**Naming gotcha (real, has caused confusion before):** this repo has a branch
`ariya-light-inn-persistence` (merged to `main` via PR #9) — a feature of
*this* React/TS app. `ariya-lightci-python` is a completely different Python
project that happens to share the words "Ariya" and "Light." Same name,
unrelated things.

**Old handoff artifacts in this repo's root you can ignore/eventually clean
up** (superseded by `ariya-lightci-python`'s own git repo + its `HANDOFF.md`):
`NEW_MACHINE_START_HERE.md`, `ORIENTATION_PROMPT.md`, `MANIFEST_sha256_population_evidence.txt`,
`BASELINE_pytest_report_population_evidence.txt`, `ariya_lightci_*.zip*`. Not
deleted in this session (wasn't asked to) — just no longer the recommended
path. See `NEW_MACHINE_START_HERE.md`'s own top section if you want the full
old-method instructions for reference.

## Machine/account switching protocol (the thing this file exists for)

1. **Before stopping:** commit your work — even incomplete/ugly — to a real
   branch and push it. A `git stash` never leaves this machine. Update this
   file's "What just happened" / "Open threads" sections to match reality.
2. **On the new machine/account:** `git pull` (or `git clone` if new), open
   Claude Code or Codex in this folder. `CLAUDE.md`/`AGENTS.md` both point
   here, so the agent reads this file automatically at session start — you
   shouldn't need to paste anything.
3. **Secrets don't travel via git** — `.env.local` (Supabase keys, Firecrawl
   key, etc.) must already exist independently on each machine. Not this
   file's job to manage.
