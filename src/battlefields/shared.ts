/* CPU-only rendering data builder. Terrain topology belongs to the public seeded recipe. */
'use strict';
// Cosmetic grounding outside the playable surface uses the generated skin, not a second nav layer.
function worldReliefHeightAt(field: WorldRelief, x: number, z: number): number {
  const u = clamp((x + field.extent) / field.step + 1, 0, field.size - 1.000001),
    v = clamp((z + field.extent) / field.step + 1, 0, field.size - 1.000001),
    col = Math.floor(u), row = Math.floor(v), dx = u - col, dz = v - row,
    i = row * field.size + col, a = field.heights[i], b = field.heights[i + 1],
    c = field.heights[i + field.size + 1], d = field.heights[i + field.size];
  return dz >= dx ? a + (d - a) * dz + (c - d) * dx : a + (b - a) * dx + (c - b) * dz;
}
class BattlefieldBuilder {
  readonly random: () => number;
  readonly palette: BattlefieldPalette;
  constructor(readonly world: Battlefield) {
    this.random = seeded(world.terrainSeed);
    this.palette = world.definition.palette;
    world.renderData = { features: [], groundColors: [], placements: [], geometries: [] };
  }
  cosmeticRandom(salt: number) { return seeded(this.world.terrainSeed ^ salt); }
  color(c: number) { return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]; }
  place = (
    mesh: string, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, color: WorldColor,
    yaw: number, pitch: number, roll: number, glow: number,
    alpha: number, layer: WorldPlacement['layer'], material?: WorldPlacement['material']
  ) => this.world.renderData.placements.push({ mesh, position: [x, y, z], scale: [sx, sy, sz], color,
    rotation: [yaw, pitch, roll], glow, alpha, layer, material });

  ground() {
    const { world, random: rand, palette: bio } = this, layout = world.renderData, ecology = world.renderProfile.ecology,
      base = ecology ? ecology.dry.map((v, i) => v * .55 + ecology.lush[i] * .45) : this.color(bio.ground),
      { extent, cellSize: cell, gridSize: grid } = world;
    for (let z = 0; z < grid; z++) for (let x = 0; x < grid; x++) {
      const wx = x * cell - extent, wz = z * cell - extent,
        wave = Math.sin(wx * .053 + wz * .024) * .065 + Math.cos(wz * .13) * .035,
        shade = .97 + rand() * .03 + wave, c = base.map(v => v * shade), i = (z * grid + x) * 4;
      world.terrainColors[i] = c[0] * 175;
      world.terrainColors[i + 1] = c[1] * 190;
      world.terrainColors[i + 2] = c[2] * 200;
      world.terrainColors[i + 3] = 255;
      layout.groundColors.push(c, c.map(v => v * (.99 + rand() * .025)));
    }
    this.place('terrain', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0, 0, 1, 'static', 'GROUND');
  }
}
