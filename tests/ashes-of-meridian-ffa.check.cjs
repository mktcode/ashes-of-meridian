// Short FFA rule contracts, no autonomous battles or long simulation runs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', 'effects', ...BATTLEFIELD_SCRIPTS, 'world', ...SIMULATION_SCRIPTS]);
const { MeridianGame, expeditionEnemyCount, expeditionEnemyFactions, advanceEnemyBenefits, chooseEnemyBenefit } =
  vm.runInContext('({ MeridianGame, expeditionEnemyCount, expeditionEnemyFactions, advanceEnemyBenefits, chooseEnemyBenefit })', context);

function battle(count = 4, scenario = false) {
  const events = [], g = new MeridianGame({ upgrades: {} }, (type, data) => events.push({ type, data }));
  const opts = { seed: 1409, map: 'desert', duration: 1,
    parties: Array.from({ length: count }, () => ({ faction: 1, controller: 'ai' })),
    hostilities: Array.from({ length: count }, (_, a) => Array.from({ length: count }, (_, b) => a !== b)) };
  if (scenario) g.startScenario(opts);
  else g.start({ seed: opts.seed, map: opts.map, enemies: Array(count - 1).fill(1) });
  const hqs = g.alive(e => e.type === 'hq');
  events.length = 0;
  return { g, hqs, events };
}

test('explicit HQ mission and default starts share state and RNG; each start owns its mission state', () => {
  const { g } = battle();
  const options = { seed: 1409, map: 'desert', enemies: [1, 1, 1] };
  const state = JSON.stringify(g.s), mission = g.s.rules.mission, next = g.random();
  assert.equal(mission.id, 'hq-elimination');
  g.start({ ...options, mission: 'hq-elimination' });
  assert.equal(JSON.stringify(g.s), state);
  assert.equal(g.random(), next);
  assert.notStrictEqual(g.s.rules.mission, mission);
  const current = g.s, world = g.world, math = vm.runInContext('Math', context), random = math.random;
  math.random = () => { throw Error('Invalid mission must not draw RNG'); };
  try {
    for (const invalid of ['king-of-the-hill', 'toString', '', null, ['hq-elimination']]) {
      assert.throws(() => g.start({ mission: invalid }), /Unsupported mission/);
      assert.strictEqual(g.s, current); assert.strictEqual(g.world, world);
    }
  } finally { math.random = random; }
});

test('FFA hostility is symmetric for every party, even with identical factions; resources stay neutral', () => {
  const { g } = battle();
  for (const a of [-1, 0, 1, 2, 3]) for (const b of [-1, 0, 1, 2, 3])
    assert.equal(g.enemy({ team: a }, { team: b }), a >= 0 && b >= 0 && a !== b);
  assert.equal(g.aiFor(0), undefined);
  for (const p of g.s.parties.slice(1)) assert.ok(g.aiFor(p.id));
  assert.notStrictEqual(g.aiFor(1), g.aiFor(2));
});

test('HQ elimination withdraws assets without kills or RNG and cannot end the battle early', () => {
  const { g, hqs, events } = battle();
  const unit = g.spawnUnit('rifle', 0, 0, 2, 1);
  const building = g.spawnBuilding('barracks', 15, 0, 2, 1);
  building.queue.push({ type: 'rifle', progress: 0, time: 1, cost: 75, gas: 0 });
  g.s.scans.push({ team: 2, x: 0, z: 0, r: 10, until: 50 });
  g.s.fields.push({ team: 2, type: 'bloom', x: 0, z: 0, r: 10, until: 50 });
  g.s.strikes.push({ team: 2, type: 'orbital', x: 0, z: 0, radius: 8, damage: 300, at: 50 });
  g.random = () => { throw Error('Elimination must not draw RNG'); };
  hqs[2].hp = 0;
  g.checkBattleResult();
  assert.equal(g.party(2).eliminated, true);
  assert.equal(unit.hp, 0); assert.equal(building.hp, 0); assert.equal(building.queue.length, 0);
  assert.equal(g.s.stats.kills, 0); assert.equal(g.s.stats.structuresDestroyed, 0); assert.equal(g.s.result, null);
  assert.equal(g.s.fields.length, 0); assert.equal(g.s.scans.length, 0);
  assert.equal(g.s.strikes.length, 1, 'already launched strikes survive');
  assert.equal(g.executeAction(2, { kind: 'ability', ability: 'scan', position: { x: 0, z: 0 } }), false);
  assert.equal(g.ability('scan', { x: 0, z: 0 }, 2), false);
  const nextThink = g.aiFor(2).nextThink; g.aiTick(2);
  assert.equal(g.aiFor(2).nextThink, nextThink);
  assert.equal(events.length, 1); assert.equal(events[0].type, 'alert');
  assert.equal(typeof events[0].data.text, 'string');
  assert.deepEqual(Object.keys(events[0].data), ['text'], 'global notice has no hidden location');
  g.checkBattleResult(); assert.equal(events.length, 1, 'elimination is announced only once');
  // A pending Choir impact still lands, but cannot reactivate an eliminated party's bloom.
  g.s.strikes[0].at = .05; g.effects.explosion = () => {};
  g.s.parties.forEach(p => { p.controller = { kind: 'human' }; });
  g.step(.05);
  assert.equal(g.s.strikes.length, 0); assert.equal(g.s.fields.length, 0);
  hqs[1].hp = 0; g.checkBattleResult(); assert.equal(g.s.result, null);
  hqs[3].hp = 0; g.checkBattleResult(); assert.equal(g.s.result.win, true);
});

