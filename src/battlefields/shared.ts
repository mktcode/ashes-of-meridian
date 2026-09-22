/* CPU-only layout and placement helpers shared by the map recipes. */
'use strict';
function standardBattleLayout(): BattlefieldLayout {
  return {
    startSites: [{ x: -51, z: 49 }, { x: 49, z: -49 }, { x: -47, z: -45 }, { x: 51, z: 49 }],
    playerStart: { x: -51, z: 49 },
    enemySites: [
      { x: 49, z: -49 },
      { x: -47, z: -45 },
      { x: 51, z: 19 }
    ],
    centralClearings: [
      { x: -32, z: -13 },
      { x: 11, z: 6 },
      { x: 39, z: -35 },
      { x: -12, z: -55 }
    ],
    outerClearings: [
      { x: -48, z: 3 },
      { x: -21, z: -43 },
      { x: 16, z: -23 },
      { x: 51, z: 0 },
      { x: 34, z: 47 }
    ],
    resourceSites: [
      { x: -67, z: 43 },
      { x: -25, z: 27 },
      { x: 6, z: 40 },
      { x: -57, z: -25 },
      { x: 27, z: -51 },
      { x: 65, z: 6 },
      { x: 29, z: 64 },
      { x: 7, z: -65 }
    ],
    additionalClearings: [
      { x: -40, z: 62 }, { x: -51, z: 63 }, { x: -63, z: 60 },
      { x: -37, z: 67 }, { x: -27, z: 61 }, { x: -27, z: 72 }, { x: 0, z: 0 }
    ],
    corridors: [
      [
        [-52, 37],
        [-36, 15],
        [-9, -1],
        [16, -26],
        [43, -63]
      ],
      [
        [-28, 55],
        [3, 39],
        [38, 17],
        [64, -19],
        [58, -63]
      ]
    ],
  };
}

// Fit HQs to existing terrain rather than changing obstacle/RNG generation for a team draw.
function battlefieldStartSites(world: Battlefield): Position[] {
  return world.layout.startSites.map(anchor => {
    const candidates = [anchor, ...Array.from(world.staticGrid, (_, i) => world.point(i))
      .filter(p => distance(p, anchor) <= 22)
      .sort((a, b) => distance(a, anchor) - distance(b, anchor))];
    const site = candidates.find(p => {
      if (Math.abs(p.x) > world.extent - 12 || Math.abs(p.z) > world.extent - 12) return false;
      if (!world.layout.resourceSites.some(r => distance(p, r) <= 23)) return false;
      if (world.surface && (Math.abs(world.surface.heightAt(p.x,p.z) - (world.definition.startHeight ?? world.surface.maxHeight)) > .05 ||
        !world.surface.foundation(p, 7))) return false;
      if (world.layout.resourceSites.some((r, i) => distance(p, r) < 11 ||
        distance(p, {x: r.x + (i ? 7 : 5), z: r.z + (i ? 7 : 18)}) < 8)) return false;
      for (let z = p.z - 7; z <= p.z + 7; z += 1)
        for (let x = p.x - 7; x <= p.x + 7; x += 1)
          if (world.staticGrid[world.idx(x, z)]) return false;
      return true;
    });
    if (!site) throw Error('No clear corner starting area');
    return { ...site };
  });
}

