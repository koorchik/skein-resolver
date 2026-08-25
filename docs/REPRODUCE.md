# REPRODUCE — every arm, exact commands

All arms run through `scripts/run-arm.sh` (the two-phase pre-seed dance is automated; see
CLAUDE.md). Replicates of the same configuration MUST use distinct `CONDITION` names
(`…-r1/-r2/-r3`) — the condition is folded into the runId, and two runs with the same runId
resume each other instead of replicating.

Scoring is free (no LLM calls) and re-runs baselines in the same table:

```bash
# test split (reportable)
npm run evaluate -- --gold gold/gold.json --hierarchy-all-splits \
  --run runs/experiments/<dir> [--run …] --batch data/baselines/psi-norm/entities.json

# dev subset (iteration only, NON-REPORTABLE)
npm run evaluate -- --gold gold/gold.json --split dev --allow-dev --category Software \
  --hierarchy-all-splits --run runs/experiments/<dir> [--run …]
```

## Environment

`.env` needs `GEMINI_API_KEY` (cloud stack) and `OLLAMA_API_KEY` (ollama.com). embeddinggemma
needs a local ollama server (`ollama pull embeddinggemma`). Duration notes below are planning
info only — never report wall time.

## The four factorial cells (test split, 204 docs, all categories)

```bash
# A1 — cloud stack: flash judge + gemini embeddings
CONDITION=t-a1-flash-gembed2-r1 LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash TEMPERATURE=0 \
  EMBEDDINGS_PROVIDER=gemini EMBEDDINGS_MODEL=gemini-embedding-2 scripts/run-arm.sh

# A2 — flash judge + embeddinggemma
CONDITION=t-a2-flash-egemma-r1 LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash TEMPERATURE=0 \
  scripts/run-arm.sh

# B1 — open-weight stack: gemma4:31b (ollama cloud, thinking ON = default) + embeddinggemma
CONDITION=t-b1-31b-egemma-r1 LLM_PROVIDER=ollama LLM_MODEL=gemma4:31b \
  OLLAMA_CLOUD=1 OLLAMA_NUM_CTX=65536 JUDGE_SAMPLES=<from Phase A> scripts/run-arm.sh

# B2 — gemma4:31b + gemini embeddings
CONDITION=t-b2-31b-gembed2-r1 LLM_PROVIDER=ollama LLM_MODEL=gemma4:31b \
  OLLAMA_CLOUD=1 OLLAMA_NUM_CTX=65536 JUDGE_SAMPLES=<from Phase A> \
  EMBEDDINGS_PROVIDER=gemini EMBEDDINGS_MODEL=gemini-embedding-2 scripts/run-arm.sh
```

Replicates: repeat with `-r2`, `-r3`.

**Order-sensitivity arms (A1 and B1 — a headline claim of the paper, not an optional extra):**
same command with `ORDER=reverse` (`-rev` in the condition name) and `ORDER=seededShuffle:42`
(`-shuf42`). Score order robustness with:
```bash
npm run order-ari -- --run <numeric-runDir> --run <reverse-runDir> --run <shuffle-runDir>
```
(cross-order identity ARI, edge Jaccard, type agreement — the "registry final after every
document ⇒ arrival order stops being a treatment" evidence).

## Baselines (test split)

```bash
# exact-string floor (no LLM)
CONDITION=t-base-exact DECISION_STRATEGY=exact-only EMBEDDINGS=0 CANDIDATE_GENERATOR=string-sim \
  LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash scripts/run-arm.sh
# embedding-threshold (no LLM), one per encoder
CONDITION=t-base-thresh-egemma DECISION_STRATEGY=threshold scripts/run-arm.sh
CONDITION=t-base-thresh-gembed2 DECISION_STRATEGY=threshold \
  EMBEDDINGS_PROVIDER=gemini EMBEDDINGS_MODEL=gemini-embedding-2 scripts/run-arm.sh
# published batch Ψ_norm — no run needed; score with --batch data/baselines/psi-norm/entities.json
# end-of-stream consolidation anchor (non-streaming)
CONDITION=t-anchor-eos SKOS_CONSOLIDATE=end LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash \
  TEMPERATURE=0 scripts/run-arm.sh
```

## Dev subset (Phase A revalidation + Phase B′ ablations)

Materialize the subset once per boot: `npm run make-subset -- --list
gold/subsets/dev-software-22.txt --from data/fetched --to /tmp/subset-dev-software`, then add
`INPUT_DIR=/tmp/subset-dev-software CATEGORIES=Software` to any command above.

Phase B′ ablation knobs (each vs the B-configured baseline arm, on gemma4:31b):

| ablation | knob delta |
|---|---|
| coupled single-call | `DECOUPLE=0 LISTWISE_PROMPT_ID=listwise-skos-v7` |
| set-level edge array | `DECOUPLE=0 LISTWISE_PROMPT_ID=listwise-skos-v4` |
| thinking OFF | `OLLAMA_THINK=0` |
| nested-JSON transport | `DECOUPLE=0 LISTWISE_PROMPT_ID=listwise-skos-v7` (v7 doc dialect) vs JSONL id pass |
| evidence windows | `SNIPPET_MODE=head` / `none` / `anchored` |
| sibling injection | `DOC_SIBLINGS=3 DOC_SIBLINGS_MODE=options` |
| self-consistency | `JUDGE_SAMPLES=1` vs `2` |
| letter vs word codes | `DECOUPLE=0 LISTWISE_PROMPT_ID=listwise-skos-v1` vs `listwise-skos-v2` |
| blocker end-to-end | `CANDIDATE_GENERATOR=embedding` / `union` / `union-rr` |

Intrinsic blocker curves: `npm run blocker-bench` against a headline run's registry states.
Rollup evidence: `npm run fold -- --run <dir> …` on final registries.

## Regenerating paper tables/figures

`npm run evaluate … --json analysis/out/<name>.json` for machine-readable tables;
`npm run stats` (bootstrap CIs + permutation) and the chart scripts in `analysis/` consume those.
Everything regenerates offline from committed `runs/` artifacts.

## Figures and SKOS export

Every paper figure regenerates offline: `python3 analysis/figures.py`,
`python3 analysis/fig_ladder.py` (the two ladder precision–recall scatters,
reading `runs/experiments/*/metrics.json`), and `python3 analysis/diagram.py`
(the architecture diagram). Exception: the blocker benchmark (paper Table 9 /
Fig. 7) needs a live encoder — the embeddings cache is not shipped.

Any final registry exports to SKOS Turtle offline:
`npm run export-skos -- runs/experiments/<dir>/registry.json out.ttl`
(a worked example ships as `analysis/out/registry-a2r2.ttl`).
