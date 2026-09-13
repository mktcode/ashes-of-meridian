/* Fraktion 2 / building / turret: isolated procedural assembly. */
'use strict';
registerEntityModel({
  id: 'faction-2/building/turret',
  render({ entity: e, time, part: p, ring, metal, dark, team, accent, baseRotation }) {
    const s = e.size || 3;
    let h = e.type === 'hq' ? 7.8 : e.type === 'turret' ? 6.5 : e.type === 'depot' ? 3.3 : 5.5;
    p('hex', 0, 0.55, 0, s * 0.8, 0.5, s * 0.8, metal);
    p('octa', 0, h * 0.48, 0, s * 0.5, h * 0.53, s * 0.5, dark, 0.4);
    p('octa', 0, h * 0.67, 0, s * 0.38, h * 0.43, s * 0.38, metal, 0.4);
    p('octa', 0, h * 0.79, 0, s * 0.21, h * 0.35, s * 0.21, team, time * 0.1, 0, 0, 0.75);
    for (let i = 0; i < 4; i++) {
      let a = (i * Math.PI) / 2 + 0.785,
        x = Math.sin(a) * s * 0.74,
        z = Math.cos(a) * s * 0.74;
      p('box', x, h * 0.3, z, 0.42, h * 0.57, 0.65, metal, a, 0, 0);
      p('octa', x, h * 0.63, z, 0.25, 0.7, 0.25, accent, 0, 0, 0, 0.8);
    }
    if (['hq', 'refinery', 'hangar'].includes(e.type)) {
      ring(s * 0.88, h * 0.62, accent, 0.8, Math.PI / 2, time * 0.18, 0.85);
      ring(s * 0.85, h * 0.4, team, 0.6);
    }
  }
});
