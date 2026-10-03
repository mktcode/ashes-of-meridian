/* Fraktion 0 / unit / tank: tracked armor with a fixed +Z weapon; no new aiming animation. */
'use strict';
(() => {
  function hull() {
    const out: number[]=[], box=geom.box(), wheel=geom.cylinder(10), hub=geom.cylinder(6),
      dark=[.37,.43,.48], edge=[1.23,1.2,1.12];
    const panel=(x: number,y: number,z: number,w: number,h: number,d: number,bevel: number,tint: number[])=>ModelMesh.panel(out,{x,y,z,w,h,d,bevel,tint});
    const part=(mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],rx=0,rz=0)=>ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,rx,rz});
    panel(0,.75,0,2.3,.85,3,.14,[1,1,1]);
    for(const side of [-1,1]) {
      panel(side*1.35,.57,0,.66,.83,3.25,.095,dark);
      panel(side*1.35,1.08,0,.73,.18,3.5,.04,[1,1,1]);
      for(let j=-2;j<=2;j++) {
        part(wheel,side*1.55,.48,j*.61,.31,.22,.31,[.75,.83,.85],0,Math.PI/2);
        part(hub,side*1.675,.48,j*.61,.115,.04,.115,edge,0,Math.PI/2);
      }
      // Static individual track shoes. No additional wheel/track phase or RNG.
      for(let j=-5;j<=5;j++) for(const y of [.19,.96])
        part(box,side*1.35,y,j*.28,.59,.075,.19,dark);
      for(const end of [-1,1]) for(let j=-1;j<=1;j++)
        part(box,side*1.35,.57+j*.22,end*(1.58-Math.abs(j)*.05),.59,.17,.09,edge,j*end*.45);
      panel(side*.98,.83,1.38,.28,.27,.26,.045,dark);
    }
    ModelMesh.bake(out,geom.cylinder(6),{x:0,y:1.48,z:-.25,sx:1.03,sy:.8,sz:.95,ry:.25});
    panel(0,1.95,-.33,1.3,.18,1.3,.045,dark);
    panel(.36,2.065,-.43,.45,.1,.48,.024,edge);
    panel(0,1.207,-1.1,1.22,.11,.54,.025,dark);
    for(let j=-3;j<=3;j++) part(box,j*.15,1.277,-1.1,.055,.045,.43,edge);
    for(const side of [-1,1]) {
      part(box,side*.72,1.67,-.59,.13,.07,.65,edge);
      part(hub,side*.9,1.89,-.15,.065,.05,.065,dark);
    }
    const shaft: number[]=[];
    ModelMesh.bake(shaft,box,{sx:0.35,sy:0.35,sz:2.3,tint:dark});
    for(let j=-2;j<=2;j++) ModelMesh.bake(shaft,box,{z:j*0.4,sx:0.4,sy:0.4,sz:.06,tint:edge});
    ModelMesh.bake(out,shaft,{y:1.63,z:1.25,rx:0});
    // Four beveled muzzle walls, with the dark end recessed behind the lip.
    const muzzle: number[]=[], w=0.53, h=0.47, d=0.42, wall=.12;
    for(const side of [-1,1]) {
      ModelMesh.panel(muzzle,{x:side*(w-wall)/2,y:0,z:0,w:wall,h,d,bevel:.022,tint:edge});
      ModelMesh.panel(muzzle,{x:0,y:side*(h-wall)/2,z:0,w:w-wall*2,h:wall,d,bevel:.022,tint:edge});
    }
    ModelMesh.bake(muzzle,box,{z:-d*.24,sx:w-wall*2,sy:h-wall*2,sz:.025,tint:dark});
    ModelMesh.bake(out,muzzle,{y:1.63,z:2.48,rx:0});
    return out;
  }
  registerEntityModel({
    id:'faction-0/unit/tank', meshes:{faction0TankHull:hull},
    render({nightPart:p,metal,team,accent,pointLight}) {
      pointLight(0, .9, 1.7, 6, 0xffe4aa, 2.5);
      p('faction0TankHull',0,0,0,1,1,1,metal);
      for(const side of [-1,1]) {
        p('box',side*1.35,1.2,.5,.18,.08,1.6,team,0,0,0,.3);
        p('box',side*.98,.85,1.525,.14,.09,.035,0xffe4aa,0,0,0,.45);
      }
      p('box',-.45,2.08,-.35,.44,.1,.6,team,0,0,0,.4);
    }
  });
})();
