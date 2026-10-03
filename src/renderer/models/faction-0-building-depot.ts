/* Fraktion 0 / building / depot: paired reinforced cargo modules, unchanged footprint. */
'use strict';
(() => {
  function hull() {
    const out: number[] = [], box = geom.box(), bolt = geom.cylinder(6),
      dark = [.42, .47, .51], edge = [1.23, 1.2, 1.12];
    const panel = (x: number,y: number,z: number,w: number,h: number,d: number,b: number,tint: number[]) => ModelMesh.panel(out,{x,y,z,w,h,d,bevel:b,tint});
    const part = (mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],rx=0) => ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,rx});
    for (const side of [-1,1]) {
      const x = side*1.05;
      panel(x,1,0,1.85,1.8,3.3,.12,[1,1,1]);
      panel(x,1.94,0,1.93,.18,3.4,.04,dark);
      panel(x,2.04,0,1.62,.12,3.06,.025,edge);
      // Recessed end panels, cargo-door seam, corner castings and locking bars.
      for (const z of [-1.666,1.666]) {
        part(box,x,.98,z,1.42,1.35,.035,dark);
        for (const dx of [-.5,.5]) part(box,x+dx,.98,z*1.013,.055,1.21,.035,edge);
        part(box,x,.98,z*1.014,.035,1.35,.035,[1,1,1]);
        for (const dx of [-.7,.7]) for (const y of [.27,1.71])
          part(bolt,x+dx,y,z*1.015,.07,.055,.07,edge,Math.PI/2);
      }
      for (let j=-2;j<=2;j++) {
        for (const dx of [-.935,.935])
          panel(x+dx,1,j*.58,.09,1.54,.16,.022,edge);
        part(box,x,2.113,j*.58,1.3,.025,.065,dark);
      }
      panel(x,.22,0,1.95,.24,3.4,.055,dark);
    }
    return out;
  }
  registerEntityModel({
    id: 'faction-0/building/depot', meshes: { faction0DepotHull: hull },
    render({part:p,metal,team,accent,nightLight=0}) {
      const glow=(base=0)=>base+(3.2-base)*nightLight;
      p('faction0DepotHull',0,0,0,1,1,1,metal);
      for (const side of [-1,1]) {
        p('box',side*1.05,1.43,1.699,1.1,.17,.035,team,0,0,0,glow(.5));
        p('box',side*1.05,2.133,0,.16,.025,2.72,accent,0,0,0,glow());
        for (const dx of [-.62,.62]) p('box',side*1.05+dx,.54,1.703,.18,.055,.035,accent,0,0,0,glow());
      }
    }
  });
})();
