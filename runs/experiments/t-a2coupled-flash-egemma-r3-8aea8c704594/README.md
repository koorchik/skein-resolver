# t-a2coupled-flash-egemma-r3

Coupled single-call ablation, replicate 3 (see r1).

## Configuration

```
LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=listwise-graph DECOUPLE=0 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
TEMPERATURE=0
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-a2coupled-flash-egemma-r3-8aea8c704594`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Pairwise .621, B³ .989, R-reach .457, edge P .248, kind .952 (678 edges — the edge-volume outlier of the trio).

See `docs/CLAIMS.md` for the claims this run backs.
