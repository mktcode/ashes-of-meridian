/* GPU adapter for CPU-generated world data, plus entity models. */
'use strict';

class BattlefieldView {
  R: MeridianRenderer;
  data: WorldRenderData | null;
  world: Battlefield | null;
  fogVersion: number;
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
      R.battlefieldProfile = world.definition.render;
      R.haze = R.battlefieldProfile.haze;
      R.extent = EXTENT;
      R.decorSeed = world.seed >>> 0;
      const data: number[] = [];
      let i = 0;
      for (let z = 0; z < GRID; z++)
        for (let x = 0; x < GRID; x++) {
          const wx = x * CELL - EXTENT, wz = z * CELL - EXTENT;
          geom.tri(data, [wx, -0.13, wz], [wx, -0.13, wz + CELL],
            [wx + CELL, -0.13, wz + CELL], layout.groundColors[i++], [0, 1, 0]);
          geom.tri(data, [wx, -0.13, wz], [wx + CELL, -0.13, wz + CELL],
            [wx + CELL, -0.13, wz], layout.groundColors[i++], [0, 1, 0]);
        }
      R.geometry('terrain', data);
      for (const descriptor of layout.geometries)
        R.geometry(descriptor.mesh, TerrainModels.geometry(descriptor));
      for (const p of layout.placements) {
        const args: Parameters<MeridianRenderer['add']> = [p.mesh, ...p.position, ...p.scale, p.color, ...p.rotation,
          p.glow, p.alpha, p.layer];
        if (p.material !== undefined) args.push(MAT[p.material]);
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
}

// Placement ghosts are visual objects, never spawned simulation entities.
function createBuildingPreview(type: BuildingType, p: Position, faction: FactionId): RenderEntity {
  return { id: 0, kind: 'building', type, x: p.x, z: p.z, rot: 0, faction, team: 0,
    hp: 1, maxHp: 1, progress: 1, size: BUILDINGS[type].size, queue: [] };
}

