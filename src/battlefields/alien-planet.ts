/* Alien Planet: an open diagonal front between two impassable living groves. */
'use strict';

function alienBattleLayout(): BattlefieldLayout {
  return {
    playerStart: { x: -81, z: 81 },
    enemySites: [{ x: 81, z: -81 }, { x: -83, z: -83 }, { x: 83, z: 83 }],
    centralClearings: [{ x: 0, z: 0 }, { x: -30, z: 30 }, { x: 30, z: -30 }],
    outerClearings: [{ x: -99, z: -51 }, { x: 99, z: 51 }],
    resourceSites: [
      { x: -98, z: 74 }, { x: 66, z: -95 },
      { x: -45, z: 60 }, { x: 45, z: -60 },
      { x: -86, z: -12 }, { x: 86, z: 12 },
      { x: -24, z: -94 }, { x: 24, z: 94 }
    ],
    additionalClearings: [{ x: -81, z: 99 }, { x: 81, z: -99 }],
    corridors: [
      [[-81,81],[-35,35],[0,0],[35,-35],[81,-81]],
      [[-81,81],[-109,12],[-104,-62],[-24,-94],[81,-81]],
      [[-81,81],[24,94],[104,62],[109,-12],[81,-81]],
      [[-86,-12],[-64,14],[0,0],[64,-14],[86,12]]
    ]
  };
}

function createAlienGrove(rand: () => number, world: Battlefield): WorldTerrainFeature {
  // Different seeds shape the groves, not the strategic lane structure.
  const side = world.renderData.features.length ? 1 : -1;
  const m: WorldTerrainFeature = {
    x: side * (39 + rand() * 7), z: side * (31 + rand() * 7),
    width: (27 + rand() * 4) * 1.2, depth: (21 + rand() * 3) * 1.2, height: 12 + rand() * 3,
    yaw: -.5 + rand() * .25, seed: Math.floor(rand() * 0x100000000), outline: []
  };
  const phase = rand() * Math.PI * 2, cs = Math.cos(m.yaw), sn = Math.sin(m.yaw);
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI * 2 / 48, r = .9 + .055 * Math.sin(a * 3 + phase) + .025 * Math.cos(a * 7),
      x = Math.cos(a) * m.width * r, z = Math.sin(a) * m.depth * r;
    m.outline.push({ x: m.x + cs * x + sn * z, z: m.z - sn * x + cs * z });
  }
  return m;
}

