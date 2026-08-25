# dev-v8-31b-snip-none

Phase B' ablation: SNIPPET_MODE=none (no evidence block). Same pattern: R-reach .795 but P .674 vs .811 — per-mention evidence buys precision at 31b, not recall. Dev subset, NON-REPORTABLE.

## Configuration

See `run-card.json` (runId `dev-v8-31b-snip-none-c5a49d5be605`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page
