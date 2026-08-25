#!/usr/bin/env python3
"""Regenerate every paper figure from committed run artifacts + scored JSON. Zero LLM calls.

Inputs (produced by `npm run evaluate -- ... --json` / `npm run stats -- ... --json` /
scripts in this dir):
  analysis/out/test-main.json     evaluate over the factorial cells + baselines (test split)
  analysis/out/stats-*.json       bin/stats.ts outputs (CIs)
  analysis/out/order-ari.json     cross-order ARI/Jaccard (npm run order-ari -- --run <dirs> --json)
  analysis/out/blocker.json       blocker-bench recall@k per generator x encoder (optional)
  runs/experiments/<dir>/decisions.jsonl   registry growth curves

Outputs: analysis/figures/*.png (300 dpi) + *.svg — referenced by the paper.

Palette: dataviz reference palette, light mode (print). Judges carry hue (flash=blue,
gemma=orange — color follows the entity); encoders carry texture (solid=embeddinggemma,
hatched=gemini-embedding-2), so encoder identity survives grayscale print and CVD.

Sizing contract (TACS column = 4364 twip = 3.03 in): every figure is FIGW wide and is
saved WITHOUT bbox_inches='tight', so the canvas never grows past figsize — anything
outside the axes (annotations, tick labels) must be placed to fit, or it is lost.
"""
import json
import math
import os
import re
from pathlib import Path

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'analysis' / 'out'
FIG = ROOT / 'analysis' / 'figures'
FIG.mkdir(parents=True, exist_ok=True)

FIGW = 3.0          # in; journal column is 3.03 in — native-size PNG must not exceed it

BLUE = '#2a78d6'    # categorical slot 1 — flash judge
ORANGE = '#eb6834'  # categorical slot 2 — gemma judge
AQUA = '#1baf7a'    # slot 3 — baselines when needed
GRAY = '#6b6a63'
INK = '#21201c'
GRID = '#e3e2d9'

plt.rcParams.update({
    # Scientific-paper styling: STIX text + math (Times-compatible, matches the journal body),
    # constrained layout everywhere (no manual spacing -> no label collisions).
    'font.size': 8.5, 'font.family': 'STIXGeneral', 'mathtext.fontset': 'stix',
    'axes.edgecolor': GRAY, 'axes.labelcolor': INK, 'text.color': INK,
    'axes.titlesize': 9, 'axes.labelsize': 8.5,
    'xtick.color': GRAY, 'ytick.color': GRAY, 'xtick.labelsize': 8, 'ytick.labelsize': 8,
    'xtick.labelcolor': INK, 'ytick.labelcolor': INK,
    'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.5,
    'axes.axisbelow': True, 'svg.fonttype': 'none',
    'figure.constrained_layout.use': True,
    'legend.fontsize': 7.5,
})

CELLS = {  # condition prefix -> (label, judge color, encoder hatch)
    # labels match the paper's tables: cell code + the abbreviations defined in §4.4
    't-a1-flash-gembed2': ('A1\nflash/g-emb2', BLUE, '///'),
    't-a2-flash-egemma': ('A2\nflash/e-gemma', BLUE, ''),
    't-b1-31b-egemma': ('B1\ng31b/e-gemma', ORANGE, ''),
    't-b2-31b-gembed2': ('B2\ng31b/g-emb2', ORANGE, '///'),
}


def load(name):
    p = OUT / name
    return json.loads(p.read_text()) if p.exists() else None


def replicate_groups(results):
    """condition -> list of result rows, grouping t-...-r1/r2/r3 replicates."""
    groups = {}
    for row in results:
        cond = row['condition']
        m = re.match(r'^(.*)-r\d$', cond)
        groups.setdefault(m.group(1) if m else cond, []).append(row)
    return groups


def mean_sd(values):
    values = [v for v in values if v is not None and not (isinstance(v, float) and math.isnan(v))]
    if not values:
        return None, None
    mean = sum(values) / len(values)
    sd = (sum((v - mean) ** 2 for v in values) / (len(values) - 1)) ** 0.5 if len(values) > 1 else 0.0
    return mean, sd


def save(fig, name):
    # no bbox_inches='tight': the canvas must stay exactly figsize so the PNG's
    # native width (figsize * dpi) fits the journal column
    for ext in ('png', 'svg'):
        fig.savefig(FIG / f'{name}.{ext}', dpi=300)
    plt.close(fig)
    print(f'wrote {FIG}/{name}.png')


def get_metric(row, path):
    node = row
    for key in path.split('.'):
        if node is None:
            return None
        node = node.get(key) if isinstance(node, dict) else None
    return node


