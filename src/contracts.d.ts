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

interface ExpeditionBenefitDefinition {
  name: string;
  icon: string;
  desc: string;
  max?: number;
}

interface UpgradeDefinition {
  name: string;
  icon: string;
  desc: string;
  display: { label: string; values: readonly number[]; unit: string };
  max: number;
  costs: readonly number[];
}

interface BattlefieldPalette {
  ground: number;
  rock: number;
  accent: number;
  flora: number;
}

interface BattlefieldLayout {
  /** Public corner candidates, independent of team assignment. */
  startSites: [Position, Position, Position, Position];
  /** Terrain-generation anchors; these do not identify the live teams. */
  playerStart: Position;
  enemySites: Position[];
  centralClearings: Position[];
  outerClearings: Position[];
  resourceSites: Position[];
  additionalClearings: Position[];
  corridors: [number, number][][];
}

interface BattlefieldLighting {
  sun: readonly [number, number, number];
  sky: readonly [number, number, number];
  bounce: readonly [number, number, number];
}

interface BattlefieldRenderProfile {
  groundTexture: 'ground' | 'metal' | 'bio';
  skyTexture: 'sky';
  groundPixelsPerMeter: number;
  groundMirror?: boolean;
  rockDecor: { density: number; opacity: number };
  shrubDecor: { density: number; opacity: number };
  haze: readonly [number, number, number];
  lighting?: BattlefieldLighting;
}

interface BattlefieldSize {
  /** Half-width/depth of the square world, in metres. */
  extent: number;
  cellSize: number;
}

interface BattlefieldDefinition {
  name: string;
  size: BattlefieldSize;
  layout: BattlefieldLayout;
  palette: BattlefieldPalette;
  render: BattlefieldRenderProfile;
  worldEvent: 'solarFlare' | null;
  generate: (builder: BattlefieldBuilder) => void;
}
type BattlefieldProp = (builder: BattlefieldBuilder, x: number, z: number) => void;
type BattlefieldPatch = (builder: BattlefieldBuilder, x: number, z: number, radius: number) => void;

type MeridianSettings = Record<string, number | boolean> & {
  volume: number;
  music: boolean;
  sfx: boolean;
  quality: number;
  healthbars: boolean;
};

interface MeridianProfile {
  version: 1;
  expeditionDepth: number;
  aether: number;
  upgrades: Record<string, number>;
  settings: MeridianSettings;
}

interface ExpeditionEncounter {
  enemy: FactionId;
  map: BattlefieldId;
  seed: number;
}

interface MeridianExpedition {
  version: 2;
  faction: FactionId;
  depth: number;
  benefits: Record<string, number>;
  enemyBenefits: Record<string, number>;
  encounter: ExpeditionEncounter;
  offers: string[];
}

interface ProfileStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

interface PersistenceDependencies {
  getStorage(): ProfileStorage;
  clamp(value: number, min: number, max: number): number;
  upgrades: Record<string, { max: number }>;
  benefits: Record<string, { max?: number; name?: string }>;
  battlefields: Record<string, unknown>;
  warn(...values: unknown[]): void;
}

interface GameEventMap {
  start: Record<string, never>;
  toast: string;
  radio: string;
  alert: string | ({ text: string; danger?: boolean } & Partial<Position>);
  order: { type: CommandOrder['type']; count: number } & Partial<Position>;
  result: BattleResult;
  shot: Position & { heavy: boolean };
  explosion: Position & { big: boolean };
  complete: Position & { type: BuildingType };
  trained: UnitEntity;
  queued: UnitType;
  build: BuildingEntity;
  heal: Position;
  scan: Position;
}
type GameEvent = { [K in keyof GameEventMap]: [type: K, data: GameEventMap[K]] }[keyof GameEventMap];
type GameEventSink = (...event: GameEvent) => void;

interface MeridianPersistence {
  readonly available: boolean;
  loadProfile(): MeridianProfile;
  saveProfile(profile: MeridianProfile): boolean;
  loadExpedition(): MeridianExpedition | null;
  saveExpedition(expedition: MeridianExpedition): boolean;
  clearExpedition(): boolean;
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
  label?: string;
}

interface UnitEntity extends EntityBase {
  kind: 'unit';
  type: UnitType;
}

interface BuildingEntity extends EntityBase {
  kind: 'building';
  type: BuildingType;
  buildRate?: number;
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
type SpawnExtra = Partial<Omit<EntityBase, 'id' | 'kind' | 'type' | 'team' | 'faction' | 'x' | 'z'>> & { amount?: number; buildRate?: number };
type UnitBody = Pick<UnitEntity, 'type' | 'size'> & Partial<UnitEntity>;
type UnitPlacement = UnitBody & Position;

interface BattleOptions {
  depth?: number;
  faction?: number;
  enemy?: number;
  map?: string;
  seed?: number;
  benefits?: Record<string, number>;
  enemyBenefits?: Record<string, number>;
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
  team: PlayerTeam;
}

interface Scan extends TimedArea { team?: PlayerTeam; }

interface BattleResult {
  win: boolean;
  text: string;
  time: number;
  score: number;
  integrity: number;
}

interface RunTriggers extends Record<string, number | boolean | undefined> {
  baseAlert?: number;
  solar?: number;
  fieldWorkshop?: boolean;
  enemyFieldWorkshop?: boolean;
}

interface AIContact extends Position {
  id: number; team: TeamId; kind: EntityKind; type: EntityType;
  hp: number; maxHp: number; size: number; progress: number; seenAt: number;
}
interface AIState {
  nextThink: number;
  mode: 'bootstrap' | 'defend' | 'assemble' | 'attack' | 'recover';
  contacts: Record<number, AIContact>;
  squad: number[];
  scout?: number;
  goal?: Position;
  attackStartedAt: number;
  restStartedAt: number;
  launched: number;
  search: number;
  nextBuild: number;
  buildWindowAt: number;
  buildAttempts: Partial<Record<BuildingType, number>>;
  lastScout: number;
  recoverUntil?: number;
  failedGoal?: Position & { until: number };
}
type PlayerTeam = 0 | 1;
interface TeamState {
  alloy: number;
  gas: number;
  energy: number;
  abilities: Record<AbilityType, number>;
}

interface RunState {
  depth: number;
  seed: number;
  faction: FactionId;
  enemy: FactionId;
  map: BattlefieldId;
  meta: Record<string, number>;
  benefits: Record<string, number>;
  enemyBenefits: Record<string, number>;
  time: number;
  teams: [TeamState, TeamState];
  nextId: number;
  entities: Entity[];
  scans: Scan[];
  strikes: Strike[];
  fields: Field[];
  ai: Partial<Record<PlayerTeam, AIState>>;
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
  layer: 'static' | 'dynamic' | 'effects';
  material: keyof typeof MAT | undefined;
}

interface WorldTerrainFeature extends Position {
  seed: number;
  yaw: number;
  width: number;
  depth: number;
  height: number;
  outline: Position[];
}

type WorldGeometry =
  | { mesh: string; model: string; seed: number; extent: number }
  | { mesh: string; model: string; feature: WorldTerrainFeature };

interface WorldRenderData {
  features: WorldTerrainFeature[];
  groundColors: number[][];
  placements: WorldPlacement[];
  geometries: WorldGeometry[];
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
  | (EffectBase & { type: 'drop'; team?: PlayerTeam });

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

interface RangedStats {
  range: number;
  damage: number;
  reload?: number;
  splash?: number;
  groundOnly?: boolean;
  minRange?: number;
}
