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
    density = alienForestDensity(world.terrainSeed, extent),
    trees = seeded(world.terrainSeed ^ 0x54524545),
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
  for (const model of ['alienTreePlum', 'alienTreeJade', 'alienTreeUmbrella', 'alienSapling', 'alienPod',
    'alienFern', 'alienSpore', 'alienGlowTuft', 'alienLanternPool',
    'alienCapGillsPlum', 'alienCapGillsJade', 'alienCapGillsUmbrella'])
    world.renderData.geometries.push({ mesh: model, model, seed: world.terrainSeed, extent });

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
  const colonies = seeded(world.terrainSeed ^ 0x414c4945);
  for (let i = 0; i < 60; i++) {
    const p = { x: (colonies() - .5) * (extent * 2 - 28), z: (colonies() - .5) * (extent * 2 - 28) }, r = 2.1 + colonies() * 1.2;
    if (safe(p, r + 3) || lane(p, r + 7) || world.rocks.some(q => distance(p, q) < r + q.r + 7)) continue;
    world.mark(world.staticGrid, p.x, p.z, r); world.rocks.push({ ...p, r });
    prop('alienPod', p.x, p.z, r, colonies() * Math.PI * 2);
  }

  // Minimap ink follows actual trunk footprints, not an opaque grove-shaped mask.
  for (let i = 0; i < world.staticGrid.length; i++) if (world.staticGrid[i])
    for (let c = 0; c < 3; c++) world.terrainColors[i * 4 + c] *= .65;

  // Understory follows the same habitat, with denser fluorescent carpets around inland trunks.
  // Separate cosmetic stream: changing ferns, cap lamellae or phosphor never relocates solid trunks.
  const trunks = world.renderData.placements.filter(p => p.mesh.startsWith('alienTree') || p.mesh === 'alienSapling'),
    gillModels: Record<string, string> = {
      alienTreePlum: 'alienCapGillsPlum', alienTreeJade: 'alienCapGillsJade', alienTreeUmbrella: 'alienCapGillsUmbrella'
    };
  for (const [index, tree] of trunks.entries()) {
    const inland = Math.max(Math.abs(tree.position[0]), Math.abs(tree.position[2])) < extent;
    if (gillModels[tree.mesh] && (inland || index % 24 === 0)) {
      prop(gillModels[tree.mesh], tree.position[0], tree.position[2], tree.scale[0], tree.rotation[0],
        2.5, tree.scale[1]);
      if (inland) {
        const poolColor = tree.mesh === 'alienTreeJade' ? 0x6be8d1 :
          tree.mesh === 'alienTreePlum' ? 0xd264dd : index % 2 ? 0x6be8d1 : 0xd264dd;
        place('alienLanternPool', tree.position[0], -.1, tree.position[2],
          tree.scale[0] * 1.55, .1, tree.scale[0] * 1.55, poolColor, tree.rotation[0], 0, 0,
          1.25, .72, 'static', 'ALIEN_LIGHT');
      }
    }
    const count = inland ? 4 : 2;
    for (let i = 0; i < count; i++) {
      if (!inland && i === 0 && index % 4 !== 0) continue;
      const a = decor() * Math.PI * 2, r = tree.scale[0] * (.68 + decor() * .78),
        x = tree.position[0] + Math.cos(a) * r, z = tree.position[2] + Math.sin(a) * r;
      if (safe({ x, z }, 2) || lane({ x, z }, 3)) continue;
      const mesh = inland && i === 2 ? 'alienGlowTuft' : i === 0 ? 'alienSpore' : 'alienFern',
        size = mesh === 'alienFern' ? 1.05 + decor() * 1.45 : mesh === 'alienSpore' ? .4 + decor() * .6 : .75 + decor() * .65;
      prop(mesh, x, z, size, a, mesh === 'alienFern' ? 0 : mesh === 'alienSpore' ? .55 : 1.15);
    }
  }
  // Keep some plants between groves, but concentrate most of the biomass around the trees.
  for (let i = 0; i < 1050; i++) {
    const p = { x: (decor() - .5) * (extent * 2 + 80), z: (decor() - .5) * (extent * 2 + 80) }, habitat = density(p.x, p.z);
    if (safe(p, 2) || lane(p, 3) || decor() > .16 + habitat * .75) continue;
    const luminous = i % 11 === 0, fern = i % 5 !== 0 && !luminous,
      size = fern ? .7 + decor() * (1 + habitat) : luminous ? .6 + decor() * .55 : .4 + decor() * .65,
      mesh = fern ? 'alienFern' : luminous ? 'alienGlowTuft' : 'alienSpore';
    prop(mesh, p.x, p.z, size, decor() * Math.PI * 2, fern ? 0 : luminous ? 1.05 : .5);
  }
}

const ALIEN_PLANET_BATTLEFIELD: BattlefieldDefinition = {
  name: 'ALIEN PLANET',
  size: { extent: 135, cellSize: 2.5 },
  layout: alienBattleLayout(),
  palette: { ground: 0x63516c, rock: 0xffffff, accent: 0xcfa1ce, flora: 0x648d87 },
  render: {
    groundTexture: 'bio', skyTexture: 'sky', wilderness: 'mycelium',
    landscape: { earth: 'westmarkEarth', bark: 'westmarkBark' },
    rockDecor: { density: 0, opacity: 0 }, shrubDecor: { density: 0, opacity: 0 },
    haze: [.035, .045, .095],
    lighting: { sun: [.42, .52, .78], sky: [.14, .20, .34], bounce: [.055, .085, .16] }
  },
  worldEvent: null,
  generate(builder) {
    builder.ground();
    builder.boundary('alienForestFloor', 'GROUND');
    populateAlienPlanet(builder);
  }
};
