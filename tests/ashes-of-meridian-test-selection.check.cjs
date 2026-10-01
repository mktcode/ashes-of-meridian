const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { selectTests } = require('./helpers/test-suites.cjs');

test('standard selection includes technical groups and excludes both opt-in endurance suites', () => {
  const standard = selectTests();
  assert.deepEqual(standard, ['logic', 'terrain', 'presentation', 'models'].flatMap(group => selectTests(group)));
  assert.equal(new Set(standard).size, standard.length);
  assert.ok(standard.includes('tests/ashes-of-meridian-model-thumbnails.check.cjs'));
  for (const suite of ['ai', 'simulation']) {
    assert.equal(selectTests(suite).length, 1);
    assert.ok(selectTests(suite).every(file => !standard.includes(file)));
  }
  assert.throws(() => selectTests('all'), /Unknown test suite/);
});

test('selection rejects unclassified and missing tests instead of silently changing coverage', t => {
  const scratch = join(__dirname, '../.tmp');
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, 'test-selection-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'tests/models'), { recursive: true });
  for (const file of [...selectTests(), ...selectTests('ai'), ...selectTests('simulation')])
    writeFileSync(join(root, file), '');
  assert.deepEqual(selectTests('standard', root), selectTests());
  const extra = join(root, 'tests/ashes-of-meridian-unclassified.check.cjs');
  writeFileSync(extra, '');
  assert.throws(() => selectTests('logic', root), /unclassified: ashes-of-meridian-unclassified/);
  rmSync(extra);
  rmSync(join(root, 'tests/ashes-of-meridian-model-thumbnails.check.cjs'));
  assert.throws(() => selectTests('standard', root), /missing: ashes-of-meridian-model-thumbnails/);
});
