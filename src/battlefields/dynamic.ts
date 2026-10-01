/* Shared, seed-owned landscape generation. Terrain and economy precede deployment;
 * no corner, player slot or private deployment seed shapes the world. */
'use strict';
function dynamicBattlefieldLayout(seed: number, extent: number): BattlefieldLayout {
  const random = seeded(seed ^ 0x4c41594f), sites: Position[] = [], count = 8 + Math.floor(random() * 2),
    limit = extent - 30, spacing = Math.min(48, extent * .43);
  // Broadly scattered economy regions, independent of parties and private deployment.
  for (let attempt = 0; attempt < 32 && sites.length < count; attempt++) {
    sites.length = 0;
    for (let draw = 0; draw < 800 && sites.length < count; draw++) {
      const p = { x: (random() * 2 - 1) * limit, z: (random() * 2 - 1) * limit };
      if (sites.every(q => distance(p, q) >= spacing)) sites.push(p);
    }
  }
  // Bounded public fallback prevents a crowded sampling draw from invalidating a seed.
  if (sites.length < count) {
    sites.length = 0;
    for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++)
      sites.push({ x: x * limit * .86 + (random() - .5) * 6, z: z * limit * .86 + (random() - .5) * 6 });
    if (count === 8) sites.splice(Math.floor(random() * sites.length), 1);
  }
  const corridors: [number, number][][] = [], connected = [sites[0]], remaining = sites.slice(1);
  while (remaining.length) {
    let best = Infinity, from = connected[0], index = 0;
    for (const a of connected) for (let i = 0; i < remaining.length; i++) {
      const d = distance(a, remaining[i]);
      if (d < best) { best = d; from = a; index = i; }
    }
    const to = remaining.splice(index, 1)[0];
    corridors.push([[from.x, from.z], [to.x, to.z]]); connected.push(to);
  }
  // Extra routes offer alternatives to the spanning tree, not four base approaches.
  for (let i = 0; i < sites.length; i++) {
    const a = sites[i], b = sites[(i + 2) % sites.length];
    corridors.push([[a.x, a.z], [b.x, b.z]]);
  }
  return { startSites: [], resourceSites: sites, corridors };
}
function dynamicTerrainPlan(world: Battlefield) {
  const random = seeded(world.terrainSeed ^ 0x54455252), style = world.renderProfile.variation,
    amplitude = (14 + random() * 12) * (style?.heightScale ?? 1), angle = random() * Math.PI, phase = random() * Math.PI * 2,
    industrial = style?.family === 'ship', form = industrial ? 'terraces' : style?.relief || 'rolling',
    cs = Math.cos(angle), sn = Math.sin(angle), extent = world.extent,
    hills = Array.from({ length: 12 }, () => ({ x: (random() - .5) * extent * 1.9,
      z: (random() - .5) * extent * 1.9, radius: 42 + random() * 38, height: 9 + random() * 17 })),
    // Morphology has its own stream: extra landforms never shift economy or decor draws.
    morphology = seeded(world.terrainSeed ^ 0x4d4f5250),
    valley = { offset: (morphology() - .5) * extent * .7, bend: 14 + morphology() * 22,
      width: 12 + morphology() * 12, depth: 12 + morphology() * 12, phase: morphology() * Math.PI * 2 },
    ridge = { offset: (morphology() - .5) * extent, width: 28 + morphology() * 20, height: 12 + morphology() * 12 },
    canyon = !industrial && (form === 'basin' || form === 'broken-crater' || morphology() < .5),
    smooth = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); },
    datum = (x: number, z: number) => {
      let h = 18 + amplitude * (.5 + .22 * Math.sin((x * cs + z * sn) / 160 + phase) +
        .18 * Math.cos((z * cs - x * sn) / 185 - phase));
      for (const hill of hills) {
        const d = Math.hypot(x - hill.x, z - hill.z) / (hill.radius * 2.5);
        h += hill.height * .2 * Math.exp(-d * d);
      }
      return h;
    },
    raw = (x: number, z: number, grade = datum(x, z)) => {
      const u = x * cs + z * sn, v = z * cs - x * sn;
      let h = grade;
      if (form === 'dunes') h += 5 * Math.sin(u / 34 + .6 * Math.sin(v / 75));
      if (form === 'basin' || form === 'broken-crater') h += 12 * smooth((Math.hypot(x, z) / extent - .3) / .55);
      if (form === 'ridges' || form === 'folds') {
        const d = (v - ridge.offset - 12 * Math.sin(u / 85 + phase)) / ridge.width;
        h += ridge.height * Math.exp(-d * d);
      }
      let hillRelief = 0;
      for (const hill of hills) {
        const d = Math.hypot(x - hill.x, z - hill.z) / hill.radius;
        // A smooth maximum joins broad hills without stacking them into one giant mound.
        const relief = hill.height * (form === 'terraces' ? 1 - smooth((d - .35) / 1.3) : Math.exp(-d * d));
        hillRelief += relief ** 6;
      }
      h += Math.pow(hillRelief, 1 / 6);
      if (canyon) {
        const d = Math.abs(v - valley.offset - valley.bend * Math.sin(u / 85 + valley.phase));
        h -= valley.depth * (1 - smooth((d - valley.width) / 26));
      }
      return h;
    },
    pads = world.layout.resourceSites.map(p => {
      const angle = morphology() * Math.PI;
      return { ...p, cs: Math.cos(angle), sn: Math.sin(angle), stretch: .85 + morphology() * .3, phase: morphology() * Math.PI * 2 };
    }),
    routes = world.layout.corridors.map(route => {
      const [a, b] = route, dx = b[0] - a[0], dz = b[1] - a[1];
      return { x: a[0], z: a[1], dx, dz, length2: dx * dx + dz * dz };
    }),
    height = (x: number, z: number) => {
      const grade = datum(x, z);
      let h = raw(x, z, grade), roadBlend = 0;
      for (const r of routes) {
        const t = clamp(((x - r.x) * r.dx + (z - r.z) * r.dz) / r.length2, 0, 1),
          d = Math.hypot(x - r.x - t * r.dx, z - r.z - t * r.dz), influence = 1 - smooth((d - 7) / 26);
        roadBlend = Math.max(roadBlend, influence);
      }
      // Intersections share one gently graded datum: averaging roads at unrelated
      // elevations can otherwise cut the guaranteed vehicle network into islands.
      h += (grade - h) * roadBlend;
      // Buildable cores retain a gentle continuous grade instead of punched-out discs.
      // Irregular elongated shoulders merge them into the surrounding landscape.
      let blend = 0;
      for (const p of pads) {
        const dx = x - p.x, dz = z - p.z,
          u = (dx * p.cs + dz * p.sn) / p.stretch, v = (dz * p.cs - dx * p.sn) * p.stretch,
          d = Math.pow(u ** 4 + v ** 4, .25), theta = Math.atan2(v, u),
          shoulder = 28 + 5 * Math.sin(theta * 3 + p.phase) + 3 * Math.cos(theta * 5 - p.phase),
          influence = 1 - smooth((d - 18) / shoulder);
        blend = Math.max(blend, influence);
      }
      h += (grade - h) * blend;
      // Ease tall overlapping shoulders into the ceiling instead of slicing summits flat.
      return Math.max(0, h > 60 ? 60 + 12 * (1 - Math.exp(-(h - 60) / 12)) : h);
    };
  return { height, industrial };
}
function createDynamicBattlefield(name: string, family: WorldVariationFamily): BattlefieldDefinition {
  const industrial = family === 'ship', palette: BattlefieldPalette = industrial
    ? { ground: 0x424f5d, rock: 0x7c8e9b, accent: 0xf0b764, flora: 0x79aab5 }
    : { ground: 0x637344, rock: 0x828783, accent: 0xbad49c, flora: 0x355b3a };
  return { name, size: { extent: 160, cellSize: 2.5 }, palette, worldEvent: industrial ? 'solarFlare' : null,
    createSize: seed => ({ extent: [140, 160, 180][Math.floor(seeded(seed ^ 0x53495a45)() * 3)], cellSize: 2.5 }),
    createLayout: (seed, size) => dynamicBattlefieldLayout(seed, size.extent),
    render: { groundTexture: industrial ? 'metal' : family === 'desert' ? 'ground' : family === 'alien' ? 'bio' : 'westmarkMeadow', skyTexture: 'sky',
      rockSurface: { texture: family === 'desert' ? 'desertRock' : 'westmarkGranite', metersPerTile: 8 },
      variationFamily: family, wilderness: 'seeded', terrainReceiverHeight: 80, daylight: true, upland: !industrial,
      landscape: { earth: 'westmarkEarth', bark: 'westmarkBark' },
      haze: [0.055, 0.09, 0.13], rockDecor: { density: .8, opacity: .18 }, shrubDecor: { density: .1, opacity: .28 } },
    generate(builder) {
      const w = builder.world, plan = dynamicTerrainPlan(w), s = w.surface = new BattlefieldSurface(w.extent, w.cellSize,
        plan.height, h => Math.floor(h / 6));
      w.staticGrid.set(s.cliffs); w.terrainFeatureGrid.set(s.cliffs);
      builder.ground();
      w.renderData.placements.find(p => p.mesh === 'terrain')!.material = plan.industrial ? 'METAL' : 'LANDSCAPE';
      const field = (extent: number, step: number, innerExtent = 0): WorldRelief => {
        const size = Math.round(extent * 2 / step) + 3, heights = new Float32Array(size * size), colors = new Float32Array(size * size * 3);
        for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
          const px = (x - 1) * step - extent, pz = (z - 1) * step - extent, i = z * size + x,
            inside = Math.max(Math.abs(px), Math.abs(pz)) <= w.extent;
          heights[i] = (inside ? s.heightAt(px, pz) : plan.height(px, pz)) - .13;
          if (plan.industrial) colors.set([.65, .75, .85], i * 3);
          else colors[i * 3 + 1] = clamp((heights[i] - 25) / 22, 0, 1);
        }
        return { extent, step, size, heights, colors, innerExtent };
      };
      w.renderData.geometries.push({ mesh: 'terrain', model: 'landscapeRelief', relief: field(w.extent, s.step) },
        { mesh: 'dynamicBackdrop', model: 'landscapeRelief', relief: field(w.extent + 100, 5, w.extent) });
      builder.place('dynamicBackdrop', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0, 0, 1, 'static', plan.industrial ? 'METAL' : 'LANDSCAPE');
      // Minimap uses the same height field; vegetation may only decorate existing blockers.
      for (let i = 0; i < w.staticGrid.length; i++) {
        const p = w.point(i), shade = .7 + s.heightAt(p.x, p.z) * .012;
        for (let c = 0; c < 3; c++) w.terrainColors[i * 4 + c] *= shade;
      }
    }
  };
}
