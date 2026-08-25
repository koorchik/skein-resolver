#!/usr/bin/env ts-node
/**
 * Resampling inference over scored runs, per docs/statistical-protocol.md (pre-registered):
 * BCa bootstrap CIs (10k resamples, 95%) and paired permutation tests (10k, two-sided, Holm).
 *
 *   npm run stats -- --gold gold/gold.json [--split test|dev --allow-dev] [--category X]
 *                    --run <runDir> [--run <runDir> ...] [--resamples N] [--seed N] [--json out]
 *
 * The FIRST --run is the reference; every later run is compared against it (paired).
 *
 * Units, chosen for exact decomposability (no plug-in approximations):
 *  - identity: gold-universe ELEMENTS; per-element B³ precision/recall decompose exactly, so the
 *    bootstrap statistic recomputes B³ F1 on each resample and the permutation test sign-flips
 *    per-element F1 differences. Pairwise F1 is reported as a point estimate beside it (its
 *    pair units are not element-decomposable; replicate SD covers its uncertainty).
 *  - hierarchy: GOLD EDGES for reachable recall (matched/reachable recomputed per resample);
 *    the run's own predicted edges for precision. The permutation test runs on edges reachable
 *    in BOTH runs (0/1 matched differences).
 */
import {
  goldPartition,
  labeledPairs,
  loadGoldTable,
  selectCategory,
  excludeCategory,
  selectSplit,
  assertReportableSplit,
  type Split,
} from '../src/Evaluation/gold';
import { clusterMetrics } from '../src/Evaluation/clusterMetrics';
import {
  mapCanonicalsToGold,
  readRegistryHierarchy,
  type GoldClusterForHierarchy,
} from '../src/Evaluation/hierarchyMetrics';
import { fromDecisionEvents, fromRegistry, type Partition } from '../src/Evaluation/partition';
import { parseDecisionEvents } from '../src/Experiment/replayLog';
import {
  bootstrapCI,
  holmBonferroni,
  pairedPermutationTest,
  DEFAULT_RESAMPLES,
} from '../src/Evaluation/bootstrap';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

interface Args {
  gold?: string;
  split: Split;
  allowDev?: boolean;
  category?: string;
  excludeCategory?: string;
  runs: string[];
  resamples: number;
  seed: number;
  json?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { split: 'test', runs: [], resamples: DEFAULT_RESAMPLES, seed: 1 };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--gold': args.gold = argv[++i]; break;
      case '--split': args.split = argv[++i] as Split; break;
      case '--allow-dev': args.allowDev = true; break;
      case '--category': args.category = argv[++i]; break;
      case '--exclude-category': args.excludeCategory = argv[++i]; break;
      case '--run': args.runs.push(argv[++i]); break;
      case '--resamples': args.resamples = Number(argv[++i]); break;
      case '--seed': args.seed = Number(argv[++i]); break;
      case '--json': args.json = argv[++i]; break;
      default: throw new Error(`unknown flag ${argv[i]}`);
    }
  }
  if (!args.gold || args.runs.length === 0) {
    throw new Error('usage: stats --gold <gold.json> --run <dir> [--run <dir> ...]');
  }
  return args;
}

async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(p, 'utf8')) as T;
}

async function partitionFor(runDir: string, keyOptions: { includeCategory: boolean }): Promise<Partition> {
  const registryPath = path.join(runDir, 'registry.json');
  if (existsSync(registryPath)) return fromRegistry(await readJson(registryPath), keyOptions);
  const logPath = path.join(runDir, 'decisions.jsonl');
  if (existsSync(logPath)) {
    return fromDecisionEvents(parseDecisionEvents(await fs.readFile(logPath, 'utf8')), keyOptions);
  }
  throw new Error(`${runDir}: no registry.json or decisions.jsonl`);
}

