const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, BATTLEFIELD_SCRIPTS } = require('./helpers/game-scripts.cjs');
const copy = value => JSON.parse(JSON.stringify(value));
function fixture(depth = 0) {
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'expedition']);
  const rules = vm.runInContext('({process:createExpeditionResultProcessor(), encounter:createExpeditionEncounter, seeded, enemy:expeditionEnemyFactions, maps:availableBattlefields})', context);
  const profile = { version: 2, expeditionDepth: depth, tutorialComplete: true };
  const encounter = { map: 'desert', seed: 1409, mission: 'hq-elimination', deployment: 'exploration', enemies: [1] };
  const expedition = { version: 8, depth, faction: 0, abilities: ['orbital','repair','scan','drop'], upgrades: {orbital:2}, benefits: {supplyCrate:1},
    enemyBenefits: [{}], encounter, worlds: [], battle: null };
  const state = { depth, map: 'desert', seed: 1409, rules: {kind:'single-player'}, entities: [] };
  const random = rules.seeded(1409), calls = [];
  const deps = {
    snapshotVictory() { calls.push('snapshot'); const saved = copy(state); saved.rules.completed = true; saved.result = null;
      return {version:1,state:saved,tutorial:null}; },
    createEncounter(depth, previous) { calls.push('encounter'); return rules.encounter(profile, depth, previous, random); }
  };
  return {rules, profile, expedition, state, deps, calls, random};
}
test('victory archives the frozen recipe and unlocks the next encounter without payouts, scores or benefit offers', () => {
  const h = fixture(9), oldRecipe = copy(h.expedition);
  const result = h.rules.process(h.profile,h.expedition,h.state,true,h.deps);
  assert.equal(h.profile.expeditionDepth,10); assert.equal(result.factionUnlocked,1);
  assert.equal(h.expedition.depth,10); assert.equal(h.expedition.battle,null);
  assert.deepEqual(h.calls,['snapshot','encounter']);
  const world = h.expedition.worlds[0];
  assert.equal(world.stage,10); assert.equal(world.recipe.depth,9);
  assert.deepEqual(copy(world.recipe.encounter),oldRecipe.encounter);
  assert.deepEqual(copy(world.recipe.upgrades),{orbital:2});
  assert.deepEqual(copy(h.expedition.upgrades),{}); assert.deepEqual(copy(h.expedition.benefits),{});
  h.expedition.benefits.supplyCrate=3; h.expedition.upgrades.orbital=3;
  assert.equal(world.recipe.benefits.supplyCrate,1); assert.equal(world.recipe.upgrades.orbital,2);
  assert.equal(world.battle.state.rules.completed,true); assert.equal(h.state.rules.completed,undefined);
  assert.equal('aether' in h.profile,false); assert.equal('offers' in h.expedition,false);
  const before = JSON.stringify({profile:h.profile,expedition:h.expedition,calls:h.calls});
  assert.equal(h.rules.process(h.profile,h.expedition,h.state,true,h.deps),null);
  assert.equal(JSON.stringify({profile:h.profile,expedition:h.expedition,calls:h.calls}),before);
});
test('completion preserves faction then map then seed RNG order', () => {
  for (const depth of [0,9,24]) {
    const h=fixture(depth), expected=h.rules.seeded(1409);
    const enemies=h.rules.enemy(depth+1,expected),maps=h.rules.maps().filter(map=>map!=='desert');
    const map=maps[Math.floor(expected()*maps.length)],seed=1+Math.floor(expected()*99999999);
    h.rules.process(h.profile,h.expedition,h.state,true,h.deps);
    assert.deepEqual(copy(h.expedition.encounter.enemies),copy(enemies));
    assert.equal(h.expedition.encounter.map,map); assert.equal(h.expedition.encounter.seed,seed);
    assert.equal(h.random(),expected());
  }
});
test('defeat retires once without permanent rewards; completed worlds cannot progress again', () => {
  const h=fixture(), before=copy(h.profile);
  assert.equal(h.rules.process(h.profile,h.expedition,h.state,false,h.deps).expedition,null);
  assert.deepEqual(h.calls,[]); assert.deepEqual(copy(h.profile),before);
  assert.equal(h.rules.process(h.profile,null,h.state,false,h.deps),null);
  const next=copy(h.state);next.rules.completed=true;
  assert.equal(h.rules.process(h.profile,h.expedition,next,true,h.deps),null);
});
test('failed snapshots remain retryable; a later transition failure cannot archive twice', () => {
  const h=fixture();
  assert.throws(()=>h.rules.process(h.profile,h.expedition,h.state,true,{...h.deps,snapshotVictory(){throw Error('snapshot');}}),/snapshot/);
  assert.equal(h.expedition.depth,0); assert.equal(h.expedition.worlds.length,0);
  assert.throws(()=>h.rules.process(h.profile,h.expedition,h.state,true,{...h.deps,createEncounter(){throw Error('encounter');}}),/encounter/);
  assert.equal(h.expedition.worlds.length,1);
  assert.equal(h.rules.process(h.profile,h.expedition,h.state,true,h.deps),null);
  assert.equal(h.expedition.worlds.length,1);
});
