const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadScripts} = require('./helpers/game-scripts.cjs');
const context = loadScripts(['world-view']);
const scene = vm.runInContext('savedBattleMenuScene', context);
const building = (id,x,z,hp=100) => ({id,kind:'building',type:'hq',x,z,hp});
const expedition = entities => ({encounter:{map:'desert',seed:123},battle:{state:{entities,time:47,cam:{x:9,z:12}}}});
const plain = value => JSON.parse(JSON.stringify(value));

test('menu uses the saved army and centers the densest living building group without mutating it', () => {
  const save = expedition([building(1,-100,-100),building(2,60,80),building(3,70,80),building(4,65,90),
    building(5,-100,-100,0),{id:6,kind:'unit',type:'air',x:61,z:85,hp:10}]);
  const before = JSON.stringify(save), result = scene(save,'desert',123);
  assert.deepEqual(plain(result.center),{x:65,z:250/3});
  assert.equal(result.time,47);
  assert.deepEqual(result.entities.map(e=>e.id).join(','),'1,2,3,4,6');
  result.entities[4].z = 999;
  assert.equal(JSON.stringify(save),before,'render copies must not move saved aircraft');
});

test('missing, abandoned, transition and archived battles show no synthetic army', () => {
  for (const save of [null,{encounter:{map:'desert',seed:123},battle:null}])
    assert.deepEqual(plain(scene(save,'desert',123)),{entities:[],center:{x:0,z:0},time:0});
  const save = expedition([building(1,40,70)]);
  assert.equal(scene(save,'desert',124).entities.length,0);
  assert.equal(scene(save,'westmark',123).entities.length,0);
});

test('a saved battle without buildings uses its saved camera; density ties are stable', () => {
  assert.deepEqual(plain(scene(expedition([]),'desert',123).center),{x:9,z:12});
  const save = expedition([building(1,100,100),building(2,-100,-100)]);
  assert.deepEqual(plain(scene(save,'desert',123).center),{x:100,z:100});
});
