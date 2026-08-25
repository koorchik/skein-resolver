# dev-v8-31b-edgearray

Phase B' ablation: coupled single-call with the set-level edge array (DECOUPLE=0, listwise-skos-v4 'e' array). At 31b the edge array substantially repairs the coupled call (R-reach .684 / P .794 vs the v7 coupled .430/.567) but still trails the decoupled two-pass (.789/.811), which additionally guarantees per-document finality. Dev subset, NON-REPORTABLE.

## Configuration

See `run-card.json` (runId `dev-v8-31b-edgearray-3e02bd762079`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page
