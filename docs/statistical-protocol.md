# Statistical protocol

> **Status: fixed before any result exists.** This document is an M1 deliverable and is committed
> before the first `experiments/` directory. That ordering is the point: Phase 1.4 of
> `normalization-experiments-cert-ua.md` is CRITICAL and explicitly about the garden of forking
> paths, so every analysis choice below is made without having seen a number. It is checkable by
> commit date, and it is the specific thing reviewers probe for.
>
> **Amendment rule.** If a choice here turns out to be wrong, amend it in a *separate, dated commit
> that states what was known at the time and why the change is not result-driven*. Never edit a
> choice silently after seeing results.

Companion documents: `normalization-experiments-refactor.md` (what to build) ·
`dissert/wiki/notes/normalization-experiments-cert-ua.md` (what to measure).

---

## 1. Unit of analysis

The **document** is the primary resampling unit. The 204 CERT-UA reports are the independent
observations; mentions and clusters within a document are not independent of each other (one report
discusses one incident, so its entities co-occur by construction).

| Quantity | Resampling unit | Why |
|---|---|---|
| Merge P/R/F1, per stratum | document | mentions cluster within documents |
| Cluster-level metrics (macro/micro/pairwise F1, B³, ARI) | **cluster** | the metric's own unit is the cluster |
| Mint/NIL P/R/F1 | document | a mint decision belongs to the document that triggered it |
| Cost (calls, tokens, $) | document | the per-document cost curve is RQ5's headline |
| Downstream τ (E9) | cluster | rankings are over entities, not documents |

Where a metric is reported per stratum, resampling is **stratified**: resample documents within
each stratum, never pooled across strata. Strata a–c are reported separately and never averaged (stratum d was registered but is empty in the released gold) —
that is the paper's two-claims framing, not a presentation detail.

## 2. Significance test for headline deltas

**Paired permutation test over documents**, two-sided, 10,000 permutations, fixed seed recorded in
the run card.

- **Paired**, because every condition runs on the same frozen 204-document input. Comparing
  independent samples would throw away the pairing and lose power for no reason.
- **Permutation**, because merge P/R over 204 documents is not normally distributed and the
  per-document differences are neither symmetric nor variance-homogeneous. A t-test's assumptions
  are not met; a permutation test's are (exchangeability under the null).
