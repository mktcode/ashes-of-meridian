import type { CrowdStats } from './contracts.js';

export interface SolverAgent {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  group: number;
  profile: string;
  radius: number;
  state: string;
  contact: number | null;
  moving: boolean;
  time: number;
  movementBlend: number;
  vx: number;
  vz: number;
  stalledFor: number;
  target: { x: number; z: number } | null;
  previous: { x: number; z: number; yaw: number; time: number; movementBlend: number };
}
export interface SolverGroup {
  id: number;
  team: number;
  profile: string;
  order: 'idle' | 'move' | 'hold';
  destination: { x: number; z: number } | null;
  reservedSlots: Set<object>;
}
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
export interface SolverWorld {
  units: SolverAgent[];
  groups: SolverGroup[];
  revision: number;
  time: number;
  nextAgentId: number;
  stats: Mutable<Omit<CrowdStats, 'moving' | 'waiting' | 'inContact' | 'reservations'>>;
  scratch: unknown;
  recoveryCandidate: SolverAgent | null;
}
