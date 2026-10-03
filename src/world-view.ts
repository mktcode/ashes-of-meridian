/* GPU adapter for CPU-generated world data, plus entity models. */
'use strict';

// A viewport-owned, read-only batch: static rules are cached only for this footprint.
// Live blockers are indexed afresh, including production exits and unseen entities.
class PlacementGuideSampler {
  private terrain = new Map<string, boolean>();
  private buckets = new Map<string, Entity[]>();
  private unseen = new Set<Entity>();
  private vents: ResourceEntity[] = [];
  private occupiedVents = new Set<number>();
  private ready = false;
  private terrainBudget = 0;
  pending = false;
  private readonly world: Battlefield;
  private readonly size: number;
  constructor(private game: MeridianGame, private type: BuildingType, private team: PlayerTeam) {
    this.world = game.world!;
    this.size = BUILDINGS[type].size;
  }
  private key(p: Position) { return `${Math.floor(p.x / 10)},${Math.floor(p.z / 10)}`; }
  refresh(terrainBudget = 64) {
    this.terrainBudget = terrainBudget; this.pending = false;
    this.ready = !this.game.canBuild(this.type, null, this.team);
    this.buckets.clear(); this.unseen.clear(); this.vents = []; this.occupiedVents.clear();
    const add = (e: Entity, p: Position, radius: number) => {
      for (let z = Math.floor((p.z - radius) / 10); z <= Math.floor((p.z + radius) / 10); z++)
        for (let x = Math.floor((p.x - radius) / 10); x <= Math.floor((p.x + radius) / 10); x++) {
          const key = `${x},${z}`, bucket = this.buckets.get(key);
          if (!bucket) this.buckets.set(key, [e]);
          else if (bucket[bucket.length - 1] !== e) bucket.push(e);
        }
    };
    for (const e of this.game.s!.entities) {
      if (e.hp <= 0) continue;
      if (!this.game.observed(e)) this.unseen.add(e);
      const radius = this.size + (e.kind === 'unit' ? e.size * UNIT_BODY_SCALE + 1 : e.size + .8);
      add(e, e, radius);
      if (e.kind === 'unit' && e.exit) add(e, e.exit, radius);
      if (e.kind === 'resource' && e.type === 'gas' && this.world.sight[this.team].explored[this.world.idx(e.x, e.z)])
        this.vents.push(e);
      if (e.type === 'refinery' && e.gasId !== undefined) this.occupiedVents.add(e.gasId);
    }
  }
  sample(pos: Position): number {
    const world = this.world, r = this.size;
    if (Math.abs(pos.x) >= world.extent - 4 || Math.abs(pos.z) >= world.extent - 4 ||
        !world.sight[this.team].visible[world.idx(pos.x, pos.z)]) return 0;
    // Test the original sample before vent snapping, just like the visibility guard.
    if (this.buckets.get(this.key(pos))?.some(e => this.unseen.has(e) && buildingBlockerReason(pos, r, e))) return 0;
    if (!this.ready) return -1;
    const gas = this.type === 'refinery' ? nearestRefineryVent(pos, this.vents) : null;
    if (this.type === 'refinery' && !gas) return -1;
    const p = gas || pos, key = `${p.x}:${p.z}`;
    let terrain = this.terrain.get(key);
    if (terrain === undefined) {
      // Keep menu opening/camera movement responsive. Unknown samples are never shown as buildable.
      if (this.terrainBudget <= 0) { this.pending = true; return 0; }
      this.terrainBudget--;
      terrain = !buildingFoundationReason(world, this.type, p, this.team) && !buildingTerrainObstructed(world, p, r);
      this.terrain.set(key, terrain);
    }
    if (!terrain || !world.sight[this.team].explored[world.idx(p.x, p.z)] ||
        this.game.s!.supplyCaches.some(cache => !cache.collected && distance(p, cache) < r + 3) ||
        this.buckets.get(this.key(p))?.some(e => e !== gas && buildingBlockerReason(p, r, e)) ||
        (gas && this.occupiedVents.has(gas.id))) return -1;
    return 1;
  }
}

