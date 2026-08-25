# t-naive-flash-egemma-r2

Naive zero-shot baseline, replicate 2.

## Configuration

```
LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=listwise-graph DECOUPLE=0 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
TEMPERATURE=0
SNIPPET_MODE=none
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-naive-flash-egemma-r2-fcacc5eb0a57`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Pairwise .556, B³ .989, R-reach .380, edge P .444, kind .952 (331 edges).

See `docs/CLAIMS.md` for the claims this run backs.
