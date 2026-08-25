# t-a2guard2-flash-egemma-r3

Review-response E1, guard v2, replicate 3 (see r1/r2).

## Configuration

```
LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=listwise-graph DECOUPLE=1 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
TEMPERATURE=0
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-a2guard2-flash-egemma-r3-1f9ba4900431`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Pairwise F1 .488, B³ .982, merge P(a)/R(a) .286/.818, R-reach .652; 118 review-merge vetoes; Domain multi-cluster 0.

See `docs/CLAIMS.md` for the claims this run backs.
