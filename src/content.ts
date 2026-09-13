/* Battle definitions, balancing, iconography and faction nomenclature. */
'use strict';
// Stable numeric IDs; display names below are content, never lookup keys.
const FACTION_ID = Object.freeze({ FIRST: 0, SECOND: 1, THIRD: 2 } as const);
type FactionId = (typeof FACTION_ID)[keyof typeof FACTION_ID];

const FACTIONS = [
  {
    name: 'The Free Marches',
    short: 'FREE MARCHES',
    sigil: '◈',
    color: 0x78ded3,
    accent: 0xebb979,
    metal: 0x627885,
    dark: 0x273642,
    desc: 'Frontier steel. Stubborn hearts.',
    trait: 'Armored vehicles have 15% more hull. Command centers repair nearby allies.',
    ability: 'Orbital barrage',
    units: {
      worker: 'Prospector',
      rifle: 'Vanguard',
      medic: 'Field medic',
      tank: 'Ironclad',
      artillery: 'Longbow',
      air: 'Kestrel',
      hero: 'Field commander'
    },
    buildings: {
      hq: 'Command center',
      barracks: 'Muster station',
      depot: 'Logistics depot',
      refinery: 'Aether refinery',
      factory: 'War foundry',
      hangar: 'Flight deck',
      turret: 'Sentinel turret'
    }
  },
  {
    name: 'The Verdant Choir',
    short: 'VERDANT CHOIR',
    sigil: '❋',
    color: 0x8bdfad,
    accent: 0xd2abe8,
    metal: 0x526d64,
    dark: 0x263f3a,
    desc: 'A thousand lives. One memory.',
    trait:
      'Units cost 15% less alloy, move 10% faster and regenerate outside combat. Lighter hulls.',
    ability: 'Bloom of unmaking',
    units: {
      worker: 'Tender',
      rifle: 'Thornling',
      medic: 'Lifesinger',
      tank: 'Rootbeast',
      artillery: 'Sporecaller',
      air: 'Mothwing',
      hero: 'The First Voice'
    },
    buildings: {
      hq: 'Memory heart',
      barracks: 'Bloom nursery',
      depot: 'Living canopy',
      refinery: 'Sap well',
      factory: 'Root hollow',
      hangar: 'Chrysalis',
      turret: 'Thorn spire'
    }
  },
  {
    name: 'The Veiled Court',
    short: 'VEILED COURT',
    sigil: '◇',
    color: 0xcab7f2,
    accent: 0x79d9e3,
    metal: 0xc7c3ba,
    dark: 0x3c3b50,
    desc: 'Beautiful. Ancient. Afraid.',
    trait: 'Units have regenerative shields and deal 12% more damage. Alloy costs are 12% higher.',
    ability: 'Judgment beam',
    units: {
      worker: 'Custodian',
      rifle: 'Pallbearer',
      medic: 'Absolver',
      tank: 'Sepulcher',
      artillery: 'Elegist',
      air: 'Seraph',
      hero: 'The Unmasked'
    },
    buildings: {
      hq: 'Silent throne',
      barracks: 'Processional gate',
      depot: 'Votive pillar',
      refinery: 'Aether prism',
      factory: 'Tomb forge',
      hangar: 'Sky sepulcher',
      turret: 'Mourning obelisk'
    }
  }
] as const;
const UNITS = {
  worker: {
    cost: 50,
    gas: 0,
    hp: 100,
    damage: 5,
    range: 2.5,
    reload: 1.2,
    speed: 4.5,
    size: 0.65,
    supply: 1,
    time: 9,
    from: 'hq',
    vision: 15,
    desc: 'Harvests alloy automatically. Free workers construct newly placed structures without interrupting builders or repairers. Select a worker, then tap an own foundation to resume building, a damaged allied building/unit to repair, or crystals to mine.'
  },
  rifle: {
    cost: 75,
    gas: 0,
    hp: 150,
    damage: 13,
    range: 9,
    reload: 0.82,
    speed: 4.4,
    size: 0.65,
    supply: 2,
    time: 11,
    from: 'barracks',
    vision: 17,
    desc: 'Versatile ranged infantry. Attacks ground and air. Excellent in groups; vulnerable to artillery.'
  },
  medic: {
    cost: 100,
    gas: 35,
    hp: 130,
    damage: 0,
    range: 9,
    reload: 1,
    speed: 4.7,
    size: 0.65,
    supply: 2,
    time: 16,
    from: 'barracks',
    vision: 17,
    heal: 20,
    desc: 'Automatically restores 20 hull per second to nearby allies. Unarmed. Move with your frontline to keep squads alive.'
  },
  tank: {
    cost: 200,
    gas: 70,
    hp: 520,
    damage: 58,
    range: 12,
    reload: 2.1,
    speed: 2.9,
    size: 1.3,
    supply: 4,
    time: 24,
    from: 'factory',
    vision: 19,
    splash: 2.6,
    groundOnly: true,
    desc: 'Heavy assault armor. Explosive shells damage clustered ground targets. Cannot attack aircraft; escort with infantry.'
  },
  artillery: {
    cost: 235,
    gas: 95,
    hp: 260,
    damage: 100,
    range: 23,
    reload: 3.8,
    speed: 2.5,
    size: 1.2,
    supply: 4,
    time: 29,
    from: 'factory',
    vision: 18,
    splash: 4.5,
    minRange: 5,
    groundOnly: true,
    desc: 'Long-range siege weapon. Shells have travel time and a large blast radius. Minimum range 5. Needs vision and protection.'
  },
  air: {
    cost: 180,
    gas: 100,
    hp: 245,
    damage: 25,
    range: 11,
    reload: 0.85,
    speed: 7,
    size: 1,
    supply: 3,
    time: 25,
    from: 'hangar',
    vision: 23,
    flying: true,
    desc: 'Strike aircraft. Crosses terrain and attacks ground or air. Excellent for flanking artillery and striking exposed objectives.'
  },
  hero: {
    cost: 300,
    gas: 100,
    hp: 850,
    damage: 31,
    range: 11,
    reload: 0.7,
    speed: 5,
    size: 0.8,
    supply: 0,
    time: 40,
    from: 'hq',
    vision: 22,
    desc: 'Your veteran field commander. A powerful ranged fighter. Reconstruct at command if lost.'
  }
} as const satisfies Record<string, UnitDefinitionShape>;

