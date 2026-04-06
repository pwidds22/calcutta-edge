import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

// ── TEST MODE: Send both emails to Patrick only ──────────────
const TEST_RECIPIENT = 'pwiddoss22@gmail.com';

// ── Email A recipients: Users who drafted in completed auctions ──
// 47 unique emails across 5 completed sessions
// Excludes: pwiddoss22 (self), test accounts
const draftedUsers = [
  // Calcutta 2026 (lukebannon, 14 participants, $4,660 pot)
  'lukebannon1993@gmail.com',
  'bannon.jake@gmail.com',
  'acredblur951@gmail.com',
  'bjosh2222@gmail.com',
  'dbnseyller@gmail.com',
  'jeremiewise@gmail.com',
  'jrholland903@gmail.com',
  'jslemke721@gmail.com',
  'jzickert84@gmail.com',
  'kortuemmark@yahoo.com',
  'tcallahan903@gmail.com',
  'tjbannon3@gmail.com',
  'younger35@gmail.com',
  'dr.cavsirish@gmail.com',
  // Calcutta League 2026 (aboyer, 11 participants, $1,912 pot)
  'aboyer7135@gmail.com',
  'peterson.taylor.alan@gmail.com',
  'ricksimmon@att.net',
  'b.anderson.sports@gmail.com',
  'clint.horn@hartville.k12.mo.us',
  'deputy289@gmail.com',
  'tarheels1312@gmail.com',
  'tmorgans17975@gmail.com',
  'ttuberville@yahoo.com',
  // NEW CTAN 2026 (kshah31, 10 participants, $32,575 pot)
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
  // Pat's Calcutta Auction (self-hosted, 8 participants, $1,990 pot)
  'dylan.triggs@yahoo.com',
  'gmucisko@gmail.com',
  'jcwetzel12@gmail.com',
  'jgriff5646@gmail.com',
  'johnjoseph.dean1993@gmail.com',
  'robinsonjamest3@gmail.com',
  'williamprooney@gmail.com',
  // 2026 Lebanon Calcutta (17 participants, $2,452 pot)
  'aduddellservices@outlook.com',
  'chasegunter1059@gmail.com',
  'chicks303030@gmail.com',
  'codykimes18@gmail.com',
  'crunzo23@gmail.com',
  'dylanrodden@gmail.com',
  'gcanape81@gmail.com',
  'johnfuchs21@gmail.com',
  'lucasrtyre@gmail.com',
  'rhowerton17@gmail.com',
  'ryneemerick@gmail.com',
  'scoutbowles@gmail.com',
  'toverstreet@lebanon.k12.mo.us',
  'wes200515@yahoo.com',
  // Multi-session users (already listed above, deduped by Set below)
  'seburns@yahoo.com',
  'simmonfritz@gmail.com',
  'yesterdayistoday2@gmail.com',
];

// ── Email B recipients: Signed up but never drafted ──
// Excludes: test accounts, spam emails, svalukis (competitor), self
const nonDraftedUsers = [
  '33middie@gmail.com',
  'kingjj26@gmail.com',
  'henryholderness@gmail.com',
  'thomasmuscarella@gmail.com',
  'rblakely21@gmail.com',
  'ryansg23@yahoo.com',
  'rjgardner15@aol.com',
  'coachostreet1@gmail.com',
  'marcsaeger1@gmail.com',
  'camdunn5@gmail.com',
  'sanjudouglas@gmail.com',
  'coleroark77@gmail.com',
  'mbod1213@gmail.com',
  'slickpools7@gmail.com',
];

// ── Shared styles ──────────────────────────────────────────────
const s = {
  wrapper: 'background-color: #0a0a0a; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
  container: 'max-width: 560px; margin: 0 auto; background-color: #111111; border-radius: 12px; border: 1px solid #222; overflow: hidden;',
  header: 'background: linear-gradient(135deg, #064e3b 0%, #0a0a0a 100%); padding: 32px 32px 24px;',
  logoRow: 'display: flex; align-items: center; gap: 10px; margin-bottom: 16px;',
  logoText: 'color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;',
  badge: 'display: inline-block; background-color: #10b981; color: #000; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.5px;',
  body: 'padding: 32px;',
  p: 'color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 16px;',
  h3: 'color: #10b981; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; margin: 28px 0 8px; text-transform: uppercase;',
  featureBlock: 'background-color: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 3px solid #10b981;',
  featureTitle: 'color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 4px;',
  featureDesc: 'color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;',
  cta: 'display: inline-block; background-color: #10b981; color: #000000; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin: 8px 8px 8px 0;',
  ctaSecondary: 'display: inline-block; background-color: transparent; color: #10b981; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 8px; text-decoration: none; border: 1px solid #10b981; margin: 8px 8px 8px 0;',
  divider: 'border: none; border-top: 1px solid #222; margin: 24px 0;',
  footer: 'padding: 24px 32px; text-align: center;',
  footerText: 'color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0;',
  tournamentCard: 'background-color: #1a1a1a; border-radius: 8px; padding: 14px 16px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px;',
  tournamentEmoji: 'font-size: 24px; flex-shrink: 0;',
  tournamentName: 'color: #ffffff; font-size: 14px; font-weight: 600; margin: 0;',
  tournamentDate: 'color: #6b7280; font-size: 12px; margin: 0;',
};

