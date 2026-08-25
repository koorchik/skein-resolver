#!/usr/bin/env python3
"""The SKEIN-R per-document step (Def. 5) as a paper figure. Data-independent.

Single-column vertical layout (3.35 in wide) with reserved label bands — the journal column
cannot hold a horizontal pipeline. Labels use the paper's terminology (identity pass / review
pass, line-delimited verdicts, gloss on every mint).
"""
from pathlib import Path

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

FIG = Path(__file__).resolve().parent / 'figures'
FIG.mkdir(parents=True, exist_ok=True)

INK = '#21201c'
GRAY_FILL = '#f2f1eb'
BLUE_FILL = '#cde2fb'
BLUE_EDGE = '#1c5cab'
GRAY_EDGE = '#7a796f'

fig, ax = plt.subplots(figsize=(3.35, 5.6))
ax.set_xlim(0, 100)
ax.set_ylim(-5, 160)
ax.axis('off')


def box(y, h, text, llm=False, dashed=False, x=10, w=80, fs=7.6):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=1.4',
        facecolor=BLUE_FILL if llm else GRAY_FILL,
        edgecolor=BLUE_EDGE if llm else GRAY_EDGE,
        linewidth=1.2, linestyle=(0, (4, 2)) if dashed else '-'))
    ax.text(x + w / 2, y + h / 2, text, ha='center', va='center', fontsize=fs, color=INK,
            linespacing=1.35)


def flow(y_top, y_bot, label=None):
    ax.add_patch(FancyArrowPatch((50, y_top), (50, y_bot), arrowstyle='-|>',
                                 mutation_scale=10, color=INK, linewidth=1.1,
                                 shrinkA=2, shrinkB=2))
    if label:
        ax.text(53, (y_top + y_bot) / 2, label, ha='left', va='center', fontsize=6.4,
                color='#57564e', style='italic')


ax.text(50, 156.5, 'one SKEIN-R step:', ha='center', fontsize=8.2, color=INK)
ax.text(50, 151, '$R_t = \\Psi_{rev} \\circ \\Psi_{id}\\,(d_t,\\ R_{t-1})$',
        ha='center', fontsize=8.8, color=INK)
ax.text(50, 145.8, '2 LLM judge passes per document', ha='center', fontsize=7.0,
        color='#57564e', style='italic')

box(128, 12, 'document $d_t$\nmentions $M_t$ (frozen $\\Phi_{extract}$)')
flow(128, 121.5)
box(106, 13.5, 'candidate generation $\\beta$\ninterleaved: 4 lexical channels\n+ dense name+gloss')
flow(106, 98.5, 'per-mention evidence windows')
box(82, 15, 'identity pass $\\Psi_{id}$ — listwise ballot\nline-delimited verdicts: link | mint\n+ gloss requested per mint', llm=True)
flow(82, 74.5, 'aliases, glosses, NIL mints · id guard')
box(63, 10, 'registry write')
flow(63, 50.5, '$Q_t$ = parentless mints $\\cup$\norphans $\\cup$ gap-swept candidates')
box(34, 15, 'review pass $\\Psi_{rev}$ (fires iff $Q_t \\neq \\emptyset$)\nsource-free review: link verdicts\nmerge concepts · $\\leq$1 broader edge/row', llm=True)
flow(34, 26.5, 'BTG/BTP/BTI · acyclicity + id guard')
box(10, 13.5, 'SKOS registry $R_t$\ntyped DAG, final for the prefix')
ax.add_patch(FancyArrowPatch((50, 10), (50, 4.3), arrowstyle='-|>', mutation_scale=9,
                             color=GRAY_EDGE, linewidth=1.0, shrinkA=1, shrinkB=1))
box(-4, 6.5, 'read-time $\\rho$: rollup views $V_t$ · Turtle export (iso-thes)',
    dashed=True, fs=6.5, x=6, w=88)

for ext in ('png', 'svg'):
    fig.savefig(FIG / f'fig-architecture.{ext}', dpi=300, bbox_inches='tight')
print('wrote', FIG / 'fig-architecture.png')
