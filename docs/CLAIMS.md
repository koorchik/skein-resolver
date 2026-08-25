# CLAIMS — the claims–evidence matrix

Every claim, table row, and figure in the paper maps to its evidence here. This file doubles as
the paper's reproducibility statement. `evaluate` = `npm run evaluate -- --gold gold/gold.json
--hierarchy-all-splits --exclude-category Domain` — the paper's PRIMARY identity universe; drop
`--exclude-category Domain` for the labeled full-universe (secondary) values (+ `--split dev
--allow-dev --category Software` for development-subset rows, which need no universe flag).
Run dirs live in `runs/experiments/`; the commit is the repo commit containing the run dir.

## Factorial cells (paper Tables 2–4, Figs. 2–3)

| claim | runs | command |
|---|---|---|
| A1 (flash+gembed2) identity/hierarchy, 3 replicates | t-a1-flash-gembed2-r{1,2,3}-* | evaluate --run <dirs> |
| A2 (flash+egemma) identity/hierarchy, 3 replicates | t-a2-flash-egemma-r{1,2,3}-* | evaluate --run <dirs> |
| B1 (31b+egemma) identity/hierarchy, 3 replicates | t-b1-31b-egemma-r{1,2,3}-* | evaluate --run <dirs> |
| B2 (31b+gembed2) identity/hierarchy, 3 replicates | t-b2-31b-gembed2-r{1,2,3}-* (r2 continues a documented prefix transplant — see its TRANSPLANT.md) | evaluate --run <dirs> |

## Per-category autopsy (paper §5.1–5.2)

| claim | runs | command |
|---|---|---|
| 148 multi-cluster concepts; Domain 95 (ukr.net chain = 41 clusters); Software 45 (CVE pairs) | t-a2-flash-egemma-r3-b3469137a5a0 | python autopsy over registry.json vs gold (script in analysis/) |
| HackerGroup pairwise .857, merge P 1.000 | t-a2-flash-egemma-r1-* | evaluate --category HackerGroup --run <dir> |
| Software slice .467–.643 | t-a2-flash-egemma-r{1,2,3}-* | evaluate --category Software --run <dirs> |

## Baselines (paper Table 5)

| claim | runs | command |
|---|---|---|
| exact floor .000 pairwise / .940 B³ / .945 NIL primary (.975/.977 full) | t-floor-exact-801d8a071dff | evaluate --run <dir> |
| emb-threshold collapse (primary pairwise .068 egemma / .064 gembed2; full .010/.016) | t-floor-thresh-egemma-2ec736b05fe3, t-floor-thresh-gembed2-cc286ae9584f | evaluate --run <dirs> |
| batch Ψ_norm pairwise .551 primary (.085 full), B³ .963, no NIL, no edges | data/baselines/psi-norm/entities.json | evaluate --batch <file> [--exclude-category Domain] |
| EOS anchor pairwise .573 primary (.251 full) / R-reach .758 | t-anchor-eos-732631563fe0 | evaluate --run <dir> |
| hybrid exact+review pairwise .378 primary (.167 full) / R-reach .713 | t-base-exact-e318f94256cb | evaluate --run <dir> |

## Order sensitivity (paper Table 7, Fig. 6)

| claim | runs | command |
|---|---|---|
| A1 cross-order ARI .195 / Edge-J .336 / kind .815 | t-a1 r1 + rev + shuf42 | npm run order-ari -- --run <3 dirs> |
| A1 same-order control .130/.459/.784 | t-a1 r1+r2+r3 | order-ari |
| A2 same-order control .257/.397/.810 | t-a2 r1+r2+r3 | order-ari |
| B1 cross-order ARI .533 / Edge-J .282 | t-b1 r1 + rev + shuf42 | order-ari |
| B1 same-order control .707/.389/.866 | t-b1 r1+r2+r3 | order-ari |

## Ablations on gemma4:31b (paper Table 8; development subset, relative)

| claim | runs |
|---|---|
| v8 baseline .789/.811, identity 1.000 | dev-v8-31b-think-s1-4070fd2ee36f |
| decoupling +.359 [.195,.498], p=.0002 Holm .0004 (analysis/out/stats-dev-decoupling.json) | + dev-v8-31b-coupled-1d512490f79a via `npm run stats` |
| edge-array coupled .684/.794 | dev-v8-31b-edgearray-3e02bd762079 |
| thinking OFF identity .333, tokens 22k vs 241k | dev-v8-31b-nothink-25fbe54609aa |
| samples=2 no gain, P −.13, 3× tokens | dev-v8-31b-think-s2-2c9ece888e90 |
| evidence head/none: precision mechanism | dev-v8-31b-snip-head-*, dev-v8-31b-snip-none-* |
| sibling injection harmless at 31b (identity 1.000) | dev-v8-31b-siblings-c4fb9c2f29b8 |
| emb-only blocker .813/.685 | dev-v8-31b-embonly-44c0889b7604 |
| flash cross-checks .772–.797 / .851–.938 | dev-v8-flash-{egemma,gembed2,embonly,union}-* |

## Blocker intrinsic (paper Table 9, Fig. 7)

| claim | source |
|---|---|
| union-rr .860/.896 > emb-only .842/.887 > RRF .743/.829 > string .658/.752 (egemma); union-rr .887/.932 vs emb-only .842/.910 (gembed2) | analysis/out/blocker.json; `npm run blocker-bench -- --generators <g> --k 4,10 --split test` |

## Statistics

| claim | source |
|---|---|
| BCa CIs + permutation + Holm implementation | bin/stats.ts over src/Evaluation/bootstrap.ts (protocol: docs/statistical-protocol.md) |
| decoupling delta CI (dev) | `npm run stats -- --gold gold/gold.json --split dev --allow-dev --category Software --run <s1> --run <coupled>` |

## Cost accounting (paper Table 10, Fig. 8)

Token/call figures come from each run's `run-card.json` (`cost` block) — never from logs.

## Figures

All regenerate offline: `python3 analysis/figures.py` + `python3 analysis/fig_ladder.py` +
`python3 analysis/diagram.py` (inputs: analysis/out/*.json built by the evaluate/order-ari
commands above, plus runs/experiments/*/metrics.json for the ladder scatters).
Exception: Table 9 / the blocker figure need a live encoder (embeddings cache not shipped).

## Guard, ladder, and robustness arms (paper §5.2 guard, §5.3 FS row, §5.4 ladder, Table 6, §6 threats)

| claim | runs | command |
|---|---|---|
| Guard v2: Domain chains 106→0, full-universe B³ +0.020 (primary −0.015) Holm p=0.0002, R-reach ns (p=.12) | t-a2guard2-flash-egemma-r{1,2,3} | evaluate --run <dirs>; stats → analysis/out/stats-guard.json, stats-a2-contrasts-primary.json |
| Guard v1 mechanism intermediate (2 link vetoes; 137 review-merge aliases) | t-a2guard-flash-egemma-r1-8b09da6a0dfb | evaluate --run <dir> + registry autopsy vs gold |
| Pseudonymization: stratum-a R unchanged (HG 1.000, SW .917); HG c .700→.200 | t-a2obf-flash-egemma-r1 | evaluate --gold gold/gold-obf.json --run <dir> (+ --category HackerGroup/Software) |
| Identity self-consistency buys nothing (P(a) .077, +28% tokens) | t-a2cons-flash-egemma-r1 | evaluate --run <dir> |
| Ladder identity: naive .594/.559/.609, coupled .600/.580/.628 (primary pairwise) | t-naive-flash-egemma-r{1,2,3}, t-a2coupled-flash-egemma-r{1,2,3} | evaluate --run <dirs> |
| Ladder hierarchy: naive R-reach .380-.406 / edge P .43-.48; coupled .428-.487 / .25-.44; decoupling delta +0.238 [0.183, 0.295], +0.319 [0.267, 0.371] (vs coupled r1 / naive r1; Holm p=0.0012 in the twelve-test family) | same dirs | stats vs t-a2-flash-egemma-r1 → analysis/out/stats-decoupling-flash.json |
| 31b decoupling delta +0.262 [0.201, 0.320] Holm p=0.0002; coupled R-reach .474, pairwise .613 primary, 2.3M tokens | t-b1coupled-31b-egemma-r1-341230de6075 | stats vs t-b1-31b-egemma-r1 → analysis/out/stats-decoupling-31b.json |
| Fellegi–Sunter floor .080 pairwise primary (.077 full), no LLM | t-base-fs-string-514a7295d494 | evaluate --run <dir> |
| Gold κ audit (.848/.848/.906, majority .943, Fleiss .603) | gold/gold.json `models`/`sources` fields | python over gold.json (no runs) |
| Mint gloss coverage 59–83% per factorial arm, 70% overall | runs/experiments/t-{a1,a2,b1,b2}-*/decisions.jsonl | python over mint records (gloss non-null share) |
| Category CIs at fixed encoder (HG tied, delta .000 p=1.0; SW +.017 p=.0001; Domain +.037 p=.0001) | t-b1-31b-egemma-r1 + t-a2-flash-egemma-r1 | `npm run stats -- --category <cat> --run <b1> --run <a2>` → analysis/out/stats-category-*.json |
| Pooled-candidate sensitivity: on independent-provenance rows only, decoupling +0.176 flash / +0.219 31b (both sig), B1-vs-A2 R-reach tie, guard R-reach ns (p=.427) | same ladder/guard dirs | `python3 scripts/gold-slice.py --exclude-rule pooled-adjudication <tmp>` + stats → analysis/out/stats-*-independent.json |

Obfuscated inputs: data/obf-extractions/, gold/gold-obf.json — regenerate
with `python3 scripts/make-obfuscated.py` (seed 20260824, deterministic).
