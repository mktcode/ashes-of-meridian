/* Tender — six-legged gardener, scoops and folded leaf panniers. Geometry is baked once; animation never allocates meshes or consumes RNG. */
'use strict';
(() => {
  function shell(out: number[], x: number, y: number, z: number, sx: number, sy: number, sz: number, tint=[1,1,1]) {
    const small=Math.max(sx,sy,sz)<.1;
    ModelMesh.lobedShell(out,{x,y,z,sx,sy,sz,lobes:4,segments:small?16:24,rings:small?6:10,depth:.035,tint});
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
    shell(o,0,.69,-.34,.43,.37,.62);shell(o,0,.58,.26,.3,.28,.4);
    shell(o,0,.57,.68,.34,.25,.28,[1.12,1.12,.8]);
    for(const s of [-1,1]) {
      leaf(o,s*.28,.7,-.75,.28,.82,s*.55,-.6,[.95,1.25,.72]);
      rod(o,[s*.16,.73,.82],[s*.29,1.08,1.06],.035,[.7,.85,.6]);
      shell(o,s*.29,1.08,1.06,.055,.065,.055,[1.3,1.2,.7]);
      rod(o,[s*.27,.48,.55],[s*.48,.32,.9],.08);
      leaf(o,s*.43,.24,.8,.2,.46,-s*.3,.05,[1.25,1.1,.65]);
    }
    for(let i=0;i<3;i++) rod(o,[-.33,.73,-.7+i*.25],[.33,.73,-.7+i*.25],.04,[.7,.85,.6]);
    return o;
  }
  function leg() {
    const o: number[]=[];rod(o,[0,0,0],[.3,-.16,-.08],.072);rod(o,[.3,-.16,-.08],[.38,-.43,.04],.05,[1.1,1.1,.8],.55);return o;
  }
  function basket() {
    const o: number[]=[];
    // Six overlapping ribs leave a visibly open collecting pouch, not another solid abdomen.
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      rod(o,[Math.cos(a)*.11,0,Math.sin(a)*.11],[Math.cos(a)*.25,.38,Math.sin(a)*.25],.043,[1.25,1.2,.78]);
      leaf(o,Math.sin(a)*.09,.04,Math.cos(a)*.09,.15,.45,a,-1.05,[1.1,1.3,.8]);
    }
    return o;
  }
  function cargo() {
    const o: number[]=[];
    for(const s of [-1,1]) for(let i=0;i<3;i++) ModelMesh.bake(o,geom.crystal(),{x:s*.36,y:.72,z:-.54+i*.19,sx:.12,sy:.22+i*.02,sz:.12,ry:i,tint:[1,.83,.5]});
    return o;
  }
  registerEntityModel({id:'faction-1/unit/worker',meshes:{choirTenderBody:body,choirTenderLeg:leg,choirTenderBasket:basket,choirTenderCargo:cargo},
    render({entity:e,part:p,metal,dark,team,surfaceColor:c}) {
      p('choirTenderBody',0,0,0,1,1,1,metal);
      for(const s of [-1,1]) p('choirTenderBasket',s*.4,.68,-.35,1,1,1,metal);
      for(const s of [-1,1]) for(let i=0;i<3;i++) {
        const step=Math.sin((e.walk||0)*7+i*2.1+s)*.13;
        p('choirTenderLeg',s*.25,.46,-.5+i*.4,1,1,1,dark,s<0?Math.PI:0,step,0);
      }
      for(const s of [-1,1]) p('octa',s*.2,.63,.91,.065,.055,.035,team,0,0,0,.5);
      if((e.carry||0)>0) p('choirTenderCargo',0,0,0,1,1,1,c(0xdcb670));
    }
  });
})();
