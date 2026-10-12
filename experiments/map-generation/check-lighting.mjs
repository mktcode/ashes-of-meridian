import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadLab } from './test-support.mjs';
const context=loadLab({scripts:['terrain-core','terrain-decoration','terrain-materials','terrain-lighting'],globals:{assert}});
vm.runInContext(`(()=>{
  assert.equal(typeof document,'undefined');
  const mesh={vertices:[{x:-150,y:-150,z:-20},{x:150,y:150,z:45},{x:150,y:-150,z:0},{x:-150,y:150,z:10}]};
  const trees=makeTreeGeometry([{x:150,y:150,height:40,type:'broadleaf',size:1,rotation:.4},{x:170,y:150,height:40,type:'conifer',size:1,rotation:0}]);
  const normals=treeSurfaceNormals(trees);assert.equal(normals.length,trees.length/7*3);
  assert.ok(normals.every(Number.isFinite));
  for(let i=0;i<normals.length;i+=3){const length=Math.hypot(...normals.subarray(i,i+3));assert.ok(length<1e-7 || Math.abs(length-1)<1e-6);}
  const before=JSON.stringify(mesh),bounds=shadowBounds(mesh,trees);
  for(let hour=0;hour<=24;hour+=.25){
    const day=labLighting(hour),matrix=shadowProjection(bounds,day.direction);
    assert.ok(Math.abs(Math.hypot(...day.direction)-1)<1e-12);
    assert.ok([...day.ambient,...day.sun,...day.background,...matrix].every(Number.isFinite));
    for(let mask=0;mask<8;mask++){
      const p=bounds.min.map((v,i)=>mask&(1<<i)?bounds.max[i]:v);
      for(let axis=0;axis<3;axis++){
        const projected=matrix[12+axis]+p.reduce((s,v,i)=>s+matrix[i*4+axis]*v,0);
        assert.ok(Math.abs(projected)<1,'All caster bounds fit the shadow projection');
      }
    }
    const p=day.direction.map(v=>v*10);
    assert.ok(p.reduce((s,v,i)=>s+matrix[i*4+2]*v,0)<0,'Closer to the light means smaller depth');
  }
  assert.equal(JSON.stringify(mesh),before);
  assert.deepEqual(labLighting(0),labLighting(24));
  assert.ok(labLighting(12).ambient[0]>labLighting(0).ambient[0]);
  assert.ok(labLighting(15).sun[0]>labLighting(0).sun[0]);
  assert.equal(labLighting(6).sun.reduce((s,v)=>s+v,0),0);
  assert.ok(terrainLightingGLSL().includes('shadowFor'));
})()`,context,{timeout:1000});
console.log('Lighting: finite day/night colors/directions, safe shadow projection at 97 times, normalized tree normals and read-only bounds OK. No generated terrain, texture baking or navigation audit.');
