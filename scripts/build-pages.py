#!/usr/bin/env python3
"""Assemble the GitHub Pages experiment browser from the run artifacts in this branch.

The site is one hub page (grouped run selector, side-by-side compare, per-run descriptions
with scored metrics) plus every run's self-contained `run-view.html` copied verbatim. It is
served from the `gh-pages` branch of this repository:

    python3 scripts/build-pages.py            # writes ./site/
    git worktree add ../skein-pages gh-pages
    cp -r site/. ../skein-pages/ && cd ../skein-pages && git add -A && git commit && git push

Run `scripts/score-runs.py` first if metrics.json files are missing or stale, and
`bin/regen-view.ts` per run dir if the viewer code changed.
"""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP = ROOT / "runs/experiments"
SITE = ROOT / "site"

def rep(c):
    m = re.search(r"-r(\d)$", c)
    return f", run {m.group(1)}" if m else ""

def names_and_descriptions():
    NAME, DESC = {}, {}
    for i in (1, 2, 3):
        NAME[f"t-a1-flash-gembed2-r{i}"] = f"Cloud judge + cloud encoder{rep(f'-r{i}')}"
        NAME[f"t-a2-flash-egemma-r{i}"] = f"Cloud judge + open encoder{rep(f'-r{i}')}"
        NAME[f"t-b1-31b-egemma-r{i}"] = f"Open judge + open encoder{rep(f'-r{i}')}"
        NAME[f"t-b2-31b-gembed2-r{i}"] = ("\u2605 " if i == 1 else "") + f"Open judge + cloud encoder{rep(f'-r{i}')}"
        NAME[f"t-a2guard2-flash-egemma-r{i}"] = ("\u2605 " if i == 1 else "") + f"Identifier guard v2{rep(f'-r{i}')}"
        NAME[f"t-a2coupled-flash-egemma-r{i}"] = f"Coupled single call{rep(f'-r{i}')}"
        NAME[f"t-naive-flash-egemma-r{i}"] = f"Naive zero-shot prompting{rep(f'-r{i}')}"
    NAME.update({
        "t-a1-flash-gembed2-rev": "Cloud stack, reversed arrival order",
        "t-a1-flash-gembed2-shuf42": "Cloud stack, shuffled arrival order",
        "t-b1-31b-egemma-rev": "Open stack, reversed arrival order",
        "t-b1-31b-egemma-shuf42": "Open stack, shuffled arrival order",
        "t-floor-exact": "Exact-string floor (no LLM)",
        "t-floor-thresh-egemma": "Embedding-threshold merger, open encoder (no LLM)",
        "t-floor-thresh-gembed2": "Embedding-threshold merger, cloud encoder (no LLM)",
        "t-base-fs-string": "Fellegi\u2013Sunter classical record linkage (no LLM)",
        "t-anchor-eos": "End-of-stream consolidation anchor (non-streaming)",
        "t-base-exact": "Hybrid: exact-string identity + LLM review",
        "t-base-thresh-egemma": "Hybrid: threshold identity + LLM review, open encoder",
        "t-base-thresh-gembed2": "Hybrid: threshold identity + LLM review, cloud encoder",
        "t-a2guard-flash-egemma-r1": "Identifier guard v1 \u2014 mechanism probe",
        "t-a2obf-flash-egemma-r1": "Pseudonymized stream \u2014 memorization ablation",
        "t-a2cons-flash-egemma-r1": "Identity self-consistency, 3-sample voting",
        "t-b1coupled-31b-egemma-r1": "Coupled single call, open judge",
        "dev-v8-31b-think-s1": "Reference v8 configuration (dev slice)",
        "dev-v8-31b-coupled": "Coupled single call (dev slice)",
        "dev-v8-31b-edgearray": "Coupled + set-level edge array (dev slice)",
        "dev-v8-31b-nothink": "Extended reasoning off (dev slice)",
        "dev-v8-31b-think-s2": "2-sample review voting (dev slice)",
        "dev-v8-31b-snip-head": "Evidence windows: document head only (dev slice)",
        "dev-v8-31b-snip-none": "Evidence windows: none (dev slice)",
        "dev-v8-31b-siblings": "Document-sibling injection (dev slice)",
        "dev-v8-31b-embonly": "Embedding-only blocker (dev slice)",
        "dev-v8-flash-egemma": "Flash cross-check, open encoder (dev slice)",
        "dev-v8-flash-gembed2": "Flash cross-check, cloud encoder (dev slice)",
        "dev-v8-flash-embonly": "Flash cross-check, embedding-only blocker (dev slice)",
        "dev-v8-flash-union": "Flash cross-check, RRF-fused union blocker (dev slice)",
    })
    DESC.update({
        "t-a1-flash-gembed2-r1": "Factorial cell A1: gemini-3.7-flash judge + gemini-embedding-2 encoder, full 204-document test corpus.",
        "t-a2-flash-egemma-r1": "Factorial cell A2: gemini-3.7-flash judge + embeddinggemma encoder \u2014 the same-encoder comparison point for the open-weight judge.",
        "t-b1-31b-egemma-r1": "Factorial cell B1: gemma4:31b judge + embeddinggemma encoder \u2014 the fully open-weight stack.",
        "t-b2-31b-gembed2-r1": "Factorial cell B2 \u2014 the paper's headline result: best identity of any arm at hierarchy parity.",
        "t-a2guard2-flash-egemma-r1": "Deterministic veto on identity links and review merges between distinct rigid identifiers: Domain chains 106\u21920, full-universe identity B-cubed +0.020, replicate variance \u00f77.6.",
        "t-a2guard-flash-egemma-r1": "Vetoed only identity-pass links: fired twice per corpus while chains persisted \u2014 the run that located the chain-merge door in the review pass.",
        "t-a2obf-flash-egemma-r1": "Every open-form surface consistently renamed by a letter-substitution cipher; hard-stratum merge recall unchanged \u2014 resolution is in-context, not memorized.",
        "t-a2cons-flash-egemma-r1": "Majority voting over three identity ballots: no effect at +28% tokens \u2014 the variance lives in the review pass, not the identity ballot.",
        "t-a2coupled-flash-egemma-r1": "Identity and hierarchy asked in one call: a real graph at higher edge precision; the decoupled review pass adds +0.24 reachable recall on top.",
        "t-b1coupled-31b-egemma-r1": "The B1 stack with identity and hierarchy in one call: R-reach .474 vs .735 decoupled (+0.262 delta, Holm p=0.0002) \u2014 the flash ladder replicated on the open-weight judge at 23% of the tokens.",
        "t-naive-flash-egemma-r1": "One plain call per document, no evidence windows, no review: pairwise ~.59, reachable recall ~.39 \u2014 the ladder's bottom rung.",
        "t-base-fs-string": "Classical probabilistic linkage with literature-standard priors: catches near-string aliases and nothing else.",
    })
    return NAME, DESC

