/* Absolver — suspended healing censer in an open reliquary, with three counterweight pendulums. Geometry is baked once; animation never allocates meshes or consumes RNG. */
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
  // Faceted annular frame in X/Y, with closed ends; not a glowing billboard.
  function arc(out: number[], radius: number, width: number, depth: number, start: number, end: number, y=0, z=0, tint=[1,1,1]) {
    const steps=24, point=(a: number,r: number,d: number)=>[Math.cos(a)*r,y+Math.sin(a)*r,z+d];
    for(let i=0;i<steps;i++) {
      const a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps;
      const A=point(a,radius-width,-depth/2), B=point(b,radius-width,-depth/2), C=point(b,radius,-depth/2), D=point(a,radius,-depth/2),
        E=point(a,radius-width,depth/2), F=point(b,radius-width,depth/2), G=point(b,radius,depth/2), H=point(a,radius,depth/2);
      const quad=(p: number[],q: number[],r: number[],s: number[])=>{geom.tri(out,p,q,r,tint);geom.tri(out,p,r,s,tint);};
      quad(A,B,C,D);quad(E,H,G,F);quad(D,C,G,H);quad(A,E,F,B);
      if(i===0) quad(A,D,H,E);if(i===steps-1) quad(B,F,G,C);
    }
  }

  function frame() {
    const o: number[]=[];
    arc(o,.91,.14,.16,-.33,Math.PI+.33,1.04,0);
    for(const s of [-1,1]) panel(o,s*.86,1.01,0,.22,.29,.28);
    panel(o,0,2.04,0,.18,.21,.23,[1.25,1.2,1]);
    for(const s of [-1,1]) rod(o,[s*.48,1.75,0],[s*.25,1.18,0],.033,[.65,.65,.75]);
    return o;
  }
  function censer() {
    const o: number[]=[];
    ModelMesh.bake(o,geom.cylinder(10,.57),{y:.74,sx:.4,sy:.49,sz:.4});
    ModelMesh.bake(o,geom.cylinder(10,.3),{y:1.08,sx:.4,sy:.21,sz:.4,tint:[1.2,1.15,1]});
    for(let i=0;i<10;i++) {const a=i*Math.PI/5;rod(o,[Math.cos(a)*.38,.74,Math.sin(a)*.38],[Math.cos(a)*.28,1.14,Math.sin(a)*.28],.025,[.52,.54,.63]);}
    return o;
  }
  function pendulum() {const o: number[]=[];rod(o,[0,0,0],[0,-.32,0],.018);ModelMesh.bake(o,geom.octa(),{y:-.38,sx:.07,sy:.12,sz:.07});return o;}
  registerEntityModel({id:'faction-2/unit/medic',meshes:{courtAbsolverFrame:frame,courtAbsolverCenser:censer,courtAbsolverPendulum:pendulum},
    render({time,part:p,metal,dark,team,surfaceColor:c,nightLight=0,lightPool}) {
      p('courtAbsolverFrame',0,0,0,1,1,1,metal);p('courtAbsolverCenser',0,0,0,1,1,1,metal);
      for(let i=0;i<3;i++) {const a=i*2*Math.PI/3;p('courtAbsolverPendulum',Math.cos(a)*.21,.62,Math.sin(a)*.21,1,1,1,metal,0,Math.sin(time*1.4+i)*.08);}
      p('octa',0,1.33,0,.18,.28,.18,team,time*.22,0,0,.6);
      for(const s of [-1,1]) p('box',s*.86,1.03,.15,.1,.12,.035,c(0x79d9e3),0,0,0,.5+1.9*nightLight);
      if (nightLight > 0) lightPool(0,1.1,2.2,2.3,0x79d9e3,.65*nightLight);
    }
  });
})();
