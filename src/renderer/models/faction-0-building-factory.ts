/* Faction 0 / building / factory. Heavy assembly hall; production exit is +Z.
   Fixed armor/exhausts are baked once. No moving crane, smoke or simulation state. */
'use strict';
(() => {
  function createFactoryHull() {
    const out: number[] = [], box = geom.box(), cylinder = geom.cylinder(10),
      metal = [1, 1, 1], dark = [.32, .4, .47], trim = [1.22, 1.22, 1.15];
    const panel = (x: number, y: number, z: number, w: number, h: number, d: number, bevel: number, tint = metal) =>
      ModelMesh.panel(out, { x, y, z, w, h, d, bevel, tint });
    const part = (x: number, y: number, z: number, sx: number, sy: number, sz: number, tint = metal, rz = 0) =>
      ModelMesh.bake(out, box, { x, y, z, sx, sy, sz, tint, rz });

    panel(0, .65, -.5, 6.45, 1.1, 4.7, .12, dark);
    panel(0, 3.5, -1, 6.3, .42, 4.8, .1);
    panel(0, 3.79, -1.02, 5.65, .18, 4.25, .045, dark);
    panel(0, 3.925, -.98, 4.95, .13, 3.65, .03);
    panel(0, 3.05, 1.46, 4.65, .34, .36, .08, trim);
    // Recessed rear wall and segmented blast shutter leave the forward bay open.
    part(0, 1.75, -2.7, 4.65, 2.15, .4, dark);
    for (let i = 0; i < 5; i++) part(0, 1.25 + i * .29, -2.484, 3.65, .2, .035, trim);
    for (const side of [-1, 1]) {
      panel(side * 2.67, 2, -.8, 1.14, 2.8, 4.9, .18);
      panel(side * 2.62, 1.85, 1.51, 1.02, 2.55, .38, .09, dark);
      part(side * 2.62, 1.86, 1.715, .52, 1.52, .04, metal);
      // Side cooling banks sit in dark wells, between robust shoulder plates.
      part(side * 3.247, 2.03, -.9, .016, 1.4, 2.8, dark);
      for (let i = 0; i < 7; i++) part(side * 3.259, 2.03, -2.04 + i * .38, .025, 1.21, .105, trim);
      for (const z of [-2.75, .78]) panel(side * 2.67, 3.49, z, 1.1, .27, .54, .065, trim);
      part(side * 1.73, 1.214, -.28, .08, .025, 3.45, trim);
    }
    // Roof intake with broad louvers, distinct from the barracks' paired banks.
    part(.75, 4.004, -.65, 1.75, .025, 2.25, dark);
    for (let i = 0; i < 6; i++) part(.75, 4.053, -1.54 + i * .35, 1.65, .065, .12, trim);
    // Closed, hollow-topped exhaust stubs: dark inner walls and recessed floors.
    const exhaust = (x: number, top: number, radius: number) => {
      const base = 3.62, z = -1.65, inner = radius * .65;
      const point = (i: number, r: number, y: number) => [x + Math.cos(i * Math.PI / 5) * r, y, z + Math.sin(i * Math.PI / 5) * r];
      for (let i = 0; i < 10; i++) {
        const a = point(i, radius, base), b = point(i + 1, radius, base),
          c = point(i, radius, top), d = point(i + 1, radius, top),
          e = point(i, inner, top), f = point(i + 1, inner, top),
          g = point(i, inner, top - .32), h = point(i + 1, inner, top - .32);
        geom.tri(out, a, c, d, dark); geom.tri(out, a, d, b, dark);
        geom.tri(out, c, e, f, trim); geom.tri(out, c, f, d, trim);
        geom.tri(out, e, g, h, dark); geom.tri(out, e, h, f, dark);
        geom.tri(out, [x, top - .32, z], h, g, [.18, .22, .27]);
        geom.tri(out, [x, base, z], a, b, dark);
      }
      for (const y of [3.77, top - .65])
        ModelMesh.bake(out, cylinder, { x, y, z, sx: radius * 1.13, sy: .14, sz: radius * 1.13, tint: trim });
    };
    exhaust(-2.5, 5.95, .36);
    exhaust(-1.45, 5.05, .31);
    // Fixed crane footing and cable; its safety-yellow beam remains separately tinted.
    panel(2.58, 4.08, -1.3, .7, .3, .7, .07, dark);
    part(2.58, 4.6, -1.3, .32, .98, .32, trim);
    part(.16, 4.45, -1.3, .045, 1.15, .045, dark);
    part(.28, 3.895, -1.3, .28, .09, .1, trim);
    return out;
  }

  registerEntityModel({
    id: 'faction-0/building/factory',
    meshes: { faction0FactoryHull: createFactoryHull },
    render({ part: p, metal, team, accent }) {
      p('faction0FactoryHull', 0, 0, 0, 1, 1, 1, metal);
      p('box', 0, 3.07, 1.657, 3.9, .1, .025, team, 0, 0, 0, .75);
      p('box', 0, 2.43, -2.451, 3.6, .1, .025, 0xed975d, 0, 0, 0, .5);
      for (const side of [-1, 1]) {
        p('box', side * 2.62, 2.28, 1.746, .39, .12, .025, accent, 0, 0, 0, .35);
        p('box', side * 3.278, 2.83, -.9, .025, .13, 2.2, team, 0, 0, 0, .3);
        for (let i = 0; i < 3; i++)
          p('box', side * 2.62, 1.35 + i * .21, 1.746, .44, .08, .025, accent, 0, 0, side * -.35);
      }
      // Open truss crane: two rails and diagonal braces instead of a glowing stick.
      for (const y of [4.9, 5.22]) p('box', 1.33, y, -1.3, 2.8, .09, .18, accent);
      for (let i = 0; i < 4; i++)
        p('box', .35 + i * .65, 5.06, -1.3, .055, .43, .12, accent, 0, 0, i % 2 ? -.9 : .9);
    }
  });
})();
