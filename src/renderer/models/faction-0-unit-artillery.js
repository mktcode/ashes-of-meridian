/* Fraktion 0 / unit / artillery: isolated assembly. */
'use strict';
registerEntityModel({
  id: 'faction-0/unit/artillery',
  render({entity:e,time,part:p,metal,dark,team,accent,surfaceColor}) {
    const ty = 'artillery';
    p('box', 0, 0.75, 0, 2.3, 0.85, 3.0, metal);
    for (let i of [-1, 1]) {
      p('box', i * 1.35, 0.57, 0, 0.66, 0.83, 3.25, dark);
      p('box', i * 1.35, 1.08, 0, 0.73, 0.18, 3.5, metal);
      for (let j = -2; j <= 2; j++)
        p('cylinder', i * 1.55, 0.48, j * 0.61, 0.31, 0.22, 0.31, 0x697a7f, 0, 0, Math.PI / 2);
      p('box', i * 1.35, 1.2, 0.5, 0.18, 0.08, 1.6, team, 0, 0, 0, 0.3);
    }
    p('hex', 0, 1.48, -0.25, 1.03, 0.8, 0.95, metal, 0.25);
    p('box', 0, 1.95, -0.33, 1.3, 0.18, 1.3, dark);
    if (ty === 'tank') {
      p('box', 0, 1.63, 1.25, 0.35, 0.35, 2.3, dark);
      p('box', 0, 1.63, 2.48, 0.53, 0.47, 0.42, metal);
      p('box', 0, 1.63, 2.7, 0.28, 0.23, 0.02, 0x18242f);
    } else {
      p('box', 0, 2.15, 0.9, 0.48, 0.45, 3.65, dark, 0, -0.23);
      p('box', 0, 2.59, 2.68, 0.7, 0.63, 0.55, metal, 0, -0.23);
      for (let i of [-1, 1]) p('box', i * 0.67, 1.8, -1.25, 0.5, 0.9, 0.9, accent);
    }
    p('box', -0.45, 2.08, -0.35, 0.44, 0.1, 0.6, team, 0, 0, 0, 0.4);
  }
});
