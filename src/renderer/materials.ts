/* Rule-based surface baking. Pure CPU data, no DOM, GPU or simulation RNG. */
'use strict';

const MAT = { AUTO: 0, GROUND: 1, METAL: 2, BIO: 3, ROCK: 4, CRYSTAL: 5, MASSIF: 6, ALIEN: 7, LANDSCAPE: 8, WATER: 9, BARK: 10, FOLIAGE: 11, MASONRY: 12, LEAF: 13 };

type SurfacePattern = 'sediment' | 'strata' | 'plates' | 'cells' | 'grass' | 'granite' | 'soil' | 'bark';
interface SurfaceRecipe {
  readonly pattern: SurfacePattern;
  readonly seed: number;
  readonly low: readonly [number, number, number];
  readonly high: readonly [number, number, number];
  /** Default ground-projection metres per tile; independent of bake resolution. */
  readonly tile: readonly [number, number];
  readonly relief: number;
  readonly variation: number;
}
const PROCEDURAL_MATERIALS = {
  ground: { pattern: 'sediment', seed: 0x73616e64, low: [91, 62, 47], high: [185, 142, 94], tile: [14, 14], relief: .12, variation: .22 },
  desertRock: { pattern: 'strata', seed: 0x726f636b, low: [104, 77, 61], high: [167, 129, 94], tile: [18, 18], relief: .22, variation: .22 },
  metal: { pattern: 'plates', seed: 0x706c6174, low: [53, 65, 74], high: [149, 157, 162], tile: [8, 8], relief: .035, variation: .08 },
  bio: { pattern: 'cells', seed: 0x62696f6d, low: [29, 62, 65], high: [101, 145, 124], tile: [12, 12], relief: .10, variation: .30 },
  westmarkMeadow: { pattern: 'grass', seed: 0x6d6f7373, low: [44, 66, 33], high: [136, 144, 75], tile: [8, 8], relief: .07, variation: .15 },
  westmarkGranite: { pattern: 'granite', seed: 0x6772616e, low: [71, 80, 83], high: [168, 175, 165], tile: [12, 12], relief: .12, variation: .06 },
  westmarkEarth: { pattern: 'soil', seed: 0x736f696c, low: [65, 49, 35], high: [155, 125, 85], tile: [7, 7], relief: .08, variation: .10 },
  westmarkBark: { pattern: 'bark', seed: 0x6261726b, low: [39, 32, 26], high: [132, 110, 75], tile: [3, 3], relief: .06, variation: .05 }
} as const satisfies Record<string, SurfaceRecipe>;
type ProceduralMaterialName = keyof typeof PROCEDURAL_MATERIALS;
const MATERIAL_BAKE_SIZE = 256;

