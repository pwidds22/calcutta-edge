import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

const styles = {
  wrapper: 'background-color: #0a0a0a; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
  container: 'max-width: 560px; margin: 0 auto; background-color: #111111; border-radius: 12px; border: 1px solid #222; overflow: hidden;',
  header: 'background: linear-gradient(135deg, #064e3b 0%, #0a0a0a 100%); padding: 32px 32px 24px;',
  logoRow: 'display: flex; align-items: center; gap: 10px; margin-bottom: 8px;',
  logoText: 'color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;',
  body: 'padding: 32px;',
  p: 'color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 16px;',
  footer: 'padding: 24px 32px; text-align: center;',
  footerText: 'color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0;',
};

const thankYouHtml = `
<div style="${styles.wrapper}">
  <div style="${styles.container}">
    <div style="${styles.header}">
      <div style="${styles.logoRow}">
        <img src="https://calcuttaedge.com/brand/calcutta_edge_180x180.png" alt="CE" width="36" height="36" style="border-radius: 8px;" />
        <span style="${styles.logoText}">Calcutta Edge</span>
      </div>
    </div>
    <div style="${styles.body}">
      <p style="${styles.p}">Hey,</p>
      <p style="${styles.p}">I'm Patrick, the developer behind Calcutta Edge. I saw that your group ran a Calcutta auction on the platform — just wanted to say thanks for giving it a shot. You're one of the first groups to use it and that means a lot.</p>
      <p style="${styles.p}">I'd love to hear how it went:</p>
      <p style="${styles.p}">
        <strong style="color: #fff;">→</strong> Did everything work smoothly during the auction?<br />
        <strong style="color: #fff;">→</strong> Was anything confusing or frustrating?<br />
        <strong style="color: #fff;">→</strong> Any features you wished you had?
      </p>
      <p style="${styles.p}">I'm actively shipping updates — game results and payout tracking are coming soon so your group can follow along as the tournament plays out.</p>
      <p style="${styles.p}">If you have any questions or ran into issues during your auction, just reply to this email. I read every one.</p>
      <p style="${styles.p}">Good luck with your teams this week.</p>
      <p style="${styles.p}">— Patrick<br /><span style="color: #6b7280;">Founder, Calcutta Edge</span></p>
    </div>
    <div style="${styles.footer}">
      <p style="${styles.footerText}">
        <a href="https://calcuttaedge.com" style="color: #10b981; text-decoration: none;">calcuttaedge.com</a>
      </p>
    </div>
  </div>
</div>`;

async function sendTest() {
  const { data, error } = await resend.emails.send({
    from: 'Patrick from Calcutta Edge <support@calcuttaedge.com>',
    replyTo: 'support@calcuttaedge.com',
    to: 'pwiddoss22@gmail.com',
    subject: '[TEST v2] Thanks for using Calcutta Edge — how did it go?',
    html: thankYouHtml,
  });
  if (error) console.error('✗', error.message);
  else console.log('✓ Sent:', data?.id);
}

sendTest();
