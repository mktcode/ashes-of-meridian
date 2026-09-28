/* Shared city footprints: CPU gameplay, scenery and deck lighting use the same coordinates. */
'use strict';
const AURELION_SECTOR_HEIGHT = 8;
const AURELION_DECK_OUTLINE = [[74,40],[143,40],[157,54],[157,124],[144,137],[61,137],[47,123],[47,67]] as const;
const AURELION_CROWN_FLOOR = {radius:41,height:.15} as const;
// Keep the four diagonal entrances to the inner objective open for vehicle bodies.
// Retain every lamp, moving the diagonal four to the outer cardinal rim.
const AURELION_CROWN_LAMPS = Array.from({length:16}, (_, i) => {
  const moved = i%4 === 2, angle = i*Math.PI/8 - (moved ? Math.PI/4 : 0), radius = moved ? 34 : 26;
  return {x:Math.sin(angle)*radius,z:Math.cos(angle)*radius,angle,index:i};
}).filter(lamp => lamp.index%4);
// ax, az, bx, bz, width, start height, end height. First four: mirrored approaches; last two: crossings.
const AURELION_WALKWAYS = [
  [112,40,112,18,22,AURELION_SECTOR_HEIGHT,2], [47,103,24,103,20,AURELION_SECTOR_HEIGHT,2],
  [60.5,53.5,43,36,24,AURELION_SECTOR_HEIGHT,0], [43,36,25,19,15,0,0],
  [112,-18,112,18,22,2,2], [-24,103,24,103,20,2,2]
] as const;
// Peripheral roofs retained from the study. Include cornices and projecting equipment in collision.
const AURELION_DECK_BUILDINGS = [
  {x:89,z:130,width:24,depth:10}, {x:149,z:88,width:11,depth:26},
  {x:145,z:121,width:10,depth:11}, {x:150,z:57,width:10,depth:11},
  {x:77,z:45,width:10,depth:11}, {x:133,z:126,width:18,depth:12}
] as const;

function aurelionLayout(): BattlefieldLayout {
  const startSites: BattlefieldLayout['startSites'] = [
    {x:-108,z:88},{x:108,z:-88},{x:-108,z:-88},{x:108,z:88}
  ];
  return {
    startSites, playerStart:startSites[0], enemySites:startSites.slice(1),
    centralClearings:[{x:0,z:0}], outerClearings:[], additionalClearings:[],
    controlZone:{x:0,z:0,radius:AURELION_CROWN_FLOOR.radius/2},
    // Two deposits per precinct, clear of HQs, service roofs and all three approaches.
    // Vents retain the common recipe's positive x/z offsets, including slot zero's +5/+18.
    resourceSites:[{x:-126,z:91},{x:126,z:-91},{x:-126,z:-91},{x:126,z:91},
      {x:-82,z:107},{x:82,z:-107},{x:-82,z:-107},{x:82,z:107}],
    corridors:[]
  };
}

function aurelionRoadPoint(road: readonly number[], x: number, z: number) {
  const [ax,az,bx,bz]=road,dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
  return {along:((x-ax)*dx+(z-az)*dz)/length,
    side:Math.abs((x-ax)*dz-(z-az)*dx)/length,length};
}
function aurelionDeckInset(x: number,z: number) {
  return Math.min(...AURELION_DECK_OUTLINE.map(([ax,az],i)=>{
    const [bx,bz]=AURELION_DECK_OUTLINE[(i+1)%AURELION_DECK_OUTLINE.length];
    return ((bx-ax)*(z-az)-(bz-az)*(x-ax))/Math.hypot(bx-ax,bz-az);
  }));
}
// Exactly one playable height per x/z; the city and traffic beneath it are scenery only.
function aurelionFloor(x: number,z: number) {
  x=Math.abs(x);z=Math.abs(z);
  if (aurelionDeckInset(x,z)>=0) return AURELION_SECTOR_HEIGHT;
  if (Math.hypot(x,z)<=AURELION_CROWN_FLOOR.radius) return AURELION_CROWN_FLOOR.height;
  for (const road of AURELION_WALKWAYS) {
    const p=aurelionRoadPoint(road,x,z);
    if (p.along>=-1 && p.along<=p.length+1 && p.side<=road[4]/2)
      return road[5]+(road[6]-road[5])*clamp(p.along/p.length,0,1);
  }
  if (Math.hypot(x-43,z-36)<=10) return 0;
  return -40;
}
function aurelionWalkable(x: number,z: number) {
  x=Math.abs(x);z=Math.abs(z);
  if (AURELION_DECK_BUILDINGS.some(b=>Math.abs(x-b.x)<=b.width/2+1 && Math.abs(z-b.z)<=b.depth/2+1)) return false;
  // The hologlobe's real plinth and supports remain solid, not a walk-through objective.
  const radius=Math.hypot(x,z);
  if (radius<16) return false;
  // Rendered raised lamps retain matching physical footprints.
  for (const lamp of AURELION_CROWN_LAMPS)
    if (Math.hypot(x-Math.abs(lamp.x),z-Math.abs(lamp.z))<1.7) return false;
  // Bridge rails continue onto the circular plaza/landings; their overlap is still solid.
  for (const road of AURELION_WALKWAYS) {
    const p=aurelionRoadPoint(road,x,z),ramp=road[5]!==road[6];
    if (p.along>=-.8 && p.along<=p.length+.8 &&
        (Math.abs(p.side-(road[4]/2-.25))<.95 ||
          (ramp && p.along>=0 && p.along<=p.length && p.side>road[4]/2-3.6 && p.side<road[4]/2))) return false;
  }
  if (aurelionDeckInset(x,z)>1.7 || radius<39) return true;
  for (const road of AURELION_WALKWAYS) {
    const p=aurelionRoadPoint(road,x,z),ramp=road[5]!==road[6];
    // Reserve rails and the flanking decorative stairs. End mouths remain open to the deck.
    if (p.along>=-5 && p.along<=p.length+5 && p.side<road[4]/2-(ramp?3.6:1.3) && aurelionFloor(x,z)>=0) return true;
  }
  // Circular landing connects the diagonal ramp to the narrower crown approach.
  return Math.hypot(x-43,z-36)<8;
}
