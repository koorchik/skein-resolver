# t-a2guard2-flash-egemma-r1

Review-response E1, guard v2, replicate 1. Guard v1 (identity-pass link veto only) was measured insufficient: it fired twice per corpus while the chain-merge class actually formed in the review pass, whose source-free 'link' verdicts merge whole concepts (137 cross-surface Domain aliases in t-a2guard-flash-egemma-r1 arrived as review merges). v2 additionally vetoes review-pass concept merges when some rigid-identifier type is present on both sides with no shared value. The v1 arm is retained as the mechanism-locating intermediate.

## Configuration

```
LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=listwise-graph DECOUPLE=1 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
TEMPERATURE=0
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-a2guard2-flash-egemma-r1-ad954c0c876e`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Pairwise F1 .460, B³ .979, merge P(a)/R(a) .184/.864, R-reach .742, kind .882; 376 review-merge vetoes; Domain multi-cluster concepts 0 (was 106 unguarded). Identity B³ +0.020 [0.016, 0.025] over A2-r1, Holm p=0.0002; hierarchy unchanged (p=0.12).

See `docs/CLAIMS.md` for the claims this run backs.