def fig_factorial(main, core):
    """Two column-sized bar charts: identity pairwise F1 and hierarchy R-reach /
    precision per factorial cell. Separate files so each is its own Figure in the
    two-column layout (a stacked panel is taller than a column of text and forces
    a page break with dead white space)."""
    id_core_groups = replicate_groups(core['results'])
    hi_groups = replicate_groups(
        [{'condition': h['condition'], **h['metrics']} for h in main.get('hierarchy', [])]
    )

    charts = [
        ('fig-factorial-id', id_core_groups, ['cluster.pairwise.f1'], ['']),
        ('fig-factorial-hier', hi_groups, ['recallReachable', 'precision'], ['R-reach', 'P']),
    ]
    for name, groups, metrics, sublabels in charts:
        fig, ax = plt.subplots(figsize=(FIGW, 2.3))
        cells = [c for c in CELLS if c in groups]
        n_metrics = len(metrics)
        width = 0.8 / n_metrics
        for mi, metric in enumerate(metrics):
            xs, ys, errs, colors, hatches = [], [], [], [], []
            for ci, cell in enumerate(cells):
                vals = [get_metric(r, metric) for r in groups[cell]]
                mean, sd = mean_sd(vals)
                if mean is None:
                    continue
                xs.append(ci + (mi - (n_metrics - 1) / 2) * width)
                ys.append(mean)
                errs.append(sd or 0)
                colors.append(CELLS[cell][1])
                hatches.append(CELLS[cell][2])
            bars = ax.bar(xs, ys, width * 0.92, color=colors, yerr=errs, capsize=2,
                          error_kw={'ecolor': INK, 'elinewidth': 0.8},
                          alpha=1.0 if mi == 0 else 0.55, edgecolor='white', linewidth=0.5)
            for bar, hatch in zip(bars, hatches):
                bar.set_hatch(hatch)
            for x, y in zip(xs, ys):
                ax.text(x, y + (0.015 if not errs else max(errs) + 0.02), f'{y:.3f}',
                        ha='center', va='bottom', fontsize=6.8, color=INK)
        ax.set_xticks(range(len(cells)))
        ax.set_xticklabels([CELLS[c][0] for c in cells], fontsize=7.5)
        ax.set_ylim(0, 1.12)
        ax.spines[['top', 'right']].set_visible(False)
        if len(metrics) > 1:
            from matplotlib.patches import Patch
            ax.legend(handles=[Patch(facecolor=GRAY, alpha=1.0, label=sublabels[0]),
                               Patch(facecolor=GRAY, alpha=0.55, label=sublabels[1])],
                      fontsize=7.5, frameon=False, loc='upper right')
        save(fig, name)


def fig_tokens(main):
    """Output-token consumption vs hierarchy quality — the cost axis without dollars."""
    id_groups = replicate_groups(main['results'])
    hi_groups = replicate_groups(
        [{'condition': h['condition'], **h['metrics']} for h in main.get('hierarchy', [])]
    )
    fig, ax = plt.subplots(figsize=(FIGW, 2.6))
    points = []
    for cell, (label, color, hatch) in CELLS.items():
        if cell not in id_groups or cell not in hi_groups:
            continue
        toks, _ = mean_sd([get_metric(r, 'cost.outputTokens') for r in id_groups[cell]])
        rr, _ = mean_sd([get_metric(r, 'recallReachable') for r in hi_groups[cell]])
        if toks is None or rr is None:
            continue
        points.append((toks / 1e6, rr, label.replace('\n', ' '), color, hatch))
    if not points:
        return
    xmid = (min(p[0] for p in points) + max(p[0] for p in points)) / 2
    for x, y, label, color, hatch in points:
        marker = 'o' if not hatch else 's'
        ax.scatter([x], [y], s=46, color=color, marker=marker, zorder=3,
                   edgecolor='white', linewidth=0.8)
        # right-half points annotate to the LEFT of the marker so labels stay inside the axes
        left = x > xmid
        ax.annotate(label, (x, y), textcoords='offset points',
                    xytext=(-5, -3) if left else (5, -3), ha='right' if left else 'left',
                    fontsize=7, color=INK)
    ax.margins(x=0.12)
    ax.set_xlabel('output tokens per full-corpus run, millions')
    ax.set_ylabel('reachable edge recall')
    ax.spines[['top', 'right']].set_visible(False)
    save(fig, 'fig-tokens')


def fig_order(order):
    """Order robustness: identity ARI and edge Jaccard per stack across orders."""
    if not order:
        return
    fig, ax = plt.subplots(figsize=(FIGW, 2.3))
    # two-line tick labels matching the paper's order table: cell code + regime.
    # Full stack names ("gemma31b+egemma") collide across five 0.5-inch slots.
    CODES = {'flash+gembed2': 'A1', 'flash+egemma': 'A2',
             'g31b+egemma': 'B1', 'gemma31b+egemma': 'B1'}
    raw = [row['label'] for row in order['rows']]
    labels = ['{}\n{}'.format(CODES[l.split(' ')[0]],
                              'cross-order' if 'cross-order' in l else 'same-order')
              for l in raw]
    x = range(len(labels))
    width = 0.38
    ax.bar([i - width / 2 for i in x], [row['identityAri'] for row in order['rows']],
           width, color=[BLUE if 'flash' in l else ORANGE for l in raw], label='identity ARI')
    ax.bar([i + width / 2 for i in x], [row['edgeJaccard'] for row in order['rows']],
           width, color=[BLUE if 'flash' in l else ORANGE for l in raw], alpha=0.55,
           label='edge Jaccard')
    for i, row in enumerate(order['rows']):
        ax.text(i - width / 2, row['identityAri'] + .015, f"{row['identityAri']:.2f}",
                ha='center', fontsize=6.8)
        ax.text(i + width / 2, row['edgeJaccard'] + .015, f"{row['edgeJaccard']:.2f}",
                ha='center', fontsize=6.8)
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=6.8)
    ax.set_ylim(0, 1.1)
    ax.legend(fontsize=7.5, frameon=False)
    ax.spines[['top', 'right']].set_visible(False)
    save(fig, 'fig-order')


