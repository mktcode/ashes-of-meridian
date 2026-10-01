/* Custodian — floating horseshoe tool chassis, collecting well and articulated salvage pincers. Geometry is baked once; animation never allocates meshes or consumes RNG. */
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
    for(const s of [-1,1]) {
      panel(o,s*.47,.59,-.1,.32,.32,1.14);
      panel(o,s*.43,.78,-.49,.34,.19,.37,[1.12,1.1,1]);
      panel(o,s*.48,.44,-.18,.2,.12,.83,[.42,.43,.51]);
      rod(o,[s*.49,.57,.42],[s*.62,.43,.78],.065,[.65,.65,.73]);
    }
    panel(o,0,.62,-.63,.9,.3,.28);panel(o,0,.51,-.24,.64,.1,.62,[.45,.45,.54]);
    for(let i=0;i<3;i++) panel(o,0,.61,-.49+i*.18,.41,.045,.04,[.72,.73,.82]);
    panel(o,0,.86,-.62,.42,.2,.24);return o;
  }
  function claw() {
    const o: number[]=[];rod(o,[0,0,0],[.11,-.03,.26],.065,[.65,.64,.72]);
    panel(o,.09,-.02,.29,.12,.16,.33);rod(o,[.09,-.04,.43],[-.07,-.07,.53],.055,[1.2,1.2,1.1],.25);return o;
  }
  function cargo() {
    const o: number[]=[];for(let i=0;i<3;i++) ModelMesh.bake(o,geom.crystal(),{x:(i-1)*.15,y:.57,z:-.23,sx:.12,sy:.3+i*.025,sz:.13,ry:i,tint:[1,.9,.6]});return o;
  }
  registerEntityModel({id:'faction-2/unit/worker',meshes:{courtCustodianBody:body,courtCustodianClaw:claw,courtCustodianCargo:cargo},
    render({entity:e,time,part:p,metal,dark,team,surfaceColor:c}) {
      p('courtCustodianBody',0,0,0,1,1,1,metal);
      for(const s of [-1,1]) {
        p('courtCustodianClaw',s*.62,.43,.78,1,1,1,metal,s*.16+Math.sin(time*1.6)*s*.035);
        p('box',s*.48,.45,-.13,.12,.05,.52,team,0,0,0,.5);
      }
      p('box',0,.86,-.486,.23,.075,.04,team,0,0,0,.65);
      if((e.carry||0)>0) p('courtCustodianCargo',0,0,0,1,1,1,c(0xd8b474));
    }
  });
})();
