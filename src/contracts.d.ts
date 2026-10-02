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
  name: string;
  icon: string;
  desc: string;
  energy: number;
  cd: number;
}

interface AbilityStats extends AbilityDefinition {
  rank: number;
  radius?: number;
  duration?: number;
  damageMultiplier?: number;
  strikeDelay?: number;
  instantHull?: number;
  instantShield?: number;
  healing?: number;
  scanRadius?: number;
  unitTypes?: UnitType[];
  supply?: number;
  landingProtection?: number;
  moveMultiplier?: number;
  reloadMultiplier?: number;
  damageReduction?: number;
  recallSupply?: number;
  recallDelay?: number;
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
  display: { label: string; values: readonly number[]; unit: string; gains: readonly string[] };
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
  /** Public terrain-derived worker candidates, independent of team assignment. */
  startSites: Position[];
  /** Economy regions are generated before deployment; none identify live parties. */
  resourceSites: Position[];
  corridors: [number, number][][];
}

interface BattlefieldLighting {
  sun: readonly [number, number, number];
  sky: readonly [number, number, number];
  bounce: readonly [number, number, number];
}

interface BattlefieldAtmosphere {
  timeOfDay: number;
  horizon: readonly [number, number, number];
  zenith: readonly [number, number, number];
}

/** Content design, independent of encounter RNG and team assignment. */
interface BattlefieldDesign {
  /** Omit for a fresh landscape per encounter. Pin to retain a named landscape. */
  terrainSeed?: number;
  atmosphere?: { timeOfDay: number | 'seeded'; materialSeed?: number };
}

type EcologyBiome = 'verdant' | 'ochre' | 'rime' | 'mycelium';
type EcologyWeather = 'clear' | 'mist' | 'rain' | 'snow' | 'ash';
type EcologyFlora = 'Grove' | 'Acacia' | 'Conifer' | 'Fungus' | 'Coral' | 'Fan' | 'Spire' | 'Pod' | 'Arch' | 'Reed' | 'Shelf' | 'Cactus' | 'Palm';
type WorldVariationFamily = 'alien' | 'desert' | 'ship' | 'alpine' | 'frontier' | 'haven';
type WorldReliefForm = 'rolling' | 'dunes' | 'basin' | 'folds' | 'craters' | 'terraces' | 'deck' | 'ridges' | 'broken-crater';
interface WorldVariation {
  readonly id: string;
  readonly name: string;
  readonly family: WorldVariationFamily;
  readonly relief: WorldReliefForm;
  readonly amplitude: number;
  readonly heightScale: number;
  readonly flora: EcologyFlora;
  readonly landmark: 'Relic' | 'Spire' | 'Radar' | 'Wreck' | 'Pylon';
}
interface BattlefieldEcology {
  biome: EcologyBiome;
  weather: EcologyWeather;
  phase: number;
  cover: number;
  wind: number;
  dry: readonly [number, number, number];
  lush: readonly [number, number, number];
  soil: readonly [number, number, number];
  stone: readonly [number, number, number];
  leaf: number;
  bloom: number;
  /** Artificial decks receive weather/material aging, not meadow habitat shading. */
  natural?: boolean;
  flora?: EcologyFlora;
}

interface BattlefieldRenderProfile {
  variationFamily?: WorldVariationFamily;
  variation?: WorldVariation;
  /** Opt-in seeded habitat/weather; resolved once into ecology for CPU/view sharing. */
  wilderness?: EcologyBiome | 'seeded';
  ecology?: BattlefieldEcology;
  atmosphere?: BattlefieldAtmosphere;
  scenery?: string;
  groundTexture: 'ground' | 'metal' | 'bio' | 'westmarkMeadow';
  skyTexture: 'sky';
  /** Optional artistic override; otherwise use the material recipe's physical tile size. */
  groundMetersPerTile?: readonly [number, number];
  /** Optional albedo for ROCK/MASSIF; other profiles retain their ground-derived material. */
  rockSurface?: { texture: 'desertRock' | 'westmarkGranite'; metersPerTile: number };
  /** Natural terrain's extra materials; absent on the established maps. */
  landscape?: { earth: 'westmarkEarth'; bark: 'westmarkBark'; foliage?: 'westmarkSpruce' };
  /** Opt-in weathered stone, meadow mosaics and deposited trail soil. */
  upland?: boolean;
  daylight?: boolean;
  rockDecor: { density: number; opacity: number };
  shrubDecor: { density: number; opacity: number };
  haze: readonly [number, number, number];
  lighting?: BattlefieldLighting;
  /** Highest terrain receiver included in the fitted shadow projection; default 32 m. */
  terrainReceiverHeight?: number;
}

