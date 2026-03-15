---
argument-hint: [bug description, error message, or paste from logs]
description: Autonomous bug fixing - just describe the bug and let Claude fix it
---

# Autonomous Bug Fix Mode

You've been given a bug to fix. Work autonomously to:

1. **Understand the bug** - Parse the error message, stack trace, or description
2. **Locate the source** - Use search/grep to find relevant code in `v2/`
3. **Identify root cause** - Read the code and understand what's wrong
4. **Implement the fix** - Make minimal, targeted changes
5. **Verify the fix** - Run `cd v2 && npm run build && npm test`

## Rules

- **Don't ask questions** - Figure it out from context
- **Don't over-engineer** - Fix the bug, nothing more
- **Don't refactor** - Only change what's necessary for the fix
- **Do explain** - After fixing, briefly explain what was wrong and why

## Context

This is a Next.js 16 + Supabase + Stripe app in `v2/`:
- Auth: Supabase Auth via `@supabase/ssr` (middleware route protection)
- Server actions: `v2/actions/` (auth.ts, auction.ts, session.ts, bidding.ts)
- Supabase clients: `v2/lib/supabase/` (client, server, middleware, admin, broadcast)
- Stripe: `v2/lib/stripe/config.ts` (lazy init) + webhook at `v2/app/api/webhooks/stripe/route.ts`
- Calculations: `v2/lib/calculations/` (odds, values, profits, pot, normalize)
- Live auction: `v2/components/live/` + `v2/lib/auction/live/`
- Check CLAUDE.md for anti-patterns

## Common Bug Categories

### Auth Issues
- Check `v2/middleware.ts` for route protection logic
- Check `v2/lib/supabase/server.ts` and `v2/actions/auth.ts`
- Verify cookie handling with `@supabase/ssr`

### Payment Issues
- Webhook at `v2/app/api/webhooks/stripe/route.ts`
- Verify `request.text()` for raw body (signature verification)
- Check email matching + fallback logic

### Live Auction Issues
- Broadcast topic format: `auction:{sessionId}` (NO `realtime:` prefix)
- Check RLS policies — self-referencing policies cause infinite recursion
- Presence deduplication — deduplicate by userId
- Timer: absolute timestamps in DB (`timer_ends_at`, `timer_duration_ms`)

### Build Issues
- Windows packages in `optionalDependencies` not `dependencies`
- Stripe SDK must be lazy-initialized

## Bug Description
$ARGUMENTS

## After Fixing

1. Run: `cd v2 && npm run build && npm test`
2. Summarize what was fixed and why
3. If this reveals a pattern, suggest adding to CLAUDE.md anti-patterns
