// Deployment snapshots, not established bases or worker-traffic endurance.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createGame } = require('./helpers/simulation-runtime.cjs');
const copy = (value) => JSON.parse(JSON.stringify(value));
const workers = (game, team = 0) => game.alive((e) => e.team === team && e.type === 'worker');

function rules(context) {
  return vm.runInContext(
    '({EXPEDITION_BENEFITS, STARTING_CINDER, BUILDINGS, UNITS, EXPEDITION_EFFECTS, UNIT_BODY_SCALE})',
    context,
  );
}
function publicWorld(game) {
  return {
    resources: copy(game.alive((e) => e.kind === 'resource')),
    terrain: Array.from(game.world.staticGrid),
    heights: Array.from(game.world.surface.heights),
  };
}

test('declared starting alloy ranks change only the account, not world generation or RNG', () => {
  const { game, context } = createGame(),
    api = rules(context),
    options = { seed: 1409, map: 'desert' };
  game.start(options);
  const world = publicWorld(game),
    entities = copy(game.s.entities),
    next = game.random();
  for (let rank = 0; rank <= 5; rank++) {
    game.start({ ...options, benefits: { startingAlloy: rank } });
    assert.equal(
      game.account(0).alloy,
      api.STARTING_CINDER + api.BUILDINGS.hq.cost + rank * api.EXPEDITION_EFFECTS.alloy,
    );
    assert.equal(game.account(0).gas, 0);
    assert.equal(game.party(0).benefits.startingAlloy || 0, rank);
    assert.deepEqual(publicWorld(game), world);
    assert.deepEqual(copy(game.s.entities), entities);
    assert.equal(game.random(), next);
  }
});

test('alloy upgrades are copied, normalized to current content bounds and reproduced on restart', () => {
  const { game, context } = createGame(),
    api = rules(context),
    benefits = { startingAlloy: 2 },
    options = { seed: 9897, faction: 1, benefits };
  game.start(options);
  const before = copy(game.s);
  benefits.startingAlloy = 5;
  assert.deepEqual(copy(game.s), before);
  assert.notStrictEqual(game.party(0).benefits, benefits);
  game.start(options);
  assert.equal(game.party(0).benefits.startingAlloy, 5);
  const restarted = copy(game.s);
  game.start(options);
  assert.deepEqual(copy(game.s), restarted);
  const maximum = api.EXPEDITION_BENEFITS.startingAlloy.max;
  for (const [value, rank] of [
    [-2, 0],
    ['3.9', 3],
    [maximum + 1, maximum],
    ['bad', 0],
  ]) {
    game.start({ ...options, benefits: { startingAlloy: value } });
    assert.equal(game.party(0).benefits.startingAlloy || 0, rank);
    assert.equal(
      game.account(0).alloy,
      api.STARTING_CINDER + api.BUILDINGS.hq.cost + rank * api.EXPEDITION_EFFECTS.alloy,
    );
  }
});

for (const faction of [0, 1, 2])
  test(`bonus workers supplement landing deployment with preserved world and RNG ordering: faction ${faction}`, () => {
    const { game, context } = createGame(),
      api = rules(context),
      options = { seed: 1409, faction, map: 'desert' };
    game.start(options);
    const world = publicWorld(game),
      baseAccount = copy(game.account(0)),
      home = game.startingPositions(options.seed)[0];
    const cooldownSamples = [workers(game)[0].cd, workers(game, 1)[0].cd];
    const nextSamples = Array.from({ length: 7 }, () => game.random());
    cooldownSamples.push(...nextSamples.map((value) => value * 0.5));
    for (let rank = 0; rank <= 5; rank++) {
      game.start({ ...options, benefits: { startingWorkers: rank } });
      const own = workers(game);
      assert.equal(own.length, rank + 1, 'bonus workers plus one landing worker');
      assert.equal(workers(game, 1).length, 1, 'no player upgrades for the enemy');
      assert.equal(game.alive((e) => e.kind === 'building').length, 0);
      assert.equal(game.party(0).deploymentPending, true);
      assert.equal(game.account(0).alloy, baseAccount.alloy);
      assert.equal(game.account(0).gas, baseAccount.gas);
      assert.equal(game.s.stats.trained, 0);
      assert.equal(game.supply(), own.length * (api.UNITS.worker.supply || 0));
      assert.equal(game.cap(), 0, 'HQ capacity is unavailable before construction');
      assert.deepEqual(publicWorld(game), world);
      assert.equal(
        game.random(),
        nextSamples[rank],
        'exactly one extra spawn draw per bonus worker',
      );
      for (const [i, worker] of own.entries()) {
        assert.equal(worker.cd, cooldownSamples[i]);
        assert.equal(worker.faction, faction);
        assert.equal(worker.hp, worker.maxHp);
        assert.equal(worker.order.type, 'idle');
        assert.equal(worker.exit, undefined);
        assert.ok(game.unitFits(worker, worker.x, worker.z));
        assert.ok(Math.hypot(worker.x - home.x, worker.z - home.z) <= 20);
      }
      const all = game.alive((e) => e.kind === 'unit');
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++)
          assert.ok(
            Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z) + 1e-8 >=
              (all[i].size + all[j].size) * api.UNIT_BODY_SCALE,
          );
    }
  });

test('worker upgrade input is bounded, copied and applied only to the next deployment', () => {
  const { game } = createGame(),
    benefits = { startingWorkers: 2 },
    options = { seed: 9897, faction: 1, benefits };
  game.start(options);
  const before = copy(game.s);
  benefits.startingWorkers = 5;
  assert.deepEqual(copy(game.s), before);
  assert.notStrictEqual(game.party(0).benefits, benefits);
  game.start(options);
  assert.equal(workers(game).length, 6);
  const restarted = copy(game.s);
  game.start(options);
  assert.deepEqual(copy(game.s), restarted);
  for (const [value, rank] of [
    [-2, 0],
    ['3.9', 3],
    [99, 5],
    ['bad', 0],
  ]) {
    game.start({ ...options, benefits: { startingWorkers: value } });
    assert.equal(game.party(0).benefits.startingWorkers || 0, rank);
    assert.equal(workers(game).length, rank + 1);
  }
});

test('declared benefits and upgrades combine without granting the enemy player bonuses', () => {
  const { game, context } = createGame(),
    api = rules(context);
  game.start({
    seed: 1409,
    faction: 1,
    upgrades: { logisticsFrame: 2 },
    benefits: {
      startingAlloy: 3,
      aetherAllocation: 2,
      startingWorkers: 5,
      commanderMandate: 1,
      unknown: 99,
    },
  });
  assert.deepEqual(copy(game.party(0).benefits), {
    startingAlloy: 3,
    aetherAllocation: 2,
    startingWorkers: 5,
    commanderMandate: 1,
  });
  const base = api.STARTING_CINDER + api.BUILDINGS.hq.cost;
  assert.deepEqual(
    [game.account(0).alloy, game.account(0).gas],
    [base + 3 * api.EXPEDITION_EFFECTS.alloy, 100],
  );
  assert.deepEqual([game.account(1).alloy, game.account(1).gas], [base, 0]);
  assert.equal(workers(game).length, 6);
  assert.equal(workers(game, 1).length, 1);
  assert.equal(game.alive((e) => e.team === 0 && e.type === 'hero').length, 1);
  assert.equal(game.alive((e) => e.team === 1 && e.type === 'hero').length, 0);
});
