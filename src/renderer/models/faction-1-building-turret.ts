/* Verdant Choir / Thorn spire — a rooted seed cannon with a long hollow thorn barrel. */
'use strict';
(() => {
  const bark=[.48,.58,.52],leaf=[1.12,1.28,.78],edge=[1.3,1.18,.82],throat=[.34,.39,.34];
  function rod(out: number[],a: number[],b: number[],radius: number,tint: number[],top=1) {
    const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);
    ModelMesh.bake(out,geom.cylinder(10,top),{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,z:(a[2]+b[2])/2,
      sx:radius,sy:length,sz:radius,rx:Math.acos(d[1]/length),ry:Math.atan2(d[0],d[2]),tint});
  }
  function shell(out: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],lobes=4) {
    ModelMesh.lobedShell(out,{x,y,z,sx,sy,sz,lobes,segments:20,rings:8,depth:.04,tint});
  }
  // Thick, recessed muzzle along +Y; the complete emitter is rotated onto +Z when baked into the head.
  function cup() {
    const out: number[]=[],n=20,height=2.25,base=.29,rim=.5,
      point=(r: number,y: number,i: number)=>[Math.cos(i*Math.PI*2/n)*r,y,Math.sin(i*Math.PI*2/n)*r],
      quad=(a: number[],b: number[],c: number[],d: number[],t: number[])=>{geom.tri(out,a,b,c,t);geom.tri(out,a,c,d,t);};
    for(let i=0;i<n;i++) {
      const j=(i+1)%n,a=point(base,0,i),b=point(base,0,j),c=point(rim,height,j),d=point(rim,height,i),
        e=point(rim*.68,height,i),f=point(rim*.68,height,j),g=point(base*.44,.34,j),h=point(base*.44,.34,i);
      quad(a,d,c,b,edge);quad(d,e,f,c,[1.42,1.2,.78]);quad(e,h,g,f,throat);
      geom.tri(out,[0,.34,0],g,h,throat);geom.tri(out,[0,0,0],a,b,bark);
    }
    return out;
  }
  function hull() {
    const out: number[]=[];
    shell(out,0,.38,0,1.48,.46,1.48,bark,5);
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      rod(out,[Math.sin(a)*1.25,.28,Math.cos(a)*1.25],[Math.sin(a)*.38,1.42,Math.cos(a)*.38],.16,bark,.62);
    }
    rod(out,[0,.55,0],[0,2.72,0],.38,bark,.72);
    shell(out,0,2.5,0,.78,.48,.78,leaf,4);
    // Four upward leaves form an unmistakable gun cradle rather than a decorative spire.
    for(const side of [-1,1]) {
      rod(out,[side*.32,2.2,-.12],[side*.92,3.08,.18],.1,edge,.35);
      rod(out,[side*.3,2.14,-.22],[side*1.02,2.72,-.72],.08,leaf,.25);
    }
    return out;
  }
  function weapon() {
    const out: number[]=[];
    shell(out,0,0,-.35,.83,.66,1.08,leaf,5);
    ModelMesh.bake(out,cup(),{x:0,y:.05,z:.42,rx:Math.PI/2});
    // Paired guard thorns visually point in the same firing direction as the open barrel.
    for(const side of [-1,1]) {
      rod(out,[side*.58,.05,-.08],[side*.76,.16,1.72],.105,edge,.12);
      rod(out,[side*.55,.22,-.42],[side*.86,.42,-.9],.09,bark,.08);
    }
    return out;
  }
  function bud() {const out: number[]=[];shell(out,0,0,0,.22,.28,.22,[1,1,1],4);return out;}
  registerEntityModel({
    id:'faction-1/building/turret',meshes:{faction1TurretHull:hull,faction1TurretWeapon:weapon,faction1TurretBud:bud},
    render({entity:e,time,part:p,metal,dark,team,accent,baseRotation,surfaceColor}) {
      const scale=(e.size||1.7)/1.7,aim=(e.rot??baseRotation)-baseRotation,
        muzzle=(distance: number)=>[Math.sin(aim)*distance*scale,3.23,Math.cos(aim)*distance*scale];
      p('faction1TurretHull',0,0,0,scale,1,scale,metal);
      p('faction1TurretWeapon',0,3.18,0,scale,1,scale,dark,aim);
      const bud=muzzle(2.57),rim=muzzle(2.74);
      p('faction1TurretBud',bud[0],bud[1],bud[2],.78,.78,.78,surfaceColor(team),aim,0,0,.72+.08*Math.sin(time*2+e.id));
      p('ring',rim[0],rim[1],rim[2],.34,.34,.34,accent,aim,Math.PI/2,0,.7);
    }
  });
})();
