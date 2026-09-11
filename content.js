/* Campaign, balancing, original narrative, iconography and faction nomenclature. */
'use strict';
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
      scout: 'Jackal',
      medic: 'Field medic',
      tank: 'Ironclad',
      artillery: 'Longbow',
      air: 'Kestrel',
      hero: 'Captain Mara Venn'
    },
    buildings: {
      hq: 'Command center',
      barracks: 'Muster station',
      depot: 'Logistics depot',
      refinery: 'Aether refinery',
      factory: 'War foundry',
      hangar: 'Flight deck',
      turret: 'Sentinel turret',
      ward: 'Ward generator'
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
      scout: 'Skitter',
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
      turret: 'Thorn spire',
      ward: 'Ward generator'
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
      scout: 'Wraith',
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
      turret: 'Mourning obelisk',
      ward: 'Ward generator'
    }
  }
];
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
    tier: 0,
    vision: 15,
    desc: 'Harvests alloy automatically and constructs newly placed structures. Right-click crystals to mine, or completed damaged allied structures and damaged allied units to repair.'
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
    tier: 0,
    vision: 17,
    desc: 'Versatile ranged infantry. Attacks ground and air. Excellent in groups; vulnerable to artillery.'
  },
  scout: {
    cost: 115,
    gas: 20,
    hp: 190,
    damage: 10,
    range: 8,
    reload: 0.54,
    speed: 7.2,
    size: 0.95,
    supply: 2,
    time: 15,
    from: 'barracks',
    tier: 1,
    vision: 24,
    desc: 'Fast reconnaissance vehicle with long sight range. Ideal for scouting, intercepting reinforcements and collecting memory caches.'
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
    tier: 1,
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
    tier: 2,
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
    tier: 2,
    vision: 18,
    splash: 4.5,
    minRange: 5,
    groundOnly: true,
    desc: 'Long-range siege weapon. Shells have travel time and a large blast radius. Minimum range 5. Needs scouts and protection.'
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
    tier: 3,
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
    tier: 0,
    vision: 22,
    desc: 'Your veteran field commander. A powerful ranged fighter. Keep the captain alive for a commendation; reconstruct at command if lost.'
  },
  convoy: {
    cost: 0,
    gas: 0,
    hp: 2100,
    damage: 0,
    range: 0,
    reload: 1,
    speed: 1.15,
    size: 1.7,
    supply: 0,
    time: 0,
    tier: 0,
    vision: 19,
    desc: 'Civilian crawler. Moves automatically while friendly combat units escort it within 13 meters. Stops for nearby enemies. Workers can repair it.'
  },
  avatar: {
    cost: 0,
    gas: 0,
    hp: 8500,
    damage: 95,
    range: 19,
    reload: 2.1,
    speed: 1.5,
    size: 3.1,
    supply: 0,
    time: 0,
    tier: 0,
    vision: 24,
    splash: 4.4,
    desc: 'The voice inside the star. Its shield must be disabled before its vessel can be destroyed.'
  }
};
const BUILDINGS = {
  hq: {
    cost: 400,
    gas: 0,
    hp: 2600,
    size: 4.4,
    time: 45,
    cap: 24,
    tier: 0,
    desc: 'Your command nexus. Trains workers and reconstructs the commander. Workers deliver alloy here. Provides emergency alloy and aether income.'
  },
  barracks: {
    cost: 145,
    gas: 0,
    hp: 1150,
    size: 3,
    time: 22,
    tier: 0,
    desc: 'Recruits infantry, scouts and medics. Build multiple stations to produce units in parallel.'
  },
  depot: {
    cost: 85,
    gas: 0,
    hp: 750,
    size: 2.3,
    time: 16,
    cap: 16,
    tier: 0,
    desc: 'Adds 16 supply. Queued recruits reserve supply immediately. Maximum force capacity is 180.'
  },
  refinery: {
    cost: 100,
    gas: 0,
    hp: 850,
    size: 2.3,
    time: 20,
    tier: 0,
    desc: 'Place within 8 meters of an aether vent. Generates 1.7 aether per second; no worker is needed after construction.'
  },
  factory: {
    cost: 225,
    gas: 85,
    hp: 1450,
    size: 3.8,
    time: 32,
    tier: 2,
    requires: 'barracks',
    desc: 'Produces heavy armor and siege artillery. Requires a completed muster station.'
  },
  hangar: {
    cost: 220,
    gas: 115,
    hp: 1250,
    size: 3.8,
    time: 32,
    tier: 3,
    requires: 'factory',
    desc: 'Produces strike aircraft. Requires a completed war foundry.'
  },
  turret: {
    cost: 115,
    gas: 25,
    hp: 800,
    size: 1.7,
    time: 19,
    tier: 0,
    damage: 28,
    range: 15,
    reload: 1.05,
    vision: 20,
    desc: 'Automated ground and air defense. Protects workers and choke points, but can be outranged by artillery.'
  },
  // Siege shield objectives retain their own footprint and hull, but cannot be built.
  ward: {
    hp: 1050,
    size: 2.9,
    missionOnly: true,
    desc: 'Maintains the ward citadel’s shield. Destroy all generators to expose the citadel.'
  }
};
const META = {
  veterans: {
    name: 'Veteran detachments',
    icon: 'rifle',
    desc: 'Start each campaign mission with one additional Vanguard per level.',
    max: 3,
    cost: 2
  },
  stores: {
    name: 'Emergency reserves',
    icon: 'crystal',
    desc: 'Start each campaign mission with 100 additional alloy per level.',
    max: 3,
    cost: 2
  },
  logistics: {
    name: 'Civilian engineers',
    icon: 'worker',
    desc: 'Start each campaign mission with one additional Prospector per level.',
    max: 3,
    cost: 2
  },
  command: {
    name: 'Command uplink',
    icon: 'energy',
    desc: 'Command energy regenerates 15% faster per level.',
    max: 3,
    cost: 3
  },
  resolve: {
    name: 'Venn’s resolve',
    icon: 'hero',
    desc: 'Mara starts with 150 additional maximum hull per level.',
    max: 3,
    cost: 2
  },
  industry: {
    name: 'Frontier assembly',
    icon: 'factory',
    desc: 'Construction and recruitment are 10% faster per level.',
    max: 3,
    cost: 3
  }
};
const BIOMES = {
  ash: {
    name: 'ASH WASTES',
    ground: 0x3a4144,
    rock: 0x495158,
    haze: [0.064, 0.095, 0.126],
    accent: 0xe3a46d,
    flora: 0x625647
  },
  rust: {
    name: 'RUST FRONTIER',
    ground: 0x59443a,
    rock: 0x74544a,
    haze: [0.11, 0.085, 0.1],
    accent: 0xf0b67b,
    flora: 0x806348
  },
  choir: {
    name: 'LIVING GARDENS',
    ground: 0x314747,
    rock: 0x49656a,
    haze: [0.052, 0.113, 0.127],
    accent: 0x8bebc2,
    flora: 0x538a77
  },
  court: {
    name: 'SILENT NECROPOLIS',
    ground: 0x424459,
    rock: 0x626679,
    haze: [0.075, 0.082, 0.145],
    accent: 0xc8b2f4,
    flora: 0x838094
  },
  star: {
    name: 'STELLAR INTERIOR',
    ground: 0x3d3c48,
    rock: 0x5a5261,
    haze: [0.1, 0.065, 0.125],
    accent: 0xe7be88,
    flora: 0x715b72
  }
};
const CAMPAIGN = [
  {
    name: 'Dust and Debts',
    act: 0,
    sector: 'KHEPRI / SALVAGE FIELD 09',
    biome: 'rust',
    enemy: 0,
    type: 'tutorial',
    tier: 1,
    seed: 1409,
    minutes: '6–10',
    bases: 1,
    waveInterval: 145,
    startAlloy: 470,
    startGas: 80,
    goal: 'Harvest 300 alloy, recruit 6 combat units, and destroy the raider command post.',
    brief:
      'The sun has gone dark, but Khepri’s debt collectors still want their money. Mara Venn returns to a mining colony under occupation. Reclaim the landing field, give its workers a reason to stay, and silence the raider transmitter before anyone notices your ship.',
    radio: [
      'Mara Venn|All right. We need alloy, a working muster station, and people willing to stand next to us. In that order.',
      'Chief Rook|Prospectors are already on the crystals. Build a logistics depot before our bunks fill up.',
      'Mara Venn|That transmitter is calling for reinforcements. Gather the squad. We’re going to answer in person.'
    ],
    outro:
      'The workers paint over the old company seal. Beneath it, someone has scratched a name: ELIAS VENN. Mara says nothing.'
  },
  {
    name: 'The Passenger List',
    act: 0,
    sector: 'KHEPRI / PORT LASTLIGHT',
    biome: 'ash',
    enemy: 0,
    type: 'defend',
    tier: 1,
    seed: 7012,
    minutes: '6–9',
    duration: 360,
    bases: 2,
    waveInterval: 70,
    startAlloy: 650,
    startGas: 150,
    goal: 'Keep your command center standing for six minutes while four evacuation lifts depart.',
    brief:
      'The port has room for three hundred passengers. There are nine hundred at the gate. Hold the perimeter while Rook strips weapons and cargo out of every shuttle. The occupying garrison has orders to destroy the ships before they leave.',
    radio: [
      'Chief Rook|The manifests say three hundred. I tore them up. Just keep the guns off the landing pads.',
      'Mara Venn|Turrets on the approaches. Medics behind the line. Nobody gets left because we ran out of ammunition.',
      'Civilian channel|Captain? We can see the ships. We’re still here.'
    ],
    outro:
      'Four overloaded shuttles clear the atmosphere. For the first time in years, Mara does not ask how many seats were empty.'
  },
  {
    name: 'A Garden of Voices',
    act: 0,
    sector: 'NACRE / THE FLOURISH',
    biome: 'choir',
    enemy: 1,
    type: 'capture',
    tier: 1,
    seed: 9017,
    minutes: '8–14',
    count: 3,
    bases: 2,
    waveInterval: 85,
    startAlloy: 650,
    startGas: 160,
    goal: 'Capture all three memory relays. Combat units must remain nearby to attune each relay.',
    brief:
      'Nacre’s cities are gone. In their place, immense gardens repeat the last conversations of their inhabitants. Three living relays hold a fragment of the stellar signal. The Choir calls your landing a reunion. Your soldiers call it an ambush.',
    radio: [
      'The First Voice|You have carried your loneliness so far. Put it down. Let us remember you.',
      'Mara Venn|Stay close to the relays until the uplink settles. If it starts saying your name, turn the volume down.',
      'Chief Rook|That signal has a human checksum. Somebody is speaking through the garden.'
    ],
    outro:
      'A child’s voice emerges from the combined signal. “Mara? You said you’d come back.” The recording is timestamped tomorrow.'
  },
  {
    name: 'The Long Road',
    act: 0,
    sector: 'NACRE / PILGRIM CAUSEWAY',
    biome: 'choir',
    enemy: 1,
    type: 'escort',
    tier: 2,
    seed: 1905,
    minutes: '8–15',
    count: 1,
    bases: 2,
    waveInterval: 85,
    startAlloy: 720,
    startGas: 200,
    goal: 'Escort the civilian crawler to the northern extraction point. Keep combat units close to make it move.',
    brief:
      'The survivors refuse the Choir’s invitation. Their crawler is old, overloaded, and too heavy for your dropship. The only working launch platform is across the valley. Walk them there. Workers can repair the crawler; the people inside cannot replace it.',
    radio: [
      'Crawler driver|She’ll move if your people stay alongside. She won’t move through gunfire. Neither will I.',
      'Chief Rook|The Choir is coming through the old irrigation channels. Keep a scout ahead and a medic with the convoy.',
      'Mara Venn|I remember this part. The long road. The promise that there’s a ship at the end. This time there is.'
    ],
    outro:
      'At the platform, a little girl hands Mara a flower. It says thank you in the voice of a man who died a century ago.'
  },
  {
    name: 'No Flags Left',
    act: 1,
    sector: 'BELLWETHER / IRON BASIN',
    biome: 'rust',
    enemy: 0,
    type: 'conquest',
    tier: 2,
    seed: 2219,
    minutes: '10–18',
    bases: 3,
    waveInterval: 80,
    startAlloy: 800,
    startGas: 240,
    goal: 'Destroy all three Free Marches command centers. Eliminate production to weaken reinforcements.',
    brief:
      'Marshal Vale claims the refugee flotilla as property of the Free Marches. His blockade is crewed by the same rebels Mara once fought beside. Three command posts control the basin’s guns. The revolution has become another checkpoint.',
    radio: [
      'Marshal Vale|There are no civilians on a warship, Captain. There are assets. Return mine.',
      'Mara Venn|Take down their command posts. Leave the shelters alone. We’re not here to inherit his empire.',
      'Chief Rook|Their foundries are exposed. Longbows can take the turrets apart before the infantry moves in.'
    ],
    outro:
      'Vale’s last transmission is an accusation, not a surrender. The flotilla listens to it once, then changes frequency.'
  },
  {
    name: 'Borrowed Dead',
    act: 1,
    sector: 'VESPER / THE MEMORY MARSH',
    biome: 'choir',
    enemy: 1,
    type: 'salvage',
    tier: 2,
    seed: 6633,
    minutes: '8–14',
    count: 5,
    bases: 2,
    waveInterval: 80,
    startAlloy: 720,
    startGas: 210,
    goal: 'Recover five memory caches by keeping combat units nearby. Each cache releases resources and defenders.',
    brief:
      'Five emergency recorders are entangled in the Choir’s root network. Together they describe the night Meridian’s sun was built. The Choir is willing to lend you its dead. It has not explained what it expects you to lend in return.',
    radio: [
      'The First Voice|Take these memories gently. They still believe they are alive.',
      'Chief Rook|We’ll need a few seconds alongside each cache. Watch the roots when the transfer finishes.',
      'Elias Venn|I can hear you arguing. Please stop. It hears you too.'
    ],
    outro:
      'The recorders show a star being assembled around something much older. Every engineer in the final frame is wearing a porcelain mask.'
  },
  {
    name: 'Porcelain Mercy',
    act: 1,
    sector: 'LACUNA / MOURNING GATE',
    biome: 'court',
    enemy: 2,
    type: 'siege',
    tier: 3,
    seed: 1144,
    minutes: '10–18',
    count: 3,
    bases: 2,
    waveInterval: 90,
    startAlloy: 800,
    startGas: 300,
    goal: 'Destroy three ward pylons, then bring down the shielded Court citadel.',
    brief:
      'The Veiled Court arrives above Lacuna without a greeting. Its soldiers conduct funerals for the colony before opening fire. Their citadel is protected by three ancient ward pylons. Silence the pylons. Make the Court explain itself.',
    radio: [
      'The Veiled Regent|We grieve for every life we take. We will grieve for yours.',
      'Chief Rook|Those pylons feed the citadel’s shield. Hitting the throne first is just an expensive light show.',
      'Mara Venn|You’re frightened. Good. Tell me what frightened people build a sun to hide.'
    ],
    outro:
      'The captured regent removes its mask. There is another mask underneath. “Not to hide,” it says. “To keep asleep.”'
  },
  {
    name: 'The Flood',
    act: 1,
    sector: 'LACUNA / LOWLAND REDOUBT',
    biome: 'choir',
    enemy: 1,
    type: 'survival',
    tier: 3,
    seed: 4442,
    minutes: '10–13',
    duration: 600,
    bases: 2,
    waveInterval: 63,
    startAlloy: 1000,
    startGas: 400,
    goal: 'Survive ten minutes of escalating Choir assaults. Protect your command and maintain production.',
    brief:
      'The signal has changed. Across Lacuna, the gardens begin marching toward the excavation site. Mara’s ship needs ten minutes to lift the buried regent’s archive. Every road into the lowlands is turning green.',
    radio: [
      'Chief Rook|Ten minutes. That’s the winch, not a guess. Dig in.',
      'The First Voice|Something is dreaming with our voices. We are trying to stop it. We are so many. It is more.',
      'Mara Venn|Rotate the wounded. Keep the foundries hot. We’re leaving together.'
    ],
    outro:
      'The archive reaches orbit seconds before the redoubt disappears beneath flowering roots. A single Court soldier stays behind to finish a funeral.'
  },
  {
    name: 'A Name for Every Star',
    act: 2,
    sector: 'OSSUARY / CELESTIAL ARRAY',
    biome: 'court',
    enemy: 2,
    type: 'domination',
    tier: 3,
    seed: 8141,
    minutes: '10–18',
    count: 3,
    hold: 100,
    bases: 3,
    waveInterval: 76,
    startAlloy: 950,
    startGas: 350,
    goal: 'Control all three star relays simultaneously for 100 seconds. Enemy troops can recapture them.',
    brief:
      'The Court’s navigation array contains a route through the dark sun’s corona. All three relays must point inward at the same time. Their custodians have spent millennia making certain that never happens.',
    radio: [
      'Chief Rook|Three relays, one hundred seconds. They can take them back. Don’t stack the whole army on one point.',
      'The Veiled Regent|Every star in this archive is a grave marker. Yours is the last one we wrote.',
      'Mara Venn|Then you’ll need a new name for it.'
    ],
    outro:
      'The array draws a corridor into the star. At its far end is an image of Mara’s childhood home, with a light burning in the kitchen.'
  },
  {
    name: 'The Broken Procession',
    act: 2,
    sector: 'OSSUARY / THE PALE MILE',
    biome: 'court',
    enemy: 2,
    type: 'escort',
    tier: 3,
    seed: 9897,
    minutes: '10–18',
    count: 2,
    bases: 3,
    waveInterval: 82,
    startAlloy: 1050,
    startGas: 400,
    goal: 'Bring both archive crawlers to extraction. Each requires its own nearby combat escort.',
    brief:
      'A faction of Court custodians has defected. They will guide the flotilla through the corona, but refuse to leave the names of their extinct nations behind. Two archive crawlers take separate roads through the necropolis. Losing either means losing a civilization’s last memory.',
    radio: [
      'Defecting custodian|These vehicles do not carry our dead. They carry the proof that we once lived.',
      'Chief Rook|Two routes. Two escorts. We can move them one at a time, but the patrols won’t wait.',
      'Mara Venn|I’ve flown ships full of photographs before. Keep them moving.'
    ],
    outro:
      'At extraction, a custodian gives Mara a list of names to read aloud. It takes the entire journey to the next world.'
  },
  {
    name: 'Silence Protocol',
    act: 2,
    sector: 'MERIDIAN / OUTER WARD',
    biome: 'ash',
    enemy: 2,
    type: 'siege',
    tier: 3,
    seed: 11007,
    minutes: '12–20',
    count: 4,
    bases: 3,
    waveInterval: 80,
    startAlloy: 1100,
    startGas: 450,
    goal: 'Destroy four silence generators, then eliminate the fortified ward command.',
    brief:
      'The outer ward is broadcasting a weaponized silence. Every ship that crosses it loses contact with its crew, then turns its guns on the others. Four generators maintain the field. Court artillery controls the approaches. Break the network without letting it break the flotilla.',
    radio: [
      'Chief Rook|The silence field is holding their command shield. Four generators. Four very bad neighborhoods.',
      'Elias Venn|It can’t see you when you’re quiet. Mara, you were never good at being quiet.',
      'Mara Venn|Kestrels around the flank. Longbows behind the armor. Let’s make some noise.'
    ],
    outro:
      'The field collapses. Thousands of interrupted conversations resume at once. One voice says, “I knew you’d come back. Please don’t bring them with you.”'
  },
  {
    name: 'Warm Bodies',
    act: 2,
    sector: 'CINDER / REFUGEE QUARTER',
    biome: 'rust',
    enemy: 0,
    type: 'rescue',
    tier: 3,
    seed: 24080,
    minutes: '8–15',
    count: 4,
    duration: 480,
    bases: 2,
    waveInterval: 69,
    startAlloy: 1000,
    startGas: 360,
    goal: 'Reach all four civilian shelters and keep your command center alive until the eight-minute evacuation window.',
    brief:
      'Vale’s remaining loyalists have found the flotilla’s staging world. Their orders call the refugees a supply problem. Rescue the four isolated shelter groups, then hold until the orbital corridor opens. The final approach to the star can wait. These people cannot.',
    radio: [
      'Civilian channel|There are children here. We put it on the roof so the pilots could see.',
      'Mara Venn|We get all four shelters. No arithmetic. Not today.',
      'Chief Rook|Eight minutes until the corridor clears. Shelter volunteers are joining our squads.'
    ],
    outro:
      'The last shelter empties. Mara checks every compartment herself. When the ship leaves, the lights stay on in the empty buildings.'
  },
  {
    name: 'A World That Chose',
    act: 3,
    sector: 'VESPER / THE FIRST GARDEN',
    biome: 'choir',
    enemy: 2,
    type: 'allydefense',
    tier: 3,
    seed: 38744,
    minutes: '9–14',
    duration: 540,
    bases: 3,
    waveInterval: 68,
    startAlloy: 1100,
    startGas: 450,
    goal: 'Defend the allied Memory Heart for nine minutes. It must survive alongside your command center.',
    brief:
      'Vesper’s people chose to join the Choir. They know what it means. They still choose it. The Court calls their world contaminated and begins its cleansing procession. For the first time, Mara’s army stands between the gardens and the fire.',
    radio: [
      'The First Voice|We do not ask you to understand. We ask you to let us remain.',
      'Mara Venn|The heart is in the center. Fortify it. The people inside it are our allies.',
      'Chief Rook|The Choir is sending us defenders. Their medics will keep fighting as long as that heart beats.'
    ],
    outro:
      'The Memory Heart opens a path through its oldest roots. The Choir gives Mara a memory that belongs to the star itself: it is afraid of being alone.'
  },
  {
    name: 'The Sun’s Builders',
    act: 3,
    sector: 'MERIDIAN / CORONAL FORGE',
    biome: 'star',
    enemy: 2,
    type: 'conquest',
    tier: 3,
    seed: 43015,
    minutes: '14–24',
    bases: 3,
    waveInterval: 72,
    startAlloy: 1250,
    startGas: 500,
    goal: 'Destroy all three coronal command centers and secure the passage into the dark star.',
    brief:
      'Inside the corona, impossible continents circle a black horizon. This is where the Court assembled Meridian’s sun, one colossal piece at a time. The last loyalist fleet has entrenched around the three forge commands. Beyond them is the source of every voice.',
    radio: [
      'The Veiled Regent|We could not kill it. We built it a sky. We gave it a sunrise every day for a hundred thousand years.',
      'Chief Rook|Three commands, overlapping artillery, and no safe orbit. This is the whole war in one valley.',
      'Mara Venn|Then we finish the war here.'
    ],
    outro:
      'The last forge shuts down. Gravity turns toward the impossible horizon. On every channel, the star begins to count the passengers aboard Mara’s ship.'
  },
  {
    name: 'The Last Transmission',
    act: 3,
    sector: 'MERIDIAN / THE HOUSE OF ECHOES',
    biome: 'star',
    enemy: 1,
    type: 'signal',
    tier: 3,
    seed: 74408,
    minutes: '12–20',
    count: 4,
    bases: 3,
    hold: 75,
    waveInterval: 75,
    startAlloy: 1150,
    startGas: 470,
    goal: 'Collect four memory fragments, then control all three signal relays for 75 seconds.',
    brief:
      'The surface inside the star is made from places its prisoners remember. Mara recognizes the streets. Elias has hidden four fragments of himself across the valley. Recover them, then hold the signal array long enough to distinguish your brother from the thing speaking in his voice.',
    radio: [
      'Elias Venn|I left pieces where you’d find them. I don’t remember which parts are mine anymore.',
      'Chief Rook|Get the fragments first. Then all three relays. The signal has to stay stable.',
      'Mara Venn|You don’t have to remember everything. Just tell me what I promised.'
    ],
    outro:
      '“That you’d come back,” Elias says. “Not that you’d save me.” The star falls silent. For the first time, Mara hears her brother breathing.'
  },
  {
    name: 'Don’t Bring Them',
    act: 3,
    sector: 'MERIDIAN / THE BLACK SUN',
    biome: 'star',
    enemy: 2,
    type: 'finale',
    tier: 3,
    seed: 90001,
    minutes: '14–25',
    count: 3,
    bases: 3,
    limit: 1200,
    waveInterval: 73,
    startAlloy: 1400,
    startGas: 600,
    goal: 'Capture three anchors to collapse the avatar’s shield. Destroy the avatar before the twenty-minute stellar rupture.',
    brief:
      'The star is opening. It has borrowed the Choir’s hunger, the Court’s fear, and every promise Mara ever broke. Three anchors bind its avatar to this world. Seize them. Silence the vessel. Then decide what becomes of the voice inside it.',
    radio: [
      'The Black Sun|You brought them. All those lonely little lights. I can keep them. I can keep everyone.',
      'Chief Rook|Twenty minutes to rupture. Three anchors hold the shield. Captain, the whole flotilla is listening.',
      'Mara Venn|Elias. Whatever happens next, this time you get to choose too.'
    ],
    outro:
      'The avatar falls. The darkness behind it is not empty. Mara stands before the last door with her brother’s voice on the other side.'
  }
];
const ACTS = [
  'I · THE ABANDONED WORLDS',
  'II · THE SHAPE OF MERCY',
  'III · A CORRIDOR INTO NIGHT',
  'IV · WHAT WE BRING HOME'
];
const ICON_PATHS = {
  worker: 'M8 15l-4 5m8-10 8-6 2 2-6 8M5 8l3-3 11 11-3 3z',
  rifle: 'M5 20l3-6 6-1 5-8 2 1-4 10-6 1-3 4M4 9l5-5 5 2-5 5z',
  scout: 'M4 16l3-8h10l4 8zM6 18h3m7 0h3M8 8l3-4h4l2 4M4 12h17',
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
  ward: 'M12 2l9 4v7c-1 5-5 8-9 10-4-2-8-5-9-10V6zM8 12l3 3 6-7',
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
  convoy: 'M3 8h14v11H3zM17 12h4v7h-4M6 19v3m12-3v3M6 11h7M6 15h7',
  avatar: 'M12 2l10 10-10 10L2 12zM12 6l6 6-6 6-6-6zM12 9v6m-3-3h6',
  cancel: 'M5 5l14 14M19 5L5 19',
  repair: 'M14 4l-4 4 2 4 4 2 4-4c2 5-3 9-7 7l-7 6-4-4 7-6C7 8 10 3 14 4z',
  drop: 'M4 10a8 8 0 0 1 16 0H4M4 10l6 8m10-8-6 8M8 18h8v4H8z',
  save: 'M4 3h14l3 3v15H3V3zM7 3v7h10V3M7 21v-7h10v7',
  pause: 'M7 4v16M17 4v16'
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name] || ICON_PATHS.hero}"/></svg>`;
}
function unitName(type, faction = 0) {
  return (
    FACTIONS[faction].units[type] ||
    { convoy: 'Civilian crawler', avatar: 'The Starbound Avatar' }[type] ||
    type
  );
}
function buildingName(type, faction = 0) {
  return FACTIONS[faction].buildings[type] || type;
}
