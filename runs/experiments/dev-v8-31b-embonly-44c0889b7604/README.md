# dev-v8-31b-embonly

Phase B' blocker justification (end-to-end, 31b side): CANDIDATE_GENERATOR=embedding — plain
embedding similarity replaces the union-rr interleaved blocker. Identity holds (1.000; thinking
ON). Hierarchy: MORE asserted edges (89 vs 74) → higher reachable recall (.813 vs .789) at
LOWER precision (.685 vs .811) than dev-v8-31b-think-s1. The interleaving justification is a
precision/robustness claim (plus intrinsic recall@k and the cross-script stratum), not a raw
recall claim. Dev subset, NON-REPORTABLE.

## Configuration

See `run-card.json` (runId `dev-v8-31b-embonly-44c0889b7604`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Identity 1.000 / NIL .966; hierarchy R-reach .813, P .685, kind .934.
Baseline (union-rr): R-reach .789, P .811, kind .950.
