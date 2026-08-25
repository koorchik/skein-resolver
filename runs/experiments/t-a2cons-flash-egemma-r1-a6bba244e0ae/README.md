# t-a2cons-flash-egemma-r1

Review-response E3: identity-pass self-consistency. Identical to t-a2-flash-egemma-r1 plus IDENTITY_SAMPLES=3 — the same listwise ballot asked three times, decisions aggregated by the strategy's built-in self-consistency. Tests the reviewers' 'consensus mechanism' suggestion: zero-temperature cloud serving is nondeterministic and replicate variance in pairwise F1 is dominated by a handful of chain merges; does majority voting damp it at ~3x identity-pass token cost?

## Configuration

```
LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=listwise-graph DECOUPLE=1 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
TEMPERATURE=0
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-a2cons-flash-egemma-r1-a6bba244e0ae`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Negative result, as designed to test: 3-sample identity majority voting does NOT damp the instability (pairwise .376, merge P(a) .077 ≈ A2's .053) at +28% tokens (6.0M) — the chain merges form in the review pass, so consensus on the identity ballot targets the wrong operator.

See `docs/CLAIMS.md` for the claims this run backs.
