    /* Seeded battlefields, grid navigation and procedural faction models. */
    'use strict';
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.z - b.z);
    const angleLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, t);
    const pointSegment = (p: Position, a: Position, b: Position) => {
      let dx = b.x - a.x,
        dz = b.z - a.z,
        t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
    };
    const insidePolygon = (p: Position, polygon: Position[]) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.z > p.z) !== (b.z > p.z) &&
            p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
      }
      return inside;
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
      readonly extent: number;
      readonly cellSize: number;
      readonly gridSize: number;
      declare fogVersion: number;
      declare seed: number;
      declare definition: BattlefieldDefinition;
      declare layout: BattlefieldLayout;
      declare staticGrid: Uint8Array;
      declare terrainFeatureGrid: Uint8Array;
      declare blocked: Uint8Array;
      declare explored: Uint8Array;
      declare visible: Uint8Array;
      declare sight: [{ visible: Uint8Array; explored: Uint8Array }, { visible: Uint8Array; explored: Uint8Array }];
      declare fogPixels: Uint8Array<ArrayBuffer>;
      declare terrainColors: Uint8ClampedArray;
      declare rocks: WorldRock[];
      declare pathVersion: number;
      declare renderData: WorldRenderData;

      constructor(seed: number, map: BattlefieldId) {
        this.fogVersion = 0;
        this.seed = seed;
        this.definition = BATTLEFIELDS[battlefieldId(map)];
        this.layout = this.definition.layout;
        this.extent = this.definition.size.extent;
        this.cellSize = this.definition.size.cellSize;
        this.gridSize = this.extent * 2 / this.cellSize;
        if (!Number.isFinite(this.extent) || this.extent <= 18 ||
            !Number.isFinite(this.cellSize) || this.cellSize <= 0 ||
            !Number.isSafeInteger(this.gridSize) || this.gridSize < 3)
          throw new Error('Battlefield size must have extent > 18 and a whole grid of at least 3 cells per side');
        const GRID = this.gridSize;
        this.staticGrid = new Uint8Array(GRID * GRID);
        this.terrainFeatureGrid = new Uint8Array(GRID * GRID);
        this.blocked = new Uint8Array(GRID * GRID);
        this.explored = new Uint8Array(GRID * GRID);
        this.visible = new Uint8Array(GRID * GRID);
        // The existing fields are the local presentation view, not a second copy of sight.
        this.sight = [{ visible: this.visible, explored: this.explored },
          { visible: new Uint8Array(GRID * GRID), explored: new Uint8Array(GRID * GRID) }];
        this.fogPixels = new Uint8Array(GRID * GRID);
        this.terrainColors = new Uint8ClampedArray(GRID * GRID * 4);
        this.rocks = [];
        this.pathVersion = 0;
        this.definition.generate(new BattlefieldBuilder(this));
        this.blocked.set(this.staticGrid);
      }
      idx(x: number, z: number) {
        const { extent: EXTENT, cellSize: CELL, gridSize: GRID } = this;
        return (
          clamp(Math.floor((z + EXTENT) / CELL), 0, GRID - 1) * GRID +
          clamp(Math.floor((x + EXTENT) / CELL), 0, GRID - 1)
        );
      }
      point(i: number): Position {
        const { extent: EXTENT, cellSize: CELL, gridSize: GRID } = this;
        return {
          x: ((i % GRID) + 0.5) * CELL - EXTENT,
          z: (Math.floor(i / GRID) + 0.5) * CELL - EXTENT
        };
      }
      mark(grid: Uint8Array, x: number, z: number, r: number, val = 1) {
        const { extent: EXTENT, cellSize: CELL, gridSize: GRID } = this;
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
          Math.abs(x) > this.extent - 3 || Math.abs(z) > this.extent - 3 || this.blocked[this.idx(x, z)] !== 0
        );
      }
      rebuild(entities: Entity[]) {
        this.blocked.set(this.staticGrid);
        for (let e of entities)
          if (e.hp > 0 && e.kind === 'building') this.mark(this.blocked, e.x, e.z, e.size + 0.35);
        this.pathVersion++;
      }
      nearest(x: number, z: number): Position {
        const GRID = this.gridSize, limit = this.extent - 4;
        let i = this.idx(x, z);
        if (!this.blocked[i]) return { x: clamp(x, -limit, limit), z: clamp(z, -limit, limit) };
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
        const fallback = this.extent - 6;
        return { x: clamp(x, -fallback, fallback), z: clamp(z, -fallback, fallback) };
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
        const GRID = this.gridSize, limit = this.extent - 5;
        tx = clamp(tx, -limit, limit);
        tz = clamp(tz, -limit, limit);
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
        // Preserve the 72×72 search budget; larger grids need proportionally more heap pops.
        const searchLimit = Math.ceil(5600 * (GRID / 72) ** 2);
        while (heap.length && tries++ < searchLimit) {
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
      explore(team: PlayerTeam, p: Position, radius: number) {
        this.mark(this.sight[team].explored, p.x, p.z, radius, 1);
        // Exploration reveals terrain/resources, never live vision or enemy contacts.
        if (team === 0) {
          for (let i = 0; i < this.visible.length; i++)
            this.fogPixels[i] = this.visible[i] ? 255 : this.explored[i] ? 80 : 0;
          this.fogVersion++;
        }
      }
      reveal(entities: Entity[], scans: Scan[] = []) {
        for (const view of this.sight) view.visible.fill(0);
        for (let e of entities)
          if (e.hp > 0 && e.team !== -1 && e.kind !== 'resource') {
            let r = e.vision || (e.kind === 'building' ? 21 : 17);
            this.mark(this.sight[e.team].visible, e.x, e.z, r, 255);
          }
        for (let s of scans) this.mark(this.sight[s.team ?? 0].visible, s.x, s.z, s.r || 31, 255);
        for (const view of this.sight)
          for (let i = 0; i < view.visible.length; i++) if (view.visible[i]) view.explored[i] = 1;
        for (let i = 0; i < this.visible.length; i++) {
          if (this.visible[i]) this.explored[i] = 1;
          this.fogPixels[i] = this.visible[i] ? 255 : this.explored[i] ? 80 : 0;
        }
        this.fogVersion++;
      }
    }
