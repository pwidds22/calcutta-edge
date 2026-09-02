/** Origin used only as a parsing base — never emitted, never navigated to. */
const PARSE_BASE = 'http://localhost';

/**
 * Validate a post-auth `next` destination.
 *
 * Anything that reaches a `redirect()` from a query string is an open-redirect
 * candidate, so this allows exactly one shape: a path on THIS origin.
 *
 * Resolving against a base and comparing origins is deliberate — hand-rolled
 * prefix checks keep losing to inputs the URL parser already understands:
 *
 *   'https://evil.com'  -> origin evil.com          rejected
 *   '//evil.com'        -> protocol-relative        rejected
 *   '/\evil.com'        -> parser normalises the backslash to '/', so this is
 *                          '//evil.com' in disguise; a startsWith('//') guard
 *                          waves it straight through                rejected
 *   '/host/create?t=1'  -> origin PARSE_BASE                        allowed
 *
 * Returns the path (with query and hash preserved) when safe, otherwise null.
 * Callers supply their own default rather than being handed one, so a rejected
 * value is never silently indistinguishable from an absent one.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  // Require an explicit leading slash BEFORE parsing. Every `next` we generate
  // is an absolute path, and without this a bare 'evil.com' would resolve
  // against the base into the same-origin path '/evil.com' — safe, but a 404
  // the user never asked for, where falling back to the caller's default is
  // strictly better. Backslash tricks are unaffected: '/\evil.com' clears this
  // check and is then caught by the origin comparison below.
  if (!value.startsWith('/')) return null;
  let url: URL;
  try {
    url = new URL(value, PARSE_BASE);
  } catch {
    return null;
  }
  if (url.origin !== PARSE_BASE) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
