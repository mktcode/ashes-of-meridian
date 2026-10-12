/* Content only: a family owns its variants, materials and relief selection policy.
 * Array order is seed-owned; reordering recipes changes existing landscapes. */
'use strict';
const LANDSCAPE_FAMILIES: Readonly<Record<WorldVariationFamily, LandscapeFamilyDefinition>> = {
  alien: {
    id: 'alien', name: 'ALIEN PLANET',
    materials: { groundTexture: 'bio', rockSurface: { texture: 'westmarkGranite', metersPerTile: 8 } },
    relief: { mode: 'axis', forms: ['ridges', 'broken-crater'], suffixes: [' · RIDGE COUNTRY', ' · BROKEN CRATER'], heightScale: 1 },
    recipes: [
      {id:'lantern-basin',name:'LANTERN BASINS',habitat:{biome:'mycelium',flora:'Fungus',weather:'mist'}},
      {id:'coral-highlands',name:'CORAL HIGHLANDS',habitat:{biome:'mycelium',flora:'Coral',weather:'rain',dry:[.45,.22,.29],lush:[.19,.39,.39],leaf:0xe78196,bloom:0x88d8df}},
      {id:'glass-steppe',name:'GLASS STEPPE',habitat:{biome:'rime',flora:'Spire',weather:'snow',dry:[.43,.52,.64],lush:[.24,.33,.48],leaf:0xb0dce8}},
      {id:'amber-fans',name:'AMBER FANLANDS',habitat:{biome:'ochre',flora:'Fan',weather:'ash',leaf:0xe9af65,bloom:0xa5d3bc}},
      {id:'scarlet-pods',name:'SCARLET NURSERIES',habitat:{biome:'mycelium',flora:'Pod',weather:'rain',dry:[.36,.20,.32],lush:[.33,.36,.26],leaf:0xd5749c,bloom:0xf0ba85}},
      {id:'bone-arches',name:'BONE ARCHES',habitat:{biome:'mycelium',flora:'Arch',weather:'mist',dry:[.43,.38,.51],lush:[.22,.32,.41],leaf:0xd8d9c4}},
      {id:'jade-reeds',name:'JADE REED SEA',habitat:{biome:'verdant',flora:'Reed',weather:'rain',dry:[.37,.46,.32],lush:[.12,.35,.33],leaf:0x8bdbc6}},
      {id:'ivory-shelves',name:'IVORY SHELF GARDENS',habitat:{biome:'rime',flora:'Shelf',weather:'mist',leaf:0xd6d5ee,bloom:0x8ccec8}}
    ]
  },
  desert: {
    id: 'desert', name: 'DESERT',
    materials: { groundTexture: 'ground', rockSurface: { texture: 'desertRock', metersPerTile: 8 } },
    relief: { mode: 'recipe' },
    recipes: [
      {id:'wind-sea',name:'WIND-SCARRED DUNES',terrain:{relief:'dunes',heightScale:1},habitat:{biome:'ochre',flora:'Cactus',weather:'clear',landmark:'Relic',dry:[.74,.55,.31],lush:[.46,.43,.26],leaf:0x9eac78}},
      {id:'red-mesas',name:'RED MESA COUNTRY',terrain:{relief:'terraces',heightScale:1},habitat:{biome:'ochre',flora:'Acacia',weather:'ash',landmark:'Relic',dry:[.65,.32,.19],lush:[.43,.39,.23]}},
      {id:'oasis-valleys',name:'OASIS VALLEYS',terrain:{relief:'basin',heightScale:1},habitat:{biome:'ochre',flora:'Palm',weather:'mist',landmark:'Relic',dry:[.66,.53,.32],lush:[.25,.41,.27],leaf:0x8bb26b}},
      {id:'salt-folds',name:'SALT AND GOLD',terrain:{relief:'folds',heightScale:1},habitat:{biome:'ochre',flora:'Spire',weather:'clear',landmark:'Spire',dry:[.75,.71,.57],lush:[.50,.43,.30],leaf:0xe1cc98}}
    ]
  },
  westmark: {
    id: 'westmark', name: 'WESTMARK',
    materials: { groundTexture: 'westmarkMeadow', rockSurface: { texture: 'westmarkGranite', metersPerTile: 8 } },
    relief: { mode: 'recipe' },
    recipes: [
      {id:'spring-valley',name:'SPRING VALLEY',terrain:{relief:'rolling',heightScale:1},habitat:{biome:'verdant',flora:'Grove',weather:'rain',landmark:'Relic'}},
      {id:'amber-valley',name:'AMBER VALLEY',terrain:{relief:'folds',heightScale:1},habitat:{biome:'ochre',flora:'Grove',weather:'mist',landmark:'Relic',dry:[.62,.51,.28],lush:[.39,.42,.22],leaf:0xd6ad59}},
      {id:'winter-valley',name:'WINTER VALLEY',terrain:{relief:'basin',heightScale:1},habitat:{biome:'rime',flora:'Conifer',weather:'snow',landmark:'Spire'}},
      {id:'high-meadows',name:'HIGH MEADOWS',terrain:{relief:'terraces',heightScale:1},habitat:{biome:'verdant',flora:'Conifer',weather:'clear',landmark:'Relic',dry:[.57,.58,.31],lush:[.27,.42,.28]}}
    ]
  },
  frontier: {
    id: 'frontier', name: 'FRONTIER',
    materials: { groundTexture: 'westmarkMeadow', rockSurface: { texture: 'westmarkGranite', metersPerTile: 8 } },
    relief: { mode: 'recipe' },
    recipes: [
      {id:'green-expanse',name:'GREEN EXPANSE',terrain:{relief:'rolling',heightScale:1},habitat:{biome:'verdant',flora:'Grove',weather:'mist'}},
      {id:'golden-expanse',name:'GOLDEN EXPANSE',terrain:{relief:'rolling',heightScale:1},habitat:{biome:'ochre',flora:'Acacia',weather:'ash'}},
      {id:'frozen-expanse',name:'FROZEN EXPANSE',terrain:{relief:'rolling',heightScale:1},habitat:{biome:'rime',flora:'Conifer',weather:'snow'}},
      {id:'spore-expanse',name:'SPORE EXPANSE',terrain:{relief:'rolling',heightScale:1},habitat:{biome:'mycelium',flora:'Coral',weather:'rain'}}
    ]
  },
  haven: {
    id: 'haven', name: 'HAVEN',
    materials: { groundTexture: 'westmarkMeadow', rockSurface: { texture: 'westmarkGranite', metersPerTile: 8 } },
    relief: { mode: 'recipe' },
    recipes: [
      {id:'haven-oasis',name:'HAVEN · GARDEN TERRACES',terrain:{relief:'basin',heightScale:1},habitat:{biome:'ochre',flora:'Palm',weather:'mist',landmark:'Relic',dry:[.63,.49,.29],lush:[.26,.42,.28],leaf:0xa9bd72}},
      {id:'haven-orchards',name:'HAVEN · EMERALD ORCHARDS',terrain:{relief:'rolling',heightScale:1},habitat:{biome:'verdant',flora:'Grove',weather:'rain',landmark:'Relic'}},
      {id:'haven-frost',name:'HAVEN · FROST GARDENS',terrain:{relief:'terraces',heightScale:1},habitat:{biome:'rime',flora:'Conifer',weather:'snow',landmark:'Spire'}},
      {id:'haven-bloom',name:'HAVEN · LUMINOUS GARDENS',terrain:{relief:'folds',heightScale:1},habitat:{biome:'mycelium',flora:'Fan',weather:'mist',landmark:'Pylon'}}
    ]
  }
};
