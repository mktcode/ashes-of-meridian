declare const gameMap: unique symbol;

export interface PointXZ { readonly x: number; readonly z: number }
export interface BoundsXZ { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }
export interface MapGrid {
  readonly width: 520; readonly length: 640; readonly nx: 260; readonly ny: 320;
  readonly units: 'meters'; readonly axes: 'x-east/y-up/z-south';
  readonly origin: readonly [-260, 0, 320]; readonly step: readonly [2, 0, -2];
  readonly heightEncoding: 'float32-le'; readonly triangles: 'a-b-c/b-d-c';
}
export interface MapGeneration {
  readonly generator: 'strata-terrain'; readonly version: 1; readonly seed: number;
  readonly branches: number; readonly stage: 'macro' | 'landscape'; readonly naturalness: number;
  readonly hills: number; readonly hillScale: number; readonly pathWidth: number;
}
export interface MapManifest {
  readonly format: 'strata-game-map'; readonly version: 1; readonly grid: MapGrid;
  readonly generation: MapGeneration;
  readonly renderBasis: { readonly heightScaleBaked: number; readonly upperHeight: number; readonly northAxis: readonly number[] };
}
export interface MapRoute {
  readonly kind: 'entry' | 'exit' | 'ascent' | 'branch' | 'loop';
  readonly from: string; readonly to: string;
  readonly points: readonly (readonly [number, number])[];
}
export interface NavigationReport {
  readonly maxSlope: number; readonly pathWidth: number; readonly neighbors: 4;
  readonly unitRadius: 0; readonly connected: true; readonly corridorCells: number;
  readonly routeCount: number; readonly maxCorridorSlope: number;
}
// Import owns these CPU arrays; consumers must not mutate them while using the map.
// Crowd creates its own defensive surface copy. No GPU or simulation state lives here.
export interface GameMap {
  readonly [gameMap]: true;
  readonly manifest: MapManifest; readonly heights: Float32Array;
  readonly walkable: Uint8Array; readonly corridors: Uint8Array;
  readonly routes: readonly MapRoute[]; readonly report: NavigationReport;
}
// Structural Blob/File input keeps the public declarations usable without DOM libraries.
export interface MapBlobInput { readonly size: number; arrayBuffer(): Promise<ArrayBuffer> }
export type MapInput = MapBlobInput | ArrayBuffer | Uint8Array;
export interface TerrainMesh { readonly vertices: Float32Array; readonly indices: Uint32Array; readonly stride: 24 }
export interface TerrainHit extends PointXZ { readonly y: number; readonly distance: number }
