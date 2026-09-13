/* Map recipe; current visuals are preserved until its separate design pass. */
'use strict';
function placeMothershipPillar(builder: BattlefieldBuilder, x: number, z: number) {
  const { random: rand, palette: bio, place } = builder;
  let h = 2 + rand() * 6;
  place(
    'box',
    x,
    h / 2,
    z,
    0.7,
    h,
    0.9,
    0x85828c,
    rand() * 0.2,
    0,
    rand() * 0.3,
    0,
    1,
    'static'
  );
  place('octa', x, h + 0.5, z, 0.6, 1, 0.6, bio.accent, 0, 0, 0.2, 0.22, 1, 'static');
}

const MOTHERSHIP_BATTLEFIELD: BattlefieldDefinition = {
  name: 'MOTHERSHIP',
  size: { extent: 90, cellSize: 2.5 },
  layout: standardBattleLayout(),
  palette: {
    ground: 0x3d3c48,
    rock: 0x5a5261,
    accent: 0xe7be88,
    flora: 0x715b72
  },
  render: {
    groundTexture: 'ground', skyTexture: 'sky', groundPixelsPerMeter: 14,
    rockDecor: { density: .8, opacity: .18 }, shrubDecor: { density: .1, opacity: .28 },
    haze: [0.1, 0.065, 0.125]
  },
  worldEvent: 'solarFlare',
  generate(builder) {
    builder.ground();
    builder.boundary('mountainRing', 'MASSIF');
    builder.smallObstacles();
    builder.boundaryRocks();
    builder.rubble();
    builder.patches(placeGroundPatch);
    builder.debris(placeMothershipPillar);
    builder.features(createMassifCandidate, 'massif', 'MASSIF');
  }
};
