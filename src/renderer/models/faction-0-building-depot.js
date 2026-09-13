/* Fraktion 0 / building / depot: isolated procedural assembly. */
'use strict';
registerEntityModel({
  id: 'faction-0/building/depot',
  render({ entity: e, time, part: p, ring, metal, dark, team, accent, baseRotation }) {
    for (let i of [-1, 1]) {
      p('box', i * 1.05, 1, 0, 1.85, 1.8, 3.3, metal);
      p('box', i * 1.05, 1.95, 0, 1.93, 0.12, 3.4, dark);
      for (let j = -1; j <= 1; j++) p('box', i * 1.05, 1, j, 0.06, 1.65, 0.11, accent);
      p('box', i * 1.05, 1.2, 1.67, 1.1, 0.22, 0.06, team, 0, 0, 0, 0.5);
    }
  }
});
