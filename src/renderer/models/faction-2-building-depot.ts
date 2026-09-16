/* Votive Pillar: a compact segmented Aether accumulator held by four ritual contacts. */
'use strict';
(() => {
  const pale=[1,1,1], dark=[.31,.30,.39], trim=[1.12,1.09,1.05];
  function terrace(out: number[]) {
    const n=16, point=(i: number,r: number,y: number)=>{
      const a=i/n*Math.PI*2+.196, tooth=i%4===0?1.2:i%4===2?.94:1.04;
      return [Math.sin(a)*r*tooth,y,Math.cos(a)*r*tooth];
    };
    const levels=[[1.82,.07],[1.82,.23],[1.62,.25],[1.62,.43],[1.36,.45]];
    for(let i=0;i<n;i++) {
      const k=(i+1)%n;
      for(let j=0;j<levels.length-1;j++) {
        const [ra,ya]=levels[j],[rb,yb]=levels[j+1],tint=j<2?dark:trim,
          a=point(i,ra,ya),b=point(k,ra,ya),c=point(k,rb,yb),d=point(i,rb,yb);
        geom.tri(out,a,d,c,tint);geom.tri(out,a,c,b,tint);
      }
      geom.tri(out,[0,.45,0],point(i,levels[4][0],.45),point(k,levels[4][0],.45),dark);
      geom.tri(out,[0,.07,0],point(k,levels[0][0],.07),point(i,levels[0][0],.07),dark);
    }
  }
  function hull() {
    const out: number[]=[], box=geom.box();terrace(out);
    const part=(mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],ry=0)=>
      ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,ry});
    // Armored collar, chamber separators and vertical cage ribs.
    part(geom.cylinder(8),0,.68,0,1.28,.26,1.28,pale,Math.PI/8);
    for(const y of [1.05,2.25,2.48,3.68]) part(geom.cylinder(10),0,y,0,1.08,.13,1.08,dark);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      for(const y of [1.64,3.08]) part(box,Math.sin(a)*.91,y,Math.cos(a)*.91,.045,.9,.045,trim,a);
    }
    // A shallow pale cap closes the storage stack without another spire or crystal.
    part(geom.cylinder(8),0,3.84,0,.88,.18,.88,pale,Math.PI/8);
    return out;
  }
  function charge() {
    const out: number[]=[],n=12;
    for(let i=0;i<n;i++) {
      const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,
        p=[Math.sin(a),-.5,Math.cos(a)],q=[Math.sin(b),-.5,Math.cos(b)],
        r=[Math.sin(b),.5,Math.cos(b)],s=[Math.sin(a),.5,Math.cos(a)],shade=[.84+.12*(i%3),.72,.98];
      geom.tri(out,p,s,r,shade);geom.tri(out,p,r,q,shade);
    }
    return out;
  }
  registerEntityModel({
    id:'faction-2/building/depot',
    meshes:{faction2DepotHull:hull,faction2DepotCharge:charge},
    render({entity:e,part:p,metal,team,surfaceColor}) {
      const s=(e.size||2.3)/2.3,energy=surfaceColor(0x9a68ee);
      p('faction2DepotHull',0,0,0,s,1,s,metal);
      for(const [y,h] of [[1.65,.98],[3.07,.98]])
        p('faction2DepotCharge',0,y,0,.92*s,h,.92*s,energy,0,0,0,0,undefined,PORTAL_MATERIAL);
      p('octa',0,.78,0,.18*s,.26,.18*s,team,0,0,0,.45);
    }
  });
})();
