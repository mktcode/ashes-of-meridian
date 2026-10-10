/* Tiny view-only models. Shared primitives, no meshes, point lights or GPU allocation per actor. */
'use strict';
interface SettlementTrafficModelContext { part: ModelPart; walk: number; color: number }
const SettlementTrafficModels = Object.freeze({
  civilian({part:p,walk,color}: SettlementTrafficModelContext) {
    const swing=Math.sin(walk*7)*.32;
    p('box',0,.48,0,.27,.32,.18,color);
    p('box',0,.75,0,.17,.19,.17,0xcab99d);
    for(const side of [-1,1]) {
      p('box',side*.075,.19,0,.085,.32,.10,0x424d58,0,side*swing);
      p('box',side*.19,.48,0,.07,.29,.08,color,0,-side*swing);
    }
  },
  drone({part:p,color}: SettlementTrafficModelContext) {
    p('box',0,.43,0,.32,.15,.45,color);
    p('box',0,.48,.13,.21,.07,.14,0x69cbd8,0,0,0,1.2);
    for(const side of [-1,1]) p('box',side*.23,.41,-.05,.12,.09,.25,0x424d58);
  }
});