test('last HQ defines survival and simultaneous final losses remain a player defeat', () => {
  const { g, hqs } = battle(3);
  const spare = g.spawnBuilding('hq', 0, 0, 1, 1);
  hqs[1].hp = 0; g.checkBattleResult(); assert.equal(g.party(1).eliminated, undefined);
  spare.hp = 0; g.checkBattleResult(); assert.equal(g.party(1).eliminated, true);
  hqs[0].hp = 0; hqs[2].hp = 0; g.checkBattleResult();
  assert.equal(g.s.result.win, false);
});

test('opponent-on-opponent kills never grant player score; player kills cover all enemies', () => {
  const { g, hqs, events } = battle();
  g.effects.explosion = () => {};
  g.kill(hqs[2], hqs[1]); assert.equal(g.s.stats.kills, 0);
  assert.ok(!events.some(e => e.data.x !== undefined), 'hidden HQ deaths do not disclose locations');
  g.kill(hqs[3], hqs[0]); assert.equal(g.s.stats.kills, 1);
  g.kill(hqs[1], hqs[0]); assert.equal(g.s.stats.kills, 2);
});

test('only completed hostile structures destroyed by the player earn structure recovery', () => {
  const { g, hqs } = battle();
  g.effects.explosion = () => {};
  const completed = g.spawnBuilding('barracks', 12, 0, 1, 1),
    foundation = g.spawnBuilding('depot', 16, 0, 2, 1, { progress: .5 }),
    // Direct fixture body: this score test does not ask a random hillside for a legal spawn.
    unit = g.spawn('unit', 'rifle', 20, 0, 3, 1),
    aiTarget = g.spawnBuilding('factory', 24, 0, 3, 1);
  g.kill(completed, hqs[0]);
  g.kill(foundation, hqs[0]);
  g.kill(unit, hqs[0]);
  g.kill(aiTarget, hqs[1]);
  assert.equal(g.s.stats.kills, 3);
  assert.equal(g.s.stats.structuresDestroyed, 1);
});

test('public FFA start snapshots every slot and preserves seeded terrain/resources on all maps', () => {
  for (const map of ['desert', 'mothership', 'alien-planet']) {
    const g = new MeridianGame({ upgrades: { startingAlloy: 2 } });
    const resourceSnapshot = () => JSON.stringify(g.s.entities.filter(e => e.kind === 'resource'));
    const opts = { seed: 1409, map, faction: 1, enemies: [1, 1, 1],
      enemyBenefits: [{ supplyCrate: 2 }, { pioneerSquad: 1 }, {}] };
    g.start({ seed: opts.seed, map }); const resources = resourceSnapshot();
    g.start(opts);
    assert.equal(resourceSnapshot(), resources);
    assert.equal(g.world.sight.length, 4);
    const hqs = g.alive(e => e.type === 'hq');
    assert.equal(new Set(hqs.map(h => `${h.x}/${h.z}`)).size, 4);
    assert.deepEqual(Array.from(g.s.parties, p => p.account.alloy), [350, 350, 250, 250]);
    assert.equal(g.alive(e => e.team === 2 && e.type === 'worker').length, 1);
    assert.equal(g.alive(e => e.team === 3 && e.type === 'worker').length, 0);
    assert.ok(g.s.parties.slice(1).every(p => Object.keys(p.meta).length === 0));
    const snapshot = JSON.stringify(g.s), nextRandom = g.random();
    g.start(opts); assert.equal(JSON.stringify(g.s), snapshot); assert.equal(g.random(), nextRandom);
    opts.enemyBenefits[0].supplyCrate = 0; opts.enemies[0] = 0;
    assert.equal(g.party(1).benefits.supplyCrate, 2); assert.equal(g.party(1).faction, 1);
    const state = g.s;
    for (const enemies of [[], [0, 1, 2, 0], [0, 3], [0, undefined]]) {
      assert.throws(() => g.start({ enemies })); assert.strictEqual(g.s, state);
    }
  }
});

test('opening factions are fixed and stage 4/8 entrants accumulate independent benefits', () => {
  assert.deepEqual([0, 1, 2].map(depth => Array.from(expeditionEnemyFactions(depth, () => 0.99))), [[0], [1], [2]]);
  assert.deepEqual([0, 1, 2, 3, 6, 7, 999999].map(expeditionEnemyCount), [1, 1, 1, 2, 2, 3, 3]);
  let perks = [{}];
  for (let depth = 1; depth <= 9; depth++) {
    const encounter = { seed: 1409 + depth, map: 'desert',
      enemies: Array.from({ length: expeditionEnemyCount(depth) }, (_, slot) => (depth + slot) % 3) };
    const before = JSON.stringify(perks);
    const next = advanceEnemyBenefits(perks, encounter, depth);
    assert.equal(JSON.stringify(perks), before);
    assert.deepEqual(Array.from(next, p => Object.values(p).reduce((sum, count) => sum + count, 0)),
      [depth, Math.max(0, depth - 3), Math.max(0, depth - 7)].slice(0, expeditionEnemyCount(depth)));
    assert.equal(JSON.stringify(next), JSON.stringify(advanceEnemyBenefits(perks, encounter, depth)));
    perks = next;
  }
  const streamChoices = [0, 1, 2].map(slot => Array.from({ length: 20 }, (_, seed) =>
    chooseEnemyBenefit(1, {}, seed + 1, 4, slot)).join(','));
  assert.equal(new Set(streamChoices).size, 3, 'same faction still has separate slot streams');
});

test('HQ elimination and expedition results do not leak into internal/network scenarios', () => {
  const { g, hqs } = battle(4, true);
  assert.equal('mission' in g.s.rules, false);
  hqs.forEach(h => { h.hp = 0; });
  g.checkBattleResult();
  assert.equal(g.s.result, null);
  assert.ok(g.s.parties.every(p => !p.eliminated));
});
