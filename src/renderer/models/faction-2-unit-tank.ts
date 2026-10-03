/* Sepulcher — low hovering sarcophagus with armored side runners and a broad split-rail turret. Geometry is baked once; animation never allocates meshes or consumes RNG. */
'use strict';
(() => {
  function panel(out: number[], x: number, y: number, z: number, w: number, h: number, d: number, tint=[1,1,1]) {
    ModelMesh.panel(out,{x,y,z,w,h,d,bevel:Math.min(w,h,d)*.16,tint});
  }

  function hull() {
    const o: number[]=[];
    panel(o,0,.55,0,1.68,.48,2.6,[.7,.7,.8]);panel(o,0,.83,-.15,1.39,.22,2.32);
    for(const s of [-1,1]) {
      panel(o,s*1.03,.57,-.09,.48,.6,2.65);panel(o,s*1.03,.32,-.14,.38,.12,2.44,[.38,.39,.49]);
      for(let i=0;i<5;i++) {panel(o,s*1.03,.9,-1+i*.47,.51,.1,.12,[1.18,1.16,1.1]);panel(o,s*1.29,.62,-.98+i*.47,.035,.17,.21,[.55,.55,.62]);}
    }
    panel(o,0,1.05,-.3,.98,.37,1.29);panel(o,0,1.26,-.41,.8,.1,.99,[1.15,1.13,1.06]);
    for(const s of [-1,1]) {panel(o,s*.23,1.13,.98,.21,.19,1.67);panel(o,s*.23,1.04,1.03,.11,.06,1.47,[.48,.48,.59]);}
    panel(o,0,1.15,.43,.23,.22,.29,[.46,.46,.55]);return o;
  }
  registerEntityModel({id:'faction-2/unit/tank',meshes:{courtSepulcherHull:hull},
    render({nightPart:p,metal,team,surfaceColor:c,pointLight}) {
      pointLight(0, 1.2, 1.5, 6, 0x79d9e3, 2.5);
      p('courtSepulcherHull',0,0,0,1,1,1,metal);
      for(const s of [-1,1]) {
        p('box',s*1.03,.285,-.06,.21,.06,1.96,team,0,0,0,.5);
        p('box',s*.116,1.15,.95,.034,.048,1.32,c(0x79d9e3),0,0,0,.55);
      }
      p('octa',0,1.37,-.44,.23,.08,.31,team,0,0,0,.4);
    }
  });
})();
