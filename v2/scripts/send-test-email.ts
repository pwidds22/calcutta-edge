import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

const TEST_TO = 'support@calcuttaedge.com';

// ── Shared styles ──────────────────────────────────────────────
const styles = {
  wrapper: 'background-color: #0a0a0a; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
  container: 'max-width: 560px; margin: 0 auto; background-color: #111111; border-radius: 12px; border: 1px solid #222; overflow: hidden;',
  header: 'background: linear-gradient(135deg, #064e3b 0%, #0a0a0a 100%); padding: 32px 32px 24px;',
  logoRow: 'display: flex; align-items: center; gap: 10px; margin-bottom: 16px;',
  logoText: 'color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;',
  badge: 'display: inline-block; background-color: #10b981; color: #000; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.5px;',
  body: 'padding: 32px;',
  p: 'color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 16px;',
  featureBlock: 'background-color: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 3px solid #10b981;',
  featureTitle: 'color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 4px;',
  featureDesc: 'color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;',
  cta: 'display: inline-block; background-color: #10b981; color: #000000; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin: 8px 8px 8px 0;',
  ctaSecondary: 'display: inline-block; background-color: transparent; color: #10b981; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 8px; text-decoration: none; border: 1px solid #10b981; margin: 8px 8px 8px 0;',
  divider: 'border: none; border-top: 1px solid #222; margin: 24px 0;',
  footer: 'padding: 24px 32px; text-align: center;',
  footerText: 'color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0;',
};

// ── Email A HTML (Calcutta customers) ──────────────────────────
const emailAHtml = `
<div style="${styles.wrapper}">
  <div style="${styles.container}">
    <div style="${styles.header}">
      <div style="${styles.logoRow}">
        <img src="https://calcuttaedge.com/brand/calcutta_edge_180x180.png" alt="CE" width="36" height="36" style="border-radius: 8px;" />
        <span style="${styles.logoText}">Calcutta Edge</span>
      </div>
      <span style="${styles.badge}">MARCH MADNESS 2026</span>
    </div>

    <div style="${styles.body}">
      <p style="${styles.p}">Hey,</p>

      <p style="${styles.p}">You used Calcutta Genius last March for your pool's strategy. It's been completely rebuilt from the ground up.</p>

      <p style="${styles.p}">The tool is now at <a href="https://calcuttaedge.com" style="color: #10b981; text-decoration: none; font-weight: 600;">calcuttaedge.com</a> and here's what changed:</p>

      <div style="${styles.featureBlock}">
        <p style="${styles.featureTitle}">🎯 Free Live Auction Hosting <span style="color: #10b981; font-size: 11px; font-weight: 700;">(NEW)</span></p>
        <p style="${styles.featureDesc}">Create a room, share a 6-digit code, everyone joins on their phones. Real-time bidding with countdown timers. No spreadsheets, no whiteboard.</p>
      </div>

      <div style="${styles.featureBlock}">
        <p style="${styles.featureTitle}">📊 Tournament Management <span style="color: #10b981; font-size: 11px; font-weight: 700;">(NEW)</span></p>
        <p style="${styles.featureDesc}">Enter game results as they happen. Automatic payout calculations. Track who owes who. Commissioner life just got easier.</p>
      </div>

      <div style="${styles.featureBlock}">
        <p style="${styles.featureTitle}">📈 5x Better Strategy Data</p>
        <p style="${styles.featureDesc}">Last year: 1 odds source. This year: FanDuel, DraftKings, Pinnacle, Evan Miya, and TeamRankings. Blend them with custom weights. Properly devigged.</p>
      </div>

      <hr style="${styles.divider}" />

      <p style="${styles.p}">Strategy is <strong style="color: #fff;">$29.99</strong> (same ballpark as last year). Hosting and tournament management are <strong style="color: #10b981;">completely free</strong>.</p>

      <p style="${styles.p}"><strong style="color: #fff;">Games start today.</strong> If you're running a Calcutta this year:</p>

      <div style="margin: 24px 0;">
        <a href="https://calcuttaedge.com/register" style="${styles.cta}">Host Free Auction →</a>
        <a href="https://calcuttaedge.com/auction" style="${styles.ctaSecondary}">View Strategy Tool</a>
      </div>

      <p style="${styles.p}">Let me know if you have questions. I built this for my own pool and I'm always making it better.</p>

      <p style="${styles.p}">— Patrick<br /><span style="color: #6b7280;">Calcutta Edge</span></p>
    </div>

    <div style="${styles.footer}">
      <p style="${styles.footerText}">
        <a href="https://calcuttaedge.com" style="color: #10b981; text-decoration: none;">calcuttaedge.com</a><br />
        You're receiving this because you purchased from Calcutta Genius in March 2025.
      </p>
    </div>
  </div>
</div>
`;

async function sendTest() {
  console.log(`Sending test Email A to ${TEST_TO}...`);

  const { data, error } = await resend.emails.send({
    from: 'Calcutta Edge <support@calcuttaedge.com>',
    to: TEST_TO,
    subject: '[TEST] Your Calcutta tool got a massive upgrade',
    html: emailAHtml,
  });

  if (error) {
    console.error('✗ Failed:', error.message);
  } else {
    console.log(`✓ Sent! ID: ${data?.id}`);
    console.log('\nCheck support@calcuttaedge.com inbox. If it looks good, run send-launch-emails.ts to send to all recipients.');
  }
}

sendTest();
