// Short FFA rule contracts, no autonomous battles or long simulation runs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', ...SIMULATION_SCRIPTS]);
const { MeridianGame, scenarioSetup } = vm.runInContext('({ MeridianGame, scenarioSetup })', context);

function battle(count = 4, scenario = false) {
  const events = [], g = new MeridianGame({ upgrades: {} }, (type, data) => events.push({ type, data }));
  const opts = { seed: 1409, map: 'desert', duration: 1,
    parties: Array.from({ length: count }, () => ({ faction: 1, controller: 'ai' })),
    hostilities: Array.from({ length: count }, (_, a) => Array.from({ length: count }, (_, b) => a !== b)) };
  const setup = scenarioSetup(opts);
  g.startBattle(opts, setup.parties, scenario ? setup.rules : { kind: 'single-player' }, setup.aiTeams);
  const hqs = g.alive(e => e.type === 'hq');
  events.length = 0;
  return { g, hqs, events };
}

test('FFA hostility is symmetric for every party, even with identical factions; resources stay neutral', () => {
  const { g } = battle();
  for (const a of [-1, 0, 1, 2, 3]) for (const b of [-1, 0, 1, 2, 3])
    assert.equal(g.enemy({ team: a }, { team: b }), a >= 0 && b >= 0 && a !== b);
  for (const p of g.s.parties) assert.ok(g.aiFor(p.id));
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
  assert.equal(g.s.stats.kills, 0); assert.equal(g.s.result, null);
  assert.equal(g.s.fields.length, 0); assert.equal(g.s.scans.length, 0);
  assert.equal(g.s.strikes.length, 1, 'already launched strikes survive');
  assert.equal(g.executeAction(2, { kind: 'ability', ability: 'scan', position: { x: 0, z: 0 } }), false);
  assert.equal(g.ability('scan', { x: 0, z: 0 }, 2), false);
  const nextThink = g.aiFor(2).nextThink; g.aiTick(2);
  assert.equal(g.aiFor(2).nextThink, nextThink);
  assert.deepEqual(events, [{ type: 'alert', data: { text: 'Opponent 2 eliminated.' } }]);
  g.checkBattleResult(); assert.equal(events.length, 1, 'elimination is announced only once');
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

test('HQ elimination and expedition results do not leak into internal/network scenarios', () => {
  const { g, hqs } = battle(4, true);
  hqs.forEach(h => { h.hp = 0; });
  g.checkBattleResult();
  assert.equal(g.s.result, null);
  assert.ok(g.s.parties.every(p => !p.eliminated));
});
