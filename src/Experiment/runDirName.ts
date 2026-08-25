import { existsSync, readdirSync } from 'fs';
import path from 'path';

/**
 * Run directories are named by the runId alone — `<condition>-<hash>` — because this repo holds
 * exactly one purposeful version of each experiment, so a chronological prefix is noise (author
 * decision 2026-08-23; the source harness used `<YYYY-MM-DD-HHmm>-<runId>`). The condition names
 * the purpose; the hash suffix is the identity guard — the same condition re-run with changed
 * knobs/code/prompts gets a fresh directory instead of silently resuming a stale one.
 */
const START_PREFIX = /^\d{4}-\d{2}-\d{2}-(?:\d{4}-)?/;

/** Strips legacy timestamp/date prefixes (imported or pre-rename dirs). Undated names pass through. */
export function stripRunDate(dirName: string): string {
  return dirName.replace(START_PREFIX, '');
}

/**
 * Resolve the directory for a run, reusing an existing one when this runId has already started.
 *
 * Resume safety is the whole point: the pipeline's `SKIP (exists)` recovery finds work by path, so
 * computing a fresh directory for an existing run would silently re-extract and re-judge every
 * document. An existing directory for this runId therefore always wins, whatever legacy date
 * prefix it carries.
 */
export function resolveRunDir(experimentsDir: string, runId: string, _now: Date): string {
  if (existsSync(experimentsDir)) {
    const existing = readdirSync(experimentsDir).find((name) => stripRunDate(name) === runId);
    if (existing) return path.join(experimentsDir, existing);
  }
  return path.join(experimentsDir, runId);
}
