import { getFeaturedTournament } from './registry'
import { getTournamentPhase } from './phase'

/**
 * Featured-tournament display copy, shared by every landing surface that
 * mentions the current event (hero badge, bottom CTA). One derivation means
 * the surfaces can never drift apart — the CTA used to hardcode "The Masters
 * starts Thursday." and was still saying it in September, under an NFL hero.
 *
 * Lives in lib/, not in a component file: registry/phase derivation is server
 * data logic, and exporting it from a section component would break every
 * importer the day that component needs 'use client'. NOTE: this module pulls
 * in the tournament registry (and its odds data) — keep it out of client
 * components.
 */

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
}

// Strip "2026", "2026-27", "20XX" year suffixes for conversational copy.
// "PGA Championship 2026" → "PGA Championship"
// "NFL Season 2026-27" → "NFL Season"
function cleanName(name: string): string {
  return name.replace(/\s+20\d\d(-\d\d)?$/, '')
}

export interface FeaturedInfo {
  shortName: string
  fullName: string
  badgeText: string
  /** Urgency headline for the bottom CTA, e.g. "NFL Season starts September 10." */
  ctaHeadline: string
  isLive: boolean
}

export function getFeaturedInfo(): FeaturedInfo | null {
  const featured = getFeaturedTournament()
  if (!featured) return null

  const phase = getTournamentPhase(featured.config)
  const fullName = featured.config.name
  const shortName = cleanName(fullName)

  if (phase === 'live') {
    return {
      shortName,
      fullName,
      badgeText: `${fullName} — Live Now`,
      ctaHeadline: `${shortName} is live right now.`,
      isLive: true,
    }
  }
  if (phase === 'hostable') {
    const dateText = formatLongDate(featured.config.startDate)
    return {
      shortName,
      fullName,
      badgeText: `${fullName} — Starts ${dateText}`,
      ctaHeadline: `${shortName} starts ${dateText}.`,
      isLive: false,
    }
  }
  if (phase === 'upcoming') {
    const opensText = formatLongDate(featured.config.hostingOpensAt ?? featured.config.startDate)
    return {
      shortName,
      fullName,
      badgeText: `${fullName} — Hosting opens ${opensText}`,
      ctaHeadline: `${shortName} is coming — hosting opens ${opensText}.`,
      isLive: false,
    }
  }
  return null
}
