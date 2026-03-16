import type { TeamBundle, BundlePreset } from '@/lib/tournaments/types';
import type { EnabledProp } from '@/lib/tournaments/props';

export interface TimerSettings {
  enabled: boolean;
  initialDurationSec: number;
  resetDurationSec: number;
}

export interface SessionSettings {
  timer?: TimerSettings;
  bidIncrements?: number[];
  autoMode?: boolean;
  bundles?: TeamBundle[];
  bundlePreset?: BundlePreset;
  enabledProps?: EnabledProp[];
  minimumBid?: number; // Global floor price, defaults to 1
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  enabled: false,
  initialDurationSec: 20,
  resetDurationSec: 8,
};

export const DEFAULT_BID_INCREMENTS = [1, 5, 10, 25, 50, 100];

export const BID_INCREMENT_PRESETS = {
  small: { label: 'Casual', description: '+$1, +$2, +$5, +$10, +$25', values: [1, 2, 5, 10, 25] },
  medium: { label: 'Standard', description: '+$1, +$5, +$10, +$25, +$50, +$100', values: [1, 5, 10, 25, 50, 100] },
  large: { label: 'Big Money', description: '+$5, +$25, +$50, +$100, +$250, +$500', values: [5, 25, 50, 100, 250, 500] },
} as const;

export type BidIncrementPreset = keyof typeof BID_INCREMENT_PRESETS;