- **Procedure:** for each document *i*, compute the paired difference *d_i* = metric(A_i) −
  metric(B_i). Under the null, the sign of each *d_i* is exchangeable. Draw 10,000 sign-flip
  assignments, recompute the mean difference each time, and report
  *p* = (1 + #{|mean_perm| ≥ |mean_observed|}) / (1 + 10,000). The +1 in numerator and denominator
  is the standard add-one correction; it keeps *p* from ever being exactly 0.
- **Exact enumeration** is not used: 2^204 sign assignments is intractable, and 10,000 draws give a
  Monte-Carlo standard error on *p* below 0.005 near *p* = 0.05, which is sufficient.

**Multiplicity.** Families are defined per contrast in the executed analysis (see the amendment below); the original registration anticipated a five-condition headline table. Report **unadjusted *p* alongside
Holm–Bonferroni-adjusted *p*** over the family of pre-registered headline comparisons, and name the
family explicitly in the paper. Holm rather than Bonferroni because it is uniformly more powerful at
the same family-wise error rate. Exploratory comparisons (anything not in the pre-registered family)
are labelled exploratory and carry unadjusted *p* only, with no significance claim.

## 3. Confidence intervals

**BCa (bias-corrected and accelerated) bootstrap, 10,000 resamples, 95% intervals.**

- BCa rather than percentile: merge precision is bounded in [0, 1] and is often near a boundary on
  the easy strata, where the percentile interval is visibly biased. BCa corrects for both bias and
  skew at negligible extra cost at this scale.
- Resampling unit per metric is the table in §1. Stratified where the metric is per-stratum.
- **Report the CI on the delta**, not only on each arm. Two overlapping single-arm intervals do not
  imply a non-significant difference, and the reverse error is just as common.
- **Degenerate resamples** (a resample containing no positive gold pair, so precision is undefined)
  are **excluded and counted**, and the excluded count is reported alongside the interval. Silently
  dropping them would narrow the interval; imputing 0 would bias it downward.
- No interval-free point estimate appears anywhere in the paper (Phase 8.1).

## 4. Seeds and how they are aggregated

**≥3 seeds for every LLM condition.** Aggregation rule, fixed now:

- The **primary reported figure is the mean over seeds**, with the between-seed standard deviation
  reported next to it in every table.
- CIs are computed by **resampling documents within each seed, then pooling the resampled
  statistics across seeds** — so the interval carries both document-level and seed-level variation.
  Reporting a CI from one seed and the seed SD separately would understate total uncertainty.
- **Never report the best seed.** Never drop a seed as an outlier. If one seed diverges wildly, that
  is a finding about the condition's stability and is reported as such.
- Decision stability across seeds is reported directly as **pairwise ARI between the three
  registries** (Phase 3.1), independent of merge P/R.

### 4.1 The three determinism tiers — not interchangeable

Providers differ in what "another seed" can even mean, and the tiers support different claims. This
is a limitation of the providers, not a choice, and it must be stated wherever seeds are mentioned.

| Tier | Providers | What "≥3 seeds" means | Strength |
|---|---|---|---|
| **Seeded** | OpenAI, Ollama | 3 distinct `seed` values, sampling otherwise fixed | strongest available |
| **Zero-temperature replicates** | VertexAI | 3 calls at `temperature: 0` (no seed parameter exists) | weaker — no seed, but sampling is pinned |
| **Default-sampling replicates** | **Anthropic** | 3 calls with sampling parameters **omitted** | **weakest — sampling is not pinned at all** |

**Why Anthropic has no lever.** On Claude Opus 4.7 and later (4.7 / 4.8 / Opus 5 / Sonnet 5 /
Fable 5), `temperature`, `top_p` and `top_k` are removed from the API: a non-default value returns
HTTP 400. The provider default is `temperature` 1.0. There is therefore no way to reduce sampling
variance on that arm — `temperature: 0` is not "not preferred", it is *rejected*. Its replicates
vary under full default sampling, so its variance estimates measure a genuinely noisier process than
the other two arms.

Consequences that must be honoured in reporting:

1. Anthropic-arm between-seed SD is **not comparable** to the other arms' and is never pooled with
   them into a single "seed variance" figure.
2. Wherever the paper says "3 seeds", it names the tier for each condition, in the table or its
   caption.
3. This appears in **threats to validity**, in these terms: the determinism guarantee is
   provider-dependent, and one arm has none.
4. Newer Anthropic models also think by default, and thinking tokens are billed and counted in
   `usage`. Cost figures for that arm therefore include reasoning tokens that never appear in the
   decision log — stated wherever Anthropic cost is compared to another provider's.

If the Anthropic model is ever pinned to Claude 4.6 or earlier, which still accepts `temperature`,
that arm moves to the zero-temperature tier and this section must be updated in a dated amendment.

## 5. `defer` — a withheld decision

> **Shipped behavior:** in the released runs, only the Fellegi–Sunter baseline emits `defer`
> (its calibrated possible-match region). The LLM strategies never do — `listwise-graph`
> documents why (prompted abstention tracks prompt wording, not genuine ambiguity). This
> section's convention therefore applies to the FS arm and to any future calibrated strategy.

`defer` is a third decision state alongside `link` and `mint` (M6). The gold table is link/mint
only, so a deferred decision has no gold label and its scoring convention is fixed **here, before
any `defer` is emitted**:

- A `defer` is **excluded from merge precision** — the system made no merge claim, so it can be
  neither right nor wrong about one.
- A `defer` is **counted as a miss in recall-oriented totals**: a gold merge the system failed to
  make is a failure whatever the reason, and letting deferral inflate precision without touching
  recall would make "defer everything" the optimal strategy.
- **Deferral rate is reported as its own column** in every table where a deferring condition
  appears. A precision figure computed over a shrunken decision set is meaningless without it.
- Both totals (with and without the recall penalty) are reported once, in an appendix, so a reader
  can see the convention's effect rather than take it on trust.

## 6. Dev/test discipline

- Gold clusters are split ~20/80 dev/test **by cluster** (not by pair — pairs from one cluster
  would leak across the split), frozen as `gold-aliases-v2` before any condition is tuned.
- Prompt and configuration tuning happens on **dev only**. Reported results come from **test only**.
- The test slice is scored **once per condition**, after that condition's configuration is frozen.
  Iterating on test is the failure this whole document exists to prevent.
- Threshold calibration (embedding cosine, Fellegi–Sunter cutoffs) uses the dev slice, and the paper
  says so — rather than the synthetic generated pairs used by `lairgi2024itext2kg` and
  `lairgi2026atom`, since a real dev slice is available.

### 6.1 Single-corpus design — an accepted limitation

The corpus is **CERT-UA only** (decision of 2026-07-27). There is no public-benchmark anchor and no
external baseline system, because every external candidate is annotated for a different task and its
labels do not transfer to this gold table, which is hand-built for this corpus.

Two consequences follow, and both are reported in threats to validity rather than left implicit:

1. **No reported number is calibratable against published results.** A reader cannot place this
   gold table's difficulty relative to any benchmark, so absolute figures carry less information
   than the *deltas between conditions*, which are measured on identical input. Frame claims as
   within-corpus comparisons accordingly.
2. **Every condition is self-implemented**, so implementation quality and method quality are not
   separable by an outside reader. The mitigations inside scope — the exact-match floor and the
   Fellegi–Sunter statistical pole — bound the comparison but are not external baselines and are
   not described as such.

This also means **no cross-corpus generalisation may be claimed**: transfer is designed-for, not
validated (Phase 9.5's scoping-honesty clause).

## 7. What is pre-registered

Fixed before results, and therefore quotable as confirmatory:

1. Unit of analysis per metric (§1).
2. Paired permutation test, 10,000 permutations, two-sided; Holm over the headline family (§2).
3. BCa bootstrap, 10,000 resamples, 95%, CI reported on deltas (§3).
4. ≥3 seeds, mean + between-seed SD, no best-seed selection, tier named (§4).
5. `defer` scoring convention and mandatory deferral-rate column (§5).
6. Dev/test split by cluster, test scored once per frozen condition (§6).
7. The direction-agnostic commitment: parity, win, or loss for the judged operators (Ψ_id/Ψ_rev, registered as Ψ_link) are all reported (Phase 0.3).

Anything else is exploratory and labelled as such.

## 8. Implementation pointers

| Choice | Implemented in |
|---|---|
| Paired permutation test | `src/Evaluation/bootstrap.ts` (M2) |
| BCa bootstrap CIs | `src/Evaluation/bootstrap.ts` (M2) |
| Per-stratum breakdowns | `src/Evaluation/clusterMetrics.ts`, `nilMetrics.ts` (M2) |
| Seed aggregation + tier labels | `bin/evaluate.ts` (M2), tier from the run card's `sampling.supported` |
| Sampling actually used | `RunCard` records `sampling.effective`, not the requested config (M1) |
| Cost incl. unpriced-model flagging | `src/Experiment/CostMeter.ts` (M1) |

The run card records **effective** sampling — what the client actually sent after dropping
parameters the provider rejects — so a card can never claim a `temperature: 0` that never left the
process. `sampling.supported` is what determines a condition's determinism tier in §4.1, and
`bin/evaluate.ts` reads it rather than inferring the tier from the provider name.

## Amendment 2026-08-26: executed-analysis deviations, disclosed

The executed inference deviates from the registration in three ways, disclosed in the paper's
§4.5 and recorded here per the amendment rule: (1) resampling units are element-level (B³) and
edge-level (hierarchy), not the registered document-level unit; (2) contrasts are computed
between first replicates, with all replicate values printed beside every score instead of the
registered mean ± between-seed SD; (3) Holm families are defined per contrast, with each
family's size stated where its adjusted p-value is quoted. The registered deferral-rate column
applies only to the Fellegi–Sunter baseline (the sole deferring condition; every LLM arm's
deferral rate is zero). The public export is a single squashed commit, so registration ordering
is internal to the development lineage rather than checkable in this repository's history.

## Primary scoring universe: identity metrics exclude the Domain category

Rationale (composition, not outcome): Domain (the internet-domain-name category) holds 60% of gold clusters (1,929), every one
single-member, with zero gold hierarchy edges and half of the NIL labels — it contributes
volume to element-level metrics while contributing nothing to the alias-resolution or
hierarchy tasks. The PRIMARY identity universe is therefore the gold without Domain
(1,026 test clusters / 1,158 elements / 208,859 labeled pairs); the full universe
(including Domain) is reported as a secondary view, and Domain itself is reported as a
separate identifier-category block (chain risk, guard remediation, NIL).

Both universes are reported wherever a claim depends on the choice, and no conclusion
changes direction or significance between them (e.g., the same-encoder identity delta:
+0.011 [0.007, 0.015] primary vs +0.025 [0.021, 0.030] full universe, both Holm-adjusted
p = 0.0002). Hierarchy metrics are universe-independent: the gold has no Domain edges.
Mechanism: `--exclude-category Domain` in bin/evaluate.ts and bin/stats.ts.
