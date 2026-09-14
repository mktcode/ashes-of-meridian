/* Faction 0 / building / hangar. Open +Z flight apron, fixed port control tower.
   Deck and armor are baked once; H marking, approach lights and glazing stay instanced. */
'use strict';
(() => {
  function createHangarHull() {
    const out: number[] = [], box = geom.box(), hex = geom.cylinder(6),
      metal = [1, 1, 1], dark = [.34, .42, .49], trim = [1.23, 1.25, 1.2];
    const panel = (x: number, y: number, z: number, w: number, h: number, d: number, bevel: number, tint = metal) =>
      ModelMesh.panel(out, { x, y, z, w, h, d, bevel, tint });
    const part = (x: number, y: number, z: number, sx: number, sy: number, sz: number, tint = metal) =>
      ModelMesh.bake(out, box, { x, y, z, sx, sy, sz, tint });

    panel(0, .66, -.5, 6.45, 1.12, 4.7, .13, dark);
    panel(0, 3.49, -1, 6.3, .44, 4.8, .11);
    panel(0, 3.77, -1.04, 5.65, .18, 4.22, .045, dark);
    panel(.18, 3.91, -.96, 4.74, .14, 3.57, .035);
    panel(0, 3.06, 1.45, 4.62, .28, .4, .07, trim);
    part(0, 1.7, -2.7, 4.65, 2.1, .4, dark);
    for (let i = 0; i < 5; i++) part(0, 1.18 + i * .3, -2.484, 3.7, .23, .03, metal);
    for (const side of [-1, 1]) {
      panel(side * 2.67, 2, -.8, 1.14, 2.8, 4.9, .19);
      panel(side * 2.64, 1.84, 1.53, .95, 2.45, .36, .085, dark);
      part(side * 2.64, 1.83, 1.727, .54, 1.53, .025, metal);
      // Long hangar shoulder rails, smaller than the foundry's cooling armor.
      panel(side * 2.66, 3.47, -.68, 1.02, .23, 3.9, .055, trim);
      part(side * 3.248, 1.8, -.7, .015, .86, 2.7, dark);
      for (let i = 0; i < 6; i++) part(side * 3.262, 1.8, -1.8 + i * .43, .025, .72, .09, trim);
    }
    // Same hexagonal apron footprint, two shallow deck levels and tie-down plates.
    ModelMesh.bake(out, hex, { y: .25, z: 3, sx: 3.1, sy: .14, sz: 3.1, tint: dark });
    ModelMesh.bake(out, hex, { y: .35, z: 3, sx: 2.94, sy: .06, sz: 2.94, tint: metal });
    for (const side of [-1, 1]) {
      for (const z of [2.3, 3.2, 4.1]) {
        part(side * 1.72, .393, z, .35, .025, .27, dark);
        part(side * 1.72, .412, z, .13, .014, .08, trim);
      }
      part(side * 1.03, .398, 3.18, .045, .025, 2.34, trim);
      // Nose access/maintenance modules do not extend the original deck outline.
      panel(side * 1.05, .34, 5.08, .7, .25, .44, .06, dark);
    }
    // Compact asymmetric control tower and roof service trunk.
    panel(-2.6, 4.48, -1.5, 1.15, 1.58, 1.1, .12);
    panel(-2.6, 5.23, -1.5, 1.27, .14, 1.2, .035, dark);
    panel(-2.6, 5.33, -1.5, .94, .08, .87, .02, trim);
    panel(.8, 4.065, -1.1, .72, .2, 2.45, .045, dark);
    for (let i = 0; i < 5; i++) part(.8, 4.185, -1.9 + i * .39, .55, .065, .12, trim);
    part(-.76, 4.008, -.88, .055, .025, 2.5, dark);
    return out;
  }

  registerEntityModel({
    id: 'faction-0/building/hangar',
    meshes: { faction0HangarHull: createHangarHull },
    render({ part: p, metal, team, accent }) {
      p('faction0HangarHull', 0, 0, 0, 1, 1, 1, metal);
      p('box', 0, 3.07, 1.667, 3.92, .095, .025, team, 0, 0, 0, .75);
      p('box', 0, 2.48, -2.458, 3.4, .12, .025, team, 0, 0, 0, .4);
      // Broad H plus paired approach lights, readable from the battle camera.
      for (const side of [-1, 1]) {
        p('box', side * .65, .407, 3.25, .14, .025, 1.8, team, 0, 0, 0, .2);
        for (const z of [2.2, 3.3, 4.4])
          p('box', side * 1.95, .406, z, .19, .035, .22, team, 0, 0, 0, .65);
        p('box', side * 2.64, 2.36, 1.753, .44, .105, .025, accent, 0, 0, 0, .3);
        p('box', side * 2.66, 3.601, -.68, .08, .025, 2.85, team, 0, 0, 0, .25);
      }
      p('box', 0, .407, 3.25, 1.3, .025, .14, team, 0, 0, 0, .2);
      p('box', -2.6, 4.91, -.938, .81, .3, .025, team, 0, 0, 0, .65);
      p('box', -3.188, 4.91, -1.5, .025, .3, .68, team, 0, 0, 0, .5);
      p('box', -2.6, 5.383, -1.5, .22, .035, .22, accent, 0, 0, 0, .4);
    }
  });
})();
