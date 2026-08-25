# t-a2coupled-flash-egemma-r1

Corpus-scale coupled single-call ablation (decoupling comparison).

## Configuration

```
LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=listwise-graph DECOUPLE=0 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
TEMPERATURE=0
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-a2coupled-flash-egemma-r1-49c56fbb85c8`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Pairwise F1 .597, B³ .989, merge P(a)/R(a) .667/.818; hierarchy 416 edges, R-reach .487, edge P .440, kind .940. Single call builds a real graph at higher edge precision than v8; the decoupled review pass adds +0.238 [0.183, 0.295] reachable recall (Holm p=0.0004).

See `docs/CLAIMS.md` for the claims this run backs.
