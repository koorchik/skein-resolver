# t-a2guard2-flash-egemma-r2

Review-response E1, guard v2, replicate 2 (see r1).

## Configuration

```
LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=listwise-graph DECOUPLE=1 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
TEMPERATURE=0
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-a2guard2-flash-egemma-r2-0c35c0c3d8ad`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Pairwise F1 .445, B³ .977, merge P(a)/R(a) .184/.864, R-reach .704; 46 review-merge vetoes; Domain multi-cluster 0. Guard trio pairwise spread .043 vs unguarded A2 .328.

See `docs/CLAIMS.md` for the claims this run backs.
