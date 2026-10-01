/* All playable worlds share procedural topology; families supply art and landforms. */
'use strict';
const BATTLEFIELDS = {
  desert: createDynamicBattlefield('DESERT', 'desert'),
  'alien-planet': createDynamicBattlefield('ALIEN PLANET', 'alien'),
  mothership: createDynamicBattlefield('MOTHERSHIP', 'ship'),
  westmark: createDynamicBattlefield('WESTMARK', 'alpine'),
  frontier: createDynamicBattlefield('FRONTIER', 'frontier'),
  haven: createDynamicBattlefield('HAVEN', 'haven')
} as const;
type BattlefieldId = keyof typeof BATTLEFIELDS;
const DEFAULT_BATTLEFIELD: BattlefieldId = 'desert';
function availableBattlefields(_scope: 'expedition' | 'multiplayer' = 'expedition'): BattlefieldId[] {
  return Object.keys(BATTLEFIELDS) as BattlefieldId[];
}
function battlefieldId(value: unknown): BattlefieldId {
  return typeof value === 'string' && Object.hasOwn(BATTLEFIELDS, value)
    ? value as BattlefieldId : DEFAULT_BATTLEFIELD;
}