// ── Email A: Dashboard announcement for drafted users ─────────
const emailAHtml = `
<div style="${s.wrapper}">
  <div style="${s.container}">
    <div style="${s.header}">
      <div style="${s.logoRow}">
        <img src="https://calcuttaedge.com/brand/calcutta_edge_180x180.png" alt="CE" width="36" height="36" style="border-radius: 8px;" />
        <span style="${s.logoText}">Calcutta Edge</span>
      </div>
      <span style="${s.badge}">TOURNAMENT UPDATE</span>
    </div>

    <div style="${s.body}">
      <p style="${s.p}">Hey,</p>

      <p style="${s.p}">Quick update — your Calcutta auction now has a <strong style="color: #fff;">live tournament dashboard</strong> where you can track standings, payouts, and who owes who as the tournament plays out.</p>

      <p style="${s.p}">Here's what's there:</p>

      <div style="${s.featureBlock}">
        <p style="${s.featureTitle}">📊 Live Leaderboard</p>
        <p style="${s.featureDesc}">See every participant's P&L updated in real time. Your purchase price only counts against you once a team is eliminated — so if your team is still alive, you'll see how much you stand to win at each round.</p>
      </div>

      <div style="${s.featureBlock}">
        <p style="${s.featureTitle}">🏀 One-Tap Score Sync</p>
        <p style="${s.featureDesc}">Hit the green "Sync Scores" button on your dashboard to pull in the latest game results. The bracket, leaderboard, and payouts all update automatically. Anyone in the auction can do it — not just the commissioner.</p>
      </div>

      <div style="${s.featureBlock}">
        <p style="${s.featureTitle}">💰 Settlement Calculator</p>
        <p style="${s.featureDesc}">When the tournament wraps up, the platform calculates exactly who owes who — simplified down to the minimum number of payments. No spreadsheet needed. Your commissioner can check off payments as they come in.</p>
      </div>

      <div style="${s.featureBlock}">
        <p style="${s.featureTitle}">📋 Full Auction History</p>
        <p style="${s.featureDesc}">Export your auction results as CSV, view every team's owner and purchase price, and see round-by-round profit projections for your portfolio.</p>
      </div>

      <hr style="${s.divider}" />

      <p style="${s.p}"><strong style="color: #fff;">How to check your standings:</strong> Log in, go to your dashboard, and open your auction. Hit "Sync Scores" to pull the latest results, then check the Leaderboard tab.</p>

      <div style="margin: 24px 0;">
        <a href="https://calcuttaedge.com/host" style="${s.cta}">Check Your Standings →</a>
      </div>

      <hr style="${s.divider}" />

      <p style="${s.p}; color: #9ca3af; font-size: 13px;"><strong style="color: #f59e0b;">Coming soon:</strong> Masters, NBA Playoffs, NHL Playoffs, Kentucky Derby, and more. Same free hosting, same real-time experience. If there's a Calcutta your group wants to run, just reply and let me know.</p>

      <p style="${s.p}">Good luck with your teams.</p>

      <p style="${s.p}">— Patrick<br /><span style="color: #6b7280;">Founder, Calcutta Edge</span></p>
    </div>

    <div style="${s.footer}">
      <p style="${s.footerText}">
        <a href="https://calcuttaedge.com" style="color: #10b981; text-decoration: none;">calcuttaedge.com</a><br />
        You're receiving this because you participated in a Calcutta auction on our platform.
      </p>
    </div>
  </div>
</div>
`;

