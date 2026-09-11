interface UnitDefinitionShape {
  cost: number;
  gas: number;
  hp: number;
  damage: number;
  range: number;
  reload: number;
  speed: number;
  size: number;
  supply: number;
  time: number;
  from: string;
  vision: number;
  desc: string;
  heal?: number;
  splash?: number;
  groundOnly?: boolean;
  minRange?: number;
  flying?: boolean;
}

interface BuildingDefinitionShape {
  cost: number;
  gas: number;
  hp: number;
  size: number;
  time: number;
  desc: string;
  cap?: number;
  requires?: string;
  damage?: number;
  range?: number;
  reload?: number;
  vision?: number;
}

interface AbilityDefinition {
  energy: number;
  cd: number;
}

interface UpgradeDefinition {
  name: string;
  icon: string;
  desc: string;
  max: number;
}

interface BiomeDefinition {
  name: string;
  ground: number;
  rock: number;
  haze: readonly [number, number, number];
  accent: number;
  flora: number;
}

type MeridianSettings = Record<string, number | boolean> & {
  volume: number;
  music: boolean;
  sfx: boolean;
  quality: number;
  healthbars: boolean;
};

interface MeridianProfile {
  version: 1;
  upgrades: Record<string, number>;
  settings: MeridianSettings;
}

interface ProfileStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PersistenceDependencies {
  getStorage(): ProfileStorage;
  clamp(value: number, min: number, max: number): number;
  upgrades: Record<string, { max: number }>;
  warn(...values: unknown[]): void;
}

interface MeridianPersistence {
  readonly available: boolean;
  loadProfile(): MeridianProfile;
  saveProfile(profile: MeridianProfile): boolean;
}

type TeamId = -1 | 0 | 1;
type EntityKind = 'unit' | 'building' | 'resource';
type ResourceType = 'crystal' | 'gas';
type EntityType = UnitType | BuildingType | ResourceType;

interface Position {
  x: number;
  z: number;
}

interface Cost {
  cost: number;
  gas: number;
}

interface ExitPath extends Position {
  building: number;
  length: number;
}

interface QueueItem extends Cost {
  type: UnitType;
  progress: number;
  time: number;
}

type UnitOrder =
  | { type: 'idle'; x?: number; z?: number }
  | { type: 'hold' | 'stop'; x?: number; z?: number }
  | ({ type: 'move' | 'attackMove' | 'guard' } & Position)
  | ({ type: 'attack' | 'build' } & Position & { id: number })
  | { type: 'mine' | 'follow' | 'repair'; id: number; x?: number; z?: number };

type CommandOrder = UnitOrder | ({ type: 'smart'; id: number } & Position);

interface EntityBase extends Position {
  id: number;
  kind: EntityKind;
  type: EntityType;
  team: TeamId;
  faction: FactionId;
  hp: number;
  maxHp: number;
  size: number;
  vision: number;
  rot: number;
  progress: number;
  queue: QueueItem[];
  order: UnitOrder;
  path: Position[];
  pi: number;
  walk: number;
  cd: number;
  nextThink: number;
  nextPath: number;
  lastHit: number;
  kills: number;
  carry: number;
  work: number;
  shield: number;
  maxShield: number;
  target?: number | null;
  exit?: ExitPath;
  yieldTo?: Position;
  yieldUntil?: number;
  pathGoal?: Position;
  pathVersion?: number;
  stuck?: number;
  slowed?: number;
  returning?: boolean;
  lastSource?: number;
  shieldFlash?: number;
  paid?: Cost;
  gasId?: number;
  deathAt?: number;
  rally?: Position;
}

interface UnitEntity extends EntityBase {
  kind: 'unit';
  type: UnitType;
}

interface BuildingEntity extends EntityBase {
  kind: 'building';
  type: BuildingType;
}

interface ResourceEntity extends EntityBase {
  kind: 'resource';
  type: ResourceType;
  amount: number;
}

type Entity = UnitEntity | BuildingEntity | ResourceEntity;
type CombatSource = Pick<EntityBase, 'team'> & Partial<EntityBase>;
type EntityForKind<K extends EntityKind> =
  K extends 'unit' ? UnitEntity : K extends 'building' ? BuildingEntity : ResourceEntity;
type EntityTypeForKind<K extends EntityKind> =
  K extends 'unit' ? UnitType : K extends 'building' ? BuildingType : ResourceType;
type SpawnExtra = Partial<Omit<EntityBase, 'id' | 'kind' | 'type' | 'team' | 'faction' | 'x' | 'z'>> & { amount?: number };
type UnitBody = Pick<UnitEntity, 'type' | 'size'> & Partial<UnitEntity>;
type UnitPlacement = UnitBody & Position;

interface BattleOptions {
  faction?: number;
  enemy?: number;
  biome?: string;
  seed?: number;
}

interface RunStats {
  kills: number;
  lost: number;
  trained: number;
  gathered: number;
  built: number;
  damage: number;
}

interface Strike extends Position {
  at: number;
  damage: number;
  radius: number;
  team: TeamId;
  type: 'shell' | 'orbital' | 'flare';
  source?: number;
  done?: boolean;
}

interface TimedArea extends Position {
  r: number;
  until: number;
}

interface Field extends TimedArea {
  type: 'bloom' | 'repair';
}

interface Scan extends TimedArea {}

interface BattleResult {
  win: boolean;
  text: string;
  time: number;
  score: number;
  integrity: number;
}

interface RunTriggers extends Record<string, number | boolean> {
  baseAlert?: number;
  solar?: number;
}

interface RunState {
  seed: number;
  faction: FactionId;
  enemy: FactionId;
  biome: BiomeType;
  meta: Record<string, number>;
  time: number;
  alloy: number;
  gas: number;
  energy: number;
  nextId: number;
  entities: Entity[];
  scans: Scan[];
  strikes: Strike[];
  fields: Field[];
  abilities: Record<AbilityType, number>;
  wave: number;
  nextWave: number;
  enemyBudget: number;
  stats: RunStats;
  triggers: RunTriggers;
  cam: Position & { zoom: number };
  result: BattleResult | null;
  speed: number;
}

type WorldColor = number | number[];

interface WorldPlacement {
  mesh: string;
  position: [number, number, number];
  scale: [number, number, number];
  color: WorldColor;
  rotation: [number, number, number];
  glow: number;
  alpha: number;
  layer: string;
  material: string | undefined;
}

interface WorldRenderData {
  groundColors: number[][];
  placements: WorldPlacement[];
}

interface WorldRock extends Position {
  r: number;
}

type BattlefieldEffect =
  | (EffectBase & { type: 'blast'; size: number })
  | (EffectBase & {
      type: 'particle';
      y: number;
      vx: number;
      vz: number;
      vy: number;
      size: number;
    })
  | (EffectBase & { type: 'smoke'; y: number; vy: number; size: number })
  | (EffectBase & {
      type: 'shell';
      y: number;
      tx: number;
      tz: number;
      startY: number;
    })
  | (EffectBase & {
      type: 'beam';
      y: number;
      tx: number;
      ty: number;
      tz: number;
      width: number;
    })
  | (EffectBase & { type: 'drop' });

interface EffectBase extends Position {
  type: 'blast' | 'particle' | 'smoke' | 'shell' | 'beam' | 'drop';
  life: number;
  maxLife: number;
  color: number;
}

interface FloatingText extends Position {
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface ObjectiveRow {
  text: string;
  current: number;
  max: number;
  sub: string;
  done: boolean;
}

interface RangedStats {
  range: number;
  damage: number;
  reload?: number;
  splash?: number;
  groundOnly?: boolean;
  minRange?: number;
}
