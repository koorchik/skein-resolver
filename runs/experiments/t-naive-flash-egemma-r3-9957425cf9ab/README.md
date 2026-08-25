# t-naive-flash-egemma-r3

Naive zero-shot baseline, replicate 3.

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

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-naive-flash-egemma-r3-9957425cf9ab`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Pairwise .608, B³ .990, R-reach .386, edge P .426, kind .953 (350 edges).

See `docs/CLAIMS.md` for the claims this run backs.
