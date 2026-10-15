import { AgentState } from './constants.js';
export { AgentState };

declare const agentId: unique symbol;
declare const groupId: unique symbol;
declare const orderId: unique symbol;
declare const surfaceId: unique symbol;
declare const navigationId: unique symbol;
export type AgentId = number & { readonly [agentId]: true };
export type GroupId = number & { readonly [groupId]: true };
export type OrderId = number & { readonly [orderId]: true };
export interface PointXZ {
  readonly x: number;
  readonly z: number;
}
export interface Heightfield {
  readonly [surfaceId]: true;
  readonly halfSize: number;
  readonly cellSize: number;
  heightAt(x: number, z: number): number;
  slopeAt(x: number, z: number): number;
}
export interface NavigationWorld {
  readonly [navigationId]: true;
}
export interface Obstacle extends PointXZ {
  readonly width: number;
  readonly depth: number;
}
export interface MovementProfile {
  readonly radius: number;
  readonly maxSlope: number;
  readonly maxSpeed: number;
  readonly traffic?: 'cooperative' | 'independent-detour';
}
export interface NavigationOptions {
  readonly surface: Heightfield;
  readonly obstacles: readonly Obstacle[];
  readonly profiles: Readonly<Record<string, MovementProfile>>;
  readonly cellSize?: number;
}
export type CrowdOrder =
  | { readonly kind: 'move'; readonly group: GroupId; readonly destination: PointXZ }
  | { readonly kind: 'hold'; readonly group: GroupId };
export type CommandResult =
  | { readonly ok: true; readonly order: OrderId }
  | {
      readonly ok: false;
      readonly reason:
        | 'unknown-group'
        | 'invalid-order'
        | 'invalid-destination'
        | 'unreachable-or-insufficient-space';
    };
export interface SpawnResult {
  readonly requested: number;
  readonly agents: readonly AgentId[];
  readonly complete: boolean;
}
export interface GroupView {
  readonly id: GroupId;
  readonly profile: string;
  readonly team: number;
  readonly order: 'idle' | 'move' | 'hold';
  readonly orderId: OrderId | null;
  readonly destination: PointXZ | null;
}
export type AgentStateCode = (typeof AgentState)[keyof typeof AgentState];
export interface AgentView extends PointXZ {
  readonly id: AgentId;
  readonly group: GroupId;
  readonly profile: string;
  readonly radius: number;
  readonly y: number;
  readonly yaw: number;
  readonly state: AgentStateCode;
  readonly contact: AgentId | null;
  readonly orderId: OrderId | null;
}
// Consumer-owned buffers; replaced only when capacity grows, never aliases of solver storage.
export interface CrowdFrameBuffer {
  count: number;
  tick: number;
  revision: number;
  time: number;
  ids: Uint32Array;
  groups: Uint32Array;
  positions: Float64Array;
  yaw: Float64Array;
  age: Float64Array;
  movementBlend: Float64Array;
  velocity: Float64Array;
  states: Uint8Array;
}
export interface CrowdStats {
  readonly fieldBuilds: number;
  readonly neighbourChecks: number;
  readonly contactChecks: number;
  readonly contacts: number;
  readonly steps: number;
  readonly recoveryAttempts: number;
  readonly recoveryFields: number;
  readonly recoveryNodes: number;
  readonly reassignments: number;
  readonly retargets: number;
  readonly moving: number;
  readonly waiting: number;
  readonly inContact: number;
  readonly reservations: number;
}
export interface Crowd {
  readonly size: number;
  readonly tick: number;
  readonly revision: number;
  createGroup(options: {
    readonly profile: string;
    readonly team: number;
    readonly spawnOrigin: PointXZ;
  }): GroupId;
  spawn(group: GroupId, count: number): SpawnResult;
  command(order: CrowdOrder): CommandResult;
  setTeam(group: GroupId, team: number): boolean;
  removeAgents(ids: readonly AgentId[]): number;
  getAgent(id: AgentId): AgentView | null;
  getGroups(): readonly GroupView[];
  getStats(): CrowdStats;
  step(): void;
  writeFrame(out: CrowdFrameBuffer, alpha: number): void;
  dispose(): void;
}
