// State/ownership contracts only: no battle generation, simulation ticks or browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', ...SIMULATION_SCRIPTS]);
const { MeridianGame, singlePlayerParties, scenarioSetup } = vm.runInContext('({MeridianGame, singlePlayerParties, scenarioSetup})', context);
vm.runInContext('Math.random = seeded = () => { throw Error("Unexpected RNG in party setup"); }', context);
const json = value => JSON.parse(JSON.stringify(value));

function state(profile = { upgrades: {} }, options = {}) {
  const game = Object.create(MeridianGame.prototype);
  game.s = { parties: singlePlayerParties(profile, options), entities: [], rules: { kind: 'single-player' }, stopped: false };
  return game;
}

test('party snapshots retain single-player defaults and isolate normalized benefits and fleet upgrades', () => {
  const defaults = singlePlayerParties({ upgrades: {} }, {});
  assert.deepEqual(Array.from(defaults, p => [p.id, p.faction]), [[0, 0], [1, 2]]);
  assert.deepEqual(json(defaults[0].account), {
    alloy: 250, gas: 0, energy: 25, abilities: { orbital: 0, repair: 0, scan: 0, drop: 0,
      disruption: 0, bulwark: 0, surge: 0, recall: 0 }
  });
  assert.deepEqual(json(defaults[0].loadout), ['orbital', 'repair', 'scan', 'drop']);
  assert.deepEqual(json(defaults[1].loadout), ['orbital', 'scan', 'disruption', 'recall']);
  assert.deepEqual(json(defaults[0].account), json(defaults[1].account));
  assert.notStrictEqual(defaults[0].account.abilities, defaults[1].account.abilities);
  const perks = { supplyCrate: 2, commandCapacitor: 99, fieldWorkshop: 1, unknown: 8 },
    profile = { upgrades: { startingAlloy: 99, logisticsFrame: 2.9, repairLogistics: -1, disruption: 2.9, unknown: 5 } },
    options = { faction: 1, enemies: [1], abilities: ['disruption', 'bulwark', 'surge', 'recall'],
      benefits: perks, enemyBenefits: [perks] },
    parties = singlePlayerParties(profile, options);
  assert.deepEqual(json(parties[0].meta), { startingAlloy: 5, logisticsFrame: 2, repairLogistics: 0, disruption: 2 });
  assert.deepEqual(json(parties[0].loadout), options.abilities);
  assert.deepEqual(json(parties[1].loadout), ['repair', 'drop', 'disruption', 'surge']);
  assert.deepEqual(json(parties[1].meta), {});
  assert.deepEqual(json(parties[0].benefits), { supplyCrate: 2, commandCapacitor: 2, fieldWorkshop: 1 });
  assert.deepEqual(json(parties[0].benefits), json(parties[1].benefits));
  assert.notStrictEqual(parties[0].benefits, parties[1].benefits);
  assert.equal(parties[0].account.alloy - parties[1].account.alloy, 250);
  profile.upgrades.startingAlloy = 0; perks.supplyCrate = 0; options.faction = 2;
  assert.equal(parties[0].meta.startingAlloy, 5);
  assert.equal(parties[0].benefits.supplyCrate, 2);
  assert.equal(parties[0].faction, 1);
  parties[0].fieldWorkshopUsed = true;
  assert.equal(parties[1].fieldWorkshopUsed, undefined);
  assert.equal(singlePlayerParties(profile, options)[0].fieldWorkshopUsed, undefined);
});

test('party accessors share one state, while accounts and upgrade effects remain separate', () => {
  const game = state({ upgrades: { logisticsFrame: 2 } }, { faction: 1, enemies: [2] });
  assert.strictEqual(game.account(0), game.party(0).account);
  assert.strictEqual(game.benefitsFor(1), game.party(1).benefits);
  assert.deepEqual([game.factionFor(0), game.factionFor(1)], [1, 2]);
  game.party(1).faction = 0;
  assert.equal(game.factionFor(1), 0);
  assert.ok(game.cap(0) > 0);
  assert.equal(game.cap(1), 0);
  const other = json(game.account(1));
  assert.equal(game.spend({ cost: 10, gas: 0 }, 0), true);
  assert.deepEqual(json(game.account(1)), other);
  assert.equal(game.account(0).alloy, 240);
});

