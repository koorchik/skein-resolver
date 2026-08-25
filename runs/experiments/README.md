# Experiment index

One directory per experimental arm — never more than one version of each. Every directory is
self-describing: `README.md` (purpose + configuration + result), `run-card.json` (authoritative
config, git/prompt fingerprint), `registry.json` (final SKOS registry), `decisions.jsonl`
(scorable decision log), `llm-calls/` (full transcripts), `run-view.html` (replay page).
The claims–evidence matrix `docs/CLAIMS.md` maps every paper claim to its directory and scoring
command; `docs/REPRODUCE.md` re-runs anything from scratch.

**The paper's headline result** is the open-weight factorial cell **B2** — best identity of any
arm (pairwise F1 .661, B-cubed .975 on the paper's primary universe; .613/.983 with Domain
included) at hierarchy parity: ★ [`t-b2-31b-gembed2-r1`](t-b2-31b-gembed2-r1-efdded22cfb6/).
**The paper's remediated configuration** (identifier guard closing the chain-merge door, §5.2):
★ [`t-a2guard2-flash-egemma-r1`](t-a2guard2-flash-egemma-r1-ad954c0c876e/).

## Factorial cells — paper Tables 2–4, Figs. 2–3 (§5.1)

2×2 judge × encoder on the full 204-document test corpus, three replicates each.

| cell | stack | replicates | pairwise F1, primary universe (r1/r2/r3) |
|---|---|---|---|
| A1 | gemini-3.7-flash + gemini-embedding-2 | [`t-a1-flash-gembed2-r1`](t-a1-flash-gembed2-r1-35bc1387d473/), [`t-a1-flash-gembed2-r2`](t-a1-flash-gembed2-r2-a2b72aaba488/), [`t-a1-flash-gembed2-r3`](t-a1-flash-gembed2-r3-ecce2bbfc3c6/) | .610 / .473 / .442 |
| A2 | gemini-3.7-flash + embeddinggemma | [`t-a2-flash-egemma-r1`](t-a2-flash-egemma-r1-a7d0a4e56984/), [`t-a2-flash-egemma-r2`](t-a2-flash-egemma-r2-4e86447ddfce/), [`t-a2-flash-egemma-r3`](t-a2-flash-egemma-r3-b3469137a5a0/) | .557 / .562 / .483 |
| B1 | gemma4:31b + embeddinggemma | [`t-b1-31b-egemma-r1`](t-b1-31b-egemma-r1-4337e00db336/), [`t-b1-31b-egemma-r2`](t-b1-31b-egemma-r2-97c12da94c38/), [`t-b1-31b-egemma-r3`](t-b1-31b-egemma-r3-de898eb3ac19/) | .628 / .619 / .649 |
| B2 ★ | gemma4:31b + gemini-embedding-2 | [`t-b2-31b-gembed2-r1`](t-b2-31b-gembed2-r1-efdded22cfb6/), [`t-b2-31b-gembed2-r2`](t-b2-31b-gembed2-r2-2c1e63fe637d/), [`t-b2-31b-gembed2-r3`](t-b2-31b-gembed2-r3-1f86ee33b8cc/) | **.661** / .702 / .650 |

## Order sensitivity — paper Table 7, Fig. 6 (§5.5)

Same configuration, adversarial arrival orders; scored against the same-order replicate trios above.

- [`t-a1-flash-gembed2-rev`](t-a1-flash-gembed2-rev-e00c00f59822/) / [`t-a1-flash-gembed2-shuf42`](t-a1-flash-gembed2-shuf42-c381e12b6e61/) — flash cell, reversed / seeded-shuffle order
- [`t-b1-31b-egemma-rev`](t-b1-31b-egemma-rev-fcc5baef0f77/) / [`t-b1-31b-egemma-shuf42`](t-b1-31b-egemma-shuf42-f74ca84b9ad7/) — open-weight cell, reversed / seeded-shuffle order

## Baselines — paper Table 5 (§5.3)

- [`t-floor-exact`](t-floor-exact-801d8a071dff/) — exact-string floor, no LLM (pairwise .000)
- [`t-floor-thresh-egemma`](t-floor-thresh-egemma-2ec736b05fe3/) / [`t-floor-thresh-gembed2`](t-floor-thresh-gembed2-cc286ae9584f/) — embedding-threshold mergers, no LLM (.010 / .016)
- [`t-base-fs-string`](t-base-fs-string-514a7295d494/) — Fellegi–Sunter classical record linkage, unfitted literature priors, no LLM (.077)
- [`t-anchor-eos`](t-anchor-eos-732631563fe0/) — NON-streaming end-of-stream consolidation anchor (.251)
- [`t-base-exact`](t-base-exact-e318f94256cb/) — hybrid exact-identity + LLM review (documented mislaunch, kept as the hybrid row)
- [`t-base-thresh-egemma`](t-base-thresh-egemma-1003606f1986/) / [`t-base-thresh-gembed2`](t-base-thresh-gembed2-209a5decdcfa/) — hybrid threshold-identity + LLM review variants

