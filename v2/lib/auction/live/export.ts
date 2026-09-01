import type { SoldTeam } from './use-auction-channel';
import type { BaseTeam, TournamentConfig } from '@/lib/tournaments/types';
import { formatGroupLabel } from '@/lib/calculations/format';

interface ParticipantPortfolio {
  name: string;
  teams: Array<{ teamName: string; seed: number; group: string; amount: number }>;
  totalSpent: number;
}

export function getParticipantPortfolios(
  soldTeams: SoldTeam[],
  baseTeams: BaseTeam[]
): ParticipantPortfolio[] {
  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const byParticipant = new Map<string, ParticipantPortfolio>();

  for (const sold of soldTeams) {
    const team = teamMap.get(sold.teamId);
    if (!byParticipant.has(sold.winnerId)) {
      byParticipant.set(sold.winnerId, {
        name: sold.winnerName,
        teams: [],
        totalSpent: 0,
      });
    }
    const portfolio = byParticipant.get(sold.winnerId)!;
    portfolio.teams.push({
      teamName: team?.name ?? `Team ${sold.teamId}`,
      seed: team?.seed ?? 0,
      group: team?.group ?? '',
      amount: sold.amount,
    });
    portfolio.totalSpent += sold.amount;
  }

  return Array.from(byParticipant.values()).sort(
    (a, b) => b.totalSpent - a.totalSpent
  );
}

export function generateCSV(
  soldTeams: SoldTeam[],
  baseTeams: BaseTeam[],
  sessionName: string,
  config?: TournamentConfig
): string {
  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  // Sport-correct column name (Division/Region/Group) with the historical
  // default for callers that don't pass a config.
  const rows = [['Team', 'Seed', config?.groupLabel ?? 'Region', 'Winner', 'Price'].join(',')];

  for (const sold of soldTeams) {
    const team = teamMap.get(sold.teamId);
    // Escape double quotes in CSV fields by doubling them (RFC 4180)
    const teamName = (team?.name ?? `Team ${sold.teamId}`).replace(/"/g, '""');
    const winnerName = sold.winnerName.replace(/"/g, '""');
    const groupName = formatGroupLabel(team?.group, config).replace(/"/g, '""');
    rows.push(
      [
        `"${teamName}"`,
        team?.seed ?? '',
        `"${groupName}"`,
        `"${winnerName}"`,
        sold.amount,
      ].join(',')
    );
  }

  const total = soldTeams.reduce((s, t) => s + t.amount, 0);
  rows.push('');
  rows.push(`"Total Pot",,,,${total}`);
  rows.push(`"Session","${sessionName.replace(/"/g, '""')}"`);

  return rows.join('\n');
}

export function generateTextSummary(
  soldTeams: SoldTeam[],
  baseTeams: BaseTeam[],
  sessionName: string,
  config?: TournamentConfig
): string {
  const teamMap = new Map(baseTeams.map((t) => [t.id, t]));
  const total = soldTeams.reduce((s, t) => s + t.amount, 0);
  const portfolios = getParticipantPortfolios(soldTeams, baseTeams);
  // NFL (and soccer): `seed` is positional within the group, not a rank —
  // printing "(23) Houston Texans" reads as a strength rank. Same gate the
  // on-screen surfaces use.
  const seedPrefix = (seed: number | undefined) =>
    config?.showSeedColumn === false || seed === undefined ? '' : `(${seed}) `;

  const lines = [
    `${sessionName} — Auction Results`,
    `Total Pot: $${total.toLocaleString()}`,
    `Teams Sold: ${soldTeams.length}`,
    '',
    '--- Results ---',
  ];

  for (const sold of soldTeams) {
    const team = teamMap.get(sold.teamId);
    lines.push(
      `${seedPrefix(team?.seed)}${team?.name ?? `Team ${sold.teamId}`} — ${sold.winnerName} — $${sold.amount.toLocaleString()}`
    );
  }

  lines.push('');
  lines.push('--- Portfolios ---');
  for (const p of portfolios) {
    lines.push(`${p.name}: $${p.totalSpent.toLocaleString()} (${p.teams.length} teams)`);
    for (const t of p.teams) {
      lines.push(`  ${seedPrefix(t.seed)}${t.teamName} — $${t.amount.toLocaleString()}`);
    }
  }

  return lines.join('\n');
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
