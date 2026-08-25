#!/usr/bin/env python3
"""The prompting-ladder figures: two precision-recall scatters, one per journal Figure.

Each point is one replicate run; color encodes the ladder rung, shape encodes the judge
(circle = gemini-3.7-flash, square = gemma4:31b). The decoupling trade is the geometry:
each rung moves right (recall gained) and down (precision paid).

  fig-ladder-hierarchy: reachable recall x edge precision (naive / coupled / operator pair,
      both judges where measured).
  fig-ladder-identity: stratum-a merge recall x merge precision, plus the identifier-guard
      arm restoring the pair's precision floor.

Numbers come from each run's scorer-written metrics.json — never typed by hand.
One image per Figure (stacked panels risk vertical-fit problems in the two-column layout).
"""
import json
from glob import glob
from pathlib import Path

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

ROOT = Path(__file__).resolve().parent.parent
EXP = ROOT / 'runs' / 'experiments'
FIG = ROOT / 'analysis' / 'figures'

FIGW = 3.0
BLUE = '#2a78d6'
ORANGE = '#eb6834'
AQUA = '#1baf7a'
GRAY = '#6b6a63'
INK = '#21201c'
GRID = '#e3e2d9'

plt.rcParams.update({
    'font.size': 8.5, 'font.family': 'STIXGeneral', 'mathtext.fontset': 'stix',
    'axes.edgecolor': GRAY, 'axes.labelcolor': INK, 'text.color': INK,
    'axes.titlesize': 9, 'axes.labelsize': 8.5,
    'xtick.color': INK, 'ytick.color': INK, 'xtick.labelsize': 7.5, 'ytick.labelsize': 7.5,
    'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.6,
    'axes.axisbelow': True, 'svg.fonttype': 'none',
    'figure.constrained_layout.use': True,
    'legend.fontsize': 7,
})


def metrics_for(condition: str) -> list[dict]:
    out = []
    for d in sorted(glob(str(EXP / f'{condition}-r?-*'))):
        p = Path(d) / 'metrics.json'
        if p.exists():
            out.append(json.load(open(p)))
    return out


def shape_handles():
    return [
        Line2D([], [], ls='', marker='o', color=INK, mfc='none', label='flash'),
        Line2D([], [], ls='', marker='s', color=INK, mfc='none', label='g31b'),
    ]


def scatter(ax, cond, color, marker, xf, yf):
    ms = metrics_for(cond)
    ax.scatter([xf(m) for m in ms], [yf(m) for m in ms], s=26, marker=marker, color=color,
               zorder=3)


# --- figure 1: hierarchy --------------------------------------------------------------------
fig_h, ax_h = plt.subplots(figsize=(FIGW, 2.4))
xf = lambda m: m['hierarchy']['recallReachable']
yf = lambda m: m['hierarchy']['precision']
scatter(ax_h, 't-naive-flash-egemma', GRAY, 'o', xf, yf)
scatter(ax_h, 't-a2coupled-flash-egemma', AQUA, 'o', xf, yf)
scatter(ax_h, 't-a2-flash-egemma', BLUE, 'o', xf, yf)
scatter(ax_h, 't-b1coupled-31b-egemma', AQUA, 's', xf, yf)
scatter(ax_h, 't-b1-31b-egemma', BLUE, 's', xf, yf)
ax_h.set_xlabel('reachable recall')
ax_h.set_ylabel('edge precision')
ax_h.set_xlim(0.32, 0.80)
ax_h.set_ylim(0.10, 0.55)
ax_h.legend(handles=[
    Line2D([], [], ls='', marker='o', color=GRAY, label='naive (1 call)'),
    Line2D([], [], ls='', marker='o', color=AQUA, label='coupled (1 call)'),
    Line2D([], [], ls='', marker='o', color=BLUE, label='operator pair (2 passes)'),
] + shape_handles(), frameon=False, handletextpad=0.3, loc='upper right')

# --- figure 2: identity, stratum-a merges ---------------------------------------------------
fig_i, ax_i = plt.subplots(figsize=(FIGW, 2.4))
xf = lambda m: m['mergeStratumA']['recall']
yf = lambda m: m['mergeStratumA']['precision']
scatter(ax_i, 't-naive-flash-egemma', GRAY, 'o', xf, yf)
scatter(ax_i, 't-a2coupled-flash-egemma', AQUA, 'o', xf, yf)
scatter(ax_i, 't-a2-flash-egemma', BLUE, 'o', xf, yf)
scatter(ax_i, 't-a2guard2-flash-egemma', ORANGE, 'o', xf, yf)
scatter(ax_i, 't-b1coupled-31b-egemma', AQUA, 's', xf, yf)
scatter(ax_i, 't-b1-31b-egemma', BLUE, 's', xf, yf)
ax_i.set_xlabel('stratum-a merge recall')
ax_i.set_ylabel('merge precision')
ax_i.set_xlim(0.55, 1.0)
ax_i.set_ylim(0.0, 0.95)
ax_i.legend(handles=[
    Line2D([], [], ls='', marker='o', color=GRAY, label='naive'),
    Line2D([], [], ls='', marker='o', color=AQUA, label='coupled'),
    Line2D([], [], ls='', marker='o', color=BLUE, label='operator pair'),
    Line2D([], [], ls='', marker='o', color=ORANGE, label='pair + guard'),
] + shape_handles(), frameon=False, handletextpad=0.3, loc='lower left')

for ext in ('png', 'svg'):
    fig_h.savefig(FIG / f'fig-ladder-hierarchy.{ext}', dpi=300)
    fig_i.savefig(FIG / f'fig-ladder-identity.{ext}', dpi=300)
print('wrote', FIG / 'fig-ladder-hierarchy.png', 'and fig-ladder-identity.png')
