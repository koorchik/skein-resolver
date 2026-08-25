# t-a2obf-flash-egemma-r1

Review-response E2: memorization ablation. Identical configuration to t-a2-flash-egemma-r1 (flash judge + embeddinggemma encoder, v8 decoupled), but the stream is pseudonymized: a fixed per-alphabet letter-substitution derangement renames every HackerGroup and Software surface in the extractions, document texts, and gold (scripts/make-obfuscated.py, seed 20260824; CVE ids and file-extension tails intact). Severing parametric lookup while preserving in-context alias structure tests whether resolution quality on open-form categories comes from memorized world knowledge or from the architecture. Score against gold/gold-obf.json.

## Configuration

```
LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=listwise-graph DECOUPLE=1 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/obf-fetched
TEMPERATURE=0
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-a2obf-flash-egemma-r1-e7fde1a2c37d`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Scored vs gold/gold-obf.json. Hard-stratum merge recall UNCHANGED under pseudonymization (HackerGroup P(a)/R(a) 1.000/1.000 = original; Software R(a) .917 = original); HackerGroup stratum-b recall .200 vs .700 is an instrument artifact (per-alphabet ciphers sever cross-script transliteration — conservative lower bound); Software merge P(a) .087 vs .216 (parametric knowledge props up precision, not recall). Corpus-level: pairwise .170, B³ .940, NIL .990.

See `docs/CLAIMS.md` for the claims this run backs.
