import { describe, it, expect } from 'vitest';
import { getStandardProps } from '../props';
import { NFL_SEASON_2026_CONFIG } from '../configs/nfl-season-2026';

describe('NFL props', () => {
  it('returns props for the NFL season tournament', () => {
    const props = getStandardProps('nfl_season_2026');
    expect(props.map((p) => p.key)).toEqual(['bestRecord', 'worstRecord']);
  });

  it('prop keys match the config exactly, or the pot silently under-distributes', () => {
    const configKeys = NFL_SEASON_2026_CONFIG.propBets.map((p) => p.key).sort();
    const propKeys = getStandardProps('nfl_season_2026').map((p) => p.key).sort();
    expect(propKeys).toEqual(configKeys);
  });

  it('does not leak NFL props into other sports', () => {
    expect(getStandardProps('world_cup_2026').some((p) => p.key === 'bestRecord')).toBe(false);
  });
});