/** Per-element B³ precision/recall over the shared universe — decomposes B³ exactly. */
function b3PerElement(predicted: Partition, gold: Partition): Map<string, { p: number; r: number }> {
  const goldElements = new Set(gold.elements());
  const shared = predicted.elements().filter((e) => goldElements.has(e));
  const sharedSet = new Set(shared);

  const clusterOf = (partition: Partition) => {
    const m = new Map<string, Set<string>>();
    for (const cluster of partition.clusters) {
      const members = cluster.members.filter((e: string) => sharedSet.has(e));
      const set = new Set(members);
      for (const e of members) m.set(e, set);
    }
    return m;
  };
  const predOf = clusterOf(predicted);
  const goldOf = clusterOf(gold);

  const out = new Map<string, { p: number; r: number }>();
  for (const e of shared) {
    const pc = predOf.get(e)!;
    const gc = goldOf.get(e)!;
    let inter = 0;
    const [small, large] = pc.size <= gc.size ? [pc, gc] : [gc, pc];
    for (const x of small) if (large.has(x)) inter++;
    out.set(e, { p: inter / pc.size, r: inter / gc.size });
  }
  return out;
}

const f1 = (p: number, r: number) => (p + r ? (2 * p * r) / (p + r) : 0);

/** Per-gold-edge status for one run: is the edge reachable, and is it matched (directly)? */
function edgeStatus(
  registry: unknown,
  goldClusters: GoldClusterForHierarchy[],
  goldEdges: Array<{ from: string; to: string }>
): Array<{ reachable: boolean; matched: boolean }> {
  const { canonicals, edges } = readRegistryHierarchy(registry as never);
  const canonicalToCluster = mapCanonicalsToGold(canonicals, goldClusters);
  const present = new Set(canonicalToCluster.values());
  const predictedPairs = new Set<string>();
  for (const edge of edges) {
    const from = canonicalToCluster.get(`${edge.category.trim().toLowerCase()}|${edge.from}`);
    const to = canonicalToCluster.get(`${edge.category.trim().toLowerCase()}|${edge.to}`);
    if (from && to && from !== to) predictedPairs.add(`${from}→${to}`);
  }
  return goldEdges.map((edge) => ({
    reachable: present.has(edge.from) && present.has(edge.to),
    matched: predictedPairs.has(`${edge.from}→${edge.to}`),
  }));
}

