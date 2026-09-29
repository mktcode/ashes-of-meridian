/* Named battlefield recipes; no numeric IDs or compatibility aliases. */
'use strict';
const BATTLEFIELDS = {
  desert: withWorldVariation(DESERT_BATTLEFIELD, 'desert'),
  'alien-planet': withWorldVariation(ALIEN_PLANET_BATTLEFIELD, 'alien'),
  mothership: withWorldVariation(MOTHERSHIP_BATTLEFIELD, 'ship'),
  westmark: withWorldVariation(WESTMARK_BATTLEFIELD, 'alpine'),
  aurelion: withWorldVariation(AURELION_BATTLEFIELD, 'city'),
  frontier: withWorldVariation(FRONTIER_BATTLEFIELD, 'frontier'),
  haven: withWorldVariation(HAVEN_BATTLEFIELD, 'haven')
} as const;
type BattlefieldId = keyof typeof BATTLEFIELDS;
const DEFAULT_BATTLEFIELD: BattlefieldId = 'desert';
function availableBattlefields(scope: 'expedition' | 'multiplayer' = 'expedition'): BattlefieldId[] {
  return (Object.keys(BATTLEFIELDS) as BattlefieldId[]).filter(id=>
    scope !== 'multiplayer' || BATTLEFIELDS[id].multiplayer !== false);
}
function battlefieldId(value: unknown): BattlefieldId {
  return typeof value === 'string' && Object.hasOwn(BATTLEFIELDS, value)
    ? value as BattlefieldId : DEFAULT_BATTLEFIELD;
}
