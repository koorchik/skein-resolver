# t-floor-exact

Pure baseline: exact-string identity floor, NO LLM anywhere. Verdict: exact matching contributes ZERO alias resolution (gold clusters group distinct surfaces; same-surface mentions are the same element) — pairwise F1 .000, B3 .975 (singletons), NIL .977. The honest floor of the whole task. Test split, REPORTABLE.

## Configuration

See `run-card.json` (runId `t-floor-exact-801d8a071dff`).

## Artifacts

- `registry.json`; `decisions.jsonl`; `llm-calls/` (empty for pure floors); `run-view.html`
