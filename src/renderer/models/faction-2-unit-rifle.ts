/* Pallbearer — masked procession guard, split armored cloak and a long offset rail lance. Geometry is baked once; animation never allocates meshes or consumes RNG. */
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

  function body() {
    const o: number[]=[];
    panel(o,0,1.12,0,.51,.7,.38);
    // A tapered funerary mask: narrow chin, projecting brow and swept crown rather than a box head.
    const rings=[[1.49,.075,.095],[1.63,.17,.17],[1.83,.18,.18],[1.97,.055,.105]].map(([y,w,d])=>
      [[-w*.7,y,d],[w*.7,y,d],[w,y,d*.3],[w*.65,y,-d],[-w*.65,y,-d],[-w,y,d*.3]]);
    for(let i=0;i<6;i++) {
      const k=(i+1)%6;
      for(let j=0;j<3;j++) {geom.tri(o,rings[j][i],rings[j][k],rings[j+1][k],[1.13,1.1,1.04]);geom.tri(o,rings[j][i],rings[j+1][k],rings[j+1][i],[1.13,1.1,1.04]);}
      geom.tri(o,[0,1.97,0],rings[3][i],rings[3][k]);geom.tri(o,[0,1.49,0],rings[0][k],rings[0][i]);
    }
    panel(o,0,1.86,.173,.34,.065,.08,[.6,.6,.7]);
    for(const s of [-1,1]) {
      panel(o,s*.38,1.45,0,.36,.21,.49);rod(o,[s*.36,1.32,0],[s*.41,.99,.3],.085,[.6,.6,.7]);
      panel(o,s*.16,.49,0,.2,.49,.25,[.54,.54,.63]);
      const slab: number[]=[];panel(slab,0,0,0,.32,.86,.16);ModelMesh.bake(o,slab,{x:s*.27,y:.69,z:-.17,rz:s*.14});
      panel(o,s*.32,.77,.012,.045,.36,.035,[1.3,1.25,1.05]);
      for(let i=0;i<3;i++) panel(o,s*.38,1.573,-.15+i*.14,.19,.024,.034,[.48,.49,.6]);
    }
    return o;
  }
  function lance() {
    const o: number[]=[];
    panel(o,.44,1.09,.55,.21,.21,.9,[.48,.47,.57]);
    for(const s of [-1,1]) panel(o,.44+s*.095,1.1,1.06,.055,.16,.7);
    panel(o,.44,1.22,.51,.15,.06,.32,[1.2,1.17,1]);
    return o;
  }
  registerEntityModel({id:'faction-2/unit/rifle',meshes:{courtPallbearerBody:body,courtPallbearerLance:lance},
    render({part:p,metal,dark,team,surfaceColor:c,nightLight=0,lightPool,pointLight}) {
      pointLight(.44, 1.1, .98, 4, 0x79d9e3, 1.5);
      p('courtPallbearerBody',0,0,0,1,1,1,metal);p('courtPallbearerLance',0,0,0,1,1,1,metal);
      p('box',0,1.77,.187,.16,.04,.03,team,0,0,0,.65);
      p('octa',0,1.24,.205,.105,.2,.055,team,0,0,0,.4);
      p('box',.44,1.1,.84,.055,.055,.28,c(0x79d9e3),0,0,0,.6+1.8*nightLight);
      if (nightLight > 0) lightPool(.44,1.6,1.8,2.3,0x79d9e3,.65*nightLight);
    }
  });
})();
