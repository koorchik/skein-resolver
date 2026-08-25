# t-base-fs-string

Review-response E4: classical unsupervised ER baseline. Fellegi–Sunter probabilistic record linkage (literature-standard m/u priors, deliberately not fitted — fitting would need the gold that scores it) over the string-similarity candidate channel; zero LLM calls, zero embeddings. Answers the reviewer request for a classical ER baseline stronger than the exact-string floor.

## Configuration

```
LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=fellegi-sunter DECOUPLE=0 ORDER=numeric-id
CANDIDATE_GENERATOR=string-sim CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-base-fs-string-514a7295d494`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Pairwise F1 .077, B³ .974, NIL .965, merge P(a)/R(a) .286/.273, no hierarchy, zero LLM calls — classical record linkage with unfitted literature priors captures near-string aliases and nothing else (paper Table 5).

See `docs/CLAIMS.md` for the claims this run backs.
