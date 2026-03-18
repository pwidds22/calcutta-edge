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
  cta: 'display: inline-block; background-color: #10b981; color: #000000; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin: 8px 8px 8px 0;',
  divider: 'border: none; border-top: 1px solid #222; margin: 24px 0;',
  footer: 'padding: 24px 32px; text-align: center;',
  footerText: 'color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0;',
};

// ── Email A: Thank you to completed auction commissioners + participants ──
// These people successfully ran full auctions. They're our best users.
const completedAuctionUsers = [
  // Calcutta 2026 (lukebannon, 14 participants, 634 bids)
  'lukebannon1993@gmail.com',
  'bannon.jake@gmail.com',
  'dr.cavsirish@gmail.com',
  'tjbannon3@gmail.com',
  // Calcutta League 2026 (aboyer, 11 participants, 710 bids)
  'aboyer7135@gmail.com',
  'peterson.taylor.alan@gmail.com',
  'ricksimmon@att.net',
  'yesterdayistoday2@gmail.com',
  'ttuberville@yahoo.com',
  'tarheels1312@gmail.com',
  'tmorgans17975@gmail.com',
  'deputy289@gmail.com',
  'simmonfritz@gmail.com',
  'clint.horn@hartville.k12.mo.us',
  'b.anderson.sports@gmail.com',
  'seburns@yahoo.com',
  // NEW CTAN 2026 (kshah31, 10 participants, 717 bids)
  'kshah31@gmail.com',
  'vpanchal20@gmail.com',
  'suns116@yahoo.com',
  'majmundarn@gmail.com',
  'sumeetsdesai@gmail.com',
  'sapan86@gmail.com',
  'anb2009@gmail.com',
  'sapanmajmundar@gmail.com',
  'smshah610@gmail.com',
  'dlevinedo@gmail.com',
  'thomasmuscarella@gmail.com',
];

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
</div>
`;

// ── Email B: Maintenance note to early signups who didn't complete an auction ──
// Excluded: johnjoseph.dean1993, williamprooney, all test accounts, svalukis (competitor)
const earlySignups = [
  'kingjj26@gmail.com',
  '33middie@gmail.com',
];

const maintenanceHtml = `
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

      <p style="${styles.p}">I'm Patrick, the developer behind Calcutta Edge. Thanks for signing up — I noticed you created an account recently and wanted to reach out personally.</p>

      <p style="${styles.p}">The platform was going through some final updates over the past week, so you may have run into some rough edges. Everything is now fully live and stable.</p>

      <p style="${styles.p}">Quick recap of what's available:</p>

      <p style="${styles.p}">
        <strong style="color: #10b981;">Free:</strong> Live auction hosting — create a room, share a code, everyone bids from their phones with timers. Plus tournament management with automatic payout calculations.<br /><br />
        <strong style="color: #10b981;">$29.99:</strong> Strategy analytics — fair values from 5 odds sources (FanDuel, DraftKings, Pinnacle, Evan Miya, TeamRankings). Shows which teams are overpriced and which are steals.
      </p>

      <p style="${styles.p}">If you're still planning a Calcutta for March Madness, there's plenty of time — the tournament runs through early April.</p>

      <div style="margin: 24px 0;">
        <a href="https://calcuttaedge.com/host" style="${styles.cta}">Host Your Auction →</a>
      </div>

      <p style="${styles.p}">If you have any questions or ran into issues, just reply to this email. Happy to help.</p>

      <p style="${styles.p}">— Patrick<br /><span style="color: #6b7280;">Founder, Calcutta Edge</span></p>
    </div>

    <div style="${styles.footer}">
      <p style="${styles.footerText}">
        <a href="https://calcuttaedge.com" style="color: #10b981; text-decoration: none;">calcuttaedge.com</a>
      </p>
    </div>
  </div>
</div>
`;

async function sendAll() {
  // Note: dr.cavsirish is in both lists (participated in completed auction AND early signup)
  // The thank-you email is more appropriate, so remove from maintenance list
  const maintenanceFiltered = earlySignups.filter(e => !completedAuctionUsers.includes(e));

  console.log(`Sending THANK YOU email to ${completedAuctionUsers.length} completed auction users...`);
  for (const email of completedAuctionUsers) {
    await new Promise(r => setTimeout(r, 600));
    try {
      const { data, error } = await resend.emails.send({
        from: 'Patrick from Calcutta Edge <support@calcuttaedge.com>',
        replyTo: 'support@calcuttaedge.com',
        to: email,
        subject: 'Thanks for using Calcutta Edge — how did it go?',
        html: thankYouHtml,
      });
      if (error) console.error(`  ✗ ${email}: ${error.message}`);
      else console.log(`  ✓ ${email} (${data?.id})`);
    } catch (err) {
      console.error(`  ✗ ${email}:`, err);
    }
  }

  console.log(`\nSending MAINTENANCE email to ${maintenanceFiltered.length} early signups...`);
  for (const email of maintenanceFiltered) {
    await new Promise(r => setTimeout(r, 600));
    try {
      const { data, error } = await resend.emails.send({
        from: 'Patrick from Calcutta Edge <support@calcuttaedge.com>',
        replyTo: 'support@calcuttaedge.com',
        to: email,
        subject: 'Calcutta Edge is fully live — ready for your auction',
        html: maintenanceHtml,
      });
      if (error) console.error(`  ✗ ${email}: ${error.message}`);
      else console.log(`  ✓ ${email} (${data?.id})`);
    } catch (err) {
      console.error(`  ✗ ${email}:`, err);
    }
  }

  console.log('\n✅ All done.');
}

sendAll();
