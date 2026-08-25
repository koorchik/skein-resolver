# t-base-exact

HYBRID baseline (kept, relabeled): exact-string identity + the v8 pass-2 LLM review (launched with DECOUPLE=1 by mistake; the review pass both asserted hierarchy AND merged parentless mints, so identity is NOT a pure exact floor — see t-floor-exact for that). Interesting as a 'cheap identity + LLM hierarchy' hybrid: hierarchy R-reach .713 at P .286; identity pairwise .167 (review-pass merges are unreliable when identity evidence is absent). Test split.

## Configuration

See `run-card.json` (runId `t-base-exact-e318f94256cb`).

## Artifacts

- `registry.json`; `decisions.jsonl`; `llm-calls/` (empty for pure floors); `run-view.html`