type UnitType = keyof typeof UNITS;
type UnitDefinition = (typeof UNITS)[UnitType];

const BUILDING_YAW = Math.PI / 15;
const BUILDINGS = {
  hq: {
    cost: 400,
    gas: 0,
    hp: 2600,
    size: 4.4,
    time: 45,
    cap: 24,
    desc: 'Your command nexus. Trains workers and reconstructs the commander. Workers deliver alloy here; it provides no passive resources.'
  },
  barracks: {
    cost: 145,
    gas: 0,
    hp: 1150,
    size: 3,
    time: 22,
    desc: 'Recruits infantry and medics. Build multiple stations to produce units in parallel.'
  },
  depot: {
    cost: 85,
    gas: 0,
    hp: 750,
    size: 2.3,
    time: 16,
    cap: 16,
    desc: 'Adds 16 supply. Queued recruits reserve supply immediately. Maximum force capacity is 180.'
  },
  refinery: {
    cost: 100,
    gas: 0,
    hp: 850,
    size: 2.3,
    time: 20,
    desc: 'Place within 8 meters of an aether vent. Generates 1.7 aether per second; no worker is needed after construction.'
  },
  factory: {
    cost: 225,
    gas: 85,
    hp: 1450,
    size: 3.8,
    time: 32,
    requires: 'barracks',
    desc: 'Produces heavy armor and siege artillery. Requires a completed muster station.'
  },
  hangar: {
    cost: 220,
    gas: 115,
    hp: 1250,
    size: 3.8,
    time: 32,
    requires: 'factory',
    desc: 'Produces strike aircraft. Requires a completed war foundry.'
  },
  turret: {
    cost: 115,
    gas: 25,
    hp: 800,
    size: 1.7,
    time: 19,
    damage: 28,
    range: 15,
    reload: 1.05,
    vision: 20,
    desc: 'Automated ground and air defense. Protects workers and choke points, but can be outranged by artillery.'
  }
} as const satisfies Record<string, BuildingDefinitionShape>;

type BuildingType = keyof typeof BUILDINGS;
type BuildingDefinition = (typeof BUILDINGS)[BuildingType];

const ABILITIES = {
  orbital: { energy: 85, cd: 48 },
  repair: { energy: 45, cd: 28 },
  scan: { energy: 25, cd: 17 },
  drop: { energy: 95, cd: 75 }
} as const satisfies Record<string, AbilityDefinition>;

type AbilityType = keyof typeof ABILITIES;

const STARTING_ALLOY = [250, 300, 350, 400, 450, 500] as const;
const AETHER_EVACUATION_CAPS = [100, 200, 350, 500, 750, 1000] as const;

const META = {
  startingAlloy: {
    name: 'Starting alloy',
    icon: 'crystal',
    desc: 'Adds 50 starting alloy per level, raising expedition reserves from 250 to 500.',
    max: 5,
    costs: [100, 200, 300, 450, 650]
  },
  startingWorkers: {
    name: 'Starting workers',
    icon: 'worker',
    desc: 'Start each new battle with one additional worker per level, up to five.',
    max: 5,
    costs: [300, 450, 650, 900, 1200]
  },
  aetherEvacuation: {
    name: 'Aether evacuation',
    icon: 'save',
    desc: 'Raises the recovered aether limit per battle: 100 → 200 → 350 → 500 → 750 → 1,000.',
    max: 5,
    costs: [500, 800, 1200, 1800, 2600]
  }
} as const satisfies Record<string, UpgradeDefinition>;

type UpgradeType = keyof typeof META;

