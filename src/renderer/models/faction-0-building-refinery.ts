/* Fraktion 0 / building / refinery: twin pressure columns and a retained rotating aether core. */
'use strict';
(() => {
  function hull() {
    const out: number[]=[], box=geom.box(), pipe=geom.cylinder(16), cap=geom.cylinder(12,0),
      dark=[.4,.46,.5], edge=[1.23,1.2,1.12];
    const part=(mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],rx=0,rz=0)=>ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,rx,rz});
    ModelMesh.panel(out,{x:0,y:.45,z:0,w:4.3,h:.7,d:3.2,bevel:.14,tint:[1,1,1]});
    for(const side of [-1,1]) {
      const h=side<0?4.5:3.5, x=side*1.13;
      part(pipe,x,h*.5+.5,-.15,.85,h,.85,[1,1,1]);
      part(pipe,x,h+.55,-.15,1,.17,1,dark);
      part(cap,x,h+.95,-.15,.55,.7,.55,dark);
      for(const y of [.83,h*.43,h+.34]) part(pipe,x,y,-.15,.9,.11,.9,edge);
      // Weld ribs stop at the shoulder; no additional silhouette-height change.
      for(let j=0;j<8;j++) {
        const a=j*Math.PI/4;
        part(box,x+Math.sin(a)*.847,h*.48+.5,-.15+Math.cos(a)*.847,.055,h*.82,.055,edge);
      }
      part(pipe,x,.94,1.08,.24,1.76,.24,dark,Math.PI/2);
      part(pipe,x,.94,1.81,.31,.13,.31,edge,Math.PI/2);
      part(pipe,x,1.05,1.65,.07,.47,.07,edge);
      part(pipe,x,1.29,1.65,.24,.065,.24,dark);
      ModelMesh.panel(out,{x,y:.78,z:-.15,w:1.87,h:.22,d:1.84,bevel:.05,tint:dark});
    }
    part(pipe,0,2.2,-.3,.14,2.3,.14,dark,0,Math.PI/2);
    part(pipe,0,1.23,1.1,.55,.17,.5,dark);
    for(const side of [-1,1]) {
      part(box,side*.66,1.92,1.1,.11,1.32,.14,edge);
      part(box,side*.53,2.59,1.1,.37,.1,.21,dark);
    }
    return out;
  }
  registerEntityModel({
    id:'faction-0/building/refinery', meshes:{faction0RefineryHull:hull},
    render({part:p,time,metal,dark,team,accent,nightLight=0}) {
      const glow=(base=0)=>base+(3.2-base)*nightLight;
      p('faction0RefineryHull',0,0,0,1,1,1,metal);
      for(const side of [-1,1]) {
        const h=side<0?4.5:3.5;
        p('cylinder',side*1.13,h*.6,-.15,.88,.25,.88,team,0,0,0,glow(.8));
        p('box',side*1.13,1.325,1.65,.32,.035,.07,accent,0,0,0,glow());
        p('box',side*1.13,.822,-1.25,.65,.03,.22,accent,0,0,0,glow());
      }
      p('octa',0,2.1,1.1,.55,1.2,.5,0x8ff0de,time*.22,0,0,glow(1));
    }
  });
})();
