# t-b1-31b-egemma-r2

Test-cell replicate (resumed after deadline triage pause).

## Configuration

```
LLM_PROVIDER=ollama LLM_MODEL=gemma4:31b
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=listwise-graph DECOUPLE=1 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
JUDGE_SAMPLES=1
OLLAMA_CLOUD=1
OLLAMA_NUM_CTX=65536
OLLAMA_THINK=1
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-b1-31b-egemma-r2-97c12da94c38`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Pairwise F1 .561, B³ .980, NIL .992, R-reach .733, edge P .213, kind .877; ~10.1M tokens (paper Tables 2-3).

See `docs/CLAIMS.md` for the claims this run backs.
