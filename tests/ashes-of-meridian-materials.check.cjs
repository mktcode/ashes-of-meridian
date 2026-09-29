const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { RENDERER_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');

function materials() {
  const context = loadScripts(['renderer-materials']);
  vm.runInContext('Math.random = () => { throw Error("ambient randomness is forbidden"); }', context);
  return vm.runInContext('({PROCEDURAL_MATERIALS, bakeSurface, sampleSurface, surfaceWorldStyle, surfaceHash})', context);
}

test('surface recipes produce bounded repeatable albedo and height without DOM or RNG', () => {
  const { PROCEDURAL_MATERIALS: recipes, bakeSurface } = materials();
  for (const [name, recipe] of Object.entries(recipes)) {
    const a = bakeSurface(name, 32), b = bakeSurface(name, 32);
    assert.equal(a.width, 32); assert.equal(a.height, 32);
    assert.equal(a.pixels.byteLength, 32 * 32 * 4);
    assert.deepEqual(a.pixels, b.pixels);
    assert.ok(recipe.tile.every(n => Number.isFinite(n) && n > 0));
    assert.ok(recipe.relief > 0 && recipe.relief < .3);
    const heights = new Set(), colors = new Set();
    for (let i = 0; i < a.pixels.length; i += 4) {
      heights.add(a.pixels[i + 3]); colors.add(a.pixels.slice(i, i + 3).join(','));
    }
    assert.ok(heights.size > 12 && colors.size > 12, `${name}: actual detail, not a flat fallback`);
  }
  for (const size of [0, 15, 33, 1024, Infinity, NaN]) assert.throws(() => bakeSurface('ground', size));
});

test('surface values and slopes meet at positive and negative periodic seams', () => {
  const { PROCEDURAL_MATERIALS: recipes, sampleSurface } = materials(), e = 1e-6;
  for (const [name, recipe] of Object.entries(recipes)) for (const t of [.037, .193, .411, .739]) {
    for (const axis of [0, 1]) {
      const at = n => sampleSurface(recipe, axis ? t : n, axis ? n : t);
      const a = at(0), b = at(1), c = at(-1), left = at(-e), right = at(e);
      for (let channel = 0; channel < 4; channel++) {
        assert.ok(Math.abs(a[channel] - b[channel]) < 1e-8, `${name}: value seam`);
        assert.ok(Math.abs(a[channel] - c[channel]) < 1e-8, `${name}: negative wrap`);
        assert.ok(Math.abs((a[channel] - left[channel]) - (right[channel] - a[channel])) < 1e-5,
          `${name}: slope seam`);
      }
    }
  }
});

test('world style is seed-isolated, reproducible and bounded without a growing variant cache', () => {
  const { PROCEDURAL_MATERIALS: recipes, surfaceWorldStyle } = materials();
  for (const name of Object.keys(recipes)) {
    const styles = new Set();
    for (let seed = 0; seed < 100; seed++) {
      const style = surfaceWorldStyle(name, seed);
      assert.deepEqual(style, surfaceWorldStyle(name, seed));
      assert.ok(style.tint.every(v => v >= .79 && v <= 1.21));
      assert.ok(style.offset.every(v => v >= 0 && v < 1));
      styles.add(JSON.stringify(style));
    }
    assert.equal(styles.size, 100);
  }
});

test('procedural materials upload only on residency misses and rebake identically after release', async () => {
  const context = loadScripts(RENDERER_SCRIPTS), { MeridianRenderer, PROCEDURAL_MATERIALS } = vm.runInContext(
    '({MeridianRenderer, PROCEDURAL_MATERIALS})', context);
  const images = [], calls = [], deleted = [];
  let bound;
  const g = new Proxy({
    createTexture: () => ({}), bindTexture(target, tex) { bound = tex; },
    deleteTexture(tex) { deleted.push(tex); },
    texImage2D(...args) { images.push({ tex: bound, width: args[3], pixels: Uint8Array.from(args[8]) }); },
    texParameteri(...args) { calls.push(args); }, generateMipmap(...args) { calls.push(args); }
  }, { get(target, name) { return name in target ? target[name] : name; } });
  const r = Object.assign(Object.create(MeridianRenderer.prototype), {
    gl: g, textureLoads: {}, textureGeneration: 0, desiredTextures: new Set(Object.keys(PROCEDURAL_MATERIALS)),
    textureResources: Object.fromEntries(Object.keys(PROCEDURAL_MATERIALS).map(name => [name,
      { texture: {}, fallback: [128, 128, 128], repeat: true, resident: false }]))
  });
  // No Image constructor in this VM: opaque surfaces must never attempt image decoding.
  for (const name of Object.keys(PROCEDURAL_MATERIALS)) {
    const old = r.textureResources[name].texture;
    assert.equal(await r.loadResidentTexture(name), true);
    const first = images.at(-1);
    assert.equal(first.width, 256); assert.equal(first.pixels.length, 256 * 256 * 4);
    const count = images.length;
    assert.equal(await r.loadResidentTexture(name), true);
    assert.equal(images.length, count, 'resident use does not bake/upload');
    r.releaseResidentTexture(name);
    assert.equal(deleted.at(-1), old);
    assert.equal(r.textureResources[name].resident, false);
    assert.equal(await r.loadResidentTexture(name), true);
    assert.notEqual(images.at(-1).tex, old);
    assert.deepEqual(images.at(-1).pixels, first.pixels, 'same recipe after map round trip');
  }
  assert.equal(Object.keys(r.textureLoads).length, 0, 'completed requests do not retain pixel buffers');
});