GROUPS = [
    ("Factorial cells (paper Tables 2\u20134)", ["t-a1-flash-gembed2-r1", "t-a1-flash-gembed2-r2", "t-a1-flash-gembed2-r3", "t-a2-flash-egemma-r1", "t-a2-flash-egemma-r2", "t-a2-flash-egemma-r3", "t-b1-31b-egemma-r1", "t-b1-31b-egemma-r2", "t-b1-31b-egemma-r3", "t-b2-31b-gembed2-r1", "t-b2-31b-gembed2-r2", "t-b2-31b-gembed2-r3"]),
    ("Order sensitivity (Table 7)", ["t-a1-flash-gembed2-rev", "t-a1-flash-gembed2-shuf42", "t-b1-31b-egemma-rev", "t-b1-31b-egemma-shuf42"]),
    ("Baselines (Table 5)", ["t-floor-exact", "t-floor-thresh-egemma", "t-floor-thresh-gembed2", "t-base-fs-string", "t-anchor-eos", "t-base-exact", "t-base-thresh-egemma", "t-base-thresh-gembed2"]),
    ("Guard, ladder, and robustness arms (\u00a75.2, \u00a75.4)", ["t-a2guard2-flash-egemma-r1", "t-a2guard2-flash-egemma-r2", "t-a2guard2-flash-egemma-r3", "t-a2guard-flash-egemma-r1", "t-a2obf-flash-egemma-r1", "t-a2cons-flash-egemma-r1", "t-a2coupled-flash-egemma-r1", "t-a2coupled-flash-egemma-r2", "t-a2coupled-flash-egemma-r3", "t-b1coupled-31b-egemma-r1", "t-naive-flash-egemma-r1", "t-naive-flash-egemma-r2", "t-naive-flash-egemma-r3"]),
    ("Design ablations (Table 8; development subset)", ["dev-v8-31b-think-s1", "dev-v8-31b-coupled", "dev-v8-31b-edgearray", "dev-v8-31b-nothink", "dev-v8-31b-think-s2", "dev-v8-31b-snip-head", "dev-v8-31b-snip-none", "dev-v8-31b-siblings", "dev-v8-31b-embonly", "dev-v8-flash-egemma", "dev-v8-flash-gembed2", "dev-v8-flash-embonly", "dev-v8-flash-union"]),
]

