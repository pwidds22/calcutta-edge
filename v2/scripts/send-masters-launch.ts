/**
 * Masters 2026 Launch Email — Cross-sell to existing March Madness users
 *
 * Run with: npx tsx scripts/send-masters-launch.ts
 * Requires RESEND_API_KEY env var
 */
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

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
  price: 'color: #ffffff; font-size: 36px; font-weight: 700; font-family: "SF Mono", "Fira Code", monospace;',
};

function buildMastersEmail(name?: string): string {
  const greeting = name ? `Hey ${name},` : 'Hey there,';
  return `
    <div style="${styles.wrapper}">
      <div style="${styles.container}">
        <div style="${styles.header}">
          <p style="${styles.subhead}">🏌️ NEW TOURNAMENT</p>
          <h1 style="${styles.heading}">Masters 2026 Calcutta is Live</h1>
          <p style="color: #a3a3a3; font-size: 14px; margin: 8px 0 0;">
            Host your Masters auction free. Win it with data.
          </p>
        </div>

        <div style="${styles.body}">
          <p style="${styles.text}">
            ${greeting}
          </p>
          <p style="${styles.text}">
            March Madness is wrapping up — time to keep the Calcutta energy going with
            <span style="${styles.highlight}">The Masters</span> (April 9-12).
          </p>
          <p style="${styles.text}">
            We just launched full Masters Calcutta support:
          </p>
          <p style="${styles.text}">
            <strong style="color: #fff;">🎯 Free Auction Hosting</strong><br/>
            89-player field, auto-grouping for lower-ranked golfers,
            live bidding with timer — same platform you already know.
          </p>
          <p style="${styles.text}">
            <strong style="color: #fff;">📊 Strategy Tool</strong> <span style="${styles.badge}">$14.99</span><br/>
            Fair values for every golfer across 5 finish positions (Cut, T20, T10, T5, Win).
            Devigged odds from 13+ sportsbooks. Know exactly what each golfer is worth.
          </p>

          <hr style="${styles.divider}" />

          <p style="${styles.text}">
            <strong style="color: #fff;">How Golf Calcuttas Work</strong><br/>
            Instead of bracket rounds, payouts are based on <em>finishing position</em>.
            Top 30-40 golfers are auctioned individually. The rest are bundled into
            balanced groups of 3-4 so the auction stays under 2 hours.
          </p>

          <p style="${styles.text}">
            Create your Masters auction now and share the join code with your group:
          </p>

          <a href="https://www.calcuttaedge.com/host/create?tournament=masters_2026" style="${styles.cta}">
            Host a Masters Calcutta →
          </a>
          <br/>
          <a href="https://www.calcuttaedge.com/auction?tournament=masters_2026" style="${styles.ctaSecondary}">
            Preview Strategy Tool
          </a>

          <hr style="${styles.divider}" />

          <p style="color: #666; font-size: 13px; line-height: 1.6;">
            You're getting this because you've used Calcutta Edge for March Madness.
            Thanks for being an early user — your feedback has been invaluable.
          </p>
        </div>

        <div style="${styles.footer}">
          <p style="${styles.footerText}">
            Calcutta Edge · calcuttaedge.com<br/>
            Reply to this email anytime — we read everything.
          </p>
        </div>
      </div>
    </div>
  `;
}

// ── Recipients ────────────────────────────────────────────────

// TODO: Query from Supabase profiles table instead of hardcoding
// For now, we'll send to all known users
const DRY_RUN = true; // Set to false to actually send

async function main() {
  console.log(`\n🏌️ Masters 2026 Launch Email ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}\n`);

  // In production, fetch all users from Supabase:
  // const { data: profiles } = await supabase.from('profiles').select('email').not('email', 'is', null)
  // const recipients = profiles?.map(p => p.email) ?? []

  // For now, placeholder — fill in or query from DB
  const recipients: string[] = [
    // Add email addresses here or query from Supabase
  ];

  if (recipients.length === 0) {
    console.log('⚠️  No recipients configured. Add emails to the recipients array or query from Supabase.');
    console.log('\nEmail preview:');
    console.log('Subject: 🏌️ Masters Calcutta is live — host your auction free');
    console.log('From: Calcutta Edge <support@calcuttaedge.com>');
    console.log(`\nHTML preview saved. ${DRY_RUN ? 'Set DRY_RUN=false to send.' : ''}`);
    return;
  }

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
        subject: '🏌️ Masters Calcutta is live — host your auction free',
        html: buildMastersEmail(),
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
