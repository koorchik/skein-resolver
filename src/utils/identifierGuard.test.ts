import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guardAllowsLink, guardAllowsMerge, normalizeFqdn, rigidIds } from './identifierGuard';

const expect = (actual: unknown) => ({
  toBe: (expected: unknown) => assert.strictEqual(actual, expected),
  toEqual: (expected: unknown) => assert.deepStrictEqual(actual, expected),
  toBeNull: () => assert.strictEqual(actual, null),
  not: {
    toBe: (expected: unknown) => assert.notStrictEqual(actual, expected),
  },
});

describe('normalizeFqdn', () => {
  it('lowercases, strips scheme/path/port/trailing dot/wildcard, refangs', () => {
    expect(normalizeFqdn('WWW.Ukr.NET.')).toBe('www.ukr.net');
    expect(normalizeFqdn('hxxps://evil[.]com/path?x=1')).toBe('evil.com');
    expect(normalizeFqdn('*.gov.ua')).toBe('gov.ua');
    expect(normalizeFqdn('mail.ukr.net:443')).toBe('mail.ukr.net');
  });
  it('keeps subdomains distinct and rejects non-domains', () => {
    expect(normalizeFqdn('mail.ukr.net')).not.toBe(normalizeFqdn('ukr.net'));
    expect(normalizeFqdn('not a domain')).toBeNull();
    expect(normalizeFqdn('1.2.3.4')).toBeNull();
  });
});

describe('rigidIds', () => {
  it('finds CVEs by substring scan, case-insensitively', () => {
    expect(rigidIds('cve-2018-7600 (Drupalgeddon2)', 'Software')).toEqual(
      new Set(['cve:CVE-2018-7600'])
    );
  });
  it('whole-surface only for IPs — version strings are not IPs', () => {
    expect(rigidIds('192.168.1.1', 'Infrastructure')).toEqual(new Set(['ip:192.168.1.1']));
    expect(rigidIds('ESXi 6.7.0.123', 'Software').size).toBe(0);
    expect(rigidIds('300.1.2.3', 'Infrastructure').size).toBe(0);
  });
  it('domains only in the Domain category (Node.js must not parse as a domain)', () => {
    expect(rigidIds('mail.ukr.net', 'Domain')).toEqual(new Set(['fqdn:mail.ukr.net']));
    expect(rigidIds('Node.js', 'Software').size).toBe(0);
  });
  it('hashes and emails as whole surfaces', () => {
    expect(rigidIds('d41d8cd98f00b204e9800998ecf8427e', 'Infrastructure')).toEqual(
      new Set(['hash:d41d8cd98f00b204e9800998ecf8427e'])
    );
    expect(rigidIds('evil@ukr.net', 'Infrastructure')).toEqual(new Set(['email:evil@ukr.net']));
  });
});

describe('guardAllowsLink', () => {
  it('vetoes distinct CVE ids (the CVE-pair merge class)', () => {
    expect(guardAllowsLink('CVE-2020-7048', 'Software', ['CVE-2020-7047'])).toBe(false);
  });
  it('allows a CVE into its nickname-only cluster (gold pairs Log4Shell with its CVE)', () => {
    expect(guardAllowsLink('CVE-2021-44228', 'Software', ['Log4Shell'])).toBe(true);
    expect(guardAllowsLink('Log4Shell', 'Software', ['CVE-2021-44228'])).toBe(true);
  });
  it('allows exact identifier restatements', () => {
    expect(guardAllowsLink('CVE-2021-44228', 'Software', ['Log4Shell', 'cve-2021-44228'])).toBe(
      true
    );
    expect(guardAllowsLink('evil[.]com', 'Domain', ['evil.com'])).toBe(true);
  });
  it('vetoes the subdomain/free-mail chain (the ukr.net class)', () => {
    expect(guardAllowsLink('mail.ukr.net', 'Domain', ['ukr.net'])).toBe(false);
    expect(guardAllowsLink('0-ukr.net', 'Domain', ['ukr.net', 'mail.ukr.net'])).toBe(false);
  });
  it('never vetoes open-form mentions', () => {
    expect(guardAllowsLink('Sandworm', 'HackerGroup', ['UAC-0082', 'APT44'])).toBe(true);
  });
});

describe('guardAllowsMerge', () => {
  it('vetoes concept merges across distinct FQDNs (the review-pass chain door)', () => {
    expect(guardAllowsMerge('Domain', ['myftp.org'], ['servebeer.com', 'serveftp.com'])).toBe(
      false
    );
    expect(guardAllowsMerge('Domain', ['mail.ukr.net'], ['ukr.net'])).toBe(false);
  });
  it('allows merges when the sides share an identifier value', () => {
    expect(
      guardAllowsMerge('Domain', ['evil[.]com', 'related-name'], ['evil.com', 'other alias'])
    ).toBe(true);
  });
  it('allows a nickname-only cluster to absorb a CVE side (and vice versa)', () => {
    expect(guardAllowsMerge('Software', ['CVE-2021-44228'], ['Log4Shell'])).toBe(true);
    expect(guardAllowsMerge('Software', ['Log4Shell'], ['CVE-2021-44228'])).toBe(true);
  });
  it('vetoes CVE-pair concept merges', () => {
    expect(
      guardAllowsMerge('Software', ['CVE-2020-7047'], ['CVE-2020-7048', 'WP File Manager bug'])
    ).toBe(false);
  });
  it('never vetoes fully open-form merges', () => {
    expect(guardAllowsMerge('HackerGroup', ['Sandworm'], ['APT44', 'UAC-0082'])).toBe(true);
  });
});
