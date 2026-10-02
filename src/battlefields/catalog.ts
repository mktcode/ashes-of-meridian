/* Established landscape families plus explicitly selectable engineered prototypes. */
'use strict';
const BATTLEFIELDS = {
  desert: createDynamicBattlefield('DESERT', 'desert'),
  'alien-planet': createDynamicBattlefield('ALIEN PLANET', 'alien'),
  mothership: createDynamicBattlefield('MOTHERSHIP', 'ship'),
  westmark: createDynamicBattlefield('WESTMARK', 'alpine'),
  frontier: createDynamicBattlefield('FRONTIER', 'frontier'),
  haven: createDynamicBattlefield('HAVEN', 'haven'),
  'platform-deck': createPlatformBattlefield()
} as const;
type BattlefieldId = keyof typeof BATTLEFIELDS;
const DEFAULT_BATTLEFIELD: BattlefieldId = 'desert';
function availableBattlefields(): BattlefieldId[] {
  // Platform prototype is explicitly selectable for feedback, not yet rolled into expeditions.
  return (Object.keys(BATTLEFIELDS) as BattlefieldId[]).filter(id => id !== 'platform-deck');
}
function battlefieldId(value: unknown): BattlefieldId {
  return typeof value === 'string' && Object.hasOwn(BATTLEFIELDS, value)
    ? value as BattlefieldId : DEFAULT_BATTLEFIELD;
}
