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