function populateAlienPlanet(builder: BattlefieldBuilder) {
  const { world, place } = builder;
  const obstacles = seeded(world.seed ^ 0x414c4945), decor = builder.cosmeticRandom(0x53504f52);
  const safe = (p: Position, margin: number) => builder.safe.some(q => distance(p, q) < margin) ||
    world.layout.resourceSites.some((q, i) => distance(p, { x: q.x + (i ? 7 : 5), z: q.z + (i ? 7 : 18) }) < margin);
  const lane = (p: Position, margin: number) => builder.lanes.some(([a, b]) => pointSegment(p, a, b) < margin);
  const prop = (mesh: string, x: number, z: number, scale: number, yaw: number, glow = 0) =>
    place(mesh, x, -.1, z, scale, scale, scale, 0xffffff, yaw, 0, 0, glow, 1, 'static', mesh === 'alienPod' || mesh === 'alienSapling' ? 'ALIEN' : 'AUTO');
  for (const model of ['alienPod', 'alienFern', 'alienSpore', 'alienSapling'])
    world.renderData.geometries.push({ mesh: model, model, seed: world.seed, extent: world.extent });

  // Root colonies are the small, genuinely blocking obstacles. Routes and resource aprons stay open.
  for (let i = 0; i < 72; i++) {
    const p = { x: (obstacles() - .5) * (world.extent*2-28), z: (obstacles() - .5) * (world.extent*2-28) }, r = 2.1 + obstacles() * 1.2;
    if (safe(p, r + 14) || lane(p, r + 7) ||
        world.rocks.some(q => distance(p, q) < r + q.r + 9)) continue;
    world.mark(world.staticGrid, p.x, p.z, r);
    world.rocks.push({ ...p, r });
    prop('alienPod', p.x, p.z, r, obstacles() * Math.PI * 2);
  }
  // Scattered young growth just inside all four edges, with its own placement stream.
  // Stems are real small blockers; low companion ferns remain cosmetic.
  const fringe = seeded(world.seed ^ 0x45444745);
  for (let side = 0; side < 4; side++) for (let i = 0; i < 14; i++) {
    const along = ((i + .2 + fringe() * .6) / 14 - .5) * (world.extent * 2 - 32),
      edge = world.extent - 6 - fringe() * 4,
      p = side < 2 ? { x: along, z: edge * (side ? -1 : 1) } : { x: edge * (side === 2 ? -1 : 1), z: along },
      r = 1.5 + fringe() * .7;
    if (safe(p, r + 14) || lane(p, r + 7) || world.rocks.some(q => distance(p, q) < r + q.r + 4)) continue;
    world.mark(world.staticGrid, p.x, p.z, r);
    world.rocks.push({ ...p, r });
    prop('alienSapling', p.x, p.z, r, fringe() * Math.PI * 2);
    for (let j = 0; j < 3; j++) {
      const a = fringe() * Math.PI * 2, d = r + .5 + fringe();
      prop('alienFern', p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, .8 + fringe() * .8, a);
    }
  }
  builder.features(createAlienGrove, 'alienGrove', 'ALIEN');
  for (let i = 0; i < world.renderData.features.length; i++) {
    const feature = world.renderData.features[i], mesh = `alienGroveLight${i}`;
    world.renderData.geometries.push({ mesh, model: 'alienGroveLight', feature });
    place(mesh, 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0, .85, 1, 'static', 'AUTO');
  }

  // Low fern/spore islands: private cosmetic stream, never additional blocking cells.
  for (let i = 0; i < 1150; i++) {
    const p = { x: (decor() - .5) * (world.extent*2-15), z: (decor() - .5) * (world.extent*2-15) };
    if (safe(p, 9) || world.staticGrid[world.idx(p.x, p.z)] || lane(p, 5)) continue;
    const island = Math.sin(p.x * .063 + Math.sin(p.z * .04)) + Math.cos(p.z * .071 - p.x * .023);
    if (island < .15 && decor() < .88) continue;
    const fern = i % 4 !== 0, s = fern ? .65 + decor() * .9 : .4 + decor() * .65;
    prop(fern ? 'alienFern' : 'alienSpore', p.x, p.z, s, decor() * Math.PI * 2, fern ? 0 : .45);
  }
  // Readable, low phosphor trail markers near expansions, not roads or collision walls.
  for (const p of world.layout.resourceSites) for (let i = 0; i < 5; i++) {
    const a = i * 1.1 + decor(), r = 10.5 + decor() * 2;
    const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    if (!world.staticGrid[world.idx(x,z)] && !lane({x,z},4)) prop('alienSpore', x, z, .5, a, .55);
  }
}

const ALIEN_PLANET_BATTLEFIELD: BattlefieldDefinition = {
  name: 'ALIEN PLANET',
  size: { extent: 135, cellSize: 2.5 },
  layout: alienBattleLayout(),
  palette: { ground: 0x63516c, rock: 0xffffff, accent: 0xcfa1ce, flora: 0x648d87 },
  render: {
    groundTexture: 'bio', skyTexture: 'sky', groundPixelsPerMeter: 14, groundMirror: true,
    rockDecor: { density: 0, opacity: 0 }, shrubDecor: { density: 0, opacity: 0 },
    haze: [.12, .085, .155]
  },
  worldEvent: null,
  generate(builder) {
    builder.ground();
    builder.boundary('alienCanopy', 'ALIEN');
    populateAlienPlanet(builder);
  }
};
