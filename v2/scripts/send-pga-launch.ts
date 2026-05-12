/**
 * PGA Championship 2026 Launch Email
 *
 * Announces PGA Championship Calcutta support to all existing users. Highlights
 * what's NEW since Masters (live results sync, lower price, more polish) plus
 * the core features.
 *
 * Usage:
 *   1. Preview the rendered HTML:
 *        npx tsx scripts/send-pga-launch.ts
 *      (DRY_RUN defaults to true — writes the HTML to .preview-pga-launch.html)
 *   2. Once you've eyeballed it, set DRY_RUN=false and run again to send.
 *
 * Requires:
 *   RESEND_API_KEY               — Resend account API key
 *   NEXT_PUBLIC_SUPABASE_URL     — for the admin client to pull recipients
 *   SUPABASE_SERVICE_ROLE_KEY    — admin access (server-side only, never expose)
 */
import { Resend } from 'resend';
import { writeFileSync } from 'node:fs';
import { createAdminClient } from '@/lib/supabase/admin';

const DRY_RUN = process.env.DRY_RUN !== 'false'; // default safe — opt-in to send

// Lazily construct clients so the HTML preview path works without env vars set
// (e.g., when running from a worktree without .env.local present).
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY required to send. Re-run with the env var set.');
  return new Resend(key);
}

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required to fetch recipients.'
    );
  }
  return createAdminClient();
}

// Addresses to skip on every blast — known opt-outs (per MEMORY.md).
// (pwiddoss22@gmail.com removed at user request — they want to receive the launch email.)
const EXCLUDED = new Set(['spivack711@gmail.com']);

// Optional one-shot test mode: when TEST_TO is set, ignore the recipient list
// and send only to that address. Useful for previewing the rendered email in
// an actual inbox before going to the full list.
const TEST_TO = process.env.TEST_TO?.trim() || null;

const SUBJECT = 'PGA Championship starts Thursday — your Calcutta is ready';
const FROM = 'Patrick from Calcutta Edge <support@calcuttaedge.com>';

// ── Styles (matches send-dashboard-announcement.ts) ──────────────
const s = {
  wrapper: 'background-color: #0a0a0a; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
  container: 'max-width: 560px; margin: 0 auto; background-color: #111111; border-radius: 12px; border: 1px solid #222; overflow: hidden;',
  header: 'background: linear-gradient(135deg, #064e3b 0%, #0a0a0a 100%); padding: 32px 32px 24px;',
  logoRow: 'display: flex; align-items: center; gap: 10px; margin-bottom: 16px;',
  logoText: 'color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;',
  badge: 'display: inline-block; background-color: #10b981; color: #000; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.5px;',
  body: 'padding: 32px;',
  h1: 'color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 12px;',
  p: 'color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 16px;',
  featureBlock: 'background-color: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 3px solid #10b981;',
  featureTitle: 'color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 4px;',
  featureDesc: 'color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;',
  cta: 'display: inline-block; background-color: #10b981; color: #000000; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin: 8px 8px 8px 0;',
  ctaSecondary: 'display: inline-block; background-color: transparent; color: #10b981; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 8px; text-decoration: none; border: 1px solid #10b981; margin: 8px 8px 8px 0;',
  divider: 'border: none; border-top: 1px solid #222; margin: 24px 0;',
  footer: 'padding: 24px 32px; text-align: center;',
  footerText: 'color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0;',
  highlight: 'color: #10b981; font-weight: 600;',
  amber: 'color: #f59e0b; font-weight: 600;',
};

