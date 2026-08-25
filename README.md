# skein-resolver

Experiment repository for the **SKEIN-R** paper: *streaming construction of a SKOS/ISO-25964-
aligned concept registry from cybersecurity incident reports* — entity identity (link-or-mint
with NIL), typed broader hierarchy (BTG/BTP/BTI) under a write-time acyclicity guard, and per-document finality
("anytime consistency": two LLM judge passes per document, no batch passes, registry final
after every document).

The paper compares a **cloud-frontier stack** (gemini-3.7-flash + gemini-embedding-2) against an
**open-weight stack** (gemma4:31b + embeddinggemma) as a 2×2 judge×encoder factorial on a frozen
corpus of 204 CERT-UA incident reports, against a frozen gold table (3,201 clusters, 398 typed
hierarchy edge rows — 392 distinct cluster pairs, 4,069 NIL labels).

## Finding your way around

- **Browse every experiment in the browser — no clone needed:**
  <https://koorchik.github.io/skein-resolver/> — per-document playback of any of the 50 arms
  (decisions, ballots, full LLM transcripts), with a side-by-side compare mode; deep-linkable,
  e.g. [headline vs. flash on the same encoder](https://koorchik.github.io/skein-resolver/#run=t-b2-31b-gembed2-r1-efdded22cfb6&vs=t-a2-flash-egemma-r1-a7d0a4e56984).
  The site is served from this repository's `gh-pages` branch and regenerates with
  `scripts/build-pages.py` (see its docstring).

- **The paper's headline result** — the open-weight B2 factorial cell, best identity of any arm
  (pairwise F1 .661, B-cubed .975 on the primary universe) at hierarchy parity:
  `runs/experiments/t-b2-31b-gembed2-r1-*`.
- **The paper's remediated configuration** — the identifier guard closing the review-pass
  chain-merge door (§5.2): `runs/experiments/t-a2guard2-flash-egemma-r1-*`.
- **What each experiment is for** — one-line purpose per directory, grouped by paper section:
  [`runs/experiments/README.md`](runs/experiments/README.md). Every directory also carries its
  own `README.md` with purpose, configuration, and result.
- **Which run backs which claim** — the claims–evidence matrix
  [`docs/CLAIMS.md`](docs/CLAIMS.md): every table row and figure in the paper, mapped to its
  run directory and the exact scoring command.
- **Re-running anything** — [`docs/REPRODUCE.md`](docs/REPRODUCE.md).

## Layout

- `src/`, `bin/` — the streaming pipeline + scorer (TypeScript, ts-node, no build step).
- `data/` — the frozen corpus, extractions, and the published batch baseline registry.
- `gold/` — the frozen gold table (see `gold/README.md`).
- `docs/` — runbooks (`REPRODUCE.md`), the claims–evidence matrix (`CLAIMS.md`), the
  pre-registered `statistical-protocol.md`, and design evidence carried from the development
  repo. The public repository is exported as a single commit; the protocol's registration
  ordering is internal to the development lineage.
- `runs/` — committed experiment artifacts (run cards, registries, decision logs);
  `runs/imported/` holds the two development-repo reference runs used as the extraction
  parity gate (see its README) — not paper experiments.
- `analysis/` — scripts that regenerate every paper table and figure offline from `runs/`.

Quick start: `npm install`, copy `.env.example` → `.env`, then see `docs/REPRODUCE.md`.

This repository is the exported publication artifact. The `git` fingerprints inside each run's
`run-card.json` refer to the development lineage the runs were executed under; the code here is
the exact exported snapshot of that lineage.

Predecessor: V. Turskyi, *"A Formal Model for Constructing Sensitive Data Graphs from Cyber
Reports using Large Language Models"*, TACS 7(2), 2025 — this repo supplies the quantitative
evaluation and the streaming replacement for that paper's batch normalization stage.
