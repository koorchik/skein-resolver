#!/usr/bin/env python3
"""Write a provenance slice of the gold table: gold.json minus edges carrying a given rule.

Used for the pooled-candidate sensitivity analysis (paper §6): scoring hierarchy recall
against only the independently annotated edge rows (excluding rule=pooled-adjudication)
checks that no recall-based conclusion depends on edges whose candidates came from the
evaluated systems' own outputs.

Usage: python3 scripts/gold-slice.py --exclude-rule pooled-adjudication <out.json>
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gold", default=str(ROOT / "gold/gold.json"))
    ap.add_argument("--exclude-rule", required=True)
    ap.add_argument("out")
    args = ap.parse_args()

    gold = json.loads(Path(args.gold).read_text(encoding="utf-8"))
    before = len(gold["edges"])
    gold["edges"] = [e for e in gold["edges"] if e.get("rule") != args.exclude_rule]
    Path(args.out).write_text(json.dumps(gold, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{args.out}: {before} -> {len(gold['edges'])} edge rows (excluded rule={args.exclude_rule})")


if __name__ == "__main__":
    main()
