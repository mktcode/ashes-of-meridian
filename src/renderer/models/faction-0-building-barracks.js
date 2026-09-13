/* Faction 0 / building / barracks. Model-local coordinates; front is +Z. */
'use strict';
registerEntityModel({
  id: 'faction-0/building/barracks',
  render({ part: p, metal, dark, team, accent }) {
    p('box', 0, 1.3, 0, 4.9, 2.5, 4.1, metal);
    p('box', 0, 2.75, -0.25, 5.1, 0.4, 3.9, dark);
    p('box', 0, 3.02, -0.3, 4.4, 0.18, 3.3, metal);
    p('box', 0, 1.15, 2.08, 2.2, 2, 0.08, 0x1d2f3d);
    p('box', 0, 2.33, 2.14, 2.7, 0.17, 0.1, team, 0, 0, 0, 0.8);
    for (let i = -1; i <= 1; i++) p('box', i * 1.25, 3.15, -0.1, 0.72, 0.15, 2.7, 0x8b9b9c);
    p('box', -2.7, 1, -0.2, 0.65, 1.8, 3.2, dark);
    p('box', 2.7, 1, -0.2, 0.65, 1.8, 3.2, dark);
    p('box', 1.7, 1.5, 2.09, 0.6, 0.5, 0.1, accent);
    p('cylinder', -2, 3.65, -1.3, 0.045, 1.7, 0.045, metal);
    p('box', -1.62, 4.1, -1.3, 0.8, 0.6, 0.035, team);
  }
});
