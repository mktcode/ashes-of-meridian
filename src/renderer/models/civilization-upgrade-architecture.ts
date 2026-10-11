/* Authoring primitives for the approved civilian prototypes. Mesh colors stay in the
   shared material buckets; decks, terrain supports and stairs belong to the game adapter. */
'use strict';
class CivilianUpgradeArchitecture {
  readonly family: 'home' | 'lab';
  readonly rank: number;
  constructor(private readonly parts:CivilianStyleParts,private readonly type:BuildingType){
    this.family=['embercottage','terracecommons','hearthtower'].includes(type)?'home':'lab';
    this.rank=['embercottage','fieldlab'].includes(type)?1:['terracecommons','researchhub'].includes(type)?2:3;
  }
  box(x:number,y:number,z:number,w:number,h:number,d:number,m:CivilianStyleMaterial='steel',yaw=0){
    this.parts.box(x,y,z,w,h,d,m,yaw,true);
  }
  oct(x:number,y:number,z:number,w:number,h:number,d:number,cut=.3,m:CivilianStyleMaterial='steel'){
    this.parts.oct(x,y,z,w,h,d,Math.min(cut,w*.23,d*.23),m);
  }
  cylinder(x:number,y:number,z:number,r:number,h:number,m:CivilianStyleMaterial='edge',top=1,n=12){
    this.parts.cylinder(x,y,z,r,h,m,top,n);
  }
  beam(a:number[],b:number[],w:number,m:CivilianStyleMaterial='edge'){this.parts.beam(a,b,w,m);}
  wedge(x:number,y:number,z:number,w:number,h:number,d:number,m:CivilianStyleMaterial='edge'){
    this.parts.cap(x,y,z,w,h,d,m);
  }
  house(x:number,y:number,z:number,w:number,d:number,floors=1,walls:CivilianStyleMaterial='steel',cut?:number){
    const H=floors*1.55,research=this.family==='lab',corner=Math.min(cut??(research?.7:.09),w*.23,d*.23),
      wallW=Math.max(.16,w-2*corner-.22),wallD=Math.max(.16,d-2*corner-.22);
    this.oct(x,y+H/2,z,w,H,d,corner,walls);
    this.oct(x,y+.10,z,w+.12,.20,d+.12,.13,'dark');
    for(let floor=0;floor<floors;floor++){
      const Y=y+floor*1.55;
      this.oct(x,Y+1.48,z,w+.10,.14,d+.10,research?.72:.1,'dark');
      const countX=research?1:Math.max(1,Math.floor(wallW/.98)),countZ=research?1:Math.max(1,Math.floor(wallD/1.02));
      const windowMat=(j:number):CivilianStyleMaterial=>research?'window':(j+floor)%5===2?'dim':'warm';
      for(const side of [-1,1]){
        for(let j=0;j<countX;j++){
          const X=x+(j-(countX-1)/2)*Math.min(.98,wallW/countX),Z=z+side*(d/2+.025),ww=research?wallW:Math.min(.70,wallW/countX*.80);
          this.box(X,Y+.85,Z,ww+.15,.90,.10,'dark');
          this.box(X,Y+.85,Z+side*.06,ww,.70,.035,windowMat(j));
          this.box(X,Y+.40,Z+side*.07,ww+.18,.075,.16,'edge');
          this.box(X,Y+.85,Z+side*.085,.033,.71,.025,'dark');
        }
        for(let j=0;j<countZ;j++){
          const X=x+side*(w/2+.025),Z=z+(j-(countZ-1)/2)*Math.min(1.02,wallD/countZ),dd=research?wallD:Math.min(.7,wallD/countZ*.8);
          this.box(X,Y+.85,Z,.10,.9,dd+.15,'dark');
          this.box(X+side*.06,Y+.85,Z,.035,.70,dd,windowMat(j));
          this.box(X+side*.07,Y+.40,Z,.16,.075,dd+.18,'edge');
        }
      }
    }
    this.oct(x,y+H+.045,z,w+.30,.21,d+.30,research?.78:.14,'edge');
    this.oct(x,y+H+.17,z,w-.18,.07,d-.18,research?.66:.08,'dark');
    return y+H+.21;
  }
  rail(x:number,y:number,z:number,w:number,gap=0){
    const pieces=gap?[[-w/2,-gap/2],[gap/2,w/2]]:[[-w/2,w/2]];
    for(const [a,b]of pieces){
      for(const h of [.36,.72])this.box(x+(a+b)/2,y+h,z,b-a,.045,.045,'edge');
      const n=Math.max(1,Math.ceil((b-a)/.7));
      for(let i=0;i<=n;i++)this.box(x+a+(b-a)*i/n,y+.36,z,.045,.72,.045,'edge');
    }
  }
  planter(x:number,y:number,z:number,w=.9,d=.48){
    this.box(x,y+.13,z,w,.26,d,'steel');this.box(x,y+.265,z,w-.10,.035,d-.10,'soil');
    const n=Math.max(2,Math.round(w/.25));
    for(let i=0;i<n;i++)this.cylinder(x+(i-(n-1)/2)*(w-.20)/n,y+.38,z,.16,.25,'garden',.55,7);
  }
  bench(x:number,y:number,z:number,w=1.0){
    this.box(x,y+.22,z,w,.10,.35,'edge');this.box(x,y+.45,z-.15,w,.40,.07,'steel');
    for(const side of [-1,1])this.box(x+side*w*.35,y+.10,z,.075,.22,.30,'dark');
  }
  frame(x:number,y:number,z:number,w:number,h:number,d:number,material:CivilianStyleMaterial='dark'){
    for(const sx of [-1,1])for(const sz of [-1,1])this.box(x+sx*w/2,y+h/2,z+sz*d/2,.18,h,.18,material);
    for(const sz of [-1,1])this.box(x,y+h,z+sz*d/2,w+.22,.22,.22,'edge');
    for(const sx of [-1,1])this.box(x+sx*w/2,y+h,z,.22,.22,d+.22,'edge');
  }
  balcony(x:number,y:number,z:number,w:number){
    this.box(x,y,z,w,.13,.55,'edge');this.box(x,y+.09,z-.09,w-.1,.06,.30,'dark');
    this.rail(x,y+.08,z+.23,w-.10);
  }
  cframe(x:number,y:number,z:number,w:number,h:number,d:number){
    this.box(x-w/2,y+h/2,z,.26,h+.24,d,'dark');
    for(const Y of [y,y+h]){
      this.box(x,Y,z,w+.25,.23,d,'edge');
      this.box(x+w/2,Y+(Y===y?.13:-.13),z,.24,.35,d*.8,'steel');
    }
  }
  grille(x:number,y:number,z:number,w=1.0,h=.55){
    this.box(x,y,z,w,h,.12,'dark');
    for(let j=-2;j<=2;j++)this.box(x,y+j*h*.16,z+.075,w-.12,.035,.04,'edge');
  }
  skylight(x:number,y:number,z:number,w:number,d:number){
    this.oct(x,y+.10,z,w+.12,.20,d+.12,.2,'edge');
    this.oct(x,y+.24,z,w,.16,d,.22,'glass');
    this.box(x,y+.34,z,w*.78,.045,d*.55,'window');
  }
  pulse(x:number,y:number,z:number,scale=1){
    this.box(x,y,z,.8*scale,.40*scale,.08,'dark');
    const points=[[-.32,0],[-.16,0],[-.08,.11],[0,-.11],[.08,0],[.32,0]];
    for(let i=0;i<points.length-1;i++)this.beam([x+points[i][0]*scale,y+points[i][1]*scale,z+.06],
      [x+points[i+1][0]*scale,y+points[i+1][1]*scale,z+.06],.027*scale,'cyan');
  }
  finish(){
    this.parts.entry(.35);
    const e=(BUILDINGS[this.type] as BuildingDefinitionShape).civilizationEntry!;
    this.rail(e.x,.31,e.z-.05,this.rank===1?3.05:this.rank===2?3.10:4.0,1.25);
  }
}
