import { describe, it, expect } from 'vitest';
import {
  parseSubaddress,
  stripSubaddressTag,
  getSubaddressTag,
  hasSubaddressTag,
  buildSubaddress,
  sameBaseAddress,
} from './subaddress.js';

describe('subaddress', () => {
  it('parses base and tag', () => {
    expect(parseSubaddress('john+amazon@signic.email')).toEqual({
      localPart: 'john+amazon',
      baseLocal: 'john',
      tag: 'amazon',
      domain: 'signic.email',
    });
    expect(parseSubaddress('john@signic.email')?.tag).toBeNull();
  });

  it('keeps only the first + as separator', () => {
    const parsed = parseSubaddress('a+b+c@signic.email');
    expect(parsed?.baseLocal).toBe('a');
    expect(parsed?.tag).toBe('b+c');
  });

  it('returns null for invalid addresses', () => {
    expect(parseSubaddress('nope')).toBeNull();
    expect(parseSubaddress('+tag@signic.email')).toBeNull();
    expect(parseSubaddress('a@b@c')).toBeNull();
  });

  it('strips the tag and lowercases the domain', () => {
    expect(stripSubaddressTag('john+amazon@Signic.Email')).toBe(
      'john@signic.email'
    );
  });

  it('gets the tag / detects presence', () => {
    expect(getSubaddressTag('john+ebay@signic.email')).toBe('ebay');
    expect(hasSubaddressTag('john@signic.email')).toBe(false);
  });

  it('builds and replaces tags', () => {
    expect(buildSubaddress('john@signic.email', 'amazon')).toBe(
      'john+amazon@signic.email'
    );
    expect(buildSubaddress('john+old@signic.email', 'new')).toBe(
      'john+new@signic.email'
    );
    expect(buildSubaddress('john+old@signic.email', '')).toBe(
      'john@signic.email'
    );
  });

  it('matches base addresses ignoring tag and case', () => {
    expect(
      sameBaseAddress('john+amazon@signic.email', 'JOHN@Signic.Email')
    ).toBe(true);
    expect(sameBaseAddress('john@signic.email', 'jane@signic.email')).toBe(
      false
    );
  });
});
