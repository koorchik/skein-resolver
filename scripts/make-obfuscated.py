#!/usr/bin/env python3
"""Build the pseudonymized corpus for the memorization ablation (review-response E2).

Threat addressed: the CERT-UA corpus predates the judges' training cutoffs, so resolution
accuracy on well-known threat actors / malware may come from parametric memory rather than
in-context reasoning. The discriminating test renames open-form entities consistently and
re-runs an arm on the renamed stream.

Design: a fixed letter-substitution cipher (a bijection on the Latin alphabet and one on the
Cyrillic alphabet, case-preserving; digits, punctuation, whitespace untouched) applied to every
surface of the OPEN-FORM categories HackerGroup and Software, in
  (a) the frozen extractions (entity names),
  (b) the document texts and titles (every occurrence of any in-scope surface), and
  (c) the gold standard (cluster members, edge endpoints, NIL labels of in-scope categories).
A char-level bijection preserves exactly what the ablation must preserve — shared stems across
alias variants ("LockBit" / "LockBit 3.0" keep their common prefix), case patterns, lengths,
token structure — while severing parametric lookup, and maps distinct names to distinct names.
CVE identifiers and common file-extension tails are left intact (they are rigid identifiers,
not open-form names; the memorization claim does not concern them).

Outputs: data/obf-fetched/, data/obf-extractions/, gold/gold-obf.json.
Deterministic: fixed seed, no timestamps.
"""
import json
import random
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCOPE = {"HackerGroup", "Software"}
SEED = 20260824

LATIN = "abcdefghijklmnopqrstuvwxyz"
# Ukrainian alphabet plus the Russian-only letters that occur in this corpus.
CYRILLIC = "абвгґдеєжзиіїйклмнопрстуфхцчшщьюяыэёъ"

CVE_RE = re.compile(r"CVE-\d{4}-\d{3,7}", re.IGNORECASE)
EXT_RE = re.compile(
    r"\.(?:exe|msi|dll|docx?|xlsx?|pptx?|js|vbs|vbe|zip|rar|7z|lnk|bat|cmd|ps1|hta|scr|pdf|rtf|jar|apk|iso|img|chm|cpl|py|elf|bin|sh|txt|dat|tmp|php)(?![\w])",
    re.IGNORECASE,
)


def derangement(alphabet: str, rng: random.Random) -> dict[str, str]:
    letters = list(alphabet)
    while True:
        shuffled = letters[:]
        rng.shuffle(shuffled)
        if all(a != b for a, b in zip(letters, shuffled)):
            break
    table = {}
    for a, b in zip(letters, shuffled):
        table[a] = b
        table[a.upper()] = b.upper()
    return table


RNG = random.Random(SEED)
TABLE = derangement(LATIN, RNG) | derangement(CYRILLIC, RNG)


def cipher(text: str) -> str:
    """Substitute alphabetic characters, leaving CVE ids and file-extension tails intact."""
    protected = []
    for m in CVE_RE.finditer(text):
        protected.append(m.span())
    for m in EXT_RE.finditer(text):
        protected.append(m.span())
    out = []
    for i, ch in enumerate(text):
        if any(a <= i < b for a, b in protected):
            out.append(ch)
        else:
            out.append(TABLE.get(ch, ch))
    return "".join(out)


def main() -> None:
    ext_dir = ROOT / "data/extractions/gpt-5"
    fetched_dir = ROOT / "data/fetched"
    obf_fetched = ROOT / "data/obf-fetched"
    obf_ext = ROOT / "data/obf-extractions"
    obf_fetched.mkdir(exist_ok=True)
    obf_ext.mkdir(exist_ok=True)

    doc_ids = sorted(int(p.stem) for p in fetched_dir.glob("*.json"))

    # --- collect every in-scope surface (extractions + gold) --------------------------------
    surfaces: set[str] = set()
    for doc_id in doc_ids:
        j = json.loads((ext_dir / f"{doc_id}.json").read_text(encoding="utf-8"))
        for e in j.get("entities", []):
            if e.get("category") in SCOPE:
                surfaces.add(e["name"])

    gold = json.loads((ROOT / "gold/gold.json").read_text(encoding="utf-8"))
    for cluster in gold["clusters"]:
        if cluster["category"] in SCOPE:
            surfaces.update(cluster["members"])
    for edge in gold.get("edges", []):
        if edge.get("category") in SCOPE:
            surfaces.add(edge["from"])
            surfaces.add(edge["to"])
    for nil in gold.get("nilLabels", []):
        if nil.get("category") in SCOPE:
            surfaces.add(nil["mention"])

    surfaces = {unicodedata.normalize("NFC", s) for s in surfaces}

    # --- extractions ------------------------------------------------------------------------
    renamed = 0
    for doc_id in doc_ids:
        j = json.loads((ext_dir / f"{doc_id}.json").read_text(encoding="utf-8"))
        for e in j.get("entities", []):
            if e.get("category") in SCOPE:
                e["name"] = cipher(e["name"])
                renamed += 1
        (obf_ext / f"{doc_id}.json").write_text(
            json.dumps(j, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # --- document texts ---------------------------------------------------------------------
    # One alternation over all in-scope surfaces, longest first, case-insensitive, guarded by
    # non-letter boundaries; each match is ciphered in place (case pattern rides along).
    ordered = sorted(surfaces, key=len, reverse=True)
    boundary_l = r"(?<![\wЀ-ӿ])"
    boundary_r = r"(?![\wЀ-ӿ])"
    pattern = re.compile(
        boundary_l + "(?:" + "|".join(re.escape(s) for s in ordered) + ")" + boundary_r,
        re.IGNORECASE,
    )
    total_repl = 0
    for doc_id in doc_ids:
        doc = json.loads((fetched_dir / f"{doc_id}.json").read_text(encoding="utf-8"))
        for field in ("text", "title", "description"):
            if isinstance(doc.get(field), str):
                doc[field], n = pattern.subn(
                    lambda m: cipher(m.group(0)),
                    unicodedata.normalize("NFC", doc[field]),
                )
                total_repl += n
        (obf_fetched / f"{doc_id}.json").write_text(
            json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # --- gold -------------------------------------------------------------------------------
    for cluster in gold["clusters"]:
        if cluster["category"] in SCOPE:
            cluster["members"] = [cipher(unicodedata.normalize("NFC", m)) for m in cluster["members"]]
    for edge in gold.get("edges", []):
        if edge.get("category") in SCOPE:
            edge["from"] = cipher(unicodedata.normalize("NFC", edge["from"]))
            edge["to"] = cipher(unicodedata.normalize("NFC", edge["to"]))
    for nil in gold.get("nilLabels", []):
        if nil.get("category") in SCOPE:
            nil["mention"] = cipher(unicodedata.normalize("NFC", nil["mention"]))
    # Version tag must stay one the evaluator accepts; the obfuscation block below carries the
    # provenance instead.
    gold["obfuscation"] = {
        "scope": sorted(SCOPE),
        "scheme": "per-alphabet letter-substitution derangement, case-preserving; CVE ids and file-extension tails intact",
        "seed": SEED,
    }
    (ROOT / "gold/gold-obf.json").write_text(
        json.dumps(gold, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    print(f"in-scope surfaces: {len(surfaces)}")
    print(f"extraction mentions renamed: {renamed}")
    print(f"text replacements: {total_repl} across {len(doc_ids)} docs")
    for s in list(ordered)[:3] + list(ordered)[-3:]:
        print(f"  {s!r} -> {cipher(s)!r}")


if __name__ == "__main__":
    sys.exit(main())