// Integer hash, not a stateful stream. Evaluation order and resolution cannot shift a world seed.
function surfaceHash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function surfaceSmooth(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
// Wrap lattice indices, not the interpolated result: both value and slope meet at every seam.
function surfaceNoise(u: number, v: number, periodX: number, periodY: number, seed: number) {
  const x = u * periodX, y = v * periodY, ix = Math.floor(x), iy = Math.floor(y),
    wrap = (n: number, period: number) => ((n % period) + period) % period,
    h = (dx: number, dy: number) => surfaceHash(wrap(ix + dx, periodX), wrap(iy + dy, periodY), seed),
    a = surfaceSmooth(0, 1, x - ix), b = surfaceSmooth(0, 1, y - iy);
  return (h(0, 0) * (1 - a) + h(1, 0) * a) * (1 - b) + (h(0, 1) * (1 - a) + h(1, 1) * a) * b;
}
/** Albedo and height share a recipe: crevices darken, raised edges catch wear. */
function sampleSurface(recipe: SurfaceRecipe, u: number, v: number) {
  const seed = recipe.seed, noise = (x: number, y: number, salt = 0) => surfaceNoise(u, v, x, y, seed ^ salt),
    broad = noise(4, 4), medium = noise(16, 16, 1237), fine = noise(64, 64, 7919);
  let height = broad * .45 + medium * .35 + fine * .20, pigment = height;
  switch (recipe.pattern) {
    case 'sediment': {
      const ripple = .5 + .5 * Math.sin(v * Math.PI * 32 + broad * 5);
      height = .55 * broad + .25 * medium + .20 * ripple;
      pigment = .26 + height * .54 + fine * .20;
      break;
    }
    case 'strata': {
      const wave = v * 12 + broad * 1.8 + medium * .25, band = wave - Math.floor(wave),
        ledge = surfaceSmooth(.08, .32, band) * (1 - surfaceSmooth(.65, .96, band));
      height = ledge * .20 + medium * .52 + fine * .28;
      pigment = .25 + height * .50 + noise(3, 12, 83) * .25;
      break;
    }
    case 'plates': {
      const x = ((u * 4) % 1 + 1) % 1, y = ((v * 4) % 1 + 1) % 1,
        edge = Math.min(x, 1 - x, y, 1 - y), plate = surfaceSmooth(.012, .04, edge),
        wear = (1 - surfaceSmooth(.04, .075, edge)) * plate,
        screw = 1 - surfaceSmooth(.026, .044, Math.hypot(Math.min(x, 1 - x) - .09, Math.min(y, 1 - y) - .09));
      height = .22 + plate * .52 - screw * .22 + fine * .035;
      pigment = .10 + plate * (.40 + broad * .17 + fine * .08) + wear * .20 - screw * .25;
      break;
    }
    case 'cells': {
      const veins = Math.abs(Math.sin(u * Math.PI * 12 + broad * 5) * Math.sin(v * Math.PI * 12 + medium * 3));
      height = surfaceSmooth(.03, .30, veins) * .60 + broad * .25 + fine * .15;
      pigment = .15 + height * .65 + medium * .20;
      break;
    }
    case 'grass': {
      const blades = noise(96, 16, 353);
      height = broad * .35 + medium * .20 + blades * .45;
      pigment = .12 + broad * .45 + blades * .30 + fine * .13;
      break;
    }
    case 'granite':
      height = broad * .30 + medium * .40 + fine * .30;
      pigment = .15 + medium * .48 + surfaceSmooth(.3, .72, fine) * .37;
      break;
    case 'soil':
      height = broad * .45 + medium * .35 + fine * .20;
      pigment = .12 + height * .72 + fine * .16;
      break;
    case 'bark': {
      const furrow = .5 + .5 * Math.sin(u * Math.PI * 32 + noise(4, 8, 31) * 4);
      height = surfaceSmooth(.15, .7, furrow) * .65 + medium * .25 + fine * .10;
      pigment = .08 + height * .78 + fine * .14;
      break;
    }
  }
  const t = Math.max(0, Math.min(1, pigment));
  return [recipe.low[0] + (recipe.high[0] - recipe.low[0]) * t,
    recipe.low[1] + (recipe.high[1] - recipe.low[1]) * t,
    recipe.low[2] + (recipe.high[2] - recipe.low[2]) * t, Math.max(0, Math.min(1, height)) * 255] as const;
}
function bakeSurface(name: ProceduralMaterialName, size = MATERIAL_BAKE_SIZE) {
  // A fixed, bounded bake, never an unbounded cache indexed by world seeds.
  if (!Number.isInteger(size) || size < 16 || size > 512 || (size & (size - 1)) !== 0)
    throw Error('Surface bake size must be a power of two from 16 to 512');
  const recipe = PROCEDURAL_MATERIALS[name], pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sample = sampleSurface(recipe, x / size, y / size), i = (y * size + x) * 4;
    for (let c = 0; c < 4; c++) pixels[i + c] = Math.round(sample[c]);
  }
  return { width: size, height: size, pixels };
}
/** World-specific palette/offset; no new texture, no stream consumed, no simulation state. */
function surfaceWorldStyle(name: ProceduralMaterialName, seed: number) {
  const recipe = PROCEDURAL_MATERIALS[name], salt = seed ^ recipe.seed ^ 0x7374796c,
    warmth = (surfaceHash(0, 0, salt) - .5) * recipe.variation,
    brightness = 1 + (surfaceHash(1, 0, salt) - .5) * .12;
  return {
    tint: [brightness + warmth, brightness, brightness - warmth] as [number, number, number],
    offset: [surfaceHash(2, 0, salt), surfaceHash(3, 0, salt)] as [number, number]
  };
}
