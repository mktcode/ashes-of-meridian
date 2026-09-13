/* Fraktion 1 / building / hangar. Chrysalis: a shallow six-petal flight collar under the existing effect ring. */
'use strict';
(() => {
  function hull() {
    const out=[], s=3.8, h=3.8, cone=geom.cylinder(7,0), collar=geom.cylinder(8), octa=geom.octa(),
      dark=[.48,.58,.58], edge=[1.2,1.22,1.12];
    const part=(mesh,x,y,z,sx,sy,sz,tint,ry=0,rx=0,rz=0)=>ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,ry,rx,rz});
    const shell=(x,y,z,sx,sy,sz,tint)=>ModelMesh.lobedShell(out,{x,y,z,sx,sy,sz,lobes:3,segments:12,rings:6,tint});
    ModelMesh.lobedShell(out,{x:0,y:h*.44,z:0,sx:s*.8,sy:h*.57,sz:s*.78});
    // Six old root positions and lean angles, now with growth rings baked once.
    const root=[];
    ModelMesh.bake(root,cone,{sx:.5,sy:2,sz:.5,tint:dark});
    for(const y of [-.6,-.05,.45]) ModelMesh.bake(root,collar,{y,sx:(1-y)*.25+.035,sy:.075,sz:(1-y)*.25+.035,tint:edge});
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      ModelMesh.bake(out,root,{x:Math.sin(a)*s*.8,y:.7,z:Math.cos(a)*s*.8,ry:a,rx:.25,rz:.42});
    }
    // Six segmented meridian ribs sit just above the shell, like overlapping chitin seams.
    for(let i=0;i<6;i++) for(let j=0;j<6;j++) {
      const a=(i+.5)*Math.PI/3;
      const point=b=>{const r=Math.sin(b)*(1-.055*Math.sin(b))+.04;
        return [Math.cos(a)*s*.8*r,h*.44+Math.cos(b)*h*.57,Math.sin(a)*s*.78*r];};
      const [x,y,z]=point(.62+j/6*1.82),[u,v,w]=point(.62+(j+1)/6*1.82),dx=u-x,dy=v-y,dz=w-z;
      part(octa,(x+u)/2,(y+v)/2,(z+w)/2,.055,Math.hypot(dx,dy,dz)/2+.012,.055,edge,Math.atan2(dx,dz),Math.atan2(Math.hypot(dx,dz),dy));
    }
    const leaf=[];
    ModelMesh.lobedShell(leaf,{x:0,y:0,z:0,sx:s*.23,sy:h*.12,sz:s*.31,lobes:3,segments:12,rings:5,tint:edge});
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      ModelMesh.bake(out,leaf,{x:Math.sin(a)*s*.61,y:h*.55,z:Math.cos(a)*s*.61,ry:a});
      part(octa,Math.sin(a)*s*.68,h*.76,Math.cos(a)*s*.68,.13,h*.16,.22,dark,a,.3);
    }
    return out;
  }
  registerEntityModel({
    id:'faction-1/building/hangar', meshes:{faction1HangarHull:hull},
    render({entity:e,time,part:p,ring,metal,dark,team,accent}) {
      const s=e.size||3, h=3.8;
      p('faction1HangarHull',0,0,0,s/3.8,1,s/3.8,metal);
      p('octa',0,h*.77,0,s*.5,h*.65,s*.5,dark,.3);
      for(let i=0;i<6;i++) {
        const a=i*Math.PI/3;
        p('sphere',Math.sin(a)*s*.8*.8,h*.63,Math.cos(a)*s*.8*.8,.45,.8,.45,team,a,0,.3,.28);
      }
      // Preserve the original phase, bob, colors and frequency; drawing consumes no RNG.
      p('octa',0,h+Math.sin(time+e.id)*.14,0,s*.3,1.3,s*.3,accent,time*.22,0,0,.85);
      ring(s*.8,h*.9,accent,.7);
    }
  });
})();