def fig_growth():
    """Registry growth: canonical count vs documents processed (microclustering sanity)."""
    curves = []
    for cell, (label, color, hatch) in CELLS.items():
        for suffix in ('-r1',):
            matches = sorted((ROOT / 'runs' / 'experiments').glob(f'{cell}{suffix}-*'))
            for d in matches:
                log = d / 'decisions.jsonl'
                if not log.exists():
                    continue
                docs, count, seen_docs, mints = [], 0, set(), 0
                for line in log.read_text().splitlines():
                    try:
                        ev = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    doc = ev.get('docId') or ev.get('doc')
                    if doc is not None:
                        seen_docs.add(doc)
                    if ev.get('decision') == 'mint' or ev.get('type') == 'mint':
                        mints += 1
                        docs.append((len(seen_docs), mints))
                if docs:
                    curves.append((label.replace('\n', ' '), color, '--' if hatch else '-', docs))
                break
    if not curves:
        return
    fig, ax = plt.subplots(figsize=(FIGW, 2.4))
    for label, color, style, docs in curves:
        ax.plot([d for d, _ in docs], [m for _, m in docs], style, color=color,
                linewidth=1.4, label=label)
    ax.set_xlabel('documents processed')
    ax.set_ylabel('concepts minted')
    ax.legend(fontsize=7.5, frameon=False)
    ax.spines[['top', 'right']].set_visible(False)
    save(fig, 'fig-growth')




def fig_blocker(blocker):
    """Intrinsic candidate recall@k: short generator labels, encoder as color (legend)."""
    if not blocker:
        return
    rows = blocker['rows']
    SHORT = {'union-rr': 'union-rr', 'embedding-only': 'emb-only',
             'union (RRF)': 'union-RRF', 'string-sim': 'string-sim'}
    COLOR = {'embeddinggemma': ORANGE, 'gemini-embedding-2': BLUE, None: GRAY}
    fig, ax = plt.subplots(figsize=(FIGW, 2.3))
    ys = list(range(len(rows)))[::-1]
    for y, r in zip(ys, rows):
        c = COLOR.get(r.get('encoder'), GRAY)
        ax.plot([r['recallAt4'], r['recallAt10']], [y, y], '-', color=c, linewidth=1.8, zorder=2)
        ax.scatter([r['recallAt4']], [y], s=26, color=c, zorder=3, marker='o',
                   edgecolor='white', linewidth=0.6)
        ax.scatter([r['recallAt10']], [y], s=26, color=c, zorder=3, marker='D',
                   edgecolor='white', linewidth=0.6)
        ax.text(r['recallAt4'] - 0.012, y, f"{r['recallAt4']:.0%}", ha='right', va='center', fontsize=7)
        ax.text(r['recallAt10'] + 0.012, y, f"{r['recallAt10']:.0%}", ha='left', va='center', fontsize=7)
    ax.set_yticks(ys)
    ax.set_yticklabels([SHORT.get(r['generator'], r['generator']) for r in rows], fontsize=8)
    # right limit leaves room for the "@10" percentage labels INSIDE the axes
    ax.set_xlim(0.52, 1.09)
    ax.set_xticks([0.6, 0.7, 0.8, 0.9, 1.0])
    ax.set_xlabel(r'candidate recall  ($\circ$ = @4,  $\diamond$ = @10)', fontsize=8)
    from matplotlib.lines import Line2D
    # legend above the axes: the plot area is dense with value labels on every row
    ax.legend(handles=[Line2D([], [], color=ORANGE, lw=2, label='embeddinggemma'),
                       Line2D([], [], color=BLUE, lw=2, label='gemini-embedding-2')],
              loc='lower left', bbox_to_anchor=(0, 1.01), ncol=2, frameon=False,
              fontsize=7.5, columnspacing=1.2, handlelength=1.4)
    ax.spines[['top', 'right']].set_visible(False)
    save(fig, 'fig-blocker')


def main():
    main_json = load('test-main.json')
    # Identity charts draw from the primary (Domain-excluded) universe; hierarchy charts
    # use the full table (the gold has no Domain edges, so the universe choice does not apply).
    core_json = load('test-main-core.json')
    if main_json:
        fig_factorial(main_json, core_json)
        fig_tokens(main_json)
    order = load('order-ari.json')
    fig_order(order)
    fig_blocker(load('blocker.json'))
    fig_growth()
    print('done')


if __name__ == '__main__':
    main()
