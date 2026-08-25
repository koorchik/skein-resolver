# t-floor-thresh-egemma

Pure baseline: embedding-threshold merge (embeddinggemma, no LLM). Catastrophic over-merge at corpus scale: merge P(a) .001 at R(a) .864, pairwise F1 .010 — the CESI-style collapse, now measured for dense thresholds. Test split, REPORTABLE.

## Configuration

See `run-card.json` (runId `t-floor-thresh-egemma-2ec736b05fe3`).

## Artifacts

- `registry.json`; `decisions.jsonl`; `llm-calls/` (empty for pure floors); `run-view.html`
