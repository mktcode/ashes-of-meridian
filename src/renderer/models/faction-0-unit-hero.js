/* Fraktion 0 / unit / hero: isolated assembly. */
'use strict';
registerEntityModel({
  id: 'faction-0/unit/hero',
  render({entity:e,time,part:p,metal,dark,team,accent,surfaceColor}) {
    const ty = 'hero', step = Math.sin((e.walk || 0) * 7) * .23;
    let h = ty === 'hero' ? 1.17 : 1,
      med = ty === 'medic',
      c = med ? 0xb9c3be : metal;
    for (let side of [-1, 1]) {
      p('box', side * 0.23, 0.35, side * step, 0.25, 0.65, 0.33, dark);
      p('box', side * 0.25, 0.13, side * step + 0.09, 0.32, 0.22, 0.48, dark);
    }
    p('box', 0, 1.0 * h, 0, 0.78 * h, 0.75 * h, 0.5 * h, c);
    p('box', 0, 1.16 * h, 0.28, 0.48, 0.26, 0.1, team, 0, 0, 0, 0.35);
    p('box', 0, 1.65 * h, 0.02, 0.45 * h, 0.43 * h, 0.43 * h, c);
    p('box', 0, 1.65 * h, 0.25, 0.43, 0.115, 0.08, med ? 0x84dfc1 : 0x8ce1e2, 0, 0, 0, 0.85);
    p('box', -0.5 * h, 1.32 * h, 0, 0.34, 0.35, 0.54, c);
    p('box', 0.5 * h, 1.32 * h, 0.08, 0.34, 0.35, 0.54, c);
    p('box', -0.48, 1.0, 0.27, 0.22, 0.47, 0.22, dark, -0.3, -0.5);
    p('box', 0.5, 1.09, 0.48, 0.25, 0.23, 0.85, dark);
    p('box', 0.5, 1.12, 0.98, 0.11, 0.11, 0.42, 0x9eaaa8);
    p('box', 0, 1.08, -0.37, 0.49, 0.66, 0.26, dark);
    if (med) {
      p('box', 0, 1.15, -0.53, 0.36, 0.11, 0.02, 0x92e5c5, 0, 0, 0, 0.7);
      p('box', 0, 1.15, -0.53, 0.11, 0.38, 0.02, 0x92e5c5, 0, 0, 0, 0.7);
    }
    if (ty === 'hero') {
      p('box', 0, 0.91, -0.49, 0.86, 1.2, 0.06, 0xa6835b, 0, -0.1);
      p('box', -0.54, 1.48, 0.02, 0.42, 0.16, 0.59, accent);
      p('box', 0.54, 1.48, 0.02, 0.42, 0.16, 0.59, accent);
    }
  }
});
