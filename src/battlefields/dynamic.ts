/* Shared generation pipeline: public layout, sampled morphology, economic support,
 * audited surface, then presentation. No player slot shapes the landscape. */
'use strict';
function dynamicBattlefieldLayout(seed: number, extent: number): BattlefieldLayout {
  const random = seeded(seed ^ 0x4c41594f), sites: Position[] = [], count = 8 + Math.floor(random() * 2),
    limit = extent - 30, spacing = Math.min(48, extent * .43);
  // Public economy is sampled before terrain and independently of parties.
  for (let attempt = 0; attempt < 32 && sites.length < count; attempt++) {
    sites.length = 0;
    for (let draw = 0; draw < 800 && sites.length < count; draw++) {
      const p = { x: (random() * 2 - 1) * limit, z: (random() * 2 - 1) * limit };
      if (sites.every(q => distance(p, q) >= spacing)) sites.push(p);
    }
  }
  // Bounded fallback keeps crowded draws valid without replacing the seed.
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
  // Short loops provide alternatives without flattening long map-crossing diagonals.
  const pairs = sites.flatMap((a, i) => sites.slice(i + 1).map(b => ({ a, b, length: distance(a, b) })))
    .sort((a, b) => a.length - b.length);
  let loops = 0;
  for (const { a, b } of pairs) {
    if (corridors.some(([p, q]) => (p[0] === a.x && p[1] === a.z && q[0] === b.x && q[1] === b.z) ||
        (q[0] === a.x && q[1] === a.z && p[0] === b.x && p[1] === b.z))) continue;
    corridors.push([[a.x, a.z], [b.x, b.z]]);
    if (++loops === 3) break;
  }
  return { startSites: [], resourceSites: sites, economyRegions: battlefieldEconomyRegions(sites), corridors };
}
function dynamicTerrainPlan(world: Pick<Battlefield, 'terrainSeed' | 'extent' | 'cellSize' | 'landscape' | 'layout'>) {
  // Preserve the conditional canyon sample before economic shoulders. Sharing this
  // explicit cursor is intentional; neither stage may restart or reorder its draws.
  const random = seeded(world.terrainSeed ^ 0x4d4f5250),
    morphology = sampleBattlefieldMorphology(world.terrainSeed, world.extent, world.landscape.terrain, random),
    shoulders = sampleBattlefieldEconomyShoulders(world.layout.economyRegions, random),
    natural = battlefieldNaturalTerrain(morphology),size={extent:world.extent,cellSize:world.cellSize},
    layout={...world.layout,corridors:world.layout.corridorLinks??world.layout.corridors},
    before=fitBattlefieldEconomy(size,{...layout,corridors:[]},natural,shoulders,BUILDINGS.hq.size),
    plan=planBattlefieldCorridors(size,layout,before);
  return {...plan,straightReference:()=>fitBattlefieldEconomy(size,layout,natural,shoulders,BUILDINGS.hq.size)};
}
function createDynamicBattlefield(family: LandscapeFamilyDefinition): BattlefieldDefinition {
  const palette: BattlefieldPalette = { ground: 0x637344, rock: 0x828783, accent: 0xbad49c, flora: 0x355b3a };
  return { family, name: family.name, size: { extent: 180, cellSize: 2.5 }, palette,
    createSize: seed => ({ extent: [160, 180, 200][Math.floor(seeded(seed ^ 0x53495a45)() * 3)], cellSize: 2.5 }),
    createLayout: (seed, size) => dynamicBattlefieldLayout(seed, size.extent),
    render: { ...family.materials, wilderness: 'seeded', terrainReceiverHeight: 80, daylight: true, upland: true,
      landscape: { earth: 'westmarkEarth', bark: 'westmarkBark' }, haze: [0.055, 0.09, 0.13] },
    generate(builder) {
      const w = builder.world, plan = dynamicTerrainPlan(w),surface=w.surface=connectBattlefieldTerrain(w,plan.height,plan);
      w.layout.corridorLinks=plan.links;w.layout.corridors=plan.corridors;w.corridorPlan=plan;
      w.staticGrid.set(surface.cliffs); w.terrainFeatureGrid.set(surface.cliffs);
      buildBattlefieldTerrainView(builder, surface, plan.height);
    }
  };
}
