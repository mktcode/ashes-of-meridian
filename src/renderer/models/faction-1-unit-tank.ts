/* Rootbeast — low armored root quadruped with overlapping bark plates and a horn mortar. Geometry is baked once; animation never allocates meshes or consumes RNG. */
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
    shell(o,0,1.04,-.15,1.04,.58,1.12,[.8,.91,.75]);
    for(let i=0;i<4;i++) {
      shell(o,0,1.28,-.91+i*.49,1.03-i*.065,.43,.4,[1.12,1.05,.77]);
      for(const s of [-1,1]) rod(o,[s*.88,1.3,-.9+i*.49],[s*1.16,1.42,-1.03+i*.49],.13,[1.3,1.15,.8],0);
    }
    shell(o,0,.97,1,.65,.39,.53,[1.15,1.1,.85]);
    for(const s of [-1,1]) rod(o,[s*.46,1.1,1.1],[s*.42,1.5,1.57],.18,[1.4,1.3,.95],0);
    return o;
  }
  function leg() {const o: number[]=[];shell(o,0,.58,0,.3,.42,.36);rod(o,[0,.51,0],[.17,.14,.12],.22);for(let i=-1;i<=1;i++)rod(o,[.17+i*.13,.16,.12],[.17+i*.17,.05,.48],.095,[1.3,1.16,.82],.25);return o;}
  function muzzle() {const o: number[]=[];cup(o,.63,.25,.3);return o;}
  registerEntityModel({id:'faction-1/unit/tank',meshes:{choirRootbeastBody:body,choirRootbeastLeg:leg,choirRootbeastHorn:muzzle},
    render({entity:e,nightPart:p,metal,dark,team,pointLight}) {
      pointLight(0, 1.15, 1.5, 6, team, 2.5);
      p('choirRootbeastBody',0,0,0,1,1,1,metal);
      for(const s of [-1,1]) for(const f of [-1,1]) p('choirRootbeastLeg',s*.85,0,f*.69,1,1,1,dark,s<0?Math.PI:0,Math.sin((e.walk||0)*5+s*f)*.16);
      p('choirRootbeastHorn',0,1.11,1.13,1,1,1,dark,0,1.3);
      for(const s of [-1,1]) p('octa',s*.45,1.1,1.4,.12,.08,.1,team,0,0,0,.5);
      for(let i=0;i<3;i++) p('octa',0,1.72,-.65+i*.48,.19,.075,.14,team,0,0,0,.32);
    }
  });
})();
