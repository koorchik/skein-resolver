# t-naive-flash-egemma-r1

Naive zero-shot baseline (prompting-ladder bottom rung).

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

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-naive-flash-egemma-r1-b15838916dfc`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Pairwise .591, B³ .989, merge P(a)/R(a) .810/.773; hierarchy 326 edges, R-reach .406, edge P .482, kind .930. Plain prompting yields a flat-ish but real graph; v8's review pass adds +0.319 [0.267, 0.371] reachable recall (Holm p=0.0004).

See `docs/CLAIMS.md` for the claims this run backs.