const html = `
<div style="${s.wrapper}">
  <div style="${s.container}">
    <div style="${s.header}">
      <div style="${s.logoRow}">
        <img src="https://calcuttaedge.com/brand/calcutta_edge_180x180.png" alt="CE" width="36" height="36" style="border-radius: 8px;" />
        <span style="${s.logoText}">Calcutta Edge</span>
      </div>
      <span style="${s.badge}">PGA CHAMPIONSHIP 2026</span>
    </div>

    <div style="${s.body}">
      <h1 style="${s.h1}">PGA Championship Calcuttas are live</h1>

      <p style="${s.p}">Hey,</p>

      <p style="${s.p}">
        The PGA Championship tees off Thursday at Aronimink Golf Club in Newtown Square, PA.
        You can host your Calcutta auction on Calcutta Edge <span style="${s.highlight}">free</span> —
        full 156-golfer field, live bidding, automatic settlement, the same platform you used
        for Masters and March Madness.
      </p>

      <p style="${s.p}">
        Quick reminder of what you get:
      </p>

      <div style="${s.featureBlock}">
        <p style="${s.featureTitle}">🤖 Live results sync — no manual entry</p>
        <p style="${s.featureDesc}">Round-by-round positions pull straight from DataGolf into your Calcutta. Make-the-cut, T20, T10, T5, and winner tiers grade automatically as the leaderboard moves. Daily low-round props auto-grade too once Thursday/Friday/Saturday/Sunday rounds finish.</p>
      </div>

      <div style="${s.featureBlock}">
        <p style="${s.featureTitle}">📊 Real sportsbook odds for all 156 golfers</p>
        <p style="${s.featureDesc}">Devigged odds from DraftKings (primary), FanDuel, Bovada, Caesars, BetMGM, Bet365 — across 5 markets (winner / T5 / T10 / T20 / make cut). Fair values + bid recommendations for every player in the field.</p>
      </div>

      <div style="${s.featureBlock}">
        <p style="${s.featureTitle}">💰 Strategy tool dropped to $14.99</p>
        <p style="${s.featureDesc}">Was $19.99 for Masters, $29.99 for March Madness. Single uniform price per event now — pay once when you're hosting (or pre-purchase any upcoming event from the strategy page).</p>
      </div>

      <hr style="${s.divider}" />

      <p style="${s.p}"><strong style="color: #fff;">Quick start:</strong> create your auction, share the 6-character join code with your group, run the auction tonight or Wednesday. Tournament starts Thursday — auto-sync handles the rest.</p>

      <div style="margin: 24px 0;">
        <a href="https://www.calcuttaedge.com/host/create?tournament=pga_championship_2026" style="${s.cta}">Host a PGA Calcutta →</a>
        <a href="https://www.calcuttaedge.com/strategy?tournament=pga_championship_2026" style="${s.ctaSecondary}">Preview Strategy</a>
      </div>

      <hr style="${s.divider}" />

      <p style="${s.p}; color: #9ca3af; font-size: 13px;">
        <strong style="${s.amber}">What's coming up:</strong> U.S. Open Golf at Shinnecock Hills (Jun 18–21), FIFA World Cup 2026 (Jun 11 – Jul 19), The Open Championship (Jul 16–19), Tour Championship at East Lake (Aug 27–30), then NFL season hosting opens in late August. All on the same platform, all free to host.
      </p>

      <p style="${s.p}">If something's broken or there's a tournament your group wants that we don't support yet, just reply — I read everything.</p>

      <p style="${s.p}">— Patrick<br /><span style="color: #6b7280;">Founder, Calcutta Edge</span></p>
    </div>

    <div style="${s.footer}">
      <p style="${s.footerText}">
        <a href="https://calcuttaedge.com" style="color: #10b981; text-decoration: none;">calcuttaedge.com</a><br />
        Reply to this email anytime — it goes straight to me.
      </p>
    </div>
  </div>
</div>
`;

// ── Fetch recipients from Supabase ──────────────────────────────
async function fetchRecipients(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .not('email', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch profiles: ${error.message}`);
  }
  if (!data) return [];

  const emails = data
    .map((p) => p.email as string | null)
    .filter((e): e is string => typeof e === 'string' && e.includes('@'))
    .filter((e) => !EXCLUDED.has(e.toLowerCase()));

  return [...new Set(emails)]; // dedupe
}

async function main() {
  const mode = TEST_TO ? `TEST SEND (one address: ${TEST_TO})` : DRY_RUN ? 'DRY RUN' : 'LIVE SEND';
  console.log(`\n🏌️  PGA Championship 2026 Launch Email — ${mode}\n`);
  console.log(`Subject: ${SUBJECT}`);
  console.log(`From: ${FROM}\n`);

  if (DRY_RUN && !TEST_TO) {
    // In dry-run mode, write the HTML to a file so you can open it in a browser
    // and eyeball the rendering before sending to live users.
    const previewPath = '.preview-pga-launch.html';
    writeFileSync(previewPath, html, 'utf-8');
    console.log(`✓ HTML preview written to ${previewPath}`);
    console.log(`  Open in browser:  file:///${process.cwd().replace(/\\/g, '/')}/${previewPath}\n`);
  }

  let recipients: string[];
  if (TEST_TO) {
    // One-shot test: ignore the recipient list, send only to TEST_TO.
    recipients = [TEST_TO];
    console.log(`TEST_TO override active — recipient list bypassed.\n`);
  } else {
    try {
      recipients = await fetchRecipients();
    } catch (err) {
      console.error(`✗ Could not fetch recipients: ${err}`);
      console.log('  (Continuing in preview-only mode — set RESEND_API_KEY + SUPABASE_SERVICE_ROLE_KEY to enable.)');
      return;
    }
    console.log(`Recipients: ${recipients.length} (excluded ${EXCLUDED.size} addresses)\n`);
  }

  if (DRY_RUN && !TEST_TO) {
    console.log('First 5 recipients (for sanity check):');
    for (const e of recipients.slice(0, 5)) console.log(`  - ${e}`);
    if (recipients.length > 5) console.log(`  ... and ${recipients.length - 5} more.\n`);
    console.log('Set DRY_RUN=false to send, or TEST_TO=email@example.com to one-shot test.');
    return;
  }

  const resend = getResend();
  let sent = 0;
  let failed = 0;
  for (const email of recipients) {
    await new Promise((r) => setTimeout(r, 600)); // ~1.6/s — under Resend's free-tier 2/s limit
    try {
      const { data, error } = await resend.emails.send({
        from: FROM,
        replyTo: 'support@calcuttaedge.com',
        to: email,
        subject: SUBJECT,
        html,
      });
      if (error) {
        console.error(`  ✗ ${email}: ${error.message}`);
        failed++;
      } else {
        console.log(`  ✓ ${email} (${data?.id})`);
        sent++;
      }
    } catch (err) {
      console.error(`  ✗ ${email}:`, err);
      failed++;
    }
  }

  console.log(`\n📊 Done: ${sent} sent, ${failed} failed of ${recipients.length} total\n`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
