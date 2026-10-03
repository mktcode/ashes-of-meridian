/* Elegist — a hovering funeral organ, tall resonators and a long forward focusing fork. Geometry is baked once; animation never allocates meshes or consumes RNG. */
'use strict';
(() => {
  function rod(out: number[], a: number[], b: number[], radius: number, tint=[1,1,1], top=1) {
    const d=b.map((v,i)=>v-a[i]), length=Math.hypot(...d);
    ModelMesh.bake(out,geom.cylinder(8,top),{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,z:(a[2]+b[2])/2,
      sx:radius,sy:length,sz:radius,rx:Math.acos(d[1]/length),ry:Math.atan2(d[0],d[2]),tint});
  }
  function panel(out: number[], x: number, y: number, z: number, w: number, h: number, d: number, tint=[1,1,1]) {
    ModelMesh.panel(out,{x,y,z,w,h,d,bevel:Math.min(w,h,d)*.16,tint});
  }

  function sled() {
    const o: number[]=[];panel(o,0,.46,-.08,1.04,.35,2.67);
    for(const s of [-1,1]) {panel(o,s*.7,.35,-.62,.32,.27,1.65);rod(o,[s*.24,.5,-.25],[s*.67,.42,-.85],.1,[.6,.6,.7]);}
    panel(o,0,.76,-.72,1.16,.29,.91,[.64,.64,.73]);
    for(const s of [-1,1]) {panel(o,s*.26,.95,1.06,.14,.24,1.56);panel(o,s*.26,.85,1.56,.23,.12,.37,[1.22,1.18,1.09]);}
    return o;
  }
  function organ() {
    const o: number[]=[];
    for(let i=-1;i<=1;i++) {
      const h=i===0?2.12:1.58;
      panel(o,i*.39,1+h*.5,-.62,.26,h,.33);
      panel(o,i*.39,1.12+h*.5,-.435,.075,h*.67,.035,[.36,.39,.49]);
      panel(o,i*.39,1+h,-.62,.34,.13,.43,[1.23,1.2,1.08]);
      for(let j=0;j<3;j++) panel(o,i*.39,1.21+j*.24,-.428,.19,.045,.05,[.73,.73,.81]);
    }
    for(const s of [-1,1]) rod(o,[s*.5,.72,.13],[s*.49,2.2,-.76],.065,[.55,.57,.67]);
    return o;
  }
  registerEntityModel({id:'faction-2/unit/artillery',meshes:{courtElegistSled:sled,courtElegistOrgan:organ},
    render({nightPart:p,metal,dark,team,surfaceColor:c,pointLight}) {
      pointLight(0, 1.1, 1.1, 6, 0x79d9e3, 2.5);
      p('courtElegistSled',0,0,0,1,1,1,metal);p('courtElegistOrgan',0,0,0,1,1,1,metal);
      for(const s of [-1,1]) p('box',s*.7,.23,-.62,.13,.05,1.27,team,0,0,0,.45);
      for(let i=-1;i<=1;i++) p('octa',i*.39,i===0?2.82:2.28,-.425,.07,.17,.04,team,0,0,0,.65);
      p('octa',0,1.04,.84,.13,.15,.48,c(0x79d9e3),0,0,0,.6);
    }
  });
})();
