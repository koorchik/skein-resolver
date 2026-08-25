#!/usr/bin/env python3
"""Write `metrics.json` into every experiment run directory, from the scorer — never by hand.

The run-view pages and the GitHub Pages hub display these numbers; regenerating them through
the evaluator is what keeps the displayed metrics incapable of drifting from the paper's.

Per-condition scoring scope (mirrors docs/CLAIMS.md):
  dev-*      → the 22-document Software dev slice (--split dev --allow-dev --category Software);
               relative evidence only, labeled `scope: dev-slice`.
  t-a2obf-*  → scored against gold/gold-obf.json (the pseudonymized gold).
  everything else → the full test split, hierarchy across both splits.

Usage: python3 scripts/score-runs.py [--force] [dir ...]
Without dirs: every directory under runs/experiments/ lacking a metrics.json (--force rescores).
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP = ROOT / "runs/experiments"


# The primary identity universe excludes Domain (see docs/statistical-protocol.md).
# metrics.json carries both: `identity`/`mergeStratumA` are the PRIMARY (Domain-excluded)
# scores; `identityFull` is the full-universe view; hierarchy is universe-independent
# (the gold has no Domain edges) and scored on the full table.
def flags_for(condition: str):
    if condition.startswith("dev-"):
        return ["--gold", "gold/gold.json", "--split", "dev", "--allow-dev",
                "--category", "Software", "--hierarchy-all-splits"], "dev-slice"
    if condition.startswith("t-a2obf"):
        return ["--gold", "gold/gold-obf.json", "--hierarchy-all-splits"], "test-corpus-pseudonymized"
    return ["--gold", "gold/gold.json", "--hierarchy-all-splits"], "test-corpus"


def compact(payload: dict, scope: str) -> dict:
    r = payload["results"][0]
    h = (payload.get("hierarchy") or [{}])[0].get("metrics", {})
    cl, nil, cost = r["cluster"], r["nil"], r.get("cost", {})
    a = r["merge"].get("a", {})
    out = {
        "scope": scope,
        "identity": {
            "pairwiseF1": cl["pairwise"]["f1"],
            "bCubedF1": cl["bCubed"]["f1"],
            "ari": cl["ari"],
            "nilF1": nil.get("f1"),
        },
        "mergeStratumA": {"precision": a.get("precision"), "recall": a.get("recall")},
        "hierarchy": {
            "recallReachable": h.get("recallReachable"),
            "precision": h.get("precision"),
            "kindAgreement": h.get("kindAgreement"),
            "predictedEdges": h.get("predicted"),
        },
        "cost": {"judgeAndEmbedCalls": cost.get("calls"),
                 "tokens": (cost.get("inputTokens") or 0) + (cost.get("outputTokens") or 0)},
        "generatedBy": "scripts/score-runs.py over bin/evaluate.ts — do not edit by hand",
    }
    return out


def main() -> int:
    force = "--force" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--force"]
    dirs = [Path(a) for a in args] if args else sorted(EXP.iterdir())
    failed = 0
    for d in dirs:
        if not (d / "run-card.json").exists():
            continue
        target = d / "metrics.json"
        if target.exists() and not force:
            continue
        condition = re.sub(r"-[0-9a-f]{12}$", "", d.name)
        flags, scope = flags_for(condition)

        def run_eval(extra):
            with tempfile.NamedTemporaryFile(suffix=".json") as tmp:
                cmd = ["npm", "run", "evaluate", "--silent", "--", *flags, *extra,
                       "--run", str(d), "--json", tmp.name]
                proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
                if proc.returncode != 0:
                    raise RuntimeError(proc.stderr.strip().splitlines()[-1] if proc.stderr else proc.returncode)
                return json.load(open(tmp.name))

        try:
            if scope == "dev-slice":
                out = compact(run_eval([]), scope)
            else:
                # Primary = Domain-excluded identity; hierarchy comes from the full evaluation
                # (the gold has no Domain edges, so the universe choice does not apply to it).
                core = compact(run_eval(["--exclude-category", "Domain"]), scope)
                full = compact(run_eval([]), scope)
                out = full
                out["identityFull"] = full["identity"]
                out["mergeStratumAFull"] = full["mergeStratumA"]
                out["identity"] = core["identity"]
                out["mergeStratumA"] = core["mergeStratumA"]
                out["primaryUniverse"] = "gold-without-Domain (primary scoring universe; see docs/statistical-protocol.md)"
        except RuntimeError as err:
            print(f"FAILED {d.name}: {err}")
            failed += 1
            continue
        target.write_text(json.dumps(out, indent=1) + "\n")
        print(f"scored {d.name} ({scope})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
