    /* Seeded battlefields, grid navigation and procedural faction models. */
    'use strict';
    const EXTENT = 90,
      GRID = 72,
      CELL = 2.5;
    const HOME: Position = { x: -51, z: 49 };
    const ENEMY_SITES: Position[] = [
      { x: 49, z: -49 },
      { x: -47, z: -45 },
      { x: 51, z: 19 }
    ];
    const CENTRAL_CLEARINGS: Position[] = [
      { x: -32, z: -13 },
      { x: 11, z: 6 },
      { x: 39, z: -35 },
      { x: -12, z: -55 }
    ];
    const OUTER_CLEARINGS: Position[] = [
      { x: -48, z: 3 },
      { x: -21, z: -43 },
      { x: 16, z: -23 },
      { x: 51, z: 0 },
      { x: 34, z: 47 }
    ];
    const RESOURCE_SITES: Position[] = [
      { x: -67, z: 43 },
      { x: -25, z: 27 },
      { x: 6, z: 40 },
      { x: -57, z: -25 },
      { x: 27, z: -51 },
      { x: 65, z: 6 },
      { x: 29, z: 64 },
      { x: 7, z: -65 }
    ];
    const TERRAIN_CORRIDORS: [number, number][][] = [
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
    ];
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.z - b.z);
    const angleLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, t);
    const pointSegment = (p: Position, a: Position, b: Position) => {
      let dx = b.x - a.x,
        dz = b.z - a.z,
        t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
    };
    class Heap {
      declare a: [number, number][];

      constructor() {
        this.a = [];
      }
      push(n: number, p: number) {
        let a = this.a,
          i = a.length;
        a.push([n, p]);
        while (i > 0) {
          let q = (i - 1) >> 1;
          if (a[q][1] <= p) break;
          [a[q], a[i]] = [a[i], a[q]];
          i = q;
        }
      }
      pop() {
        let a = this.a,
          first = a[0],
          last = a.pop();
        if (a.length) {
          a[0] = last!;
          let i = 0;
          while (true) {
            let l = i * 2 + 1,
              r = l + 1,
              j = i;
            if (l < a.length && a[l][1] < a[j][1]) j = l;
            if (r < a.length && a[r][1] < a[j][1]) j = r;
            if (j === i) break;
            [a[i], a[j]] = [a[j], a[i]];
            i = j;
          }
        }
        return first![0];
      }
      get length() {
        return this.a.length;
      }
    }
    class Battlefield {
      declare fogVersion: number;
      declare seed: number;
      declare biome: BiomeDefinition;
      declare staticGrid: Uint8Array;
      declare blocked: Uint8Array;
      declare explored: Uint8Array;
      declare visible: Uint8Array;
      declare fogPixels: Uint8Array;
      declare terrainColors: Uint8ClampedArray;
      declare rocks: WorldRock[];
      declare pathVersion: number;
      declare renderData: WorldRenderData;

      constructor(seed: number, biome: BiomeType) {
        this.fogVersion = 0;
        this.seed = seed;
        this.biome = BIOMES[biome] || BIOMES.ash;
        this.staticGrid = new Uint8Array(GRID * GRID);
        this.blocked = new Uint8Array(GRID * GRID);
        this.explored = new Uint8Array(GRID * GRID);
        this.visible = new Uint8Array(GRID * GRID);
        this.fogPixels = new Uint8Array(GRID * GRID);
        this.terrainColors = new Uint8ClampedArray(GRID * GRID * 4);
        this.rocks = [];
        this.pathVersion = 0;
        this.generate();
        this.blocked.set(this.staticGrid);
      }
      idx(x: number, z: number) {
        return (
          clamp(Math.floor((z + EXTENT) / CELL), 0, GRID - 1) * GRID +
          clamp(Math.floor((x + EXTENT) / CELL), 0, GRID - 1)
        );
      }
      point(i: number): Position {
        return {
          x: ((i % GRID) + 0.5) * CELL - EXTENT,
          z: (Math.floor(i / GRID) + 0.5) * CELL - EXTENT
        };
      }
      mark(grid: Uint8Array, x: number, z: number, r: number, val = 1) {
        let a = Math.max(0, Math.floor((x - r + EXTENT) / CELL)),
          b = Math.min(GRID - 1, Math.floor((x + r + EXTENT) / CELL)),
          c = Math.max(0, Math.floor((z - r + EXTENT) / CELL)),
          d = Math.min(GRID - 1, Math.floor((z + r + EXTENT) / CELL));
        for (let j = c; j <= d; j++)
          for (let i = a; i <= b; i++) {
            let dx = (i + 0.5) * CELL - EXTENT - x,
              dz = (j + 0.5) * CELL - EXTENT - z;
            if (dx * dx + dz * dz < (r + CELL * 0.4) ** 2) grid[j * GRID + i] = val;
          }
      }
      blockedAt(x: number, z: number) {
        return (
          Math.abs(x) > EXTENT - 3 || Math.abs(z) > EXTENT - 3 || this.blocked[this.idx(x, z)] !== 0
        );
      }
      rebuild(entities: Entity[]) {
        this.blocked.set(this.staticGrid);
        for (let e of entities)
          if (e.hp > 0 && e.kind === 'building') this.mark(this.blocked, e.x, e.z, e.size + 0.35);
        this.pathVersion++;
      }
      nearest(x: number, z: number): Position {
        let i = this.idx(x, z);
        if (!this.blocked[i]) return { x: clamp(x, -86, 86), z: clamp(z, -86, 86) };
        let gx = i % GRID,
          gz = Math.floor(i / GRID),
          best = null,
          dd = 1e9;
        for (let r = 1; r < 15; r++) {
          for (let dz = -r; dz <= r; dz++)
            for (let dx = -r; dx <= r; dx++) {
              if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
              let nx = gx + dx,
                nz = gz + dz;
              if (nx < 1 || nz < 1 || nx >= GRID - 1 || nz >= GRID - 1) continue;
              let id = nz * GRID + nx;
              if (this.blocked[id]) continue;
              let p = this.point(id),
                d = (p.x - x) ** 2 + (p.z - z) ** 2;
              if (d < dd) {
                dd = d;
                best = p;
              }
            }
          if (best) return best;
        }
        return { x: clamp(x, -84, 84), z: clamp(z, -84, 84) };
      }
      lineFree(a: Position, b: Position) {
        let d = distance(a, b),
          n = Math.ceil(d / 1.4);
        for (let i = 1; i <= n; i++) {
          let t = i / n;
          if (this.blockedAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
        }
        return true;
      }
      path(x: number, z: number, tx: number, tz: number, air = false): Position[] {
        tx = clamp(tx, -85, 85);
        tz = clamp(tz, -85, 85);
        if (air) return [{ x: tx, z: tz }];
        let target = this.nearest(tx, tz),
          start = { x, z };
        if (this.lineFree(start, target)) return [target];
        let s = this.idx(x, z),
          end = this.idx(target.x, target.z);
        if (s === end) return [target];
        let cost = new Float32Array(GRID * GRID);
        cost.fill(Infinity);
        cost[s] = 0;
        let parent = new Int32Array(GRID * GRID);
        parent.fill(-1);
        let closed = new Uint8Array(GRID * GRID),
          heap = new Heap();
        heap.push(s, 0);
        let ex = end % GRID,
          ez = Math.floor(end / GRID),
          found = false,
          tries = 0,
          best = s,
          bestDistance = Infinity;
        const steps: [number, number, number][] = [
          [-1, 0, 1],
          [1, 0, 1],
          [0, -1, 1],
          [0, 1, 1],
          [-1, -1, 1.414],
          [1, -1, 1.414],
          [-1, 1, 1.414],
          [1, 1, 1.414]
        ];
        while (heap.length && tries++ < 5600) {
          let i = heap.pop();
          if (closed[i]) continue;
          let targetDistance = ((i % GRID) - ex) ** 2 + (Math.floor(i / GRID) - ez) ** 2;
          if (targetDistance < bestDistance) {
            bestDistance = targetDistance;
            best = i;
          }
          if (i === end) {
            found = true;
            break;
          }
          closed[i] = 1;
          let gx = i % GRID,
            gz = Math.floor(i / GRID);
          for (let [dx, dz, w] of steps) {
            let xx = gx + dx,
              zz = gz + dz;
            if (xx < 1 || zz < 1 || xx >= GRID - 1 || zz >= GRID - 1) continue;
            let q = zz * GRID + xx;
            if (closed[q] || this.blocked[q]) continue;
            if (dx && dz && (this.blocked[gz * GRID + xx] || this.blocked[zz * GRID + gx])) continue;
            let nc = cost[i] + w;
            if (nc < cost[q]) {
              cost[q] = nc;
              parent[q] = i;
              let ax = Math.abs(ex - xx),
                az = Math.abs(ez - zz);
              heap.push(q, nc + Math.max(ax, az) + 0.414 * Math.min(ax, az));
            }
          }
        }
        if (!found) {
          if (best === s || bestDistance > 25) return [];
          end = best;
          target = this.point(best);
        }
        let nodes: Position[] = [],
          i = end;
        while (i !== s && i >= 0) {
          nodes.push(this.point(i));
          i = parent[i];
        }
        nodes.reverse();
        nodes.push(target);
        let smooth: Position[] = [],
          anchor = start,
          j = 0;
        while (j < nodes.length) {
          let k = j;
          while (k + 1 < nodes.length && this.lineFree(anchor, nodes[k + 1])) k++;
          smooth.push(nodes[k]);
          anchor = nodes[k];
          j = k + 1;
        }
        return smooth;
      }
      generate() {
        const rand = seeded(this.seed),
          bio = this.biome;
        // Keep cosmetic samples interleaved with obstacle sampling for save compatibility.
        // These are CPU descriptors, not meshes or renderer calls.
        const layout: WorldRenderData = this.renderData = { groundColors: [], placements: [] };
        const color = (c: number) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
        const place = (
          mesh: string, x: number, y: number, z: number,
          sx: number, sy: number, sz: number, color: WorldColor,
          yaw: number, pitch: number, roll: number, glow: number,
          alpha: number, layer: string, material?: string
        ) => layout.placements.push({ mesh, position: [x, y, z], scale: [sx, sy, sz], color,
            rotation: [yaw, pitch, roll], glow, alpha, layer, material });
        let base = color(bio.ground);
        for (let z = 0; z < GRID; z++)
          for (let x = 0; x < GRID; x++) {
            let wx = x * CELL - EXTENT,
              wz = z * CELL - EXTENT;
            let wave = Math.sin(wx * 0.053 + wz * 0.024) * 0.065 + Math.cos(wz * 0.13) * 0.035,
              shade = 0.97 + rand() * 0.03 + wave;
            let c = base.map(v => v * shade);
            let i = (z * GRID + x) * 4;
            this.terrainColors[i] = c[0] * 175;
            this.terrainColors[i + 1] = c[1] * 190;
            this.terrainColors[i + 2] = c[2] * 200;
            this.terrainColors[i + 3] = 255;
            layout.groundColors.push(c);
            let c2 = c.map(v => v * (0.99 + rand() * 0.025));
            layout.groundColors.push(c2);
          }
        place('terrain', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0, 0, 1, 'static');
        place('box', 0, -8, 0, 180, 15, 180, 0x242c36, 0, 0, 0, 0, 1, 'static');
        let safe = [
          HOME,
          ...ENEMY_SITES,
          ...CENTRAL_CLEARINGS,
          ...OUTER_CLEARINGS,
          ...RESOURCE_SITES,
          { x: -40, z: 62 },
          { x: -51, z: 63 },
          { x: -63, z: 60 },
          { x: -37, z: 67 },
          { x: -27, z: 61 },
          { x: -27, z: 72 },
          { x: 0, z: 0 },
          ...TERRAIN_CORRIDORS.flat().map(([x, z]) => ({ x, z }))
        ];
        let lanes: [Position, Position][] = [
          [HOME, ENEMY_SITES[0]],
          [HOME, ENEMY_SITES[1]],
          [HOME, ENEMY_SITES[2]],
          ...TERRAIN_CORRIDORS.flatMap(route =>
            route.slice(1).map((p, i) => [
              { x: route[i][0], z: route[i][1] },
              { x: p[0], z: p[1] }
            ] as [Position, Position])
          )
        ];
        // Preserve layout RNG calls and obstacle radii, including for existing saved games.
        const rockTypes = ['rockBoulder', 'rockCrag', 'rockRidge', 'rockShelf', 'rockBoulder'];
        for (let i = 0; i < 115; i++) {
          let x = (rand() - 0.5) * 166,
            z = (rand() - 0.5) * 166,
            r = 1.7 + rand() * 4;
          if (
            safe.some(p => distance(p, { x, z }) < r + 11) ||
            lanes.some(([a, b]) => pointSegment({ x, z }, a, b) < r + 5)
          )
            continue;
          this.mark(this.staticGrid, x, z, r);
          this.rocks.push({ x, z, r });
          let h = 2 + rand() * 8,
            type = rockTypes[i % rockTypes.length];
          place(
            type,
            x,
            -0.18,
            z,
            r * 0.88,
            h * 0.7,
            r * 0.78,
            bio.rock,
            rand() * 6,
            0.1 * (rand() - 0.5),
            0.15 * (rand() - 0.5),
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
              0.1,
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
        for (let i = 0; i < 62; i++) {
          let side = i % 4,
            pos = (rand() - 0.5) * 175,
            x = side < 2 ? (side ? 88 : -88) : pos,
            z = side >= 2 ? (side === 2 ? 88 : -88) : pos,
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
        for (let i = 0; i < 470; i++) {
          let x = (rand() - 0.5) * 174,
            z = (rand() - 0.5) * 174;
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
          if (i % 6 === 0 && bio === BIOMES.choir) {
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
        }
        for (let i = 0; i < 12; i++) {
          let x = (rand() - 0.5) * 155,
            z = (rand() - 0.5) * 155,
            r = 3 + rand() * 8;
          if (bio === BIOMES.choir) {
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
          } else {
            place(
              'cylinder',
              x,
              -0.1,
              z,
              r,
              0.02,
              r * 0.75,
              0x32373e,
              rand() * 6,
              0,
              0,
              0,
              1,
              'static'
            );
            place('ring', x, -0.08, z, r, 0.1, r * 0.75, bio.rock, 0, 0, 0, 0, 1, 'static');
          }
        }
        // Weathered roads, cargo debris, and monumental remains frame the combat lanes.
        for (let [a, b] of lanes.slice(0, 3)) {
          let len = distance(a, b),
            ang = Math.atan2(b.x - a.x, b.z - a.z);
          place(
            'plane',
            (a.x + b.x) / 2,
            -0.07,
            (a.z + b.z) / 2,
            5.8,
            0.1,
            len,
            color(bio.ground).map(v => v * 1.055),
            ang,
            0,
            0,
            0,
            1,
            'static'
          );
          place(
            'plane',
            (a.x + b.x) / 2,
            -0.06,
            (a.z + b.z) / 2,
            4.6,
            0.1,
            len,
            color(bio.ground).map(v => v * 0.92),
            ang,
            0,
            0,
            0,
            1,
            'static'
          );
          for (let j = 0; j < len; j += 9) {
            let t = j / len;
            place(
              'plane',
              a.x + (b.x - a.x) * t,
              -0.045,
              a.z + (b.z - a.z) * t,
              0.1,
              0.1,
              1.5,
              0x847c63,
              ang,
              0,
              0,
              0,
              1,
              'static'
            );
          }
        }
        for (let i = 0; i < 22; i++) {
          let x = (rand() - 0.5) * 150,
            z = (rand() - 0.5) * 150;
          if (safe.some(p => distance(p, { x, z }) < 7)) continue;
          if (bio === BIOMES.court || bio === BIOMES.star) {
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
          } else {
            place('box', x, 0.4, z, 1.7, 0.8, 2.4, 0x536068, rand() * 6, 0.06, 0, 0, 1, 'static');
            place('box', x, 0.83, z, 1.8, 0.07, 2.4, 0x8b775c, rand() * 6, 0, 0, 0, 1, 'static');
          }
        }
      }
      reveal(entities: Entity[], scans: Scan[] = []) {
        this.visible.fill(0);
        for (let e of entities)
          if (e.hp > 0 && e.team === 0 && e.kind !== 'resource') {
            let r = e.vision || (e.kind === 'building' ? 21 : 17);
            this.mark(this.visible, e.x, e.z, r, 255);
          }
        for (let s of scans) this.mark(this.visible, s.x, s.z, s.r || 31, 255);
        for (let i = 0; i < this.visible.length; i++) {
          if (this.visible[i]) this.explored[i] = 1;
          this.fogPixels[i] = this.visible[i] ? 255 : this.explored[i] ? 80 : 0;
        }
        this.fogVersion++;
      }
    }
