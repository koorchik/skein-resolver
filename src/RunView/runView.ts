import { ConceptRegistry } from '../ConceptRegistry/ConceptRegistry';
import { REPLAY_SOURCE, ReplayState, applyEvent, createEmptyState, docOf } from './replayCore';
import { sortByNumericId } from '../utils/fsUtils';
import { stripRunDate } from '../Experiment/runDirName';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

/**
 * Run playback viewer (SKEIN v2): one self-contained HTML file that replays, document by
 * document, how each processed report changed the registry.
 *
 * Follows the gold-view idiom (`src/Gold/registryView.ts`): no dependencies, light/dark, every
 * member string escaped, data embedded as JSON — works from `file://`.
 *
 * The replay journal is `decisions.jsonl` (requires the run to have set `DECISIONS_LOG=1`);
 * the scrubber axis is derived from the artifacts directory (numeric-id order — the stream
 * order), so it can never drift from what actually ran. The final replayed frame is diffed
 * against `registry.json` at generation time; any mismatch renders as a warning banner.
 */

export interface DocRef {
  id: number;
  date: string;
  title: string;
}

export interface RunViewData {
  runId: string;
  /** Arm identity, read from the run card — what the model switcher labels this run with. */
  arm: ArmId;
  docOrder: DocRef[];
  events: Array<Record<string, unknown>>;
  /** Per-category canonical names of the final on-disk registry, for the self-check. */
  registryFinal: Record<string, string[]>;
  selfCheck: SelfCheck;
  /** Repository-relative artifact folder, e.g. `runs/experiments/<dir>` — for the source link. */
  repoPath: string;
  /** Scorer output (`metrics.json`, written by scripts/score-runs.py), when the run is scored. */
  metrics: Record<string, unknown> | null;
}

/**
 * Which arm a run is, in the terms the experiment varies along: the condition label and the model
 * that answered the per-document judge calls.
 */
export interface ArmId {
  condition: string;
  provider: string;
  model: string;
}

export interface SelfCheck {
  ok: boolean;
  /** category → canonicals the replay has but the registry lacks, and vice versa. */
  extraInReplay: Record<string, string[]>;
  missingInReplay: Record<string, string[]>;
}

export async function loadRunData(runDir: string): Promise<RunViewData> {
  const decisionsPath = path.join(runDir, 'decisions.jsonl');
  if (!existsSync(decisionsPath)) {
    throw new Error(
      `${decisionsPath} not found — playback needs a run made with DECISIONS_LOG=1`
    );
  }
  const events = (await fs.readFile(decisionsPath, 'utf8'))
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);

  const artifactsDir = path.join(runDir, 'artifacts');
  const docOrder: DocRef[] = [];
  if (existsSync(artifactsDir)) {
    for (const file of sortByNumericId(await fs.readdir(artifactsDir))) {
      try {
        const artifact = JSON.parse(await fs.readFile(path.join(artifactsDir, file), 'utf8'));
        docOrder.push({
          id: Number(artifact.metadata?.id) || parseInt(file, 10) || 0,
          date: String(artifact.metadata?.date ?? 'unknown'),
          title: String(artifact.metadata?.title ?? file),
        });
      } catch {
        // an unreadable artifact loses its title, not the whole page
        docOrder.push({ id: parseInt(file, 10) || 0, date: 'unknown', title: file });
      }
    }
  } else {
    // No artifacts (log-only input): derive the axis from the events themselves.
    const seen = new Set<number>();
    for (const event of events) {
      const doc = docOf(event);
      if (doc >= 0 && !seen.has(doc)) {
        seen.add(doc);
        docOrder.push({ id: doc, date: 'unknown', title: `doc ${doc}` });
      }
    }
  }

  const registryFinal: Record<string, string[]> = {};
  const registryPath = path.join(runDir, 'registry.json');
  if (existsSync(registryPath)) {
    const registry = new ConceptRegistry({ filePath: registryPath });
    await registry.load();
    for (const category of registry.conceptSchemes()) {
      registryFinal[category] = Object.keys(registry.concepts(category)).sort();
    }
  }

  // The directory carries a `<YYYY-MM-DD>-` presentation prefix; the runId is what follows it.
  let runId = stripRunDate(path.basename(runDir));
  const arm: ArmId = { condition: runId, provider: 'unknown', model: 'unknown' };
  const cardPath = path.join(runDir, 'run-card.json');
  if (existsSync(cardPath)) {
    try {
      const card = JSON.parse(await fs.readFile(cardPath, 'utf8'));
      runId = String(card.runId ?? runId);
      arm.condition = String(card.condition ?? card.config?.condition ?? runId);
      arm.provider = String(card.config?.llm?.provider ?? 'unknown');
      arm.model = String(card.config?.llm?.model ?? 'unknown');
    } catch {
      /* keep directory name */
    }
  }

  const selfCheck = computeSelfCheck(replayAll(events), registryFinal);
  // Repository-relative folder ("runs/experiments/<dir>") so the page can link to its artifacts.
  const abs = path.resolve(runDir);
  const repoPath = path.join(path.basename(path.dirname(path.dirname(abs))), path.basename(path.dirname(abs)), path.basename(abs));
  // Scorer output, when present (scripts/score-runs.py) — displayed as the run's metrics strip.
  let metrics: Record<string, unknown> | null = null;
  const metricsPath = path.join(runDir, 'metrics.json');
  if (existsSync(metricsPath)) {
    try {
      metrics = JSON.parse(await fs.readFile(metricsPath, 'utf8'));
    } catch {
      /* unscored is fine */
    }
  }
  return { runId, arm, docOrder, events, registryFinal, selfCheck, repoPath, metrics };
}

