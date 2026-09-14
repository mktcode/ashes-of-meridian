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
    // Preserve sunlit soil brightness while giving shaded facets less uniform fill.
    lighting: { sun: [1.20, 1.00, .80], sky: [.27, .34, .43], bounce: [.15, .12, .09] }
  },
  worldEvent: null,
  generate(builder) {
    builder.ground();
    builder.boundary('mountainRing', 'MASSIF');
    builder.smallObstacles();
    builder.boundaryRocks();
    const { renderData } = builder.world, rubbleStart = renderData.placements.length;
    builder.rubble();
    // Preserve every interleaved layout/RNG sample; only replace this phase's visual descriptors.
    for (const p of renderData.placements.slice(rubbleStart)) {
      p.mesh = p.mesh === 'octa' ? 'desertPebble' : 'desertChip';
      p.material = 'ROCK';
      p.position[1] = -.13; // Ground the new low stones instead of centering a primitive above the soil.
    }
    builder.patches(placeGroundPatch);
    builder.debris(placeCargo);
    builder.features(createMassifCandidate, 'massif', 'MASSIF');
    const rocks: Record<string, string> = {
      rockBoulder: 'desertBoulder', rockCrag: 'desertCrag', rockRidge: 'desertRidge', rockShelf: 'desertShelf'
    };
    for (const p of renderData.placements) if (Object.hasOwn(rocks, p.mesh)) p.mesh = rocks[p.mesh];
    for (const [i, model] of [...Object.values(rocks), 'desertPebble', 'desertChip'].entries())
      renderData.geometries.push({ mesh: model, model, seed: builder.world.seed ^ (0x524f434b + i), extent: builder.world.extent });
  }
};
