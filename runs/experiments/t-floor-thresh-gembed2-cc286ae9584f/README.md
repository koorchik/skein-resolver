# t-floor-thresh-gembed2

Pure baseline: embedding-threshold merge (gemini-embedding-2), NO LLM (DECOUPLE=0). REPORTABLE.

## Configuration

```
LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash
EMBEDDINGS_PROVIDER=gemini EMBEDDINGS_MODEL=gemini-embedding-2
DECISION_STRATEGY=threshold DECOUPLE=0 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-floor-thresh-gembed2-cc286ae9584f`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Pairwise F1 .016, B³ .702, NIL .699 — catastrophic over-merge (merge P(a) .001 at R(a) .818): cosine threshold alone cannot do identity (paper Table 5).

See `docs/CLAIMS.md` for the claims this run backs.
