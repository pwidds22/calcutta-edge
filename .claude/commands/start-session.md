---
name: start-session
description: Load project context and understand where we left off
---

# Start Session

## Pre-computed Context
Current git status:
!git status --short

Recent commits:
!git log --oneline -5

Current branch:
!git branch --show-current

## Instructions
1. Read `CLAUDE.md` for project conventions, architecture, and anti-patterns
2. Read memory files in `~/.claude/projects/*/memory/MEMORY.md` for session continuity
3. Check `TODO.md` and `ROADMAP.md` for pending work
4. Summarize: current state, what was last worked on, suggested next task

## Check for Feedback
If the user mentions feedback or bugs:
- Update `CLAUDE.md` anti-patterns if a recurring mistake was caught
- Fix any issues identified before starting new work

## Project Quick Reference
- **Dev server**: `cd v2 && npm run dev` (port 3000)
- **Tests**: `cd v2 && npm test` (Vitest, 41 tests)
- **Build**: `cd v2 && npm run build`
- **Production**: Vercel at calcuttaedge.com (auto-deploys on push to main)
- **Stack**: Next.js 16 + Supabase + Stripe + Vercel
- **Supabase MCP**: Available for DB operations (execute_sql, etc.)
