const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadScripts} = require('./helpers/game-scripts.cjs');

test('game and viewer keep every viewport corner inside finite scenery at all heights, headings and sizes', () => {
  const context = loadScripts(['core', 'content', 'world', 'ui-core', 'ui-actions'], {globals:{innerHeight:800}}),
    constrain = vm.runInContext('constrainSceneryCamera', context),
    extent = 260, low = -20, high = 70,
    world = {extent:160,surface:{maxHeight:high},renderData:{geometries:[
      {relief:{extent,heights:new Float32Array([low,high])}}
    ]}}, before = JSON.stringify(world);
  for (const viewing of [false,true]) for (const [width,height] of [[1280,800],[400,800],[3200,600]]) {
    const ui = {viewing,R:{viewport:{width,height}},game:{world,s:{cam:{}}}};
    for (const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,-.71])
      for (const zoom of [27.2,115,10000]) for (const x of [-10000,0,10000]) for (const z of [-10000,0,10000]) {
        const cam = ui.game.s.cam = {zoom,yaw}, p = constrain(ui,{x,z}),
          screenHeight = viewing ? height : 800,
          halfX = cam.zoom*width/screenHeight/2,
          halfZ = cam.zoom*height/screenHeight/2*Math.hypot(1.1,.82)/1.1;
        assert.ok(cam.zoom>0&&cam.zoom<=zoom);
        for (const u of [-halfX,halfX]) for (const w of [-halfZ,halfZ]) for (const y of [low,high]) {
          const shift = y*.82/1.1,
            px = p.x+Math.cos(yaw)*u+Math.sin(yaw)*(w+shift),
            pz = p.z-Math.sin(yaw)*u+Math.cos(yaw)*(w+shift);
          assert.ok(Math.abs(px)<=extent-2+1e-8,`x=${px}, yaw=${yaw}`);
          assert.ok(Math.abs(pz)<=extent-2+1e-8,`z=${pz}, yaw=${yaw}`);
        }
      }
  }
  assert.equal(JSON.stringify(world),before,'camera changes never alter the playable world');
});

test('resize, rotation and world changes recompute the finite zoom and pan envelope', () => {
  const context = loadScripts(['core','content','world','ui-core','ui-actions'],{globals:{innerHeight:800}}),
    constrain = vm.runInContext('constrainSceneryCamera',context),
    ui = {viewing:true,R:{viewport:{width:800,height:800}},
      game:{world:{extent:160,surface:{maxHeight:0}},s:{cam:{zoom:10000,yaw:0}}}};
  const initial = constrain(ui,{x:10000,z:10000}), firstZoom=ui.game.s.cam.zoom;
  assert.ok(initial.x<160&&initial.z<160);
  ui.R.viewport.width=2400;constrain(ui,initial);
  assert.ok(ui.game.s.cam.zoom<firstZoom,'wide windows cannot see beyond the edge');
  ui.game.s.cam.zoom=10000;ui.game.s.cam.yaw=Math.PI/4;constrain(ui,initial);
  assert.ok(ui.game.s.cam.zoom<firstZoom);
  ui.game.world={extent:80,surface:{maxHeight:0}};ui.game.s.cam.zoom=10000;
  constrain(ui,initial);assert.ok(ui.game.s.cam.zoom<100);
});
