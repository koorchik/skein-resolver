# t-a2guard-flash-egemma-r1

Review-response E1: the §3.4 type-aware identifier guard, measured. Identical to t-a2-flash-egemma-r1 (flash judge + embeddinggemma encoder, v8 decoupled) plus IDENTITY_GUARD=1 — a deterministic veto on identity-pass link verdicts between distinct rigid identifiers (Domain FQDNs; CVE/IP/hash/email anywhere). Tests whether removing the identifier chain-merge class (Domain ukr.net chain, CVE pairs — §5.2 error audit) recovers corpus-level pairwise identity F1.

## Configuration

```
LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=listwise-graph DECOUPLE=1 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
TEMPERATURE=0
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-a2guard-flash-egemma-r1-8b09da6a0dfb`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Guard v1 (identity-link veto only) is measurably insufficient: 2 vetoes across 204 documents, pairwise .411, merge P(a) .096, 132 multi-cluster concepts remained (Domain 92) — and all 137 cross-surface Domain aliases carry decision type `merge`, i.e. they were created by review-pass link verdicts, not identity links. This run LOCATES the chain-merge door; guard v2 (t-a2guard2-*) closes it.

See `docs/CLAIMS.md` for the claims this run backs.
