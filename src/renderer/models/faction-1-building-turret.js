/* Fraktion 1 / building / turret: isolated procedural assembly. */
'use strict';
registerEntityModel({
  id: 'faction-1/building/turret',
  render({ entity: e, time, part: p, ring, metal, dark, team, accent, baseRotation }) {
    const s = e.size || 3;
    let h = e.type === 'hq' ? 5 : e.type === 'turret' ? 5.8 : e.type === 'depot' ? 2.8 : 3.8;
    p('sphere', 0, h * 0.44, 0, s * 0.8, h * 0.57, s * 0.78, metal);
    p('octa', 0, h * 0.77, 0, s * 0.5, h * 0.65, s * 0.5, dark, 0.3);
    for (let i = 0; i < 6; i++) {
      let a = (i * Math.PI) / 3,
        x = Math.sin(a) * s * 0.8,
        z = Math.cos(a) * s * 0.8;
      p('cone', x, 0.7, z, 0.5, 2, 0.5, dark, a, 0.25, 0.42);
      p('sphere', x * 0.8, h * 0.63, z * 0.8, 0.45, 0.8, 0.45, team, a, 0, 0.3, 0.28);
    }
    p(
      'octa',
      0,
      h + Math.sin(time + e.id) * 0.14,
      0,
      s * 0.3,
      1.3,
      s * 0.3,
      accent,
      time * 0.22,
      0,
      0,
      0.85
    );
    if (e.type === 'turret') p('cone', 0, h + 1.2, 0, 0.4, 2, 0.4, accent, 0, 0, 0, 0.5);
    if (e.type === 'refinery')
      for (let i = 0; i < 3; i++)
        p(
          'sphere',
          Math.sin(i * 2) * 1.4,
          2.5,
          Math.cos(i * 2) * 1.4,
          0.7,
          1.5,
          0.7,
          0x86b6a0,
          0,
          0,
          0,
          0.3
        );
    if (e.type === 'hangar') ring(s * 0.8, h * 0.9, accent, 0.7);
  }
});
