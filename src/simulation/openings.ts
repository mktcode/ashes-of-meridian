/* Public, symmetric landing forces on opt-in expedition maps. Selection has its
 * own seed stream; the ordinary unit factory, navigation and economy remain authoritative. */
'use strict';
interface ExpeditionOpening {
  readonly name:string;
  readonly briefing:string;
  readonly units:readonly UnitType[];
}
const EXPEDITION_OPENINGS:readonly ExpeditionOpening[] = [
  {name:'PIONEER LANDING',briefing:'Every party lands with two workers. Establish an economy and choose where to expand.',units:['worker','worker']},
  {name:'RECON IN FORCE',briefing:'Every party lands with two workers and three infantry. Scout early; the approaches are contested immediately.',units:['worker','worker','rifle','rifle','rifle']},
  {name:'ARMORED SPEARHEAD',briefing:'Every party lands with two workers, a tank and an infantry escort. Use the armor without leaving your economy exposed.',units:['worker','worker','tank','rifle']},
  {name:'SIEGE COLUMN',briefing:'Every party lands with two workers, artillery and an infantry escort. Protect the gun while establishing production.',units:['worker','worker','artillery','rifle']}
];
function expeditionOpening(map:BattlefieldId,seed:number):ExpeditionOpening|null {
  if(!BATTLEFIELDS[map].expeditionOpenings)return null;
  return EXPEDITION_OPENINGS[Math.floor(seeded(seed^0x4f50454e)()*EXPEDITION_OPENINGS.length)];
}
