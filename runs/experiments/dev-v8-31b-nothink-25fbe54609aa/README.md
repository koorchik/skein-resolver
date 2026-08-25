# dev-v8-31b-nothink-25fbe54609aa

Phase B' ablation: gemma4:31b thinking OFF (OLLAMA_THINK=0) — the identity-collapse row of the thinking on/off pair, measured in this repo. Identity .333 (zero stratum-a alias merges), R-reach .697; ~10x cheaper output tokens. Proves reasoning tokens are necessary for identity on open-weight gemma at 31b. Dev subset, NON-REPORTABLE.

## Configuration

See `run-card.json` — the authoritative config + git/prompt fingerprint for this run
(runId `dev-v8-31b-nothink-25fbe54609aa`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

(summary above; authoritative tables regenerate via `npm run evaluate` — see docs/CLAIMS.md)