/** Predicted-edge correctness list for precision CIs. */
function predictedCorrectness(
  registry: unknown,
  goldClusters: GoldClusterForHierarchy[],
  goldPairSet: Set<string>
): boolean[] {
  const { canonicals, edges } = readRegistryHierarchy(registry as never);
  const canonicalToCluster = mapCanonicalsToGold(canonicals, goldClusters);
  const out: boolean[] = [];
  for (const edge of edges) {
    const from = canonicalToCluster.get(`${edge.category.trim().toLowerCase()}|${edge.from}`);
    const to = canonicalToCluster.get(`${edge.category.trim().toLowerCase()}|${edge.to}`);
    if (!from || !to || from === to) continue; // unmappable/collapsed tracked by evaluate, not here
    out.push(goldPairSet.has(`${from}→${to}`));
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertReportableSplit(args.split, { allowDev: args.allowDev });

  const fullTable = await loadGoldTable(args.gold!);
  const table = selectSplit(fullTable, args.split);
  let scored = args.category ? selectCategory(table, args.category) : table;
  if (args.excludeCategory) scored = excludeCategory(scored, args.excludeCategory);
  // Hierarchy is always scored across both splits (gold edges carry no split), matching evaluate's
  // --hierarchy-all-splits, which every current number uses.
  let hierarchyTable = args.category ? selectCategory(fullTable, args.category) : fullTable;
  if (args.excludeCategory) hierarchyTable = excludeCategory(hierarchyTable, args.excludeCategory);
  const keyOptions = { includeCategory: true };
  const gold = goldPartition(scored, keyOptions);
  void labeledPairs; // pairwise units documented in the header; point estimate comes from evaluate

  const goldClusters = hierarchyTable.clusters as GoldClusterForHierarchy[];
  const clusterById = new Map(goldClusters.map((c) => [c.id, c]));
  const surfaceToCluster = new Map<string, string>();
  for (const c of goldClusters) {
    for (const m of c.members) surfaceToCluster.set(`${c.category}|${m}`, c.id);
  }
  // Deduped on the cluster pair, matching evaluate's denominator (several surface-level gold
  // edges can map onto one cluster pair; resampling should not double-weight them).
  const seenPairs = new Set<string>();
  const goldEdgePairs: Array<{ from: string; to: string }> = [];
  for (const edge of hierarchyTable.edges ?? []) {
    const from = (edge as { fromClusterId?: string }).fromClusterId ?? surfaceToCluster.get(`${edge.category}|${edge.from}`);
    const to = (edge as { toClusterId?: string }).toClusterId ?? surfaceToCluster.get(`${edge.category}|${edge.to}`);
    if (from && to && clusterById.has(from) && clusterById.has(to) && !seenPairs.has(`${from}→${to}`)) {
      seenPairs.add(`${from}→${to}`);
      goldEdgePairs.push({ from, to });
    }
  }
  const goldPairSet = new Set(goldEdgePairs.map((e) => `${e.from}→${e.to}`));

  const opts = { resamples: args.resamples, seed: args.seed };
  const report: Record<string, unknown> = { split: args.split, category: args.category ?? null, resamples: args.resamples, seed: args.seed };
  const perRun: Array<{
    name: string;
    b3: Map<string, { p: number; r: number }>;
    edges: Array<{ reachable: boolean; matched: boolean }>;
    pairwiseF1: number;
    b3F1: number;
  }> = [];

  const runsOut: Record<string, unknown> = {};
  for (const runDir of args.runs) {
    const name = path.basename(runDir);
    const partition = await partitionFor(runDir, keyOptions);
    const suite = clusterMetrics(partition, gold);
    const b3 = b3PerElement(partition, gold);
    const elements = [...b3.keys()];
    const b3CI = bootstrapCI(elements, (units) => {
      let sp = 0, sr = 0;
      for (const e of units) { const v = b3.get(e)!; sp += v.p; sr += v.r; }
      if (units.length === 0) return null;
      return f1(sp / units.length, sr / units.length);
    }, opts);

    const registry = existsSync(path.join(runDir, 'registry.json'))
      ? await readJson(path.join(runDir, 'registry.json'))
      : null;
    const edges = registry ? edgeStatus(registry, goldClusters, goldEdgePairs) : [];
    const rReachCI = registry
      ? bootstrapCI(edges, (units) => {
          let reach = 0, match = 0;
          for (const u of units) { if (u.reachable) { reach++; if (u.matched) match++; } }
          return reach ? match / reach : null;
        }, opts)
      : null;
    const correctness = registry ? predictedCorrectness(registry, goldClusters, goldPairSet) : [];
    const precisionCI = registry && correctness.length
      ? bootstrapCI(correctness, (units) => {
          if (units.length === 0) return null;
          return units.filter(Boolean).length / units.length;
        }, opts)
      : null;

    perRun.push({ name, b3, edges, pairwiseF1: suite.pairwise.f1, b3F1: suite.bCubed.f1 });
    runsOut[name] = {
      universe: suite.universeSize,
      pairwiseF1: suite.pairwise.f1,
      ari: suite.ari,
      b3F1: suite.bCubed.f1,
      b3F1CI: b3CI,
      rReachCI,
      precisionCI,
      predictedEdges: correctness.length,
    };
    console.log(`${name}: B³F1 ${suite.bCubed.f1.toFixed(3)} [${b3CI.lower.toFixed(3)}, ${b3CI.upper.toFixed(3)}], pairwise ${suite.pairwise.f1.toFixed(3)}` +
      (rReachCI ? `, R-reach ${rReachCI.estimate.toFixed(3)} [${rReachCI.lower.toFixed(3)}, ${rReachCI.upper.toFixed(3)}]` : '') +
      (precisionCI ? `, P ${precisionCI.estimate.toFixed(3)} [${precisionCI.lower.toFixed(3)}, ${precisionCI.upper.toFixed(3)}]` : ''));
  }
  report.runs = runsOut;

  // Paired comparisons: run[0] vs each other, with Holm over the whole reported family.
  const ref = perRun[0];
  const comparisons: Array<{ key: string; p: number; detail: Record<string, unknown> }> = [];
  for (const other of perRun.slice(1)) {
    const sharedElements = [...ref.b3.keys()].filter((e) => other.b3.has(e));
    const deltaB3CI = bootstrapCI(sharedElements, (units) => {
      let pa = 0, ra = 0, pb = 0, rb = 0;
      for (const e of units) {
        const a = ref.b3.get(e)!; const b = other.b3.get(e)!;
        pa += a.p; ra += a.r; pb += b.p; rb += b.r;
      }
      const n = units.length;
      if (!n) return null;
      return f1(pa / n, ra / n) - f1(pb / n, rb / n);
    }, opts);
    const b3Diffs = sharedElements.map((e) => {
      const a = ref.b3.get(e)!; const b = other.b3.get(e)!;
      return f1(a.p, a.r) - f1(b.p, b.r);
    });
    const b3Perm = pairedPermutationTest(b3Diffs, { seed: args.seed });

    let edgeDetail: Record<string, unknown> = {};
    if (ref.edges.length && other.edges.length) {
      const both = goldEdgePairs.map((_, i) => i).filter((i) => ref.edges[i].reachable && other.edges[i].reachable);
      const edgeDiffs = both.map((i) => Number(ref.edges[i].matched) - Number(other.edges[i].matched));
      const deltaReachCI = bootstrapCI(goldEdgePairs.map((_, i) => i), (units) => {
        let ra = 0, ma = 0, rb = 0, mb = 0;
        for (const i of units) {
          if (ref.edges[i].reachable) { ra++; if (ref.edges[i].matched) ma++; }
          if (other.edges[i].reachable) { rb++; if (other.edges[i].matched) mb++; }
        }
        if (!ra || !rb) return null;
        return ma / ra - mb / rb;
      }, opts);
      const edgePerm = pairedPermutationTest(edgeDiffs, { seed: args.seed });
      edgeDetail = { deltaRReachCI: deltaReachCI, edgePermutation: edgePerm, edgesReachableInBoth: both.length };
      comparisons.push({ key: `${ref.name} vs ${other.name} :: R-reach`, p: edgePerm.pValue, detail: edgeDetail });
    }
    comparisons.push({
      key: `${ref.name} vs ${other.name} :: B3F1`,
      p: b3Perm.pValue,
      detail: { deltaB3CI, b3Permutation: b3Perm },
    });

    console.log(`\nΔ(${ref.name} − ${other.name}):`);
    console.log(`  B³F1 delta ${deltaB3CI.estimate.toFixed(3)} [${deltaB3CI.lower.toFixed(3)}, ${deltaB3CI.upper.toFixed(3)}], permutation p=${b3Perm.pValue.toFixed(4)}`);
    if ('deltaRReachCI' in edgeDetail) {
      const d = edgeDetail.deltaRReachCI as { estimate: number; lower: number; upper: number };
      const p = (edgeDetail.edgePermutation as { pValue: number }).pValue;
      console.log(`  R-reach delta ${d.estimate.toFixed(3)} [${d.lower.toFixed(3)}, ${d.upper.toFixed(3)}], permutation p=${p.toFixed(4)} (edges reachable in both: ${(edgeDetail as { edgesReachableInBoth: number }).edgesReachableInBoth})`);
    }
  }

  if (comparisons.length > 1) {
    const adjusted = holmBonferroni(comparisons.map((c) => ({ key: c.key, pValue: c.p })));
    console.log('\nHolm-adjusted family:');
    for (const a of adjusted) {
      console.log(`  ${a.key}: p=${a.pValue.toFixed(4)} → adj ${a.adjusted.toFixed(4)}${a.significant ? ' *' : ''}`);
    }
    report.holm = adjusted;
  }
  report.comparisons = comparisons.map((c) => ({ key: c.key, ...c.detail }));

  if (args.json) {
    await fs.mkdir(path.dirname(args.json), { recursive: true });
    await fs.writeFile(args.json, JSON.stringify(report, (_k, v) => (v instanceof Map ? undefined : v), 2));
    console.log(`\nwrote ${args.json}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
