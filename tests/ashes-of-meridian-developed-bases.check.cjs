// Synthetic fixture contracts only: no terrain generation, AI or simulation ticks.
const test = require('node:test');
const assert = require('node:assert/strict');
const { establishHeadquarters } = require('./helpers/developed-bases.cjs');

function fixture() {
  const resource = { id: 1, kind: 'resource', type: 'crystal', team: -1, hp: 100, amount: 1800 };
  const workers = [
    { id: 2, kind: 'unit', type: 'worker', team: 0, hp: 100, x: 0, z: 0 },
    { id: 3, kind: 'unit', type: 'worker', team: 1, hp: 100, x: 100, z: 100 }
  ];
  const parties = workers.map((w, id) => ({ id, faction: id + 1, deploymentPending: true,
    account: { alloy: 650, gas: 0, energy: 25 } }));
  const random = () => { random.state++; return .9; };
  random.state = 77;
  const rebuilds = [], reveals = [], sites = [];
  const game = {
    s: { entities: [resource, ...workers], parties, nextId: 4 },
    ids: new Map([resource, ...workers].map(e => [e.id, e])), random,
    alive(predicate) { return this.s.entities.filter(e => e.hp > 0 && predicate(e)); },
    cost: () => ({ cost: 400, gas: 0 }),
    afford: (c, team) => parties[team].account.alloy >= c.cost && parties[team].account.gas >= c.gas,
    canBuild(type, p, team) {
      assert.equal(type, 'hq');
      const worker = workers[team];
      if (Math.hypot(p.x - worker.x, p.z - worker.z) < 9) return 'Terrain obstructs the foundation.';
      sites.push({ team, ...p }); return '';
    },
    spawnBuilding(type, x, z, team, faction) {
      const home = { id: this.s.nextId++, kind: 'building', type, x, z, team, faction,
        hp: 2600, progress: 1, cd: this.random() * .5 };
      this.s.entities.push(home); this.ids.set(home.id, home); return home;
    },
    rehash() { this.indexed = [...this.s.entities]; },
    world: {
      staticGrid: new Uint8Array([0, 1, 0]), blocked: new Uint8Array([0, 1, 0]),
      rebuild(entities) { rebuilds.push([...entities]); }, reveal(entities) { reveals.push([...entities]); }
    }
  };
  return { game, random, parties, workers, resource, rebuilds, reveals, sites };
}

test('developed HQ fixture validates sites, consumes reserves and removes only landing workers without advancing RNG', () => {
  const f = fixture(), { game, random, resource, workers } = f;
  const grid = game.world.staticGrid, terrain = [...grid], resourceBefore = { ...resource };
  const homes = establishHeadquarters(game);
  assert.equal(homes.length, 2);
  assert.equal(game.random, random); assert.equal(random.state, 77);
  assert.equal(game.world.staticGrid, grid); assert.deepEqual([...grid], terrain);
  assert.deepEqual(resource, resourceBefore); assert.equal(game.ids.get(resource.id), resource);
  for (const home of homes) {
    const party = f.parties[home.team];
    assert.equal(home.type, 'hq'); assert.equal(home.progress, 1);
    assert.equal(home.faction, party.faction); assert.equal(home.cd, .25);
    assert.equal(party.deploymentPending, false);
    assert.deepEqual(party.account, { alloy: 250, gas: 0, energy: 25 });
    assert.ok(f.sites.some(p => p.team === home.team && p.x === home.x && p.z === home.z));
    assert.equal(game.ids.get(home.id), home);
  }
  for (const worker of workers) {
    assert.equal(game.ids.has(worker.id), false);
    assert.equal(game.s.entities.includes(worker), false);
  }
  assert.deepEqual(game.indexed, game.s.entities);
  assert.deepEqual(f.rebuilds.at(-1), game.s.entities);
  assert.deepEqual(f.reveals.at(-1), game.s.entities);
  assert.throws(() => establishHeadquarters(game), /requires fresh deployment/);
  assert.equal(game.random, random); assert.equal(random.state, 77);
});

test('developed HQ fixture rejects unsuitable terrain instead of falling back to an unchecked site', () => {
  const { game, random, parties } = fixture(), before = [...game.s.entities];
  game.canBuild = () => 'Terrain obstructs the foundation.';
  assert.throws(() => establishHeadquarters(game), /no valid HQ site for party 0/);
  assert.deepEqual(game.s.entities, before);
  assert.equal(parties[0].account.alloy, 650); assert.equal(parties[0].deploymentPending, true);
  assert.equal(game.random, random); assert.equal(random.state, 77);
});

test('developed HQ fixture restores RNG and indexes on a partial setup failure without claiming rollback', () => {
  const { game, random, parties, workers } = fixture();
  const spawn = game.spawnBuilding;
  game.spawnBuilding = function (...args) {
    if (args[3] === 1) throw Error('fixture spawn failed');
    return spawn.apply(this, args);
  };
  assert.throws(() => establishHeadquarters(game), /fixture spawn failed/);
  assert.equal(game.random, random); assert.equal(random.state, 77);
  assert.equal(parties[0].deploymentPending, false); assert.equal(parties[0].account.alloy, 250);
  assert.equal(parties[1].deploymentPending, true); assert.equal(parties[1].account.alloy, 650);
  assert.equal(game.ids.has(workers[0].id), false); assert.equal(game.ids.has(workers[1].id), true);
  assert.deepEqual(game.indexed, game.s.entities);
});