export function replayAll(events: Array<Record<string, unknown>>): ReplayState {
  const state = createEmptyState();
  for (const event of events) applyEvent(state, event as Record<string, never>);
  return state;
}

/**
 * Generation-time cross-check: the final replayed frame must reproduce the on-disk registry's
 * canonical sets. A mismatch means the journal is incomplete for some operation — surfaced as a
 * banner, never silently.
 */
export function computeSelfCheck(
  state: ReplayState,
  registryFinal: Record<string, string[]>
): SelfCheck {
  const extraInReplay: Record<string, string[]> = {};
  const missingInReplay: Record<string, string[]> = {};
  if (Object.keys(registryFinal).length === 0) {
    return { ok: true, extraInReplay, missingInReplay };
  }

  const categories = new Set([...Object.keys(registryFinal), ...Object.keys(state.categories)]);
  for (const category of categories) {
    const replayed = new Set(Object.keys(state.categories[category]?.entities ?? {}));
    const onDisk = new Set(registryFinal[category] ?? []);
    const extra = [...replayed].filter((name) => !onDisk.has(name)).sort();
    const missing = [...onDisk].filter((name) => !replayed.has(name)).sort();
    if (extra.length > 0) extraInReplay[category] = extra;
    if (missing.length > 0) missingInReplay[category] = missing;
  }
  return {
    ok: Object.keys(extraInReplay).length === 0 && Object.keys(missingInReplay).length === 0,
    extraInReplay,
    missingInReplay,
  };
}

const esc = (value: unknown): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Renders the playback page for one run, or for several arms in ONE page with a model switcher.
 *
 * Multi-arm mode exists to compare arms on the same document: every arm replays the same frozen
 * extractions, so the switcher carries the scrub position across by document id (not by frame
 * index, which would drift if an arm produced fewer artifacts). Each arm keeps its own journal,
 * frame count and self-check banner — nothing is merged, so a claim can always be traced to the
 * run that produced it.
 */
