/* Sporecaller — heavy slug, coiled ribbed shell and a flared forward spore trumpet. Geometry is baked once; animation never allocates meshes or consumes RNG. */
'use strict';
(() => {
  function shell(out: number[], x: number, y: number, z: number, sx: number, sy: number, sz: number, tint=[1,1,1]) {
    // Small mantle lobes do not need the tessellation of the large spiral shell.
    const small=Math.max(sx,sy,sz)<.3;
    ModelMesh.lobedShell(out,{x,y,z,sx,sy,sz,lobes:4,segments:small?16:24,rings:small?6:10,depth:.035,tint});
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
    const o: number[]=[];shell(o,0,.4,.04,.82,.34,1.38,[.85,1,.77]);shell(o,0,.62,.99,.57,.36,.53);
    for(const s of [-1,1]) {rod(o,[s*.28,.8,1.17],[s*.38,1.12,1.42],.06,[1.25,1.25,.8]);
      for(let i=0;i<7;i++) shell(o,s*.69,.3,-.93+i*.31,.21,.13,.21,[.9,1.1,.72]);}
    return o;
  }
  function coil() {
    const o: number[]=[];
    shell(o,0,1.22,-.41,.69,.87,.87,[1.1,.89,.65]);
    for(const s of [-1,1]) for(let i=0;i<28;i++) {
      const a=i*.3, b=(i+1)*.3, r=.76-i*.019, r2=.76-(i+1)*.019;
      rod(o,[s*(.53+i*.004),1.22+Math.sin(a)*r,-.41+Math.cos(a)*r],
        [s*(.53+(i+1)*.004),1.22+Math.sin(b)*r2,-.41+Math.cos(b)*r2],.055,[1.3,1.16,.86]);
    }
    return o;
  }
  function trumpet() {const o: number[]=[];cup(o,1.1,.24,.58);for(let i=0;i<8;i++){const a=i*Math.PI/4;rod(o,[Math.cos(a)*.24,.12,Math.sin(a)*.24],[Math.cos(a)*.56,1.07,Math.sin(a)*.56],.037,[1.3,1.13,.87]);}return o;}
  registerEntityModel({id:'faction-1/unit/artillery',meshes:{choirSporecallerBody:body,choirSporecallerCoil:coil,choirSporecallerTrumpet:trumpet},
    render({entity:e,nightPart:p,metal,team,surfaceColor:c,pointLight}) {
      pointLight(0, 1.2, 1.5, 6, team, 2.5);
      p('choirSporecallerBody',0,0,0,1,1,1,metal);
      p('choirSporecallerCoil',0,0,0,1,1,1,c(0x877451));
      p('choirSporecallerTrumpet',0,1.24,.46,1,1,1,c(0xc995b3),0,.62);
      for(const s of [-1,1]) p('octa',s*.38,1.12,1.42,.1,.08,.09,team,0,0,0,.4);
      p('octa',0,1.39,.53,.2,.2,.2,team,0,0,0,.5);
    }
  });
})();
