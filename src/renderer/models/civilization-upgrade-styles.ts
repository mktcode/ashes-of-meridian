/* Civilian specializations. Reuse shared decks, entries, windows and terrain supports. */
'use strict';
type CivilianStyleParts = {
  box(x:number,y:number,z:number,w:number,h:number,d:number,m?:'steel'|'edge'|'dark'|'orange'|'cyan'):void;
  residential(x:number,y:number,z:number,w:number,d:number,floors?:number):number;
  module(x:number,y:number,z:number,w:number,d:number,floors?:number):number;
  entry(y:number):void;
  cap(x:number,y:number,z:number,w:number,h:number,d:number):void;
  crate(x:number,y:number,z:number,scale:number,yaw:number,echo?:boolean):void;
  cylinder(x:number,y:number,z:number,r:number,h:number,m?:'steel'|'edge'|'dark'|'cyan'):void;
};
function civilianCargo(p:CivilianStyleParts,rank:number,echo=false){
  // Authored local positions, not entity-ID/terrain-dependent decoration. Entrances stay clear.
  const groups: readonly (readonly [number,number,number,number,number])[][]=[
    [[-1.06,.3,2.19,.30,-.08],[-.46,.3,2.26,.30,.12],[-1.03,.726,2.21,.30,-.08]],
    [[-1.15,.3,3.38,.30,-.10],[-.55,.3,3.45,.30,.12],[-1.12,.726,3.40,.30,-.10],[-.58,.726,3.46,.30,.12]],
    [[-1.60,.3,2.05,.32,-.10],[-.95,.3,2.12,.32,.13],[-1.57,.7544,2.08,.32,-.10],[-.97,.7544,2.14,.32,.13],[-1.48,.3,2.66,.27,.28]]
  ];
  for(const [x,y,z,s,yaw] of groups[rank-1])p.crate(x,y,z,s,yaw,echo);
}
function civilianWeaponDisplay(p:CivilianStyleParts,rank:number){
  // Parked scale demonstrator on the forecourt; never a unit, turret or animated weapon.
  const x=rank===1?-.80:rank===2?-1.0:-1.30,z=rank===2?3.44:2.20;
  p.box(x,.33,z,1.02,.06,.78,'edge');
  for(const side of [-1,1]){
    p.box(x+side*.29,.44,z,.19,.20,.65,'dark');
    for(const end of [-1,0,1])p.box(x+side*.39,.45,z+end*.20,.025,.10,.12,'edge');
  }
  p.box(x,.52,z,.51,.20,.56,'steel');
  p.cylinder(x,.69,z-.06,.23,.18,'steel');
  p.cylinder(x,.795,z-.08,.09,.025,'edge');
  p.box(x,.72,z+.38,.065,.065,.52,'dark');
  p.box(x,.72,z+.65,.10,.08,.10,'steel');
  p.box(x,.54,z+.30,.16,.045,.02,'cyan');
}
const CivilianUpgradeStyles: Record<string,(type:BuildingType,p:CivilianStyleParts)=>void> = {
  startingAlloy(type,p){
    const rank=type==='embercottage'?1:type==='terracecommons'?2:3;
    const vault=(x:number,y:number,z:number,w:number,d:number)=>{
      p.box(x,y+.33,z,w,.66,d,'dark');
      p.cap(x,y+.66,z,w+.12,.34,d+.12);
      for(const side of [-1,1])p.box(x+side*w*.36,y+.36,z+d/2+.03,.15,.58,.12,'orange');
      p.box(x,y+.35,z+d/2+.05,w*.55,.36,.08,'steel');
    };
    if(rank===1){
      const roof=p.residential(0,.35,0,4.4,3.3);
      vault(-1.05,roof,-.35,1.55,1.85);vault(1.05,roof,-.35,1.55,1.85);
      p.box(0,.9,1.68,2.7,1.05,.18,'dark');
    }else if(rank===2){
      const back=p.residential(-.8,1.45,-1.1,4.65,2.6,2);
      const front=p.residential(.75,.35,1.7,5.3,2.55);
      vault(-1.85,back,-1.1,1.55,1.9);vault(.25,back,-1.1,1.55,1.9);
      vault(.1,front,1.75,1.65,1.65);vault(2.15,front,1.75,1.65,1.65);
    }else{
      p.residential(0,.35,-.4,4.25,3.6,2);
      const roof=p.residential(0,3.45,-.5,3.65,3.1,4);
      for(const side of [-1,1])p.box(side*1.7,5.2,-.55,.45,9.1,2.35,'dark');
      vault(-.95,roof,-.65,1.45,2.5);vault(.95,roof+.18,-.35,1.45,2.5);
      for(let floor=0;floor<6;floor++)p.box(0,.6+floor*1.55,1.38,3.6,.18,.16,'orange');
    }
    civilianCargo(p,rank);
    p.entry(.35);
  },
  aetherAllocation(type,p){
    const rank=type==='embercottage'?1:type==='terracecommons'?2:3;
    const tank=(x:number,y:number,z:number,r:number,h:number)=>{
      p.cylinder(x,y+.06,z,r+.07,.12,'dark');
      p.cylinder(x,y+h/2+.12,z,r,h,'steel');
      for(const Y of [y+.18,y+h*.55,y+h+.08])p.cylinder(x,Y,z,r+.035,.085,'edge');
      p.cylinder(x,y+h+.18,z,r+.02,.16,'dark');
      p.cylinder(x,y+h+.28,z,r*.55,.06,'edge');
      p.box(x+r*.72,y+h*.53,z+r*.72,.10,h*.6,.07,'dark');
      p.box(x+r*.72,y+h*.53,z+r*.72+.04,.035,h*.45,.025,'cyan');
    };
    if(rank===1){
      const roof=p.residential(0,.35,0,4.4,3.3);
      tank(-1.05,roof,-.30,.67,1.25);tank(1.05,roof,-.30,.67,1.25);
      p.box(0,roof+.48,-.3,1.1,.24,.34,'dark');
    }else if(rank===2){
      const back=p.residential(-.8,1.45,-1.1,4.65,2.6,2);
      const front=p.residential(.75,.35,1.7,5.3,2.55);
      tank(-1.85,back,-1.1,.65,1.55);tank(.25,back,-1.1,.65,1.55);
      tank(.1,front,1.65,.64,1.10);tank(2.15,front,1.65,.64,1.10);
      p.box(-.8,back+.67,-1.1,1.25,.28,.42,'dark');
      p.box(-.8,back+.79,-1.1,1.3,.055,.50,'edge');
    }else{
      const podium=p.residential(0,.35,-.4,4.25,3.6,2);
      p.residential(0,podium-.18,-.5,1.35,2.85,3);
      for(const side of [-1,1])tank(side*1.22,podium-.10,-.5,.77,4.70);
      p.box(0,podium+3.4,.35,2.85,.32,1.50,'dark');
      p.box(0,podium+3.60,.35,2.95,.09,1.60,'edge');
      p.box(0,podium+3.42,1.12,1.35,.08,.045,'cyan');
    }
    civilianCargo(p,rank,true);
    p.entry(.35);
  },
  weaponTechnology(type,p){
    const rank=type==='fieldlab'?1:type==='researchhub'?2:3;
    const rails=(x:number,y:number,z:number,w:number,d:number)=>{
      p.box(x,y+.08,z,w,.16,d,'dark');
      for(const side of [-1,1]){
        p.box(x+side*w*.31,y+.35,z,w*.28,.5,d,'steel');
        for(const end of [-1,1])p.box(x+side*w*.31,y+.37,z+end*(d/2-.1),w*.32,.55,.2,'edge');
        p.box(x+side*w*.31,y+.62,z,w*.12,.035,d*.7,'cyan');
      }
      p.box(x,y+.4,z-d*.2,w,.18,.22,'edge');
    };
    if(rank===1){
      const roof=p.module(0,.35,0,4.4,3.3);
      rails(0,roof,-.25,3.45,2.2);
      for(const side of [-1,1]){
        p.box(side*2.22,1,-.3,.28,1.2,1.9,'dark');
        for(const z of [-.8,0])p.box(side*2.37,1,z,.035,.95,.12,'edge');
      }
    }else if(rank===2){
      const roof=p.module(-.8,1.8,-1.1,4.65,2.6,2);
      const terrace=p.module(.75,.35,1.7,5.3,2.55);
      rails(-.8,roof,-1.1,3.7,1.9);rails(.75,terrace,1.7,4.3,1.8);
      for(const side of [-1,1])p.box(-.8+side*1.9,3.4,-1.1,.32,3.1,2,'dark');
    }else{
      const podium=p.module(0,.35,-.4,4.7,3.95,2);
      const roof=p.module(.12,podium-.1,-.58,3.72,3.3,4);
      for(const side of [-1,1]){
        p.box(.12+side*1.55,5.4,1.14,.38,9.3,.2,'dark');
        p.box(.12+side*1.55,5.4,1.26,.07,8.9,.04,'cyan');
      }
      rails(.12,roof,-.58,3.55,2.4);
    }
    civilianWeaponDisplay(p,rank);
    p.entry(.35);
  }
};
