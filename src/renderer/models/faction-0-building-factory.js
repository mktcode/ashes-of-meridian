/* Faction 0 / building / factory. Local +Z is the production exit. */
'use strict';
registerEntityModel({
  id: 'faction-0/building/factory',
  render({ part: p, metal, dark, team, accent }) {
    p('box', 0, 0.7, -0.5, 6.5, 1.2, 4.7, dark);
    p('box', -2.7, 2, -0.8, 1.1, 2.8, 4.9, metal);
    p('box', 2.7, 2, -0.8, 1.1, 2.8, 4.9, metal);
    p('box', 0, 3.5, -1, 6.3, 0.42, 4.8, metal);
    p('box', 0, 1.65, -2.7, 4.7, 2.1, 0.4, 0x30434f);
    p('box', 0, 1.5, -2.43, 3.6, 1.4, 0.1, 0xed975d, 0, 0, 0, 0.7);
    p('box', 0, 3.1, 1.46, 5.1, 0.15, 0.15, team, 0, 0, 0, 0.75);
    for (let j = 0; j < 4; j++) p('box', 0, 3.76, j * 0.85 - 2.3, 5.7, 0.15, 0.28, dark);
    p('cylinder', -2.5, 4.75, -1.6, 0.36, 2.4, 0.36, dark);
    p('cylinder', -1.45, 4.3, -1.6, 0.31, 1.5, 0.31, dark);
    p('box', 2.6, 4.2, -1.3, 0.35, 2, 0.35, accent);
    p('box', 1.3, 5, -1.3, 2.8, 0.26, 0.26, accent);
    p('box', 0.1, 4.35, -1.3, 0.055, 1.15, 0.055, metal);
  }
});
