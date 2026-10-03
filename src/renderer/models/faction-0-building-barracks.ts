/* Faction 0 / building / barracks. Front/production exit: local +Z.
   Fixed armor is baked once; team markings and lamps keep instance tint/glow. */
'use strict';
(() => {
  function createBarracksHull() {
    const out: number[] = [], box = geom.box(), metal = [1, 1, 1], dark = [.35, .43, .49],
      trim = [1.22, 1.22, 1.16];
    const panel = (x: number, y: number, z: number, w: number, h: number, d: number, bevel: number, tint = metal) =>
      ModelMesh.panel(out, { x, y, z, w, h, d, bevel, tint });
    const part = (x: number, y: number, z: number, sx: number, sy: number, sz: number, tint = metal) =>
      ModelMesh.bake(out, box, { x, y, z, sx, sy, sz, tint });

    panel(0, 1.4, -.12, 4.8, 2.25, 3.7, .18);
    panel(0, 2.73, -.15, 5.05, .36, 3.98, .09, dark);
    panel(0, 3, -.25, 4.4, .22, 3.35, .06);
    // Deep door recess behind two armored jambs and a projecting lintel.
    part(0, 1.25, 1.77, 2.08, 1.82, .08, [.24, .32, .4]);
    part(0, 1.25, 1.823, .07, 1.82, .035, trim);
    panel(0, 2.52, 1.91, 3.08, .3, .68, .075, trim);
    part(0, .28, 2.03, 1.85, .12, .44, dark);
    part(0, .355, 1.96, 1.68, .03, .3, trim);
    for (const side of [-1, 1]) {
      panel(side * 1.28, 1.35, 1.85, .45, 2.3, .7, .085);
      panel(side * 2.7, 1.17, -.28, .65, 1.98, 3.25, .12, dark);
      for (let i = 0; i < 3; i++)
        panel(side * 2.7, 2.25, -1.35 + i * .95, .72, .3, .48, .07);
      // Roof cooling banks: dark wells with seven broad, raised slats each.
      part(side * 1.52, 3.127, -.25, .65, .028, 2.5, dark);
      for (let i = 0; i < 7; i++)
        part(side * 1.52, 3.17, -1.32 + i * .35, .6, .07, .1, trim);
      part(side * 1.28, 1.32, 2.212, .16, 1.42, .025, dark);
    }
    // Longitudinal armor spine, service hatch and a short comms housing.
    panel(0, 3.28, -.2, .7, .4, 2.78, .085);
    panel(.78, 3.18, .6, .8, .11, .6, .025, dark);
    panel(.9, 3.35, -1.27, .7, .45, .75, .08);
    ModelMesh.bake(out, geom.cylinder(10), {
      x: -2, y: 3.65, z: -1.3, sx: .045, sy: 1.7, sz: .045, tint: metal
    });
    return out;
  }

  registerEntityModel({
    id: 'faction-0/building/barracks',
    meshes: { faction0BarracksHull: createBarracksHull },
    render({ part: p, metal, team, accent, nightLight=0 }) {
      const glow=(base=0)=>base+(3.2-base)*nightLight;
      p('faction0BarracksHull', 0, 0, 0, 1, 1, 1, metal);
      // Front lintel, flanking entry lights and roof stripes read at battle zoom.
      p('box', 0, 2.53, 2.256, 2.18, .095, .025, team, 0, 0, 0, glow(.8));
      for (const side of [-1, 1]) {
        p('box', side * 1.28, 1.88, 2.23, .17, .09, .025, accent, 0, 0, 0, glow(.4));
        p('box', side * 2.35, 2.922, -.38, .07, .025, 2.3, team, 0, 0, 0, glow(.25));
        p('box', side * 2.705, 1.55, 1.359, .4, .26, .025, team, 0, 0, 0, glow(.25));
      }
      p('box', .9, 3.585, -1.27, .42, .035, .4, accent, 0, 0, 0, glow(.35));
      p('box', -1.62, 4.1, -1.3, .8, .6, .035, team, 0, 0, 0, glow());
    }
  });
})();