test('command drill linearly buffs each faction basic infantry only near its living commander', () => {
  const game = state({ upgrades: {} }, { benefits: { commandDrill: 2 }, enemyBenefits: [{ commandDrill: 3 }] }),
    unit = (id, type, team, faction, x) => ({ id, type, team, faction, x, z: 0, hp: 100, kind: 'unit', kills: 0 }),
    commander = unit(1, 'hero', 0, 0, 0), rifle = unit(2, 'rifle', 0, 0, 11),
    enemyCommander = unit(3, 'hero', 1, 2, 50), enemyRifle = unit(4, 'rifle', 1, 2, 61),
    tank = unit(5, 'tank', 0, 0, 1);
  game.s.entities = [commander, rifle, enemyCommander, enemyRifle, tank];
  assert.equal(game.rangedStats(rifle).damage, 13 * 1.1);
  assert.equal(game.rangedStats(enemyRifle).damage, 13 * 1.12 * 1.15);
  assert.equal(game.rangedStats(tank).damage, 58);
  assert.equal(game.rangedStats(commander).damage, 31);
  for (const faction of [0, 1, 2]) {
    rifle.faction = faction;
    assert.equal(game.rangedStats(rifle).damage, 13 * (faction === 2 ? 1.12 : 1) * 1.1);
  }
  commander.x = -0.01;
  assert.equal(game.rangedStats(rifle).damage, 13 * 1.12);
  commander.x = 0; commander.hp = 0;
  assert.equal(game.rangedStats(rifle).damage, 13 * 1.12);
  commander.hp = 100; rifle.kills = 5;
  assert.equal(game.rangedStats(rifle).damage, 13 * 1.12 * 1.12 * 1.1);

  const withoutMandate = state({ upgrades: {} }, { benefits: { commandDrill: 37 } });
  withoutMandate.s.entities = [unit(6, 'rifle', 0, 0, 0)];
  assert.equal(withoutMandate.party(0).benefits.commandDrill, 37);
  assert.equal(game.party(0).benefits.commanderMandate, undefined);
  assert.equal(withoutMandate.rangedStats(withoutMandate.s.entities[0]).damage, 13);
});

test('controller assignment owns independent AI memory without altering faction, money or perks', () => {
  const game = state(), account = game.account(1), benefits = game.benefitsFor(1);
  assert.equal(game.aiFor(0), undefined);
  game.enableAI(1);
  const first = game.aiFor(1);
  assert.strictEqual(game.party(1).controller.state, first);
  game.enableAI(0);
  assert.notStrictEqual(game.aiFor(0), first);
  first.contacts[7] = { id: 7 };
  assert.equal(game.aiFor(0).contacts[7], undefined);
  game.enableAI(1);
  assert.notStrictEqual(game.aiFor(1), first);
  assert.equal(game.aiFor(1).contacts[7], undefined);
  game.party(1).controller = { kind: 'human' };
  assert.equal(game.aiFor(1), undefined);
  assert.strictEqual(game.account(1), account);
  assert.strictEqual(game.benefitsFor(1), benefits);
  assert.equal(game.factionFor(1), 2);
});

function scenario(count = 4) {
  return { seed: 1409, map: 'mothership', duration: 2,
    parties: Array.from({ length: count }, (_, id) => ({ faction: id % 3, controller: id === 2 ? 'ai' : 'human' })),
    hostilities: Array.from({ length: count }, (_, a) => Array.from({ length: count }, (_, b) => a !== b && (a + b) % 2 === 1)) };
}