SKELETON = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>SKEIN-R experiment browser</title>\n<style>\n :root { --line:#d0d7de; --muted:#656d76; --panel:#f6f8fa; --accent:#0969da; }\n * { box-sizing:border-box }\n body { margin:0; font:14px/1.45 system-ui,sans-serif; display:flex; flex-direction:column; height:100vh }\n header { padding:8px 14px; border-bottom:1px solid var(--line); background:var(--panel) }\n .row { display:flex; gap:12px; align-items:center; flex-wrap:wrap }\n header h1 { font-size:15px; margin:0 8px 0 0 }\n header a { color:var(--accent); text-decoration:none; font-size:13px }\n select { font:inherit; padding:4px 6px; max-width:52ch }\n label.cmp { font-size:13px; color:var(--muted); user-select:none }\n .desc { font-size:12.5px; color:var(--muted); margin-top:4px; max-width:120ch }\n .desc a { font-size:12.5px }\n details.help { font-size:13px }\n details.help summary { cursor:pointer; color:var(--accent); list-style:none }\n details.help div { position:absolute; z-index:9; background:#fff; border:1px solid var(--line);\n   border-radius:8px; box-shadow:0 4px 14px rgba(0,0,0,.15); padding:10px 14px; max-width:64ch; margin-top:4px }\n details.help p { margin:6px 0 }\n main { flex:1; display:flex; min-height:0 }\n main iframe { flex:1; border:0; min-width:0 }\n main iframe + iframe { border-left:2px solid var(--line) }\n #right, #selB { display:none }\n body.compare #right, body.compare #selB { display:block }\n @media (prefers-color-scheme: dark) {\n   :root { --line:#30363d; --panel:#161b22; --accent:#4493f8 }\n   body { background:#0d1117; color:#e6edf3 }\n   details.help div { background:#161b22 }\n }\n</style></head><body>\n<header>\n <div class="row">\n  <h1>SKEIN-R experiment browser</h1>\n  <select id="selA"></select>\n  <label class="cmp"><input type="checkbox" id="cmp"> compare side-by-side</label>\n  <select id="selB"></select>\n  <details class="help"><summary>what am I looking at?</summary><div>\n   <p>Each page replays one experiment of the SKEIN-R paper <i>document by document</i>: the left\n   column lists concept schemes (entity categories), the middle shows the SKOS registry as it grows\n   — concepts with preferred/alternative labels and typed ISO&nbsp;25964 broader edges (BTG/BTP/BTI)\n   — and the right column shows that document\'s events: judge verdicts (link&nbsp;/ mint&nbsp;/ defer),\n   review-pass edges and merges, and the full LLM transcripts.</p>\n   <p>The strip under each page’s header shows the run’s scored metrics; the <b>?</b> at its end opens a glossary explaining every score (pairwise vs B³ F1, NIL, R-reach, …).</p><p>Use ▶ to play the stream, the slider to scrub, and the <i>legend</i> inside the page for\n   notation. ★ marks the paper\'s headline run and its remediated configuration. Tick\n   <i>compare</i> to watch two runs side by side — e.g. how two stacks treat the same document.</p>\n   <p>Every run links to its artifact folder on GitHub (run card, registry, decision log,\n   transcripts). The claims–evidence matrix lives in the repository\'s <code>docs/CLAIMS.md</code>.</p>\n  </div></details>\n  <a href="https://github.com/koorchik/skein-resolver" target="_blank" rel="noopener">repository</a>\n </div>\n <div class="desc"><span id="descA"></span> <a id="ghA" target="_blank" rel="noopener">experiment folder ↗</a>\n   <span id="descBwrap" style="display:none"> · <b>vs</b> <span id="descB"></span> <a id="ghB" target="_blank" rel="noopener">folder ↗</a></span></div>\n</header>\n<main><iframe id="left" title="run A"></iframe><iframe id="right" title="run B"></iframe></main>\n<script>\nconst GROUPS = __GROUPS__;\nconst DEFAULT_A = "__DEFA__", DEFAULT_B = "__DEFB__";\nconst GH = \'https://github.com/koorchik/skein-resolver/tree/main/runs/experiments/\';\nconst META = {};\nGROUPS.forEach(g => g.items.forEach(it => META[it.dir] = it));\nfunction fill(sel){ for(const g of GROUPS){ const og=document.createElement(\'optgroup\'); og.label=g.label;\n  for(const it of g.items){ const o=document.createElement(\'option\'); o.value=it.dir; o.textContent=it.label; og.appendChild(o); }\n  sel.appendChild(og); } }\nconst selA=document.getElementById(\'selA\'), selB=document.getElementById(\'selB\'),\n      cmp=document.getElementById(\'cmp\'), L=document.getElementById(\'left\'), R=document.getElementById(\'right\');\nfill(selA); fill(selB);\nfunction state(){ const p=new URLSearchParams(location.hash.slice(1));\n  return { a:p.get(\'run\')||DEFAULT_A, b:p.get(\'vs\')||\'\' }; }\nfunction render(push){ const a=selA.value, b=cmp.checked?selB.value:\'\';\n  document.body.classList.toggle(\'compare\', !!b);\n  if(L.dataset.d!==a){ L.src=\'runs/\'+a+\'.html\'; L.dataset.d=a; }\n  if(b && R.dataset.d!==b){ R.src=\'runs/\'+b+\'.html\'; R.dataset.d=b; }\n  document.getElementById(\'descA\').textContent = (META[a]&&META[a].desc)||\'\';\n  document.getElementById(\'ghA\').href = GH + a;\n  document.getElementById(\'descBwrap\').style.display = b ? \'\' : \'none\';\n  if(b){ document.getElementById(\'descB\').textContent = (META[b]&&META[b].desc)||\'\'; document.getElementById(\'ghB\').href = GH + b; }\n  if(push!==false){ location.hash = \'run=\'+a+(b?\'&vs=\'+b:\'\'); } }\nfunction init(){ const s=state(); selA.value=s.a||DEFAULT_A; if(s.b){ cmp.checked=true; selB.value=s.b; } else { selB.value=DEFAULT_B; } render(false); }\nselA.onchange=()=>render(); selB.onchange=()=>render();\ncmp.onchange=()=>render();\nwindow.onhashchange=init;\ninit();\n</script></body></html>'

def fmt(x):
    return ("%.3f" % x).lstrip("0") if isinstance(x, (int, float)) else "\u2014"

def main():
    cond = lambda d: re.sub(r"-[0-9a-f]{12}$", "", d)
    dirs = sorted(p.name for p in EXP.iterdir() if (p / "run-view.html").exists())
    by_cond = {cond(d): d for d in dirs}
    NAME, DESC = names_and_descriptions()
    if SITE.exists():
        shutil.rmtree(SITE)
    (SITE / "runs").mkdir(parents=True)
    for d in dirs:
        shutil.copy(EXP / d / "run-view.html", SITE / "runs" / f"{d}.html")
    groups, listed = [], set()
    for label, conds in GROUPS:
        items = []
        for c in conds:
            if c not in by_cond:
                continue
            listed.add(by_cond[c])
            desc = DESC.get(c) or DESC.get(re.sub(r"-r\d$", "-r1", c), "")
            try:
                mm = json.load(open(EXP / by_cond[c] / "metrics.json"))
                chip = f"pairwise {fmt(mm['identity']['pairwiseF1'])} \u00b7 B\u00b3 {fmt(mm['identity']['bCubedF1'])} \u00b7 R-reach {fmt(mm['hierarchy']['recallReachable'])}"
                if mm["scope"] == "dev-slice":
                    chip = "dev slice: " + chip
                desc = (desc + " \u2014 " if desc else "") + chip
            except FileNotFoundError:
                pass
            items.append({"dir": by_cond[c], "label": f"{NAME.get(c, c)} ({c})", "desc": desc})
        groups.append({"label": label, "items": items})
    rest = [d for d in dirs if d not in listed]
    if rest:
        groups.append({"label": "Other", "items": [{"dir": d, "label": cond(d), "desc": ""} for d in rest]})
    html = SKELETON.replace("__GROUPS__", json.dumps(groups, ensure_ascii=False))
    html = html.replace("__DEFA__", by_cond["t-b2-31b-gembed2-r1"]).replace("__DEFB__", by_cond["t-a2-flash-egemma-r1"])
    (SITE / "index.html").write_text(html)
    (SITE / ".nojekyll").write_text("")
    total = sum(f.stat().st_size for f in SITE.rglob("*") if f.is_file())
    print(f"site/: {len(dirs)} run pages + hub, {total/1e6:.0f}MB")

if __name__ == "__main__":
    main()
