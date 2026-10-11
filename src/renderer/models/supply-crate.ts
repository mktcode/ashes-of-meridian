/* One authored crate assembly shared by world pickups and baked civilian cargo. */
'use strict';
const SUPPLY_CRATE_COLORS = Object.freeze({
  crateCinder:0x6b6153,crateEcho:0x385568,crateDark:0x222d38,crateEdge:0x89969e,
  crateCinderMark:0xf1ae45,crateEchoMark:0x65e5e9
});
type SupplyCratePart = (shape:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,
  color:number,glow?:number,rz?:number,rx?:number)=>void;
function supplyCrateParts(echo:boolean,part:SupplyCratePart){
  const shell=echo?SUPPLY_CRATE_COLORS.crateEcho:SUPPLY_CRATE_COLORS.crateCinder,
    accent=echo?SUPPLY_CRATE_COLORS.crateEchoMark:SUPPLY_CRATE_COLORS.crateCinderMark,
    dark=SUPPLY_CRATE_COLORS.crateDark,edge=SUPPLY_CRATE_COLORS.crateEdge;
  part('supplyCrateHull',0,.71,0,1.5,1.12,1.16,shell);
  part('supplyCrateHull',0,.17,0,1.62,.24,1.28,dark);
  part('supplyCrateHull',0,1.27,0,1.62,.2,1.28,edge);
  part('box',0,1.38,0,1.33,.025,1.04,dark);
  for(const side of [-1,1]){
    part('supplyCrateHull',side*.34,1.4,0,.58,.035,.96,shell);
    part('box',side*.52,.74,0,.115,1.15,1.23,dark);
    part('box',side*.52,1.44,0,.115,.055,1.18,accent);
    part('box',side*.755,.88,0,.035,.35,.67,dark);
    part('box',side*.80,.98,0,.065,.07,.48,edge);
    for(const zz of [-.22,.22])part('box',side*.80,.88,zz,.065,.2,.065,edge);
    for(let j=0;j<3;j++)part('box',side*.776,.45,j*.15-.15,.04,.045,.09,edge);
    for(const front of [-1,1]){
      part('supplyCrateHull',side*.66,.72,front*.5,.2,1.12,.22,edge);
      part('box',side*.52,.83,front*.64,.22,.27,.075,edge);
      part('box',side*.52,.85,front*.688,.09,.12,.025,dark);
      part('hex',side*.66,1.293,front*.5,.055,.025,.055,dark);
    }
  }
  for(const front of [-1,1]){
    part('box',0,.72,front*.592,.72,.53,.025,dark);
    part('box',.21,.9,front*.613,.19,.035,.015,accent,.45);
    for(let j=0;j<3;j++)part('box',.15+j*.065,.55,front*.613,.027,.08,.015,edge);
    if(echo){
      part('box',-.16,.75,front*.623,.2,.2,.03,accent,.45,Math.PI/4);
      part('box',-.16,.75,front*.643,.085,.085,.012,dark,0,Math.PI/4);
    }else{
      part('box',-.21,.75,front*.622,.09,.28,.02,accent,.2,-.55);
      part('box',-.06,.75,front*.622,.09,.28,.02,accent,.2,.55);
    }
  }
}