// Cinematic buildings obey the same ground restrictions as player foundations.
// Search only nearby; omitting a prop is preferable to a tower on an unsuitable hillside.
function cinematicBuildingPosition(world: Battlefield, preferred: Position, size: number,
    placed: readonly RenderEntity[]): Position | null {
  const offsets: Position[] = [];
  for (let z = -24; z <= 24; z += 2) for (let x = -24; x <= 24; x += 2)
    if (x*x + z*z <= 24*24) offsets.push({x,z});
  offsets.sort((a,b) => a.x*a.x + a.z*a.z - b.x*b.x - b.z*b.z || a.z-b.z || a.x-b.x);
  for (const offset of offsets) {
    const p = {x: preferred.x + offset.x, z: preferred.z + offset.z};
    if (!world.surface?.foundation(p, size)) continue;
    if (placed.some(e => e.kind === 'building' && Math.hypot(e.x-p.x, e.z-p.z) < (e.size || 1) + size + 2)) continue;
    const margin = size + 1, first = world.idx(p.x-margin, p.z-margin), last = world.idx(p.x+margin, p.z+margin);
    let blocked = false;
    for (let z = Math.floor(first / world.gridSize); z <= Math.floor(last / world.gridSize); z++)
      for (let x = first % world.gridSize; x <= last % world.gridSize; x++)
        if (world.staticGrid[z * world.gridSize + x]) blocked = true;
    if (!blocked) return p;
  }
  return null;
}

function buildingGroundFrame(pose: { dx: number; dz: number }, cs: number, sn: number): number[] | null {
  if (Math.hypot(pose.dx,pose.dz) < 1e-6) return null;
  const up = V.norm([-pose.dx,1,-pose.dz]), forward = V.norm([sn,pose.dx*sn+pose.dz*cs,cs]);
  return [...V.cross(up,forward),...up,...forward];
}

// Local visual grading, not a plinth: only the necessary fill, with zero height/gradient at the rim.
// The original terrain remains underneath; world-aligned triangles and material weights match it.
function buildingGroundGeometry(world: Battlefield, e: RenderEntity): { geometry: number[]; material: number } {
  const surface = world.surface!, pose = surface.buildingPose(e,e.size), inner = e.size * 1.18, outer = inner + 3,
    descriptor = world.renderData.geometries.find(d => d.mesh === 'terrain'),
    relief = descriptor && 'relief' in descriptor ? descriptor.relief : undefined,
    placement = world.renderData.placements.find(p => p.mesh === 'terrain'),
    material = placement?.material && placement.material !== 'ALIEN_LIGHT' ? MAT[placement.material] : MAT.GROUND,
    geometry: number[] = [], step = surface.step;
  const fill = (x: number,z: number) => {
    const radius = Math.pow((x-e.x)**8+(z-e.z)**8,1/8), t = clamp((radius-inner)/(outer-inner),0,1),
      fade = 1-t*t*t*(t*(t*6-15)+10),
      plane = pose.height+pose.dx*(x-e.x)+pose.dz*(z-e.z);
    // Never pour a foundation-sized fill down an unrelated cliff outside its footprint.
    return Math.max(0,Math.min(pose.fill,plane-surface.heightAt(x,z))) * fade;
  };
  const height = (x: number,z: number) => surface.heightAt(x,z)-.13+fill(x,z);
  const color = (x: number,z: number) => {
    if (!relief) return world.renderData.groundColors[world.idx(x,z)*2];
    if (!relief.colors) return [0,1,0];
    const gx = (x+relief.extent)/relief.step+1, gz = (z+relief.extent)/relief.step+1,
      col = clamp(Math.round(gx),0,relief.size-1), row = clamp(Math.round(gz),0,relief.size-1), i = (row*relief.size+col)*3;
    return Array.from(relief.colors.slice(i,i+3));
  };
  const vertex = (x: number,z: number) => [x,height(x,z),z],
    normal = (x: number,z: number) => V.norm([height(x-step,z)-height(x+step,z),2*step,height(x,z-step)-height(x,z+step)]),
    start = (v: number) => Math.floor((v-outer+surface.extent)/step)*step-surface.extent;
  // Same grid and diagonals as the terrain. Colors are weights, not a generic brown tint.
  for (let z = start(e.z); z < e.z+outer; z += step) for (let x = start(e.x); x < e.x+outer; x += step) {
    if (Math.max(fill(x,z),fill(x+step,z),fill(x,z+step),fill(x+step,z+step)) < .002) continue;
    for (const [dx,dz] of [[0,0],[0,step],[step,step],[0,0],[step,step],[step,0]])
      geometry.push(...vertex(x+dx,z+dz),...normal(x+dx,z+dz),...color(x+dx,z+dz));
  }
  return {geometry,material};
}

