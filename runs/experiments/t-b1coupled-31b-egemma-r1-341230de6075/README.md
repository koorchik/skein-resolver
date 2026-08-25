# t-b1coupled-31b-egemma-r1

Corpus-scale coupled single-call arm on the open-weight judge: identical to the B1 factorial cell (gemma4:31b + embeddinggemma) with identity and hierarchy asked in one document call. Closes the prompting-ladder scoping: the flash ladder measured the decoupling delta at corpus scale on the cloud judge only; this arm pairs against t-b1-31b-egemma-r1 for the same delta on the open-weight judge (dev-slice evidence: coupled .430 vs decoupled .789 reachable recall).

## Configuration

```
LLM_PROVIDER=ollama LLM_MODEL=gemma4:31b
EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=embeddinggemma
DECISION_STRATEGY=listwise-graph DECOUPLE=0 ORDER=numeric-id
CANDIDATE_GENERATOR=union-rr CANDIDATE_K=10 REPAIR=0
INPUT_DIR=data/fetched
JUDGE_SAMPLES=1
OLLAMA_CLOUD=1
OLLAMA_NUM_CTX=65536
OLLAMA_THINK=1
```

Authoritative config + git/prompt fingerprint: `run-card.json` (runId `t-b1coupled-31b-egemma-r1-341230de6075`).

## Artifacts

- `registry.json` — final SKOS registry; `decisions.jsonl` — scorable decision log
- `llm-calls/` — full per-document LLM transcripts; `run-view.html` — replay page

## Result

Identity pairwise F1 .610, B³ .989, merge P(a)/R(a) .739/.773; hierarchy 469 edges, R-reach .474, edge P .384, kind .939; 703 calls, 2.3M tokens. The 31b decoupling delta vs t-b1-31b-egemma-r1: R-reach +0.262 [0.201, 0.320], Holm p=0.0002 — replicating the flash-judge delta (+0.238) at corpus scale on the open-weight judge.

See `docs/CLAIMS.md` for the claims this run backs.
