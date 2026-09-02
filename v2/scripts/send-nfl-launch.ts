/**
 * NFL Season 2026-27 Launch Email
 *
 * Announces the season-long NFL Calcutta to every existing user. The pitch is
 * the format itself — one payout per regular-season win means the pool pays out
 * every Sunday for five months, which is a genuinely different product from the
 * four-day tournament Calcuttas everyone on this list has seen from us.
 *
 * Usage:
 *   1. Preview the rendered HTML (writes .preview-nfl-launch.html, gitignored):
 *        npx tsx scripts/send-nfl-launch.ts
 *      DRY_RUN defaults to true — you must opt IN to sending.
 *   2. Optional single-inbox test:
 *        TEST_TO=you@example.com npx tsx scripts/send-nfl-launch.ts
 *   3. Once the body has been eyeballed and approved:
 *        DRY_RUN=false npx tsx scripts/send-nfl-launch.ts
 *
 * Run from the MAIN checkout — `.env.local` is gitignored and does not exist in
 * git worktrees.
 *
 * Requires:
 *   RESEND_API_KEY               — Resend account API key
 *   NEXT_PUBLIC_SUPABASE_URL     — for the admin client to pull recipients
 *   SUPABASE_SERVICE_ROLE_KEY    — admin access (server-side only, never expose)
 */
import { Resend } from 'resend';
import { writeFileSync } from 'node:fs';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllPages } from '@/lib/supabase/fetch-all';
import { NFL_SEASON_2026_CONFIG } from '@/lib/tournaments/configs/nfl-season-2026';
import { strategyPriceDollars } from '@/lib/pricing';

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
// camdunn5: unsubscribed after the PGA launch email on 2026-05-12.
// spivack711: opted out earlier (see MEMORY).
const EXCLUDED = new Set([
  'spivack711@gmail.com',
  'camdunn5@gmail.com',
]);

// Optional one-shot test mode: when TEST_TO is set, ignore the recipient list
// and send only to that address.
const TEST_TO = process.env.TEST_TO?.trim() || null;

// Price from the config, never a literal — the NFL pool is $19.99 against a
// $14.99 default, and hardcoded prices in emails have drifted before (the
// welcome email sat three weeks behind at $29.99).
const PRICE = strategyPriceDollars(NFL_SEASON_2026_CONFIG);

const SUBJECT = 'Your NFL Calcutta — one payout for every regular-season win';
const FROM = 'Patrick from Calcutta Edge <support@calcuttaedge.com>';

// ── Styles (matches send-pga-launch.ts) ──────────────────────────
const s = {
  wrapper: 'background-color: #0a0a0a; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
  container: 'max-width: 560px; margin: 0 auto; background-color: #111111; border-radius: 12px; border: 1px solid #222; overflow: hidden;',
  header: 'background: linear-gradient(135deg, #064e3b 0%, #0a0a0a 100%); padding: 32px 32px 24px;',
  logoRow: 'display: flex; align-items: center; gap: 10px; margin-bottom: 16px;',
  logoText: 'color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;',
  badge: 'display: inline-block; background-color: #10b981; color: #000; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.5px;',
  body: 'padding: 32px;',
  h1: 'color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 12px;',
  h2: 'color: #ffffff; font-size: 16px; font-weight: 700; margin: 0 0 12px;',
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
  stepNum: 'color: #10b981; font-weight: 700;',
};

