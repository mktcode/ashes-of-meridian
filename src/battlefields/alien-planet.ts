/* Alien Planet: a forest clearing, with porous woodland rather than stamped groves. */
'use strict';

function alienBattleLayout(): BattlefieldLayout {
  return {
    startSites: [{ x: -81, z: 81 }, { x: 81, z: -81 }, { x: -83, z: -83 }, { x: 83, z: 83 }],
    playerStart: { x: -81, z: 81 },
    enemySites: [{ x: 81, z: -81 }, { x: -83, z: -83 }, { x: 83, z: 83 }],
    centralClearings: [{ x: 0, z: 0 }, { x: -30, z: 30 }, { x: 30, z: -30 }],
    outerClearings: [{ x: -99, z: -51 }, { x: 99, z: 51 }],
    resourceSites: [
      { x: -98, z: 74 }, { x: 66, z: -95 },
      { x: -45, z: 60 }, { x: 45, z: -60 },
      { x: -86, z: -12 }, { x: 86, z: 12 },
      { x: -98, z: -74 }, { x: 98, z: 74 }
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

// Smooth, seeded habitat variation: broad forest fingers, gaps and smaller inland patches.
// Sampling this field never advances a placement or simulation random stream.
function alienForestDensity(seed: number, extent: number) {
  const hash = (x: number, z: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed ^ 0x574f4f44;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x: number, z: number) => {
    const ix = Math.floor(x), iz = Math.floor(z);
    let u = x - ix, v = z - iz;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    return (hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u) * (1 - v) +
      (hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u) * v;
  };
  return (x: number, z: number) => {
    const depth = extent - Math.max(Math.abs(x), Math.abs(z)),
      reach = 36 + noise(x * .021, z * .021) * 66,
      fringe = clamp(1 - depth / reach, 0, 1),
      patches = Math.max(0, noise(x * .043 + 80, z * .043 - 30) - .38) * 1.5;
    return clamp(fringe * .78 + patches, 0, .95);
  };
}

function populateAlienPlanet(builder: BattlefieldBuilder) {
  const { world, place } = builder, extent = world.extent,
    density = alienForestDensity(world.seed, extent),
    trees = seeded(world.seed ^ 0x54524545),
    exterior = builder.cosmeticRandom(0x4f555445),
    decor = builder.cosmeticRandom(0x53504f52),
    protectedSites = [
      { ...world.layout.playerStart, r: 23 }, ...world.layout.enemySites.map(p => ({ ...p, r: 23 })),
      ...world.layout.resourceSites.map(p => ({ ...p, r: 12 })),
      ...world.layout.resourceSites.map((p, i) => ({ x: p.x + (i ? 7 : 5), z: p.z + (i ? 7 : 18), r: 9 })),
      ...world.layout.centralClearings.map(p => ({ ...p, r: 10 }))
    ];
  const safe = (p: Position, r: number) => protectedSites.some(q => distance(p, q) < q.r + r);
  const lane = (p: Position, margin: number) => builder.lanes.some(([a, b]) => pointSegment(p, a, b) < margin);
  const prop = (mesh: string, x: number, z: number, scale: number, yaw: number, glow = 0, height = scale) =>
    place(mesh, x, -.1, z, scale, height, scale, 0xffffff, yaw, 0, 0, glow, 1, 'static',
      mesh === 'alienFern' || mesh === 'alienSpore' ? 'AUTO' : 'ALIEN');
  const treeModel = (size: number, choice: number) => size < 2.2 ? 'alienSapling' :
    choice < .42 ? 'alienTreePlum' : choice < .78 ? 'alienTreeJade' : 'alienTreeUmbrella';
  for (const model of ['alienTreePlum', 'alienTreeJade', 'alienTreeUmbrella', 'alienSapling', 'alienPod', 'alienFern', 'alienSpore'])
    world.renderData.geometries.push({ mesh: model, model, seed: world.seed, extent });

  // A deep, irregular stand beyond every edge, not two rows on a raised square bank.
  // These instances never mark the navigation grid or consume the interior placement RNG.
  const outer = extent + 72;
  for (let z = -outer; z < outer; z += 13) for (let x = -outer; x < outer; x += 13) {
    const px = x + exterior() * 12, pz = z + exterior() * 12,
      edge = Math.max(Math.abs(px), Math.abs(pz));
    if (edge < extent + 2 || exterior() > .93) continue;
    const maturity = clamp((edge - extent + 24) / 50, .4, 1),
      size = (4.4 + exterior() * 2.5) * (.8 + maturity * .2);
    prop(treeModel(size, exterior()), px, pz, size, exterior() * Math.PI * 2, 0, size * (.85 + exterior() * .3));
  }

  // Individually rooted trees: crowns may overlap, but the ground between trunks is real terrain.
  // Jitter and a continuous density field replace hard grove outlines and repeated cluster meshes.
  for (let z = -extent + 7; z < extent - 7; z += 8) for (let x = -extent + 7; x < extent - 7; x += 8) {
    const p = { x: x + trees() * 7, z: z + trees() * 7 }, habitat = density(p.x, p.z);
    if (trees() > habitat) continue;
    const size = (2 + trees() * 3.1) * (.85 + habitat * .4), r = size * .6;
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) + r > extent - 4 || safe(p, r) || lane(p, r + 7) ||
        world.rocks.some(q => distance(p, q) < r + q.r + 2.5)) continue;
    world.mark(world.staticGrid, p.x, p.z, r);
    world.rocks.push({ ...p, r });
    prop(treeModel(size, trees()), p.x, p.z, size, trees() * Math.PI * 2, 0, size * (.85 + trees() * .3));
  }

  // Keep the little root colonies as occasional accents, never as a template for entire woods.
  const colonies = seeded(world.seed ^ 0x414c4945);
  for (let i = 0; i < 60; i++) {
    const p = { x: (colonies() - .5) * (extent * 2 - 28), z: (colonies() - .5) * (extent * 2 - 28) }, r = 2.1 + colonies() * 1.2;
    if (safe(p, r + 3) || lane(p, r + 7) || world.rocks.some(q => distance(p, q) < r + q.r + 7)) continue;
    world.mark(world.staticGrid, p.x, p.z, r); world.rocks.push({ ...p, r });
    prop('alienPod', p.x, p.z, r, colonies() * Math.PI * 2);
  }

  // Minimap ink follows actual trunk footprints, not an opaque grove-shaped mask.
  for (let i = 0; i < world.staticGrid.length; i++) if (world.staticGrid[i])
    for (let c = 0; c < 3; c++) world.terrainColors[i * 4 + c] *= .65;

  // Understory follows the same habitat, fading into scattered low plants on the open ground.
  // Separate cosmetic stream: changing ferns or phosphor never relocates solid trunks.
  const trunks = world.renderData.placements.filter(p => p.mesh.startsWith('alienTree') || p.mesh === 'alienSapling');
  for (const [index, tree] of trunks.entries()) for (let i = 0; i < 2; i++) {
    if (i === 0 && index % 4 !== 0) continue;
    const a = decor() * Math.PI * 2, r = tree.scale[0] * (.7 + decor() * .7),
      x = tree.position[0] + Math.cos(a) * r, z = tree.position[2] + Math.sin(a) * r;
    if (safe({ x, z }, 2) || lane({ x, z }, 3)) continue;
    prop(i ? 'alienFern' : 'alienSpore', x, z, i ? 1.2 + decor() * 1.6 : .4 + decor() * .6, a, i ? 0 : .45);
  }
  for (let i = 0; i < 1600; i++) {
    const p = { x: (decor() - .5) * (extent * 2 + 80), z: (decor() - .5) * (extent * 2 + 80) }, habitat = density(p.x, p.z);
    if (safe(p, 2) || lane(p, 3) || decor() > .16 + habitat * .75) continue;
    const fern = i % 5 !== 0, size = fern ? .7 + decor() * (1 + habitat) : .4 + decor() * .65;
    prop(fern ? 'alienFern' : 'alienSpore', p.x, p.z, size, decor() * Math.PI * 2, fern ? 0 : .45);
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
    haze: [.12, .085, .155],
    lighting: { sun: [.98, 1.06, .91], sky: [.39, .45, .55], bounce: [.16, .25, .22] }
  },
  worldEvent: null,
  generate(builder) {
    builder.ground();
    builder.boundary('alienForestFloor', 'GROUND');
    populateAlienPlanet(builder);
  }
};