test('internal scenarios snapshot 3–4 parties and require explicit hostility and duration', () => {
  for (const count of [3, 4]) {
    const options = scenario(count), setup = scenarioSetup(options);
    assert.deepEqual(Array.from(setup.parties, p => p.id), Array.from({ length: count }, (_, i) => i));
    assert.deepEqual(Array.from(setup.aiTeams), [2]);
    assert.ok(setup.parties.every(p => Object.keys(p.meta).length === 0));
    options.hostilities[0][1] = false;
    assert.equal(setup.rules.hostilities[0][1], true);
    const g = state(); g.s.parties = setup.parties; g.s.rules = setup.rules;
    for (const party of setup.parties) {
      assert.strictEqual(g.account(party.id), party.account);
      assert.equal(g.enemy({ team: party.id }, { team: -1 }), false);
      assert.equal(g.enemy({ team: party.id }, { team: party.id }), false);
    }
    assert.equal(g.enemy({ team: 0 }, { team: 1 }), true);
    assert.equal(g.enemy({ team: 0 }, { team: 2 }), false);
    assert.equal(g.enemy({ team: 2 }, { team: 1 }), true);
  }
  for (const invalid of [
    { duration: 0 }, { duration: Infinity }, { seed: 0 }, { map: 'missing' },
    { parties: scenario(1).parties }, { parties: scenario(5).parties },
    { parties: [{ faction: 4, controller: 'ai' }, ...scenario().parties.slice(1)] },
    { parties: [{ faction: 0, controller: 'remote' }, ...scenario().parties.slice(1)] },
    { hostilities: [] }, { hostilities: [[false]] }, { hostilities: new Array(4) },
    { parties: new Array(4) }, { hostilities: Array.from({ length: 4 }, () => new Array(4)) },
    { hostilities: scenario().hostilities.map(row => row.map(() => true)) }
  ]) assert.throws(() => scenarioSetup({ ...scenario(), ...invalid }));
  const asymmetric = scenario(); asymmetric.hostilities[0][1] = false;
  assert.throws(() => scenarioSetup(asymmetric));
});

test('scenario ownership stays separate from non-hostility and stopped scenarios reject commands', () => {
  const g = state(), setup = scenarioSetup(scenario());
  Object.assign(g.s, { parties: setup.parties, rules: setup.rules });
  const unit = team => ({ id: team + 1, team, hp: 100, kind: 'unit', type: 'rifle', size: 1, order: { type: 'idle' } });
  g.s.entities = [unit(0), unit(2), unit(3)];
  g.ids = new Map(g.s.entities.map(e => [e.id, e]));
  g.command([1, 3, 4], { type: 'hold' }, 2, false);
  assert.deepEqual(g.s.entities.map(e => e.order.type), ['idle', 'hold', 'idle']);
  // Non-hostility never grants medic support to someone else's units.
  g.s.entities.forEach(e => { e.maxHp = 100; e.hp = 50; });
  g.near = (x, z, radius, filter) => g.s.entities.filter(filter);
  g.medic({ id: 99, team: 2, x: 0, z: 0, cd: 1, order: { type: 'idle' } }, 1);
  assert.equal(g.s.entities[0].hp, 50);
  assert.ok(g.s.entities[1].hp > 50);
  assert.equal(g.s.entities[2].hp, 50);
  const before = json(g.s);
  g.checkBattleResult(); g.finish(true, 'not an expedition result');
  assert.deepEqual(json(g.s), before);
  g.s.stopped = true;
  const stopped = json(g.s);
  g.command([3], { type: 'stop' }, 2, false);
  assert.equal(g.train('worker', 2), false);
  assert.equal(g.build('depot', { x: 0, z: 0 }, [], 2), false);
  assert.equal(g.ability('scan', { x: 0, z: 0 }, 2), false);
  g.step(.05);
  assert.deepEqual(json(g.s), stopped);
});
