# t-b2-31b-gembed2-r2

Replicate 2 of the B2 factorial cell (gemma4:31b judge + gemini-embedding-2 encoder, v8
decoupled, full 204-document test corpus). Completes the B2 replicate triplet for the paper's
Tables 2-3 and the replicate-stability comparison against the flash cells. Continues the transplanted 119-document prefix (see TRANSPLANT.md).

## Configuration

```
LLM_PROVIDER=ollama LLM_MODEL=gemma4:31b OLLAMA_CLOUD=1 OLLAMA_NUM_CTX=65536 OLLAMA_THINK=1
EMBEDDINGS_PROVIDER=gemini EMBEDDINGS_MODEL=gemini-embedding-2
DECISION_STRATEGY=listwise-graph DECOUPLE=1 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0 JUDGE_SAMPLES=1
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-b2-31b-gembed2-r2-2c1e63fe637d`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Identity pairwise F1 .602, B³ .976, reachable edge recall .645 — see docs/CLAIMS.md.


**Cost accounting note.** Per TRANSPLANT.md, this replicate continues a 119-document
prefix; the run card meters the resumed portion only (477 judge calls, 6.2M tokens).
