/* Named battlefield recipes; no numeric IDs or compatibility aliases. */
'use strict';
const BATTLEFIELDS = {
  desert: DESERT_BATTLEFIELD,
  'alien-planet': ALIEN_PLANET_BATTLEFIELD,
  mothership: MOTHERSHIP_BATTLEFIELD,
  westmark: WESTMARK_BATTLEFIELD
} as const;
type BattlefieldId = keyof typeof BATTLEFIELDS;
const DEFAULT_BATTLEFIELD: BattlefieldId = 'desert';
function battlefieldId(value: unknown): BattlefieldId {
  return typeof value === 'string' && Object.hasOwn(BATTLEFIELDS, value)
    ? value as BattlefieldId : DEFAULT_BATTLEFIELD;
}
