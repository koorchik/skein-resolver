# dev-v8-31b-think-s2

Phase A / Phase B' ablation: gemma4:31b with thinking, JUDGE_SAMPLES=2 (two review draws,
hierarchy-union merge) — the 12b-era mode-coin mitigation re-tested at 31b. Verdict: the coin is
GONE at 31b. Union sampling buys nothing (R-reach .747 vs .789 for samples=1) and costs precision
(.686 vs .811) and ~3x output tokens (1.05M vs 352k). Froze JUDGE_SAMPLES=1 for all 31b test
arms. One call hung ~30 min mid-run (cloud; undici timeout recovered it) — logged, no data loss.
Dev subset, NON-REPORTABLE.

## Configuration

See `run-card.json` (runId `dev-v8-31b-think-s2-2c9ece888e90`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Identity 1.000 / NIL .966; hierarchy R-reach .747, P .686, kind .932.
Baseline (samples=1): R-reach .789, P .811, kind .950.
