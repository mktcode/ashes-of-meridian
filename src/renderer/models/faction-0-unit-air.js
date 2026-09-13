/* Fraktion 0 / unit / air: isolated assembly. */
'use strict';
registerEntityModel({
  id: 'faction-0/unit/air',
  render({entity:e,time,part:p,metal,dark,team,accent,surfaceColor}) {
    p('octa', 0, 0.65, 0.25, 0.7, 0.43, 2.2, metal);
    p('box', 0, 0.85, 0.75, 0.47, 0.24, 0.9, 0x81bdcc, 0, 0, 0, 0.4);
    for (let i of [-1, 1]) {
      p('octa', i * 1.35, 0.45, -0.18, 1.6, 0.12, 1.1, metal, 0, 0, i * 0.06);
      p('box', i * 1.05, 0.32, -0.55, 0.53, 0.56, 1.8, dark);
      p('cylinder', i * 1.05, 0.3, -1.48, 0.23, 0.12, 0.23, accent, 0, Math.PI / 2, 0, 1.3);
      p('box', i * 0.66, 0.38, 1.1, 0.16, 0.2, 1.1, dark);
      p('box', i * 0.42, 1.13, -1.2, 0.15, 0.7, 0.8, metal, 0, 0.18, i * 0.27);
    }
    p('sphere', 0, 0.94, -0.2, 0.09, 0.08, 0.09, team, 0, 0, 0, 1.4);
  }
});