// Stable, content-independent keys; names and visual parameters may change.
const BIOMES = {
  biome0: {
    name: 'ASH WASTES',
    ground: 0x3a4144,
    rock: 0x495158,
    haze: [0.064, 0.095, 0.126],
    accent: 0xe3a46d,
    flora: 0x625647
  },
  biome1: {
    name: 'RUST FRONTIER',
    ground: 0x59443a,
    rock: 0x74544a,
    haze: [0.11, 0.085, 0.1],
    accent: 0xf0b67b,
    flora: 0x806348
  },
  biome2: {
    name: 'LIVING GARDENS',
    ground: 0x314747,
    rock: 0x49656a,
    haze: [0.052, 0.113, 0.127],
    accent: 0x8bebc2,
    flora: 0x538a77
  },
  biome3: {
    name: 'SILENT NECROPOLIS',
    ground: 0x424459,
    rock: 0x626679,
    haze: [0.075, 0.082, 0.145],
    accent: 0xc8b2f4,
    flora: 0x838094
  },
  biome4: {
    name: 'STELLAR INTERIOR',
    ground: 0x3d3c48,
    rock: 0x5a5261,
    haze: [0.1, 0.065, 0.125],
    accent: 0xe7be88,
    flora: 0x715b72
  }
} as const satisfies Record<string, BiomeDefinition>;

type BiomeType = keyof typeof BIOMES;

const ICON_PATHS = {
  worker: 'M8 15l-4 5m8-10 8-6 2 2-6 8M5 8l3-3 11 11-3 3z',
  rifle: 'M5 20l3-6 6-1 5-8 2 1-4 10-6 1-3 4M4 9l5-5 5 2-5 5z',
  medic: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  tank: 'M3 15h18v5H3zM6 15V9h11v6M12 9V5h9M5 18h14',
  artillery: 'M4 19h16M5 16l3-7h7l4 7M11 9l7-6 3 2-7 7M8 19v2m8-2v2',
  air: 'M12 2l3 9 7 6v2l-9-3-1 6-1-6-9 3v-2l7-6z',
  hero: 'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
  hq: 'M3 20V9l9-6 9 6v11zM7 20V12h10v8M10 3V1m4 2V1M2 9h20M9 15h6',
  barracks: 'M3 20V8l5-4h9l4 4v12zM8 20v-9h8v9M3 8h18M10 4v3m4-3v3',
  depot: 'M3 7l9-4 9 4v13H3zM3 7h18M8 7v13m8-13v13M3 13h18',
  refinery: 'M6 21V7h5v14M6 7V3h5v4M15 21V11h5v10M15 11V8h5v3M3 21h20',
  factory: 'M3 21V10l6 3V8l6 4V6h6v15zM17 6V2h4v4M6 17h2m3 0h2m3 0h2',
  hangar: 'M2 20V10l10-7 10 7v10zM6 20v-7h12v7M10 8h4M10 16h4',
  turret: 'M7 21l2-8h6l2 8M6 13V8h12v5zM12 8V3h8M4 21h16',
  attack: 'M4 4l16 16M14 20h6v-6M4 10V4h6M18 3l3 3-5 5M3 18l3 3 5-5',
  move: 'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',
  stop: 'M5 5h14v14H5z',
  hold: 'M5 3v18M19 3v18M5 12h14M9 8l-4 4 4 4m6-8 4 4-4 4',
  shield: 'M12 2l9 4v7c-1 5-5 8-9 10-4-2-8-5-9-10V6zM8 12l3 3 6-7',
  heal: 'M12 3v18M3 12h18M5 5h14v14H5z',
  scan: 'M12 12l7-7M12 2a10 10 0 1 0 10 10M12 7a5 5 0 1 0 5 5M12 11v2',
  orbital: 'M12 2v8M7 3l2 7m8-7-2 7M4 17c0-4 16-4 16 0s-16 4-16 0M8 14l4-4 4 4M12 10v7',
  rally: 'M5 22V2M5 3h14l-3 5 3 5H5',
  energy: 'M14 1L4 14h7l-1 9 10-14h-7z',
  crystal: 'M12 2l7 5 3 9-10 6-10-6 3-9zM12 2l-3 13 3 7 3-7zM2 16l7-1m6 0 7 1',
  cancel: 'M5 5l14 14M19 5L5 19',
  repair: 'M14 4l-4 4 2 4 4 2 4-4c2 5-3 9-7 7l-7 6-4-4 7-6C7 8 10 3 14 4z',
  drop: 'M4 10a8 8 0 0 1 16 0H4M4 10l6 8m10-8-6 8M8 18h8v4H8z',
  save: 'M4 3h14l3 3v15H3V3zM7 3v7h10V3M7 21v-7h10v7',
  pause: 'M7 4v16M17 4v16'
} as const satisfies Record<string, string>;

type IconType = keyof typeof ICON_PATHS;
type FactionDefinition = (typeof FACTIONS)[FactionId];

function icon(name: string) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name as IconType] || ICON_PATHS.hero}"/></svg>`;
}
function unitName(type: string, faction: FactionId = FACTION_ID.FIRST) {
  return (
    FACTIONS[faction].units[type as UnitType] ||
    type
  );
}
function buildingName(type: string, faction: FactionId = FACTION_ID.FIRST) {
  return FACTIONS[faction].buildings[type as BuildingType] || type;
}
