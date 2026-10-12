/* Shared, instance-owned still-scene controls. Never changes gameplay camera defaults. */
'use strict';
type CaptureVector = [number, number, number];
type CaptureCamera = {
  mode?: 'game' | 'orbit' | 'lookAt'; projection?: 'orthographic' | 'perspective';
  x?: number; z?: number; zoom?: number; yaw?: number; anchor?: 'world' | 'player' | 'enemy';
  target?: CaptureVector; eye?: CaptureVector; up?: CaptureVector;
  pitch?: number; distance?: number; fov?: number; near?: number; far?: number;
  fit?: 'map' | 'entities'; padding?: number;
};
type CaptureRender = { units?: boolean; buildings?: boolean; effects?: boolean; caches?: boolean;
  guides?: boolean; mapBoundary?: boolean; distanceMist?: boolean; horizonMist?: boolean; hud?: boolean };
type CaptureEntity = { kind: 'unit' | 'building'; type: string; team: PlayerTeam;
  x: number; z: number; rot?: number; anchor?: 'world' | 'player' | 'enemy' };
type CaptureShot = { name?: string; camera?: CaptureCamera; render?: CaptureRender; hour?: number;
  reveal?: boolean; width?: number; height?: number; dpr?: number; quality?: number; hud?: boolean };
type CaptureScene = CaptureShot & { map: string; seed: number; faction?: FactionId; enemy?: FactionId;
  content?: 'landscape' | 'landing' | 'arranged'; entities?: CaptureEntity[]; shots?: CaptureShot[] };
type ResolvedCaptureCamera = { eye: CaptureVector; target: CaptureVector; up: CaptureVector;
  projection: 'orthographic' | 'perspective'; height: number; fov: number; near: number; far: number };

