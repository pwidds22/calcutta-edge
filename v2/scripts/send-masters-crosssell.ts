/**
 * Masters 2026 Cross-Sell Email — Targets all existing users
 *
 * Run with: npx tsx scripts/send-masters-crosssell.ts
 * Requires RESEND_API_KEY and SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * Set DRY_RUN=false to actually send. DO NOT send without user approval.
 */
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Shared styles ──────────────────────────────────────────────
const styles = {
  wrapper: 'background-color: #0a0a0a; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
  container: 'max-width: 560px; margin: 0 auto; background-color: #111111; border-radius: 12px; border: 1px solid #222; overflow: hidden;',
  header: 'background: linear-gradient(135deg, #064e3b 0%, #0a0a0a 100%); padding: 32px 32px 24px;',
  body: 'padding: 28px 32px;',
  text: 'color: #a3a3a3; font-size: 15px; line-height: 1.7; margin: 0 0 16px;',
  heading: 'color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 8px;',
  subhead: 'color: #10b981; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; margin: 0 0 12px;',
  cta: 'display: inline-block; background-color: #10b981; color: #000000; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; margin: 8px 0 16px;',
  ctaSecondary: 'display: inline-block; border: 1px solid #333; color: #a3a3a3; font-weight: 500; font-size: 14px; padding: 10px 24px; border-radius: 8px; text-decoration: none; margin: 8px 8px 16px 0;',
  badge: 'display: inline-block; background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.2);',
  divider: 'border: none; border-top: 1px solid #222; margin: 24px 0;',
  footer: 'padding: 20px 32px; text-align: center;',
  footerText: 'color: #555; font-size: 12px; line-height: 1.6;',
  highlight: 'color: #10b981; font-weight: 600;',
  featureRow: 'margin: 0 0 14px; padding: 12px 16px; background-color: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); border-radius: 8px;',
};

function buildCrossSellEmail(name?: string): string {
  const greeting = name ? `Hey ${name},` : 'Hey there,';
  return `
    <div style="${styles.wrapper}">
      <div style="${styles.container}">
        <div style="${styles.header}">
          <p style="${styles.subhead}">THE MASTERS STARTS THURSDAY</p>
          <h1 style="${styles.heading}">Your Calcutta should too.</h1>
          <p style="color: #a3a3a3; font-size: 14px; margin: 8px 0 0;">
            Same platform. New tournament. Bigger edge.
          </p>
        </div>

        <div style="${styles.body}">
          <p style="${styles.text}">
            ${greeting}
          </p>
          <p style="${styles.text}">
            The Masters tees off <strong style="color: #fff;">Thursday, April 9</strong>.
            If your March Madness Calcutta was a hit, imagine the same format for the
            biggest week in golf &mdash; 89 players, four days at Augusta, and the kind of
            leaderboard drama that keeps everyone glued through Sunday.
          </p>

          <div style="${styles.featureRow}">
            <p style="color: #fff; font-size: 14px; font-weight: 600; margin: 0 0 6px;">
              Free Auction Hosting
            </p>
            <p style="color: #a3a3a3; font-size: 13px; line-height: 1.5; margin: 0;">
              89-player field with auto-balanced bundles. Live bidding, timer,
              commissioner controls &mdash; same platform you already know. Set up in 5 minutes.
            </p>
          </div>

          <div style="${styles.featureRow}">
            <p style="color: #fff; font-size: 14px; font-weight: 600; margin: 0 0 6px;">
              Strategy Analytics &mdash; <span style="${styles.badge}">$19.99</span>
            </p>
            <p style="color: #a3a3a3; font-size: 13px; line-height: 1.5; margin: 0;">
              Fair values for every golfer across 5 finish tiers (Cut, T20, T10, T5, Win).
              Devigged odds from 13+ sportsbooks via DataGolf. Know exactly what each golfer is
              worth before the bidding starts.
            </p>
          </div>

          <hr style="${styles.divider}" />

          <p style="${styles.text}">
            <strong style="color: #fff;">Why golf Calcuttas hit different:</strong>
            No single-round elimination. Every golfer plays at least 36 holes.
            Spread payouts mean 10-20 finishing positions can earn money.
            Your whole portfolio stays alive through the weekend &mdash; every birdie matters.
          </p>

          <p style="${styles.text}">
            Create your Masters auction now and share the join code with your group:
          </p>

          <a href="https://www.calcuttaedge.com/host/create?tournament=masters_2026" style="${styles.cta}">
            Host a Masters Calcutta Free &rarr;
          </a>
          <br/>
          <a href="https://www.calcuttaedge.com/auction?tournament=masters_2026" style="${styles.ctaSecondary}">
            Preview Strategy Tool
          </a>
          <a href="https://www.calcuttaedge.com/blog/masters-calcutta-strategy-2026" style="${styles.ctaSecondary}">
            Read: Masters Strategy Guide
          </a>

          <hr style="${styles.divider}" />

          <p style="color: #666; font-size: 13px; line-height: 1.6;">
            You're getting this because you've used Calcutta Edge.
            Reply to this email anytime &mdash; we read everything.
          </p>
        </div>

        <div style="${styles.footer}">
          <p style="${styles.footerText}">
            Calcutta Edge &middot; calcuttaedge.com<br/>
            <a href="https://calcuttaedge.com" style="color: #10b981; text-decoration: none;">calcuttaedge.com</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

// ── Config ────────────────────────────────────────────────────
const DRY_RUN = true; // Set to false to actually send
const SUBJECT = 'The Masters starts Thursday. Your Calcutta should too.';

async function main() {
  console.log(`\n🏌️ Masters 2026 Cross-Sell Email ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}\n`);

  // Fetch all users from Supabase
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('email')
    .not('email', 'is', null);

  if (error) {
    console.error('❌ Failed to fetch profiles:', error.message);
    return;
  }

  const EXCLUDE = new Set(['spivack711@gmail.com']);
  const recipients = (profiles?.map((p) => p.email).filter(Boolean) ?? [])
    .filter((e) => !EXCLUDE.has(e));

  if (recipients.length === 0) {
    console.log('⚠️  No recipients found in profiles table.');
    console.log('\nEmail preview:');
    console.log(`Subject: ${SUBJECT}`);
    console.log('From: Calcutta Edge <support@calcuttaedge.com>');
    return;
  }

  console.log(`Found ${recipients.length} recipients\n`);

  let sent = 0;
  let failed = 0;

  for (const email of recipients) {
    try {
      if (DRY_RUN) {
        console.log(`[DRY RUN] Would send to: ${email}`);
        sent++;
        continue;
      }

      await resend.emails.send({
        from: 'Calcutta Edge <support@calcuttaedge.com>',
        to: email,
        subject: SUBJECT,
        html: buildCrossSellEmail(),
      });
      sent++;
      console.log(`✅ Sent to ${email}`);

      // Rate limit: 2 per second
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      failed++;
      console.error(`❌ Failed for ${email}:`, err);
    }
  }

  console.log(`\n📊 Results: ${sent} sent, ${failed} failed out of ${recipients.length} total`);
}

main().catch(console.error);