class BattlefieldView {
  R: MeridianRenderer;
  data: WorldRenderData | null;
  world: Battlefield | null;
  fogVersion: number;
  private worldMeshes = new Set<string>();
  private buildingGround = new Map<number, { key: string; mesh: string; material: number }>();
  constructor(renderer: MeridianRenderer) {
    this.R = renderer;
    this.data = null;
    this.world = null;
    this.fogVersion = -1;
  }
  sync(world: Battlefield, fogOn = true) {
    const R = this.R, layout = world.renderData,
      { extent: EXTENT, cellSize: CELL, gridSize: GRID } = world;
    if (this.data !== layout) {
      R.clearStatic();
      for (const patch of this.buildingGround.values()) if (patch.mesh) this.releaseBuildingGround(patch.mesh);
      this.buildingGround.clear();
      // Own only meshes generated by this view, never shared model primitives.
      // Same-name replacements are released by geometry() before their upload.
      const nextMeshes = new Set(['terrain', ...layout.geometries.map(descriptor => descriptor.mesh)]);
      for (const name of this.worldMeshes) if (!nextMeshes.has(name)) R.releaseGeometry(name);
      this.worldMeshes = nextMeshes;
      R.detailMeshes = new Set(layout.geometries.filter(d => d.detail).map(d => d.mesh));
      R.setBattlefieldProfile(world.renderProfile, world.definition.design?.atmosphere?.materialSeed ?? world.seed);
      R.extent = EXTENT;
      R.decorSeed = world.terrainSeed >>> 0;
      R.surface = world.surface;
      // An authoritative recipe can supply its own ground skin, including material
      // weights and decorative river beds underneath the one walkable bridge surface.
      if (!layout.geometries.some(descriptor => descriptor.mesh === 'terrain')) {
      const data: number[] = [];
      let i = 0;
      if (world.surface) {
        const surface = world.surface, step = surface.step;
        for (let z = 0; z < surface.size-1; z++) for (let x = 0; x < surface.size-1; x++) {
          const wx = x*step-EXTENT, wz = z*step-EXTENT,
            at = (dx: number,dz: number) => [wx+dx, surface.heightAt(wx+dx,wz+dz)-.13, wz+dz],
            color = layout.groundColors[world.idx(wx+step*.5,wz+step*.5)*2];
          geom.tri(data,at(0,0),at(0,step),at(step,step),color);
          geom.tri(data,at(0,0),at(step,step),at(step,0),color);
        }
        // Close raised deck edges against the low exterior apron, without a second floor.
        const corners = [[-EXTENT,-EXTENT],[EXTENT,-EXTENT],[EXTENT,EXTENT],[-EXTENT,EXTENT]];
        for (let side = 0; side < 4; side++) for (let j = 0; j < surface.size-1; j++) {
          const from = corners[side], to = corners[(side+1)%4],
            point = (t: number) => [from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t],
            p = point(j/(surface.size-1)), q = point((j+1)/(surface.size-1)),
            a = [p[0],surface.heightAt(p[0],p[1])-.13,p[1]], b = [q[0],surface.heightAt(q[0],q[1])-.13,q[1]],
            lowA = [p[0],-.13,p[1]], lowB = [q[0],-.13,q[1]];
          if (b[1] > -.13) geom.tri(data,a,b,lowB,[.5,.58,.64]);
          if (a[1] > -.13) geom.tri(data,a,lowB,lowA,[.5,.58,.64]);
        }
      } else for (let z = 0; z < GRID; z++)
        for (let x = 0; x < GRID; x++) {
          const wx = x * CELL - EXTENT, wz = z * CELL - EXTENT;
          geom.tri(data, [wx, -0.13, wz], [wx, -0.13, wz + CELL],
            [wx + CELL, -0.13, wz + CELL], layout.groundColors[i++], [0, 1, 0]);
          geom.tri(data, [wx, -0.13, wz], [wx + CELL, -0.13, wz + CELL],
            [wx + CELL, -0.13, wz], layout.groundColors[i++], [0, 1, 0]);
        }
      R.geometry('terrain', data);
      }
      for (const descriptor of layout.geometries) {
        const geometry = TerrainModels.geometry(descriptor);
        if (descriptor.grounded && world.surface) {
          // Painted deck furniture is baked once; terrain remains CPU authoritative.
          for (let i = 0; i < geometry.length; i += 9)
            geometry[i+1] += world.surface.heightAt(geometry[i],geometry[i+2]);
        }
        R.geometry(descriptor.mesh, geometry);
      }
      for (const p of layout.placements) {
        const args: Parameters<MeridianRenderer['add']> = [p.mesh, ...p.position, ...p.scale, p.color, ...p.rotation,
          p.glow, p.alpha, p.layer];
        if (p.material !== undefined) args.push(p.material === 'ALIEN_LIGHT' ? ALIEN_LIGHT_MATERIAL : MAT[p.material]);
        R.add(...args);
      }
      this.data = layout;
    }
    if (this.world !== world || this.fogVersion !== world.fogVersion || (fogOn && !R.fogOn)) {
      if (world.fogVersion > 0 || fogOn) R.fog(world.fogPixels, GRID);
      this.world = world;
      this.fogVersion = world.fogVersion;
    }
    R.fogOn = fogOn;
  }
  private releaseBuildingGround(mesh: string) {
    this.R.releaseGeometry(mesh);
    for (const [key,bucket] of Object.entries(this.R.dynamic)) if (bucket.source === mesh) {
      this.R.gl.deleteBuffer(bucket.buffer); delete this.R.dynamic[key];
    }
  }
  retainBuildingGround(entities: readonly RenderEntity[]) {
    const ids = new Set(entities.filter(e => e.kind === 'building' && e.hp > 0).map(e => e.id));
    for (const [id, patch] of this.buildingGround) if (!ids.has(id)) {
      if (patch.mesh) this.releaseBuildingGround(patch.mesh);
      this.buildingGround.delete(id);
    }
  }
  drawBuildingGround(e: RenderEntity) {
    if (!this.world?.surface || e.kind !== 'building' || e.hp <= 0) return;
    const key = `${e.x}:${e.z}:${e.size}`, old = this.buildingGround.get(e.id);
    if (old && old.key !== key) {
      if (old.mesh) this.releaseBuildingGround(old.mesh);
      this.buildingGround.delete(e.id);
    }
    if (!this.buildingGround.has(e.id)) {
      const patch = buildingGroundGeometry(this.world,e), mesh = `buildingGround:${e.id}`;
      if (patch.geometry.length) {
        this.R.geometry(mesh,patch.geometry);
        // One instance per patch, not the large shared-model bucket reserve.
        this.R.bucket(this.R.dynamic,mesh,mesh,mesh,1);
      }
      this.buildingGround.set(e.id,{key,mesh:patch.geometry.length ? mesh : '',material:patch.material});
    }
    const patch = this.buildingGround.get(e.id)!;
    if (patch.mesh) this.R.add(patch.mesh,0,0,0,1,1,1,0xffffff,0,0,0,0,1,'dynamic',patch.material);
  }
}