interface BattlefieldSize {
  /** Half-width/depth of the square world, in metres. */
  extent: number;
  cellSize: number;
}

interface BattlefieldDefinition {
  name: string;
  size: BattlefieldSize;
  /** Resolve dimensions before layout and buffer allocation, without encounter RNG. */
  createSize?: (terrainSeed: number) => BattlefieldSize;
  createLayout: (terrainSeed: number, size: BattlefieldSize) => BattlefieldLayout;
  design?: BattlefieldDesign;
  palette: BattlefieldPalette;
  render: BattlefieldRenderProfile;
  worldEvent: 'solarFlare' | null;
  generate: (builder: BattlefieldBuilder) => void;
}

type MeridianSettings = Record<string, number | boolean> & {
  volume: number;
  music: boolean;
  sfx: boolean;
  quality: number;
  healthbars: boolean;
  showFps: boolean;
};

interface MeridianProfile {
  version: 1;
  expeditionDepth: number;
  aether: number;
  tutorialComplete: boolean;
  upgrades: Record<string, number>;
  settings: MeridianSettings;
}

type MissionId = 'hq-elimination';
interface MissionDefinition {
  readonly name: string;
  readonly maps: readonly BattlefieldId[];
  readonly firstStage: number;
  readonly objective: string;
  readonly briefing?: string;
  readonly intro: string;
  readonly victory: string;
  readonly defeat: string;
}
// Fresh per battle; future objective progress belongs here, never in the checkpoint.
type MissionState = { id: 'hq-elimination' };

interface ExpeditionEncounter {
  deployment: DeploymentMode;
  mission: MissionId;
  enemies: FactionId[];
  map: BattlefieldId;
  seed: number;
}

// Visual landscape archive, not a battle snapshot or a selectable checkpoint.
interface ExpeditionStagePreview {
  stage: number;
  map: BattlefieldId;
  seed: number;
}

interface MeridianExpedition {
  version: 6;
  faction: FactionId;
  abilities: AbilityType[];
  depth: number;
  benefits: Record<string, number>;
  enemyBenefits: Record<string, number>[];
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
  abilities: Record<string, unknown>;
  battlefields: Record<string, unknown>;
  missions: Record<string, Pick<MissionDefinition, 'maps'>>;
  enemyCount(depth: number): number;
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
  loadStageHistory(expedition: MeridianExpedition | null): ExpeditionStagePreview[];
  saveStageHistory(stages: readonly ExpeditionStagePreview[]): boolean;
}

type TeamId = -1 | PlayerTeam;
type EntityKind = 'unit' | 'building' | 'resource';
type ResourceType = 'crystal' | 'gas';
type EntityType = UnitType | BuildingType | ResourceType;

interface Position {
  x: number;
  z: number;
}

interface NavigationArea extends Position {
  radius: number;
}

interface NavigationPath {
  points: Position[];
  goal: Position;
  status: 'complete' | 'partial' | 'unreachable' | 'budget-exhausted';
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

// Actor identity is supplied by the caller/authority, never by the action payload.
type BattleAction =
  | { kind: 'order'; ids: number[]; order: CommandOrder }
  | { kind: 'rally'; ids: number[]; position: Position }
  | { kind: 'train'; unit: UnitType }
  | { kind: 'build'; building: BuildingType; position: Position; selected: number[] }
  | { kind: 'ability'; ability: AbilityType; position: Position }
  | { kind: 'cancelQueue'; id: number; index: number }
  | { kind: 'cancelConstruction' | 'toggleRepair' | 'sell'; id: number };

interface ActionTicket { tick: number; sequence: number; }
interface QueuedAction extends ActionTicket { team: PlayerTeam; action: BattleAction; announce: boolean; }
interface ActionOutcome extends ActionTicket {
  team: PlayerTeam;
  status: 'applied' | 'rejected' | 'cancelled' | 'failed';
}
interface CommandQueue {
  tick: number;
  nextSequence: number;
  pending: QueuedAction[];
  lastResults: ActionOutcome[];
  processing: boolean;
}

type EffectPose = Pick<EntityBase, 'x' | 'z' | 'kind' | 'type' | 'team' | 'faction' | 'rot' | 'size'> & {
  exit?: Pick<ExitPath, 'x' | 'z' | 'length'>;
};

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
  pathArea?: NavigationArea;
  pathStatus?: NavigationPath['status'];
  pathResolvedGoal?: Position;
  recoveryAttempts?: number;
  nextRecovery?: number;
  stuck?: number;
  steerSide?: 1 | -1;
  steerLocked?: boolean;
  slowed?: number;
  reinforcedUntil?: number;
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
  mission?: MissionId;
  deployment?: DeploymentMode;
  depth?: number;
  faction?: number;
  enemies?: FactionId[];
  map?: string;
  seed?: number;
  benefits?: Record<string, number>;
  enemyBenefits?: Record<string, number>[];
  abilities?: AbilityType[];
}