class BattlefieldBuilder {
  readonly random: () => number;
  readonly palette: BattlefieldPalette;
  readonly safe: Position[];
  readonly lanes: [Position, Position][];
  constructor(readonly world: Battlefield) {
    // Preserve the established interleaved ground/obstacle/decor sample order.
    // New cosmetic generators can use cosmeticRandom() without shifting this stream.
    this.random = seeded(world.seed);
    this.palette = world.definition.palette;
    world.renderData = { features: [], groundColors: [], placements: [], geometries: [] };
    this.safe = [
      world.layout.playerStart,
      ...world.layout.enemySites,
      ...world.layout.centralClearings,
      ...world.layout.outerClearings,
      ...world.layout.resourceSites,
      ...world.layout.additionalClearings,
      ...world.layout.corridors.flat().map(([x, z]) => ({ x, z }))
    ];
    this.lanes = [
      ...world.layout.enemySites.map(p => [world.layout.playerStart, p] as [Position, Position]),
      ...world.layout.corridors.flatMap(route =>
        route.slice(1).map((p, i) => [
          { x: route[i][0], z: route[i][1] },
          { x: p[0], z: p[1] }
        ] as [Position, Position])
      )
    ];
  }
  cosmeticRandom(salt: number) { return seeded(this.world.seed ^ salt); }
  color(c: number) { return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]; }
  place = (
    mesh: string, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, color: WorldColor,
    yaw: number, pitch: number, roll: number, glow: number,
    alpha: number, layer: WorldPlacement['layer'], material?: WorldPlacement['material']
  ) => this.world.renderData.placements.push({ mesh, position: [x, y, z], scale: [sx, sy, sz], color,
      rotation: [yaw, pitch, roll], glow, alpha, layer, material });

  ground() {
    const { world, random: rand, palette: bio, place } = this, layout = world.renderData, color = this.color;
    const { extent: EXTENT, cellSize: CELL, gridSize: GRID } = world;
    let base = color(bio.ground);
    for (let z = 0; z < GRID; z++)
      for (let x = 0; x < GRID; x++) {
        let wx = x * CELL - EXTENT,
          wz = z * CELL - EXTENT;
        let wave = Math.sin(wx * 0.053 + wz * 0.024) * 0.065 + Math.cos(wz * 0.13) * 0.035,
          shade = 0.97 + rand() * 0.03 + wave;
        let c = base.map(v => v * shade);
        let i = (z * GRID + x) * 4;
        world.terrainColors[i] = c[0] * 175;
        world.terrainColors[i + 1] = c[1] * 190;
        world.terrainColors[i + 2] = c[2] * 200;
        world.terrainColors[i + 3] = 255;
        layout.groundColors.push(c);
        let c2 = c.map(v => v * (0.99 + rand() * 0.025));
        layout.groundColors.push(c2);
      }
    place('terrain', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0, 0, 1, 'static', world.surface ? 'GROUND' : undefined);
    place('box', 0, -8, 0, EXTENT * 2, 15, EXTENT * 2, 0x242c36, 0, 0, 0, 0, 1, 'static');
  }
  boundary(model: string, material: WorldPlacement['material'], grounded = false) {
    this.world.renderData.geometries.push({ mesh: model, model, seed: this.world.seed, extent: this.world.extent,
      ...(grounded ? {grounded: true} : {}) });
    this.place(model, 0, 0, 0, 1, 1, 1, this.palette.rock, 0, 0, 0, 0, 1, 'static', material);
  }
  smallObstacles() {
    const { world, random: rand, palette: bio, safe, lanes, place } = this, color = this.color;
    const rockTypes = ['rockBoulder', 'rockCrag', 'rockRidge', 'rockShelf', 'rockBoulder'];
    for (let i = 0; i < 115; i++) {
      let x = (rand() - 0.5) * (world.extent * 2 - 14),
        z = (rand() - 0.5) * (world.extent * 2 - 14),
        r = 1.7 + rand() * 4;
      if (
        safe.some(p => distance(p, { x, z }) < r + 11) ||
        lanes.some(([a, b]) => pointSegment({ x, z }, a, b) < r + 5)
      )
        continue;
      world.mark(world.staticGrid, x, z, r);
      world.rocks.push({ x, z, r });
      let h = 6 + rand() * 10,
        type = rockTypes[i % rockTypes.length];
      place(
        type,
        x,
        -0.18,
        z,
        r * 0.88,
        h * 0.8,
        r * 0.78,
        bio.rock,
        rand() * 6,
        0.01 * (rand() - 0.5),
        0.015 * (rand() - 0.5),
        0,
        1,
        'static',
        'ROCK'
      );
      for (let j = 0; j < 4; j++) {
        let a = rand() * 6.28,
          rr = r * (0.6 + rand() * 0.5),
          hh = h * (0.22 + rand() * 0.3);
        place(
          j % 2 ? 'rockShelf' : 'rockBoulder',
          x + Math.cos(a) * rr * 0.45,
          -0.16,
          z + Math.sin(a) * rr * 0.45,
          rr * 0.3,
          hh * 0.75,
          rr * 0.28,
          color(bio.rock).map(v => v * (0.85 + rand() * 0.2)),
          a,
          0,
          0,
          0,
          1,
          'static',
          'ROCK'
        );
      }
      place(
        'rockShelf',
        x,
        -0.17,
        z,
        r * 0.96,
        0.55,
        r * 0.91,
        color(bio.rock).map(v => v * 1.13),
        i * 2.4,
        0,
        0,
        0,
        1,
        'static',
        'ROCK'
      );
    }
  }
  boundaryRocks() {
    const { random: rand, palette: bio, place, world } = this;
    const edge = world.extent - 2;
    const rockTypes = ['rockBoulder', 'rockCrag', 'rockRidge', 'rockShelf', 'rockBoulder'];
    for (let i = 0; i < 62; i++) {
      let side = i % 4,
        pos = (rand() - 0.5) * (world.extent * 2 - 5),
        x = side < 2 ? (side ? edge : -edge) : pos,
        z = side >= 2 ? (side === 2 ? edge : -edge) : pos,
        h = 3 + rand() * 11,
        r = 3 + rand() * 6;
      place(
        rockTypes[(i + 2) % rockTypes.length],
        x,
        -0.3,
        z,
        r,
        h * 0.85,
        r,
        bio.rock,
        rand() * 6,
        0,
        0.1 * (rand() - 0.5),
        0,
        1,
        'static',
        'ROCK'
      );
    }
  }
  rubble(plant?: BattlefieldProp) {
    const { random: rand, palette: bio, safe, place } = this, color = this.color;
    for (let i = 0; i < 470; i++) {
      let x = (rand() - 0.5) * (this.world.extent * 2 - 6),
        z = (rand() - 0.5) * (this.world.extent * 2 - 6);
      if (safe.some(p => distance(p, { x, z }) < 4)) continue;
      let r = 0.1 + rand() * 0.7;
      place(
        i % 5 ? 'octa' : 'box',
        x,
        r * 0.27,
        z,
        r,
        r * 0.4,
        r * 0.8,
        color(bio.rock).map(v => v * (0.68 + rand() * 0.3)),
        rand() * 6,
        0,
        rand() * 0.4,
        0,
        1,
        'static'
      );
      if (i % 6 === 0) plant?.(this, x, z);
    }
  }
  patches(patch: BattlefieldPatch) {
    const rand = this.random;
    for (let i = 0; i < 12; i++) {
      let x = (rand() - 0.5) * (this.world.extent * 2 - 25),
        z = (rand() - 0.5) * (this.world.extent * 2 - 25),
        r = 3 + rand() * 8;
      patch(this, x, z, r);
    }
  }
  debris(prop: BattlefieldProp) {
    const { random: rand, safe } = this;
    // Cargo debris and monumental remains; lanes stay clear but have no road meshes.
    for (let i = 0; i < 22; i++) {
      let x = (rand() - 0.5) * (this.world.extent * 2 - 30),
        z = (rand() - 0.5) * (this.world.extent * 2 - 30);
      if (safe.some(p => distance(p, { x, z }) < 7)) continue;
      prop(this, x, z);
    }
  }
  features(candidate: (rand: () => number, world: Battlefield) => WorldTerrainFeature, model: string, material: WorldPlacement['material']) {
    const world = this.world, { gridSize: GRID, cellSize: CELL } = world;
    const rand = seeded(world.seed ^ 0x57494445),
      protectedSites = [
        { ...world.layout.playerStart, r: 20 }, { ...world.layout.enemySites[0], r: 21 },
        ...battlefieldStartSites(world).slice(2).map(p => ({ ...p, r: 12 })),
        ...world.layout.resourceSites.map(p => ({ ...p, r: 10 })),
        ...world.layout.resourceSites.map((p, i) => ({ x: p.x + (i ? 7 : 5), z: p.z + (i ? 7 : 18), r: 7 }))
      ];
    for (let attempt = 0; attempt < 600 && world.renderData.features.length < 2; attempt++) {
      const m = candidate(rand, world);
      if (m.outline.some(p => Math.max(Math.abs(p.x), Math.abs(p.z)) > world.extent - 9)) continue;
      const minX = Math.min(...m.outline.map(p => p.x)), maxX = Math.max(...m.outline.map(p => p.x)),
        minZ = Math.min(...m.outline.map(p => p.z)), maxZ = Math.max(...m.outline.map(p => p.z));
      const near = (p: Position, radius: number) => {
        if (p.x < minX - radius || p.x > maxX + radius || p.z < minZ - radius || p.z > maxZ + radius)
          return false;
        return insidePolygon(p, m.outline) ||
          m.outline.some((a, i) => pointSegment(p, a, m.outline[(i + 1) % m.outline.length]) < radius);
      };
      if (protectedSites.some(p => near(p, p.r))) continue;
      if (world.renderData.features.some(other => other.outline.some(p => near(p, 9)) ||
          insidePolygon(m, other.outline))) continue;
      const grid = world.staticGrid.slice(), mask = new Uint8Array(grid.length);
      for (let i = 0; i < grid.length; i++) {
        const p = world.point(i);
        if (near(p, CELL * Math.SQRT1_2)) grid[i] = mask[i] = 1;
      }
      // Keep all protected locations connected through passages at least three cells wide.
      const free = new Uint8Array(grid.length), reached = new Uint8Array(grid.length);
      for (let z = 1; z < GRID - 1; z++) for (let x = 1; x < GRID - 1; x++) {
        const i = z * GRID + x;
        free[i] = 1;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
          if (grid[i + dz * GRID + dx]) free[i] = 0;
      }
      const queue = [world.idx(world.layout.playerStart.x, world.layout.playerStart.z)]; reached[queue[0]] = 1;
      for (let head = 0; head < queue.length; head++) {
        const i = queue[head];
        for (const j of [i - 1, i + 1, i - GRID, i + GRID])
          if (free[j] && !reached[j]) { reached[j] = 1; queue.push(j); }
      }
      if (protectedSites.some(p => !queue.some(i => distance(world.point(i), p) <= CELL * 2))) continue;
      const mesh = `${model}${world.renderData.features.length}`;
      world.staticGrid.set(grid);
      for (let i = 0; i < mask.length; i++) world.terrainFeatureGrid[i] |= mask[i];
      world.renderData.features.push(m);
      world.renderData.geometries.push({ mesh, model, feature: m });
      world.renderData.placements.push({ mesh, position: [0, 0, 0], scale: [1, 1, 1],
        color: this.palette.rock, rotation: [0, 0, 0], glow: 0, alpha: 1, layer: 'static', material });
    }
  }
}