// ── Email B: What's next for non-drafted users ────────────────
const emailBHtml = `
<div style="${s.wrapper}">
  <div style="${s.container}">
    <div style="${s.header}">
      <div style="${s.logoRow}">
        <img src="https://calcuttaedge.com/brand/calcutta_edge_180x180.png" alt="CE" width="36" height="36" style="border-radius: 8px;" />
        <span style="${s.logoText}">Calcutta Edge</span>
      </div>
      <span style="${s.badge}">WHAT'S NEXT</span>
    </div>

    <div style="${s.body}">
      <p style="${s.p}">Hey,</p>

      <p style="${s.p}">Quick update from Calcutta Edge — March Madness auctions have been running on the platform and groups are now tracking their standings and payouts live as games finish.</p>

      <p style="${s.p}">If your group didn't get to run one this year, no worries — <strong style="color: #fff;">more Calcuttas are coming soon</strong>, and they're all <strong style="color: #10b981;">completely free to host</strong>.</p>

      <hr style="${s.divider}" />

      <p style="${s.h3}">Coming Up</p>

      <div style="${s.tournamentCard}">
        <span style="${s.tournamentEmoji}">⛳</span>
        <div>
          <p style="${s.tournamentName}">The Masters</p>
          <p style="${s.tournamentDate}">April 9–13 — Bid on golfers, get paid based on where they finish.</p>
        </div>
      </div>

      <div style="${s.tournamentCard}">
        <span style="${s.tournamentEmoji}">🏀</span>
        <div>
          <p style="${s.tournamentName}">NBA Playoffs</p>
          <p style="${s.tournamentDate}">April 18 – June — Bid on teams, earn payouts as they advance each round.</p>
        </div>
      </div>

      <div style="${s.tournamentCard}">
        <span style="${s.tournamentEmoji}">🏒</span>
        <div>
          <p style="${s.tournamentName}">NHL Playoffs</p>
          <p style="${s.tournamentDate}">April 18 – June — Same format as NBA — bid on teams, payouts per round.</p>
        </div>
      </div>

      <div style="${s.tournamentCard}">
        <span style="${s.tournamentEmoji}">🐎</span>
        <div>
          <p style="${s.tournamentName}">Kentucky Derby</p>
          <p style="${s.tournamentDate}">May 2 — Bid on horses, owner of the winner takes the pot. The original Calcutta.</p>
        </div>
      </div>

      <div style="${s.tournamentCard}">
        <span style="${s.tournamentEmoji}">🏈🏀</span>
        <div>
          <p style="${s.tournamentName}">NFL & College Football Season</p>
          <p style="${s.tournamentDate}">Late August — Bid on teams before the season, earn payouts based on wins.</p>
        </div>
      </div>

      <p style="${s.p}; margin-top: 20px;">Create a room, share a code, and your group bids from their phones. The platform handles the timer, the math, and the payouts — all free.</p>

      <p style="${s.p}"><strong style="color: #f59e0b;">Don't see your Calcutta?</strong> Reply to this email and let me know what your group runs — I'll get it set up.</p>

      <div style="margin: 24px 0;">
        <a href="https://calcuttaedge.com" style="${s.cta}">Check It Out →</a>
      </div>

      <p style="${s.p}">— Patrick<br /><span style="color: #6b7280;">Founder, Calcutta Edge</span></p>
    </div>

    <div style="${s.footer}">
      <p style="${s.footerText}">
        <a href="https://calcuttaedge.com" style="color: #10b981; text-decoration: none;">calcuttaedge.com</a><br />
        You're receiving this because you signed up for Calcutta Edge.
      </p>
    </div>
  </div>
</div>
`;

// ── Send to real recipients ───────────────────────────────────
async function sendAll() {
  // Dedupe drafted users (some appear in multiple sessions)
  const uniqueDrafted = [...new Set(draftedUsers)];

  // Exclude self from drafted list
  const draftedFiltered = uniqueDrafted.filter(e => e !== 'pwiddoss22@gmail.com');

  console.log(`=== PRODUCTION SEND ===`);
  console.log(`Email A: ${draftedFiltered.length} drafted users`);
  console.log(`Email B: ${nonDraftedUsers.length} non-drafted users\n`);

  // Send Email A to all drafted users
  console.log('--- Email A: Dashboard Announcement ---');
  let aSuccess = 0, aFail = 0;
  for (const email of draftedFiltered) {
    await new Promise(r => setTimeout(r, 600));
    try {
      const { data, error } = await resend.emails.send({
        from: 'Patrick from Calcutta Edge <support@calcuttaedge.com>',
        replyTo: 'support@calcuttaedge.com',
        to: email,
        subject: 'Your Calcutta has a live dashboard — check your standings',
        html: emailAHtml,
      });
      if (error) { console.error(`  ✗ ${email}: ${error.message}`); aFail++; }
      else { console.log(`  ✓ ${email} (${data?.id})`); aSuccess++; }
    } catch (err) {
      console.error(`  ✗ ${email}:`, err);
      aFail++;
    }
  }
  console.log(`\nEmail A done: ${aSuccess} sent, ${aFail} failed\n`);

  // Send Email B to non-drafted users
  console.log('--- Email B: What\'s Next ---');
  let bSuccess = 0, bFail = 0;
  for (const email of nonDraftedUsers) {
    await new Promise(r => setTimeout(r, 600));
    try {
      const { data, error } = await resend.emails.send({
        from: 'Patrick from Calcutta Edge <support@calcuttaedge.com>',
        replyTo: 'support@calcuttaedge.com',
        to: email,
        subject: "Masters, NBA, NHL, Derby — Calcuttas coming soon (free to host)",
        html: emailBHtml,
      });
      if (error) { console.error(`  ✗ ${email}: ${error.message}`); bFail++; }
      else { console.log(`  ✓ ${email} (${data?.id})`); bSuccess++; }
    } catch (err) {
      console.error(`  ✗ ${email}:`, err);
      bFail++;
    }
  }
  console.log(`\nEmail B done: ${bSuccess} sent, ${bFail} failed`);
  console.log(`\n=== ALL DONE: ${aSuccess + bSuccess} sent, ${aFail + bFail} failed ===`);
}

sendAll();
