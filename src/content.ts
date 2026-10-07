/* Battle definitions, balancing, iconography and faction nomenclature. */
'use strict';
// Stable numeric IDs; display names below are content, never lookup keys.
const FACTION_ID = Object.freeze({ FIRST: 0, SECOND: 1, THIRD: 2 } as const);
type FactionId = (typeof FACTION_ID)[keyof typeof FACTION_ID];

const FACTIONS = [
  {
    name: 'The Cinder Pact',
    short: 'CINDER PACT',
    sigil: '◈',
    color: 0x78ded3,
    accent: 0xebb979,
    metal: 0x627885,
    dark: 0x273642,
    desc: 'Frontier steel. Stubborn hearts.',
    doctrine: { name: 'Fortified advance', desc: 'Defensive buildup, heavy armor and larger assault groups.' },
    trait: 'Armored vehicles have 15% more hull. Command centers repair nearby allies.',
    ability: 'Orbital barrage',
    units: {
      worker: 'Prospector',
      rifle: 'Oathguard',
      medic: 'Field Medic',
      tank: 'Ironclad',
      artillery: 'Faultbreaker',
      air: 'Kestrel',
      destroyer: 'Breakwater',
      hero: 'Breach Marshal'
    },
    buildings: {
      hq: 'Command center',
      barracks: 'Muster station',
      depot: 'Logistics depot',
      refinery: 'Echo Refinery',
      factory: 'War foundry',
      hangar: 'Flight deck',
      turret: 'Sentinel turret',
      meridianforum: 'Meridian Forum',
      fieldlab: 'Field laboratory',
      researchhub: 'Research hub',
      researchspire: 'Research spire',
      embercottage: 'Ember cottage',
      terracecommons: 'Terrace commons',
      hearthtower: 'Hearth tower'
    }
  },
  {
    name: 'The Manyroot',
    short: 'MANYROOT',
    sigil: '❋',
    color: 0x8bdfad,
    accent: 0xd2abe8,
    metal: 0x526d64,
    dark: 0x263f3a,
    desc: 'Many lives. Shared care.',
    doctrine: { name: 'Regenerating swarm', desc: 'Infantry masses, frequent attacks and economic targets.' },
    trait:
      'Units cost 15% less Cinder, move 10% faster and regenerate outside combat. Lighter hulls.',
    ability: 'Bloom of unmaking',
    units: {
      worker: 'Tender',
      rifle: 'Thornling',
      medic: 'Mender Bloom',
      tank: 'Rootbeast',
      artillery: 'Sporecaller',
      air: 'Mothwing',
      destroyer: 'Crownwing',
      hero: 'Grovekeeper'
    },
    buildings: {
      hq: 'Bloom Queen',
      barracks: 'Bloom nursery',
      depot: 'Living canopy',
      refinery: 'Sap well',
      factory: 'Root hollow',
      hangar: 'Chrysalis',
      turret: 'Thorn spire',
      meridianforum: 'Meridian Forum',
      fieldlab: 'Field laboratory',
      researchhub: 'Research hub',
      researchspire: 'Research spire',
      embercottage: 'Ember cottage',
      terracecommons: 'Terrace commons',
      hearthtower: 'Hearth tower'
    }
  },
  {
    name: 'The Mourning Houses',
    short: 'MOURNING HOUSES',
    sigil: '◇',
    color: 0xcab7f2,
    accent: 0x79d9e3,
    metal: 0xc7c3ba,
    dark: 0x3c3b50,
    desc: 'Beautiful. Ancient. Afraid.',
    doctrine: { name: 'Precision supremacy', desc: 'Early technology, aircraft and high-value targets.' },
    trait: 'Units have regenerative shields and deal 12% more damage. Cinder costs are 12% higher.',
    ability: 'Judgment beam',
    units: {
      worker: 'Custodian',
      rifle: 'Pallbearer',
      medic: 'Absolver',
      tank: 'Sepulcher',
      artillery: 'Elegist',
      air: 'Vigil',
      destroyer: 'Catafalque',
      hero: 'The Unveiled'
    },
    buildings: {
      hq: 'Silent Throne',
      barracks: 'Processional gate',
      depot: 'Votive pillar',
      refinery: 'Echo Prism',
      factory: 'Tomb forge',
      hangar: 'Sky sepulcher',
      turret: 'Mourning obelisk',
      meridianforum: 'Meridian Forum',
      fieldlab: 'Field laboratory',
      researchhub: 'Research hub',
      researchspire: 'Research spire',
      embercottage: 'Ember cottage',
      terracecommons: 'Terrace commons',
      hearthtower: 'Hearth tower'
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
    desc: 'Harvests Cinder automatically. Free workers construct newly placed structures without interrupting builders or repairers. Select a worker, then tap an own foundation to resume building, a damaged allied building/unit to repair, or crystals to mine.'
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
  destroyer: {
    cost: 850,
    gas: 500,
    hp: 1500,
    damage: 145,
    range: 14,
    reload: 2.6,
    speed: 2.8,
    size: 2.7,
    supply: 16,
    time: 70,
    from: 'hangar',
    vision: 29,
    splash: 2.8,
    flying: true,
    desc: 'Rare heavy aerial destroyer. Bombards ground and air with a heavy area-impact battery. Protect it from concentrated anti-air fire.'
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
const isFlyingUnitType = (type: EntityType) =>
  !!(UNITS as Partial<Record<EntityType, UnitDefinitionShape>>)[type]?.flying;
// Shared presentation pose; usable by models without loading a battlefield surface.
function flightLaunchRemaining(e: Position & { exit?: Pick<ExitPath, 'x' | 'z' | 'length'> }): number {
  const value = e.exit && e.exit.length > 0 ? Math.hypot(e.x-e.exit.x,e.z-e.exit.z)/e.exit.length : 0;
  return Math.max(0, Math.min(1, value));
}

const BUILDING_YAW = Math.PI / 15;
const CIVILIZATION_MODEL_SCALE = .85;
// Authored Forum units are larger than the other civilian meshes; retain its proportions.
const FORUM_MODEL_SCALE = .6;
const FORUM_DECK_BASE = 1.3;
const BUILDINGS = {
  hq: {
    cost: 400,
    gas: 0,
    hp: 2600,
    size: 4.4,
    time: 45,
    cap: 24,
    desc: 'Your command nexus. Trains workers and reconstructs the commander. Workers deliver Cinder here; it provides no passive resources.'
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
    desc: 'Place within 6 meters of an explored Echo vent; the foundation snaps to its center. Extracts 1.7 Echo per second from the finite vent stock; no worker is needed after construction.'
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
  },
  fieldlab: {
    cost: 0, gas: 0, hp: 500, size: 3.6, time: 8,
    civilizationDecks: [{x:0,z:0,w:4.4,d:3.3},{x:.55,z:2.17,w:3.2,d:.95}],
    civilizationEntry: {x:.55,z:2.87,length:1.1},
    desc: 'Civilian field laboratory. Grows around a Cinder-supplied Forum. Select an expedition upgrade and invest local Echo to expand it into a research tower.'
  },
  researchhub: {
    cost: 0, gas: 0, hp: 650, size: 4.2, time: 12,
    civilizationDecks: [{x:-.8,z:-1.1,w:4.65,d:2.6,top:1.45},{x:.75,z:1.7,w:5.3,d:2.55},{x:.30,z:3.46,w:3.3,d:.60}],
    civilizationEntry: {x:.30,z:3.86,length:.70},
    civilizationWings: [{x:2.72,z:.63,w:2.92,d:2.66}],
    desc: 'Expanded civilian laboratory. Its chosen expedition effect contributes two ranks to newly started battles.'
  },
  researchspire: {
    cost: 0, gas: 0, hp: 800, size: 3.9, time: 16,
    civilizationDecks: [{x:0,z:-.40,w:4.7,d:3.95},{x:.2,z:2.25,w:4.2,d:1.3}],
    civilizationEntry: {x:.20,z:3.05,length:1.1},
    desc: 'Fully expanded civilian research tower. Its chosen expedition effect contributes three ranks to newly started battles.'
  },
  embercottage: {
    cost: 0, gas: 0, hp: 500, size: 3.6, time: 8,
    civilizationDecks: [{x:0,z:0,w:4.4,d:3.3},{x:.55,z:2.17,w:3.2,d:.95}],
    civilizationEntry: {x:.55,z:2.87,length:1.1},
    desc: 'Civilian hillside cottage. Grows around a Cinder-supplied Forum. Select an expedition upgrade and invest local Echo to expand it into a residential tower.'
  },
  terracecommons: {
    cost: 0, gas: 0, hp: 650, size: 4.2, time: 12,
    civilizationDecks: [{x:-.8,z:-1.1,w:4.65,d:2.6,top:1.1},{x:.75,z:1.7,w:5.3,d:2.55},{x:.30,z:3.46,w:3.3,d:.60}],
    civilizationEntry: {x:.30,z:3.86,length:.70},
    civilizationWings: [{x:2.72,z:.63,w:2.92,d:2.66}],
    desc: 'Expanded civilian residences. Their chosen expedition effect contributes two ranks to newly started battles.'
  },
  hearthtower: {
    cost: 0, gas: 0, hp: 800, size: 3.9, time: 16,
    civilizationDecks: [{x:0,z:-.40,w:4.25,d:3.6},{x:.2,z:2.10,w:4.2,d:1.3}],
    civilizationEntry: {x:.20,z:2.9,length:1.1},
    desc: 'Fully expanded civilian residential tower. Its chosen expedition effect contributes three ranks to newly started battles.'
  },
  meridianforum: {
    cost: 0, gas: 25, hp: 950, size: 10.4, time: 20,
    civilizationDecks: [{x:0,z:0,w:29.12*FORUM_MODEL_SCALE-.76,d:20.12*FORUM_MODEL_SCALE-.76,cut:.65*FORUM_MODEL_SCALE}],
    civilizationEntry: {x:0,z:9.6*FORUM_MODEL_SCALE,top:(2.1-FORUM_DECK_BASE)*FORUM_MODEL_SCALE,
      width:8.2*FORUM_MODEL_SCALE*CIVILIZATION_MODEL_SCALE,length:3.6*FORUM_MODEL_SCALE*CIVILIZATION_MODEL_SCALE},
    civilizationSideEntries: [-1,1].map(s=>({x:s*10*FORUM_MODEL_SCALE,z:9.7*FORUM_MODEL_SCALE,
      top:(1.88-FORUM_DECK_BASE)*FORUM_MODEL_SCALE,width:3.25*FORUM_MODEL_SCALE*CIVILIZATION_MODEL_SCALE,
      length:3.24*FORUM_MODEL_SCALE*CIVILIZATION_MODEL_SCALE})),
    desc: 'Monumental civilian forum with terraced wings, warm windows, cyan-lit entrances and a rooftop spacecraft landing pad. Build after victory, from Stage 1. Costs only Echo; supplies civilian upgrade buildings. Assign prospectors to deliver Cinder: its permanent 2000-Cinder store supports up to 60 automatic civilian buildings. Three parallel streets and a crossing avenue define eight parcels; a clear Forum plaza keeps its entrances reachable. The landing pad is decorative.'
  }
} as const satisfies Record<string, BuildingDefinitionShape>;

type BuildingType = keyof typeof BUILDINGS;
type BuildingDefinition = (typeof BUILDINGS)[BuildingType];

function isCivilizationBuildingType(type: string): boolean {
  return Object.hasOwn(BUILDINGS, type) && !!(BUILDINGS[type as BuildingType] as BuildingDefinitionShape).civilizationDecks;
}
function civilizationBuildingAvailable(type: BuildingType): boolean {
  return !isCivilizationBuildingType(type) || type === 'meridianforum';
}
function buildingVisualYaw(e: { team?: number; visualRotation?: number }): number {
  return BUILDING_YAW + (e.team === 1 ? Math.PI : 0) + (e.visualRotation || 0) * Math.PI / 4;
}
function civilizationFootprint(p: Position, team: number, x: number, z: number, w: number, d: number, cut = 0, visualRotation = 0): Position[] {
  const yaw=buildingVisualYaw({team,visualRotation}),cs=Math.cos(yaw),sn=Math.sin(yaw),
    corners=cut ? [[-w/2+cut,-d/2],[w/2-cut,-d/2],[w/2,-d/2+cut],[w/2,d/2-cut],[w/2-cut,d/2],[-w/2+cut,d/2],[-w/2,d/2-cut],[-w/2,-d/2+cut]]
      : [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
  return corners.map(([dx,dz])=>({x:p.x+(x+dx)*cs+(z+dz)*sn,z:p.z-(x+dx)*sn+(z+dz)*cs}));
}
function civilizationDeckFootprints(p: Position, type: BuildingType, team = 0, visualRotation = 0): { polygon: Position[]; top: number }[] {
  const scale=CIVILIZATION_MODEL_SCALE;
  return (BUILDINGS[type] as BuildingDefinitionShape).civilizationDecks!.map(d=>({
    polygon:civilizationFootprint(p,team,d.x*scale,d.z*scale,(d.w+.76)*scale,(d.d+.76)*scale,(d.cut??.51)*scale,visualRotation),top:(d.top||0)*scale}));
}
function civilizationBuildingEntries(type: BuildingType): readonly CivilizationEntry[] {
  const d=BUILDINGS[type] as BuildingDefinitionShape;
  return [d.civilizationEntry!,...(d.civilizationSideEntries||[])];
}
function civilizationClearanceFootprints(p: Position, type: BuildingType, team = 0, visualRotation = 0): Position[][] {
  const d=BUILDINGS[type] as BuildingDefinitionShape,scale=CIVILIZATION_MODEL_SCALE;
  return [...civilizationDeckFootprints(p,type,team,visualRotation).map(f=>f.polygon),
    ...civilizationBuildingEntries(type).map(entry=>civilizationFootprint(p,team,entry.x*scale,
      entry.z*scale+entry.length/2,entry.width??1.05,entry.length+.02,0,visualRotation)),
    ...(d.civilizationWings||[]).map(w=>civilizationFootprint(p,team,w.x*scale,w.z*scale,w.w*scale,w.d*scale,0,visualRotation))];
}
function civilizationFootprintsOverlap(a: readonly Position[], b: readonly Position[], gap = .25): boolean {
  for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],length=Math.hypot(q.x-p.x,q.z-p.z),nx=(q.z-p.z)/length,nz=(p.x-q.x)/length,
      pa=a.map(v=>v.x*nx+v.z*nz),pb=b.map(v=>v.x*nx+v.z*nz);
    if(Math.max(...pa)+gap<=Math.min(...pb)||Math.max(...pb)+gap<=Math.min(...pa))return false;
  }
  return true;
}
const ABILITIES = {
  orbital: { name: 'Orbital strike', icon: 'orbital', energy: 85, cd: 48,
    desc: 'Calls down a faction-specific orbital strike. Requires a completed vehicle factory and current vision.' },
  repair: { name: 'Repair field', icon: 'heal', energy: 45, cd: 28,
    desc: 'Restores allied hull and shields immediately, then repairs hull over time.' },
  scan: { name: 'Recon scan', icon: 'scan', energy: 25, cd: 17,
    desc: 'Reveals a remote area without creating a reinforcement landing anchor.' },
  drop: { name: 'Reinforcements', icon: 'drop', energy: 95, cd: 75,
    desc: 'Deploys four permanent basic infantry near an allied forward anchor.' },
  disruption: { name: 'Disruption field', icon: 'disruption', energy: 50, cd: 40,
    desc: 'Slows enemy movement in an area; upgraded fields also disrupt weapons.' },
  bulwark: { name: 'Bulwark field', icon: 'shield', energy: 55, cd: 45,
    desc: 'Reduces damage taken by allied units and structures in an area.' },
  surge: { name: 'Command surge', icon: 'surge', energy: 60, cd: 45,
    desc: 'Accelerates the movement and weapons of allied combat units.' },
  recall: { name: 'Emergency recall', icon: 'recall', energy: 50, cd: 60,
    desc: 'Extracts a limited group of allied ground troops to the nearest command center.' }
} as const satisfies Record<string, AbilityDefinition>;

type AbilityType = keyof typeof ABILITIES;
const DEFAULT_ABILITY_LOADOUT: readonly AbilityType[] = Object.freeze(['orbital', 'repair', 'scan', 'drop']);
const FACTION_ABILITY_LOADOUTS: Record<FactionId, readonly AbilityType[]> = Object.freeze({
  0: Object.freeze<AbilityType[]>(['orbital', 'repair', 'bulwark', 'drop']),
  1: Object.freeze<AbilityType[]>(['repair', 'drop', 'disruption', 'surge']),
  2: Object.freeze<AbilityType[]>(['orbital', 'scan', 'disruption', 'recall'])
});
function normalizedAbilityLoadout(input: unknown, fallback: readonly AbilityType[] = DEFAULT_ABILITY_LOADOUT): AbilityType[] {
  if (!Array.isArray(input)) return [...fallback];
  const result = [...new Set(input.filter((key): key is AbilityType =>
    typeof key === 'string' && Object.hasOwn(ABILITIES, key)))];
  return result.length === 4 ? result : [...fallback];
}
function abilityStats(kind: AbilityType, rank = 0): AbilityStats {
  const level = Math.max(0, Math.min(3, Math.floor(Number(rank) || 0))), base = ABILITIES[kind];
  const stats: AbilityStats = { ...base, rank: level };
  if (kind === 'orbital') {
    stats.damageMultiplier = level >= 1 ? 1.12 : 1;
    stats.strikeDelay = level >= 2 ? 1.8 : 2.2;
    if (level >= 3) stats.cd = 40;
  } else if (kind === 'repair') {
    stats.instantHull = level >= 1 ? 230 : 180;
    stats.instantShield = level >= 1 ? 130 : 100;
    stats.healing = level >= 2 ? 15 : 10;
    stats.radius = level >= 3 ? 14 : 12;
    stats.duration = 8;
  } else if (kind === 'scan') {
    stats.duration = level >= 1 ? 28 : 22;
    stats.scanRadius = level >= 2 ? 38 : 32;
    if (level >= 3) stats.energy = 18;
  } else if (kind === 'drop') {
    stats.unitTypes = ['rifle', 'rifle', 'rifle', 'rifle'];
    if (level >= 2) stats.unitTypes.push('medic');
    stats.supply = stats.unitTypes.reduce((sum, type) => sum + UNITS[type].supply, 0);
    stats.landingProtection = level >= 1 ? 12 : 0;
    if (level >= 3) stats.cd = 62;
  } else if (kind === 'disruption') {
    stats.radius = 11;
    stats.duration = level >= 3 ? 13 : 10;
    stats.moveMultiplier = level >= 1 ? .55 : .65;
    stats.reloadMultiplier = level >= 2 ? .8 : 1;
  } else if (kind === 'bulwark') {
    stats.radius = level >= 1 ? 12 : 10;
    stats.duration = level >= 3 ? 13 : 10;
    stats.damageReduction = level >= 2 ? .4 : .3;
  } else if (kind === 'surge') {
    stats.radius = 10;
    stats.duration = level >= 1 ? 13 : 10;
    stats.moveMultiplier = level >= 2 ? 1.3 : 1.2;
    stats.reloadMultiplier = stats.moveMultiplier;
    if (level >= 3) stats.cd = 36;
  } else {
    stats.radius = 9;
    stats.recallSupply = level >= 1 ? 16 : 12;
    stats.recallDelay = level >= 2 ? 2 : 3;
    if (level >= 3) stats.cd = 48;
  }
  return stats;
}

const STARTING_CINDER = 250;
const ECHO_VENT_CAPACITY = 900;
const FACTION_DEPTH_REQUIREMENTS = [0, 10, 25] as const;

const COMMAND_ENERGY = Object.freeze({ start: 25, max: 200, regeneration: .8 });
const ABILITY_RULES = Object.freeze({ orbitalBuilding: 'factory' as const, reinforcementRange: 20 });
const EXPEDITION_EFFECTS = Object.freeze({ alloy: 50, aether: 50, surveyRadius: 22, workshopSpeed: .5, energy: 15 });
const COMMAND_DRILL = Object.freeze({ radius: 11, damagePerStack: .05 });
const FLEET_EFFECTS = Object.freeze({ constructionSpeed: .05, supply: 2, repairDiscount: .05 });

const EXPEDITION_BENEFITS = {
  supplyCrate: {
    name: 'Supply crate',
    icon: 'crystal',
    desc: `Adds ${EXPEDITION_EFFECTS.alloy} Cinder to your reserves at the start of every remaining battle.`
  },
  aetherAllocation: {
    name: 'Echo allocation',
    icon: 'save',
    desc: `Adds ${EXPEDITION_EFFECTS.aether} Echo at the start of every remaining battle.`
  },
  pioneerSquad: {
    name: 'Pioneer squad',
    icon: 'worker',
    desc: 'Deploys one additional worker at the start of every remaining battle.',
    max: 5
  },
  commanderMandate: {
    name: 'Commander mandate',
    icon: 'hero',
    desc: 'Deploys your faction commander at the start of every remaining battle.',
    max: 1
  },
  commandDrill: {
    name: 'Command drill',
    icon: 'rifle',
    desc: `Basic infantry within ${COMMAND_DRILL.radius} meters of their commander deal ${COMMAND_DRILL.damagePerStack * 100}% more damage per stack.`
  },
  surveyDrones: {
    name: 'Survey drones',
    icon: 'scan',
    desc: 'Maps the nearest unexplored resource area at each battle start. Does not reveal enemies.',
    max: 1
  },
  fieldWorkshop: {
    name: 'Field workshop',
    icon: 'repair',
    desc: `Your first placed foundation in each battle builds ${EXPEDITION_EFFECTS.workshopSpeed * 100}% faster. Consumed even if canceled.`,
    max: 1
  },
  commandCapacitor: {
    name: 'Command capacitor',
    icon: 'energy',
    desc: `Adds ${EXPEDITION_EFFECTS.energy} starting command energy per stack. Base starting energy is ${COMMAND_ENERGY.start}.`,
    max: 2
  }
} as const;

type ExpeditionBenefit = keyof typeof EXPEDITION_BENEFITS;

// Stage = completed depth + 1. The opening visits each faction once before FFA expands.
const EXPEDITION_ENEMY_ENTRY_STAGES = [1, 4, 8] as const;
const EXPEDITION_OPENING_ENEMIES = [FACTION_ID.FIRST, FACTION_ID.SECOND, FACTION_ID.THIRD] as const;
function expeditionEnemyCount(depth: number): number {
  return EXPEDITION_ENEMY_ENTRY_STAGES.filter(stage => depth + 1 >= stage).length;
}
function expeditionEnemyFactions(depth: number, random: () => number): FactionId[] {
  if (depth >= 0 && depth < EXPEDITION_OPENING_ENEMIES.length)
    return [EXPEDITION_OPENING_ENEMIES[depth]];
  return Array.from({ length: expeditionEnemyCount(depth) }, () =>
    Math.floor(random() * FACTIONS.length) as FactionId);
}

function normalizedBenefits(input: Record<string, number> = {}): Record<string, number> {
  return Object.fromEntries(contentKeys(EXPEDITION_BENEFITS).map(key =>
    [key, clamp(Math.floor(Number(input?.[key]) || 0), 0, expeditionBenefit(key)!.max ?? 999999)])
    .filter(([, value]) => Number(value) > 0));
}

const CIVILIZATION_FLEET_EFFECTS = {
  startingAlloy: { name: 'Starting Cinder', icon: 'crystal', desc: 'Adds 50 starting Cinder per rank.', max: 999999 },
  startingWorkers: { name: 'Starting workers', icon: 'worker', desc: 'Adds one starting worker per rank, up to five across the expedition.', max: 5 },
  constructionProtocols: { name: 'Construction protocols', icon: 'factory', desc: 'Adds 5% construction speed per rank. Does not speed up repairs.', max: 999999 },
  logisticsFrame: { name: 'Logistics frame', icon: 'depot', desc: 'Adds two supply capacity per rank. The total supply limit remains 180.', max: 999999 },
  repairLogistics: { name: 'Repair logistics', icon: 'repair', desc: 'Reduces worker repair Cinder costs by 5% per rank, up to 75%.', max: 15 }
} as const;
type FleetUpgradeType = keyof typeof CIVILIZATION_FLEET_EFFECTS;
const COMMAND_MODULES = {
  orbital: {
    name: 'Orbital strike', icon: 'orbital', desc: 'Improves orbital payload, targeting time and recharge.',
    display: { label: 'COMMAND RANK', values: [0, 1, 2, 3], unit: 'RANK',
      gains: ['+12% DAMAGE', 'FASTER IMPACT', '40s COOLDOWN'] }, max: 3, costs: [250, 600, 1200]
  },
  repair: {
    name: 'Repair field', icon: 'heal', desc: 'Improves immediate restoration, sustained repair and field radius.',
    display: { label: 'COMMAND RANK', values: [0, 1, 2, 3], unit: 'RANK',
      gains: ['STRONGER BURST', '+5 REPAIR / SECOND', '14m RADIUS'] }, max: 3, costs: [250, 600, 1200]
  },
  scan: {
    name: 'Recon scan', icon: 'scan', desc: 'Extends scan duration and radius before reducing its energy cost.',
    display: { label: 'COMMAND RANK', values: [0, 1, 2, 3], unit: 'RANK',
      gains: ['28s DURATION', '38m RADIUS', '18 ENERGY'] }, max: 3, costs: [250, 600, 1200]
  },
  drop: {
    name: 'Reinforcements', icon: 'drop', desc: 'Protects arrivals, adds a faction medic and improves recharge.',
    display: { label: 'COMMAND RANK', values: [0, 1, 2, 3], unit: 'RANK',
      gains: ['PROTECTED ARRIVAL', '+1 MEDIC', '62s COOLDOWN'] }, max: 3, costs: [250, 600, 1200]
  },
  disruption: {
    name: 'Disruption field', icon: 'disruption', desc: 'Strengthens movement disruption, weapon interference and duration.',
    display: { label: 'COMMAND RANK', values: [0, 1, 2, 3], unit: 'RANK',
      gains: ['45% SLOW', 'WEAPON DISRUPTION', '13s DURATION'] }, max: 3, costs: [250, 600, 1200]
  },
  bulwark: {
    name: 'Bulwark field', icon: 'shield', desc: 'Expands the field, strengthens protection and extends its duration.',
    display: { label: 'COMMAND RANK', values: [0, 1, 2, 3], unit: 'RANK',
      gains: ['12m RADIUS', '40% REDUCTION', '13s DURATION'] }, max: 3, costs: [250, 600, 1200]
  },
  surge: {
    name: 'Command surge', icon: 'surge', desc: 'Extends and strengthens the combat acceleration before improving recharge.',
    display: { label: 'COMMAND RANK', values: [0, 1, 2, 3], unit: 'RANK',
      gains: ['13s DURATION', '30% FASTER', '36s COOLDOWN'] }, max: 3, costs: [250, 600, 1200]
  },
  recall: {
    name: 'Emergency recall', icon: 'recall', desc: 'Extracts more troops, resolves faster and recharges sooner.',
    display: { label: 'COMMAND RANK', values: [0, 1, 2, 3], unit: 'RANK',
      gains: ['16 SUPPLY', '2s EXTRACTION', '48s COOLDOWN'] }, max: 3, costs: [250, 600, 1200]
  }
} as const satisfies Record<AbilityType, UpgradeDefinition>;
const BATTLE_UPGRADES = Object.freeze({ ...CIVILIZATION_FLEET_EFFECTS, ...COMMAND_MODULES });
type UpgradeType = keyof typeof BATTLE_UPGRADES;

// Civilian buildings own a selected effect and a purchased rank; no profile purchases.
const CIVILIZATION_UPGRADE_COSTS = [40, 80, 140] as const;
const CIVILIZATION_UPGRADES = Object.freeze({
  ...CIVILIZATION_FLEET_EFFECTS,
  ...COMMAND_MODULES, ...EXPEDITION_BENEFITS
}) as Readonly<Record<FleetUpgradeType | AbilityType | ExpeditionBenefit,
  { name: string; icon: string; desc: string; max?: number }>>;
type CivilizationUpgradeType = keyof typeof CIVILIZATION_UPGRADES;
function civilizationUpgradeUnique(key: CivilizationUpgradeType): boolean {
  return key === 'commanderMandate' || key === 'surveyDrones' || key === 'fieldWorkshop';
}
function civilizationBuildingTier(type: BuildingType): number {
  return type === 'hearthtower' || type === 'researchspire' ? 3 :
    type === 'terracecommons' || type === 'researchhub' ? 2 : 1;
}
function civilizationBuildingAtTier(type: BuildingType, tier: number): BuildingType {
  const research = type === 'fieldlab' || type === 'researchhub' || type === 'researchspire';
  return (research ? ['fieldlab', 'researchhub', 'researchspire'] :
    ['embercottage', 'terracecommons', 'hearthtower'])[tier - 1] as BuildingType;
}
// Reserve every expansion envelope, including the wider mid-rise wings, from first growth.
function settlementReservedFootprints(p: Position, type: BuildingType, team: PlayerTeam, rotation = 0): Position[][] {
  return [1, 2, 3].flatMap(tier => civilizationClearanceFootprints(p, civilizationBuildingAtTier(type, tier), team, rotation));
}
function settlementReservedRadius(type: BuildingType): number {
  return Math.max(...[1, 2, 3].map(tier => BUILDINGS[civilizationBuildingAtTier(type, tier)].size),
    ...settlementReservedFootprints({x:0,z:0}, type, 0).flat().map(p => Math.hypot(p.x, p.z)));
}
interface CivilizationUpgradeTotals { upgrades: Record<string, number>; benefits: Record<string, number> }
function civilizationUpgradesForBuildings(entities: readonly Entity[], team: PlayerTeam = 0): CivilizationUpgradeTotals {
  const totals: CivilizationUpgradeTotals = { upgrades: {}, benefits: {} },
    forums = new Set(entities.filter(e => e.kind === 'building' && e.type === 'meridianforum' &&
      e.team === team && e.hp > 0 && e.progress >= 1).map(e => e.id));
  for (const b of entities) {
    if (b.kind !== 'building' || b.team !== team || b.hp <= 0 || b.progress < 1 ||
      b.forumId === undefined || !forums.has(b.forumId) || b.settlementAt !== undefined || !b.upgrade || !hasContentKey(CIVILIZATION_UPGRADES, b.upgrade)) continue;
    const target = hasContentKey(EXPEDITION_BENEFITS, b.upgrade) ? totals.benefits : totals.upgrades,
      rank = civilizationUpgradeUnique(b.upgrade) ? 1 : b.upgradeLevel || 1;
    target[b.upgrade] = (target[b.upgrade] || 0) + rank;
  }
  return totals;
}
function expeditionCivilizationUpgrades(expedition: MeridianExpedition, live: RunState | null = null,
  activeStage: number | null = null): CivilizationUpgradeTotals {
  const totals: CivilizationUpgradeTotals = { upgrades: {}, benefits: {} };
  for (const world of expedition.worlds || []) {
    if (world.error || !world.recipe || !world.battle) continue;
    const recipe = world.recipe, active = activeStage === world.stage && live?.rules.kind === 'single-player' && live.rules.completed &&
      live.depth === recipe.depth && live.map === recipe.encounter.map && live.seed === recipe.encounter.seed ? live : null;
    const contribution = civilizationUpgradesForBuildings(active ? active.entities : world.battle.state.entities);
    for (const group of ['upgrades', 'benefits'] as const)
      for (const [key, value] of Object.entries(contribution[group])) totals[group][key] = (totals[group][key] || 0) + value;
  }
  for (const [key, count] of Object.entries(totals.upgrades))
    if (hasContentKey(BATTLE_UPGRADES, key)) totals.upgrades[key] = Math.min(count, BATTLE_UPGRADES[key].max);
  totals.benefits = normalizedBenefits(totals.benefits);
  return totals;
}

const ICON_PATHS = {
  worker: 'M8 15l-4 5m8-10 8-6 2 2-6 8M5 8l3-3 11 11-3 3z',
  rifle: 'M5 20l3-6 6-1 5-8 2 1-4 10-6 1-3 4M4 9l5-5 5 2-5 5z',
  medic: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  tank: 'M3 15h18v5H3zM6 15V9h11v6M12 9V5h9M5 18h14',
  artillery: 'M4 19h16M5 16l3-7h7l4 7M11 9l7-6 3 2-7 7M8 19v2m8-2v2',
  air: 'M12 2l3 9 7 6v2l-9-3-1 6-1-6-9 3v-2l7-6z',
  destroyer: 'M12 2l4 5 6 3v4l-6-1-2 8h-4l-2-8-6 1v-4l6-3z',
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
  aether: 'M12 2l9 5v10l-9 5-9-5V7z',
  crystal: 'M12 2l7 5 3 9-10 6-10-6 3-9zM12 2l-3 13 3 7 3-7zM2 16l7-1m6 0 7 1',
  cancel: 'M5 5l14 14M19 5L5 19',
  repair: 'M14 4l-4 4 2 4 4 2 4-4c2 5-3 9-7 7l-7 6-4-4 7-6C7 8 10 3 14 4z',
  rotateLeft: 'M8 3L4 7l4 4M4 7h9a7 7 0 1 1-7 7',
  rotateRight: 'M16 3l4 4-4 4M20 7h-9a7 7 0 1 0 7 7',
  drop: 'M4 10a8 8 0 0 1 16 0H4M4 10l6 8m10-8-6 8M8 18h8v4H8z',
  disruption: 'M3 12h4l2-6 4 12 2-6h6M4 5l2 2m12-2-2 2M4 19l2-2m12 2-2-2',
  surge: 'M4 13h5l2-9 3 16 2-7h4M3 7h4m10 10h4',
  recall: 'M12 3a9 9 0 1 0 8 5M12 7v5l4 2M20 3v5h-5',
  save: 'M4 3h14l3 3v15H3V3zM7 3v7h10V3M7 21v-7h10v7',
  pause: 'M7 4v16M17 4v16'
} as const satisfies Record<string, string>;

type IconType = keyof typeof ICON_PATHS;
type FactionDefinition = (typeof FACTIONS)[FactionId];

// Mission identity is independent of terrain; selection draws once from eligible pairs.
const DEFAULT_MISSION: MissionId = 'hq-elimination';
const MISSIONS: Readonly<Record<MissionId, MissionDefinition>> = Object.freeze({
  'hq-elimination': Object.freeze({
    name: 'HQ supremacy',
    maps: Object.freeze(['desert', 'alien-planet', 'mothership', 'westmark', 'frontier', 'haven'] as const),
    firstStage: 1,
    objective: 'Free-for-all: be the last party with an HQ. Losing the last HQ eliminates a party and removes its remaining forces. Protect yours.',
    intro: 'Expedition command|Destroy the enemy base to advance.',
    victory: 'You are the last remaining party.',
    defeat: 'Your last command center has fallen.'
  })
});

function contentKeys<T extends object>(catalog: T): Array<Extract<keyof T, string>> {
  return Object.keys(catalog) as Array<Extract<keyof T, string>>;
}
function hasContentKey<T extends object>(catalog: T, key: string | undefined): key is Extract<keyof T, string> {
  return key !== undefined && Object.hasOwn(catalog, key);
}

function expeditionBenefit(key: string): ExpeditionBenefitDefinition | undefined {
  return hasContentKey(EXPEDITION_BENEFITS, key) ? EXPEDITION_BENEFITS[key] : undefined;
}

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
