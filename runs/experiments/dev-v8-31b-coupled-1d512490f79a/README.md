# dev-v8-31b-coupled

Phase B' ablation: coupled single-call architecture (DECOUPLE=0, prompt listwise-skos-v7 —
identity AND hierarchy decided in one document-framed call) on gemma4:31b with thinking.
Justifies the v8 decoupling: identity holds (1.000) but hierarchy collapses to
R-reach .430 / P .567 vs .789/.811 for the decoupled two-pass baseline (dev-v8-31b-think-s1) —
the source-free review frame, not the judge, carries hierarchy recall. Dev subset, NON-REPORTABLE.

## Configuration

See `run-card.json` — authoritative config + git/prompt fingerprint
(runId `dev-v8-31b-coupled-1d512490f79a`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Identity pairwise 1.000 / NIL .966; hierarchy R-reach .430, P .567, kind agreement .912.
Compare dev-v8-31b-think-s1 (decoupled): R-reach .789, P .811, kind .950.
