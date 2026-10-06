/* Public, terrain-derived worker candidates. Assignment uses a separate private RNG. */
'use strict';
type DeploymentMode = 'resource-start' | 'exploration';
function battlefieldGasPosition(site: Position): Position { return { x: site.x + 7, z: site.z + 7 }; }
function battlefieldCrystalPosition(site: Position, _index: number, deposit: number): Position {
  // Open toward positive Z to preserve the refinery space at (+7, +7).
  // The wider radius keeps adjacent cluster bodies and worker passages separate.
  const a = Math.PI / 2 + deposit * Math.PI / 4;
  return { x: site.x + Math.sin(a) * 5.5, z: site.z + Math.cos(a) * 5.5 };
}
function battlefieldEconomyDistance(world: Battlefield, p: Position): number {
  return Math.min(...world.layout.resourceSites.flatMap((site, i) => [battlefieldGasPosition(site),
    ...Array.from({ length: 5 }, (_, j) => battlefieldCrystalPosition(site, i, j))]).map(r => distance(p, r)));
}
function battlefieldDeploymentSpace(world: Battlefield, p: Position): boolean {
  if (!world.surface!.fits(p.x, p.z, 3) || battlefieldEconomyDistance(world, p) < 4) return false;
  for (const radius of [7, 11]) for (let i = 0; i < 16; i++) {
    const q = { x: p.x + Math.sin(i * Math.PI / 8) * radius, z: p.z + Math.cos(i * Math.PI / 8) * radius };
    if (world.deploymentReachable[world.idx(q.x, q.z)] && world.surface!.foundation(q, BUILDINGS.hq.size) && battlefieldEconomyDistance(world, q) > BUILDINGS.hq.size + 2.2 &&
      world.surface!.segment(p, q, 1.5)) return true;
  }
  return false;
}
function battlefieldDeploymentCandidates(world: Battlefield): Position[] {
  const n = world.gridSize, free = new Uint8Array(n * n), visited = new Uint8Array(n * n), groups: number[][] = [];
  for (let i = 0; i < free.length; i++) {
    const p = world.point(i); free[i] = world.surface!.fits(p.x, p.z, 2.6) ? 1 : 0;
  }
  // All parties and all guaranteed economy regions share the main vehicle component.
  for (let root = 0; root < free.length; root++) if (free[root] && !visited[root]) {
    const queue = [root]; visited[root] = 1;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head], x = i % n, z = Math.floor(i / n);
      for (const j of [x ? i - 1 : -1, x < n - 1 ? i + 1 : -1, z ? i - n : -1, z < n - 1 ? i + n : -1])
        if (j >= 0 && free[j] && !visited[j]) { visited[j] = 1; queue.push(j); }
    }
    groups.push(queue);
  }
  const component = groups.sort((a, b) => b.length - a.length)[0];
  if (!component) throw Error('No connected deployment terrain');
  const reachable = world.deploymentReachable = new Uint8Array(n * n);
  for (const i of component) reachable[i] = 1;
  for (const site of world.layout.resourceSites)
    if (!reachable[world.idx(site.x, site.z)] || !reachable[world.idx(site.x + 7, site.z + 7)])
      throw Error('Resource region is disconnected from deployment terrain');
  const candidates: Position[] = [], add = (p: Position, pool = candidates) => {
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) > world.extent - 17 || !reachable[world.idx(p.x, p.z)] ||
      !battlefieldDeploymentSpace(world, p) || pool.some(q => distance(p, q) < 5)) return;
    pool.push({ ...p });
  };
  for (const site of world.layout.resourceSites) add({ x: site.x - 6, z: site.z + 6 });
  for (let z = 4; z < n - 4; z += 4) for (let x = 4; x < n - 4; x += 4) add(world.point(z * n + x));
  const sufficient = () => {
    const exploration = candidates.filter(p => battlefieldEconomyDistance(world, p) > 24), minimum = Math.min(65, world.extent * .55);
    if (exploration.length < 8) return false;
    const separated = (chosen: Position[], from: number): boolean => {
      if (chosen.length === 4) return true;
      for (let i = from; i <= exploration.length - (4 - chosen.length); i++)
        if (chosen.every(p => distance(p, exploration[i]) >= minimum) && separated([...chosen, exploration[i]], i + 1)) return true;
      return false;
    };
    return separated([], 0);
  };
  // Keep the coarse pool unchanged when adequate. Narrow shelves can lie between
  // its samples: refine deterministically without reshaping terrain or consuming RNG.
  if (!sufficient()) {
    // Thin the refined exploration pool independently: a coarse candidate just
    // inside an economy radius must not suppress a valid shelf just outside it.
    const refined: Position[] = [];
    for (let z = 4; z < n - 4; z++) for (let x = 4; x < n - 4; x++) {
      const p = world.point(z * n + x);
      if (battlefieldEconomyDistance(world, p) > 24) add(p, refined);
    }
    candidates.push(...refined.filter(p => !candidates.some(q => distance(p, q) < .01)));
  }
  if (!sufficient()) throw Error('Insufficient exploration deployment space');
  return candidates;
}
// Optional exploration rewards: never modify terrain, economy, navigation or start RNG.
function battlefieldSupplyCaches(world: Battlefield): SupplyCache[] {
  const random = seeded(world.terrainSeed ^ 0x43524154), candidates: Position[] = [];
  for (let z = 4; z < world.gridSize - 4; z += 3) for (let x = 4; x < world.gridSize - 4; x += 3) {
    const p = world.point(z * world.gridSize + x);
    if (world.deploymentReachable[world.idx(p.x, p.z)] && battlefieldEconomyDistance(world, p) >= 28 &&
        world.surface!.fits(p.x, p.z, 4) && world.surface!.foundation(p, 3.5)) candidates.push(p);
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const caches: SupplyCache[] = [], budget = clamp(Math.round(world.extent / 20), 4, 9);
  for (const p of candidates) {
    if (caches.some(q => distance(p, q) < 26)) continue;
    const tier = (1 + Math.floor(random() * 3)) as SupplyCache['tier'];
    caches.push({ ...p, resource: 'alloy', tier, amount: [60, 120, 200][tier - 1], collected: false });
    if (caches.length >= budget) break;
  }
  // The shuffled placement order randomizes Echo locations, with a strict minority.
  const echoCount = Math.floor(caches.length / 4);
  for (let i = 0; i < echoCount; i++) {
    caches[i].resource = 'gas';
    caches[i].amount = [15, 30, 50][caches[i].tier - 1];
  }
  return caches;
}

function allocateBattlefieldStarts(world: Battlefield, seed: number, count: number, mode: DeploymentMode): Position[] {
  if (!Number.isInteger(count) || count < 2 || count > 4) throw Error('Invalid starting party count');
  const random = seeded(seed ^ 0x53544152), shuffle = (points: Position[]) => {
    const result = [...points];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }, exploration = shuffle(world.startSites.filter(p => battlefieldEconomyDistance(world, p) > 24)),
    first = mode === 'resource-start' ? shuffle(world.layout.resourceSites.map(site => ({ x: site.x - 6, z: site.z + 6 }))
      .filter(p => world.deploymentReachable[world.idx(p.x, p.z)] && battlefieldDeploymentSpace(world, p))) : exploration,
    minimum = Math.min(65, world.extent * .55);
  const search = (chosen: Position[]): Position[] | null => {
    if (chosen.length === count) return chosen;
    const pool = chosen.length ? exploration : first;
    for (const p of pool) if (chosen.every(q => distance(p, q) >= minimum)) {
      const result = search([...chosen, p]); if (result) return result;
    }
    return null;
  };
  let starts = search([]);
  if (!starts) throw Error('No separated deployment allocation');
  // Compare a bounded set of farthest-first allocations, not every combination.
  // Nearby economy is a placement preference only; it assigns no ownership and
  // does not reveal resources to the AI. Shuffled order breaks all ties privately.
  const regions = new Map<Position, number>();
  for (const p of [...first, ...exploration]) {
    let nearest = -1, best = Infinity;
    for (const [i, site] of world.layout.resourceSites.entries()) {
      const d = distance(p, site);
      if (d < best) { nearest = i; best = d; }
    }
    regions.set(p, nearest);
  }
  const regionCount = (points: Position[]) => new Set(points.map(p => regions.get(p))).size;
  const separation = (points: Position[]) => Math.min(...points.flatMap((p, i) => points.slice(0, i).map(q => distance(p, q))));
  let bestRegions = regionCount(starts), bestSeparation = separation(starts);
  for (const anchor of first.slice(0, 24)) {
    const chosen = [anchor];
    while (chosen.length < count) {
      const used = new Set(chosen.map(p => regions.get(p)));
      let next: Position | undefined, nextNewRegion = -1, nextDistance = -1;
      for (const p of exploration) {
        const d = Math.min(...chosen.map(q => distance(p, q)));
        if (d < minimum) continue;
        const newRegion = used.has(regions.get(p)) ? 0 : 1;
        if (newRegion > nextNewRegion || (newRegion === nextNewRegion && d > nextDistance)) {
          next = p; nextNewRegion = newRegion; nextDistance = d;
        }
      }
      if (!next) break;
      chosen.push(next);
    }
    if (chosen.length !== count) continue;
    const distinct = regionCount(chosen), spread = separation(chosen);
    if (distinct > bestRegions || (distinct === bestRegions && spread > bestSeparation)) {
      starts = chosen; bestRegions = distinct; bestSeparation = spread;
    }
  }
  return starts.map(p => ({ ...p }));
}
