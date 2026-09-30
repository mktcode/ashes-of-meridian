/* Small DOM model views borrow the existing GPU meshes/context, never a renderer per tile. */
'use strict';
class MeridianModelThumbnails {
  private readonly preview: MeridianRenderer;
  private readonly updated = new WeakMap<HTMLCanvasElement, number>();
  constructor(private readonly renderer: MeridianRenderer) {
    // A drawing facade owns only instance buffers and view state. GPU programs,
    // textures and mesh geometry remain owned by the main renderer.
    const p = this.preview = Object.create(renderer) as MeridianRenderer;
    p.dynamic = {}; p.effects = {}; p.static = {}; p.occlusion = {};
    p.surface = null; p.cinema = true; p.fogOn = false;
    p.battlefieldProfile = DEFAULT_TERRAIN_RENDER_PROFILE;
    p.haze = [.035,.065,.09];
    p.surfaceStyle = surfaceWorldStyle('ground',0);
    p.extent = 90; p.decorSeed = 0; p.lightVP = M4.identity();
    p.bucket = (map,key,mesh=key,source=mesh) =>
      MeridianRenderer.prototype.bucket.call(p,map,key,mesh,source,8);
  }
  update(root: HTMLElement, time: number) {
    const clip = root.getBoundingClientRect();
    let next: HTMLCanvasElement | undefined, oldest = Infinity;
    // At most one tile per rendered frame, no work for hidden/offscreen tiles.
    for (const tile of root.querySelectorAll<HTMLCanvasElement>('canvas[data-model-kind]')) {
      const rect = tile.getBoundingClientRect(), last = this.updated.get(tile) ?? -Infinity;
      if (rect.width <= 0 || rect.height <= 0 || rect.right <= Math.max(0,clip.left) ||
          rect.left >= Math.min(innerWidth,clip.right) || rect.bottom <= Math.max(0,clip.top) ||
          rect.top >= Math.min(innerHeight,clip.bottom) || time-last < 1/6) continue;
      if (!next || last < oldest) { next = tile; oldest = last; }
    }
    if (next && this.draw(next,time)) this.updated.set(next,time);
  }
  draw(tile: HTMLCanvasElement, time: number) {
    const faction = Number(tile.dataset.modelFaction), kind = tile.dataset.modelKind,
      type = tile.dataset.modelType;
    if (!Number.isInteger(faction) || faction < 0 || faction >= FACTIONS.length ||
        (kind !== 'unit' && kind !== 'building') || !type ||
        !(kind === 'unit' ? hasContentKey(UNITS,type) : hasContentKey(BUILDINGS,type))) return false;
    const rect = tile.getBoundingClientRect(), aspect = rect.width/rect.height;
    if (!Number.isFinite(aspect) || aspect <= 0) return false;
    const r = this.renderer, p = this.preview, g = r.gl;
    const scale = Math.min(256/Math.max(rect.width,rect.height),devicePixelRatio || 1,2);
    const width = Math.max(1,Math.min(r.canvas.width,256,Math.round(rect.width*scale))),
      height = Math.max(1,Math.min(r.canvas.height,256,Math.round(rect.height*scale)));
    const context = tile.getContext('2d');
    if (!context) return false;
    p.begin();
    const definition = kind === 'unit' ? UNITS[type as UnitType] : BUILDINGS[type as BuildingType];
    renderEntity(p,{id:7,kind,type:type as UnitType | BuildingType,faction:faction as FactionId,
      team:0,x:0,z:0,hp:definition.hp,size:definition.size,progress:1,carry:0,walk:0,rot:time*.18-.45},time,{localTeam:0});
    const low = [Infinity,Infinity,Infinity], high = [-Infinity,-Infinity,-Infinity];
    for (const batches of [p.dynamic,p.effects]) for (const bucket of Object.values(batches)) {
      bucket.bounds = undefined;
      for (let i=0;i<bucket.n;i++) p.extendBounds(bucket,p.meshes[bucket.mesh],bucket.data,i*22);
      if (bucket.bounds) for (let k=0;k<3;k++) {
        low[k] = Math.min(low[k],bucket.bounds[k]); high[k] = Math.max(high[k],bucket.bounds[k+3]);
      }
    }
    if (!low.every(Number.isFinite)) return false;
    const center = low.map((v,k)=>(v+high[k])/2), radius = Math.max(.5,Math.hypot(...high.map((v,k)=>(v-low[k])/2)));
    p.eye = [center[0]+radius*2,center[1]+radius*2.3,center[2]+radius*3];
    const view = M4.look(p.eye,center);
    let halfHeight = 0;
    for (let i=0;i<8;i++) {
      const corner = M4.point(view, i&1?high[0]:low[0], i&2?high[1]:low[1], i&4?high[2]:low[2]);
      halfHeight = Math.max(halfHeight,Math.abs(corner[0])/(width/height),Math.abs(corner[1]));
    }
    halfHeight = Math.max(.5,halfHeight)*1.12;
    p.vp = M4.mul(M4.ortho(-halfHeight*width/height,halfHeight*width/height,-halfHeight,halfHeight,.1,radius*12+10),view);
    p.drawCalls = 0;
    // The lower-left scratch rectangle is copied synchronously to the 2D tile.
    // The normal full scene overwrites it in the same rAF, before presentation.
    g.bindFramebuffer(g.FRAMEBUFFER,null);
    g.viewport(0,0,width,height); g.enable(g.SCISSOR_TEST); g.scissor(0,0,width,height);
    try {
      g.enable(g.DEPTH_TEST); g.depthMask(true); g.disable(g.BLEND);
      g.clearColor(...p.haze,1); g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
      p.upload(p.dynamic); p.upload(p.effects);
      p.bindSceneProgram(time,time);
      g.uniform1f(p.uniform(p.program,'u_shadowOn'),0);
      p.drawBatches(p.dynamic);
      g.enable(g.BLEND); g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA); g.depthMask(false);
      p.drawBatches(p.effects);
      if (tile.width !== width) tile.width = width;
      if (tile.height !== height) tile.height = height;
      context.drawImage(r.canvas,0,r.canvas.height-height,width,height,0,0,width,height);
      r.drawCalls += p.drawCalls;
    } finally {
      g.disable(g.SCISSOR_TEST); g.disable(g.BLEND); g.depthMask(true); g.bindVertexArray(null);
    }
    return true;
  }
  dispose() {
    for (const batches of [this.preview.dynamic,this.preview.effects]) {
      for (const bucket of Object.values(batches)) this.renderer.gl.deleteBuffer(bucket.buffer);
      for (const key of Object.keys(batches)) delete batches[key];
    }
  }
}