## Guard, ladder, and robustness arms — §5.2 guard, §5.4 ladder, §6 threats

- ★ [`t-a2guard2-flash-egemma-r1`](t-a2guard2-flash-egemma-r1-ad954c0c876e/), [`t-a2guard2-flash-egemma-r2`](t-a2guard2-flash-egemma-r2-0c35c0c3d8ad/), [`t-a2guard2-flash-egemma-r3`](t-a2guard2-flash-egemma-r3-1f9ba4900431/) — identifier guard v2 (identity-link + review-merge veto): Domain chains 106→0, B³ +.020, replicate spread ÷7.6
- [`t-a2guard-flash-egemma-r1`](t-a2guard-flash-egemma-r1-8b09da6a0dfb/) — guard v1 (identity links only): the mechanism-locating intermediate — 2 vetoes, chains persisted, proving the chain door is the review pass
- [`t-a2obf-flash-egemma-r1`](t-a2obf-flash-egemma-r1-e7fde1a2c37d/) — memorization ablation: pseudonymized stream (scripts/make-obfuscated.py), scored vs gold/gold-obf.json; hard-stratum merge recall unchanged
- [`t-a2cons-flash-egemma-r1`](t-a2cons-flash-egemma-r1-a6bba244e0ae/) — identity-pass self-consistency (3 samples): no effect, +28% tokens (negative result, wrong operator)
- [`t-a2coupled-flash-egemma-r1`](t-a2coupled-flash-egemma-r1-49c56fbb85c8/), [`t-a2coupled-flash-egemma-r2`](t-a2coupled-flash-egemma-r2-4e3eeb26137c/), [`t-a2coupled-flash-egemma-r3`](t-a2coupled-flash-egemma-r3-8aea8c704594/) — coupled single-call ablation at corpus scale: a real graph at higher edge precision than v8; the review pass adds +0.24 reachable recall
- [`t-b1coupled-31b-egemma-r1`](t-b1coupled-31b-egemma-r1-341230de6075/) — coupled single call on the open-weight judge: decoupling delta +0.262 replicated at corpus scale (23% of the v8 tokens)
- [`t-naive-flash-egemma-r1`](t-naive-flash-egemma-r1-b15838916dfc/), [`t-naive-flash-egemma-r2`](t-naive-flash-egemma-r2-fcacc5eb0a57/), [`t-naive-flash-egemma-r3`](t-naive-flash-egemma-r3-9957425cf9ab/) — naive zero-shot prompting rung of the ladder: R-reach ~.39 at edge P ~.45, 6× more identity-stable than v8

## Design-justification ablations — paper Table 8 (§5.6; development subset, relative evidence only)

22-document Software development subset on gemma4:31b (+ flash cross-checks). Absolute values are not
comparable to the corpus-scale numbers above.

- [`dev-v8-31b-think-s1`](dev-v8-31b-think-s1-4070fd2ee36f/) — v8 reference configuration
- [`dev-v8-31b-coupled`](dev-v8-31b-coupled-1d512490f79a/) — coupled single call (decoupling delta +.359 R-reach)
- [`dev-v8-31b-edgearray`](dev-v8-31b-edgearray-3e02bd762079/) — coupled + set-level edge array variant
- [`dev-v8-31b-nothink`](dev-v8-31b-nothink-25fbe54609aa/) — extended reasoning off (identity collapses to .333)
- [`dev-v8-31b-think-s2`](dev-v8-31b-think-s2-2c9ece888e90/) — 2-sample review voting (no gain, 3× tokens)
- [`dev-v8-31b-snip-head`](dev-v8-31b-snip-head-7ea416e4407f/) / [`dev-v8-31b-snip-none`](dev-v8-31b-snip-none-c5a49d5be605/) — evidence-window ablations (precision mechanism)
- [`dev-v8-31b-siblings`](dev-v8-31b-siblings-c4fb9c2f29b8/) — document-sibling injection (harmless at 31b)
- [`dev-v8-31b-embonly`](dev-v8-31b-embonly-44c0889b7604/) — embedding-only blocker (more, noisier assertions)
- [`dev-v8-flash-egemma`](dev-v8-flash-egemma-a2832e2d73a3/) / [`dev-v8-flash-gembed2`](dev-v8-flash-gembed2-7e072d665334/) / [`dev-v8-flash-embonly`](dev-v8-flash-embonly-6f0fc04ce986/) / [`dev-v8-flash-union`](dev-v8-flash-union-a19c1879d4b0/) — flash cross-checks
