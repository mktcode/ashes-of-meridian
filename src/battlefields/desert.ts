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
    dressDesertFeet(builder);
  }
};

// New scenery is appended AFTER all original phases, on a private stream. These are
// shallow, traversable flakes, never new blockers or blanket gravel over the clearings.
function dressDesertFeet(builder: BattlefieldBuilder) {
  const { world, palette, safe, lanes } = builder, rand = builder.cosmeticRandom(0x53435245);
  const protectedSites = [
    ...safe.map(p => ({ ...p, r: 6 })),
    ...battlefieldStartSites(world).map(p => ({ ...p, r: 10 })),
    ...world.layout.resourceSites.map((p, i) => ({ x: p.x + (i ? 7 : 5), z: p.z + (i ? 7 : 18), r: 6 }))
  ];
  for (const model of ['desertTalus', 'desertFlake'])
    world.renderData.geometries.push({ mesh: model, model, seed: world.seed ^ 0x54414c55, extent: world.extent });
  let count = 0;
  const put = (x: number, z: number, size: number) => {
    const p = { x, z };
    if (count >= 1800 || Math.max(Math.abs(x), Math.abs(z)) + size > world.extent - 4 ||
      protectedSites.some(q => distance(p, q) < q.r + size) || lanes.some(([a, b]) => pointSegment(p, a, b) < 3.5 + size) ||
      world.renderData.features.some(m => insidePolygon(p, m.outline))) return;
    const shade = .94 + rand() * .14;
    builder.place(count % 3 ? 'desertTalus' : 'desertFlake', x, -.13, z,
      size, count % 3 ? .12 + rand() * .09 : .055 + rand() * .065, size * (.65 + rand() * .25),
      builder.color(palette.rock).map(v => v * shade), rand() * 6.28, 0, 0, 0, 1, 'static', 'ROCK');
    count++;
  };
  for (const rock of world.rocks) {
    const phase = rand() * 6.28;
    for (let sector = 0; sector < 3; sector++) {
      const a = phase + sector * 2.1;
      for (let i = 0; i < 10; i++) {
        const angle = a + (rand() - .5) * .85, r = rock.r * (.87 + rand() * .45) + rand() * 1.8;
        put(rock.x + Math.cos(angle) * r, rock.z + Math.sin(angle) * r, .22 + rand() ** 2 * .85);
      }
    }
  }
  for (const m of world.renderData.features) for (let i = 0; i < m.outline.length; i += 2) {
    const edge = m.outline[i], dx = edge.x - m.x, dz = edge.z - m.z, length = Math.hypot(dx, dz);
    // Broken fans rather than an evenly spaced necklace following the CPU polygon.
    if (rand() < .24) continue;
    for (let j = 0; j < 9; j++) {
      const spread = .3 + rand() ** 2 * 3.8, along = (rand() - .5) * 4;
      put(edge.x + (dx * spread - dz * along) / length,
        edge.z + (dz * spread + dx * along) / length, .25 + rand() ** 2 * 1.15);
    }
  }
}
