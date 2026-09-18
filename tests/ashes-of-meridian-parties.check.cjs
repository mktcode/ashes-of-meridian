// State/ownership contracts only: no battle generation, simulation ticks or browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', 'world', ...SIMULATION_SCRIPTS]);
const { MeridianGame, singlePlayerParties } = vm.runInContext('({MeridianGame, singlePlayerParties})', context);
vm.runInContext('Math.random = seeded = () => { throw Error("Unexpected RNG in party setup"); }', context);
const json = value => JSON.parse(JSON.stringify(value));

function state(profile = { upgrades: {} }, options = {}) {
  const game = Object.create(MeridianGame.prototype);
  game.s = { parties: singlePlayerParties(profile, options), entities: [] };
  return game;
}

test('party snapshots retain single-player defaults and isolate normalized benefits and fleet upgrades', () => {
  const defaults = singlePlayerParties({ upgrades: {} }, {});
  assert.deepEqual(Array.from(defaults, p => [p.id, p.faction]), [[0, 0], [1, 2]]);
  assert.deepEqual(json(defaults[0].account), {
    alloy: 250, gas: 0, energy: 25, abilities: { orbital: 0, repair: 0, scan: 0, drop: 0 }
  });
  assert.deepEqual(json(defaults[0].account), json(defaults[1].account));
  assert.notStrictEqual(defaults[0].account.abilities, defaults[1].account.abilities);
  const perks = { supplyCrate: 2, commandCapacitor: 99, fieldWorkshop: 1, unknown: 8 },
    profile = { upgrades: { startingAlloy: 99, logisticsFrame: 2.9, repairLogistics: -1, unknown: 5 } },
    options = { faction: 1, enemy: 1, benefits: perks, enemyBenefits: perks },
    parties = singlePlayerParties(profile, options);
  assert.deepEqual(json(parties[0].meta), { startingAlloy: 5, logisticsFrame: 2, repairLogistics: 0 });
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
  const game = state({ upgrades: { logisticsFrame: 2 } }, { faction: 1, enemy: 2 });
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