// Placement ghosts are visual objects, never spawned simulation entities.
function createBuildingPreview(type: BuildingType, p: Position, faction: FactionId, team: PlayerTeam = 0): RenderEntity {
  return { id: 0, kind: 'building', type, x: p.x, z: p.z, rot: 0, faction, team,
    hp: 1, maxHp: 1, progress: 1, size: BUILDINGS[type].size, queue: [] };
}

// View-only rigid chassis frame. Four footprint samples smooth triangle/ramp joins without
// history, extra RNG or changes to the authoritative pose. Infantry stays upright.
function vehicleGroundFrame(surface: BattlefieldSurface | null, e: RenderEntity, cs: number, sn: number): number[] | null {
  if (!surface || e.kind !== 'unit' || (e.type !== 'worker' && e.type !== 'tank' && e.type !== 'artillery')) return null;
  const r = Math.max(.75, e.size),
    dx = (surface.heightAt(e.x+r,e.z)-surface.heightAt(e.x-r,e.z))/(2*r),
    dz = (surface.heightAt(e.x,e.z+r)-surface.heightAt(e.x,e.z-r))/(2*r);
  if (Math.hypot(dx,dz) < 1e-6) return null;
  // A neighbouring cliff must not tip the chassis beyond the walkable slope envelope.
  const limit = Math.max(1,Math.hypot(dx,dz)/.65), gx = dx/limit, gz = dz/limit,
    up = V.norm([-gx,1,-gz]), forward = V.norm([sn,gx*sn+gz*cs,cs]), right = V.cross(up,forward);
  // Column-major orthonormal basis: retain the heading's horizontal projection.
  return [...right,...up,...forward];
}

