/* Fraktion 0 / building / hq: isolated procedural assembly. */
'use strict';
(() => {
function fittings() {
  const out: number[]=[], box=geom.box(), bolt=geom.cylinder(6), dark=[.4,.45,.5];
  ModelMesh.panel(out,{x:0,y:3.6,z:-.55,w:1.32,h:.12,d:1.48,bevel:.028,tint:dark});
  ModelMesh.panel(out,{x:0,y:3.68,z:-.55,w:1.12,h:.09,d:1.28,bevel:.02,tint:[1.18,1.15,1.1]});
  for(let j=-2;j<=2;j++) ModelMesh.bake(out,box,{x:0,y:3.731,z:-.55+j*.2,sx:.78,sy:.018,sz:.055,tint:dark});
  for(const x of [-.48,.48]) for(const z of [-1.08,-.02])
    ModelMesh.bake(out,bolt,{x,y:3.742,z,sx:.045,sy:.025,sz:.045,tint:dark});
  return out;
}
registerEntityModel({
  id: 'faction-0/building/hq', meshes: { faction0HqFittings: fittings },
  render({ entity: e, time, part: p, ring, metal, dark, team, accent, baseRotation, nightLight=0, pointLight }) {
    // Two deliberately broad, shadowless light islands. Positions follow the shared
    // foundation frame; daytime, unfinished HQs and placement ghosts never register lights.
    if (nightLight > 0) {
      pointLight(0, 2.8, 3.3, 14, 0x75dce9, 5);
      pointLight(1.6, 4.8, -1.4, 10, 0xffb65e, 4);
    }
    const glow=(base=0)=>base+(5-base)*nightLight;
    p('commandHull', 0, 0, 0, 1, 1, 1, metal);
    p('faction0HqFittings', 0, 0, 0, 1, 1, 1, metal);
    p('box', 0, 2.5, 2.35, 5.6, 0.23, 0.12, team, 0, 0, 0, glow(0.7));
    p('box', 0, 1.05, 2.39, 2.2, 1.9, 0.11, dark);
    p('box', 0, 0.4, 3.05, 2.7, 0.3, 1.3, 0x82918f, 0, -0.15);
    for (let i = -1; i <= 1; i++) {
      p('box', i * 0.65, 0.58, 3.1, 0.28, 0.03, 1.1, accent, 0.2, 0, 0, glow());
      p('box', i * 1.4, 1.8, 2.41, 0.7, 0.48, 0.12, 0x81c5cf, 0, 0, 0, glow(0.6));
    }
    // Door seam, armored entry lights, roof inlays and recessed cooling grilles.
    p('box', 0, 1.05, 2.46, 0.09, 1.9, 0.06, metal);
    for (const side of [-1, 1]) {
      p('box', side * 2.23, 2.61, 2.635, 0.43, 0.10, 0.03, accent, 0, 0, 0, glow(0.3));
      p('box', side * 2.23, 1.40, 2.616, 0.37, 1.12, 0.035, dark);
      p('box', side * 2.23, 1.69, 2.64, 0.22, 0.07, 0.025, team, 0, 0, 0, glow(0.5));
      p('box', side * 1.91, 3.552, -0.40, 0.045, 0.018, 1.86, accent, 0, 0, 0, glow());
      for (const z of [-1.29, .49])
        p('box', side * 1.91, 3.568, z, 0.13, 0.03, 0.13, accent, 0, 0, 0, glow());
      p('box', side * 2.94, 2.765, -.35, 0.20, 0.025, 2.25, dark);
      for (let j = 0; j < 6; j++)
        p('box', side * 2.94, 2.790, j * .34 - 1.18, 0.20, 0.025, 0.055, metal);
    }
    p('box', -1.7, 4.0, -1.2, 1.5, 1.3, 1.5, dark);
    p('box', -1.7, 4.58, -1.2, 1.65, 0.17, 1.65, team, 0, 0, 0, glow(0.7));
    p('cylinder', -1.7, 5.4, -1.2, 0.06, 1.6, 0.06, metal);
    for (const side of [-1, 1]) {
      p('cylinder', -1.7 + side * .58, 5.45, -1.55, 0.035, 1.55, 0.035, dark);
      p('sphere', -1.7 + side * .58, 6.255, -1.55, 0.055, 0.055, 0.055, team, 0, 0, 0, glow(0.45));
    }
    p('cone', -1.7, 5.65, -1.2, 0.55, 0.3, 0.55, metal, time * 0.13, 0.8);
    p('sphere', -1.7, 6.23, -1.2, 0.12, 0.12, 0.12, accent, 0, 0, 0, glow(1.5));
    p('box', 1.6, 3.9, -1.4, 1.1, 1.1, 1.1, metal);
    p('box', 1.6, 4.48, -1.4, 0.85, 0.1, 0.85, accent, 0, 0, 0, glow(0.7));
  }
});
})();
