/* The First Voice — rooted seer with a branching crown, layered petal mantle and seed sceptre. Geometry is baked once; animation never allocates meshes or consumes RNG. */
'use strict';
(() => {
  function shell(out: number[], x: number, y: number, z: number, sx: number, sy: number, sz: number, tint=[1,1,1]) {
    ModelMesh.lobedShell(out,{x,y,z,sx,sy,sz,lobes:4,segments:24,rings:10,depth:.035,tint});
  }
  function rod(out: number[], a: number[], b: number[], radius: number, tint=[1,1,1], top=1) {
    const d=b.map((v,i)=>v-a[i]), length=Math.hypot(...d);
    ModelMesh.bake(out,geom.cylinder(8,top),{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,z:(a[2]+b[2])/2,
      sx:radius,sy:length,sz:radius,rx:Math.acos(d[1]/length),ry:Math.atan2(d[0],d[2]),tint});
  }
  // Closed curved leaf: central ridge, tapered edges and separately wound underside.
  function leaf(out: number[], x: number, y: number, z: number, width: number, length: number, ry=0, rx=0, tint=[1,1,1]) {
    const data: number[]=[], steps=10;
    const point=(i: number, side: number, back: boolean) => {
      const t=i/steps, arch=Math.sin(Math.PI*t);
      return [side*width*arch*(.85+.15*t),length*(.18*t*t+.07*arch)*(1-Math.abs(side)*.65)-(back?.045*arch:0),t*length];
    };
    for (const back of [false,true]) for(let i=0;i<steps;i++) for(const side of [-1,1]) {
      const a=point(i,0,back), b=point(i,side,back), c=point(i+1,side,back), d=point(i+1,0,back);
      const tri=(u: number[],v: number[],w: number[])=>back !== (side>0)?geom.tri(data,u,w,v,tint):geom.tri(data,u,v,w,tint);
      if(i>0) tri(a,b,c);
      if(i<steps-1) tri(a,c,d);
    }
    ModelMesh.bake(out,data,{x,y,z,ry,rx});
  }

  function body() {
    const o: number[]=[];
    shell(o,0,1.3,0,.29,.64,.26);shell(o,0,2.03,.06,.23,.33,.24,[1.2,1.2,.8]);
    for(const s of [-1,1]) {
      rod(o,[s*.27,1.64,0],[s*.55,1.24,.1],.09);rod(o,[s*.55,1.24,.1],[s*.6,1.4,.49],.07);
      rod(o,[s*.13,2.19,-.08],[s*.42,2.69,-.15],.065,[1.28,1.2,.8],.35);
      rod(o,[s*.29,2.46,-.1],[s*.71,2.62,-.21],.047,[1.28,1.2,.8],0);
      rod(o,[s*.41,2.64,-.15],[s*.47,2.96,-.24],.033,[1.28,1.2,.8],0);
    }
    return o;
  }
  function rootFoot() {
    const o: number[]=[];
    rod(o,[0,.98,0],[.13,.28,.04],.14,[.85,.98,.74],.65);
    for(let i=0;i<3;i++) rod(o,[.13,.28,.04],[.09+i*.12,.06,.32-i*.16],.06,[1.1,1.16,.77],.15);
    return o;
  }
  function mantle() {
    const o: number[]=[];
    for(let i=0;i<7;i++) {const a=.6+i*.84;leaf(o,Math.sin(a)*.2,1.76,Math.cos(a)*.2,.29,1.34,a,1.03,[1.08,.94,1.1]);}
    return o;
  }
  function sceptre() {
    const o: number[]=[];rod(o,[.62,.16,.53],[.62,2.07,.53],.045,[1.1,1.2,.75]);
    for(const s of [-1,1]) leaf(o,.62,1.8,.53,.16,.57,s*.9,-1.15,[1.18,1.22,.87]);return o;
  }
  registerEntityModel({id:'faction-1/unit/hero',meshes:{choirFirstVoiceBody:body,choirFirstVoiceRoot:rootFoot,choirFirstVoiceMantle:mantle,choirFirstVoiceSceptre:sceptre},
    render({entity:e,time,part:p,metal,team,surfaceColor:c,nightLight=0,lightPool}) {
      p('choirFirstVoiceBody',0,0,0,1,1,1,metal);
      for(const s of [-1,1]) p('choirFirstVoiceRoot',s*.15,0,Math.sin((e.walk||0)*5)*s*.12,1,1,1,metal,s<0?Math.PI:0);
      p('choirFirstVoiceMantle',0,0,0,1,1,1,c(0xb991b0),0,Math.sin(time*1.2)*.015);
      p('choirFirstVoiceSceptre',0,0,0,1,1,1,metal);
      p('octa',.62,2.08,.53,.14,.24,.14,team,0,0,0,.65+1.75*nightLight);
      if (nightLight > 0) lightPool(.62,1.3,1.8,2.3,team,.65*nightLight);
      for(const s of [-1,1]) p('octa',s*.11,2.09,.27,.04,.09,.045,team,0,0,0,.45);
      p('octa',0,1.45,.26,.15,.22,.07,team,0,0,0,.4);
    }
  });
})();
