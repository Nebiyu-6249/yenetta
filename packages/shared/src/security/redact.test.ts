import { describe, expect, it } from 'vitest';
import { redactPii, redactPiiDeep, REDACTED_EMAIL, REDACTED_PHONE } from './redact';

describe('redactPii', () => {
  it('redacts email addresses', () => {
    expect(redactPii('reach me at student@example.com please')).toBe(
      `reach me at ${REDACTED_EMAIL} please`,
    );
  });

  it('redacts an Ethiopian E.164 phone number', () => {
    expect(redactPii('call +251912345678 now')).toBe(`call ${REDACTED_PHONE} now`);
  });

  it('redacts a local phone with separators', () => {
    expect(redactPii('my number is 091-234-5678')).toBe(`my number is ${REDACTED_PHONE}`);
  });

  it('redacts a bare 10-digit run', () => {
    expect(redactPii('0912345678')).toBe(REDACTED_PHONE);
  });

  it('does not redact curriculum numbers', () => {
    const text = 'In 2015 the pH was 7 and the mock ran for 1800 seconds in grade 12.';
    expect(redactPii(text)).toBe(text);
  });

  it('does not touch equations or short numbers', () => {
    const text = 'f(x) = mx + c where pH = -log[H+], degree 3.';
    expect(redactPii(text)).toBe(text);
  });

  it('redacts both an email and a phone in one string', () => {
    const out = redactPii('a@b.com or +251900000001');
    expect(out).toContain(REDACTED_EMAIL);
    expect(out).toContain(REDACTED_PHONE);
  });

  it('returns empty input unchanged', () => {
    expect(redactPii('')).toBe('');
  });
});

describe('redactPiiDeep', () => {
  it('scrubs strings nested in objects and arrays', () => {
    const input = {
      note: 'contact test@x.org',
      tags: ['ok', 'ring +251911223344'],
      nested: { phone: '0912345678', count: 3 },
    };
    expect(redactPiiDeep(input)).toEqual({
      note: `contact ${REDACTED_EMAIL}`,
      tags: ['ok', `ring ${REDACTED_PHONE}`],
      nested: { phone: REDACTED_PHONE, count: 3 },
    });
  });

  it('leaves non-string primitives intact', () => {
    expect(redactPiiDeep({ a: 1, b: true, c: null })).toEqual({ a: 1, b: true, c: null });
  });
});
