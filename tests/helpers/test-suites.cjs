const { readdirSync } = require('node:fs');
const { join } = require('node:path');

// Every root test has one owner; new files must be classified before any suite runs.
const groups = Object.freeze({
  logic: ['core', 'harness', 'test-selection', 'abilities', 'parties', 'ffa',
    'ai-planning', 'commands', 'command-queue', 'navigation', 'effect-rng', 'perspective',
    'persistence', 'simulation-validation'],
  terrain: ['terrain', 'elevation', 'westmark', 'crystals', 'world-designs',
    'ecology', 'world-variations', 'environment'],
  presentation: ['presentation', 'diagnostics', 'controls', 'codex', 'renderer', 'materials', 'model-thumbnails'],
  ai: ['ai'],
  simulation: ['simulation']
});
const standardGroups = ['logic', 'terrain', 'presentation', 'models'];
function selectTests(suite = 'standard', root = join(__dirname, '../..')) {
  if (suite !== 'standard' && suite !== 'models' && !Object.hasOwn(groups, suite))
    throw Error(`Unknown test suite: ${suite}`);
  const rootFiles = readdirSync(join(root, 'tests')).filter(name => name.endsWith('.check.cjs'));
  const classified = Object.values(groups).flat().map(name => `ashes-of-meridian-${name}.check.cjs`);
  if (new Set(classified).size !== classified.length) throw Error('Duplicate test classification');
  const missing = classified.filter(name => !rootFiles.includes(name));
  const unknown = rootFiles.filter(name => !classified.includes(name));
  if (missing.length || unknown.length)
    throw Error(`Test classification mismatch; missing: ${missing.join(', ')}; unclassified: ${unknown.join(', ')}`);
  const suites = suite === 'standard' ? standardGroups : [suite];
  return suites.flatMap(group => group === 'models'
    ? readdirSync(join(root, 'tests/models')).filter(name => name.endsWith('.check.cjs')).sort().map(name => `tests/models/${name}`)
    : groups[group].map(name => `tests/ashes-of-meridian-${name}.check.cjs`));
}
module.exports = { selectTests };
