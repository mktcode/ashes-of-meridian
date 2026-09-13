/* Fraktion 0 / building / refinery: isolated procedural assembly. */
'use strict';
registerEntityModel({
  id: 'faction-0/building/refinery',
  render({ entity: e, time, part: p, ring, metal, dark, team, accent, baseRotation }) {
    p('box', 0, 0.45, 0, 4.3, 0.7, 3.2, metal);
    for (let i of [-1, 1]) {
      let h = i < 0 ? 4.5 : 3.5;
      p('cylinder', i * 1.13, h * 0.5 + 0.5, -0.15, 0.85, h, 0.85, metal);
      p('cylinder', i * 1.13, h + 0.55, -0.15, 1, 0.17, 1, dark);
      p('cylinder', i * 1.13, h * 0.6, -0.15, 0.88, 0.25, 0.88, team, 0, 0, 0, 0.8);
      p('cone', i * 1.13, h + 0.95, -0.15, 0.55, 0.7, 0.55, dark);
      p('box', i * 1.13, 1.0, 1.05, 0.5, 0.55, 2, accent);
    }
    p('box', 0, 2.2, -0.3, 2.3, 0.27, 0.27, dark);
    p('octa', 0, 2.1, 1.1, 0.55, 1.2, 0.5, 0x8ff0de, time * 0.22, 0, 0, 1);
  }
});
