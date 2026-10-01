/* World families compose morphology, habitat and atmosphere. Selection never advances
 * terrain-placement or encounter streams; pinned landscape seeds also pin the family. */
'use strict';
interface WorldVariationRecipe {
  id:string; name:string; biome:EcologyBiome; flora:EcologyFlora; relief:WorldReliefForm;
  amplitude:number; hour:number; weather:EcologyWeather;
  heightScale?:number; landmark?:WorldVariation['landmark'];
  dry?:readonly [number,number,number]; lush?:readonly [number,number,number];
  leaf?:number; bloom?:number;
}
const WORLD_VARIATIONS:Readonly<Record<WorldVariationFamily,readonly WorldVariationRecipe[]>> = {
  alien:[
    {id:'lantern-basin',name:'LANTERN BASINS',biome:'mycelium',flora:'Fungus',relief:'basin',amplitude:12,hour:21,weather:'mist'},
    {id:'coral-highlands',name:'CORAL HIGHLANDS',biome:'mycelium',flora:'Coral',relief:'craters',amplitude:14,hour:8,weather:'rain',dry:[.45,.22,.29],lush:[.19,.39,.39],leaf:0xe78196,bloom:0x88d8df},
    {id:'glass-steppe',name:'GLASS STEPPE',biome:'rime',flora:'Spire',relief:'dunes',amplitude:10,hour:15,weather:'snow',dry:[.43,.52,.64],lush:[.24,.33,.48],leaf:0xb0dce8},
    {id:'amber-fans',name:'AMBER FANLANDS',biome:'ochre',flora:'Fan',relief:'terraces',amplitude:13,hour:18,weather:'ash',leaf:0xe9af65,bloom:0xa5d3bc},
    {id:'scarlet-pods',name:'SCARLET NURSERIES',biome:'mycelium',flora:'Pod',relief:'folds',amplitude:11,hour:7,weather:'rain',dry:[.36,.20,.32],lush:[.33,.36,.26],leaf:0xd5749c,bloom:0xf0ba85},
    {id:'bone-arches',name:'BONE ARCHES',biome:'mycelium',flora:'Arch',relief:'craters',amplitude:15,hour:19,weather:'mist',dry:[.43,.38,.51],lush:[.22,.32,.41],leaf:0xd8d9c4},
    {id:'jade-reeds',name:'JADE REED SEA',biome:'verdant',flora:'Reed',relief:'rolling',amplitude:12,hour:10,weather:'rain',dry:[.37,.46,.32],lush:[.12,.35,.33],leaf:0x8bdbc6},
    {id:'ivory-shelves',name:'IVORY SHELF GARDENS',biome:'rime',flora:'Shelf',relief:'terraces',amplitude:14,hour:17,weather:'mist',leaf:0xd6d5ee,bloom:0x8ccec8}
  ],
  desert:[
    {id:'wind-sea',name:'WIND-SCARRED DUNES',biome:'ochre',flora:'Cactus',relief:'dunes',amplitude:9,hour:15,weather:'clear',landmark:'Relic',dry:[.74,.55,.31],lush:[.46,.43,.26],leaf:0x9eac78},
    {id:'red-mesas',name:'RED MESA COUNTRY',biome:'ochre',flora:'Acacia',relief:'terraces',amplitude:13,hour:18,weather:'ash',landmark:'Relic',dry:[.65,.32,.19],lush:[.43,.39,.23]},
    {id:'oasis-valleys',name:'OASIS VALLEYS',biome:'ochre',flora:'Palm',relief:'basin',amplitude:11,hour:9,weather:'mist',landmark:'Relic',dry:[.66,.53,.32],lush:[.25,.41,.27],leaf:0x8bb26b},
    {id:'salt-folds',name:'SALT AND GOLD',biome:'ochre',flora:'Spire',relief:'folds',amplitude:12,hour:12,weather:'clear',landmark:'Spire',dry:[.75,.71,.57],lush:[.50,.43,.30],leaf:0xe1cc98}
  ],
  ship:[
    {id:'solar-dock',name:'SOLAR SERVICE DECK',biome:'ochre',flora:'Spire',relief:'deck',amplitude:0,heightScale:1,hour:15,weather:'clear',landmark:'Radar',dry:[.39,.43,.46],lush:[.65,.48,.24]},
    {id:'cryo-carrier',name:'CRYO CARRIER',biome:'rime',flora:'Spire',relief:'deck',amplitude:0,heightScale:.9,hour:8,weather:'snow',landmark:'Pylon',dry:[.39,.51,.59],lush:[.38,.67,.73]},
    {id:'salvage-fleet',name:'SALVAGE FLEET',biome:'ochre',flora:'Spire',relief:'deck',amplitude:0,heightScale:1.08,hour:19,weather:'ash',landmark:'Wreck',dry:[.45,.34,.28],lush:[.66,.42,.20]},
    {id:'azure-crown',name:'AZURE CROWN',biome:'mycelium',flora:'Spire',relief:'deck',amplitude:0,heightScale:1,hour:22,weather:'mist',landmark:'Pylon',dry:[.33,.47,.57],lush:[.34,.69,.75]},
    {id:'gilded-crown',name:'GILDED CROWN',biome:'ochre',flora:'Spire',relief:'deck',amplitude:0,heightScale:.9,hour:7,weather:'clear',landmark:'Relic',dry:[.55,.46,.32],lush:[.76,.57,.29]},
    {id:'storm-crown',name:'STORM CROWN',biome:'rime',flora:'Spire',relief:'deck',amplitude:0,heightScale:1.06,hour:20,weather:'rain',landmark:'Spire',dry:[.35,.37,.54],lush:[.57,.48,.70]},
    {id:'ember-crown',name:'EMBER CROWN',biome:'ochre',flora:'Spire',relief:'deck',amplitude:0,heightScale:.96,hour:18,weather:'ash',landmark:'Wreck',dry:[.45,.33,.28],lush:[.65,.39,.23]}
  ],
  alpine:[
    {id:'spring-valley',name:'SPRING VALLEY',biome:'verdant',flora:'Grove',relief:'rolling',amplitude:5,hour:10,weather:'rain',landmark:'Relic'},
    {id:'amber-valley',name:'AMBER VALLEY',biome:'ochre',flora:'Grove',relief:'folds',amplitude:7,hour:17,weather:'mist',landmark:'Relic',dry:[.62,.51,.28],lush:[.39,.42,.22],leaf:0xd6ad59},
    {id:'winter-valley',name:'WINTER VALLEY',biome:'rime',flora:'Conifer',relief:'basin',amplitude:6,hour:12,weather:'snow',landmark:'Spire'},
    {id:'high-meadows',name:'HIGH MEADOWS',biome:'verdant',flora:'Conifer',relief:'terraces',amplitude:8,hour:16,weather:'clear',landmark:'Relic',dry:[.57,.58,.31],lush:[.27,.42,.28]}
  ],
  frontier:[
    {id:'green-expanse',name:'GREEN EXPANSE',biome:'verdant',flora:'Grove',relief:'rolling',amplitude:0,hour:12,weather:'mist'},
    {id:'golden-expanse',name:'GOLDEN EXPANSE',biome:'ochre',flora:'Acacia',relief:'rolling',amplitude:0,hour:17,weather:'ash'},
    {id:'frozen-expanse',name:'FROZEN EXPANSE',biome:'rime',flora:'Conifer',relief:'rolling',amplitude:0,hour:10,weather:'snow'},
    {id:'spore-expanse',name:'SPORE EXPANSE',biome:'mycelium',flora:'Coral',relief:'rolling',amplitude:0,hour:19,weather:'rain'}
  ],
  haven:[
    {id:'haven-oasis',name:'HAVEN · GARDEN TERRACES',biome:'ochre',flora:'Palm',relief:'basin',amplitude:8,hour:18.5,weather:'mist',landmark:'Relic',dry:[.63,.49,.29],lush:[.26,.42,.28],leaf:0xa9bd72},
    {id:'haven-orchards',name:'HAVEN · EMERALD ORCHARDS',biome:'verdant',flora:'Grove',relief:'rolling',amplitude:10,hour:10,weather:'rain',landmark:'Relic'},
    {id:'haven-frost',name:'HAVEN · FROST GARDENS',biome:'rime',flora:'Conifer',relief:'terraces',amplitude:12,hour:8,weather:'snow',landmark:'Spire'},
    {id:'haven-bloom',name:'HAVEN · LUMINOUS GARDENS',biome:'mycelium',flora:'Fan',relief:'folds',amplitude:9,hour:20,weather:'mist',landmark:'Pylon'}
  ]
};
function worldVariationRecipe(family:WorldVariationFamily,seed:number):WorldVariationRecipe {
  const list=WORLD_VARIATIONS[family],rand=seeded(seed^0x574f524c);
  return list[Math.floor(rand()*list.length)];
}
function battlefieldVariation(profile:BattlefieldRenderProfile,seed:number):BattlefieldRenderProfile {
  const family=profile.variationFamily;if(!family)return profile;
  const recipe=worldVariationRecipe(family,seed),natural=family!=='ship',
    geology=seeded(seed^0x4d414352),
    landform:WorldReliefForm=family==='alien'?(geology()<.5?'ridges':'broken-crater'):recipe.relief,
    base=battlefieldEcology({...profile,wilderness:recipe.biome},seed),ecology=base.ecology!,
    variation:WorldVariation={id:recipe.id,name:recipe.name+(family==='alien'?(landform==='ridges'?' · RIDGE COUNTRY':' · BROKEN CRATER'):''),
      family,relief:landform,amplitude:family==='alien'?36+geology()*10:recipe.amplitude,
      heightScale:recipe.heightScale??1,flora:recipe.flora,landmark:recipe.landmark??(recipe.biome==='mycelium'?'Spire':'Relic')};
  return battlefieldAtmosphere({...base,variation,ecology:{...ecology,natural,flora:recipe.flora,
    weather:recipe.weather,cover:recipe.weather==='clear'?.18:recipe.weather==='mist'?.58:.8,
    dry:recipe.dry??ecology.dry,lush:recipe.lush??ecology.lush,leaf:recipe.leaf??ecology.leaf,bloom:recipe.bloom??ecology.bloom}},
    {timeOfDay:recipe.hour},seed);
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
  if(style.family!=='ship')return;
  const rand=builder.cosmeticRandom(0x41524348),part=style.landmark,
    model=part==='Relic'||part==='Spire'?`ecology${part}`:`variation${part}`,
    color=e.dry.map(v=>Math.min(1,v*1.6+.22));
  for(let i=0;i<3;i++)w.renderData.geometries.push({mesh:`variationLandmark${i}`,model,seed:197+i*7919,extent:0});
  const place=(i:number,x:number,y:number,z:number,r:number,h:number,yaw:number)=>
    builder.place(`variationLandmark${i%3}`,x,y,z,r,h,r,color,yaw,0,0,0,1,'static',part==='Spire'?'CRYSTAL':'METAL');
  for (const [i, model] of ['shipHangar', 'shipPlant'].entries())
    w.renderData.geometries.push({ mesh: `shipFixture${i}`, model, seed: 197, extent: 0 });
  // Small machinery fits entirely within existing cliff blockers. A support seats its
  // rigid base above the sampled slope; it never creates a playable roof or new obstacle.
  for (let i = 0; i < 100; i++) {
    const x = (rand() - .5) * w.extent * 1.8, z = (rand() - .5) * w.extent * 1.8, r = .65 + rand() * .25;
    if (!ecologyFootprint(w, x, z, r * 1.6 + .4)) continue;
    const bounds = w.surface!.foundationBounds({ x, z }, r * 1.6), h = bounds.max - bounds.min + .05;
    builder.place('box', x, bounds.min + h / 2, z, r * 2.2, h, r * 2.2, color, 0, 0, 0, 0, 1, 'static', 'METAL');
    builder.place(`shipFixture${i % 2}`, x, bounds.max, z, r, 2, r, color, rand() * Math.PI * 2, 0, 0, 0, 1, 'static', 'METAL');
  }
  const backdrop = w.renderData.geometries.find(d => 'relief' in d && d.relief.innerExtent);
  // Large grounded silhouettes remain on the non-playable generated exterior.
  for(let i=0;i<8;i++) {
    const side=i%2?1:-1,x=side*(w.extent+26),z=(Math.floor(i/2)-1.5)*57,
      y=backdrop&&'relief' in backdrop?worldReliefHeightAt(backdrop.relief,x,z):0;
    place(i,x,y,z,5+rand()*2,9+rand()*9,rand()*Math.PI*2);
  }
}
