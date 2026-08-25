# dev-v8-31b-snip-head

Phase B' ablation: SNIPPET_MODE=head (document head instead of per-mention windows). At 31b evidence windows are a PRECISION mechanism: R-reach .756 (≈baseline) but P .656 vs .811. Dev subset, NON-REPORTABLE.

## Configuration

See `run-card.json` (runId `dev-v8-31b-snip-head-7ea416e4407f`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page
