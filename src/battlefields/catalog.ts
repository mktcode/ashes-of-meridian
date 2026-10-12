/* Expedition map catalog: families of the shared procedural landscape generator. */
'use strict';
const BATTLEFIELDS = {
  desert: createDynamicBattlefield(LANDSCAPE_FAMILIES.desert),
  'alien-planet': createDynamicBattlefield(LANDSCAPE_FAMILIES.alien),
  westmark: createDynamicBattlefield(LANDSCAPE_FAMILIES.westmark),
  frontier: createDynamicBattlefield(LANDSCAPE_FAMILIES.frontier),
  haven: createDynamicBattlefield(LANDSCAPE_FAMILIES.haven)
} as const;
type BattlefieldId = keyof typeof BATTLEFIELDS;
const DEFAULT_BATTLEFIELD: BattlefieldId = 'desert';
function availableBattlefields(): BattlefieldId[] {
  return Object.keys(BATTLEFIELDS) as BattlefieldId[];
}
function battlefieldId(value: unknown): BattlefieldId {
  return typeof value === 'string' && Object.hasOwn(BATTLEFIELDS, value)
    ? value as BattlefieldId : DEFAULT_BATTLEFIELD;
}
