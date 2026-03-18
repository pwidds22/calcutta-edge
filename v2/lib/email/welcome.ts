import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const styles = {
  wrapper: 'background-color: #0a0a0a; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
  container: 'max-width: 560px; margin: 0 auto; background-color: #111111; border-radius: 12px; border: 1px solid #222; overflow: hidden;',
  header: 'background: linear-gradient(135deg, #064e3b 0%, #0a0a0a 100%); padding: 32px 32px 24px;',
  logoRow: 'display: flex; align-items: center; gap: 10px; margin-bottom: 8px;',
  logoText: 'color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;',
  body: 'padding: 32px;',
  p: 'color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 16px;',
  cta: 'display: inline-block; background-color: #10b981; color: #000000; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin: 8px 8px 8px 0;',
  divider: 'border: none; border-top: 1px solid #222; margin: 24px 0;',
  footer: 'padding: 24px 32px; text-align: center;',
  footerText: 'color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0;',
};

function buildWelcomeHtml(): string {
  return `
<div style="${styles.wrapper}">
  <div style="${styles.container}">
    <div style="${styles.header}">
      <div style="${styles.logoRow}">
        <img src="https://calcuttaedge.com/brand/calcutta_edge_180x180.png" alt="CE" width="36" height="36" style="border-radius: 8px;" />
        <span style="${styles.logoText}">Calcutta Edge</span>
      </div>
    </div>

    <div style="${styles.body}">
      <p style="${styles.p}">Welcome to Calcutta Edge!</p>

      <p style="${styles.p}">I'm Patrick, the developer behind the platform. Thanks for signing up — here's what you can do right now:</p>

      <p style="${styles.p}">
        <strong style="color: #10b981;">Host an Auction (Free)</strong><br />
        Create a live auction room, share a 6-character code, and run your Calcutta with real-time bidding, countdown timers, and commissioner controls. No payment required.
      </p>

      <p style="${styles.p}">
        <strong style="color: #f59e0b;">Strategy Analytics ($29.99/event)</strong><br />
        See which teams are overpriced and which are steals. Devigged odds from 5 sources (FanDuel, DraftKings, Pinnacle, Evan Miya, TeamRankings), fair values, suggested bids, and round-by-round profit projections.
      </p>

      <div style="margin: 24px 0;">
        <a href="https://calcuttaedge.com/host" style="${styles.cta}">Host Your Auction →</a>
        <a href="https://calcuttaedge.com/auction" style="${styles.cta.replace('#10b981', '#f59e0b')}">Preview Strategy →</a>
      </div>

      <hr style="${styles.divider}" />

      <p style="${styles.p}">Got questions? Just reply to this email — I read every one.</p>

      <p style="${styles.p}">— Patrick<br /><span style="color: #6b7280;">Founder, Calcutta Edge</span></p>
    </div>

    <div style="${styles.footer}">
      <p style="${styles.footerText}">
        <a href="https://calcuttaedge.com" style="color: #10b981; text-decoration: none;">calcuttaedge.com</a>
      </p>
    </div>
  </div>
</div>`;
}

/**
 * Send a welcome email to a new user. Fire-and-forget — errors are logged, not thrown.
 */
export async function sendWelcomeEmail(email: string): Promise<void> {
  const client = getResend();
  if (!client) {
    console.warn('[Email] RESEND_API_KEY not set, skipping welcome email');
    return;
  }

  try {
    const { error } = await client.emails.send({
      from: 'Patrick from Calcutta Edge <support@calcuttaedge.com>',
      replyTo: 'support@calcuttaedge.com',
      to: email,
      subject: 'Welcome to Calcutta Edge — here\'s what you can do',
      html: buildWelcomeHtml(),
    });

    if (error) {
      console.error(`[Email] Failed to send welcome to ${email}:`, error.message);
    }
  } catch (err) {
    console.error(`[Email] Welcome email error for ${email}:`, err);
  }
}