// Bounded local non-expedition scenarios for development and CPU checks.
interface ScenarioOptions {
  seed: number;
  /** Optional private deployment draw, independent of the public terrain seed. */
  startSeed?: number;
  map: BattlefieldId;
  depth?: number;
  parties: { faction: FactionId; controller: 'human' | 'ai'; benefits?: Record<string, number> }[];
  /** Symmetric matrix; false means non-hostile, not shared ownership or vision. */
  hostilities: boolean[][];
  duration: number;
}
type BattleRules = { kind: 'single-player'; mission: MissionState } |
  { kind: 'scenario'; hostilities: boolean[][]; duration: number };

interface RunStats {
  kills: number;
  structuresDestroyed: number;
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
  warning?: number;
  done?: boolean;
}

interface TimedArea extends Position {
  r: number;
  until: number;
}

interface Field extends TimedArea {
  type: 'bloom' | 'repair' | 'disruption' | 'bulwark' | 'surge';
  team: PlayerTeam;
  power?: number;
  reload?: number;
}

interface PendingRecall extends Position {
  team: PlayerTeam;
  hq: number;
  at: number;
  ids: number[];
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
}

interface AIContact extends Position {
  id: number; team: TeamId; kind: EntityKind; type: EntityType;
  hp: number; maxHp: number; size: number; progress: number; seenAt: number;
  areaVisible?: boolean;
}
interface AIState {
  deploymentGoal?: Position;
  deploymentGoalAt?: number;
  nextThink: number;
  observation?: { readyAt: number; own: Entity[]; visible: AIContact[] };
  attackProgress?: { targetId: number; distance: number; hp: number; at: number; startedAt: number };
  combatProgressAt?: number;
  scoutSite?: number;
  scoutGoal?: Position;
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
type PlayerTeam = 0 | 1 | 2 | 3;
interface TeamState {
  alloy: number;
  gas: number;
  energy: number;
  abilities: Record<AbilityType, number>;
}

type PartyController = { kind: 'human' } | { kind: 'ai'; state: AIState };
interface PartyState {
  id: PlayerTeam;
  faction: FactionId;
  loadout: AbilityType[];
  account: TeamState;
  meta: Record<string, number>;
  benefits: Record<string, number>;
  controller: PartyController;
  fieldWorkshopUsed?: boolean;
  /** Before the first completed HQ, survival depends on a deployment worker. */
  deploymentPending?: boolean;
  eliminated?: boolean;
}

interface RunState {
  depth: number;
  seed: number;
  map: BattlefieldId;
  time: number;
  parties: PartyState[];
  rules: BattleRules;
  stopped: boolean;
  nextId: number;
  entities: Entity[];
  scans: Scan[];
  strikes: Strike[];
  fields: Field[];
  recalls: PendingRecall[];
  stats: RunStats;
  triggers: RunTriggers;
  cam: Position & { zoom: number; yaw: number };
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
  material: keyof typeof MAT | 'ALIEN_LIGHT' | undefined;
}

interface WorldTerrainFeature extends Position {
  seed: number;
  yaw: number;
  width: number;
  depth: number;
  height: number;
  outline: Position[];
}

// CPU-owned sampled relief: navigation and drawing consume the same heights.
interface WorldRelief {
  extent: number;
  step: number;
  size: number; // Includes one vertex of halo on every side, for seamless edge normals.
  heights: Float32Array;
  innerExtent: number;
  /** Model-specific vertex data: natural landscape weights (negative snow = damp sediment),
   * engineered-skin RGB tint, or signed water depth / flow X / flow Z. */
  colors?: Float32Array;
}

type WorldGeometry = (
  | { mesh: string; model: string; seed: number; extent: number }
  | { mesh: string; model: string; feature: WorldTerrainFeature }
  | { mesh: string; model: string; relief: WorldRelief }
  | { mesh: string; model: string; plan: BattlefieldPlatformPlan }) & { grounded?: boolean; detail?: boolean };

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
      endY?: number;
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
