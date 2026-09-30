/* Small DOM model views borrow the existing GPU meshes/context, never a renderer per tile. */
'use strict';
class MeridianModelThumbnails {
  private readonly preview: MeridianRenderer;
  private applied = new WeakMap<HTMLCanvasElement, string>();
  private readonly cache = new Map<string, HTMLCanvasElement>();
  private readonly cacheLimit = 96;
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
  update(root: HTMLElement) {
    const clip = root.getBoundingClientRect();
    let canRender = true;
    // Cold misses render at most once per frame. Cache hits only copy 2D pixels
    // into new/reconfigured DOM nodes; unchanged tiles do no drawing at all.
    for (const tile of root.querySelectorAll<HTMLCanvasElement>('canvas[data-model-kind]')) {
      const rect = tile.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.right <= Math.max(0,clip.left) ||
          rect.left >= Math.min(innerWidth,clip.right) || rect.bottom <= Math.max(0,clip.top) ||
          rect.top >= Math.min(innerHeight,clip.bottom)) continue;
      if (this.draw(tile,canRender) === 'rendered') canRender = false;
    }
  }
  draw(tile: HTMLCanvasElement, allowRender = true) {
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
    const key = [faction,kind,type,r.quality,width,height,
      r.textureResources?.metal?.resident ?? false,r.textureResources?.bio?.resident ?? false].join(':');
    if (this.applied.get(tile) === key && tile.width === width && tile.height === height) return 'unchanged';
    const context = tile.getContext('2d');
    if (!context) return false;
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key); this.cache.set(key,cached);
      this.apply(tile,context,cached,key);
      return 'cached';
    }
    if (!allowRender) return false;
    const image = document.createElement('canvas'), imageContext = image.getContext('2d');
    if (!imageContext) return false;
    image.width = width; image.height = height;
    p.begin();
    const definition = kind === 'unit' ? UNITS[type as UnitType] : BUILDINGS[type as BuildingType];
    renderEntity(p,{id:7,kind,type:type as UnitType | BuildingType,faction:faction as FactionId,
      team:0,x:0,z:0,hp:definition.hp,size:definition.size,progress:1,carry:0,walk:0,rot:-.45},0,{localTeam:0});
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
    // Fit each transformed part directly in camera space. Projecting the whole
    // world AABB a second time made angled buildings unnecessarily small.
    const min = [Infinity,Infinity], max = [-Infinity,-Infinity];
    for (const batches of [p.dynamic,p.effects]) for (const bucket of Object.values(batches)) {
      const bounds = p.meshes[bucket.mesh]?.bounds;
      if (!bounds) continue;
      for (let instance=0;instance<bucket.n;instance++) for (let i=0;i<8;i++) {
        const d = bucket.data, o = instance*22,
          x = i&1?bounds[3]:bounds[0], y = i&2?bounds[4]:bounds[1], z = i&4?bounds[5]:bounds[2],
          point = M4.point(view,d[o]*x+d[o+4]*y+d[o+8]*z+d[o+12],
            d[o+1]*x+d[o+5]*y+d[o+9]*z+d[o+13],d[o+2]*x+d[o+6]*y+d[o+10]*z+d[o+14]);
        for (let k=0;k<2;k++) { min[k] = Math.min(min[k],point[k]); max[k] = Math.max(max[k],point[k]); }
      }
    }
    view[12] -= (min[0]+max[0])/2; view[13] -= (min[1]+max[1])/2;
    const halfHeight = Math.max(.5,(max[0]-min[0])/2/(width/height),(max[1]-min[1])/2)*1.03;
    p.vp = M4.mul(M4.ortho(-halfHeight*width/height,halfHeight*width/height,-halfHeight,halfHeight,.1,radius*12+10),view);
    p.drawCalls = 0;
    // A cold miss copies the scratch rectangle once into the 2D image cache.
    // The normal full scene overwrites it in the same rAF, before presentation.
    g.bindFramebuffer(g.FRAMEBUFFER,null);
    g.viewport(0,0,width,height); g.enable(g.SCISSOR_TEST); g.scissor(0,0,width,height);
    try {
      g.enable(g.DEPTH_TEST); g.depthMask(true); g.disable(g.BLEND);
      g.clearColor(...p.haze,1); g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
      p.upload(p.dynamic); p.upload(p.effects);
      p.bindSceneProgram(0,0);
      g.uniform1f(p.uniform(p.program,'u_shadowOn'),0);
      p.drawBatches(p.dynamic);
      g.enable(g.BLEND); g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA); g.depthMask(false);
      p.drawBatches(p.effects);
      imageContext.drawImage(r.canvas,0,r.canvas.height-height,width,height,0,0,width,height);
      r.drawCalls += p.drawCalls;
    } finally {
      g.disable(g.SCISSOR_TEST); g.disable(g.BLEND); g.depthMask(true); g.bindVertexArray(null);
    }
    this.cache.set(key,image);
    if (this.cache.size > this.cacheLimit) {
      const oldest = this.cache.keys().next().value!, evicted = this.cache.get(oldest)!;
      this.cache.delete(oldest); evicted.width = evicted.height = 0;
    }
    this.apply(tile,context,image,key);
    return 'rendered';
  }
  private apply(tile: HTMLCanvasElement, context: CanvasRenderingContext2D, image: HTMLCanvasElement, key: string) {
    if (tile.width !== image.width) tile.width = image.width;
    if (tile.height !== image.height) tile.height = image.height;
    context.drawImage(image,0,0);
    this.applied.set(tile,key);
  }
  dispose() {
    this.applied = new WeakMap();
    for (const image of this.cache.values()) image.width = image.height = 0;
    this.cache.clear();
    for (const batches of [this.preview.dynamic,this.preview.effects]) {
      for (const bucket of Object.values(batches)) this.renderer.gl.deleteBuffer(bucket.buffer);
      for (const key of Object.keys(batches)) delete batches[key];
    }
  }
}