export function renderRunViewHtml(input: RunViewData | RunViewData[]): string {
  const runs = Array.isArray(input) ? input : [input];
  if (runs.length === 0) throw new Error('renderRunViewHtml needs at least one run');

  const payload = JSON.stringify(
    runs.map((data) => ({
      runId: data.runId,
      arm: data.arm,
      docOrder: data.docOrder,
      events: data.events,
      selfCheck: data.selfCheck,
      repoPath: data.repoPath,
      metrics: data.metrics,
    }))
  ).replace(/</g, '\\u003c'); // </script> can never terminate the block

  const title =
    runs.length === 1
      ? `SKEIN run playback — ${esc(runs[0].runId)}`
      : `SKEIN run playback — ${runs.length} arms (${esc(runs.map((r) => r.arm.model).join(' vs '))})`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>${title}</title>
<style>
  :root {
    --bg: #ffffff; --fg: #1f2328; --muted: #656d76; --line: #d0d7de; --panel: #f6f8fa;
    --chip1: #0969da; --chip2: #9a6700; --chip3: #8250df; --warn-bg: #fff8c5; --warn-line: #d4a72c;
    --hl: #fff3b8;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0d1117; --fg: #e6edf3; --muted: #8d96a0; --line: #30363d; --panel: #161b22;
      --chip1: #58a6ff; --chip2: #d29922; --chip3: #bc8cff; --warn-bg: #3a2d12; --warn-line: #9e6a03;
      --hl: #4d3800;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg);
         font: 14px/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  header { padding: 10px 16px; border-bottom: 1px solid var(--line); position: sticky; top: 0;
           background: var(--bg); z-index: 5; }
  header h1 { font-size: 16px; margin: 0 0 6px; }
  header .sub { color: var(--muted); font-size: 12px; }
  .controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
  .controls input[type=range] { flex: 1; min-width: 200px; }
  .controls button { background: var(--panel); color: var(--fg); border: 1px solid var(--line);
                     border-radius: 6px; padding: 3px 10px; cursor: pointer; font-size: 13px; }
  .controls .pos { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 12px; }
  .armrow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px;
            padding-bottom: 8px; border-bottom: 1px dashed var(--line); }
  .armrow label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em;
                  color: var(--muted); }
  .armrow select { background: var(--panel); color: var(--fg); border: 1px solid var(--line);
                   border-radius: 6px; padding: 3px 8px; font-size: 13px; max-width: 100%; }
  .armrow .armmeta { color: var(--muted); font-size: 12px; }
  .armrow .armmeta code { color: var(--fg); }
  .banner { background: var(--panel); border: 1px solid var(--line); border-radius: 6px;
            color: var(--muted); padding: 8px 12px; margin: 10px 16px; font-size: 13px; }
  main { display: grid; grid-template-columns: 220px 1fr 340px; gap: 0; min-height: 0; }
  @media (max-width: 1000px) { main { grid-template-columns: 1fr; } }
  nav { border-right: 1px solid var(--line); padding: 10px; }
  nav .cat { display: flex; justify-content: space-between; padding: 4px 8px; border-radius: 6px;
             cursor: pointer; }
  nav .cat.active { background: var(--panel); font-weight: 600; }
  nav .cat .n { color: var(--muted); font-variant-numeric: tabular-nums; }
  section.middle { padding: 12px 16px; min-width: 0; }
  aside { border-left: 1px solid var(--line); padding: 12px; font-size: 13px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted);
       margin: 14px 0 6px; }
  ul.forest { list-style: none; padding-left: 18px; margin: 4px 0; border-left: 1px solid var(--line); }
  ul.forest > li { padding: 2px 0; }
  .ent { border-radius: 4px; padding: 1px 4px; }
  .ent.changed { background: var(--hl); }
  .fold { color: var(--muted); font-size: 11px; margin-left: 6px; }
  .ent .deferred { color: var(--chip2); font-size: 11px; margin-left: 4px; }
  .aliases { padding-left: 36px; margin-top: 1px; }
  .alias { display: inline-block; font-size: 11px; color: var(--fg); background: var(--hl);
           border-radius: 10px; padding: 0 7px; margin: 1px 3px 1px 0; opacity: .85; }
  .relbar { display: flex; gap: 12px; align-items: center; font-size: 12px; color: var(--muted);
            margin: 2px 0 6px; flex-wrap: wrap; }
  .navhead { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted);
             margin: 2px 4px 6px; }
  .metrics { display: flex; gap: 6px 14px; flex-wrap: wrap; align-items: baseline; margin-top: 6px;
             font-size: 12.5px; }
  .metrics .metric { white-space: nowrap; cursor: help; }
  .metrics .mlabel { color: var(--muted); font-size: 11px; }
  .mhelp summary { cursor: pointer; color: var(--chip1); border: 1px solid var(--line);
                   border-radius: 50%; width: 17px; height: 17px; display: inline-flex;
                   align-items: center; justify-content: center; font-size: 12px; list-style: none; }
  .mhelp summary::-webkit-details-marker { display: none; }
  .mhelp .legendbody { max-width: 76ch; max-height: 60vh; overflow-y: auto; }
  .metrics .scopenote { color: var(--warn-line); font-size: 11.5px; }
  .legend summary { cursor: pointer; color: var(--chip1); }
  .legendbody { position: absolute; z-index: 5; max-width: 60ch; background: var(--bg);
                border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px;
                box-shadow: 0 4px 14px rgba(0,0,0,.12); font-size: 12px; }
  .legendbody div { margin: 4px 0; }
  .relbar label { cursor: pointer; }
  .edgekind { font-size: 11px; margin-left: 6px; }
  .edgekind.broaderInstantial { color: var(--chip1); }
  .edgekind.broaderGeneric { color: var(--chip3); }
  .edgekind.broaderPartitive { color: var(--chip2); }
  .repeat { color: var(--muted); font-style: italic; }
  input.filter { width: 100%; margin: 4px 0 8px; padding: 5px 8px; border: 1px solid var(--line);
                 border-radius: 6px; background: var(--bg); color: var(--fg); }
  .event { border-bottom: 1px solid var(--line); padding: 5px 0; overflow-wrap: anywhere; }
  .event .op { font-weight: 600; }
  .event .op.link { color: var(--chip1); }
  .event .op.mint { color: var(--fg); }
  .event .op.defer { color: var(--chip2); }
  .event .op.repair { color: var(--chip3); }
  .event .why { color: var(--muted); font-size: 12px; }
  details.singletons summary { color: var(--muted); cursor: pointer; }
  .renames { color: var(--muted); font-size: 13px; }
  .empty { color: var(--muted); font-style: italic; }
</style>
</head>
<body>
<header>
  <h1>SKEIN run playback — <code id="runid"></code></h1>
  <div class="armrow" id="armrow">
    <span id="armswitch" hidden><label for="arm">model / arm</label> <select id="arm"></select></span>
    <span class="armmeta" id="armmeta"></span>
  </div>
  <div class="metrics" id="metrics"></div>
  <div class="sub" id="docline"></div>
  <div class="controls">
    <button id="step-back" title="one document back">⏮</button>
    <button id="play">▶</button>
    <button id="step-fwd" title="one document forward">⏭</button>
    <input type="range" id="scrubber" min="0" value="0">
    <span class="pos" id="pos"></span>
    <select id="speed"><option value="600">slow</option><option value="250" selected>normal</option><option value="80">fast</option></select>
  </div>
</header>
<div id="banner"></div>
<main>
  <nav><div class="navhead" title="each category is a skos:ConceptScheme">Concept schemes</div><div id="cats"></div></nav>
  <section class="middle">
    <input class="filter" id="filter" placeholder="filter entity names…">
    <h2>Registry (granularity forest)</h2>
    <div id="forest"></div>
  </section>
  <aside>
    <h2 id="doc-events-title">This document</h2>
    <div id="doc-events"></div>
  </aside>
</main>
<script>
${REPLAY_SOURCE}

var DATA = null; // the active arm — bound by bindArm() below
var RUNS = ${payload};
var runIndex = 0;

// Frame f = state after processing docOrder[f-1]; frame 0 = empty; the last frame appends the
// consolidator's batch-reference chapter (doc -1 events logged after the stream — T11: per-document
// repair ops now carry their own real doc id, so this trailing frame is specific to the older
// whole-corpus consolidator pass). Every arm has its own journal and therefore its own frame axis,
// so these are rebound on each arm switch.
var repairEvents = [];
var frameCount = 0;
var frame = 0;
var activeCategory = null;
var playTimer = null;

