/* Generation-only terrain audit and local broad ramps. No deployment, decor or
 * simulation randomness; the final sampled surface remains the only authority. */
'use strict';
const TERRAIN_ROUTE_RADIUS = 6;
function battlefieldTerrainRegions(surface: BattlefieldSurface, radius = TERRAIN_ROUTE_RADIUS) {
  const n = surface.extent * 2 / surface.cellSize, free = new Uint8Array(n * n),
    visited = new Uint8Array(n * n), groups: number[][] = [],
    point = (i: number) => ({ x: (i % n + .5) * surface.cellSize - surface.extent,
      z: (Math.floor(i / n) + .5) * surface.cellSize - surface.extent });
  for (let i = 0; i < free.length; i++) {
    const p = point(i); free[i] = surface.fits(p.x, p.z, radius) ? 1 : 0;
  }
  for (let root = 0; root < free.length; root++) if (free[root] && !visited[root]) {
    const queue = [root]; visited[root] = 1;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head], x = i % n, z = Math.floor(i / n), p = point(i);
      for (const j of [x ? i - 1 : -1, x < n - 1 ? i + 1 : -1, z ? i - n : -1, z < n - 1 ? i + n : -1])
        if (j >= 0 && free[j] && !visited[j] && surface.segment(p, point(j), radius)) {
          visited[j] = 1; queue.push(j);
        }
    }
    groups.push(queue);
  }
  groups.sort((a, b) => b.length - a.length);
  return { groups, free, point };
}
// Small resource footprints must not disappear from an area-based audit. Use
// vehicle clearance for every deposit, including the actual off-grid positions.
function battlefieldTerrainEconomyAccess(surface: BattlefieldSurface, sites: readonly Position[]): boolean[] {
  if (!sites.length) return [];
  const regions = battlefieldTerrainRegions(surface, 2.6), main = new Uint8Array(regions.free.length),
    n = surface.extent * 2 / surface.cellSize,
    index = (p: Position) => Math.floor((p.z + surface.extent) / surface.cellSize) * n +
      Math.floor((p.x + surface.extent) / surface.cellSize);
  for (const i of regions.groups[0] ?? []) main[i] = 1;
  return sites.flatMap((site, i) => [site, battlefieldGasPosition(site),
    ...Array.from({ length: 5 }, (_, j) => battlefieldCrystalPosition(site, i, j))]).map(p =>
      !!main[index(p)] && surface.segment(p, regions.point(index(p)), 2.6));
}
function battlefieldTerrainEconomyConnected(surface: BattlefieldSurface, sites: readonly Position[]) {
  return battlefieldTerrainEconomyAccess(surface, sites).every(Boolean);
}
function battlefieldTerrainCoverage(surface: BattlefieldSurface, regions = battlefieldTerrainRegions(surface)) {
  const n = surface.extent * 2 / surface.cellSize, main = new Uint8Array(n * n),
    sectors = Array.from({ length: 9 }, () => ({ area: 0, reachable: 0 }));
  for (const i of regions.groups[0] ?? []) main[i] = 1;
  for (let i = 0; i < main.length; i++) {
    const p = regions.point(i);
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) > surface.extent - 15) continue;
    const x = Math.min(2, Math.floor((p.x + surface.extent) / (surface.extent * 2 / 3))),
      z = Math.min(2, Math.floor((p.z + surface.extent) / (surface.extent * 2 / 3)));
    sectors[z * 3 + x].area++; sectors[z * 3 + x].reachable += main[i];
  }
  return { fraction: sectors.reduce((s, p) => s + p.reachable, 0) / sectors.reduce((s, p) => s + p.area, 0),
    sectors: sectors.map(p => p.reachable / p.area) };
}
function battlefieldRampGrid(extent: number, protectedSites: readonly (Position & { radius: number })[]) {
  const step = 5, n = Math.round(extent * 2 / step), free = new Uint8Array(n * n);
  for (let i = 0; i < free.length; i++) {
    const x = (i % n + .5) * step - extent, z = (Math.floor(i / n) + .5) * step - extent;
    if (Math.max(Math.abs(x), Math.abs(z)) < extent - 9 &&
        protectedSites.every(p => (x - p.x) ** 2 + (z - p.z) ** 2 >= (p.radius + 20) ** 2)) free[i] = 1;
  }
  return free;
}
// A small construction grid finds detours around immutable economic foundations.
// It ignores cliffs deliberately: this is where a new graded passage will be cut.
function battlefieldRampRoute(extent: number, a: Position, b: Position,
    protectedSites: readonly (Position & { radius: number })[], constructionGrid?: Uint8Array): Position[] | null {
  const clear = (p: Position, q: Position, margin = 20) =>
    protectedSites.every(site => pointSegment(site, p, q) >= site.radius + margin);
  if (clear(a, b)) return [a, b];
  const step = 5, n = Math.round(extent * 2 / step), free = constructionGrid ?? battlefieldRampGrid(extent, protectedSites),
    parent = new Int32Array(n * n).fill(-1), queue = new Int32Array(n * n),
    point = (i: number) => ({ x: (i % n + .5) * step - extent, z: (Math.floor(i / n) + .5) * step - extent }),
    index = (p: Position) => Math.floor((p.z + extent) / step) * n + Math.floor((p.x + extent) / step);
  const start = index(a), goal = index(b);
  if (!free[start] || !free[goal] || !clear(a, point(start), 18) || !clear(b, point(goal), 18)) return null;
  let head = 0, tail = 1; queue[0] = start; parent[start] = start;
  while (head < tail && parent[goal] < 0) {
    const i = queue[head++], x = i % n, z = Math.floor(i / n);
    for (const j of [x ? i - 1 : -1, x < n - 1 ? i + 1 : -1, z ? i - n : -1, z < n - 1 ? i + n : -1])
      if (j >= 0 && free[j] && parent[j] < 0) { parent[j] = i; queue[tail++] = j; }
  }
  if (parent[goal] < 0) return null;
  const chain: Position[] = [b];
  for (let i = goal; i !== start; i = parent[i]) chain.push(point(i));
  chain.push(point(start), a); chain.reverse();
  const route = [a];
  for (let i = 0; i < chain.length - 1;) {
    let next = chain.length - 1;
    while (next > i + 1 && !clear(chain[i], chain[next])) next--;
    route.push(chain[next]); i = next;
  }
  // Rounded corners keep projection seams out of the wide walkable core.
  const rounded = [a];
  for (let i = 1; i < route.length - 1; i++) {
    const previous = route[i - 1], p = route[i], next = route[i + 1],
      before = distance(previous, p), after = distance(p, next), trim = Math.min(10, before / 3, after / 3),
      u = { x: p.x + (previous.x - p.x) * trim / before, z: p.z + (previous.z - p.z) * trim / before },
      v = { x: p.x + (next.x - p.x) * trim / after, z: p.z + (next.z - p.z) * trim / after };
    rounded.push(u);
    for (let j = 1; j <= 8; j++) {
      const t = j / 8, s = 1 - t;
      rounded.push({ x: s * s * u.x + 2 * s * t * p.x + t * t * v.x,
        z: s * s * u.z + 2 * s * t * p.z + t * t * v.z });
    }
  }
  rounded.push(b);
  return rounded.slice(1).every((p, i) => clear(rounded[i], p, 17)) ? rounded : null;
}
function connectBattlefieldTerrain(world: Pick<Battlefield, 'extent' | 'cellSize' | 'layout'>,
    height: (x: number, z: number) => number): BattlefieldSurface {
  const bake = (field: (x: number, z: number) => number) =>
    new BattlefieldSurface(world.extent, world.cellSize, field, h => Math.floor(h / 6)),
    protectedSites = world.layout.resourceSites.flatMap(site => [
      { ...site, radius: 10 }, { ...battlefieldGasPosition(site), radius: 12 },
      { ...battlefieldSitePosition(site, -13, -6), radius: 13 }
    ]),
    smooth = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const n = world.extent * 2 / world.cellSize,
    economyHubs = new Set(world.layout.resourceSites.map(p =>
      Math.floor((p.z + world.extent) / world.cellSize) * n + Math.floor((p.x + world.extent) / world.cellSize)));
  let surface = bake(height), routeGrid: Uint8Array | undefined,
    economyAccess = battlefieldTerrainEconomyAccess(surface, world.layout.resourceSites);
  // Radius-six connectivity distinguishes a usable army route from an accidental
  // single-file connection. Significant shelves must join this wider network.
  for (let repair = 0; repair <= 8; repair++) {
    const regions = battlefieldTerrainRegions(surface), main = regions.groups[0];
    if (!main) throw Error('No broad connected terrain');
    const total = regions.groups.reduce((sum, g) => sum + g.length, 0),
      islands = regions.groups.slice(1).filter(g => g.length >= 64 || g.some(i => economyHubs.has(i)));
    if (!islands.length && main.length >= total * .94) {
      const coverage = battlefieldTerrainCoverage(surface, regions);
      if (coverage.fraction < .55 || coverage.sectors.some(p => p < .25))
        throw Error('Insufficient spatial terrain coverage');
      const reachable = new Set(main);
      if (!economyAccess.every(Boolean) || [...economyHubs].some(i => !reachable.has(i)))
        throw Error('Economic terrain access is disconnected');
      for (const site of world.layout.resourceSites) {
        const i = Math.floor((site.z + world.extent) / world.cellSize) * n +
          Math.floor((site.x + world.extent) / world.cellSize);
        if (!surface.segment(site, regions.point(i), TERRAIN_ROUTE_RADIUS))
          throw Error('Economic terrain hub lacks broad access');
      }
      return surface;
    }
    if (repair === 8) break;
    const island = islands[0] ?? regions.groups[1];
    const sample = (group: number[]) => {
      const result: Position[] = [], stride = Math.max(1, Math.floor(group.length / 96));
      for (let i = 0; i < group.length; i += stride) {
        const p = regions.point(group[i]);
        if (Math.max(Math.abs(p.x), Math.abs(p.z)) < world.extent - 9) result.push(p);
      }
      return result;
    }, candidates: { a: Position; b: Position; length: number }[] = [];
    for (const a of sample(main)) for (const b of sample(island)) {
      const length = distance(a, b), rise = Math.abs(surface.heightAt(a.x, a.z) - surface.heightAt(b.x, b.z));
      // Enough run for a low-gradient, eased ascent and generous end landings.
      if (length < 40 || rise / (length - 24) > .22) continue;
      if (protectedSites.some(p => Math.min(distance(p, a), distance(p, b)) < p.radius + 18)) continue;
      candidates.push({ a, b, length });
    }
    candidates.sort((a, b) => a.length - b.length);
    let connected = false;
    // Bounded alternatives, never global flattening or a replacement seed.
    const alternatives: typeof candidates = [];
    for (const candidate of candidates) {
      if (alternatives.some(p => distance(p.a, candidate.a) < 12 && distance(p.b, candidate.b) < 12)) continue;
      alternatives.push(candidate);
      if (alternatives.length === 48) break;
    }
    routeGrid ??= battlefieldRampGrid(world.extent, protectedSites);
    for (const { a, b } of alternatives) {
      const route: Position[] = battlefieldRampRoute(world.extent, a, b, protectedSites, routeGrid) ?? [a, b];
      const source: BattlefieldSurface = surface;
      const legs = route.slice(1).map((q, i) => ({ p: route[i], dx: q.x - route[i].x, dz: q.z - route[i].z,
          length: distance(route[i], q) })).filter(leg => leg.length > .01),
        run = legs.reduce((sum, leg) => sum + leg.length, 0),
        start = source.heightAt(a.x, a.z), end = source.heightAt(b.x, b.z),
        knots = [{ along: 0, height: start }, { along: run, height: end }];
      // A passage near an economic core must follow its existing supporting
      // grade, not pull a high ramp across a low, immutable foundation.
      for (const p of protectedSites) {
        let nearest = Infinity, along = 0, offset = 0, projection = a;
        for (const leg of legs) {
          const t = clamp(((p.x - leg.p.x) * leg.dx + (p.z - leg.p.z) * leg.dz) / (leg.length * leg.length), 0, 1),
            q = { x: leg.p.x + t * leg.dx, z: leg.p.z + t * leg.dz }, d = distance(p, q);
          if (d < nearest) { nearest = d; along = offset + t * leg.length; projection = q; }
          offset += leg.length;
        }
        if (nearest >= p.radius + 24 || along < 20 || along > run - 20) continue;
        const dx = (source.heightAt(p.x + 1, p.z) - source.heightAt(p.x - 1, p.z)) / 2,
          dz = (source.heightAt(p.x, p.z + 1) - source.heightAt(p.x, p.z - 1)) / 2,
          grade = source.heightAt(p.x, p.z) + dx * (projection.x - p.x) + dz * (projection.z - p.z);
        knots.push({ along, height: grade });
      }
      knots.sort((a, b) => a.along - b.along);
      const profile: typeof knots = [];
      for (const knot of knots) {
        const previous = profile[profile.length - 1];
        if (previous && knot.along - previous.along < 8 && previous.along > 0 && knot.along < run) {
          previous.height = (previous.height + knot.height) / 2;
        } else profile.push(knot);
      }
      if (profile.slice(1).some((p, i) => Math.abs(p.height - profile[i].height) / (p.along - profile[i].along) > .32)) continue;
      const targetHeight = (along: number) => {
        for (let i = 1; i < profile.length; i++) if (along <= profile[i].along) {
          const p = profile[i - 1], q = profile[i];
          return p.height + (q.height - p.height) * smooth((along - p.along) / (q.along - p.along));
        }
        return end;
      }, ramp = (x: number, z: number) => {
          const original = source.heightAt(x, z);
          let nearest = Infinity, along = 0, offset = 0;
          for (const leg of legs) {
            const t = clamp(((x - leg.p.x) * leg.dx + (z - leg.p.z) * leg.dz) / (leg.length * leg.length), 0, 1),
              d = Math.hypot(x - leg.p.x - t * leg.dx, z - leg.p.z - t * leg.dz);
            if (d < nearest) { nearest = d; along = offset + t * leg.length; }
            offset += leg.length;
          }
          if (nearest >= 24) return original;
          let influence = (1 - smooth((nearest - 12) / 12)) * smooth(along / 16) * smooth((run - along) / 16);
          // Shoulders never disturb refinery/HQ foundations or resource footprints.
          for (const p of protectedSites)
            influence *= smooth((Math.hypot(x - p.x, z - p.z) - p.radius) / 8);
          return original + (targetHeight(along) - original) * influence;
        }, proposed = bake(ramp);
      let clear = true;
      for (const leg of legs) {
        let previous = leg.p;
        const steps = Math.ceil(leg.length / world.cellSize);
        for (let i = 0; i <= steps; i++) {
          const p = { x: leg.p.x + leg.dx * i / steps, z: leg.p.z + leg.dz * i / steps };
          if (!proposed.fits(p.x, p.z, TERRAIN_ROUTE_RADIUS) ||
              !proposed.segment(previous, p, TERRAIN_ROUTE_RADIUS)) { clear = false; break; }
          previous = p;
        }
        if (!clear) break;
      }
      if (!clear) continue;
      const proposedEconomy = battlefieldTerrainEconomyAccess(proposed, world.layout.resourceSites);
      // An otherwise valid new ramp must never cut an existing economic access,
      // even while other isolated resource regions still need their own repair.
      if (economyAccess.some((accessible, i) => accessible && !proposedEconomy[i])) continue;
      surface = proposed; economyAccess = proposedEconomy; connected = true; break;
    }
    if (!connected) throw Error('Cannot connect broad terrain shelf with a safe ramp');
  }
  throw Error('Broad terrain connectivity repair budget exceeded');
}
