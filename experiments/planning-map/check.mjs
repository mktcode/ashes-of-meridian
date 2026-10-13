import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const core = readFileSync(new URL('./planning-core.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('./planning-view.js', import.meta.url), 'utf8');
const sandbox = vm.createContext({});
vm.runInContext(`${core}\n${view}`, sandbox);
const context = new Proxy({}, { get: () => () => {} });
for (const seed of [0, 2, 42, 4294967295]) {
  for (const curved of [false, true]) {
    for (const rounded of [false, true]) {
      const options = { curved, rounded };
      const plan = sandbox.makePlan(seed, options);
      assert.equal(JSON.stringify(plan), JSON.stringify(sandbox.makePlan(seed, options)));
      assert.equal(plan.regions.length, 19);
      assert.equal(plan.edges.filter((edge) => !edge.loop).length, 18);
      assert.equal(plan.edges.filter((edge) => edge.loop).length, 6);
      assert.equal(plan.landforms, undefined);
      const retained = new Set(plan.river.bridges.map((bridge) => bridge.key));
      const reachable = new Set([0]);
      const crossingKeys = new Set(plan.river.selected.map((edge) => edge.key));
      for (let pass = 0; pass < plan.regions.length; pass++) {
        for (const edge of plan.edges) {
          const key = sandbox.edgeKey(edge.a, edge.b);
          if (crossingKeys.has(key) && !retained.has(key)) continue;
          if (reachable.has(edge.a)) reachable.add(edge.b);
          if (reachable.has(edge.b)) reachable.add(edge.a);
        }
      }
      assert.equal(reachable.size, plan.regions.length, 'retained bridges connect all regions');
      for (const path of plan.river.curves) {
        for (let i = 1; i < path.length; i++) {
          assert.ok(path[i].height < path[i - 1].height, 'water flows downhill');
        }
      }
      for (const filled of [false, true]) {
        for (const dual of [false, true]) sandbox.drawNetwork(context, plan, filled, dual);
      }
    }
  }
}
console.log('Planning map: 16 deterministic plans, connectivity, downhill flow and drawing calls passed.');
