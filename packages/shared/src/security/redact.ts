/**
 * PII redaction for text that crosses a trust boundary - anything sent to the
 * third-party LLM provider, or written to logs/audit metadata. Personal data
 * (a student's phone or email) is never needed to answer a curriculum question,
 * so scrubbing it before egress minimises what leaves our systems (minors' data
 * / data-minimisation, SECURITY.md sections 9 and 12). Isomorphic: shared by the
 * API and the ingestion worker.
 *
 * Deliberately conservative: only high-confidence PII shapes are matched, and
 * the digit-run threshold (9+) is high enough that curriculum numbers such as
 * years (2015), grades (12), pH (7) or exam durations (1800) are left intact.
 */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// A phone-like run: optional leading +, then digits with common separators.
// Validated in the replacer so only 9-15 digit sequences are redacted.
const PHONE_CANDIDATE = /\+?\d[\d\s\-().]{7,}\d/g;

export const REDACTED_EMAIL = '[redacted-email]';
export const REDACTED_PHONE = '[redacted-phone]';

/** Redacts emails and phone numbers from a single string. */
export function redactPii(text: string): string {
  if (!text) {
    return text;
  }
  return text.replace(EMAIL, REDACTED_EMAIL).replace(PHONE_CANDIDATE, (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 15 ? REDACTED_PHONE : match;
  });
}

/**
 * Recursively redacts PII from every string within a value (objects, arrays,
 * nested). Used to defensively scrub structured payloads such as audit metadata
 * before they are persisted, without the caller having to remember to.
 */
export function redactPiiDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return redactPii(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactPiiDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = redactPiiDeep(item);
    }
    return out as T;
  }
  return value;
}
