const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, BATTLEFIELD_SCRIPTS } = require('./helpers/game-scripts.cjs');
const copy = value => JSON.parse(JSON.stringify(value));
function fixture(depth = 0) {
  // No UI, simulation, storage, audio or DOM are loaded.
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'expedition'],
    { globals: { clamp: (value,min,max) => Math.max(min,Math.min(max,value)) } });
  const rules = vm.runInContext('({process:createExpeditionResultProcessor(), encounter:createExpeditionEncounter, offers:createExpeditionBenefitOffers, seeded, enemy:expeditionEnemyFactions, maps:availableBattlefields})', context);
  const profile = { aether: 10, expeditionDepth: depth, tutorialComplete: true };
  const encounter = { map: 'desert', seed: 1409, mission: 'hq-elimination', deployment: 'exploration', enemies: [1] };
  const expedition = { version: 7, depth, faction: 0, abilities: ['orbital','repair','scan','drop'], benefits: {supplyCrate:1},
    enemyBenefits: [{}], encounter, offers: [], worlds: [], battle: null, civilizationScore: 0, unlockedStage: depth + 1 };
  const state = { depth, map: 'desert', seed: 1409, rules: {kind:'single-player'},
    parties: [{meta:{aetherEvacuation:1},account:{gas:321}}], stats:{structuresDestroyed:2},
    entities: [{kind:'building',type:'fieldlab',team:0,hp:500,progress:1}] };
  const random = rules.seeded(1409), calls = [];
  const deps = {
    snapshotVictory() { calls.push('snapshot'); const saved = copy(state); saved.rules.completed = true; saved.result = null;
      return {version:1,state:saved,tutorial:null}; },
    createEncounter(depth, previous) { calls.push('encounter'); return rules.encounter(profile, depth, previous, random); },
    createBenefitOffers(expedition) { calls.push('offers'); return rules.offers(expedition); }
  };
  return {context, rules, profile, expedition, state, deps, calls, random};
}
test('expedition completion archives the old recipe, pays and progresses without UI dependencies', () => {
  const h = fixture(9), oldRecipe = copy(h.expedition);
  const result = h.rules.process(h.profile,h.expedition,h.state,true,h.deps);
  assert.equal(result.evacuated,200); assert.equal(result.structures,20); assert.equal(result.recovered,220);
  assert.equal(h.profile.aether,230); assert.equal(h.profile.expeditionDepth,10); assert.equal(result.factionUnlocked,1);
  assert.equal(h.expedition.depth,10); assert.equal(h.expedition.battle,null);
  assert.deepEqual(h.calls,['snapshot','encounter','offers']);
  const world = h.expedition.worlds[0];
  assert.equal(world.stage,10); assert.equal(world.recipe.depth,9);
  assert.deepEqual(copy(world.recipe.encounter),oldRecipe.encounter);
  h.expedition.benefits.supplyCrate++;
  assert.equal(world.recipe.benefits.supplyCrate,1);
  assert.equal(world.battle.state.rules.completed,true); assert.equal(h.state.rules.completed,undefined);
  assert.equal(result.civilizationTotal,5); assert.equal(h.profile.lastCivilizationScore,5);
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
test('defeat and zero payout retire once; a distinct battle can complete again', () => {
  const h=fixture(); h.state.parties[0].account.gas=0; h.state.stats.structuresDestroyed=0;
  const result=h.rules.process(h.profile,h.expedition,h.state,false,h.deps);
  assert.equal(result.expedition,null); assert.equal(result.recovered,0); assert.equal(result.civilizationTotal,5);
  assert.deepEqual(h.calls,[]); assert.equal(h.profile.aether,10);
  assert.equal(h.rules.process(h.profile,null,h.state,false,h.deps),null);
  const next=copy(h.state);next.parties[0].account.gas=10;
  assert.equal(h.rules.process(h.profile,h.expedition,next,false,h.deps).recovered,10);
  next.rules.completed=true;
  assert.equal(h.rules.process(h.profile,h.expedition,next,true,h.deps),null);
});
test('failed snapshots do not pay; failure after payout cannot pay again', () => {
  const h=fixture();
  assert.throws(()=>h.rules.process(h.profile,h.expedition,h.state,true,{...h.deps,snapshotVictory(){throw Error('snapshot');}}),/snapshot/);
  assert.equal(h.profile.aether,10);assert.equal(h.expedition.depth,0);
  assert.throws(()=>h.rules.process(h.profile,h.expedition,h.state,true,{...h.deps,createEncounter(){throw Error('encounter');}}),/encounter/);
  assert.equal(h.profile.aether,230);
  assert.equal(h.rules.process(h.profile,h.expedition,h.state,true,h.deps),null);
  assert.equal(h.profile.aether,230);
});
