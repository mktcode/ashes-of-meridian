    /* Seeded battlefields, grid navigation and procedural faction models. */
    'use strict';
    const EXTENT = 90,
      GRID = 72,
      CELL = 2.5;
    const HOME = { x: -51, z: 49 };
    const ENEMY_SITES = [
      { x: 49, z: -49 },
      { x: -47, z: -45 },
      { x: 51, z: 19 }
    ];
    const RELAY_SITES = [
      { x: -32, z: -13 },
      { x: 11, z: 6 },
      { x: 39, z: -35 },
      { x: -12, z: -55 }
    ];
    const CACHE_SITES = [
      { x: -48, z: 3 },
      { x: -21, z: -43 },
      { x: 16, z: -23 },
      { x: 51, z: 0 },
      { x: 34, z: 47 }
    ];
    const RESOURCE_SITES = [
      { x: -67, z: 43 },
      { x: -25, z: 27 },
      { x: 6, z: 40 },
      { x: -57, z: -25 },
      { x: 27, z: -51 },
      { x: 65, z: 6 },
      { x: 29, z: 64 },
      { x: 7, z: -65 }
    ];
    const ROUTES = [
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
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, t);
    const pointSegment = (p, a, b) => {
      let dx = b.x - a.x,
        dz = b.z - a.z,
        t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
    };
    class Heap {
      constructor() {
        this.a = [];
      }
      push(n, p) {
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
          a[0] = last;
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
        return first[0];
      }
      get length() {
        return this.a.length;
      }
    }
    class Battlefield {
      constructor(renderer, seed, biome) {
        this.R = renderer;
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
      idx(x, z) {
        return (
          clamp(Math.floor((z + EXTENT) / CELL), 0, GRID - 1) * GRID +
          clamp(Math.floor((x + EXTENT) / CELL), 0, GRID - 1)
        );
      }
      point(i) {
        return {
          x: ((i % GRID) + 0.5) * CELL - EXTENT,
          z: (Math.floor(i / GRID) + 0.5) * CELL - EXTENT
        };
      }
      mark(grid, x, z, r, val = 1) {
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
      blockedAt(x, z) {
        return (
          Math.abs(x) > EXTENT - 3 || Math.abs(z) > EXTENT - 3 || this.blocked[this.idx(x, z)] !== 0
        );
      }
      rebuild(entities) {
        this.blocked.set(this.staticGrid);
        for (let e of entities)
          if (e.hp > 0 && e.kind === 'building') this.mark(this.blocked, e.x, e.z, e.size + 0.35);
        this.pathVersion++;
      }
      nearest(x, z) {
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
      lineFree(a, b) {
        let d = distance(a, b),
          n = Math.ceil(d / 1.4);
        for (let i = 1; i <= n; i++) {
          let t = i / n;
          if (this.blockedAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
        }
        return true;
      }
      path(x, z, tx, tz, air = false) {
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
        const steps = [
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
        let nodes = [],
          i = end;
        while (i !== s && i >= 0) {
          nodes.push(this.point(i));
          i = parent[i];
        }
        nodes.reverse();
        nodes.push(target);
        let smooth = [],
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
        const R = this.R,
          rand = seeded(this.seed),
          bio = this.biome;
        R.clearStatic();
        R.haze = bio.haze;
        R.extent = EXTENT;
        let data = [],
          base = R.color(bio.ground);
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
            geom.tri(
              data,
              [wx, -0.13, wz],
              [wx, -0.13, wz + CELL],
              [wx + CELL, -0.13, wz + CELL],
              c,
              [0, 1, 0]
            );
            let c2 = c.map(v => v * (0.99 + rand() * 0.025));
            geom.tri(
              data,
              [wx, -0.13, wz],
              [wx + CELL, -0.13, wz + CELL],
              [wx + CELL, -0.13, wz],
              c2,
              [0, 1, 0]
            );
          }
        R.geometry('terrain', data);
        R.add('terrain', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0, 0, 1, 'static');
        R.add('box', 0, -8, 0, 180, 15, 180, 0x242c36, 0, 0, 0, 0, 1, 'static');
        let safe = [
          HOME,
          ...ENEMY_SITES,
          ...RELAY_SITES,
          ...CACHE_SITES,
          ...RESOURCE_SITES,
          { x: -40, z: 62 },
          { x: -51, z: 63 },
          { x: -63, z: 60 },
          { x: -37, z: 67 },
          { x: -27, z: 61 },
          { x: -27, z: 72 },
          { x: 0, z: 0 },
          ...ROUTES.flat().map(([x, z]) => ({ x, z }))
        ];
        let lanes = [
          [HOME, ENEMY_SITES[0]],
          [HOME, ENEMY_SITES[1]],
          [HOME, ENEMY_SITES[2]],
          ...ROUTES.flatMap(route =>
            route.slice(1).map((p, i) => [
              { x: route[i][0], z: route[i][1] },
              { x: p[0], z: p[1] }
            ])
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
          R.add(
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
            MAT.ROCK
          );
          for (let j = 0; j < 4; j++) {
            let a = rand() * 6.28,
              rr = r * (0.6 + rand() * 0.5),
              hh = h * (0.22 + rand() * 0.3);
            R.add(
              j % 2 ? 'rockShelf' : 'rockBoulder',
              x + Math.cos(a) * rr * 0.45,
              -0.16,
              z + Math.sin(a) * rr * 0.45,
              rr * 0.3,
              hh * 0.75,
              rr * 0.28,
              R.color(bio.rock).map(v => v * (0.85 + rand() * 0.2)),
              a,
              0,
              0.1,
              0,
              1,
              'static',
              MAT.ROCK
            );
          }
          R.add(
            'rockShelf',
            x,
            -0.17,
            z,
            r * 0.96,
            0.55,
            r * 0.91,
            R.color(bio.rock).map(v => v * 1.13),
            i * 2.4,
            0,
            0,
            0,
            1,
            'static',
            MAT.ROCK
          );
        }
        for (let i = 0; i < 62; i++) {
          let side = i % 4,
            pos = (rand() - 0.5) * 175,
            x = side < 2 ? (side ? 88 : -88) : pos,
            z = side >= 2 ? (side === 2 ? 88 : -88) : pos,
            h = 3 + rand() * 11,
            r = 3 + rand() * 6;
          R.add(
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
            MAT.ROCK
          );
        }
        for (let i = 0; i < 470; i++) {
          let x = (rand() - 0.5) * 174,
            z = (rand() - 0.5) * 174;
          if (safe.some(p => distance(p, { x, z }) < 4)) continue;
          let r = 0.1 + rand() * 0.7;
          R.add(
            i % 5 ? 'octa' : 'box',
            x,
            r * 0.27,
            z,
            r,
            r * 0.4,
            r * 0.8,
            R.color(bio.rock).map(v => v * (0.68 + rand() * 0.3)),
            rand() * 6,
            0,
            rand() * 0.4,
            0,
            1,
            'static'
          );
          if (i % 6 === 0 && bio === BIOMES.choir) {
            let h = 0.6 + rand() * 1.5;
            R.add('cone', x, h / 2, z, 0.09, h, 0.09, bio.flora, 0, 0, rand() * 0.5, 0, 1, 'static');
            R.add('sphere', x, h, z, 0.45, 0.23, 0.45, bio.accent, 0, 0, 0, 0.25, 1, 'static');
            for (let k = 0; k < 3; k++)
              R.add(
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
            R.add(
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
            R.add('ring', x, -0.09, z, r, 0.1, r * 0.55, 0x608b82, 0, 0, 0, 0.1, 0.4, 'static');
          } else {
            R.add(
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
            R.add('ring', x, -0.08, z, r, 0.1, r * 0.75, bio.rock, 0, 0, 0, 0, 1, 'static');
          }
        }
        // Weathered roads, cargo debris, and monumental remains frame the combat lanes.
        for (let [a, b] of lanes.slice(0, 3)) {
          let len = distance(a, b),
            ang = Math.atan2(b.x - a.x, b.z - a.z);
          R.add(
            'plane',
            (a.x + b.x) / 2,
            -0.07,
            (a.z + b.z) / 2,
            5.8,
            0.1,
            len,
            R.color(bio.ground).map(v => v * 1.055),
            ang,
            0,
            0,
            0,
            1,
            'static'
          );
          R.add(
            'plane',
            (a.x + b.x) / 2,
            -0.06,
            (a.z + b.z) / 2,
            4.6,
            0.1,
            len,
            R.color(bio.ground).map(v => v * 0.92),
            ang,
            0,
            0,
            0,
            1,
            'static'
          );
          for (let j = 0; j < len; j += 9) {
            let t = j / len;
            R.add(
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
            R.add(
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
            R.add('octa', x, h + 0.5, z, 0.6, 1, 0.6, bio.accent, 0, 0, 0.2, 0.22, 1, 'static');
          } else {
            R.add('box', x, 0.4, z, 1.7, 0.8, 2.4, 0x536068, rand() * 6, 0.06, 0, 0, 1, 'static');
            R.add('box', x, 0.83, z, 1.8, 0.07, 2.4, 0x8b775c, rand() * 6, 0, 0, 0, 1, 'static');
          }
        }
      }
      reveal(entities, scans = []) {
        this.visible.fill(0);
        for (let e of entities)
          if (e.hp > 0 && !e.evacuated && (e.team === 0 || e.team === 2) && e.kind !== 'resource') {
            let r = e.vision || (e.kind === 'building' ? 21 : 17);
            this.mark(this.visible, e.x, e.z, r, 255);
          }
        for (let s of scans) this.mark(this.visible, s.x, s.z, s.r || 31, 255);
        for (let i = 0; i < this.visible.length; i++) {
          if (this.visible[i]) this.explored[i] = 1;
          this.fogPixels[i] = this.visible[i] ? 255 : this.explored[i] ? 80 : 0;
        }
        this.R.fog(this.fogPixels);
      }
    }
    // Cosmetic building yaw only; placement, collision radii and save data stay unchanged.
    const BUILDING_YAW = Math.PI / 15;
    function renderEntity(R, e, time, options = {}) {
      if (e.hp <= 0) return;
      const f = FACTIONS[e.faction || 0],
        enemy = e.team === 1,
        friend = e.team === 2;
      let team = enemy ? 0xe98680 : friend ? 0xa1e6ac : f.color,
        accent = enemy ? 0xffaf87 : f.accent;
      let metal = f.metal,
        dark = f.dark;
      const rot = e.kind === 'building' ? (enemy ? Math.PI : 0) + BUILDING_YAW : e.rot || 0,
        cs = Math.cos(rot),
        sn = Math.sin(rot);
      let y =
        e.type === 'air'
          ? 3.8 + Math.sin(time * 2 + e.id) * 0.22
          : e.faction === 2 && e.kind === 'unit'
            ? 0.3 + Math.sin(time * 2 + e.id) * 0.08
            : 0;
      let layer = options.layer || 'dynamic',
        alpha = options.alpha === undefined ? 1 : options.alpha;
      let build = e.kind === 'building' ? Math.max(0.15, e.progress === undefined ? 1 : e.progress) : 1;
      if (options.tint) {
        metal = team = options.tint;
        dark = options.tint;
      }
      let ghost = options.ghost;
      if (ghost) {
        metal = 0x68717d;
        dark = 0x3b424c;
      }
      let surfaceMat =
        options.material !== undefined
          ? options.material
          : e.kind === 'building' || e.kind === 'unit' || e.kind === 'objective'
            ? e.faction === 1
              ? MAT.BIO
              : MAT.METAL
            : MAT.AUTO;
      const p = (
        shape,
        lx,
        ly,
        lz,
        sx,
        sy,
        sz,
        c,
        ry = 0,
        rx = 0,
        rz = 0,
        glow = 0,
        a = alpha,
        m = surfaceMat
      ) => {
        R.add(
          shape,
          e.x + lx * cs + lz * sn,
          y + ly * build,
          e.z - lx * sn + lz * cs,
          sx,
          sy * build,
          sz,
          c,
          rot + ry,
          rx,
          rz,
          glow,
          a,
          layer,
          m
        );
      };
      const ring = (radius, h, color = team, a = 0.7, rx = 0, ry = 0) =>
        R.add('ring', e.x, y + h, e.z, radius, 1, radius, color, ry, rx, 0, 1.2, a, 'effects');
      if (e.kind === 'resource') {
        if (e.type === 'crystal') {
          // Cosmetic RNG only: stable per deposit, independent of time, saves and mining RNG.
          const rand = seeded(Math.imul(e.id || 0, 0x45d9f3b) ^ 0x61c88647),
            scale = 0.55 + 0.45 * Math.min(1, Math.max(0, e.amount ?? 1800) / 1800);
          const phase = rand() * Math.PI * 2,
            count = 9 + Math.floor(rand() * 4),
            colors = [0xe7b969, 0xdba14c, 0xf0ca80, 0xc89149];
          p('rockShelf', 0, -0.06, 0, 1.72, 0.65, 1.48, 0x65605a, phase, 0, 0, 0, alpha, MAT.ROCK);
          for (let i = 0; i < count; i++) {
            let a = phase + i * 2.39996 + (rand() - 0.5) * 0.35,
              r = i < 3 ? 0.2 + rand() * 0.28 : 0.7 + rand() * 0.35;
            let h =
                (i === 0 ? 2.8 + rand() * 0.4 : i < 3 ? 1.8 + rand() * 0.7 : 0.65 + rand() * 0.95) *
                scale,
              w = (i < 3 ? 0.34 + rand() * 0.12 : 0.15 + rand() * 0.16) * (0.75 + 0.25 * scale);
            let lean = i < 3 ? 0.04 + rand() * 0.09 : 0.12 + rand() * 0.23,
              c = colors[Math.floor(rand() * colors.length)];
            p(
              'alloyShard',
              Math.sin(a) * r,
              0.12,
              Math.cos(a) * r,
              w,
              h,
              w * (i % 3 === 0 ? 0.58 : 0.82),
              c,
              a,
              lean * Math.cos(a),
              -lean * Math.sin(a),
              0.18 + rand() * 0.08,
              alpha,
              MAT.CRYSTAL
            );
          }
          for (let i = 0; i < 3; i++) {
            let a = phase + i * 2.1,
              r = 1.12 + rand() * 0.2,
              w = 0.13 + rand() * 0.08;
            p(
              'alloyShard',
              Math.sin(a) * r,
              0.04,
              Math.cos(a) * r,
              w,
              (0.18 + rand() * 0.23) * scale,
              w * 0.65,
              colors[i],
              a,
              0.45,
              0.25,
              0.12,
              alpha,
              MAT.CRYSTAL
            );
          }
        } else {
          p('hex', 0, 0.12, 0, 2, 0.32, 1.8, 0x404657);
          p('hex', 0, 0.35, 0, 1.2, 0.6, 1.1, 0x546577);
          p('octa', 0, 0.85, 0, 0.55, 0.8, 0.55, 0x8be1d9, time * 0.15, 0, 0, 1.15);
          for (let i = 0; i < 3; i++) {
            let t = (time * 0.35 + i * 0.33) % 1;
            R.add(
              'sphere',
              e.x + Math.sin(time + i) * 0.3,
              0.6 + t * 3,
              e.z,
              0.35 + t * 0.8,
              0.4 + t * 0.6,
              0.35 + t * 0.8,
              0x88ddd3,
              0,
              0,
              0,
              0.5,
              (1 - t) * 0.12,
              'effects'
            );
          }
        }
        return;
      }
      if (e.kind === 'objective') {
        let c = e.owner === 0 ? f.color : e.owner === 1 ? 0xee8b83 : 0xe7c08c;
        if (e.type === 'cache') {
          p('box', 0, 0.7, 0, 2, 1.4, 1.5, 0x405765);
          p('box', 0, 1.44, 0, 2.08, 0.12, 1.6, 0xc4aa7e);
          p('box', 0, 0.8, 0.79, 1.35, 0.18, 0.08, c, 0, 0, 0, 1.2);
          p('octa', 0, 2.4 + Math.sin(time * 2) * 0.15, 0, 0.4, 0.7, 0.4, c, time, 0, 0, 1.2);
          ring(3, 0.08, c, 0.55);
        } else {
          p('hex', 0, 0.22, 0, 3.2, 0.5, 3.2, 0x74747c);
          p('hex', 0, 0.5, 0, 2.7, 0.12, 2.7, dark);
          p('hex', 0, 1.2, 0, 0.8, 1.5, 0.8, 0x9a979f);
          p(
            'octa',
            0,
            3.1 + Math.sin(time * 1.3 + e.id) * 0.18,
            0,
            0.8,
            1.35,
            0.8,
            c,
            time * 0.3,
            0,
            0,
            0.9
          );
          for (let i = 0; i < 3; i++) {
            let a = (i * Math.PI * 2) / 3;
            p('box', Math.sin(a) * 2.2, 1.15, Math.cos(a) * 2.2, 0.45, 2.0, 0.6, 0x9896a0, a);
            p('box', Math.sin(a) * 2.2, 2.25, Math.cos(a) * 2.2, 0.46, 0.12, 0.61, c, a, 0, 0, 1);
          }
          ring(3.55, 0.08, c, 0.7);
          R.add('ring', e.x, 3.1, e.z, 1.5, 1, 1.5, c, time * 0.3, Math.PI / 2, 0, 1, 0.6, 'effects');
        }
        if (e.progress > 0 && e.progress < 1) ring(4.1, 0.1, c, 0.5);
        return;
      }
      if (e.type === 'avatar') {
        let t = time * 0.45;
        p('hex', 0, 0.25, 0, 4, 0.5, 4, dark);
        p('sphere', 0, 5 + Math.sin(t) * 0.4, 0, 2.4, 2.8, 2.4, 0x1c1c30);
        p('octa', 0, 5.2, 0, 1.3, 2.2, 1.3, accent, t, 0, 0, 1.1);
        for (let i = 0; i < 6; i++) {
          let a = (i * Math.PI) / 3 + t * 0.15,
            x = Math.sin(a) * 3.8,
            z = Math.cos(a) * 3.8;
          p('octa', x, 4.5 + Math.sin(t + i) * 0.5, z, 0.8, 3.2, 0.6, metal, a, 0.2, 0.28);
          p('octa', x, 7.2, z, 0.3, 0.8, 0.3, team, a, 0, 0, 1);
          R.beam([e.x + x, 3, e.z + z], [e.x, 5, e.z], 0.045, accent, 0.9, 0.5);
        }
        ring(4.8, 0.15, accent, 0.65);
        if (e.invulnerable)
          R.add('sphere', e.x, 4.2, e.z, 5.3, 6, 5.3, 0xada0e4, 0, 0, 0, 0.7, 0.13, 'effects');
        return;
      }
      if (e.kind === 'building') {
        let s = e.size || 3;
        p('hex', 0, 0.15, 0, s * 1.09, 0.3, s * 1.09, 0x384552, 0.12);
        p('ring', 0, 0.33, 0, s * 1.03, 0.1, s * 1.03, team, 0, 0, 0, 0.4);
        if (e.faction === 1) {
          let h = e.type === 'hq' ? 5 : e.type === 'turret' ? 5.8 : e.type === 'depot' ? 2.8 : 3.8;
          p('sphere', 0, h * 0.44, 0, s * 0.8, h * 0.57, s * 0.78, metal);
          p('octa', 0, h * 0.77, 0, s * 0.5, h * 0.65, s * 0.5, dark, 0.3);
          for (let i = 0; i < 6; i++) {
            let a = (i * Math.PI) / 3,
              x = Math.sin(a) * s * 0.8,
              z = Math.cos(a) * s * 0.8;
            p('cone', x, 0.7, z, 0.5, 2, 0.5, dark, a, 0.25, 0.42);
            p('sphere', x * 0.8, h * 0.63, z * 0.8, 0.45, 0.8, 0.45, team, a, 0, 0.3, 0.28);
          }
          p(
            'octa',
            0,
            h + Math.sin(time + e.id) * 0.14,
            0,
            s * 0.3,
            1.3,
            s * 0.3,
            accent,
            time * 0.22,
            0,
            0,
            0.85
          );
          if (e.type === 'turret') p('cone', 0, h + 1.2, 0, 0.4, 2, 0.4, accent, 0, 0, 0, 0.5);
          if (e.type === 'refinery')
            for (let i = 0; i < 3; i++)
              p(
                'sphere',
                Math.sin(i * 2) * 1.4,
                2.5,
                Math.cos(i * 2) * 1.4,
                0.7,
                1.5,
                0.7,
                0x86b6a0,
                0,
                0,
                0,
                0.3
              );
          if (e.type === 'hangar') ring(s * 0.8, h * 0.9, accent, 0.7);
          if (e.type === 'lab') ring(s * 0.7, h + 1, accent, 0.7, Math.PI / 2, time * 0.2);
        } else if (e.faction === 2) {
          let h = e.type === 'hq' ? 7.8 : e.type === 'turret' ? 6.5 : e.type === 'depot' ? 3.3 : 5.5;
          p('hex', 0, 0.55, 0, s * 0.8, 0.5, s * 0.8, metal);
          p('octa', 0, h * 0.48, 0, s * 0.5, h * 0.53, s * 0.5, dark, 0.4);
          p('octa', 0, h * 0.67, 0, s * 0.38, h * 0.43, s * 0.38, metal, 0.4);
          p('octa', 0, h * 0.79, 0, s * 0.21, h * 0.35, s * 0.21, team, time * 0.1, 0, 0, 0.75);
          for (let i = 0; i < 4; i++) {
            let a = (i * Math.PI) / 2 + 0.785,
              x = Math.sin(a) * s * 0.74,
              z = Math.cos(a) * s * 0.74;
            p('box', x, h * 0.3, z, 0.42, h * 0.57, 0.65, metal, a, 0, 0);
            p('octa', x, h * 0.63, z, 0.25, 0.7, 0.25, accent, 0, 0, 0, 0.8);
          }
          if (['hq', 'lab', 'refinery', 'hangar'].includes(e.type)) {
            R.add(
              'ring',
              e.x,
              h * 0.62,
              e.z,
              s * 0.88,
              1,
              s * 0.88,
              accent,
              time * 0.18,
              Math.PI / 2,
              0,
              0.85,
              0.8,
              'effects'
            );
            ring(s * 0.85, h * 0.4, team, 0.6);
          }
        } else if (e.type === 'hq') {
          p('box', 0, 1.45, 0, 6.5, 2.6, 4.6, metal);
          p('box', 0, 2.9, -0.4, 5.5, 0.4, 4.1, dark);
          p('box', 0, 3.22, -0.5, 4.7, 0.32, 3.4, metal);
          p('box', 0, 3.45, -0.55, 4.2, 0.12, 2.8, 0x8c9c9b);
          p('box', 0, 2.5, 2.35, 5.6, 0.23, 0.12, team, 0, 0, 0, 0.7);
          p('box', 0, 1.05, 2.39, 2.2, 1.9, 0.11, dark);
          p('box', 0, 0.4, 3.05, 2.7, 0.3, 1.3, 0x82918f, 0, -0.15);
          for (let i = -1; i <= 1; i++) {
            p('box', i * 0.65, 0.58, 3.1, 0.28, 0.03, 1.1, accent, 0.2);
            p('box', i * 1.4, 1.8, 2.41, 0.7, 0.48, 0.12, 0x81c5cf, 0, 0, 0, 0.6);
          }
          p('box', -3.4, 1.0, -0.5, 1.1, 1.8, 3.5, dark);
          p('box', 3.4, 1.05, -0.3, 1.15, 2, 3.7, dark);
          for (let side of [-1, 1])
            for (let j = 0; j < 3; j++)
              p('box', side * 3.43, 2.15, j * 0.85 - 1.15, 0.9, 0.12, 0.43, metal);
          p('box', -1.7, 4.0, -1.2, 1.5, 1.3, 1.5, dark);
          p('box', -1.7, 4.58, -1.2, 1.65, 0.17, 1.65, team, 0, 0, 0, 0.7);
          p('cylinder', -1.7, 5.4, -1.2, 0.06, 1.6, 0.06, metal);
          p('cone', -1.7, 5.65, -1.2, 0.55, 0.3, 0.55, metal, time * 0.13, 0.8);
          p('sphere', -1.7, 6.23, -1.2, 0.12, 0.12, 0.12, accent, 0, 0, 0, 1.5);
          p('box', 1.6, 3.9, -1.4, 1.1, 1.1, 1.1, metal);
          p('box', 1.6, 4.48, -1.4, 0.85, 0.1, 0.85, accent, 0, 0, 0, 0.7);
        } else if (e.type === 'barracks') {
          p('box', 0, 1.3, 0, 4.9, 2.5, 4.1, metal);
          p('box', 0, 2.75, -0.25, 5.1, 0.4, 3.9, dark);
          p('box', 0, 3.02, -0.3, 4.4, 0.18, 3.3, metal);
          p('box', 0, 1.15, 2.08, 2.2, 2, 0.08, 0x1d2f3d);
          p('box', 0, 2.33, 2.14, 2.7, 0.17, 0.1, team, 0, 0, 0, 0.8);
          for (let i = -1; i <= 1; i++) p('box', i * 1.25, 3.15, -0.1, 0.72, 0.15, 2.7, 0x8b9b9c);
          p('box', -2.7, 1, -0.2, 0.65, 1.8, 3.2, dark);
          p('box', 2.7, 1, -0.2, 0.65, 1.8, 3.2, dark);
          p('box', 1.7, 1.5, 2.09, 0.6, 0.5, 0.1, accent);
          p('cylinder', -2, 3.65, -1.3, 0.045, 1.7, 0.045, metal);
          p('box', -1.62, 4.1, -1.3, 0.8, 0.6, 0.035, team);
        } else if (e.type === 'depot') {
          for (let i of [-1, 1]) {
            p('box', i * 1.05, 1, 0, 1.85, 1.8, 3.3, metal);
            p('box', i * 1.05, 1.95, 0, 1.93, 0.12, 3.4, dark);
            for (let j = -1; j <= 1; j++) p('box', i * 1.05, 1, j, 0.06, 1.65, 0.11, accent);
            p('box', i * 1.05, 1.2, 1.67, 1.1, 0.22, 0.06, team, 0, 0, 0, 0.5);
          }
        } else if (e.type === 'refinery') {
          p('box', 0, 0.45, 0, 4.3, 0.7, 3.2, metal);
          for (let i of [-1, 1]) {
            let h = i < 0 ? 4.5 : 3.5;
            p('cylinder', i * 1.13, h * 0.5 + 0.5, -0.15, 0.85, h, 0.85, metal);
            p('cylinder', i * 1.13, h + 0.55, -0.15, 1, 0.17, 1, dark);
            p('cylinder', i * 1.13, h * 0.6, -0.15, 0.88, 0.25, 0.88, team, 0, 0, 0, 0.8);
            p('cone', i * 1.13, h + 0.95, -0.15, 0.55, 0.7, 0.55, dark);
            p('box', i * 1.13, 1.0, 1.05, 0.5, 0.55, 2, accent);
          }
          p('box', 0, 2.2, -0.3, 2.3, 0.27, 0.27, dark);
          p('octa', 0, 2.1, 1.1, 0.55, 1.2, 0.5, 0x8ff0de, time * 0.22, 0, 0, 1);
        } else if (e.type === 'factory' || e.type === 'hangar') {
          let hang = e.type === 'hangar';
          p('box', 0, 0.7, -0.5, 6.5, 1.2, 4.7, dark);
          p('box', -2.7, 2, -0.8, 1.1, 2.8, 4.9, metal);
          p('box', 2.7, 2, -0.8, 1.1, 2.8, 4.9, metal);
          p('box', 0, 3.5, -1, 6.3, 0.42, 4.8, metal);
          p('box', 0, 1.65, -2.7, 4.7, 2.1, 0.4, 0x30434f);
          p('box', 0, 1.5, -2.43, 3.6, 1.4, 0.1, hang ? team : 0xed975d, 0, 0, 0, 0.7);
          p('box', 0, 3.1, 1.46, 5.1, 0.15, 0.15, team, 0, 0, 0, 0.75);
          for (let j = 0; j < 4; j++) p('box', 0, 3.76, j * 0.85 - 2.3, 5.7, 0.15, 0.28, dark);
          if (hang) {
            p('hex', 0, 0.25, 3.0, 3.1, 0.14, 3.1, metal);
            p('box', -0.65, 0.36, 3, 0.12, 0.03, 1.8, team);
            p('box', 0.65, 0.36, 3, 0.12, 0.03, 1.8, team);
            p('box', 0, 0.36, 3, 1.3, 0.03, 0.12, team);
            p('box', -2.6, 4.5, -1.5, 1.15, 1.6, 1.1, metal);
            p('box', -2.6, 5.0, -0.9, 1.18, 0.45, 0.08, team, 0, 0, 0, 0.7);
          } else {
            p('cylinder', -2.5, 4.75, -1.6, 0.36, 2.4, 0.36, dark);
            p('cylinder', -1.45, 4.3, -1.6, 0.31, 1.5, 0.31, dark);
            p('box', 2.6, 4.2, -1.3, 0.35, 2, 0.35, accent);
            p('box', 1.3, 5, -1.3, 2.8, 0.26, 0.26, accent);
            p('box', 0.1, 4.35, -1.3, 0.055, 1.15, 0.055, metal);
          }
        } else if (e.type === 'turret') {
          p('hex', 0, 0.55, 0, 1.35, 0.8, 1.35, dark);
          p('hex', 0, 1.4, 0, 0.6, 1.4, 0.6, metal);
          // Keep the aiming head independent of the fixed foundation orientation.
          const aim = (e.rot || 0) - rot,
            ac = Math.cos(aim),
            as = Math.sin(aim);
          const head = (x, y, z, sx, sy, sz, c, glow = 0) =>
            p('box', x * ac + z * as, y, -x * as + z * ac, sx, sy, sz, c, aim, 0, 0, glow);
          head(0, 2.28, 0, 1.9, 0.9, 1.5, metal);
          head(0, 2.65, -0.2, 1.5, 0.18, 1.3, dark);
          for (let s of [-1, 1]) head(s * 0.52, 2.3, 1.0, 0.22, 0.25, 1.7, dark);
          head(0, 2.3, 0.77, 0.35, 0.25, 0.06, team, 1.2);
        } else if (e.type === 'lab') {
          p('hex', 0, 1.1, 0, 2.35, 1.7, 2.35, metal);
          p('hex', 0, 2.0, 0, 2.45, 0.2, 2.45, dark);
          p('sphere', 0, 3.0, 0, 1.4, 1.35, 1.4, 0x497b89);
          p('octa', 0, 3.15, 0, 0.65, 1, 0.65, team, time * 0.3, 0, 0, 0.8);
          for (let i = 0; i < 4; i++) {
            let a = (i * Math.PI) / 2;
            p('box', Math.sin(a) * 1.85, 3.0, Math.cos(a) * 1.85, 0.35, 2, 0.35, metal, a);
          }
          ring(1.9, 3.6, team, 0.7, Math.PI / 2, time * 0.4);
        }
        if (e.tag === 'generator') {
          ring(s * 1.3, 0.4, accent, 0.8);
          R.add(
            'ring',
            e.x,
            4,
            e.z,
            s * 0.8,
            1,
            s * 0.8,
            accent,
            time * 0.2,
            Math.PI / 2,
            0,
            1,
            0.6,
            'effects'
          );
        }
        if (e.invulnerable)
          R.add('sphere', e.x, 2.8, e.z, s * 1.2, 5.5, s * 1.2, 0xb7a5eb, 0, 0, 0, 0.7, 0.1, 'effects');
        if (build < 1) {
          for (let i = 0; i < 4; i++) {
            let a = (i * Math.PI) / 2 + 0.78;
            R.add(
              'box',
              e.x + Math.sin(a) * s,
              2,
              e.z + Math.cos(a) * s,
              0.1,
              4,
              0.1,
              team,
              0,
              0,
              0,
              0.4,
              0.65,
              'effects'
            );
          }
          ring(s * 1.25, 0.13, team, 0.7);
        }
        return;
      }
      // Mobile units. Silhouettes and surface treatments differ for every civilization.
      let move = e.walk || 0,
        step = Math.sin(move * 7) * 0.23,
        ty = e.type;
      if (ty === 'convoy') {
        p('box', 0, 1.25, 0, 3.1, 1.7, 5.3, 0x8f9087);
        p('box', 0, 2.17, -0.7, 3.2, 0.23, 4.4, 0xc5b69a);
        p('box', 0, 1.8, 2.55, 2.6, 1.0, 0.1, 0x649599);
        p('box', 0, 2.5, -1.4, 2.0, 0.5, 1.5, 0x5a6c76);
        for (let i of [-1, 1]) {
          p('box', i * 1.7, 0.5, 0, 0.6, 0.85, 5.1, dark);
          for (let j = -2; j <= 2; j++)
            p('cylinder', i * 1.73, 0.6, j, 0.4, 0.65, 0.4, 0x3d464e, 0, 0, Math.PI / 2);
          p('box', i * 1.05, 1.0, 2.73, 0.5, 0.3, 0.08, 0xf4d3a4, 0, 0, 0, 1.2);
        }
        p('box', 0, 2.35, 0, 0.15, 0.02, 1.7, 0xe8dfc9);
        p('box', 0, 2.35, 0, 1.4, 0.02, 0.15, 0xe8dfc9);
        return;
      }
      if (e.faction === 1) {
        let big = ['tank', 'artillery'].includes(ty),
          air = ty === 'air',
          scale = big ? 1.85 : ty === 'hero' ? 1.4 : 1;
        let legN = big ? 6 : 4;
        for (let i = 0; i < legN; i++) {
          let a = (i / legN) * 6.28;
          p(
            'cone',
            Math.sin(a) * scale * 0.8,
            0.45,
            Math.cos(a) * scale * 0.9,
            0.14,
            1.0,
            0.14,
            dark,
            a,
            step * 0.4,
            Math.sin(a) * 0.8
          );
        }
        p('sphere', 0, 1.0 * scale, 0, 0.65 * scale, 0.5 * scale, 1.0 * scale, metal);
        p('octa', 0, 1.35 * scale, -0.1, 0.56 * scale, 0.48 * scale, 0.87 * scale, dark, 0.2);
        p(
          'sphere',
          0,
          1.25 * scale,
          0.72 * scale,
          0.37 * scale,
          0.35 * scale,
          0.42 * scale,
          team,
          0,
          0,
          0,
          0.32
        );
        p(
          'cone',
          0,
          1.4 * scale,
          1.16 * scale,
          0.2 * scale,
          0.8 * scale,
          0.2 * scale,
          accent,
          0,
          1.1,
          0,
          0.45
        );
        for (let i = 0; i < 3; i++)
          p(
            'octa',
            (i - 1) * 0.35 * scale,
            1.75 * scale,
            -0.4,
            0.16,
            0.65,
            0.17,
            accent,
            0,
            0,
            (i - 1) * 0.4,
            0.35
          );
        if (ty === 'medic') {
          for (let i = 0; i < 3; i++) {
            let a = time * 1.4 + i * 2.1;
            p(
              'sphere',
              Math.sin(a) * 0.9,
              2.1 + Math.sin(a) * 0.2,
              Math.cos(a) * 0.9,
              0.18,
              0.18,
              0.18,
              0xd9eec1,
              0,
              0,
              0,
              1
            );
          }
        }
        if (air) {
          p('octa', -1.35, 1.2, 0, 1.6, 0.09, 1.15, accent, 0, 0, Math.sin(time * 8) * 0.15);
          p('octa', 1.35, 1.2, 0, 1.6, 0.09, 1.15, accent, 0, 0, -Math.sin(time * 8) * 0.15);
        }
        if (ty === 'artillery') p('sphere', 0, 2.0, -0.6, 1.15, 1.1, 1.15, accent, 0, 0, 0, 0.4);
        return;
      }
      if (e.faction === 2) {
        let big = ['tank', 'artillery'].includes(ty),
          scale = big ? 1.9 : ty === 'hero' ? 1.35 : 1,
          air = ty === 'air';
        p('octa', 0, 1.1 * scale, 0, 0.55 * scale, 1.1 * scale, 0.55 * scale, dark);
        p('cone', 0, 1.1 * scale, 0, 0.6 * scale, 1.7 * scale, 0.55 * scale, metal, 0, 0, Math.PI);
        p('octa', 0, 1.8 * scale, 0.12, 0.3 * scale, 0.42 * scale, 0.3 * scale, metal);
        p('box', 0, 1.83 * scale, 0.37 * scale, 0.34 * scale, 0.12, 0.08, team, 0, 0, 0, 1.2);
        p('octa', 0, 0.95 * scale, 0.45 * scale, 0.25, 0.5, 0.25, accent, time * 0.6, 0, 0, 0.9);
        for (let i of [-1, 1])
          p(
            'octa',
            i * 0.62 * scale,
            1.15 * scale,
            -0.15,
            0.2 * scale,
            1.05 * scale,
            0.3 * scale,
            metal,
            0,
            0,
            i * 0.22
          );
        if (big || air) {
          for (let i of [-1, 1]) {
            p('octa', i * 1.45, 1.05, 0, air ? 1.3 : 0.35, 0.22, 1.8, metal, 0, 0, i * 0.1);
            p('octa', i * 1.25, 1.25, 1.0, 0.18, 0.55, 0.4, team, 0, 0, 0, 0.8);
          }
        }
        if (ty === 'artillery') p('octa', 0, 2.6, 0, 0.32, 1.5, 0.32, accent, 0, 0.25, 0, 0.7);
        if (ty === 'medic')
          R.add('ring', e.x, 2.0, e.z, 0.9, 1, 0.9, accent, time, Math.PI / 2, 0, 1, 0.7, 'effects');
        return;
      }
      if (['rifle', 'hero', 'medic'].includes(ty)) {
        let h = ty === 'hero' ? 1.17 : 1,
          med = ty === 'medic',
          c = med ? 0xb9c3be : metal;
        for (let side of [-1, 1]) {
          p('box', side * 0.23, 0.35, side * step, 0.25, 0.65, 0.33, dark);
          p('box', side * 0.25, 0.13, side * step + 0.09, 0.32, 0.22, 0.48, dark);
        }
        p('box', 0, 1.0 * h, 0, 0.78 * h, 0.75 * h, 0.5 * h, c);
        p('box', 0, 1.16 * h, 0.28, 0.48, 0.26, 0.1, team, 0, 0, 0, 0.35);
        p('box', 0, 1.65 * h, 0.02, 0.45 * h, 0.43 * h, 0.43 * h, c);
        p('box', 0, 1.65 * h, 0.25, 0.43, 0.115, 0.08, med ? 0x84dfc1 : 0x8ce1e2, 0, 0, 0, 0.85);
        p('box', -0.5 * h, 1.32 * h, 0, 0.34, 0.35, 0.54, c);
        p('box', 0.5 * h, 1.32 * h, 0.08, 0.34, 0.35, 0.54, c);
        p('box', -0.48, 1.0, 0.27, 0.22, 0.47, 0.22, dark, -0.3, -0.5);
        p('box', 0.5, 1.09, 0.48, 0.25, 0.23, 0.85, dark);
        p('box', 0.5, 1.12, 0.98, 0.11, 0.11, 0.42, 0x9eaaa8);
        p('box', 0, 1.08, -0.37, 0.49, 0.66, 0.26, dark);
        if (med) {
          p('box', 0, 1.15, -0.53, 0.36, 0.11, 0.02, 0x92e5c5, 0, 0, 0, 0.7);
          p('box', 0, 1.15, -0.53, 0.11, 0.38, 0.02, 0x92e5c5, 0, 0, 0, 0.7);
        }
        if (ty === 'hero') {
          p('box', 0, 0.91, -0.49, 0.86, 1.2, 0.06, 0xa6835b, 0, -0.1);
          p('box', -0.54, 1.48, 0.02, 0.42, 0.16, 0.59, accent);
          p('box', 0.54, 1.48, 0.02, 0.42, 0.16, 0.59, accent);
        }
      } else if (ty === 'worker') {
        p('box', 0, 0.55, 0, 1.25, 0.65, 1.5, 0xb7a27b);
        for (let i of [-1, 1]) p('box', i * 0.72, 0.3, 0, 0.33, 0.48, 1.7, dark);
        p('box', 0, 1.04, -0.12, 0.85, 0.4, 0.8, metal);
        p('box', 0, 1.05, 0.31, 0.7, 0.22, 0.07, team, 0, 0, 0, 0.8);
        p('box', 0.67, 0.94, 0.45, 0.18, 0.2, 0.95, accent, 0, -0.35);
        p('cone', 0.67, 0.8, 1.0, 0.18, 0.55, 0.18, 0xd9cdb5, 0, -1.1);
        p('cylinder', -0.3, 1.28, -0.4, 0.18, 0.4, 0.18, accent);
        if (e.carry > 0) p('octa', 0, 1.4, -0.4, 0.32, 0.46, 0.3, 0xecc88a, 0, 0, 0, 0.35);
      } else if (ty === 'scout') {
        p('box', 0, 0.66, 0, 1.4, 0.6, 2.1, metal);
        p('box', 0, 1.06, -0.1, 1.2, 0.35, 1.1, dark);
        p('box', 0, 1.19, 0.36, 0.94, 0.24, 0.17, team, 0, 0, 0, 0.55);
        for (let i of [-1, 1])
          for (let j of [-1, 1])
            p('cylinder', i * 0.83, 0.4, j * 0.73, 0.38, 0.36, 0.38, dark, 0, 0, Math.PI / 2);
        p('box', 0, 1.45, -0.4, 0.62, 0.45, 0.65, metal);
        p('box', 0, 1.5, 0.2, 0.17, 0.15, 1.2, dark);
        p('box', 0, 0.7, -1.1, 0.8, 0.16, 0.06, accent, 0, 0, 0, 0.7);
      } else if (ty === 'tank' || ty === 'artillery') {
        p('box', 0, 0.75, 0, 2.3, 0.85, 3.0, metal);
        for (let i of [-1, 1]) {
          p('box', i * 1.35, 0.57, 0, 0.66, 0.83, 3.25, dark);
          p('box', i * 1.35, 1.08, 0, 0.73, 0.18, 3.5, metal);
          for (let j = -2; j <= 2; j++)
            p('cylinder', i * 1.55, 0.48, j * 0.61, 0.31, 0.22, 0.31, 0x697a7f, 0, 0, Math.PI / 2);
          p('box', i * 1.35, 1.2, 0.5, 0.18, 0.08, 1.6, team, 0, 0, 0, 0.3);
        }
        p('hex', 0, 1.48, -0.25, 1.03, 0.8, 0.95, metal, 0.25);
        p('box', 0, 1.95, -0.33, 1.3, 0.18, 1.3, dark);
        if (ty === 'tank') {
          p('box', 0, 1.63, 1.25, 0.35, 0.35, 2.3, dark);
          p('box', 0, 1.63, 2.48, 0.53, 0.47, 0.42, metal);
          p('box', 0, 1.63, 2.7, 0.28, 0.23, 0.02, 0x18242f);
        } else {
          p('box', 0, 2.15, 0.9, 0.48, 0.45, 3.65, dark, 0, -0.23);
          p('box', 0, 2.59, 2.68, 0.7, 0.63, 0.55, metal, 0, -0.23);
          for (let i of [-1, 1]) p('box', i * 0.67, 1.8, -1.25, 0.5, 0.9, 0.9, accent);
        }
        p('box', -0.45, 2.08, -0.35, 0.44, 0.1, 0.6, team, 0, 0, 0, 0.4);
      } else if (ty === 'air') {
        p('octa', 0, 0.65, 0.25, 0.7, 0.43, 2.2, metal);
        p('box', 0, 0.85, 0.75, 0.47, 0.24, 0.9, 0x81bdcc, 0, 0, 0, 0.4);
        for (let i of [-1, 1]) {
          p('octa', i * 1.35, 0.45, -0.18, 1.6, 0.12, 1.1, metal, 0, 0, i * 0.06);
          p('box', i * 1.05, 0.32, -0.55, 0.53, 0.56, 1.8, dark);
          p('cylinder', i * 1.05, 0.3, -1.48, 0.23, 0.12, 0.23, accent, 0, Math.PI / 2, 0, 1.3);
          p('box', i * 0.66, 0.38, 1.1, 0.16, 0.2, 1.1, dark);
          p('box', i * 0.42, 1.13, -1.2, 0.15, 0.7, 0.8, metal, 0, 0.18, i * 0.27);
        }
        p('sphere', 0, 0.94, -0.2, 0.09, 0.08, 0.09, team, 0, 0, 0, 1.4);
      }
    }
