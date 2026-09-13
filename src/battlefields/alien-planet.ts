/* Map recipe; current visuals are preserved until its separate design pass. */
'use strict';
function placeAlienPlant(builder: BattlefieldBuilder, x: number, z: number) {
  const { random: rand, palette: bio, place } = builder;
  let h = 0.6 + rand() * 1.5;
  place('cone', x, h / 2, z, 0.09, h, 0.09, bio.flora, 0, 0, rand() * 0.5, 0, 1, 'static');
  place('sphere', x, h, z, 0.45, 0.23, 0.45, bio.accent, 0, 0, 0, 0.25, 1, 'static');
  for (let k = 0; k < 3; k++)
    place(
      'cone',
      x + (rand() - 0.5),
      h * 0.5,
      z + (rand() - 0.5),
      0.07,
      h * 0.8,
      0.07,
      bio.flora,
      0,
      0,
      rand(),
      0,
      1,
      'static'
    );
}

function placeAlienPatch(builder: BattlefieldBuilder, x: number, z: number, r: number) {
  const { random: rand, palette: bio, place } = builder;
  place(
    'cylinder',
    x,
    -0.115,
    z,
    r,
    0.018,
    r * 0.55,
    0x29434d,
    rand() * 6,
    0,
    0,
    0.1,
    1,
    'static'
  );
  place('ring', x, -0.09, z, r, 0.1, r * 0.55, 0x608b82, 0, 0, 0, 0.1, 0.4, 'static');
}

const ALIEN_PLANET_BATTLEFIELD: BattlefieldDefinition = {
  name: 'ALIEN PLANET',
  // Target for the design pass: extent 135 (1.5× each side, 2.25× area).
  size: { extent: 90, cellSize: 2.5 },
  layout: standardBattleLayout(),
  palette: {
    ground: 0x314747,
    rock: 0x49656a,
    accent: 0x8bebc2,
    flora: 0x538a77
  },
  render: {
    groundTexture: 'ground', skyTexture: 'sky', groundPixelsPerMeter: 14,
    rockDecor: { density: .8, opacity: .18 }, shrubDecor: { density: .1, opacity: .28 },
    haze: [0.052, 0.113, 0.127]
  },
  worldEvent: null,
  generate(builder) {
    builder.ground();
    builder.boundary('mountainRing', 'MASSIF');
    builder.smallObstacles();
    builder.boundaryRocks();
    builder.rubble(placeAlienPlant);
    builder.patches(placeAlienPatch);
    builder.debris(placeCargo);
    builder.features(createMassifCandidate, 'massif', 'MASSIF');
  }
};
