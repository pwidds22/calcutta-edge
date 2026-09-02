/**
 * Copy shared between the sync API routes and the dashboard that renders their
 * responses.
 *
 * Its own module, with NO imports, on purpose: `lib/auth/sync-gate.ts` (which
 * produces this message) reaches `next/headers` through `authorizeSessionSync`,
 * so a client component importing the constant from there pulls server-only
 * code into the browser bundle and fails the build. Keeping the string here
 * lets both sides import the same literal instead of duplicating it.
 */

/** Shown to the pressing member when the cooldown swallows their request. */
export const SYNC_SKIPPED_MESSAGE = 'Just synced — already up to date';
