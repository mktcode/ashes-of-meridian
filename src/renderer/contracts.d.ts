/* CPU/GPU boundary contracts; erased by the classic-script build. */
type RenderLayer = 'static' | 'dynamic' | 'effects';
type ResidentTextureName = keyof typeof MERIDIAN_TEXTURES | ProceduralMaterialName;
type RenderColor = number | string | readonly number[] | Float32Array;
type MeshData = number[] | Float32Array;
interface RenderBucket {
  data: Float32Array;
  n: number;
  buffer: WebGLBuffer | null;
  dirty: boolean;
  mesh: string;
  source: string;
  bounds?: [number, number, number, number, number, number];
}
type RenderBatches = Record<string, RenderBucket>;
// Optional map-owned presentation. The renderer retains all common passes and models.
interface BattlefieldEnvironment {
  readonly skyProg: WebGLProgram;
  readonly postProg: WebGLProgram;
  beginFrame(modelTime: number): void;
  drawSceneBatches(time: number, modelTime: number, ...args: Parameters<MeridianRenderer['drawBatches']>): void;
  preparePost(): void;
  endFrame(): void;
  frameReady(): boolean;
  resize(): void;
  dispose(): void;
}
interface RenderMesh {
  vao: WebGLVertexArrayObject | null;
  vbo: WebGLBuffer | null;
  count: number;
  bounds: [number, number, number, number, number, number];
}
interface ResidentTexture {
  texture: WebGLTexture | null;
  fallback: number[];
  repeat: boolean;
  resident: boolean;
}
interface ModelTransform {
  x?: number; y?: number; z?: number;
  sx?: number; sy?: number; sz?: number;
  ry?: number; rx?: number; rz?: number;
  tint?: number[];
}
interface ShellDimensions {
  x?: number; y?: number; z?: number;
  sx: number; sy: number; sz: number;
  lobes?: number; depth?: number; segments?: number; rings?: number; tint?: number[];
}
interface PanelDimensions {
  x?: number; y?: number; z?: number;
  w: number; h: number; d: number; bevel: number; tint?: number[];
}
type ModelPart = (shape: string, x: number, y: number, z: number,
  sx: number, sy: number, sz: number, color: RenderColor,
  ry?: number, rx?: number, rz?: number, glow?: number, alpha?: number, material?: number) => void;
type ModelRing = (radius: number, height: number, color?: number, alpha?: number,
  rx?: number, ry?: number, glow?: number) => void;
// Previews need visual properties, not live simulation paths, cooldowns or orders.
type RenderEntity = Pick<EntityBase, 'id' | 'kind' | 'type' | 'x' | 'z' | 'hp' | 'faction' | 'team' | 'size'> &
  Partial<EntityBase> & { amount?: number };
interface EntityModelContext {
  entity: RenderEntity;
  time: number;
  /** Dusk/dawn fade; zero in previews and without a world atmosphere. */
  nightLight: number;
  /** View-only diffuse light; adapter owns pose, visibility and renderer budget. */
  pointLight: (x: number, y: number, z: number, radius: number, color: number, intensity: number) => void;
  lightPool: (x: number, z: number, width: number, length: number, color: number, strength: number) => void;
  part: ModelPart;
  ring: ModelRing;
  metal: number; dark: number; team: number; accent: number;
  baseRotation: number;
  surfaceColor: (color: number) => number;
}
interface EntityModelDefinition {
  id: string;
  meshes?: Record<string, () => number[]>;
  render: (context: EntityModelContext) => void;
}
interface RenderEntityOptions {
  /** Caller has applied current party visibility (exploration for neutral resources). */
  occlusion?: boolean;
  localTeam?: PlayerTeam;
  layer?: RenderLayer;
  alpha?: number;
  tint?: number;
  ghost?: boolean;
  material?: number;
}
interface TerrainModelCatalog {
  [model: string]: ((seed: number, extent: number) => MeshData) |
    ((feature: WorldTerrainFeature) => MeshData) | ((relief: WorldRelief) => MeshData) | ((descriptor: WorldGeometry) => MeshData);
  geometry: (descriptor: WorldGeometry) => MeshData;
}
interface Window {
  Meridian: {
    game: MeridianGame;
    ui: MeridianUI;
    renderer: MeridianRenderer;
    audio: MeridianAudio;
    content: { units: typeof UNITS; buildings: typeof BUILDINGS; factions: typeof FACTIONS };
    readonly performance: { fps: number; drawCalls: number; entities: number };
    diagnostics?: ReturnType<typeof createMeridianDiagnostics>;
    version: string;
  };
}
type EffectRingArgs = [x: number, z: number, radius: number, color: RenderColor,
  alpha?: number, y?: number, rotation?: number];