/**
 * Switch arms, carrying the reading position across by DOCUMENT ID rather than frame index —
 * arms can differ in how many artifacts they produced, so index 57 need not be the same report.
 * An arm that never saw the current document clamps instead of jumping somewhere arbitrary.
 */
function bindArm(index, keepDocId) {
  runIndex = index;
  DATA = RUNS[index];
  repairEvents = DATA.events.filter(function (e) { return docOf(e) < 0; });
  var previous = frame;
  frameCount = DATA.docOrder.length + (repairEvents.length > 0 ? 1 : 0);
  if (keepDocId === undefined || keepDocId === null || keepDocId === -1) {
    frame = frameCount;
    return;
  }
  for (var i = 0; i < DATA.docOrder.length; i++) {
    if (DATA.docOrder[i].id === keepDocId) { frame = i + 1; return; }
  }
  frame = Math.min(previous, frameCount);
}

function renderArmBar() {
  // The switcher only exists on multi-arm pages; the meta line (run id, doc count, artifact
  // folder link, snapshot note) renders for every page.
  if (RUNS.length > 1) {
    document.getElementById('armswitch').hidden = false;
    document.getElementById('arm').innerHTML = RUNS.map(function (r, i) {
      return '<option value="' + i + '"' + (i === runIndex ? ' selected' : '') + '>' +
        esc(r.arm.condition) + ' \\u2014 ' + esc(r.arm.provider) + '/' + esc(r.arm.model) + '</option>';
    }).join('');
  }
  var meta = esc(DATA.arm.provider) + '/' + esc(DATA.arm.model) +
    ' \\u00b7 ' + DATA.docOrder.length + ' doc(s)';
  if (!DATA.selfCheck.ok) meta += ' \\u00b7 snapshots label-approximate';
  if (DATA.repoPath) {
    meta += ' \\u00b7 <a href="https://github.com/koorchik/skein-resolver/tree/main/' + esc(DATA.repoPath) +
      '" target="_blank" rel="noopener">experiment folder \\u2197</a>';
  }
  document.getElementById('armmeta').innerHTML = meta;
  renderMetrics();
}

function fmt(x) { return (typeof x === 'number' && isFinite(x)) ? x.toFixed(3).replace(/^0\\./, '.') : '—'; }
function fmtBig(x) {
  if (typeof x !== 'number' || !isFinite(x) || x === 0) return x === 0 ? '0' : '—';
  return x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'k' : String(x);
}
function metricChip(label, value, title) {
  return '<span class="metric" title="' + esc(title) + ' (click for the full glossary)"' +
    ' onclick="document.getElementById(\\'mglossary\\').open = true">' +
    '<span class="mlabel">' + esc(label) + '</span> ' + value + '</span>';
}

function metricsGlossaryHtml() {
  var rows = [
    ['pairwise F1', 'Every pair of gold-labeled mentions is a yes/no question: does the system put them in the same concept exactly when the gold does? Precision and recall over those pairs, combined as F1. Because a cluster of n mentions contains n·(n−1)/2 pairs, one wrong chain merge between large clusters costs many pairs at once — this is the score that punishes chain merges hardest. A system that never merges anything scores 0 (it misses every true pair).'],
    ['B\\u00b3 F1 (B-cubed)', 'Scored per mention, then averaged. For each mention: precision = what fraction of its predicted cluster truly belongs with it; recall = what fraction of its gold cluster it was grouped with. Element averaging means the many small clusters dominate, so B\\u00b3 stays high even when a few catastrophic merges crush pairwise F1 — the two metrics disagree exactly when chain merges exist.'],
    ['NIL F1', 'How well the system recognizes novelty: a mention whose referent is NOT yet in the registry should be minted as a new concept, not linked to an existing one. Scored against the gold NIL labels as F1.'],
    ['merge P/R (a)', 'Restricted to stratum-a gold alias pairs — the hard ones that no exact-string or embedding-similarity rule finds, so only the LLM judge can merge them. Precision: what fraction of the system\\u2019s stratum-a merges are correct. Recall: what fraction of the gold\\u2019s stratum-a pairs it found. The cleanest read of judge quality, uncontaminated by trivial matches.'],
    ['R-reach', 'Hierarchy recall over reachable gold edges: of the gold broader edges whose two endpoint concepts both exist in this run\\u2019s registry, the fraction the system asserted (directly or via a transitive chain). \\u201cReachable\\u201d excludes edges the identity stage never gave the hierarchy stage a chance to draw.'],
    ['edge P', 'Fraction of the system\\u2019s predicted broader edges that match a gold edge. Read with care: the gold annotates 392 edge pairs, so a true-but-unannotated edge counts against precision — the paper treats this as a deflated lower bound.'],
    ['kind', 'Among matched edges, agreement on the ISO 25964 relationship type: broaderGeneric (is-a, BTG), broaderPartitive (part-of, BTP), or broaderInstantial (instance-of, BTI).'],
    ['calls / tokens', 'LLM judge calls plus uncached embedding calls, and total input+output tokens consumed by the arm. The paper reports cost in these units only (no dollars, no wall time — neither is reproducible).'],
  ];
  return '<details class="legend mhelp" id="mglossary"><summary>?</summary><div class="legendbody">' +
    '<div><b>Metric glossary</b> — every number here is produced by the repository\\u2019s scorer ' +
    '(scripts/score-runs.py \\u2192 metrics.json), never typed by hand.</div>' +
    rows.map(function (r) { return '<div><b>' + r[0] + '</b> — ' + r[1] + '</div>'; }).join('') +
    '</div></details>';
}
function renderMetrics() {
  var el = document.getElementById('metrics');
  var m = DATA.metrics;
  if (!m || !m.identity) { el.innerHTML = ''; return; }
  var chips = [
    metricChip('pairwise F1', fmt(m.identity.pairwiseF1), 'identity: pairwise F1 over gold-labeled pairs (quadratically sensitive to chain merges)'),
    metricChip('B\\u00b3 F1', fmt(m.identity.bCubedF1), 'identity: element-averaged B-cubed F1'),
    metricChip('NIL F1', fmt(m.identity.nilF1), 'out-of-registry (NIL) detection F1'),
    metricChip('merge P/R (a)', fmt(m.mergeStratumA.precision) + '/' + fmt(m.mergeStratumA.recall), 'stratum-a merges: the hard, judge-required alias pairs'),
    metricChip('R-reach', fmt(m.hierarchy.recallReachable), 'hierarchy: recall over gold broader edges reachable in the prediction'),
    metricChip('edge P', fmt(m.hierarchy.precision), 'hierarchy: nominal precision of predicted broader edges (deflated by the sparse 392-pair gold)'),
    metricChip('kind', fmt(m.hierarchy.kindAgreement), 'BTG/BTP/BTI type agreement on matched edges'),
    metricChip('calls', fmtBig(m.cost.judgeAndEmbedCalls), 'LLM + uncached embedding calls'),
    metricChip('tokens', fmtBig(m.cost.tokens), 'total input+output tokens'),
  ];
  var scope = m.scope === 'dev-slice'
    ? '<span class="scopenote">dev slice (22 docs, Software) — relative evidence only, not comparable to corpus-scale runs</span>'
    : m.scope === 'test-corpus-pseudonymized'
      ? '<span class="scopenote">scored against the pseudonymized gold (gold-obf.json)</span>'
      : m.primaryUniverse
        ? '<span class="scopenote">identity scored on the primary universe (without Domain — 60% of gold clusters, all singletons); full-universe values in metrics.json</span>'
        : '';
  el.innerHTML = chips.join('') + metricsGlossaryHtml() + scope;
}