    // Cosmetic building yaw only; placement, collision radii and save data stay unchanged.
    function renderEntity(R: MeridianRenderer, e: RenderEntity, time: number, options: RenderEntityOptions = {}) {
      if (e.hp <= 0) return;
      const f = FACTIONS[e.faction || FACTION_ID.FIRST],
        enemy = e.team === 1;
      let team = enemy ? 0xe98680 : f.color,
        accent = enemy ? 0xffaf87 : f.accent;
      let metal: number = f.metal,
        dark: number = f.dark;
      const rot = e.kind === 'building' ? (enemy ? Math.PI : 0) + BUILDING_YAW : e.rot || 0,
        cs = Math.cos(rot),
        sn = Math.sin(rot);
      let y =
        e.type === 'air'
          ? 3.8 - (e.exit ? 3 * clamp(distance(e, e.exit) / e.exit.length, 0, 1) : 0) +
            Math.sin(time * 2 + e.id) * 0.22
          : e.faction === FACTION_ID.THIRD && e.kind === 'unit'
            ? 0.3 + Math.sin(time * 2 + e.id) * 0.08
            : 0;
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
        R.add(
          shape,
          e.x + lx * cs + lz * sn,
          y + ly * build,
          e.z - lx * sn + lz * cs,
          sx,
          sy * build,
          sz,
          c,
          rot + ry,
          rx,
          rz,
          animated && glow >= .3 ? glow * (1 + (e.faction === FACTION_ID.SECOND ? .22 : .12) *
            Math.sin(phase + (e.faction === FACTION_ID.THIRD ? ly * 3 - lz * 2 : lx * .7))) : glow,
          a,
          layer,
          m === PORTAL_MATERIAL && !animated ? PORTAL_STILL_MATERIAL : m
        );
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
              0.18 + rand() * 0.08,
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
              0.12,
              alpha,
              MAT.CRYSTAL
            );
          }
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
              0.6 + t * 3,
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
        R.add('plane', e.x, -.02, e.z, width, 1, width * (e.kind === 'building' ? 1 : .8),
          0xffffff, rot, 0, 0, 0, e.kind === 'building' ? .32 : e.type === 'air' ? .12 : .26,
          'effects', CONTACT_SHADOW_MATERIAL);
      }
      if (e.kind === 'building') {
        let s = e.size || 3;
        if (e.faction === FACTION_ID.SECOND) {
          // The queen sits in her model-owned five-petal flower, with no soil plinth.
          // Other Choir buildings retain the shared mound, including in build previews.
          if (e.type !== 'hq') p('choirMound', 0, 0, 0, s, 1, s, ghost ? 0x68717d : options.tint || 0x70523b,
            0, 0, 0, 0, alpha, options.material ?? MAT.ROCK);
        } else if (!(e.faction === FACTION_ID.THIRD && ['barracks','depot','factory'].includes(e.type))) {
          // Court portals and the accumulator own angular foundations, without a circular dais.
          p('hex', 0, 0.15, 0, s * 1.09, 0.3, s * 1.09, 0x384552, 0.12);
          p('ring', 0, 0.33, 0, s * 1.03, 0.1, s * 1.03, team, 0, 0, 0, 0.4);
        }
        const model = EntityModels.find(e);
        if (model) {
          model.render({ entity: e, time, part: p, ring, metal, dark, team, accent, baseRotation: rot,
            surfaceColor: color => ghost ? 0x68717d : options.tint || color });
        }
        if (build < 1) {
          for (let i = 0; i < 4; i++) {
            let a = (i * Math.PI) / 2 + 0.78;
            R.add(
              'box',
              e.x + Math.sin(a) * s,
              2,
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
        model.render({ entity: e, time, part: p, ring, metal, dark, team, accent, baseRotation: rot,
          surfaceColor: color => ghost ? 0x68717d : options.tint || color });
        return;
      }
      // Mobile units. Silhouettes and surface treatments differ for every civilization.
      let move = e.walk || 0,
        step = Math.sin(move * 7) * 0.23,
        ty = e.type;
      if (e.faction === FACTION_ID.SECOND) {
        let big = ['tank', 'artillery'].includes(ty),
          air = ty === 'air',
          scale = big ? 1.85 : ty === 'hero' ? 1.4 : 1;
        let legN = big ? 6 : 4;
        for (let i = 0; i < legN; i++) {
          let a = (i / legN) * 6.28;
          p(
            'cone',
            Math.sin(a) * scale * 0.8,
            0.45,
            Math.cos(a) * scale * 0.9,
            0.14,
            1.0,
            0.14,
            dark,
            a,
            step * 0.4,
            Math.sin(a) * 0.8
          );
        }
        p('sphere', 0, 1.0 * scale, 0, 0.65 * scale, 0.5 * scale, 1.0 * scale, metal);
        p('octa', 0, 1.35 * scale, -0.1, 0.56 * scale, 0.48 * scale, 0.87 * scale, dark, 0.2);
        p(
          'sphere',
          0,
          1.25 * scale,
          0.72 * scale,
          0.37 * scale,
          0.35 * scale,
          0.42 * scale,
          team,
          0,
          0,
          0,
          0.32
        );
        p(
          'cone',
          0,
          1.4 * scale,
          1.16 * scale,
          0.2 * scale,
          0.8 * scale,
          0.2 * scale,
          accent,
          0,
          1.1,
          0,
          0.45
        );
        for (let i = 0; i < 3; i++)
          p(
            'octa',
            (i - 1) * 0.35 * scale,
            1.75 * scale,
            -0.4,
            0.16,
            0.65,
            0.17,
            accent,
            0,
            0,
            (i - 1) * 0.4,
            0.35
          );
        if (ty === 'medic') {
          for (let i = 0; i < 3; i++) {
            let a = time * 1.4 + i * 2.1;
            p(
              'sphere',
              Math.sin(a) * 0.9,
              2.1 + Math.sin(a) * 0.2,
              Math.cos(a) * 0.9,
              0.18,
              0.18,
              0.18,
              0xd9eec1,
              0,
              0,
              0,
              1
            );
          }
        }
        if (air) {
          p('octa', -1.35, 1.2, 0, 1.6, 0.09, 1.15, accent, 0, 0, Math.sin(time * 8) * 0.15);
          p('octa', 1.35, 1.2, 0, 1.6, 0.09, 1.15, accent, 0, 0, -Math.sin(time * 8) * 0.15);
        }
        if (ty === 'artillery') p('sphere', 0, 2.0, -0.6, 1.15, 1.1, 1.15, accent, 0, 0, 0, 0.4);
        return;
      }
      if (e.faction === FACTION_ID.THIRD) {
        let big = ['tank', 'artillery'].includes(ty),
          scale = big ? 1.9 : ty === 'hero' ? 1.35 : 1,
          air = ty === 'air';
        p('octa', 0, 1.1 * scale, 0, 0.55 * scale, 1.1 * scale, 0.55 * scale, dark);
        p('cone', 0, 1.1 * scale, 0, 0.6 * scale, 1.7 * scale, 0.55 * scale, metal, 0, 0, Math.PI);
        p('octa', 0, 1.8 * scale, 0.12, 0.3 * scale, 0.42 * scale, 0.3 * scale, metal);
        p('box', 0, 1.83 * scale, 0.37 * scale, 0.34 * scale, 0.12, 0.08, team, 0, 0, 0, 1.2);
        p('octa', 0, 0.95 * scale, 0.45 * scale, 0.25, 0.5, 0.25, accent, time * 0.6, 0, 0, 0.9);
        for (let i of [-1, 1])
          p(
            'octa',
            i * 0.62 * scale,
            1.15 * scale,
            -0.15,
            0.2 * scale,
            1.05 * scale,
            0.3 * scale,
            metal,
            0,
            0,
            i * 0.22
          );
        if (big || air) {
          for (let i of [-1, 1]) {
            p('octa', i * 1.45, 1.05, 0, air ? 1.3 : 0.35, 0.22, 1.8, metal, 0, 0, i * 0.1);
            p('octa', i * 1.25, 1.25, 1.0, 0.18, 0.55, 0.4, team, 0, 0, 0, 0.8);
          }
        }
        if (ty === 'artillery') p('octa', 0, 2.6, 0, 0.32, 1.5, 0.32, accent, 0, 0.25, 0, 0.7);
        if (ty === 'medic')
          R.add('ring', e.x, 2.0, e.z, 0.9, 1, 0.9, accent, time, Math.PI / 2, 0, 1, 0.7, 'effects');
        return;
      }
    }
