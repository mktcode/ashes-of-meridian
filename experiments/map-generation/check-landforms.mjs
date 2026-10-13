import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadLab } from './test-support.mjs';

// Small real-plan probes plus synthetic profile/refinement contracts. Full
// mesh/raster validation lives in the bounded single-seed browser check.
const context = loadLab({ globals: { assert } });
vm.runInContext(`
  assert.equal(typeof document, 'undefined');
  for (const seed of [1, 2, 19, 16053245]) {
    const plan = makePlan(seed), old = makePlan(seed, true, true, false), copy = makePlan(seed), straight = makePlan(seed, false);
    assert.equal(JSON.stringify(plan.landforms), JSON.stringify(copy.landforms));
    assert.equal(JSON.stringify(plan.landforms), JSON.stringify(straight.landforms));
    assert.equal(JSON.stringify(plan.regions), JSON.stringify(old.regions));
    assert.equal(JSON.stringify(plan.edges), JSON.stringify(old.edges));
    assert.equal(JSON.stringify(plan.river), JSON.stringify(old.river));
    assert.equal(JSON.stringify(plan.waves), JSON.stringify(old.waves));
    assert.ok(plan.landforms.mesas.length <= 4);
    assert.ok(plan.landforms.rocks.length <= 72);
    assert.equal(old.landforms.mesas.length, 0);
    assert.equal(old.landforms.rocks.length, 0);
    assert.equal(old.landforms.terraced, false);
    const before = JSON.stringify(plan);
    const protectedProbes = [
      ...plan.regions.flatMap(r => [r, ...r.points.filter((_, i) => i % 8 === 0)]),
      ...plan.edges.flatMap(e => [e.points[0].source, e.points[Math.floor(e.points.length / 2)].source, e.points.at(-1).source]),
      ...plan.river.paths.flatMap(points => Array.from({length:16}, (_,i) => points[Math.floor(i * (points.length - 1) / 15)]))
    ];
    for (const p of protectedProbes) {
      const a = sample(plan, p.x, p.y), b = sample(old, p.x, p.y);
      assert.equal(a.planned, b.planned);
      assert.equal(a.height, b.height);
      assert.equal(a.deckHeight, b.deckHeight);
      assert.equal(a.water, b.water);
    }
    for (let y = 20; y < SIZE; y += 35) for (let x = 20; x < SIZE; x += 35) {
      const a = sample(plan, x, y), b = sample(old, x, y);
      assert.ok(Number.isFinite(a.height)); assert.equal(a.planned, b.planned);
      assert.equal(a.referenceHeight, b.referenceHeight);
    }
    for (const rock of plan.landforms.rocks) {
      const s = sampleLand(plan, rock.x, rock.y);
      assert.ok(!s.planned && s.clearance > NOISE_MARGIN + rock.radius * 1.35);
      assert.ok(s.riverGap > RIVER_SUPPORT + rock.radius * 1.35);
      assert.ok(!rockClearance(plan, rock.x, rock.y));
    }
    for (const mesa of plan.landforms.mesas) {
      assert.ok(mesa.members.length <= 4);
      const t = mesa.terraces;
      assert.equal(t.steps.length, 3); assert.ok(t.crowns.length >= 2 && t.crowns.length <= 3);
      assert.ok(Math.abs(t.steps.reduce((sum, s) => sum + s.drop, 0) - .84) < 1e-12);
      let previousHeight = Infinity;
      for (let i = 0; i <= 200; i++) {
        const h = terraceProfile(t, i * 1.38 / 200);
        assert.ok(h <= previousHeight + 1e-12 && h >= 0 && h <= 1); previousHeight = h;
      }
      for (let i = 0; i < 2; i++) {
        const a = t.steps[i], b = t.steps[i + 1], left = a.edge + a.width, gap = b.edge - left;
        assert.ok(gap > .1, 'Broad shelves between short risers');
        assert.ok(Math.abs(terraceProfile(t, left + gap * .75) - terraceProfile(t, left + gap * .25)) < .02);
        assert.ok(terraceProfile(t, a.edge) - terraceProfile(t, a.edge + a.width) > a.drop * .9);
      }
      for (let dy = -mesa.width; dy <= mesa.width; dy += 3) for (let dx = -mesa.width; dx <= mesa.width; dx += 3) {
        const p = mesa.segments[0].a, x = p.x + dx, y = p.y + dy, q = mesaCoordinate(mesa, x, y), h = terracedMesaHeight(mesa, x, y, q);
        assert.ok(h >= 0 && h <= 1, 'Nested crowns share one bounded height budget');
      }
      // Conservative bounds must cut off only zero-support samples.
      for (let i = 0; i < 16; i++) {
        const y = mesa.bounds.minY + (mesa.bounds.maxY - mesa.bounds.minY) * i / 15;
        const x = mesa.bounds.minX + (mesa.bounds.maxX - mesa.bounds.minX) * i / 15;
        for (const [px, py] of [[mesa.bounds.minX,y],[mesa.bounds.maxX,y],[x,mesa.bounds.minY],[x,mesa.bounds.maxY]]) {
          const q = mesaCoordinate(mesa, px, py);
          assert.equal(mesaProfile(q), 0);
          assert.equal(terracedMesaHeight(mesa, px, py, q), 0);
        }
      }
    }
    assert.equal(JSON.stringify(plan), before, 'Height queries must not mutate the plan or draw RNG');
  }
  assert.equal(highlandWeight(35), 0); assert.equal(highlandWeight(45), 1);
  let previous = Infinity;
  for (let i = 0; i <= 200; i++) {
    const h = mesaProfile(i * 1.38 / 200);
    assert.ok(h <= previous + 1e-12 && h >= 0 && h <= 1); previous = h;
  }
  assert.equal(mesaProfile(Infinity), 0);
  assert.ok(mesaProfile(.5) > .96 && mesaProfile(1) < .1);
  const p = makePlan(2), mesa = p.landforms.mesas[0], root = mesa.segments[0].a;
  assert.ok(sampleLand(p, root.x, root.y).height - sampleLand(p, root.x, root.y).referenceHeight > 15);
  for (const height of [20, 35, 40, 45, 70]) {
    assert.equal(sampleLandforms(p, root.x, root.y, height, NOISE_MARGIN, 100), 0);
    assert.equal(sampleLandforms(p, root.x, root.y, height, 100, 4), 0);
  }
  // Lowland relief cannot turn into a mountain, even inside a mesa footprint.
  assert.ok(Math.abs(sampleLandforms(p, root.x, root.y, 30, 100, 100)) <= 4.4);
  assert.ok(sampleLandforms(p, root.x, root.y, 50, 100, 100) > 20);
  const single = makePlan(2, true, true, true, false);
  assert.equal(JSON.stringify(p.landforms.mesas), JSON.stringify(single.landforms.mesas), 'Terrace RNG does not move/resize parent mesas');
  assert.equal(JSON.stringify(p.regions), JSON.stringify(single.regions));
  assert.equal(JSON.stringify(p.river), JSON.stringify(single.river));
  assert.equal(sampleLand(p, root.x, root.y).referenceHeight, sampleLand(single, root.x, root.y).referenceHeight);
  assert.ok(p.landforms.mesas.some(m => [0,1,2,3].some(i => {
    const a = m.segments[0].a, x = a.x + 2 * Math.cos(i * Math.PI / 2), y = a.y + 2 * Math.sin(i * Math.PI / 2);
    return sampleLand(p, x, y).height !== sampleLand(single, x, y).height;
  })), 'Terraces change real free-space relief, not protected anchors');
  const freeMesa = p.landforms.mesas.slice().sort((a,b)=>b.segments[0].a.clearance-a.segments[0].a.clearance)[0], freeRoot = freeMesa.segments[0].a,
    flat = { ...freeMesa, terraces: { ...freeMesa.terraces, crowns: [{x:freeRoot.x,y:freeRoot.y,radius:5,seed:8,height:.28,edge:.57,width:.2}] } },
    flatPlan = {...p,landforms:{...p.landforms,mesas:[flat]}};
  assert.ok(landformDetail(flatPlan, freeRoot.x + 3.3, freeRoot.y, 1), 'Crown cliffs refine even inside the quiet parent top');
  assert.equal(landformDetail(flatPlan, freeRoot.x, freeRoot.y, 1), false);
  // A buffer-clipped flank must still have shelves, not slope them by
  // multiplying all tiers by a smooth clearance mask AFTER shaping them.
  const shelfPlan = {...p,landforms:{...p.landforms,mesas:[freeMesa]}}, t = freeMesa.terraces,
    qs = [t.steps[1].edge + t.steps[1].width + .02, t.steps[2].edge - .02], heights = [];
  for(const q of qs) {
    let low=NOISE_MARGIN, high=NOISE_MARGIN+4;
    for(let i=0;i<40;i++) { const d=(low+high)/2; if(landformProtection(d,100)<1-q/1.38)low=d;else high=d; }
    const d=(low+high)/2, protection=landformProtection(d,100), forms=p.landforms,
      hills=3.2*landNoise(forms.seed,freeRoot.x/32,freeRoot.y/32)+1.2*landNoise(forms.seed^17,freeRoot.x/15,freeRoot.y/15);
    heights.push(sampleLandforms(shelfPlan,freeRoot.x,freeRoot.y,50,d,100)-protection*.2*hills);
  }
  assert.ok(Math.abs(heights[0]-heights[1])<1e-8, 'Protected-boundary shelves retain a constant mountain contribution');
  // Conforming cliff refinement: every interior split is shared by neighbors.
  const vertices = [{x:0,y:0,sourceX:0,sourceY:0}, {x:2,y:0,sourceX:2,sourceY:0},
    {x:0,y:2,sourceX:0,sourceY:2}, {x:2,y:2,sourceX:2,sourceY:2}];
  const patch = { river:{spatial:riverSpatialTree([])}, landforms:{enabled:true,mesas:[{
    width:1,phase:0,seed:1,bounds:{minX:140,maxX:160,minY:140,maxY:160},
    segments:[{a:{x:150,y:150},b:{x:150,y:150}}]
  }]} };
  const faces = refineTerrain(patch,vertices,[[0,1,2],[1,3,2]],(x,y) => {
    vertices.push({x,y,sourceX:x,sourceY:y});return vertices.length-1;
  });
  assert.ok(faces.length > 2);
  const edges = new Map();
  for (const f of faces) for (let j=0;j<3;j++) {
    const a=f[j],b=f[(j+1)%3],key=edgeKey(a,b);edges.set(key,(edges.get(key)||0)+1);
  }
  for (const [key,count] of edges) {
    assert.ok(count===1 || count===2);
    if (count===1) {
      const [a,b]=key.split(':').map(i=>vertices[Number(i)]);
      assert.ok((a.x===b.x && (a.x===0 || a.x===2)) || (a.y===b.y && (a.y===0 || a.y===2)), 'No hanging interior edges');
    }
  }
  const rockMesh={vertices:[],triangles:[]};
  addRockOutcrops(p,rockMesh.vertices,rockMesh.triangles, sample);
  assert.ok(rockMesh.triangles.length > 0);
  assert.ok(rockMesh.triangles.every(t=>t.rock && !t.planned));
  assert.ok(rockMesh.vertices.every(p=>Number.isFinite(p.z) && Number.isFinite(p.light)));
  assert.equal(auditSurface(rockMesh),0,'Visual rocks must not enter walkable slope audits');
`, context, { timeout: 25000 });
console.log('Landforms: deterministic independent planning, exact protected heights/topology/water, lowland/highland profiles, broad terrace shelves and bounded nested crowns, independent terrace RNG, bounded support, shared cliff refinement and non-playable rocks OK.');