// Compose the chassis with each part's existing Y * X * Z rotation, not Euler sums.
// This keeps drills, cargo, limbs and weapons attached even on diagonal slopes.
function modelFrameRotation(f: readonly number[], ry: number, rx: number, rz: number): [number, number, number] {
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz),
    xx = cy*cz+sy*sx*sz, xy = cx*sz, xz = -sy*cz+cy*sx*sz,
    yx = -cy*sz+sy*sx*cz, yy = cx*cz, yz = sy*sz+cy*sx*cz,
    zx = sy*cx, zy = -sx, zz = cy*cx,
    z0 = f[0]*zx+f[3]*zy+f[6]*zz, z1 = f[1]*zx+f[4]*zy+f[7]*zz, z2 = f[2]*zx+f[5]*zy+f[8]*zz,
    pitch = Math.asin(clamp(-z1,-1,1));
  if (Math.abs(z1) < 1-1e-10) return [Math.atan2(z0,z2),pitch,
    Math.atan2(f[1]*xx+f[4]*xy+f[7]*xz,f[1]*yx+f[4]*yy+f[7]*yz)];
  // At vertical part pitch, yaw and roll share one axis; choose an equivalent zero roll.
  return [Math.atan2(-(f[2]*xx+f[5]*xy+f[8]*xz),f[0]*xx+f[3]*xy+f[6]*xz),pitch,0];
}

    // Lights fade on at 18–19h and off at 5–6h using the world's simulation-bound clock.
    function workerNightLight(hour: number | undefined): number {
      if (hour === undefined) return 0;
      const t = clamp(hour >= 12 ? hour - 18 : 6 - hour, 0, 1);
      return t * t * (3 - 2 * t);
    }

    // Distinct fixed assemblies, not scaled versions of one box. All fit inside
    // the existing reserved cache footprint; rotations are cosmetic and RNG-free.
    const SUPPLY_CACHE_ASSEMBLIES: Record<SupplyCache['tier'], readonly (readonly [number, number, number, number])[]> = {
      1: [[0,0,0,.12]],
      2: [[-.82,0,0,0],[.82,0,0,0],[0,1.42,0,0]],
      3: [[-.82,0,.66,0],[.82,0,.66,0],[-.82,0,-.66,0],[.82,0,-.66,0],
        [-.82,1.42,0,0],[.82,1.42,0,0],[.1,0,-1.95,-.28]]
    };
    function renderSupplyCache(R: MeridianRenderer, world: Battlefield, cache: SupplyCache) {
      const echo = cache.resource === 'gas', accent = echo ? 0x65e5e9 : 0xf1ae45,
        shell = echo ? 0x385568 : 0x6b6153, dark = 0x222d38, edge = 0x89969e,
        assembly = SUPPLY_CACHE_ASSEMBLIES[cache.tier];
      // Upper boxes rest on the highest supporting lower lid, not a fresh ground sample.
      const stackGround = Math.max(...assembly.filter(p => p[1] === 0 && p[2] > -1.5)
        .map(p => world.surface!.heightAt(cache.x+p[0],cache.z+p[2])));
      for (const [lx, ly, lz, yaw] of assembly) {
        const x = cache.x + lx, z = cache.z + lz,
          y = (ly ? stackGround : world.surface!.heightAt(x,z)) + ly,
          cs = Math.cos(yaw), sn = Math.sin(yaw);
        const part = (shape: string, dx: number, dy: number, dz: number, sx: number, sy: number, sz: number,
          color: number, glow = 0, rz = 0, rx = 0) => R.add(shape,
            x+dx*cs+dz*sn,y+dy,z-dx*sn+dz*cs,sx,sy,sz,color,yaw,rx,rz,glow,1,'dynamic',MAT.METAL);
        // Chamfered pressure shell, dark gasket, two inset lid panels and stacking feet.
        part('supplyCrateHull',0,.71,0,1.5,1.12,1.16,shell);
        part('supplyCrateHull',0,.17,0,1.62,.24,1.28,dark);
        part('supplyCrateHull',0,1.27,0,1.62,.2,1.28,edge);
        part('box',0,1.38,0,1.33,.025,1.04,dark);
        for (const side of [-1,1]) {
          part('supplyCrateHull',side*.34,1.4,0,.58,.035,.96,shell);
          part('box',side*.52,.74,0,.115,1.15,1.23,dark);
          part('box',side*.52,1.44,0,.115,.055,1.18,accent);
          // Recessed carry handles and end vents are readable from the sides.
          part('box',side*.755,.88,0,.035,.35,.67,dark);
          part('box',side*.80,.98,0,.065,.07,.48,edge);
          for (const zz of [-.22,.22]) part('box',side*.80,.88,zz,.065,.2,.065,edge);
          for (let j = 0; j < 3; j++) part('box',side*.776,.45,j*.15-.15,.04,.045,.09,edge);
          for (const front of [-1,1]) {
            part('supplyCrateHull',side*.66,.72,front*.5,.2,1.12,.22,edge);
            part('box',side*.52,.83,front*.64,.22,.27,.075,edge);
            part('box',side*.52,.85,front*.688,.09,.12,.025,dark);
            part('hex',side*.66,1.293,front*.5,.055,.025,.055,dark);
          }
        }
        // Cargo badge, recessed label panel and short bright status bar on each face.
        for (const front of [-1,1]) {
          part('box',0,.72,front*.592,.72,.53,.025,dark);
          part('box',.21,.9,front*.613,.19,.035,.015,accent,.45);
          for (let j = 0; j < 3; j++) part('box',.15+j*.065,.55,front*.613,.027,.08,.015,edge);
          if (echo) {
            part('box',-.16,.75,front*.623,.2,.2,.03,accent,.45,Math.PI/4);
            part('box',-.16,.75,front*.643,.085,.085,.012,dark,0,Math.PI/4);
          } else {
            part('box',-.21,.75,front*.622,.09,.28,.02,accent,.2,-.55);
            part('box',-.06,.75,front*.622,.09,.28,.02,accent,.2,.55);
          }
        }
      }
    }

    // Cosmetic building yaw only; placement, collision radii and save data stay unchanged.
    function renderEntity(R: MeridianRenderer, e: RenderEntity, time: number, options: RenderEntityOptions = {}) {
      if (e.hp <= 0) return;
      const f = FACTIONS[e.faction || FACTION_ID.FIRST],
        enemy = e.team !== -1 && e.team !== (options.localTeam ?? 0);
      let team = enemy ? 0xe98680 : f.color,
        accent = enemy ? 0xffaf87 : f.accent;
      let metal: number = f.metal,
        dark: number = f.dark;
      // Building orientation belongs to the world, not the observing party.
      const rot = e.kind === 'building' ? (e.team === 1 ? Math.PI : 0) + BUILDING_YAW : e.rot || 0,
        cs = Math.cos(rot),
        sn = Math.sin(rot);
      const ground = R.surface?.entityHeight(e) ??
          (isFlyingUnitType(e.type) ? -3 * flightLaunchRemaining(e) : 0),
        frame = e.kind === 'building' && R.surface
          ? buildingGroundFrame(R.surface.buildingPose(e,e.size),cs,sn)
          : vehicleGroundFrame(R.surface, e, cs, sn);
      let y = ground + (
        isFlyingUnitType(e.type)
          ? 3.8 + Math.sin(time * 2 + e.id) * 0.22
          : e.faction === FACTION_ID.THIRD && e.kind === 'unit'
            ? 0.3 + Math.sin(time * 2 + e.id) * 0.08
            : 0);
      let layer = options.layer || 'dynamic',
        alpha = options.alpha === undefined ? 1 : options.alpha;
      let build = e.kind === 'building' ? Math.max(0.15, e.progress === undefined ? 1 : e.progress) : 1;
      if (options.tint) {
        metal = team = options.tint;
        dark = options.tint;
      }
      let ghost = options.ghost;
      if (ghost) {
        metal = 0x68717d;
        dark = 0x3b424c;
      }
      let surfaceMat =
        options.material !== undefined
          ? options.material
          : e.kind === 'building' || e.kind === 'unit'
            ? e.faction === FACTION_ID.SECOND
              ? MAT.BIO
              : MAT.METAL
            : MAT.AUTO;
      // Only model lamps/cores breathe; keep low glow below the shader's texture cutoff.
      // Tactical rings and previews stay unchanged.
      const occlusion = options.occlusion && !R.cinema && !ghost && options.tint === undefined && alpha === 1 && layer === 'dynamic',
        occlusionColor = e.kind === 'resource' ? e.type === 'gas' ? 0x65e5e9 : 0xe7b969 : team;
      const nightLight = !R.cinema && !ghost && !options.tint && alpha === 1 && layer === 'dynamic' && build === 1
        ? workerNightLight(R.battlefieldHour) : 0;
      const animated = (e.kind === 'unit' || e.kind === 'building') && R.quality > 0 && !R.cinema && !ghost && !options.tint && alpha === 1 && layer === 'dynamic';
      const phase = time * (e.faction === FACTION_ID.SECOND ? 1.8 : 1.1) + e.id * 2.39996;
      const p: ModelPart = (
        shape,
        lx,
        ly,
        lz,
        sx,
        sy,
        sz,
        c,
        ry = 0,
        rx = 0,
        rz = 0,
        glow = 0,
        a = alpha,
        m = surfaceMat
      ) => {
        // Glowing Court prisms use the existing crystal shader instead of flat painted metal.
        // Explicit preview/material overrides retain authority over this model-level default.
        const resolvedMaterial = options.material === undefined && m === surfaceMat &&
          e.faction === FACTION_ID.THIRD && e.kind === 'building' && shape === 'octa' && glow >= .3
            ? MAT.CRYSTAL
            : m;
        const height = ly * build,
          px = frame ? e.x+frame[0]*lx+frame[3]*height+frame[6]*lz : e.x+lx*cs+lz*sn,
          py = frame ? y+frame[1]*lx+frame[4]*height+frame[7]*lz : y+height,
          pz = frame ? e.z+frame[2]*lx+frame[5]*height+frame[8]*lz : e.z-lx*sn+lz*cs;
        if (frame) [ry,rx,rz] = modelFrameRotation(frame,ry,rx,rz);
        else ry += rot;
        R.add(
          shape,
          px,
          py,
          pz,
          sx,
          sy * build,
          sz,
          c,
          ry,
          rx,
          rz,
          animated && glow >= .3 ? glow * (1 + (e.faction === FACTION_ID.SECOND ? .22 : .12) *
            Math.sin(phase + (e.faction === FACTION_ID.THIRD ? ly * 3 - lz * 2 : lx * .7))) : glow,
          a,
          layer,
          resolvedMaterial === PORTAL_MATERIAL && !animated ? PORTAL_STILL_MATERIAL : resolvedMaterial
        );
        if (occlusion && a === 1) R.recordOcclusion(shape, occlusionColor);
      };
      const ring: ModelRing = (radius, h, color = team, a = 0.7, rx = 0, ry = 0, glow = 1.2) =>
        R.add('ring', e.x, y + h, e.z, radius, 1, radius, color, ry, rx, 0, glow, a, 'effects');
      if (e.kind === 'resource') {
        if (e.type === 'crystal') {
          // Cosmetic RNG only: stable per deposit, independent of time, saves and mining RNG.
          const rand = seeded(Math.imul(e.id || 0, 0x45d9f3b) ^ 0x61c88647),
            scale = 0.55 + 0.45 * Math.min(1, Math.max(0, e.amount ?? 1800) / 1800);
          const phase = rand() * Math.PI * 2,
            count = 9 + Math.floor(rand() * 4),
            colors = [0xe7b969, 0xdba14c, 0xf0ca80, 0xc89149];
          p('rockShelf', 0, -0.06, 0, 1.72, 0.65, 1.48, 0x65605a, phase, 0, 0, 0, alpha, MAT.ROCK);
          for (let i = 0; i < count; i++) {
            let a = phase + i * 2.39996 + (rand() - 0.5) * 0.35,
              r = i < 3 ? 0.2 + rand() * 0.28 : 0.7 + rand() * 0.35;
            let h =
                (i === 0 ? 2.8 + rand() * 0.4 : i < 3 ? 1.8 + rand() * 0.7 : 0.65 + rand() * 0.95) *
                scale,
              w = (i < 3 ? 0.34 + rand() * 0.12 : 0.15 + rand() * 0.16) * (0.75 + 0.25 * scale);
            let lean = i < 3 ? 0.04 + rand() * 0.09 : 0.12 + rand() * 0.23,
              c = colors[Math.floor(rand() * colors.length)];
            p(
              'alloyShard',
              Math.sin(a) * r,
              0.12,
              Math.cos(a) * r,
              w,
              h,
              w * (i % 3 === 0 ? 0.58 : 0.82),
              c,
              a,
              lean * Math.cos(a),
              -lean * Math.sin(a),
              // Alloy remains a strong emissive source under every map profile; higher qualities add bloom.
              1.8 + rand() * 0.3,
              alpha,
              MAT.CRYSTAL
            );
          }
          for (let i = 0; i < 3; i++) {
            let a = phase + i * 2.1,
              r = 1.12 + rand() * 0.2,
              w = 0.13 + rand() * 0.08;
            p(
              'alloyShard',
              Math.sin(a) * r,
              0.04,
              Math.cos(a) * r,
              w,
              (0.18 + rand() * 0.23) * scale,
              w * 0.65,
              colors[i],
              a,
              0.45,
              0.25,
              1.4,
              alpha,
              MAT.CRYSTAL
            );
          }
          // A procedural pool conveys the deposit's warm light on the surrounding terrain.
          R.add('plane', e.x, ground + 0.025, e.z, 7, 1, 7, 0xffb84f, 0, 0, 0, 0, alpha,
            'effects', ALLOY_LIGHT_MATERIAL);
        } else {
          p('aetherVent', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0, 0, alpha, MAT.METAL);
          p('ring', 0, 0.465, 0, 1.69, 1, 1.521, 0x65e5e9, 0, 0, 0, 0.85, alpha, MAT.CRYSTAL);
          p('ring', 0, 0.985, 0, 0.36, 1, 0.324, 0x65e5e9, 0, 0, 0, 0.65, alpha, MAT.CRYSTAL);
          p('octa', 0, 1.64, 0, 0.43, 0.62, 0.43, 0x50dce6, time * 0.15, 0, 0, 0.45, alpha, MAT.CRYSTAL);
          for (let i = 0; i < 3; i++) {
            let t = (time * 0.35 + i * 0.33) % 1;
            R.add(
              'sphere',
              e.x + Math.sin(time + i) * 0.3,
              ground + 0.6 + t * 3,
              e.z,
              0.35 + t * 0.8,
              0.4 + t * 0.6,
              0.35 + t * 0.8,
              0x88ddd3,
              0,
              0,
              0,
              0.5,
              (1 - t) * 0.12,
              'effects'
            );
          }
        }
        return;
      }
      // Two triangles per visible entity, batched with effects; never a shadow caster.
      // Exclude menus, placement previews and Performance. No RNG, textures or model changes.
      if (R.quality > 0 && !R.cinema && !ghost && !options.tint && alpha === 1 && layer === 'dynamic') {
        const width = (e.size || 1) * (e.kind === 'building' ? 3.2 : 3.6);
        R.add('plane', e.x, (R.surface?.heightAt(e.x,e.z) ?? 0) - .02, e.z, width, 1, width * (e.kind === 'building' ? 1 : .8),
          0xffffff, rot, 0, 0, 0, e.kind === 'building' ? .32 : isFlyingUnitType(e.type) ? .12 : .26,
          'effects', CONTACT_SHADOW_MATERIAL);
      }
      if (e.kind === 'building') {
        let s = e.size || 3;
        if (e.faction === FACTION_ID.SECOND) {
          // The queen sits in her model-owned five-petal flower, with no soil plinth.
          // Other Choir buildings retain the shared mound, including in build previews.
          if (e.type !== 'hq') p('choirMound', 0, 0, 0, s, 1, s, ghost ? 0x68717d : options.tint || 0x70523b,
            0, 0, 0, 0, alpha, options.material ?? MAT.ROCK);
        } else if (!(e.faction === FACTION_ID.THIRD && ['barracks','depot','factory','hangar','hq','turret'].includes(e.type))) {
          // Court structures with bespoke silhouettes own angular foundations, without a circular dais.
          p('hex', 0, 0.15, 0, s * 1.09, 0.3, s * 1.09, 0x384552, 0.12);
          p('ring', 0, 0.33, 0, s * 1.03, 0.1, s * 1.03, team, 0, 0, 0, 0.4);
        }
        const model = EntityModels.find(e);
        if (model) {
          model.render({ entity: e, time, nightLight, lightPool: () => {}, part: p, ring, metal, dark, team, accent, baseRotation: rot,
            surfaceColor: color => ghost ? 0x68717d : options.tint || color });
        }
        if (build < 1) {
          for (let i = 0; i < 4; i++) {
            let a = (i * Math.PI) / 2 + 0.78;
            R.add(
              'box',
              e.x + Math.sin(a) * s,
              ground + 2,
              e.z + Math.cos(a) * s,
              0.1,
              4,
              0.1,
              team,
              0,
              0,
              0,
              0.4,
              0.65,
              'effects'
            );
          }
          ring(s * 1.25, 0.13, team, 0.7);
        }
        return;
      }
      const model = EntityModels.find(e);
      if (model) {
        const lightPool: EntityModelContext['lightPool'] = (lx,lz,width,length,color,strength) => {
          if (nightLight <= 0 || R.quality === 0) return;
          const x = e.x+lx*cs+lz*sn, z = e.z-lx*sn+lz*cs,
            height = R.surface?.heightAt(x,z) ?? ground;
          // Fit at the light's footprint, not the chassis: ordinary slopes must not
          // trigger the cliff guard. Test residuals against the tilted plane itself.
          const surface = R.surface, radius = .75,
            dx = surface ? (surface.heightAt(x+radius,z)-surface.heightAt(x-radius,z))/(2*radius) : 0,
            dz = surface ? (surface.heightAt(x,z+radius)-surface.heightAt(x,z-radius))/(2*radius) : 0,
            poolFrame = buildingGroundFrame({dx,dz},cs,sn);
          let lift = 0;
          if (surface) for (const u of [-width/2,0,width/2]) for (const v of [-length/2,0,length/2]) {
            const px = poolFrame ? poolFrame[0]*u+poolFrame[6]*v : u*cs+v*sn,
              pz = poolFrame ? poolFrame[2]*u+poolFrame[8]*v : -u*sn+v*cs,
              py = poolFrame ? poolFrame[1]*u+poolFrame[7]*v : 0,
              residual = surface.heightAt(x+px,z+pz)-height-py;
            // Still omit pools across sharp edges; bounded lift avoids terrain clipping
            // on small triangle/ramp joins without creating a floating cliff bridge.
            if (Math.abs(residual) > .16) return;
            lift = Math.max(lift,residual);
          }
          const [ry,rx,rz] = poolFrame ? modelFrameRotation(poolFrame,0,0,0) : [rot,0,0];
          R.add('plane',x,height+lift+.025,z,width,1,length,color,ry,rx,rz,0,strength,
            'effects',ALLOY_LIGHT_MATERIAL);
        };
        model.render({ entity: e, time, nightLight, lightPool, part: p, ring, metal, dark, team, accent, baseRotation: rot,
          surfaceColor: color => ghost ? 0x68717d : options.tint || color });
        return;
      }
    }
