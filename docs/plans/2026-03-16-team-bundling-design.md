# Team Bundling Design

## Problem
Calcutta auctions commonly bundle low seeds (13-16) into single auction items. Play-in teams (sharing a seed slot) should always be bundled since only one survives. Currently our app treats all 68 teams as individual items.

## Design

### Data Model
```typescript
interface TeamBundle {
  id: string;           // e.g., "east-13-16" or "playin-west-11"
  name: string;         // e.g., "East 13-16 Seeds" or "Texas / NC State"
  teamIds: number[];    // References to BaseTeam.id
  isPlayIn?: boolean;   // Auto-created for play-in matchups
}
```

Bundles live in `TournamentConfig.defaultBundles` (presets) and in session `settings.bundles` (commissioner customization). The bundle is a purchasing/display convenience — each team retains individual odds, values, and payouts.

### Bundling Presets
| Preset | Auction Items | Rule |
|--------|--------------|------|
| No Bundling | 64 | Play-ins merged only |
| Light (default) | 52 | Seeds 1-12 individual, 13-16 bundled per region |
| Standard | 48 | Seeds 1-12 individual, 13-16 by seed line |
| Heavy | 36 | Seeds 1-8 individual, 9-16 bundled per region |
| Custom | varies | Commissioner drag-and-drop |

### Play-in Auto-Bundling
Play-in opponents (e.g., Texas + NC State, both West 11-seed) are always bundled by default. After play-in games resolve, the losing team is removed from the bundle (future: results tracking feature).

### Math
- Bundle fair value = SUM of member team fair values (additive)
- Bundle profit per round = SUM of member team profits
- When sold, purchase price is split proportionally by fair value for individual team tracking

### Strategy Tool Changes
- Bundle row: collapsible group showing combined values
- Expanding shows individual team rows (indented, smaller)
- Price input on the bundle row applies to all member teams
- "Mine" checkbox on bundle row marks all member teams

### Live Auction Changes
- Bundle appears as one item in team queue
- Commissioner presents bundle (shows all member team names)
- Single bid buys all teams in bundle
- sellTeam() assigns all member teams to winner

### Session Setup (Commissioner)
- Preset selector dropdown during session creation
- "Custom" opens drag-and-drop bundle editor
- Can add/remove teams from bundles, create new bundles, name them

### Props (existing, enhance later)
Props already exist in config. No changes needed for bundling MVP. Future: make props subtract from round payouts (off-the-top).

## Implementation Priority
1. Play-in auto-bundling in tournament config (immediate)
2. Strategy tool bundle rows (before March 19)
3. Live auction bundling presets (before March 19)
4. Custom bundling UI (post-launch)
