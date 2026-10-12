/* Resolve one landscape before terrain generation. CPU form, habitat and presentation
 * share a seed but own explicit contracts; presentation never drives CPU morphology. */
'use strict';
function worldVariationRecipe(family: LandscapeFamilyDefinition, seed: number): LandscapeVariantDefinition {
  const list = family.recipes, rand = seeded(seed ^ 0x574f524c);
  if (!list.length) throw Error('Landscape family requires at least one recipe');
  return list[Math.floor(rand() * list.length)];
}
function resolveBattlefieldLandscape(family: LandscapeFamilyDefinition, profile: BattlefieldRenderProfile,
    seed: number): ResolvedLandscapeRecipe {
  const recipe = worldVariationRecipe(family, seed), habitat = recipe.habitat;
  let terrain: BattlefieldTerrainRecipe, suffix = '', reservedGeology: (() => number) | undefined;
  if (family.relief.mode === 'axis') {
    const geology = seeded(seed ^ 0x4d414352), index = geology() < .5 ? 0 : 1;
    terrain = Object.freeze({ relief: family.relief.forms[index], heightScale: family.relief.heightScale });
    suffix = family.relief.suffixes[index];
    reservedGeology = geology;
  } else {
    if (!recipe.terrain) throw Error('Recipe-owned relief requires terrain parameters');
    terrain = Object.freeze({ ...recipe.terrain });
    if (terrain.relief === 'terraces') suffix = ' · PLATEAU COUNTRY';
  }
  const base = battlefieldEcology({ ...profile, wilderness: habitat.biome }, seed), ecology = base.ecology!;
  // Reserve the former amplitude sample after habitat resolution, in its original
  // draw order. It was metadata, never a terrain input.
  reservedGeology?.();
  const variation: WorldVariation = { id: recipe.id, name: recipe.name + suffix,
      family: family.id, relief: terrain.relief, heightScale: terrain.heightScale,
      flora: habitat.flora, landmark: habitat.landmark ?? (habitat.biome === 'mycelium' ? 'Spire' : 'Relic') },
    resolvedHabitat: BattlefieldEcology = { ...ecology, natural: true, flora: habitat.flora,
      weather: habitat.weather, cover: habitat.weather === 'clear' ? .18 : habitat.weather === 'mist' ? .58 : .8,
      dry: habitat.dry ?? ecology.dry, lush: habitat.lush ?? ecology.lush,
      leaf: habitat.leaf ?? ecology.leaf, bloom: habitat.bloom ?? ecology.bloom },
    presentation = battlefieldAtmosphere({ ...base, variation, ecology: resolvedHabitat }, { timeOfDay: 'seeded' }, seed);
  // Habitat's cosmetic elevation range is filled once the authoritative surface exists.
  return Object.freeze({ terrain, habitat: resolvedHabitat, presentation });
}
function decorateWorldVariation(builder:BattlefieldBuilder) {
  const w=builder.world,style=w.renderProfile.variation,e=w.renderProfile.ecology;
  if(!style||!e)return;
  if(style.family==='alien'&&style.flora!=='Fungus') {
    let variant=0;
    for(const g of w.renderData.geometries)if('seed' in g&&(g.mesh.startsWith('alienTree')||g.mesh==='alienSapling')) {
      g.model=`variationAlien${style.flora}`;g.seed=w.terrainSeed^(++variant*7919);
    }
    w.renderData.geometries=w.renderData.geometries.filter(g=>!g.mesh.startsWith('alienCapGills'));
    w.renderData.placements=w.renderData.placements.filter(p=>!p.mesh.startsWith('alienCapGills')&&p.mesh!=='alienLanternPool');
    for(const p of w.renderData.placements) {
      if(p.mesh.startsWith('alienTree')||p.mesh==='alienSapling') {
        // New complete forms (including arches) fit the old trunk collision circle,
        // with the same conservative wind margin as the shared ecology scatter.
        const radius=Math.max(.05,p.scale[0]*.6-.4);p.scale[0]=radius;p.scale[2]=radius;
        p.color=e.leaf;p.material=style.flora==='Spire'?'CRYSTAL':'LEAF';
      }
    }
  }
}
