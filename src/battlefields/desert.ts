/* Warm mineral desert; visual materials stay independent of the seeded obstacle layout. */
'use strict';
const DESERT_BATTLEFIELD: BattlefieldDefinition = {
  name: 'DESERT',
  size: { extent: 90, cellSize: 2.5 },
  layout: standardBattleLayout(),
  palette: {
    ground: 0x59443a,
    rock: 0x74544a,
    accent: 0xf0b67b,
    flora: 0x806348
  },
  render: {
    groundTexture: 'ground', skyTexture: 'sky', groundPixelsPerMeter: 22,
    rockSurface: { texture: 'desertRock', metersPerTile: 18 },
    rockDecor: { density: .55, opacity: .72 }, shrubDecor: { density: .08, opacity: .78 },
    haze: [0.11, 0.085, 0.1],
    lighting: { sun: [1.12, .94, .76], sky: [.38, .47, .56], bounce: [.23, .18, .16] }
  },
  worldEvent: null,
  generate(builder) {
    builder.ground();
    builder.boundary('mountainRing', 'MASSIF');
    builder.smallObstacles();
    builder.boundaryRocks();
    builder.rubble();
    builder.patches(placeGroundPatch);
    builder.debris(placeCargo);
    builder.features(createMassifCandidate, 'massif', 'MASSIF');
  }
};