const html = `
<div style="${s.wrapper}">
  <div style="${s.container}">
    <div style="${s.header}">
      <div style="${s.logoRow}">
        <img src="https://calcuttaedge.com/brand/calcutta_edge_180x180.png" alt="CE" width="36" height="36" style="border-radius: 8px;" />
        <span style="${s.logoText}">Calcutta Edge</span>
      </div>
      <span style="${s.badge}">NFL SEASON 2026-27</span>
    </div>

    <div style="${s.body}">
      <h1 style="${s.h1}">A Calcutta that pays out every Sunday</h1>

      <p style="${s.p}">Hey,</p>

      <p style="${s.p}">
        Kickoff is <span style="${s.highlight}">Thursday, September 10</span>, and we've built
        something different for it: a season-long NFL Calcutta where all 32 teams go up for
        auction and owners get paid <span style="${s.highlight}">for every regular-season win</span>,
        not just for a deep January run.
      </p>

      <p style="${s.p}">
        That one change fixes the thing that kills most auction pools. In a bracket Calcutta,
        half the room is out by the second weekend. Here, the team that goes 6-11 still cashes
        six times — so the whole board is worth bidding on, and everyone still has money on the
        table in December.
      </p>

      <hr style="${s.divider}" />

      <h2 style="${s.h2}">How the payouts work</h2>

      <div style="${s.featureBlock}">
        <p style="${s.featureTitle}">Every win pays</p>
        <p style="${s.featureDesc}">
          A flat rate per regular-season win, 272 of them across the league. This is the
          biggest single slice of the pot in our default structure.
        </p>
      </div>
      <div style="${s.featureBlock}">
        <p style="${s.featureTitle}">Division titles and playoff berths</p>
        <p style="${s.featureDesc}">
          Eight division winners and fourteen playoff teams each collect, so a wild-card
          run is worth owning even without a title.
        </p>
      </div>
      <div style="${s.featureBlock}">
        <p style="${s.featureTitle}">The playoff ladder — or not</p>
        <p style="${s.featureDesc}">
          Four presets ship with it. The default leaves about 40% of the pot for the
          playoff run and settles the rest on regular-season results. Prefer to settle
          up before the postseason entirely? Pick
          <strong style="color:#d1d5db;">Season Only</strong> and the whole pot is
          distributed by week 18. Every preset is editable, and the form tells you when
          your structure adds up to 100%.
        </p>
      </div>
      <div style="${s.featureBlock}">
        <p style="${s.featureTitle}">Scores sync themselves</p>
        <p style="${s.featureDesc}">
          Win totals update automatically from live NFL standings — no spreadsheet, no
          weekly bookkeeping. Best and worst record in the league are built-in side bets.
        </p>
      </div>

      <hr style="${s.divider}" />

      <h2 style="${s.h2}">Getting your league going</h2>

      <p style="${s.p}">
        <span style="${s.stepNum}">1.</span> Create the auction and set your payout structure.<br />
        <span style="${s.stepNum}">2.</span> Share the 6-character join code — everyone bids from their phone.<br />
        <span style="${s.stepNum}">3.</span> Run the draft live, with timers and commissioner controls.<br />
        <span style="${s.stepNum}">4.</span> Watch standings and settlement update on their own all season.
      </p>

      <p style="${s.p}">
        <span style="${s.highlight}">Hosting is free.</span> It always will be — no cap on
        participants, no per-league fee, nothing to cancel.
      </p>

      <div style="text-align: center; margin: 24px 0 8px;">
        <a href="https://calcuttaedge.com/host/create?tournament=nfl_season_2026" style="${s.cta}">Host Your NFL Calcutta</a>
        <a href="https://calcuttaedge.com/strategy?tournament=nfl_season_2026" style="${s.ctaSecondary}">See the Team Values</a>
      </div>

      <p style="${s.p}">
        Joining someone else's league? You just need their join code — head to
        <a href="https://calcuttaedge.com/join" style="color:#10b981;">calcuttaedge.com/join</a>.
      </p>

      <hr style="${s.divider}" />

      <h2 style="${s.h2}">Optional: the strategy tool</h2>

      <p style="${s.p}">
        Separate from hosting, and only if you want it. It prices all 32 teams off live
        prediction-market odds, strips the vig, and shows you a fair value and a bid ceiling
        for your league's specific payout structure — plus a live overlay during the draft so
        you can see whether the current bid is a bargain while it's still on the clock.
      </p>

      <p style="${s.p}">
        <span style="${s.highlight}">$${PRICE} once</span> for the whole season. It's more than
        our usual per-event price because this one covers five months rather than four days.
      </p>

      <hr style="${s.divider}" />

      <p style="${s.p}">
        Drafts usually happen the week before kickoff, so if you're running one this year it's
        worth getting the invite out in the next few days.
      </p>

      <p style="${s.p}">
        Reply to this email if anything's unclear or you want a structure we don't
        offer — I read every one.
      </p>

      <p style="${s.p}">— Patrick</p>
    </div>

    <div style="${s.footer}">
      <p style="${s.footerText}">
        Calcutta Edge · Free Calcutta auction hosting<br />
        <a href="https://calcuttaedge.com" style="color:#6b7280;">calcuttaedge.com</a>
        &nbsp;·&nbsp;
        <a href="mailto:support@calcuttaedge.com?subject=Unsubscribe" style="color:#6b7280;">Unsubscribe</a>
      </p>
    </div>
  </div>
</div>
`;

// ── Fetch recipients from Supabase ──────────────────────────────
async function fetchRecipients(): Promise<string[]> {
  const supabase = getSupabase();

  // Paginated, not a bare select: PostgREST silently truncates every un-ranged
  // query at max-rows (1,000) with no error. The list is ~154 today, so this is
  // a no-op now — but "quietly emails only the first 1,000 users" is a failure
  // nobody would ever notice, and the helper costs one extra round trip.
  const rows = await fetchAllPages<{ email: string | null }>((from, to) =>
    supabase
      .from('profiles')
      .select('email')
      .not('email', 'is', null)
      .order('id')
      .range(from, to)
  );

  const emails = rows
    .map((p) => p.email)
    .filter((e): e is string => typeof e === 'string' && e.includes('@'))
    .filter((e) => !EXCLUDED.has(e.toLowerCase()));

  return [...new Set(emails.map((e) => e.trim()))]; // dedupe
}

async function main() {
  const mode = TEST_TO ? `TEST SEND (one address: ${TEST_TO})` : DRY_RUN ? 'DRY RUN' : 'LIVE SEND';
  console.log(`\n🏈  NFL Season 2026-27 Launch Email — ${mode}\n`);
  console.log(`Subject: ${SUBJECT}`);
  console.log(`From: ${FROM}`);
  console.log(`Strategy price: $${PRICE}\n`);

  if (DRY_RUN && !TEST_TO) {
    const previewPath = '.preview-nfl-launch.html';
    writeFileSync(previewPath, html, 'utf-8');
    console.log(`✓ HTML preview written to ${previewPath}`);
    console.log(`  Open in browser:  file:///${process.cwd().replace(/\\/g, '/')}/${previewPath}\n`);
  }

  let recipients: string[];
  if (TEST_TO) {
    recipients = [TEST_TO];
    console.log('TEST_TO override active — recipient list bypassed.\n');
  } else {
    try {
      recipients = await fetchRecipients();
    } catch (err) {
      console.error(`✗ Could not fetch recipients: ${err}`);
      console.log('  (Continuing in preview-only mode — set SUPABASE_SERVICE_ROLE_KEY to enable.)');
      return;
    }
    console.log(`Recipients: ${recipients.length} (excluding ${EXCLUDED.size} opt-outs)\n`);
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
