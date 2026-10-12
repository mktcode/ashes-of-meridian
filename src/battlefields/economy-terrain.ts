/* Fit public economy to a natural field. No family selection, party assignment or
 * rendering; HQ probes use the same triangulated surface as the final world. */
'use strict';
interface BattlefieldEconomyShoulder extends Position {
  readonly cs: number;
  readonly sn: number;
  readonly stretch: number;
  readonly phase: number;
}
interface BattlefieldVentPlane extends Position {
  readonly height: number;
  readonly dx: number;
  readonly dz: number;
}
function sampleBattlefieldEconomyShoulders(regions: readonly BattlefieldEconomyRegion[],
    random: () => number): readonly BattlefieldEconomyShoulder[] {
  return Object.freeze(regions.map(region => {
    const angle = random() * Math.PI;
    return Object.freeze({ ...region.center, cs: Math.cos(angle), sn: Math.sin(angle),
      stretch: .85 + random() * .3, phase: random() * Math.PI * 2 });
  }));
}
function fitBattlefieldEconomy(size: BattlefieldSize, layout: BattlefieldLayout, natural: BattlefieldNaturalTerrain,
    pads: readonly BattlefieldEconomyShoulder[], hqRadius: number): BattlefieldHeightField {
  const { datum, height: raw } = natural, smooth = battlefieldSmooth,
    vents: readonly BattlefieldVentPlane[] = layout.economyRegions.map(({ vent: p }) => {
      const dx = (datum(p.x + 1, p.z) - datum(p.x - 1, p.z)) / 2,
        dz = (datum(p.x, p.z + 1) - datum(p.x, p.z - 1)) / 2,
        scale = Math.max(1, Math.hypot(dx, dz) / .06);
      return { ...p, height: datum(p.x, p.z), dx: dx / scale, dz: dz / scale };
    }),
    routes = layout.corridors.map(route => {
      const [a, b] = route, dx = b[0] - a[0], dz = b[1] - a[1];
      return { x: a[0], z: a[1], dx, dz, length2: dx * dx + dz * dz };
    }),
    height: BattlefieldHeightField = (x, z) => {
      const grade = datum(x, z);
      let h = raw(x, z, grade), roadRetention = 1;
      for (const r of routes) {
        const t = clamp(((x - r.x) * r.dx + (z - r.z) * r.dz) / r.length2, 0, 1),
          d = Math.hypot(x - r.x - t * r.dx, z - r.z - t * r.dz);
        // Multiply retained relief: a maximum would create angular overlap ridges.
        roadRetention *= smooth((d - 7) / 26);
      }
      // All intersections and buildable cores share one gently graded datum.
      h = grade + (h - grade) * roadRetention;
      let padRetention = 1;
      for (const p of pads) {
        const dx = x - p.x, dz = z - p.z,
          u = (dx * p.cs + dz * p.sn) / p.stretch, v = (dz * p.cs - dx * p.sn) * p.stretch,
          d = Math.pow(u ** 4 + v ** 4, .25), theta = Math.atan2(v, u),
          shoulder = 28 + 5 * Math.sin(theta * 3 + p.phase) + 3 * Math.cos(theta * 5 - p.phase);
        padRetention *= smooth((d - 18) / shoulder);
      }
      h = grade + (h - grade) * padRetention;
      for (const vent of vents) {
        const dx = x - vent.x, dz = z - vent.z, d = Math.max(Math.abs(dx), Math.abs(dz));
        if (d < 14) {
          const plane = vent.height + vent.dx * dx + vent.dz * dz;
          h = plane + (h - plane) * smooth((d - 6) / 8);
        }
      }
      return Math.max(0, h > 60 ? 60 + 12 * (1 - Math.exp(-(h - 60) / 12)) : h);
    };
  return supportBattlefieldHeadquarters(size, layout.economyRegions, vents, height, hqRadius);
}
function supportBattlefieldHeadquarters(size: BattlefieldSize, regions: readonly BattlefieldEconomyRegion[],
    vents: readonly BattlefieldVentPlane[], height: BattlefieldHeightField, hqRadius: number): BattlefieldHeightField {
  const smooth = battlefieldSmooth, repairs = regions.flatMap(({ hq: p }) => {
    const ox = Math.round(p.x / size.cellSize) * size.cellSize,
      oz = Math.round(p.z / size.cellSize) * size.cellSize,
      probe = new BattlefieldSurface(12.5, size.cellSize, (x, z) => height(x + ox, z + oz)),
      q = { x: p.x - ox, z: p.z - oz };
    if (probe.foundation(q, hqRadius) && probe.fits(q.x, q.z, 9)) return [];
    const dx = (height(p.x + 1, p.z) - height(p.x - 1, p.z)) / 2,
      dz = (height(p.x, p.z + 1) - height(p.x, p.z - 1)) / 2,
      scale = Math.max(1, Math.hypot(dx, dz) / .14);
    return [{ ...p, height: height(p.x, p.z), dx: dx / scale, dz: dz / scale }];
  });
  return (x, z) => {
    let h = height(x, z);
    for (const p of repairs) {
      const dx = x - p.x, dz = z - p.z, d = Math.pow(dx ** 4 + dz ** 4, .25);
      if (d < 18) {
        const plane = p.height + p.dx * dx + p.dz * dz;
        let influence = 1 - smooth((d - 10) / 8);
        // Wider HQ shoulders must not alter any complete refinery footprint.
        for (const vent of vents)
          influence *= smooth((Math.hypot(x - vent.x, z - vent.z) - 7.5) / 7);
        h += (plane - h) * influence;
      }
    }
    return h;
  };
}
