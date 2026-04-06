/**
 * Send Cowork-generated blog posts + strategy doc summary to support@calcuttaedge.com for review
 *
 * Run with: npx tsx scripts/send-content-review.ts
 * Requires RESEND_API_KEY env var
 */
import { Resend } from 'resend';
import { readFileSync } from 'fs';
import { join } from 'path';

const resend = new Resend(process.env.RESEND_API_KEY!);

// Read all blog posts
const blogDir = join(__dirname, '../../blog');
const blog1 = readFileSync(join(blogDir, 'masters-calcutta-guide-2026.md'), 'utf-8');
const blog2 = readFileSync(join(blogDir, 'masters-calcutta-strategy-2026.md'), 'utf-8');
const blog3 = readFileSync(join(blogDir, 'calcutta-vs-traditional-pools.md'), 'utf-8');

function mdToHtml(md: string): string {
  return md
    .replace(/^# (.+)$/gm, '<h1 style="color:#fff;font-size:24px;margin:24px 0 8px;">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#fff;font-size:20px;margin:20px 0 8px;">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="color:#10b981;font-size:16px;margin:16px 0 6px;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#10b981;">$1</a>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #333;margin:24px 0;">')
    .replace(/\n\n/g, '</p><p style="color:#a3a3a3;font-size:14px;line-height:1.7;margin:0 0 12px;">')
    .replace(/^/, '<p style="color:#a3a3a3;font-size:14px;line-height:1.7;margin:0 0 12px;">')
    + '</p>';
}

const html = `
<div style="background-color:#0a0a0a;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:680px;margin:0 auto;background-color:#111;border-radius:12px;border:1px solid #222;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#064e3b 0%,#0a0a0a 100%);padding:32px;">
      <div style="color:#10b981;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin:0 0 8px;">CONTENT REVIEW</div>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;">Masters 2026 — Blog Posts + Strategy Doc</h1>
      <p style="color:#a3a3a3;font-size:14px;margin:0;">3 blog posts ready for review. Strategy doc (DOCX) is in the repo at <code style="color:#10b981;">docs/CalcuttaEdge-Masters-2026-Marketing-Strategy.docx</code></p>
    </div>

    <div style="padding:28px 32px;">
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin-bottom:24px;">
        <h2 style="color:#f59e0b;font-size:14px;margin:0 0 4px;">BLOG POST 1</h2>
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 8px;">How to Run a Masters Calcutta Auction in 2026</p>
        <p style="color:#666;font-size:12px;margin:0;">Commissioner setup guide — field structure, payouts, timeline</p>
      </div>
      ${mdToHtml(blog1)}

      <hr style="border:none;border-top:2px solid #10b981;margin:40px 0;">

      <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin-bottom:24px;">
        <h2 style="color:#f59e0b;font-size:14px;margin:0 0 4px;">BLOG POST 2</h2>
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 8px;">Masters 2026 Calcutta Strategy: Devigging Odds & Fair Value</p>
        <p style="color:#666;font-size:12px;margin:0;">Analytical framework — devig math, EV by payout tier, mispricings</p>
      </div>
      ${mdToHtml(blog2)}

      <hr style="border:none;border-top:2px solid #10b981;margin:40px 0;">

      <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin-bottom:24px;">
        <h2 style="color:#f59e0b;font-size:14px;margin:0 0 4px;">BLOG POST 3</h2>
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 8px;">Why a Calcutta Auction Is the Only Golf Pool Format With a Real Skill Edge</p>
        <p style="color:#666;font-size:12px;margin:0;">Conversion piece — pick sheets vs Calcuttas, moving your group over</p>
      </div>
      ${mdToHtml(blog3)}
    </div>

    <div style="padding:20px 32px;text-align:center;">
      <p style="color:#555;font-size:12px;">Sent from Claude Code session — content review for calcuttaedge.com</p>
    </div>
  </div>
</div>
`;

async function main() {
  console.log('Sending content review email...');
  const { data, error } = await resend.emails.send({
    from: 'Calcutta Edge <support@calcuttaedge.com>',
    to: ['support@calcuttaedge.com'],
    subject: 'Masters 2026 Content Review — 3 Blog Posts + Strategy Doc',
    html,
  });

  if (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
  console.log('Sent! ID:', data?.id);
}

main();
