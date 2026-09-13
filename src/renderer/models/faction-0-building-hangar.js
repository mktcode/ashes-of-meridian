/* Faction 0 / building / hangar. Local +Z is the production exit/deck. */
'use strict';
registerEntityModel({
  id: 'faction-0/building/hangar',
  render({ part: p, metal, dark, team }) {
    p('box', 0, 0.7, -0.5, 6.5, 1.2, 4.7, dark);
    p('box', -2.7, 2, -0.8, 1.1, 2.8, 4.9, metal);
    p('box', 2.7, 2, -0.8, 1.1, 2.8, 4.9, metal);
    p('box', 0, 3.5, -1, 6.3, 0.42, 4.8, metal);
    p('box', 0, 1.65, -2.7, 4.7, 2.1, 0.4, 0x30434f);
    p('box', 0, 1.5, -2.43, 3.6, 1.4, 0.1, team, 0, 0, 0, 0.7);
    p('box', 0, 3.1, 1.46, 5.1, 0.15, 0.15, team, 0, 0, 0, 0.75);
    for (let j = 0; j < 4; j++) p('box', 0, 3.76, j * 0.85 - 2.3, 5.7, 0.15, 0.28, dark);
    p('hex', 0, 0.25, 3.0, 3.1, 0.14, 3.1, metal);
    p('box', -0.65, 0.36, 3, 0.12, 0.03, 1.8, team);
    p('box', 0.65, 0.36, 3, 0.12, 0.03, 1.8, team);
    p('box', 0, 0.36, 3, 1.3, 0.03, 0.12, team);
    p('box', -2.6, 4.5, -1.5, 1.15, 1.6, 1.1, metal);
    p('box', -2.6, 5.0, -0.9, 1.18, 0.45, 0.08, team, 0, 0, 0, 0.7);
  }
});