function eventsUpTo(f) {
  var docsIncluded = {};
  var limit = Math.min(f, DATA.docOrder.length);
  for (var i = 0; i < limit; i++) docsIncluded[DATA.docOrder[i].id] = true;
  var includeRepair = f > DATA.docOrder.length || (f === frameCount && repairEvents.length > 0 && f > DATA.docOrder.length - 1 && frameCount > DATA.docOrder.length);
  return DATA.events.filter(function (e) {
    var d = docOf(e);
    if (d < 0) return includeRepair;
    return docsIncluded[d] === true;
  });
}

function stateAt(f) {
  var state = createEmptyState();
  eventsUpTo(f).forEach(function (e) { applyEvent(state, e); });
  return state;
}

function currentDocId(f) {
  if (f === 0) return null;
  if (f > DATA.docOrder.length) return -1;
  return DATA.docOrder[f - 1].id;
}

var esc = function (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

function render() {
  var state = stateAt(frame);
  var docId = currentDocId(frame);
  document.getElementById('runid').textContent = DATA.runId;
  renderArmBar();
  document.getElementById('scrubber').max = String(frameCount);
  document.getElementById('scrubber').value = String(frame);

  var posLabel = frame === 0 ? 'before first document'
    : frame > DATA.docOrder.length ? 'after the batch-reference chapter'
    : 'after doc ' + frame + '/' + DATA.docOrder.length;
  document.getElementById('pos').textContent = posLabel +
    ' · links ' + state.counts.links + ' · mints ' + state.counts.mints + ' · defers ' + state.counts.defers;

  var docline = '';
  if (docId !== null && docId >= 0) {
    var ref = DATA.docOrder[frame - 1];
    docline = 'doc ' + ref.id + ' — ' + esc(ref.title) + ' (' + esc(ref.date) + ')';
  } else if (docId === -1) {
    docline = 'batch-reference chapter: consolidator operations (merge / split / edge / rename / category correction)';
  }
  document.getElementById('docline').innerHTML = docline;

  renderBanner();
  renderCategories(state);
  renderForest(state, docId);
  renderDocEvents(docId);
}

function renderBanner() {
  var el = document.getElementById('banner');
  if (DATA.selfCheck.ok) { el.innerHTML = ''; return; }
  var n = 0;
  Object.keys(DATA.selfCheck.missingInReplay).forEach(function (cat) {
    n += DATA.selfCheck.missingInReplay[cat].length;
  });
  el.innerHTML = '<div class="banner">ℹ Timeline and events are exact (replayed from the journal). ' +
    'In the intermediate registry snapshots, ' + n + ' concept(s) appear under an alias instead of ' +
    'their final preferred label (the label-survivor choice is not journaled); ' +
    '<code>registry.json</code> is authoritative for final state.</div>';
}

function renderCategories(state) {
  var cats = Object.keys(state.categories).sort();
  if (activeCategory === null || cats.indexOf(activeCategory) === -1) activeCategory = cats[0] || null;
  document.getElementById('cats').innerHTML = cats.map(function (cat) {
    var n = Object.keys(state.categories[cat].entities).length;
    return '<div class="cat' + (cat === activeCategory ? ' active' : '') + '" data-cat="' + esc(cat) + '">' +
      '<span>' + esc(cat) + '</span><span class="n">' + n + '</span></div>';
  }).join('') || '<div class="empty">no categories yet</div>';
  Array.prototype.forEach.call(document.querySelectorAll('#cats .cat'), function (el) {
    el.addEventListener('click', function () { activeCategory = el.getAttribute('data-cat'); render(); });
  });
}

/** The ISO 25964 broader-edge vocabulary (iso-thes), as the registry stores it. */
var RELATIONS = [
  { key: 'broaderGeneric',    code: 'BTG', human: 'is-a' },
  { key: 'broaderPartitive',  code: 'BTP', human: 'part-of' },
  { key: 'broaderInstantial', code: 'BTI', human: 'instance-of' }
];
function relationMeta(type) {
  for (var i = 0; i < RELATIONS.length; i++) if (RELATIONS[i].key === type) return RELATIONS[i];
  return { key: type, code: type, human: type };
}
/** Which ISO 25964 broader types the forest currently draws — the fold, made interactive. */
var visibleRelations = { broaderInstantial: true, broaderGeneric: true, broaderPartitive: true };
function typeOf(edge) { return edge.type || 'broaderGeneric'; }
function relationVisible(type) { return visibleRelations[type] !== false; }
function toggleRelation(type, on) { visibleRelations[type] = on; render(); }

function legendHtml() {
  return '<details class="legend"><summary>legend</summary><div class="legendbody">' +
    '<div><b>Concept schemes</b> (left) are the entity categories — each is a skos:ConceptScheme.</div>' +
    '<div><b>Concepts</b>: the bold name is the preferred label (skos:prefLabel); indented surfaces below it are alternative labels (skos:altLabel) accrued as the stream linked mentions.</div>' +
    '<div><b>Broader edges</b> (ISO 25964 / iso-thes): ' +
    RELATIONS.map(function (r) {
      return '<span class="edgekind ' + r.key + '">' + r.code + '</span> ' + r.key + ' — ' + r.human;
    }).join('; ') + '. Colored tags on a child node name its edge to the parent; “sim” is the cosine similarity of the endpoint names; “review” marks edges asserted by the source-free review pass.</div>' +
    '<div><b>⤵ n entities · m surfaces</b>: what a read-time rollup folded into this node would absorb, given the ticked edge types.</div>' +
    '<div><b>Renames</b> are renamed-to edges (kept separate from the broader hierarchy); <b>deferred</b> marks a provisional mint awaiting its review; <b>Merged (no hierarchy)</b> are multi-label concepts without broader edges; singletons are collapsed at the bottom.</div>' +
    '<div>In the event feed: <b>link</b> attaches a mention to an existing concept, <b>mint</b> creates one, <b>defer</b> mints provisionally.</div>' +
    '</div></details>';
}

function renderForest(state, docId) {
  var el = document.getElementById('forest');
  var bucket = activeCategory ? state.categories[activeCategory] : null;
  if (!bucket) { el.innerHTML = '<div class="empty">nothing here yet</div>'; return; }
  var filter = document.getElementById('filter').value.trim().toLowerCase();

  var children = {}; var hasParent = {};
  bucket.edges.forEach(function (edge) {
    (children[edge.broader] = children[edge.broader] || []).push(edge);
    hasParent[edge.narrower] = true;
  });
  var inHierarchy = {};
  bucket.edges.forEach(function (edge) { inHierarchy[edge.narrower] = true; inHierarchy[edge.broader] = true; });

  var touched = {};
  if (docId !== null) {
    DATA.events.forEach(function (e) {
      if (docOf(e) !== docId || (e.category || (e.into && e.into.category)) !== activeCategory) return;
      [e.target, e.mintedAs, e.from, e.to, e.into, e.canonical, e.newCanonical].forEach(function (name) {
        if (typeof name === 'string') touched[name] = true;
        else if (name && name.canonical) touched[name.canonical] = true;
      });
    });
  }

  function matches(name) {
    if (!filter) return true;
    var entity = bucket.entities[name];
    if (name.toLowerCase().indexOf(filter) !== -1) return true;
    return entity && entity.aliases.some(function (a) { return a.toLowerCase().indexOf(filter) !== -1; });
  }

  /** Surfaces this node would absorb if the visible relations were contracted into it. */
  function subtreeSize(name, guard) {
    guard = guard || {};
    if (guard[name]) return { nodes: 0, surfaces: 0 };
    guard[name] = true;
    var nodes = 0;
    var surfaces = 0;
    (children[name] || []).forEach(function (edge) {
      if (!relationVisible(typeOf(edge))) return;
      var entity = bucket.entities[edge.narrower] || { aliases: [edge.narrower] };
      nodes += 1;
      surfaces += entity.aliases.length;
      var deeper = subtreeSize(edge.narrower, guard);
      nodes += deeper.nodes;
      surfaces += deeper.surfaces;
    });
    return { nodes: nodes, surfaces: surfaces };
  }

  function nodeHtml(name, edge, seen, parentName) {
    var entity = bucket.entities[name] || { aliases: [name] };
    var repeated = seen[name] === true;
    seen[name] = true;
    var cls = 'ent' + (touched[name] ? ' changed' : '');

    var html = '<li><span class="' + cls + '">' + esc(name);
    if (entity.deferred) html += '<span class="deferred">deferred</span>';
    html += '</span>';

    if (edge) {
      var rel = relationMeta(typeOf(edge));
      var sim = typeof edge.similarityScore === 'number' ? ' · sim ' + edge.similarityScore.toFixed(2) : '';
      html += '<span class="edgekind ' + esc(typeOf(edge)) + '" title="iso-thes:' + esc(rel.key) + ' — ' +
        esc(rel.human) + '">' + esc(rel.code) + sim + (edge.by ? ' · ' + esc(edge.by) : '') + '</span>';
    }

    var fold = subtreeSize(name);
    if (fold.nodes > 0) {
      html += '<span class="fold" title="folding the visible relations into this node absorbs ' +
        fold.nodes + ' entities and ' + fold.surfaces + ' surfaces">⤵ ' + fold.nodes + ' entities · ' +
        (fold.surfaces + entity.aliases.length) + ' surfaces</span>';
    }

    var extraAliases = entity.aliases.filter(function (a) { return a !== name; });
    if (extraAliases.length > 0) {
      html += '<div class="aliases">' + extraAliases.map(function (a) {
        return '<span class="alias">' + esc(a) + '</span>';
      }).join('') + '</div>';
    }
    if (repeated) { html += ' <span class="repeat">↻ repeated</span></li>'; return html; }

    var kids = (children[name] || []).filter(function (kid) { return relationVisible(typeOf(kid)); });
    kids = kids.slice().sort(function (a, b) { return a.narrower < b.narrower ? -1 : 1; });
    if (kids.length > 0) {
      html += '<ul class="forest">' + kids.map(function (kid) {
        return nodeHtml(kid.narrower, kid, seen, name);
      }).join('') + '</ul>';
    }
    return html + '</li>';
  }

  var names = Object.keys(bucket.entities).sort();
  var roots = names.filter(function (name) { return inHierarchy[name] && !hasParent[name]; });
  var flat = names.filter(function (name) { return !inHierarchy[name] && bucket.entities[name].aliases.length > 1; });
  var singles = names.filter(function (name) { return !inHierarchy[name] && bucket.entities[name].aliases.length <= 1; });

  var seen = {};
  var html = '<div class="relbar">broader edges:' +
    RELATIONS.map(function (rel) {
      return '<label title="unticking hides these edges and recomputes what each node absorbs">' +
        '<input type="checkbox" ' + (relationVisible(rel.key) ? 'checked' : '') +
        ' onchange="toggleRelation(\\'' + rel.key + '\\', this.checked)"> ' +
        '<span class="edgekind ' + rel.key + '">' + rel.human + ' (' + rel.code + ')</span></label>';
    }).join('') + legendHtml() + '</div>';
  var shownRoots = roots.filter(matches);
  if (shownRoots.length > 0) {
    html += '<ul class="forest">' + shownRoots.map(function (root) { return nodeHtml(root, null, seen, null); }).join('') + '</ul>';
  }
  if (bucket.renames.length > 0) {
    html += '<h2>Renames (renamed-to)</h2><div class="renames">' + bucket.renames.map(function (edge) {
      return esc(edge.from) + ' → ' + esc(edge.to);
    }).join('<br>') + '</div>';
  }
  var shownFlat = flat.filter(matches);
  if (shownFlat.length > 0) {
    html += '<h2>Merged (no hierarchy)</h2><ul class="forest">' +
      shownFlat.map(function (name) { return nodeHtml(name, null, {}); }).join('') + '</ul>';
  }
  var shownSingles = singles.filter(matches);
  if (shownSingles.length > 0) {
    html += '<details class="singletons"><summary>' + shownSingles.length + ' singleton(s)</summary><ul class="forest">' +
      shownSingles.map(function (name) { return nodeHtml(name, null, {}); }).join('') + '</ul></details>';
  }
  el.innerHTML = html || '<div class="empty">no matching entities</div>';
}

function renderDocEvents(docId) {
  var el = document.getElementById('doc-events');
  var title = document.getElementById('doc-events-title');
  if (docId === null) { title.textContent = 'This document'; el.innerHTML = '<div class="empty">scrub forward to see per-document changes</div>'; return; }
  // T11: "Repair operations" would now be misleading here — per-document repairs render under their
  // own doc id ('Changes from doc N'); this frame is specifically the older batch consolidator pass.
  title.textContent = docId === -1 ? 'Batch-reference operations' : 'Changes from doc ' + docId;
  var rows = DATA.events.filter(function (e) { return docOf(e) === docId && e.op !== 'llm-call'; });
  var calls = DATA.events.filter(function (e) { return docOf(e) === docId && e.op === 'llm-call'; });
  var html = rows.map(function (e) {
    if (e.op === 'decision') {
      // Class names are a closed set; anything else in the log renders as plain 'mint' styling.
      var cls = e.decision === 'link' || e.decision === 'defer' ? e.decision : 'mint';
      var what = e.decision === 'link' ? esc(e.mention) + ' → ' + esc(e.target)
        : e.decision === 'defer' ? esc(e.mention) + ' (provisional: ' + esc(e.mintedAs || '?') + ')'
        : esc(e.mention);
      return '<div class="event"><span class="op ' + cls + '">' + esc(e.decision) + '</span> ' + what +
        ' <span class="why">' + esc(e.category || '') + '</span></div>';
    }
    if (e.op === 'broader-edge' || e.op === 'granularity-edge') {
      var narrower = e.narrower !== undefined ? e.narrower : e.from;
      var broader = e.broader !== undefined ? e.broader : e.to;
      var typeLabel = e.type || e.relation || e.kind;
      var simLabel = typeof e.similarityScore === 'number' ? ' · sim ' + e.similarityScore.toFixed(2) : '';
      return '<div class="event"><span class="op">edge</span> ' + esc(narrower) + ' —[' + esc(typeLabel) + ']→ ' +
        esc(broader) + ' <span class="why">' + esc(e.category || '') + simLabel + (e.by ? ' · ' + esc(e.by) : '') + '</span></div>';
    }
    if (e.op === 'skos-catch-up') {
      return '<div class="event"><span class="op">catch-up</span> ' + esc(e.category) +
        ' <span class="why">reviewed ' + esc(e.reviewed) + ' · merged ' + esc(e.merged) +
        ' · edged ' + esc(e.edged) + '</span></div>';
    }
    if (e.op === 'merge') {
      return '<div class="event"><span class="op repair">merge</span> ' + esc(e.from) + ' ⇒ ' + esc(e.into) +
        ' <span class="why">' + esc(e.category || '') + (e.by ? ' · ' + esc(e.by) : '') + '</span></div>';
    }
    // T11: repair-merge/repair-split/repair-move/repair-distinct/repair-keep are the StreamingRepairer's
    // structural verdicts — same "repair" chip as the older consolidator ops they sit alongside (a T9
    // review flagged that leaving them out of this list makes them fall through to the generic
    // '<op>' row below, with no description).
    if (e.op === 'merge-canonical' || e.op === 'split-canonical' || e.op === 'rename-edge' || e.op === 'category-correction' ||
        e.op === 'repair-merge' || e.op === 'repair-split' || e.op === 'repair-move' || e.op === 'repair-distinct' || e.op === 'repair-keep') {
      var desc = e.op === 'merge-canonical' || e.op === 'repair-merge' ? esc(e.from) + ' ⇒ ' + esc(e.into)
        : e.op === 'split-canonical' || e.op === 'repair-split' ? esc(e.canonical) + ' ⇏ ' + esc((e.detached || []).join(', '))
        : e.op === 'rename-edge' ? esc(e.from) + ' → ' + esc(e.to)
        : e.op === 'repair-move' ? esc(e.alias) + ': ' + esc(e.from) + ' → ' + esc(e.to)
        : e.op === 'repair-distinct' ? esc((e.pair || []).join(' ≠ '))
        : e.op === 'repair-keep' ? esc(e.entity)
        : esc(e.from && e.from.category) + '/' + esc(e.from && e.from.canonical) + ' ⇒ ' + esc(e.into && e.into.category);
      var label = e.op.replace('-canonical', '').replace('-edge', '').replace('repair-', '');
      return '<div class="event"><span class="op repair">' + esc(label) +
        '</span> ' + desc + ' <span class="why">' + esc(e.category || '') + '</span></div>';
    }
    // T11 telemetry: no structural fold, but still worth surfacing as low-key rows rather than
    // falling through to the bare '<op>' default.
    if (e.op === 'suspect' || e.op === 'repair-spillover' || e.op === 'gloss-flagged' ||
        e.op === 'repair-op-rejected' || e.op === 'repair-op-skipped') {
      var telemetry = e.op === 'suspect' ? esc((e.pair || []).join(' ~ ')) + ' <span class="why">' + esc(e.signal) + ' ' + esc(e.score) + '</span>'
        : e.op === 'repair-spillover' ? esc(e.size) + ' suspect(s) <span class="why">' + esc(e.reason) + '</span>'
        : e.op === 'gloss-flagged' ? esc(e.mention) + ' <span class="why">' + esc(e.kind) + '</span>'
        : esc(e.verdict || '') + ' <span class="why">' + esc(e.reason) + (e.detail ? ': ' + esc(e.detail) : '') + '</span>';
      return '<div class="event"><span class="op">' + esc(e.op) + '</span> ' + telemetry + '</div>';
    }
    return '<div class="event"><span class="op">' + esc(e.op) + '</span></div>';
  }).join('');
  if (calls.length > 0) {
    html += '<div class="event why">' + calls.length + ' LLM call(s): ' + calls.map(function (c) { return esc(c.kind); }).join(', ') + '</div>';
  }
  el.innerHTML = html || '<div class="empty">no state changes from this document</div>';
}

document.getElementById('arm').addEventListener('change', function (e) {
  if (playTimer) {
    clearInterval(playTimer); playTimer = null;
    document.getElementById('play').textContent = '\\u25b6';
  }
  bindArm(Number(e.target.value), currentDocId(frame));
  render();
});
document.getElementById('scrubber').addEventListener('input', function (e) {
  frame = Number(e.target.value); render();
});
document.getElementById('step-back').addEventListener('click', function () {
  frame = Math.max(0, frame - 1); render();
});
document.getElementById('step-fwd').addEventListener('click', function () {
  frame = Math.min(frameCount, frame + 1); render();
});
document.getElementById('filter').addEventListener('input', function () { render(); });
document.getElementById('play').addEventListener('click', function () {
  var btn = document.getElementById('play');
  if (playTimer) { clearInterval(playTimer); playTimer = null; btn.textContent = '▶'; return; }
  if (frame >= frameCount) frame = 0;
  btn.textContent = '⏸';
  playTimer = setInterval(function () {
    frame += 1;
    if (frame >= frameCount) { clearInterval(playTimer); playTimer = null; btn.textContent = '▶'; frame = frameCount; }
    render();
  }, Number(document.getElementById('speed').value));
});

bindArm(0);
render();
</script>
</body>
</html>
`;
}
