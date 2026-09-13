/* GPU adapter for CPU-generated world data, plus entity models. */
'use strict';

class BattlefieldView {
  constructor(renderer) {
    this.R = renderer;
    this.data = null;
    this.world = null;
    this.fogVersion = -1;
  }
  sync(world, fogOn = true) {
    const R = this.R, layout = world.renderData;
    if (this.data !== layout) {
      R.clearStatic();
      R.haze = world.biome.haze;
      R.extent = EXTENT;
      R.decorSeed = world.seed >>> 0;
      const data = [];
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
      R.geometry('mountainRing', geom.mountainRing(world.seed));
      layout.massifs.forEach((massif, i) => R.geometry(`massif${i}`, geom.massif(massif)));
      for (const p of layout.placements) {
        const args = [p.mesh, ...p.position, ...p.scale, p.color, ...p.rotation,
          p.glow, p.alpha, p.layer];
        if (p.material !== undefined) args.push(MAT[p.material]);
        R.add(...args);
      }
      this.data = layout;
    }
    if (this.world !== world || this.fogVersion !== world.fogVersion) {
      if (world.fogVersion > 0) R.fog(world.fogPixels);
      this.world = world;
      this.fogVersion = world.fogVersion;
    }
    R.fogOn = fogOn;
  }
}

    // Cosmetic building yaw only; placement, collision radii and save data stay unchanged.
    function renderEntity(R, e, time, options = {}) {
      if (e.hp <= 0) return;
      const f = FACTIONS[e.faction || FACTION_ID.FIRST],
        enemy = e.team === 1;
      let team = enemy ? 0xe98680 : f.color,
        accent = enemy ? 0xffaf87 : f.accent;
      let metal = f.metal,
        dark = f.dark;
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
      const p = (
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
          glow,
          a,
          layer,
          m
        );
      };
      const ring = (radius, h, color = team, a = 0.7, rx = 0, ry = 0, glow = 1.2) =>
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
      if (e.kind === 'building') {
        let s = e.size || 3;
        p('hex', 0, 0.15, 0, s * 1.09, 0.3, s * 1.09, 0x384552, 0.12);
        p('ring', 0, 0.33, 0, s * 1.03, 0.1, s * 1.03, team, 0, 0, 0, 0.4);
        const model = EntityModels.find(e);
        if (model) {
          model.render({ entity: e, time, part: p, ring, metal, dark, team, accent, baseRotation: rot });
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
        model.render({ entity: e, time, part: p, ring, metal, dark, team, accent });
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
      if (['rifle', 'hero', 'medic'].includes(ty)) {
        let h = ty === 'hero' ? 1.17 : 1,
          med = ty === 'medic',
          c = med ? 0xb9c3be : metal;
        for (let side of [-1, 1]) {
          p('box', side * 0.23, 0.35, side * step, 0.25, 0.65, 0.33, dark);
          p('box', side * 0.25, 0.13, side * step + 0.09, 0.32, 0.22, 0.48, dark);
        }
        p('box', 0, 1.0 * h, 0, 0.78 * h, 0.75 * h, 0.5 * h, c);
        p('box', 0, 1.16 * h, 0.28, 0.48, 0.26, 0.1, team, 0, 0, 0, 0.35);
        p('box', 0, 1.65 * h, 0.02, 0.45 * h, 0.43 * h, 0.43 * h, c);
        p('box', 0, 1.65 * h, 0.25, 0.43, 0.115, 0.08, med ? 0x84dfc1 : 0x8ce1e2, 0, 0, 0, 0.85);
        p('box', -0.5 * h, 1.32 * h, 0, 0.34, 0.35, 0.54, c);
        p('box', 0.5 * h, 1.32 * h, 0.08, 0.34, 0.35, 0.54, c);
        p('box', -0.48, 1.0, 0.27, 0.22, 0.47, 0.22, dark, -0.3, -0.5);
        p('box', 0.5, 1.09, 0.48, 0.25, 0.23, 0.85, dark);
        p('box', 0.5, 1.12, 0.98, 0.11, 0.11, 0.42, 0x9eaaa8);
        p('box', 0, 1.08, -0.37, 0.49, 0.66, 0.26, dark);
        if (med) {
          p('box', 0, 1.15, -0.53, 0.36, 0.11, 0.02, 0x92e5c5, 0, 0, 0, 0.7);
          p('box', 0, 1.15, -0.53, 0.11, 0.38, 0.02, 0x92e5c5, 0, 0, 0, 0.7);
        }
        if (ty === 'hero') {
          p('box', 0, 0.91, -0.49, 0.86, 1.2, 0.06, 0xa6835b, 0, -0.1);
          p('box', -0.54, 1.48, 0.02, 0.42, 0.16, 0.59, accent);
          p('box', 0.54, 1.48, 0.02, 0.42, 0.16, 0.59, accent);
        }
      } else if (ty === 'worker') {
        p('workerHull', 0, 0, 0, 1, 1, 1, ghost ? 0x68717d : options.tint || 0xb7a27b);
        p('box', 0, 1.05, 0.295, 0.67, 0.20, 0.065, dark);
        p('box', 0, 1.065, 0.334, 0.49, 0.105, 0.025, team, 0, 0, 0, 0.65);
        for (const side of [-1, 1]) {
          p('box', side * .43, .60, .731, .11, .07, .025, 0xffe4aa, 0, 0, 0, .55);
          p('box', side * .62, .80, -.08, .065, .025, .66, accent);
        }
        p('box', 0.67, 0.94, 0.45, 0.18, 0.2, 0.95, accent, 0, -0.35);
        p('cylinder', .63, .95, .08, .14, .18, .14, metal, 0, 0, Math.PI/2);
        p('cylinder', .67, .86, .88, .21, .13, .21, dark, 0, -1.1);
        p('workerDrill', 0.67, 0.8, 1.0, 0.18, 0.55, 0.18, 0xd9cdb5, 0, -1.1);
        p('cylinder', -0.3, 1.28, -0.4, 0.18, 0.4, 0.18, accent);
        p('cylinder', -.3, 1.49, -.4, .19, .055, .19, dark);
        p('sphere', -.3, 1.53, -.4, .095, .035, .095, team, 0, 0, 0, .5);
        if (e.carry > 0) p('octa', 0, 1.4, -0.4, 0.32, 0.46, 0.3, 0xecc88a, 0, 0, 0, 0.35);
      } else if (ty === 'tank' || ty === 'artillery') {
        p('box', 0, 0.75, 0, 2.3, 0.85, 3.0, metal);
        for (let i of [-1, 1]) {
          p('box', i * 1.35, 0.57, 0, 0.66, 0.83, 3.25, dark);
          p('box', i * 1.35, 1.08, 0, 0.73, 0.18, 3.5, metal);
          for (let j = -2; j <= 2; j++)
            p('cylinder', i * 1.55, 0.48, j * 0.61, 0.31, 0.22, 0.31, 0x697a7f, 0, 0, Math.PI / 2);
          p('box', i * 1.35, 1.2, 0.5, 0.18, 0.08, 1.6, team, 0, 0, 0, 0.3);
        }
        p('hex', 0, 1.48, -0.25, 1.03, 0.8, 0.95, metal, 0.25);
        p('box', 0, 1.95, -0.33, 1.3, 0.18, 1.3, dark);
        if (ty === 'tank') {
          p('box', 0, 1.63, 1.25, 0.35, 0.35, 2.3, dark);
          p('box', 0, 1.63, 2.48, 0.53, 0.47, 0.42, metal);
          p('box', 0, 1.63, 2.7, 0.28, 0.23, 0.02, 0x18242f);
        } else {
          p('box', 0, 2.15, 0.9, 0.48, 0.45, 3.65, dark, 0, -0.23);
          p('box', 0, 2.59, 2.68, 0.7, 0.63, 0.55, metal, 0, -0.23);
          for (let i of [-1, 1]) p('box', i * 0.67, 1.8, -1.25, 0.5, 0.9, 0.9, accent);
        }
        p('box', -0.45, 2.08, -0.35, 0.44, 0.1, 0.6, team, 0, 0, 0, 0.4);
      } else if (ty === 'air') {
        p('octa', 0, 0.65, 0.25, 0.7, 0.43, 2.2, metal);
        p('box', 0, 0.85, 0.75, 0.47, 0.24, 0.9, 0x81bdcc, 0, 0, 0, 0.4);
        for (let i of [-1, 1]) {
          p('octa', i * 1.35, 0.45, -0.18, 1.6, 0.12, 1.1, metal, 0, 0, i * 0.06);
          p('box', i * 1.05, 0.32, -0.55, 0.53, 0.56, 1.8, dark);
          p('cylinder', i * 1.05, 0.3, -1.48, 0.23, 0.12, 0.23, accent, 0, Math.PI / 2, 0, 1.3);
          p('box', i * 0.66, 0.38, 1.1, 0.16, 0.2, 1.1, dark);
          p('box', i * 0.42, 1.13, -1.2, 0.15, 0.7, 0.8, metal, 0, 0.18, i * 0.27);
        }
        p('sphere', 0, 0.94, -0.2, 0.09, 0.08, 0.09, team, 0, 0, 0, 1.4);
      }
    }