// Pure validation also used by the Node tools through the built classic script.
function validateCaptureScene(scene: CaptureScene, shotOnly = false): CaptureScene {
  const object = (v: unknown, keys: string[], name: string) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error(`Invalid ${name}`);
    for (const key of Object.keys(v)) if (!keys.includes(key)) throw Error(`Unknown ${name} field: ${key}`);
  };
  const num = (v: unknown, name: string, lo: number, hi: number, integer = false) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (integer && !Number.isInteger(v)))
      throw Error(`Invalid ${name}`);
  };
  const vec = (v: unknown, name: string, limit = 100000) => {
    if (!Array.isArray(v) || v.length !== 3) throw Error(`Invalid ${name}`);
    v.forEach(n => num(n, name, -limit, limit));
  };
  const shotKeys = ['name','camera','render','hour','reveal','width','height','dpr','quality','hud'];
  object(scene, shotOnly ? shotKeys : [...shotKeys,'map','seed','faction','enemy','content','entities','shots'], 'scene');
  if (!shotOnly) {
    if (typeof scene.map !== 'string' || !Object.hasOwn(BATTLEFIELDS,scene.map)) throw Error('Unknown map');
    num(scene.seed, 'seed', 1, 99999999, true);
    for (const key of ['faction','enemy'] as const) if (scene[key] !== undefined) num(scene[key], key, 0, 2, true);
    if (scene.content !== undefined && !['landscape','landing','arranged'].includes(scene.content)) throw Error('Invalid content');
    if (scene.content === 'landscape' && scene.entities?.length) throw Error('Landscape cannot contain arranged entities');
    if (scene.entities !== undefined) {
      if (!Array.isArray(scene.entities) || scene.entities.length > 200) throw Error('entities must be an array of at most 200 entries');
      for (const e of scene.entities) {
        object(e, ['kind','type','team','x','z','rot','anchor'], 'entity');
        if (!['unit','building'].includes(e.kind) || typeof e.type !== 'string') throw Error('Invalid entity kind/type');
        num(e.team, 'team', 0, 1, true); num(e.x, 'entity.x', -10000, 10000); num(e.z, 'entity.z', -10000, 10000);
        if (e.rot !== undefined) num(e.rot, 'rot', -100000, 100000);
        if (e.anchor !== undefined && !['world','player','enemy'].includes(e.anchor)) throw Error('Invalid entity.anchor');
      }
    }
    if (scene.shots !== undefined) {
      if (!Array.isArray(scene.shots) || !scene.shots.length || scene.shots.length > 32) throw Error('shots must contain 1–32 entries');
      for (const shot of scene.shots) validateCaptureScene(shot as CaptureScene, true);
    }
  }
  if (scene.name !== undefined && (typeof scene.name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(scene.name))) throw Error('Invalid shot name');
  for (const key of ['width','height'] as const) if (scene[key] !== undefined) num(scene[key], key, 64, 4096, true);
  if (scene.dpr !== undefined) num(scene.dpr, 'dpr', .5, 2);
  if (scene.quality !== undefined) num(scene.quality, 'quality', 0, 2, true);
  if (scene.hour !== undefined) num(scene.hour, 'hour', 0, 23.999999);
  for (const key of ['reveal','hud'] as const) if (scene[key] !== undefined && typeof scene[key] !== 'boolean') throw Error(`Invalid ${key}`);
  if (scene.render !== undefined) {
    object(scene.render, ['units','buildings','effects','caches','guides','mapBoundary','distanceMist','horizonMist','hud'], 'render');
    for (const [key,v] of Object.entries(scene.render)) if (typeof v !== 'boolean') throw Error(`Invalid render.${key}`);
  }
  if (scene.camera !== undefined) {
    const c = scene.camera, mode = c.mode ?? 'game', projection = c.projection ?? 'orthographic';
    const common = ['mode','projection','zoom','fov','near','far'];
    object(c, mode === 'game' ? [...common,'x','z','yaw','anchor','fit','padding'] : mode === 'orbit'
      ? [...common,'target','yaw','pitch','distance','fit','padding'] : [...common,'eye','target','up'], 'camera');
    if (!['game','orbit','lookAt'].includes(mode) || !['orthographic','perspective'].includes(projection)) throw Error('Invalid camera mode/projection');
    if (mode === 'game' && projection !== 'orthographic') throw Error('Game camera is orthographic');
    if (c.fit !== undefined && !['map','entities'].includes(c.fit)) throw Error('Invalid fit');
    if (c.fit && (c.zoom !== undefined || c.distance !== undefined)) throw Error('Fit excludes zoom/distance');
    if (c.padding !== undefined) num(c.padding, 'padding', 0, 1);
    if (c.anchor !== undefined && !['world','player','enemy'].includes(c.anchor)) throw Error('Invalid camera.anchor');
    for (const key of ['x','z','yaw','pitch'] as const) if (c[key] !== undefined) num(c[key], `camera.${key}`, -100000, 100000);
    for (const key of ['zoom','distance'] as const) if (c[key] !== undefined) num(c[key], `camera.${key}`, .1, 10000000);
    if (c.fov !== undefined) num(c.fov, 'fov', .05, Math.PI - .05);
    if (projection === 'orthographic' && c.fov !== undefined) throw Error('FOV requires perspective');
    if (projection === 'perspective' && c.zoom !== undefined) throw Error('Perspective uses distance/FOV, not zoom');
    if (c.near !== undefined) num(c.near, 'near', .001, 999999999);
    if (c.far !== undefined) num(c.far, 'far', .01, 1000000000);
    if (c.far !== undefined && c.far <= (c.near ?? .1)) throw Error('far must exceed near');
    if (c.target !== undefined) vec(c.target, 'target', mode === 'lookAt' ? 100000000 : 100000);
    if (mode === 'orbit' && c.pitch !== undefined && Math.abs(c.pitch) > Math.PI/2) throw Error('pitch must be between -pi/2 and pi/2');
    if (mode === 'lookAt') {
      vec(c.eye, 'eye', 100000000); vec(c.target, 'target', 100000000); if (c.up !== undefined) vec(c.up, 'up');
      captureBasis(c.eye!, c.target!, c.up ?? [0,1,0]);
    }
  }
  return scene;
}
function captureBasis(eye: CaptureVector, target: CaptureVector, up: CaptureVector) {
  const unit = (v: CaptureVector): CaptureVector => {
    const n = Math.hypot(...v); if (n < 1e-8) throw Error('Degenerate camera vectors');
    return v.map(x => x/n) as CaptureVector;
  };
  const cross = (a: CaptureVector,b: CaptureVector): CaptureVector => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const back = unit(eye.map((x,i)=>x-target[i]) as CaptureVector), right = unit(cross(up,back)), vertical = cross(back,right);
  return { back, right, vertical };
}
function captureViewMatrix(c: ResolvedCaptureCamera): Float32Array {
  const {back:z,right:x,vertical:y} = captureBasis(c.eye,c.target,c.up), dot = (v: CaptureVector)=>-v.reduce((s,n,i)=>s+n*c.eye[i],0);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,dot(x),dot(y),dot(z),1]);
}
function resolveCaptureCamera(c: CaptureCamera, points: CaptureVector[], aspect: number, maxHeight: number): ResolvedCaptureCamera {
  const mode = c.mode ?? 'game', projection = c.projection ?? 'orthographic', pitch = c.pitch ?? Math.atan2(1.1,.82), yaw = c.yaw ?? 0;
  let target: CaptureVector = c.target ? [...c.target] : [c.x ?? 0,0,c.z ?? 0];
  let back: CaptureVector = [Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
  const up: CaptureVector = c.up ?? (Math.abs(Math.cos(pitch)) < 1e-7
    ? [-Math.sin(yaw)*Math.sign(pitch),0,-Math.cos(yaw)*Math.sign(pitch)] : [0,1,0]);
  if (mode === 'lookAt') back = captureBasis(c.eye!,target,up).back;
  let distance = c.distance ?? (mode === 'lookAt' ? Math.hypot(...c.eye!.map((n,i)=>n-target[i])) : 200), height = c.zoom ?? 115;
  if (c.fit) {
    if (!points.length) throw Error('No visible objects to fit');
    const basis = captureBasis(back,[0,0,0],up), axes = [basis.right,basis.vertical,basis.back];
    const ranges = axes.map(axis => {
      const values = points.map(p=>p.reduce((s,n,i)=>s+n*axis[i],0));
      return [Math.min(...values), Math.max(...values)];
    });
    target = [0,1,2].map(i=>axes.reduce((s,a,j)=>s+a[i]*(ranges[j][0]+ranges[j][1])/2,0)) as CaptureVector;
    const margin = 1+(c.padding ?? .08)*2;
    height = Math.max(.1,(ranges[0][1]-ranges[0][0])/aspect,ranges[1][1]-ranges[1][0])*margin;
    distance = (ranges[2][1]-ranges[2][0])/2 + height + 64;
    if (projection === 'perspective') {
      const tan = Math.tan((c.fov ?? .74)/2);
      distance = Math.max(...points.map(p=>{
        const v = p.map((n,i)=>n-target[i]);
        const dot = (axis: CaptureVector)=>v.reduce((s,n,i)=>s+n*axis[i],0);
        return dot(basis.back)+Math.max(Math.abs(dot(basis.right))/(tan*aspect),Math.abs(dot(basis.vertical))/tan)*margin;
      })) + 1;
    }
  } else if (mode === 'game') {
    // Frame scale is independent of physical eye distance in the viewing mode.
    distance = Math.max(200,maxHeight+height+64);
  }
  const eye = mode === 'lookAt' ? [...c.eye!] as CaptureVector : target.map((n,i)=>n+back[i]*distance) as CaptureVector;
  return { eye,target,up,projection,height,fov:c.fov ?? .74,near:c.near ?? .1,
    far:c.far ?? Math.max((c.near ?? .1)+1,500,distance+height+maxHeight+1000) };
}

class MeridianCapture {
  active = false;
  busy = false;
  readyToDraw = false;
  request = 0;
  renderedRequest = 0;
  scene?: CaptureScene;
  camera?: CaptureCamera;
  resolved?: ResolvedCaptureCamera;
  render: Required<CaptureRender> = { units:true,buildings:true,effects:true,caches:true,guides:false,mapBoundary:false,distanceMist:true,horizonMist:true,hud:false };
  anchors: Record<string, Position> = {};
  placed: {id:number;type:string;x:number;z:number}[] = [];
  hour?: number;
  reveal = true;
  fitActive = false;
  fitKey = '';
  timing = {worldMs:0,resourcesMs:0,frameMs:0};
  toolbar?: HTMLElement;
  mapDiagnostics?: MeridianMapDiagnostics;
  drawMapDiagnostics(ctx: CanvasRenderingContext2D) {
    if (this.active && this.readyToDraw && !this.busy) this.mapDiagnostics?.draw(ctx,(x,y,z)=>this.renderer.project(x,y,z));
  }
  exportMapDiagnostics() {
    if (this.busy || !this.readyToDraw || !this.game.s || !this.mapDiagnostics?.data) throw Error('No analyzed map to export');
    const report=JSON.parse(JSON.stringify(this.mapDiagnostics.data.report)) as ReturnType<typeof analyzeMapDiagnostics>['report'];
    return {build:MERIDIAN_BUILD_INFO,...report};
  }
  constructor(readonly game: MeridianGame, readonly ui: MeridianUI, readonly renderer: MeridianRenderer,
    readonly worldChanged: () => void, readonly annotationsChanged: () => void = () => {this.request++;}) {
    this.ui.viewingEntityVisible=e=>this.visible(e);
  }
  location(p: {x:number;z:number;anchor?:string}): Position {
    const a = this.anchors[p.anchor ?? 'world']; if (!a) throw Error(`Missing anchor: ${p.anchor}`);
    return {x:p.x+a.x,z:p.z+a.z};
  }
  bounds(kind: 'map' | 'entities'): CaptureVector[] {
    const world = this.game.world!, surface = world.surface!, points: CaptureVector[] = [];
    const box = (x0:number,x1:number,y0:number,y1:number,z0:number,z1:number) => {
      for (const x of [x0,x1]) for (const y of [y0,y1]) for (const z of [z0,z1]) points.push([x,y,z]);
    };
    if (kind === 'map') {
      const low = surface.heights.reduce((a,b)=>Math.min(a,b),0);
      box(-world.extent,world.extent,low,surface.maxHeight+64,-world.extent,world.extent);
    }
    for (const e of this.game.s!.entities) {
      if (e.hp <= 0 || (e.kind !== 'unit' && e.kind !== 'building')) continue;
      if (!this.visible(e) || (!this.reveal && !this.game.observed(e))) continue;
      const y = surface.entityHeight(e), r = e.size;
      box(e.x-r,e.x+r,y,y+r*6+32,e.z-r,e.z+r);
    }
    return points;
  }
  private boundaryPaths = new WeakMap<Battlefield,CaptureVector[]>();
  drawMapBoundary(ctx: CanvasRenderingContext2D) {
    const world=this.game.world;
    if (!this.active || !this.render.mapBoundary || !world) return;
    let points=this.boundaryPaths.get(world);
    if (!points) {
      const e=world.extent, corners=[[-e,-e],[e,-e],[e,e],[-e,e],[-e,-e]],
        steps=Math.min(256,Math.ceil(2*e/Math.max(1,world.cellSize ?? 2)));
      points=[];
      for (let side=0;side<4;side++) for (let i=0;i<steps;i++) {
        const t=i/steps,x=corners[side][0]*(1-t)+corners[side+1][0]*t,
          z=corners[side][1]*(1-t)+corners[side+1][1]*t;
        points.push([x,world.surface!.heightAt(x,z)+.12,z]);
      }
      points.push(points[0]); this.boundaryPaths.set(world,points);
    }
    // Screen-space annotation follows terrain and camera, not the decorative apron.
    ctx.save(); ctx.globalAlpha=1; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.setLineDash([8,6]); ctx.beginPath();
    let connected=false;
    for (const point of points) {
      const p=this.renderer.project(...point);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {connected=false;continue;}
      if (connected) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y);
      connected=true;
    }
    ctx.strokeStyle='#06101ee6'; ctx.lineWidth=4; ctx.stroke();
    ctx.strokeStyle='#c9fff3'; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
  }
  visible(e: {kind:string}) { return e.kind === 'unit' ? this.render.units : e.kind === 'building' ? this.render.buildings : true; }
  async adopt(shot: CaptureShot = {}) {
    this.mapDiagnostics?.invalidate();
    validateCaptureScene(shot as CaptureScene,true);
    if (!this.game.s || this.busy) throw Error('No stable scene to adopt');
    this.active = this.readyToDraw = true; this.ui.viewing = true; this.ui.paused = true;
    this.scene = {map:this.game.s.map,seed:this.game.s.seed,content:'landing'};
    this.camera = {mode:'game'}; this.fitActive = false; this.fitKey = ''; this.hour = undefined;
    this.render = {units:true,buildings:true,effects:true,caches:true,guides:false,mapBoundary:false,distanceMist:true,horizonMist:true,hud:false};
    this.anchors = {world:{x:0,z:0}}; this.placed = [];
    for (const [name,team] of [['player',0],['enemy',1]] as const) {
      const home=this.game.alive(e=>e.team===team && e.kind==='unit' && e.type==='worker')[0];
      if (home) this.anchors[name]={x:home.x,z:home.z};
    }
    return this.apply(shot);
  }
  release() {
    this.mapDiagnostics?.invalidate();
    this.active = this.readyToDraw = false; this.ui.viewing = false; this.ui.viewingCameraLocked = false;
    this.renderer.captureCamera = undefined; this.renderer.captureDpr = undefined; this.renderer.distanceMist = this.renderer.horizonMist = true;
  }
  async prepare(scene: CaptureScene) {
    validateCaptureScene(scene);
    if (this.busy) throw Error('Scene preparation already in progress');
    this.mapDiagnostics?.invalidate();
    this.busy = true; this.readyToDraw = false; this.active = true; this.ui.viewing = true; this.ui.viewingCameraLocked = true;
    this.ui.expedition = null; this.ui.paused = true;
    this.render = {units:true,buildings:true,effects:true,caches:scene.content!=='landscape',guides:false,mapBoundary:false,distanceMist:scene.content!=='landscape',horizonMist:scene.content!=='landscape',hud:false};
    this.reveal = scene.reveal !== false;
    this.ui.view = 'game'; this.renderer.captureCamera = undefined;
    this.scene = JSON.parse(JSON.stringify(scene));
    this.hour = undefined; this.fitKey = ''; this.placed = []; this.renderer.captureDpr = scene.dpr ?? 1;
    const worldStart = performance.now();
    try {
      this.game.start({map:scene.map,seed:scene.seed,faction:scene.faction ?? 0,enemies:[scene.enemy ?? 1],depth:6});
      this.ui.paused = true; this.ui.battleIntro = this.ui.battleTutorial = null;
      this.anchors = {world:{x:0,z:0}};
      for (const [name,team] of [['player',0],['enemy',1]] as const) {
        const worker = this.game.alive(e=>e.kind==='unit' && e.type==='worker' && e.team===team)[0];
        if (!worker) throw Error(`Missing landing anchor ${name}`);
        this.anchors[name] = {x:worker.x,z:worker.z};
      }
      if (scene.content === 'landscape' || scene.content === 'arranged') {
        this.game.s!.entities = this.game.s!.entities.filter(e=>e.kind!=='unit' && e.kind!=='building');
        this.game.rehash(); this.game.world!.rebuild(this.game.s!.entities);
      }
      for (const e of scene.entities ?? []) {
        const catalog = e.kind === 'unit' ? UNITS : BUILDINGS;
        if (!Object.hasOwn(catalog,e.type)) throw Error(`Unknown ${e.kind}: ${e.type}`);
        const p = this.location(e), definition = (catalog as unknown as Record<string,{size:number}>)[e.type];
        if (Math.abs(p.x)+definition.size>=this.game.world!.extent || Math.abs(p.z)+definition.size>=this.game.world!.extent) throw Error(`Entity outside map: ${e.type}`);
        const entity = e.kind === 'unit'
          ? this.game.spawnUnit(e.type as UnitType,p.x,p.z,e.team,this.game.factionFor(e.team),{rot:e.rot ?? 0})
          : this.game.spawnBuilding(e.type as BuildingType,p.x,p.z,e.team,this.game.factionFor(e.team),{rot:e.rot ?? 0});
        if (!entity) throw Error(`Could not place ${e.type}`);
        this.placed.push({id:entity.id,type:entity.type,x:entity.x,z:entity.z});
      }
      this.game.rehash(); this.game.world!.rebuild(this.game.s!.entities);
      this.ui.selected = []; this.ui.hover = null; this.ui.mode = null; this.ui.pointer.inside = false;
      this.ui.drag = null; this.ui.touchPoints.clear(); this.ui.touchGesture = false;
      for (const id of ['menu','modal','result','radio','toast','alerts','battleTransition']) $(id).classList.add('hidden');
      this.worldChanged();
      this.timing.worldMs = performance.now()-worldStart;
      const resourceStart = performance.now();
      if (!await this.renderer.prepareBattlefieldTextures(this.game.world!.renderProfile)) throw Error('Required battlefield materials unavailable');
      this.timing.resourcesMs = performance.now()-resourceStart;
      this.renderer.quality = scene.quality ?? 2;
      this.readyToDraw = true;
      return await this.apply({camera:scene.camera ?? {mode:'game',fit:'map'},render:scene.render,hour:scene.hour,
        reveal:scene.reveal,hud:scene.hud,quality:scene.quality,dpr:scene.dpr});
    } finally { this.busy = false; this.ui.viewingCameraLocked = (this.camera?.mode ?? 'game') !== 'game'; }
  }
  async apply(shot: CaptureShot) {
    validateCaptureScene(shot as CaptureScene,true);
    if (!this.active || !this.game.s) throw Error('No prepared capture scene');
    const {camera,render,hour,reveal,hud,quality} = shot;
    this.render = {...this.render,...render};
    if (hud !== undefined) this.render.hud = hud;
    if (this.scene?.content === 'landscape' && render?.caches === undefined) this.render.caches = false;
    if (hour !== undefined) this.hour = hour;
    if (reveal !== undefined) this.reveal = reveal;
    this.game.world!.reveal(this.game.s.entities,this.reveal ? [{team:0,x:0,z:0,r:this.game.world!.extent*3,until:Infinity}] : []);
    if (quality !== undefined) this.renderer.quality = quality;
    this.renderer.distanceMist = this.render.distanceMist;
    this.renderer.horizonMist = this.render.horizonMist;
    $('hud').classList.toggle('hidden',!this.render.hud);
    if (this.render.hud) { this.ui.renderActions(); this.ui.updateHUD(); }
    if (camera) {
      this.camera = JSON.parse(JSON.stringify(camera)); this.fitActive = !!camera.fit; this.fitKey = '';
      this.ui.viewingCameraLocked = this.busy || (camera.mode ?? 'game') !== 'game';
      if (camera.fit && (camera.mode ?? 'game') === 'game') this.game.s.cam.yaw = camera.yaw ?? 0;
      if ((camera.mode ?? 'game') === 'game' && !camera.fit) {
        const p = this.location({x:camera.x ?? 0,z:camera.z ?? 0,anchor:camera.anchor});
        const yaw = camera.yaw ?? 0, shift = this.game.world!.surface!.heightAt(p.x,p.z)*.82/1.1;
        Object.assign(this.game.s.cam,{x:p.x-Math.sin(yaw)*shift,z:p.z-Math.cos(yaw)*shift,zoom:camera.zoom ?? 115,yaw});
      }
    }
    if (shot.dpr !== undefined) this.renderer.captureDpr = shot.dpr;
    const frameStart=performance.now();
    this.renderer.resize(); this.drawCamera();
    const request = ++this.request, before = this.renderer.frame;
    await new Promise<void>((resolve,reject)=>{
      const started = performance.now(); let stableRequest = -1;
      const poll = () => {
        if (this.renderedRequest >= request && this.renderedRequest === this.request && this.renderer.frame > before && this.renderer.frameReady()) {
          // Let resize/layout observers settle across one more frame boundary,
          // without forcing a second GPU render of an unchanged still scene.
          if (stableRequest === this.request) { resolve(); return; }
          stableRequest = this.request;
        } else stableRequest = -1;
        if (performance.now()-started>30000) reject(Error('Prepared scene did not render within 30 seconds'));
        else requestAnimationFrame(poll);
      }; requestAnimationFrame(poll);
    });
    this.timing.frameMs = performance.now()-frameStart;
    const result=this.report();
    if (result.glError) throw Error(`WebGL error ${result.glError} in prepared scene`);
    return result;
  }
  drawCamera() {
    if (!this.active || !this.game.s || !this.camera) return;
    const c = this.camera, r = this.renderer, cam = this.game.s.cam;
    const key = `${r.viewport.width}/${r.viewport.height}/${cam.yaw}`;
    if ((c.mode ?? 'game') === 'game') {
      if (this.fitActive && key !== this.fitKey) {
        const fit = resolveCaptureCamera({...c,yaw:cam.yaw},this.bounds(c.fit ?? 'map'),r.viewport.width/r.viewport.height,this.game.world!.surface!.maxHeight);
        Object.assign(cam,{x:fit.target[0]-Math.sin(cam.yaw)*fit.target[1]*.82/1.1,
          z:fit.target[2]-Math.cos(cam.yaw)*fit.target[1]*.82/1.1,zoom:fit.height});
        this.fitKey = key;
      }
      Object.assign(cam, this.ui.clampCameraPoint(cam));
      this.resolved = resolveCaptureCamera({mode:'game',x:cam.x,z:cam.z,zoom:cam.zoom,yaw:cam.yaw},[],r.viewport.width/r.viewport.height,this.game.world!.surface!.maxHeight);
    } else this.resolved = resolveCaptureCamera(c,c.fit ? this.bounds(c.fit) : [],r.viewport.width/r.viewport.height,this.game.world!.surface!.maxHeight);
    r.captureCamera = this.resolved;
    r.camera(cam.x,cam.z,cam.zoom,false,0,cam.yaw);
  }
  navigationChanged() { this.fitActive = false; this.renderer.captureCamera = undefined; this.request++; this.drawCamera(); }
  report() {
    const s = this.game.s!;
    return {map:s.map,seed:s.seed,time:s.time,paused:this.ui.paused,request:this.request,renderedRequest:this.renderedRequest,
      placed:this.placed,anchors:this.anchors,extent:this.game.world!.extent,camera:this.resolved,
      stateCamera:{...s.cam},matrix:Array.from(this.renderer.vp),render:{...this.render},hour:this.renderer.battlefieldHour,
      startHour:this.game.world!.renderProfile.atmosphere?.timeOfDay ?? 0,glError:this.renderer.gl.getError(),
      timing:{...this.timing},quality:this.renderer.quality,dpr:this.renderer.captureDpr ?? 1,
      viewport:{...this.renderer.viewport},resolution:{width:this.renderer.width,height:this.renderer.height},
      units:s.entities.filter(e=>e.kind==='unit').length,buildings:s.entities.filter(e=>e.kind==='building').length};
  }
  exportScene(): CaptureScene {
    if (this.busy || !this.readyToDraw || !this.scene || !this.game.s || !this.resolved) throw Error('No ready scene to export');
    const scene = {...this.scene!}; delete scene.shots; delete scene.hud;
    // Export the effective 3D camera, not a guessed terrain focus: the screen
    // centre can lie outside the playable surface after an overview pan.
    this.drawCamera(); const c=this.resolved!;
    scene.camera = {mode:'lookAt',eye:[...c.eye],target:[...c.target],up:[...c.up],projection:c.projection,
      near:c.near,far:c.far,...(c.projection==='orthographic' ? {zoom:c.height} : {fov:c.fov})};
    scene.render = {...this.render,hud:false}; scene.reveal=this.reveal;
    scene.hour=this.renderer.battlefieldHour; scene.quality=this.renderer.quality;
    scene.width=Math.round(innerWidth); scene.height=Math.round(innerHeight); scene.dpr=this.renderer.captureDpr ?? 1;
    return scene;
  }
  mountViewer(params: URLSearchParams) {
    document.title = 'Ashes of Meridian — Map Viewer';
    const panel = document.createElement('section'); panel.id='mapViewer'; panel.setAttribute('aria-label','Map viewer tools');
    panel.innerHTML = `<form><label>Map <select name="map">${availableBattlefields().map(m=>`<option value="${m}">${m}</option>`).join('')}</select></label>
      <label>Seed <input name="seed" type="number" min="1" max="99999999" required></label><button>Load</button>
      <button type="button" data-viewer="random">Random seed</button><button type="button" data-viewer="fit">Whole map</button>
      <button type="button" data-viewer="reset">Reset camera</button><label><input name="mist" type="checkbox"> Distance mist</label>
      <label><input name="boundary" type="checkbox" checked> Map boundary</label>
      <label>Time of day <input id="mapViewerTime" name="hour" type="range" min="0" max="1439" step="1" value="0" aria-label="Time of day"><output for="mapViewerTime">00:00</output></label>
      <button type="button" data-viewer="export">Export recipe</button><button type="button" data-viewer="hide">Hide tools</button></form>
      <p role="status">Drag to pan · middle-drag to rotate · wheel/pinch to zoom</p>
      <details id="mapDiagnostics"><summary>Map diagnostics</summary>
        <div class="diagnosticActions"><button type="button" data-viewer="analyze">Analyze map</button>
          <button type="button" data-viewer="report" disabled>Export report</button></div>
        <div class="diagnosticLayers">
          <label><input type="checkbox" data-layer="connections" checked disabled> Connections: green main / orange detached (radius 6)</label>
          <label><input type="checkbox" data-layer="cliffs" disabled> Cliffs: red</label>
          <label><input type="checkbox" data-layer="foundations" disabled> HQ terrain sample: green suitable / red unsuitable</label>
          <label><input type="checkbox" data-layer="economy" disabled> Economic network and anchors</label>
          <label><input type="checkbox" data-layer="starts" disabled> Start candidates: white / two-party landings: yellow</label>
        </div><pre data-diagnostic-report role="status">Analysis runs only on request, then refreshes on map load.</pre>
        <p>Annotations show through terrain. HQ samples ignore resources and occupancy; corridors are planned links, not repair ramps.
          Static access does not prove traffic flow or balance. Diagnostic overlays are not part of the capture recipe.</p>
      </details>`;
    document.body.append(panel); this.toolbar=panel;
    const diagnostics=this.mapDiagnostics=new MeridianMapDiagnostics(),
      diagnosticReport=panel.querySelector<HTMLElement>('[data-diagnostic-report]')!,
      reportButton=panel.querySelector<HTMLButtonElement>('[data-viewer="report"]')!,
      layerControls=[...panel.querySelectorAll<HTMLInputElement>('[data-layer]')];
    const analyze=()=>{
      if (this.busy || !this.readyToDraw || !this.game.s || !this.game.world) throw Error('No stable map to analyze');
      const {report:r}=diagnostics.analyze(this.game.world,this.game.s.map,this.anchors), pct=(v:number)=>`${(v*100).toFixed(1)}%`;
      diagnosticReport.textContent=[`${r.map} · seed ${r.seed} · ${r.recipe} · build ${MERIDIAN_BUILD_INFO.id.slice(-12)}`,
        `Height: ${r.height.min.toFixed(1)}–${r.height.max.toFixed(1)} · cliff cells: ${pct(r.cliffs.fraction)}`,
        `Broad network: ${r.broad.components} components · largest ${pct(r.broad.largestShare)} of broad-clear cells`,
        `Broad interior coverage: ${pct(r.broad.interiorCoverage)} · vehicle components: ${r.vehicle.components}`,
        `Sector coverage (rows −Z → +Z): ${[0,3,6].map(i=>r.broad.sectorCoverage.slice(i,i+3).map(pct).join(' / ')).join(' | ')}`,
        `Economy: ${r.economy.accessibleAnchors}/${r.economy.anchors} anchors accessible · ${r.economy.broadHubs}/${r.economy.regions} broad hubs`,
        `HQ terrain sample (${r.hqSample.spacing}-unit spacing): ${r.hqSample.suitable}/${r.hqSample.tested} suitable points`,
        `Public start candidates: ${r.deployment.candidates} · landing distances are straight-line, not fairness scores`,
        ...r.deployment.landings.map(p=>`${p.name}: nearest resource ${p.nearestEconomyDistance.toFixed(1)} units`),
        ...(r.warnings.length?r.warnings:['Static terrain checks meet the current generator thresholds; gameplay remains untested.'])].join('\n');
      reportButton.disabled=false;layerControls.forEach(c=>c.disabled=false);this.annotationsChanged();
    };
    panel.querySelector<HTMLButtonElement>('[data-viewer="analyze"]')!.onclick=()=>{
      try {analyze();} catch(e) {diagnosticReport.textContent=String(e);}
    };
    for (const input of layerControls) input.onchange=()=>{
      diagnostics.layers[input.dataset.layer as MapDiagnosticLayer]=input.checked;this.annotationsChanged();
    };
    const form=panel.querySelector('form')!, map=form.elements.namedItem('map') as HTMLSelectElement,
      seed=form.elements.namedItem('seed') as HTMLInputElement, mist=form.elements.namedItem('mist') as HTMLInputElement,
      clock=form.elements.namedItem('hour') as HTMLInputElement, clockLabel=panel.querySelector('output')!,
      boundary=form.elements.namedItem('boundary') as HTMLInputElement,
      status=panel.querySelector('p')!;
    let selectedHour: number | undefined;
    const showTime=()=>{
      const minutes=Number(clock.value);
      clockLabel.value=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
    };
    const show=document.createElement('button'); show.id='showMapViewer'; show.textContent='Show tools'; show.hidden=true;
    document.body.append(show); show.onclick=()=>{panel.hidden=false;show.hidden=true;};
    const load = async () => {
      const controls=[...panel.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select')];
      const mapId=map.value, value=Number(seed.value); controls.forEach(b=>b.disabled=true);
      diagnostics.invalidate();this.annotationsChanged();
      status.textContent='Preparing landscape…';
      diagnosticReport.textContent=diagnostics.enabled?'Preparing map analysis…':'Analysis runs only on request, then refreshes on map load.';
      try {
        await this.prepare({map:mapId,seed:value,content:'landscape',hour:selectedHour,dpr:Math.min(devicePixelRatio||1,1.6),
          camera:{mode:'game',fit:'map'},render:{distanceMist:mist.checked,mapBoundary:boundary.checked,caches:false}});
        if (diagnostics.enabled) analyze();
        clock.value=String(Math.round((this.renderer.battlefieldHour ?? 0)*60)%1440); showTime();
        const url=new URL(location.href); url.searchParams.set('map',mapId);url.searchParams.set('seed',String(value));
        try { history.replaceState(null,'',url); } catch { /* file:// history is browser dependent */ }
        const size=this.game.world!.extent*2;
        status.textContent=`${mapId} · seed ${value} · map size ${size} × ${size} world units · drag/pinch to navigate`;
      } catch (e) {
        status.textContent=e instanceof Error ? e.message : String(e);
        diagnosticReport.textContent='No analysis available for this load.';
      }
      finally {
        controls.forEach(b=>b.disabled=false);
        reportButton.disabled=!diagnostics.data;layerControls.forEach(c=>c.disabled=!diagnostics.data);
      }
    };
    map.value=params.get('map') ?? 'desert'; seed.value=params.get('seed') ?? '1409';
    form.onsubmit=e=>{e.preventDefault();void load();};
    panel.querySelector<HTMLButtonElement>('[data-viewer="random"]')!.onclick=()=>{
      const n=new Uint32Array(1); crypto.getRandomValues(n); seed.value=String(n[0]%99999999+1); void load();
    };
    const action = (work:()=>Promise<unknown>)=>{void work().catch(e=>status.textContent=String(e));};
    panel.querySelector<HTMLButtonElement>('[data-viewer="fit"]')!.onclick=()=>action(()=>this.apply({camera:{mode:'game',fit:'map',yaw:this.game.s?.cam.yaw ?? 0}}));
    panel.querySelector<HTMLButtonElement>('[data-viewer="reset"]')!.onclick=()=>action(()=>this.apply({camera:{mode:'game',fit:'map',yaw:0}}));
    mist.onchange=()=>action(()=>this.apply({render:{distanceMist:mist.checked}}));
    boundary.onchange=()=>action(()=>this.apply({render:{mapBoundary:boundary.checked}}));
    clock.oninput=()=>{
      if (this.busy || !this.readyToDraw) return;
      showTime(); selectedHour=Number(clock.value)/60;
      action(()=>this.apply({hour:selectedHour}));
    };
    panel.querySelector<HTMLButtonElement>('[data-viewer="hide"]')!.onclick=()=>{panel.hidden=true;show.hidden=false;};
    reportButton.onclick=()=>{
      try {
        const report=this.exportMapDiagnostics(),blob=new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}),
          url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=`${report.map}-${report.seed}-diagnostics.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      } catch(e) {diagnosticReport.textContent=String(e);}
    };
    panel.querySelector<HTMLButtonElement>('[data-viewer="export"]')!.onclick=()=>{
      try {
        const blob=new Blob([JSON.stringify(this.exportScene(),null,2)+'\n'],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a');
        a.href=url; a.download=`${this.game.s!.map}-${this.game.s!.seed}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      } catch(e) {status.textContent=String(e);}
    };
    return load();
  }
}
