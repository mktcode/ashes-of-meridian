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
      private a: [number, number][] = [];
      private count = 0;

      clear() {
        this.count = 0;
      }
      push(n: number, p: number) {
        let a = this.a,
          i = this.count++;
        if (a[i]) { a[i][0] = n; a[i][1] = p; }
        else a[i] = [n, p];
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
          last = a[--this.count];
        if (this.count) {
          a[0] = last;
          a[this.count] = first;
          let i = 0;
          while (true) {
            let l = i * 2 + 1,
              r = l + 1,
              j = i;
            if (l < this.count && a[l][1] < a[j][1]) j = l;
            if (r < this.count && a[r][1] < a[j][1]) j = r;
            if (j === i) break;
            [a[i], a[j]] = [a[j], a[i]];
            i = j;
          }
        }
        return first![0];
      }
      get length() {
        return this.count;
      }
    }
    // Per-world scratch only: never cache routes or occupancy, and never persist it.
    class NavigationWorkspace {
      readonly cost: Float32Array;
      readonly parent: Int32Array;
      readonly closed: Uint8Array;
      readonly touched: Int32Array;
      readonly heap = new Heap();
      touchedCount = 0;
      busy = false;
      constructor(size: number) {
        this.cost = new Float32Array(size); this.cost.fill(Infinity);
        this.parent = new Int32Array(size); this.parent.fill(-1);
        this.closed = new Uint8Array(size);
        this.touched = new Int32Array(size);
      }
      reset() {
        for (let j = 0; j < this.touchedCount; j++) {
          const i = this.touched[j];
          this.cost[i] = Infinity; this.parent[i] = -1; this.closed[i] = 0;
        }
        this.touchedCount = 0;
        this.heap.clear();
        this.busy = false;
      }
    }
    class Battlefield {
      readonly extent: number;
      readonly cellSize: number;
      readonly gridSize: number;
      declare fogVersion: number;
      viewTeam: PlayerTeam = 0;
      declare seed: number;
      readonly terrainSeed: number;
      readonly renderProfile: BattlefieldRenderProfile;
      declare definition: BattlefieldDefinition;
      declare layout: BattlefieldLayout;
      declare staticGrid: Uint8Array;
      declare terrainFeatureGrid: Uint8Array;
      declare blocked: Uint8Array;
      declare explored: Uint8Array;
      declare visible: Uint8Array;
      declare sight: { visible: Uint8Array; explored: Uint8Array }[];
      declare fogPixels: Uint8Array<ArrayBuffer>;
      declare terrainColors: Uint8ClampedArray;
      declare rocks: WorldRock[];
      declare pathVersion: number;
      declare renderData: WorldRenderData;
      declare startSites: Position[];
      declare deploymentReachable: Uint8Array;
      surface: BattlefieldSurface | null = null;
      private pathWorkspace?: NavigationWorkspace;
      terrainFree(a: Position, b: Position, radius = 0) {
        return !this.surface || this.surface.segment(a, b, radius);
      }

      selectView(team: PlayerTeam): boolean {
        const view = this.sight[team];
        if (!Number.isInteger(team) || !view) return false;
        if (team === this.viewTeam) return true;
        this.viewTeam = team;
        this.visible = view.visible;
        this.explored = view.explored;
        for (let i = 0; i < this.fogPixels.length; i++)
          this.fogPixels[i] = this.visible[i] ? 255 : this.explored[i] ? 80 : 0;
        this.fogVersion++;
        return true;
      }
      constructor(seed: number, map: BattlefieldId, partyCount = 2) {
        if (!Number.isInteger(partyCount) || partyCount < 2 || partyCount > 4)
          throw Error('Battlefield requires 2–4 parties');
        this.fogVersion = 0;
        this.seed = seed;
        this.definition = BATTLEFIELDS[battlefieldId(map)];
        this.terrainSeed = this.definition.design?.terrainSeed ?? seed;
        const profile = battlefieldVariation(this.definition.render, this.terrainSeed);
        this.renderProfile = battlefieldAtmosphere(profile.ecology ? profile : battlefieldEcology(profile, this.terrainSeed),
          this.definition.design?.atmosphere, seed);
        const size = this.definition.createSize?.(this.terrainSeed) ?? this.definition.size;
        this.extent = size.extent;
        this.cellSize = size.cellSize;
        this.gridSize = this.extent * 2 / this.cellSize;
        if (!Number.isFinite(this.extent) || this.extent <= 18 ||
            !Number.isFinite(this.cellSize) || this.cellSize <= 0 ||
            !Number.isSafeInteger(this.gridSize) || this.gridSize < 3)
          throw new Error('Battlefield size must have extent > 18 and a whole grid of at least 3 cells per side');
        this.layout = this.definition.createLayout(this.terrainSeed, size);
        const GRID = this.gridSize;
        this.staticGrid = new Uint8Array(GRID * GRID);
        this.terrainFeatureGrid = new Uint8Array(GRID * GRID);
        this.blocked = new Uint8Array(GRID * GRID);
        this.sight = Array.from({ length: partyCount }, () => ({
          visible: new Uint8Array(GRID * GRID), explored: new Uint8Array(GRID * GRID)
        }));
        // A fresh world presents party 0; switching aliases never shares or copies sight.
        this.visible = this.sight[0].visible;
        this.explored = this.sight[0].explored;
        this.fogPixels = new Uint8Array(GRID * GRID);
        this.terrainColors = new Uint8ClampedArray(GRID * GRID * 4);
        this.rocks = [];
        this.pathVersion = 0;
        const builder = new BattlefieldBuilder(this);
        this.definition.generate(builder);
        decorateEcology(builder);
        decorateWorldVariation(builder);
        this.blocked.set(this.staticGrid);
        this.startSites = battlefieldDeploymentCandidates(this);
        this.layout.startSites = this.startSites;
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
      markVisible(grid: Uint8Array, x: number, z: number, r: number, sourceLevel: number) {
        const { extent: EXTENT, cellSize: CELL, gridSize: GRID } = this;
        let a = Math.max(0, Math.floor((x - r + EXTENT) / CELL)),
          b = Math.min(GRID - 1, Math.floor((x + r + EXTENT) / CELL)),
          c = Math.max(0, Math.floor((z - r + EXTENT) / CELL)),
          d = Math.min(GRID - 1, Math.floor((z + r + EXTENT) / CELL));
        for (let j = c; j <= d; j++)
          for (let i = a; i <= b; i++) {
            const wx = (i + 0.5) * CELL - EXTENT, wz = (j + 0.5) * CELL - EXTENT,
              dx = wx - x, dz = wz - z;
            if (dx * dx + dz * dz < (r + CELL * 0.4) ** 2 &&
                (!this.surface || this.surface.visibilityLevelAt(wx, wz) <= sourceLevel)) grid[j * GRID + i] = 255;
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
      nearest(x: number, z: number, radius = 0, ignoreSurface = false): Position {
        const GRID = this.gridSize, limit = this.extent - 4;
        let i = this.idx(x, z);
        if (!this.blocked[i] && (ignoreSurface || !this.surface || this.surface.fits(x,z,radius))) return { x: clamp(x, -limit, limit), z: clamp(z, -limit, limit) };
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
              if (this.blocked[id] || (!ignoreSurface && this.surface && !this.surface.fits(this.point(id).x,this.point(id).z,radius))) continue;
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
      lineFree(a: Position, b: Position, radius = 0, ignoreSurface = false) {
        if (!ignoreSurface && !this.terrainFree(a, b, radius)) return false;
        let d = distance(a, b),
          n = Math.ceil(d / 1.4);
        for (let i = 1; i <= n; i++) {
          let t = i / n;
          if (this.blockedAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
        }
        return true;
      }
      path(x: number, z: number, tx: number, tz: number, air = false, area?: NavigationArea, radius = 0, ignoreSurface = false): NavigationPath {
        const GRID = this.gridSize, limit = this.extent - 5;
        tx = clamp(tx, -limit, limit);
        tz = clamp(tz, -limit, limit);
        const complete = (goal: Position): NavigationPath => ({ points: [goal], goal, status: 'complete' });
        if (air) return complete({ x: tx, z: tz });
        let target = this.nearest(tx, tz, radius, ignoreSurface),
          start = { x, z };
        // Work orders accept any reachable position in their area, not an arbitrary
        // nearest cell on the far side of a building. Keep a valid preferred service
        // point for unobstructed traffic; otherwise search the whole area once.
        const surfaceFree = (a: Position, b: Position, r = 0) => ignoreSurface || this.terrainFree(a,b,r);
        const inArea = (p: Position) => !area || (distance(p, area) <= area.radius && surfaceFree(p, area));
        const fits = (i: number) => ignoreSurface || !this.surface || this.surface.fits(this.point(i).x, this.point(i).z, radius);
        if (area && inArea(start) && !this.blockedAt(x, z) && (ignoreSurface || !this.surface || this.surface.fits(x,z,radius))) return complete(start);
        if (inArea(target) && !this.blockedAt(target.x, target.z) && this.lineFree(start, target, radius, ignoreSurface)) return complete(target);
        let s = this.idx(x, z),
          end = this.idx(target.x, target.z);
        if (s === end && inArea(target) && !this.blockedAt(target.x, target.z) && surfaceFree(start, target, radius)) return complete(target);
        const reusable = this.pathWorkspace ??= new NavigationWorkspace(GRID * GRID),
          // A nested caller must not overwrite an active search; only the ordinary
          // synchronous workspace is retained by the world.
          workspace = reusable.busy ? new NavigationWorkspace(GRID * GRID) : reusable,
          { cost, parent, closed, heap } = workspace;
        workspace.busy = true;
        try {
          workspace.touched[workspace.touchedCount++] = s;
          cost[s] = 0;
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
          const areaX = area ? (area.x + this.extent) / this.cellSize - 0.5 : 0,
            areaZ = area ? (area.z + this.extent) / this.cellSize - 0.5 : 0,
            areaRadius = area ? area.radius / this.cellSize : 0;
          const heuristic = (i: number) => {
            // Stay admissible for the existing rounded diagonal cost (1.414).
            // Grid coordinates avoid allocating a position for every relaxation.
            if (area) return Math.max(0, Math.hypot(i % GRID - areaX, Math.floor(i / GRID) - areaZ) - areaRadius) * (1.414 / Math.SQRT2);
            const ax = Math.abs(ex - i % GRID), az = Math.abs(ez - Math.floor(i / GRID));
            return Math.max(ax, az) + 0.414 * Math.min(ax, az);
          };
          // Preserve the 72×72 search budget; larger grids need proportionally more heap pops.
          const searchLimit = Math.ceil(5600 * (GRID / 72) ** 2);
          while (heap.length && tries++ < searchLimit) {
            let i = heap.pop();
            if (closed[i]) continue;
            let targetDistance = area ? heuristic(i) ** 2 : ((i % GRID) - ex) ** 2 + (Math.floor(i / GRID) - ez) ** 2;
            if (targetDistance < bestDistance) {
              bestDistance = targetDistance;
              best = i;
            }
            if (area ? targetDistance === 0 && !this.blocked[i] && inArea(this.point(i)) : i === end && surfaceFree(this.point(i), target, radius)) {
              found = true;
              if (area) { end = i; target = this.point(i); }
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
              if (closed[q] || this.blocked[q] || !fits(q)) continue;
              if (!surfaceFree(i === s ? start : this.point(i), this.point(q), radius)) continue;
              if (dx && dz && (this.blocked[gz * GRID + xx] || this.blocked[zz * GRID + gx])) continue;
              let nc = cost[i] + w;
              if (nc < cost[q]) {
                if (cost[q] === Infinity) workspace.touched[workspace.touchedCount++] = q;
                cost[q] = nc;
                parent[q] = i;
                heap.push(q, nc + heuristic(q));
              }
            }
          }
          const exhausted = !found && heap.length > 0;
          if (!found) {
            if (best === s || bestDistance > 25)
              return { points: [], goal: target, status: exhausted ? 'budget-exhausted' : 'unreachable' };
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
            while (k + 1 < nodes.length && this.lineFree(anchor, nodes[k + 1], radius, ignoreSurface)) k++;
            smooth.push(nodes[k]);
            anchor = nodes[k];
            j = k + 1;
          }
          return { points: smooth, goal: target, status: found ? 'complete' : exhausted ? 'budget-exhausted' : 'partial' };
        } finally {
          workspace.reset();
        }
      }
      explore(team: PlayerTeam, p: Position, radius: number) {
        this.mark(this.sight[team].explored, p.x, p.z, radius, 1);
        // Exploration reveals terrain/resources, never live vision or enemy contacts.
        if (team === this.viewTeam) {
          for (let i = 0; i < this.visible.length; i++)
            this.fogPixels[i] = this.visible[i] ? 255 : this.explored[i] ? 80 : 0;
          this.fogVersion++;
        }
      }
      reveal(entities: Entity[], scans: Scan[] = []) {
        for (const view of this.sight) view.visible.fill(0);
        for (let e of entities)
          if (e.hp > 0 && e.team !== -1 && e.kind !== 'resource' &&
              !(e.kind === 'building' && isCivilizationBuildingType(e.type))) {
            const r = e.vision || (e.kind === 'building' ? 21 : 17),
              flying = e.kind === 'unit' && !!(UNITS[e.type] as UnitDefinitionShape | undefined)?.flying,
              level = flying ? Infinity : this.surface?.visibilityLevelAt(e.x, e.z) ?? 0;
            this.markVisible(this.sight[e.team].visible, e.x, e.z, r, level);
          }
        // Reconnaissance scans and aircraft observe independently of the ground tier.
        for (let s of scans) this.markVisible(this.sight[s.team ?? 0].visible, s.x, s.z, s.r || 31, Infinity);
        for (const view of this.sight)
          for (let i = 0; i < view.visible.length; i++) if (view.visible[i]) view.explored[i] = 1;
        for (let i = 0; i < this.visible.length; i++) {
          if (this.visible[i]) this.explored[i] = 1;
          this.fogPixels[i] = this.visible[i] ? 255 : this.explored[i] ? 80 : 0;
        }
        this.fogVersion++;
      }
    }
