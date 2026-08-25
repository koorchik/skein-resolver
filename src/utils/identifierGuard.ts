/**
 * Identifier guard (E-guard, review-response experiment): a deterministic veto on identity-pass
 * link verdicts between DISTINCT rigid identifiers.
 *
 * Motivation (§5.2 error audit): the dominant identity error class at corpus scale is transitive
 * chain merging inside identifier-like categories — one `ukr.net` concept absorbed 42 gold Domain
 * clusters via subdomain/free-mail chaining, and near-identical CVE ids (CVE-2020-7047 ↔ -7048)
 * were merged as aliases. LLM judges are unreliable exactly where equality is *syntactic*, so
 * identifier equality is adjudicated deterministically and the judge keeps jurisdiction over
 * open-form naming (the hybrid jurisdiction principle, paper §3.4).
 *
 * Rule: a link is VETOED iff the mention carries a rigid identifier of some type and the target
 * concept already carries an identifier of the SAME type with a DIFFERENT value. Everything else
 * passes through untouched. In particular a bare CVE id may still be linked into a nickname-only
 * cluster (gold pairs `CVE-2021-44228` with `Log4Shell`), and exact restatements
 * (`www.ukr.net` → `ukr.net`? NO — see below) are decided by normalization equality.
 *
 * Domain normalization deliberately does NOT strip subdomains: gold treats distinct FQDNs as
 * distinct clusters, so `www.ukr.net` and `ukr.net` are different identifiers here. It does
 * normalize case, scheme, path/port, trailing dot, wildcard prefix, and common CTI defanging
 * (`hxxp`, `[.]`).
 */

const CVE_RE = /\bCVE-\d{4}-\d{3,7}\b/gi;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HASH_RE = /^(?:[0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FQDN_RE = /^[\p{L}\p{N}_-]+(\.[\p{L}\p{N}_-]+)+$/u;

/** Refang + strip URL decoration down to a bare lowercase FQDN, or null if it does not parse. */
export function normalizeFqdn(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\[(\.)\]/g, '$1').replace(/\((\.)\)/g, '$1'); // defanged dots: a[.]b, a(.)b
  s = s.replace(/^hxxps?:\/\//, '').replace(/^https?:\/\//, '').replace(/^ftp:\/\//, '');
  s = s.replace(/^\*\./, ''); // wildcard certificates / patterns
  s = s.split(/[/?#]/, 1)[0]; // path, query, fragment
  s = s.split('@').pop() ?? s; // userinfo (rare in extracted surfaces)
  s = s.split(':', 1)[0]; // port
  s = s.replace(/\.$/, ''); // trailing dot
  if (!FQDN_RE.test(s)) return null;
  // An all-numeric dotted string is an IP (or a version), not a domain name.
  if (/^[\d.]+$/.test(s)) return null;
  return s;
}

/**
 * The rigid identifiers a surface carries, as `type:value` tags.
 *
 * CVE ids are found by substring scan (surfaces like `CVE-2018-7600 (Drupalgeddon2)` occur);
 * every other type must be the WHOLE surface — substring IPs/hashes inside version strings or
 * sentences would cause false vetoes.
 */
export function rigidIds(surface: string, category: string): Set<string> {
  const ids = new Set<string>();
  const s = surface.trim();
  for (const m of s.matchAll(CVE_RE)) ids.add(`cve:${m[0].toUpperCase()}`);
  const whole = s.toLowerCase();
  const ip = whole.match(IPV4_RE);
  if (ip && ip.slice(1).every((octet) => Number(octet) <= 255)) {
    ids.add(`ip:${whole}`);
  } else if (HASH_RE.test(whole)) {
    ids.add(`hash:${whole}`);
  } else if (EMAIL_RE.test(whole)) {
    ids.add(`email:${whole}`);
  } else if (category === 'Domain') {
    const fqdn = normalizeFqdn(s);
    if (fqdn) ids.add(`fqdn:${fqdn}`);
  }
  return ids;
}

/**
 * Conflict test for one proposed link. `memberSurfaces` = the target concept's preferred label
 * plus every stored alias surface.
 */
export function guardAllowsLink(
  mentionSurface: string,
  category: string,
  memberSurfaces: string[]
): boolean {
  const mentionIds = rigidIds(mentionSurface, category);
  if (mentionIds.size === 0) return true;
  const targetIds = new Set<string>();
  for (const member of memberSurfaces) {
    for (const id of rigidIds(member, category)) targetIds.add(id);
  }
  if (targetIds.size === 0) return true;
  const targetTypes = new Set([...targetIds].map((id) => id.slice(0, id.indexOf(':'))));
  for (const id of mentionIds) {
    const type = id.slice(0, id.indexOf(':'));
    if (targetTypes.has(type) && !targetIds.has(id)) return false;
  }
  return true;
}

const byType = (ids: Set<string>): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  for (const id of ids) {
    const type = id.slice(0, id.indexOf(':'));
    if (!map.has(type)) map.set(type, new Set());
    map.get(type)!.add(id);
  }
  return map;
};

/**
 * Conflict test for a review-pass CONCEPT merge (the second door: a source-free `link` verdict in
 * Ψ_rev merges two whole concepts — measured to be where the chains actually form; the guard-v1
 * arm that vetoed only identity-pass links fired twice in 204 documents while 137 cross-surface
 * Domain attachments arrived as review merges).
 *
 * Veto iff some identifier TYPE is present on BOTH sides with no common value. Sides that share a
 * value (one concept already accumulated the other's identifier as an alias) may merge; sides
 * where only one carries identifiers may merge (nickname cluster absorbing its CVE).
 */
export function guardAllowsMerge(
  category: string,
  fromSurfaces: string[],
  intoSurfaces: string[]
): boolean {
  const collect = (surfaces: string[]) => {
    const ids = new Set<string>();
    for (const s of surfaces) for (const id of rigidIds(s, category)) ids.add(id);
    return ids;
  };
  const from = byType(collect(fromSurfaces));
  const into = byType(collect(intoSurfaces));
  for (const [type, fromIds] of from) {
    const intoIds = into.get(type);
    if (!intoIds) continue;
    if ([...fromIds].every((id) => !intoIds.has(id))) return false;
  }
  return true;
}
