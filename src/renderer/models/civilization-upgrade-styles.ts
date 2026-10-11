/* First two civilian specializations. Reuse shared decks, entries, windows and terrain supports. */
'use strict';
type CivilianStyleParts = {
  box(x:number,y:number,z:number,w:number,h:number,d:number,m?:'steel'|'edge'|'dark'|'orange'|'cyan'):void;
  residential(x:number,y:number,z:number,w:number,d:number,floors?:number):number;
  module(x:number,y:number,z:number,w:number,d:number,floors?:number):number;
  entry(y:number):void;
  cap(x:number,y:number,z:number,w:number,h:number,d:number):void;
  crate(x:number,y:number,z:number,scale:number,yaw:number,echo?:boolean):void;
};
function civilianCargo(p:CivilianStyleParts,rank:number,mixed=false){
  // Authored local positions, not entity-ID/terrain-dependent decoration. Entrances stay clear.
  const groups: readonly (readonly [number,number,number,number,number])[][]=[
    [[-1.06,.3,2.19,.30,-.08],[-.46,.3,2.26,.30,.12],[-1.03,.726,2.21,.30,-.08]],
    [[-1.15,.3,3.38,.30,-.10],[-.55,.3,3.45,.30,.12],[-1.12,.726,3.40,.30,-.10],[-.58,.726,3.46,.30,.12]],
    [[-1.60,.3,2.05,.32,-.10],[-.95,.3,2.12,.32,.13],[-1.57,.7544,2.08,.32,-.10],[-.97,.7544,2.14,.32,.13],[-1.48,.3,2.66,.27,.28]]
  ];
  for(const [x,y,z,s,yaw] of groups[rank-1])p.crate(x,y,z,s,yaw);
  if(mixed){
    const z=rank===2?3.45:2.30;
    p.crate(1.70,.3,z,.30,-.18,true);
    p.crate(1.73,.726,z+.02,.30,-.18,true);
  }
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
      p.box(-2.22,1,-.3,.25,1.1,1.9,'dark');
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
    civilianCargo(p,rank,true);
    p.entry(.35);
  }
};
