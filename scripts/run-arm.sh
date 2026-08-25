#!/usr/bin/env bash
# Run ONE experiment arm end-to-end: the two-phase pre-seed dance, automated.
#
# Usage: set the arm's env vars (CONDITION, LLM_PROVIDER, LLM_MODEL, EMBEDDINGS_*, knobs...)
# and call this script. INPUT_DIR defaults to data/fetched (full corpus).
#
#   CONDITION=skos-v8-flash-gembed2 LLM_PROVIDER=gemini LLM_MODEL=gemini-3.7-flash \
#     TEMPERATURE=0 EMBEDDINGS_PROVIDER=gemini EMBEDDINGS_MODEL=gemini-embedding-2 \
#     scripts/run-arm.sh
#
# What it does:
#   1. phase 1: starts the arm just to learn `RUN <runId> → <runDir>` (with
#      STEPS=streamingNormalizer and no extractions it exits on its own);
#   2. pre-seeds the frozen gpt-5 extractions for the documents in INPUT_DIR into
#      `<runDir>/extractions`, injecting the empty `relations`/`schemaProposals` the
#      normalizer iterates unguarded;
#   4. phase 2: reruns the IDENTICAL command — same runId, same directory, extraction skipped.
set -euo pipefail
cd "$(dirname "$0")/.."

export FLOW=incremental
export STEPS="${STEPS:-streamingNormalizer}"
export INPUT_DIR="${INPUT_DIR:-data/fetched}"
export OUTPUT_DIR="${OUTPUT_DIR:-runs}"
export EXTRACTIONS_SRC="${EXTRACTIONS_SRC:-data/extractions/gpt-5}"

# The v8 package defaults — every knob can be overridden per-arm from the caller's env.
export DECISION_STRATEGY="${DECISION_STRATEGY:-listwise-graph}"
export DECOUPLE="${DECOUPLE:-1}"
export CANDIDATE_GENERATOR="${CANDIDATE_GENERATOR:-union-rr}"
export CANDIDATE_K="${CANDIDATE_K:-10}"
export CANDIDATE_MIN_SIM="${CANDIDATE_MIN_SIM:-0}"
export REPAIR="${REPAIR:-0}"
export SKOS_CATCHUP_EVERY="${SKOS_CATCHUP_EVERY:-0}"
export REASK_PARENTLESS="${REASK_PARENTLESS:-1}"
export EMBEDDINGS="${EMBEDDINGS:-1}"
export EMBEDDINGS_PROVIDER="${EMBEDDINGS_PROVIDER:-ollama}"
export EMBEDDINGS_MODEL="${EMBEDDINGS_MODEL:-embeddinggemma}"
export DECISIONS_LOG="${DECISIONS_LOG:-1}"
export JUDGE_UNRESOLVED="${JUDGE_UNRESOLVED:-1}"
export ORDER="${ORDER:-numeric-id}"

: "${CONDITION:?set CONDITION to name the arm}"

mkdir -p runs

log="runs/${CONDITION}.phase1.log"
echo "=== phase 1 (learn runDir): CONDITION=$CONDITION LLM=$LLM_PROVIDER/$LLM_MODEL EMB=$EMBEDDINGS_PROVIDER/$EMBEDDINGS_MODEL ORDER=$ORDER"
set +e
npm start >"$log" 2>&1
set -e

runline=$(grep -m1 '^RUN ' "$log" || true)
if [[ -z "$runline" ]]; then
  echo "phase 1 produced no RUN line — see $log" >&2
  exit 1
fi
rundir=$(echo "$runline" | sed 's/^RUN [^ ]* → //')
echo "$runline"

if [[ ! -d "$rundir/extractions" || -z "$(ls -A "$rundir/extractions" 2>/dev/null)" ]]; then
  echo "=== pre-seeding frozen extractions into $rundir/extractions"
  mkdir -p "$rundir/extractions"
  node -e '
    const fs=require("fs"),path=require("path");
    const [dst,inp,src]=process.argv.slice(1);
    let n=0;
    for (const f of fs.readdirSync(inp).filter(f=>f.endsWith(".json"))) {
      const j=JSON.parse(fs.readFileSync(path.join(src,f),"utf8"));
      j.relations ??= []; j.schemaProposals ??= [];
      fs.writeFileSync(path.join(dst,f), JSON.stringify(j,null,2)); n++;
    }
    console.log(`seeded ${n} extractions`);
  ' "$rundir/extractions" "$INPUT_DIR" "$EXTRACTIONS_SRC"
fi

echo "=== phase 2 (the real run)"
log2="runs/${CONDITION}.phase2.log"
set +e
npm start >"$log2" 2>&1
status=$?
set -e
grep -E '^(RUN|COST|OLLAMA)|Error' "$log2" | head -20 || true
if [[ $status -ne 0 ]]; then
  echo "phase 2 FAILED (exit $status) — see $log2" >&2
  exit $status
fi
runline2=$(grep -m1 '^RUN ' "$log2")
if [[ "$runline2" != "$runline" ]]; then
  echo "FATAL: runId moved between phases: '$runline' vs '$runline2' (git state changed?)" >&2
  exit 1
fi
# Purpose-README: every experiment dir documents itself. PURPOSE comes from the caller;
# the config block is the arm's actual environment, so the README cannot drift from the run.
{
  echo "# $CONDITION"
  echo
  echo "${PURPOSE:-(no PURPOSE given — add one)}"
  echo
  echo "## Configuration"
  echo
  echo '```'
  echo "LLM_PROVIDER=$LLM_PROVIDER LLM_MODEL=$LLM_MODEL"
  echo "EMBEDDINGS_PROVIDER=$EMBEDDINGS_PROVIDER EMBEDDINGS_MODEL=$EMBEDDINGS_MODEL"
  echo "DECISION_STRATEGY=$DECISION_STRATEGY DECOUPLE=$DECOUPLE ORDER=$ORDER"
  echo "CANDIDATE_GENERATOR=$CANDIDATE_GENERATOR CANDIDATE_K=$CANDIDATE_K REPAIR=$REPAIR"
  echo "INPUT_DIR=$INPUT_DIR${CATEGORIES:+ CATEGORIES=$CATEGORIES}"
  for v in TEMPERATURE JUDGE_SAMPLES OLLAMA_CLOUD OLLAMA_NUM_CTX OLLAMA_THINK LISTWISE_PROMPT_ID REVIEW_PROMPT_ID SNIPPET_MODE DOC_SIBLINGS SKOS_CONSOLIDATE; do
    val="${!v:-}"
    [[ -n "$val" ]] && echo "$v=$val"
  done
  true
  echo '```'
  echo
  echo "Authoritative config + git/prompt fingerprint: \`run-card.json\` (runId \`$(basename "$rundir")\`)."
  echo
  echo "## Artifacts"
  echo
  echo "- \`registry.json\` — final SKOS registry; \`decisions.jsonl\` — scorable decision log"
  echo "- \`llm-calls/\` — full per-document LLM transcripts; \`run-view.html\` — replay page"
  echo
  echo "## Result"
  echo
  echo "(appended at scoring time — see docs/CLAIMS.md for the claims this run backs)"
} > "$rundir/README.md"
echo "=== done: $rundir (README.md written)"
