---
name: verify
description: Run all checks before committing
---

# Verify Changes

## Pre-computed Context
Changed files:
!git diff --name-only HEAD

## Instructions
1. Run TypeScript build: `cd v2 && npm run build`
2. Run unit tests: `cd v2 && npm test`
3. Run lint: `cd v2 && npm run lint`
4. Check for console errors in dev server if UI changes were made
5. Report: all checks passed or list what failed

## Verification Checklist
- [ ] `npm run build` succeeds (catches type errors + import issues)
- [ ] `npm test` passes (41+ tests)
- [ ] No `.env` values hardcoded in source
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*` variables
- [ ] Windows-only packages are in `optionalDependencies`
- [ ] Stripe SDK is lazy-initialized (not module-level)
- [ ] Changed features work as expected
