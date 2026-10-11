import { validateScene } from '../scene-capture-fixture.mjs';

function fields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error(`${label} must be an object`);
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw Error(`Unknown ${label} field: ${key}`);
}
function number(value, min, max, label, integer = false) {
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw Error(`Invalid ${label}`);
}

// Compile a small diagnostic recipe into the existing capture scene contract.
// Inputs are copied; overrides are validated again before any build/browser work.
export function resolveRecipe(input, { caseName, durationMs } = {}) {
  const recipe = structuredClone(input);
  fields(recipe, ['scene', 'army', 'cases', 'warmupMs', 'durationMs', 'interactions'], 'recipe');
  validateScene(recipe.scene);
  recipe.scene.reveal ??= false;
  if (recipe.scene.reveal !== false)
    throw Error('Diagnostic scenes require normal visibility (reveal: false)');
  recipe.warmupMs ??= 1000;
  recipe.durationMs = durationMs ?? recipe.durationMs ?? 5000;
  number(recipe.warmupMs, 0, 5000, 'warmupMs', true);
  number(recipe.durationMs, 1000, 20000, 'durationMs', true);
  if (!Array.isArray(recipe.cases) || recipe.cases.length < 1 || recipe.cases.length > 4)
    throw Error('cases must contain 1–4 entries');
  const names = new Set();
  for (const c of recipe.cases) {
    fields(c, ['name', 'hour', 'paused'], 'case');
    if (typeof c.name !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(c.name) || names.has(c.name))
      throw Error('Invalid or duplicate case name');
    names.add(c.name);
    number(c.hour, 0, 23.999999, 'case.hour');
    if (typeof c.paused !== 'boolean') throw Error('case.paused must be boolean');
  }
  if (caseName !== undefined) {
    if (!names.has(caseName)) throw Error(`Unknown case: ${caseName}`);
    recipe.cases = recipe.cases.filter((c) => c.name === caseName);
  }
  const army = recipe.army;
  fields(army, ['type', 'count', 'columns', 'spacing', 'x', 'z', 'anchor'], 'army');
  if (typeof army.type !== 'string' || !army.type) throw Error('army.type is required');
  number(army.count, 1, 200, 'army.count', true);
  number(army.columns, 1, army.count, 'army.columns', true);
  number(army.spacing, 0.1, 20, 'army.spacing');
  number(army.x, -4096, 4096, 'army.x');
  number(army.z, -4096, 4096, 'army.z');
  army.anchor ??= 'player';
  if (!['world', 'player', 'enemy'].includes(army.anchor)) throw Error('Invalid army.anchor');
  const entities = Array.from({ length: army.count }, (_, i) => ({
    kind: 'unit',
    type: army.type,
    team: 0,
    anchor: army.anchor,
    x: army.x + ((i % army.columns) - (army.columns - 1) / 2) * army.spacing,
    z:
      army.z +
      (Math.floor(i / army.columns) - (Math.ceil(army.count / army.columns) - 1) / 2) *
        army.spacing,
  }));
  recipe.armyOffset = recipe.scene.entities?.length ?? 0;
  recipe.scene.entities = [...(recipe.scene.entities ?? []), ...entities];
  // Includes the shared 200-entity limit, coordinate and anchor validation.
  validateScene(recipe.scene);
  recipe.interactions ??= [];
  if (!Array.isArray(recipe.interactions) || recipe.interactions.length > 8)
    throw Error('interactions must be an array of at most 8 entries');
  let previous = -1;
  for (const action of recipe.interactions) {
    fields(action, ['at', 'kind', 'target'], 'interaction');
    number(action.at, 0.01, 0.95, 'interaction.at');
    if (action.at <= previous) throw Error('Interactions must have strictly increasing offsets');
    previous = action.at;
    if (!['selectArmy', 'moveArmy'].includes(action.kind)) throw Error('Unknown interaction kind');
    if (action.kind === 'moveArmy') {
      fields(action.target, ['x', 'z', 'anchor'], 'target');
      number(action.target.x, -4096, 4096, 'target.x');
      number(action.target.z, -4096, 4096, 'target.z');
      action.target.anchor ??= 'player';
      if (!['world', 'player', 'enemy'].includes(action.target.anchor))
        throw Error('Invalid target.anchor');
    } else if (action.target !== undefined) throw Error('selectArmy has no target');
  }
  return recipe;
}
