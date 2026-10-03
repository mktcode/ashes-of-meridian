/* Thornling — upright mantis with spring legs and an asymmetric thorn launcher. Geometry is baked once; animation never allocates meshes or consumes RNG. */
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
  // Hollow flared emitter with a thick lip and dark recessed throat, along +Y.
  function cup(out: number[], height: number, base: number, rim: number) {
    const n=20, ring=(r: number,y: number,i: number)=>[Math.cos(i*2*Math.PI/n)*r,y,Math.sin(i*2*Math.PI/n)*r];
    for(let i=0;i<n;i++) {
      const j=(i+1)%n,a=ring(base,0,i),b=ring(base,0,j),c=ring(rim,height,j),d=ring(rim,height,i),
        e=ring(rim*.78,height,i),f=ring(rim*.78,height,j),g=ring(base*.55,.12,j),h=ring(base*.55,.12,i);
      const quad=(p: number[],q: number[],r: number[],s: number[],t=[1,1,1])=>{geom.tri(out,p,q,r,t);geom.tri(out,p,r,s,t);};
      quad(a,d,c,b);quad(d,e,f,c,[1.25,1.18,1]);quad(e,h,g,f,[.55,.6,.53]);
      geom.tri(out,[0,.12,0],g,h,[.3,.35,.3]);geom.tri(out,[0,0,0],a,b,[.7,.7,.7]);
    }
  }

  function body() {
    const o: number[]=[];
    shell(o,0,.92,-.12,.28,.42,.28);shell(o,0,1.47,0,.25,.26,.25);
    for(const s of [-1,1]) {
      leaf(o,s*.21,1.25,-.1,.26,.86,s*.75,-.7,[1.2,1.28,.85]);
      rod(o,[s*.12,1.65,0],[s*.3,1.95,-.14],.036,[1.2,1.25,.85],.15);
    }
    rod(o,[-.25,1.17,.04],[-.46,.91,.26],.095);rod(o,[-.46,.91,.26],[-.37,.92,.61],.07);
    rod(o,[.25,1.21,.04],[.44,1.06,.4],.11);
    shell(o,.43,1.12,.57,.19,.2,.48,[.8,.95,.65]);
    for(let i=0;i<4;i++) rod(o,[.43,1.23,.35+i*.17],[.43,1.46-i*.03,.32+i*.17],.06,[1.2,1.1,.75],0);
    return o;
  }
  function leg() {
    const o: number[]=[];
    rod(o,[0,.8,0],[.23,.54,-.3],.14);rod(o,[.23,.54,-.3],[.22,.12,.13],.065,[.8,.9,.7]);
    rod(o,[.22,.12,.13],[.22,.07,.43],.07,[1.2,1.2,.8],.25);return o;
  }
  function muzzle() { const o: number[]=[];cup(o,.32,.105,.13);return o; }
  registerEntityModel({id:'faction-1/unit/rifle',meshes:{choirThornlingBody:body,choirThornlingLeg:leg,choirThornlingMuzzle:muzzle},
    render({entity:e,part:p,metal,dark,team,nightLight=0,lightPool,pointLight}) {
      pointLight(0, 1.48, .3, 4, team, 1.5);
      p('choirThornlingBody',0,0,0,1,1,1,metal);
      for(const s of [-1,1]) p('choirThornlingLeg',s*.13,0,0,1,1,1,dark,s<0?Math.PI:0,Math.sin((e.walk||0)*7)*s*.2);
      p('choirThornlingMuzzle',.43,1.12,.9,1,1,1,dark,0,Math.PI/2);
      p('box',0,1.48,.235,.32,.09,.06,team,0,0,0,.55+1.85*nightLight);
      if (nightLight > 0) lightPool(0,1.3,1.8,2.3,team,.65*nightLight);
      p('octa',0,1.07,.16,.17,.24,.075,team,0,0,0,.32);
    }
  });
})();
