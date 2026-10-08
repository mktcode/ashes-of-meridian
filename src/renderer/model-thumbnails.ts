/* Small DOM model views borrow the existing GPU meshes/context, never a renderer per tile. */
'use strict';
class MeridianModelThumbnails {
  private readonly preview: MeridianRenderer;
  private applied = new WeakMap<HTMLCanvasElement, string>();
  private readonly cache = new Map<string, HTMLCanvasElement>();
  private readonly cacheLimit = 96;
  private supportsMSAA: boolean | undefined;
  private msaaWidth = 0;
  private msaaHeight = 0;
  private msaa: {fbo: WebGLFramebuffer; color: WebGLRenderbuffer; depth: WebGLRenderbuffer;
    resolve: WebGLFramebuffer; output: WebGLRenderbuffer} | null = null;
  constructor(private readonly renderer: MeridianRenderer) {
    // A drawing facade owns only instance buffers and view state. GPU programs,
    // textures and mesh geometry remain owned by the main renderer.
    const p = this.preview = Object.create(renderer) as MeridianRenderer;
    p.dynamic = {}; p.effects = {}; p.static = {}; p.occlusion = {};
    p.surface = null; p.cinema = true; p.fogOn = false;
    p.battlefieldProfile = DEFAULT_TERRAIN_RENDER_PROFILE;
    // Do not inherit the main renderer's current day-cycle profile through the facade.
    p.setBattlefieldTime(0);
    p.haze = [.035,.065,.09];
    p.surfaceStyle = surfaceWorldStyle('ground',0);
    p.extent = 90; p.lightVP = M4.identity();
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
    // Wide HUD tiles must retain enough vertical pixels, not squeeze the whole
    // strip into a 256px capture. Codex tiles keep their existing capture budget.
    const pixelLimit = tile.classList?.contains('action-model') ? 1024 : 256;
    const scale = Math.min(pixelLimit/Math.max(rect.width,rect.height),devicePixelRatio || 1,2,
      r.canvas.width/rect.width,r.canvas.height/rect.height);
    const width = Math.max(1,Math.min(r.canvas.width,pixelLimit,Math.round(rect.width*scale))),
      height = Math.max(1,Math.min(r.canvas.height,pixelLimit,Math.round(rect.height*scale)));
    const requestedZoom = Number(tile.dataset.modelZoom ?? 1);
    const zoom = Number.isFinite(requestedZoom) ? clamp(requestedZoom,1,2) : 1;
    const key = [faction,kind,type,r.quality,width,height,zoom,
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
    const halfHeight = Math.max(.5,(max[0]-min[0])/2/(width/height),(max[1]-min[1])/2)*1.03/zoom;
    p.vp = M4.mul(M4.ortho(-halfHeight*width/height,halfHeight*width/height,-halfHeight,halfHeight,.1,radius*12+10),view);
    p.drawCalls = 0;
    // Cold misses use native 2x MSAA or average two quarter-pixel jittered
    // samples. Only the initial capture crosses WebGL/2D; cache hits do neither.
    // The normal full scene overwrites it in the same rAF, before presentation.
    const framebuffer = this.multisampleTarget(width,height);
    g.bindFramebuffer(g.FRAMEBUFFER,framebuffer);
    g.viewport(0,0,width,height); g.enable(g.SCISSOR_TEST); g.scissor(0,0,width,height);
    const vp = p.vp, samples = framebuffer ? 1 : 2;
    try {
      p.upload(p.dynamic); p.upload(p.effects);
      for (let sample=0;sample<samples;sample++) {
        if (!framebuffer) {
          p.vp = new Float32Array(vp);
          const shift = sample === 0 ? .5 : -.5;
          p.vp[12] += shift/width; p.vp[13] += shift/height;
        }
        g.enable(g.DEPTH_TEST); g.depthMask(true); g.disable(g.BLEND);
        g.clearColor(...p.haze,1); g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
        p.bindSceneProgram(0,0);
        g.uniform1f(p.uniform(p.program,'u_shadowOn'),0);
        p.drawBatches(p.dynamic);
        g.enable(g.BLEND); g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA); g.depthMask(false);
        p.drawBatches(p.effects);
        if (framebuffer) {
          g.bindFramebuffer(g.READ_FRAMEBUFFER,framebuffer);
          // MSAA requires identical color formats. Resolve into RGBA8 first;
          // the opaque default canvas may use a different internal format.
          g.bindFramebuffer(g.DRAW_FRAMEBUFFER,this.msaa!.resolve);
          g.blitFramebuffer(0,0,width,height,0,0,width,height,g.COLOR_BUFFER_BIT,g.NEAREST);
          g.bindFramebuffer(g.READ_FRAMEBUFFER,this.msaa!.resolve);
          g.bindFramebuffer(g.DRAW_FRAMEBUFFER,null);
          g.blitFramebuffer(0,0,width,height,0,0,width,height,g.COLOR_BUFFER_BIT,g.NEAREST);
        }
        imageContext.globalAlpha = sample === 0 ? 1 : .5;
        imageContext.drawImage(r.canvas,0,r.canvas.height-height,width,height,0,0,width,height);
      }
      r.drawCalls += p.drawCalls;
    } finally {
      p.vp = vp; imageContext.globalAlpha = 1;
      g.disable(g.SCISSOR_TEST); g.disable(g.BLEND); g.depthMask(true); g.bindVertexArray(null);
      g.bindFramebuffer(g.FRAMEBUFFER,null);
    }
    this.cache.set(key,image);
    if (this.cache.size > this.cacheLimit) {
      const oldest = this.cache.keys().next().value!, evicted = this.cache.get(oldest)!;
      this.cache.delete(oldest); evicted.width = evicted.height = 0;
    }
    this.apply(tile,context,image,key);
    return 'rendered';
  }
  private multisampleTarget(width: number, height: number): WebGLFramebuffer | null {
    const g = this.renderer.gl;
    if (this.supportsMSAA === undefined) {
      const counts = (format: number) => Array.from<number>(g.getInternalformatParameter(g.RENDERBUFFER,format,g.SAMPLES) || []);
      // Never substitute 4x; unsupported devices use two jittered samples.
      this.supportsMSAA = counts(g.RGBA8).includes(2) && counts(g.DEPTH_COMPONENT24).includes(2);
    }
    if (!this.supportsMSAA) return null;
    if (width === this.msaaWidth && height === this.msaaHeight) return this.msaa?.fbo ?? null;
    this.releaseMultisampleTarget();
    this.msaaWidth = width; this.msaaHeight = height;
    const fbo = g.createFramebuffer(), color = g.createRenderbuffer(), depth = g.createRenderbuffer(),
      resolve = g.createFramebuffer(), output = g.createRenderbuffer();
    if (!fbo || !color || !depth || !resolve || !output) {
      for (const framebuffer of [fbo,resolve]) if (framebuffer) g.deleteFramebuffer(framebuffer);
      for (const buffer of [color,depth,output]) if (buffer) g.deleteRenderbuffer(buffer);
      return null;
    }
    this.msaa = {fbo,color,depth,resolve,output};
    g.bindFramebuffer(g.FRAMEBUFFER,fbo);
    try {
      let exact = true;
      for (const [buffer,format,attachment] of [[color,g.RGBA8,g.COLOR_ATTACHMENT0],[depth,g.DEPTH_COMPONENT24,g.DEPTH_ATTACHMENT]] as const) {
        g.bindRenderbuffer(g.RENDERBUFFER,buffer);
        g.renderbufferStorageMultisample(g.RENDERBUFFER,2,format,width,height);
        exact = exact && g.getRenderbufferParameter(g.RENDERBUFFER,g.RENDERBUFFER_SAMPLES) === 2;
        g.framebufferRenderbuffer(g.FRAMEBUFFER,attachment,g.RENDERBUFFER,buffer);
      }
      if (!exact || g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) this.releaseMultisampleTarget();
      else {
        g.bindFramebuffer(g.FRAMEBUFFER,resolve);
        g.bindRenderbuffer(g.RENDERBUFFER,output);
        g.renderbufferStorage(g.RENDERBUFFER,g.RGBA8,width,height);
        g.framebufferRenderbuffer(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.RENDERBUFFER,output);
        if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) this.releaseMultisampleTarget();
      }
    } finally {
      g.bindRenderbuffer(g.RENDERBUFFER,null);
      g.bindFramebuffer(g.FRAMEBUFFER,null);
    }
    return this.msaa?.fbo ?? null;
  }
  private releaseMultisampleTarget() {
    if (!this.msaa) return;
    const g = this.renderer.gl;
    g.deleteFramebuffer(this.msaa.fbo); g.deleteFramebuffer(this.msaa.resolve);
    g.deleteRenderbuffer(this.msaa.color); g.deleteRenderbuffer(this.msaa.depth); g.deleteRenderbuffer(this.msaa.output);
    this.msaa = null;
  }
  private apply(tile: HTMLCanvasElement, context: CanvasRenderingContext2D, image: HTMLCanvasElement, key: string) {
    if (tile.width !== image.width) tile.width = image.width;
    if (tile.height !== image.height) tile.height = image.height;
    context.drawImage(image,0,0);
    this.applied.set(tile,key);
  }
  dispose() {
    this.releaseMultisampleTarget();
    this.msaaWidth = this.msaaHeight = 0;
    this.applied = new WeakMap();
    for (const image of this.cache.values()) image.width = image.height = 0;
    this.cache.clear();
    for (const batches of [this.preview.dynamic,this.preview.effects]) {
      for (const bucket of Object.values(batches)) this.preview.releaseBucket(bucket);
      for (const key of Object.keys(batches)) delete batches[key];
    }
  }
}
