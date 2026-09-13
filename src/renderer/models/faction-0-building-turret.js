/* Fraktion 0 / building / turret: isolated procedural assembly. */
'use strict';
registerEntityModel({
  id: 'faction-0/building/turret',
  render({ entity: e, time, part: p, ring, metal, dark, team, accent, baseRotation }) {
    p('turretBase', 0, 0, 0, 1, 1, 1, metal);
    // Keep the aiming head independent of the fixed foundation orientation.
    const aim = (e.rot || 0) - baseRotation,
      ac = Math.cos(aim),
      as = Math.sin(aim);
    const head = (x, y, z, sx, sy, sz, c, glow = 0) =>
      p('box', x * ac + z * as, y, -x * as + z * ac, sx, sy, sz, c, aim, 0, 0, glow);
    p('turretHead', 0, 0, 0, 1, 1, 1, metal, aim);
    head(0, 2.3, 0.827, 0.35, 0.25, 0.025, team, 1.2);
    for (const side of [-1, 1]) {
      head(side * .985, 2.32, -.10, .025, .085, .48, team, .35);
      head(side * .80, 2.568, -.1, .12, .025, .36, accent);
    }
  }
});