// Current shared silhouette only; the validator above accepts other polygon shapes.
function createMassifCandidate(rand: () => number, world: Battlefield): WorldTerrainFeature {
  const span = world.extent * 2 - 56;
  const m: WorldTerrainFeature = {
    x: (rand() - .5) * span, z: (rand() - .5) * span,
    width: 29 + rand() * 9, depth: 17 + rand() * 6, height: 20 + rand() * 7,
    yaw: rand() * Math.PI * 2, seed: Math.floor(rand() * 0x100000000), outline: []
  };
  const shape = seeded(m.seed), phase = shape() * 6.28, cs = Math.cos(m.yaw), sn = Math.sin(m.yaw);
  for (let i = 0; i < 96; i++) {
    const a = i * Math.PI * 2 / 96,
      r = .85 + .08 * Math.sin(a * 3 + phase) + .045 * Math.cos(a * 5 - phase) + .025 * Math.sin(a * 9 + phase),
      x = Math.cos(a) * r * m.width, z = Math.sin(a) * r * m.depth;
    m.outline.push({ x: m.x + cs * x + sn * z, z: m.z - sn * x + cs * z });
  }
  return m;
}

function placeGroundPatch(builder: BattlefieldBuilder, x: number, z: number, r: number) {
  const { random: rand, palette: bio, place } = builder;
  place('cylinder', x, -0.1, z, r, 0.02, r * 0.75, 0x32373e, rand() * 6, 0, 0, 0, 1, 'static');
  place('ring', x, -0.08, z, r, 0.1, r * 0.75, bio.rock, 0, 0, 0, 0, 1, 'static');
}

function placeCargo(builder: BattlefieldBuilder, x: number, z: number) {
  const { random: rand, place } = builder;
  place('box', x, 0.4, z, 1.7, 0.8, 2.4, 0x536068, rand() * 6, 0.06, 0, 0, 1, 'static');
  place('box', x, 0.83, z, 1.8, 0.07, 2.4, 0x8b775c, rand() * 6, 0, 0, 0, 1, 'static');
}
