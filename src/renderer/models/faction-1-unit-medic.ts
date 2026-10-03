/* Lifesinger — ambulant chalice blossom, four root legs and a luminous pollen heart. Geometry is baked once; animation never allocates meshes or consumes RNG. */
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

  function stem() {
    const o: number[]=[];
    shell(o,0,.68,0,.28,.44,.28);rod(o,[0,.73,0],[0,1.39,0],.14,[1,1.1,.8],.75);
    for(let i=0;i<4;i++) {const a=i*Math.PI/2;leaf(o,Math.sin(a)*.1,.58,Math.cos(a)*.1,.23,.8,a,-.55,[1.1,1.3,.8]);}
    return o;
  }
  function petal() {const o: number[]=[];leaf(o,0,0,0,.34,1,0,-.18);return o;}
  function rootLeg() {const o: number[]=[];rod(o,[0,.5,0],[.41,.31,.1],.105);rod(o,[.41,.31,.1],[.51,.05,.28],.06,[1,1,.8],.35);return o;}
  function heart() {const o: number[]=[];shell(o,0,0,0,.22,.28,.22);return o;}
  registerEntityModel({id:'faction-1/unit/medic',meshes:{choirLifesingerStem:stem,choirLifesingerPetal:petal,choirLifesingerRoot:rootLeg,choirLifesingerHeart:heart},
    render({entity:e,time,part:p,metal,dark,team,surfaceColor:c,nightLight=0,lightPool,pointLight}) {
      pointLight(0, 1.65, 0, 4, team, 1.5);
      p('choirLifesingerStem',0,0,0,1,1,1,metal);
      for(let i=0;i<4;i++) p('choirLifesingerRoot',0,0,0,1,1,1,dark,i*Math.PI/2,Math.sin((e.walk||0)*6+i*Math.PI)*.12);
      for(let i=0;i<5;i++) p('choirLifesingerPetal',0,1.35,0,1,1,1,c(0xd4a4bf),i*Math.PI*2/5,-.15+Math.sin(time*1.3)*.025);
      p('choirLifesingerHeart',0,1.51,0,1,1,1,team,0,0,0,.6+1.8*nightLight);
      if (nightLight > 0) lightPool(0,.8,1.8,2.3,team,.65*nightLight);
      for(let i=0;i<5;i++) {const a=i*Math.PI*2/5;p('octa',Math.cos(a)*.28,1.75,Math.sin(a)*.28,.065,.14,.065,c(0xf0d796),0,0,0,.4);}
    }
  });
})();
