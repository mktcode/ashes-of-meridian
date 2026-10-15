import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as api from '@aom/crowd-simulation';
import { importGameMap, heightAt, createTerrainMesh } from '@aom/landscape';
import { createCrowdSurface, createProfileMask } from '@aom/landscape/crowd';
import { prepareSession } from '../dist/session.js';
const bytes=new Uint8Array(readFileSync(new URL('./fixtures/strata-417.zip',import.meta.url)));
const context=vm.createContext({});
vm.runInContext(readFileSync(new URL('../../crowd-simulation/demo/profiles.js',import.meta.url),'utf8'),context);
const profiles=vm.runInContext('CrowdProfiles',context);
const session=await prepareSession(bytes,api,profiles), {map,surface,navigation,masks,crowd}=session;
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
process.on('exit',()=>session.dispose());

test('adapter preserves exact rectangle, physical diagonals, heights and defensive ownership',async()=>{
  assert.deepEqual(surface.bounds,{minX:-260,maxX:260,minZ:-320,maxZ:320});
  assert.equal(surface.columns,260);assert.equal(surface.rows,320);assert.equal(surface.cellSize,2);
  assert.equal(surface.rowOrder,'decreasing-z');assert.equal(surface.diagonal,'b-c');assert.equal(surface.boundary,'reject');
  const mesh=createTerrainMesh(map);
  for(let k=0;k<260*320;k+=113) {
    const row=Math.floor(k/260),col=k%260;
    const slopes=[];
    for(const [u,v] of [[.17,.29],[.82,.67]]) {
      const x=-260+(col+u)*2,z=320-(row+v)*2;
      near(surface.heightAt(x,z),heightAt(map,x,z));
      const tri=u+v<=1?0:1;
      const [a,b,c]=Array.from(mesh.indices.subarray(k*6+tri*3,k*6+tri*3+3),i=>Array.from(mesh.vertices.subarray(i*6,i*6+3)));
      const e=b.map((n,i)=>n-a[i]),f=c.map((n,i)=>n-a[i]);
      const n=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]];
      slopes.push(Math.hypot(n[0],n[2])/Math.abs(n[1]));
      near(surface.slopeAt(x,z),slopes.at(-1));
    }
    near(surface.cellSlopeAt(-259+col*2,319-row*2),Math.max(...slopes));
  }
  for(const [x,z] of [[-260,320],[260,-320],[260,320],[-260,-320]])near(surface.heightAt(x,z),heightAt(map,x,z));
  assert.throws(()=>surface.heightAt(261,0),RangeError);
  assert.throws(()=>api.createNavigationWorld({surface,profiles,obstacles:[],cellSize:.5}),RangeError);
  const previous=map.heights[0]; map.heights[0]=999;
  assert.equal(surface.heightAt(-260,320),previous); map.heights[0]=previous;
});

test('cancelled preparation never constructs or installs a navigation world',async()=>{
  const controller=new AbortController();let release;
  const gate=new Promise(resolve=>{release=resolve;});
  class PendingBlob extends Blob { async arrayBuffer(){await gate;return super.arrayBuffer();} }
  const task=prepareSession(new PendingBlob([bytes]),{createHeightfield(){throw Error('must not build');}},profiles,controller.signal);
  controller.abort();release();
  await assert.rejects(task,{name:'AbortError'});
});

test('profile masks query actual Crowd clearance, never the radius-zero exported mask',()=>{
  assert.equal(api.canStand(navigation,'marine',NaN,0),false);
  assert.equal(api.canStand(navigation,'tank',260,320),false);
  assert.throws(()=>api.canStand({},'marine',0,0),TypeError);
  assert.throws(()=>api.canStand(navigation,'missing',0,0),RangeError);
  for(const profile of ['marine','tank']) {
    let excluded=0;
    for(let k=0;k<masks[profile].length;k++) {
      const x=-259+(k%260)*2,z=319-Math.floor(k/260)*2;
      assert.equal(Boolean(masks[profile][k]),api.canStand(navigation,profile,x,z));
      if(map.walkable[k]&&!masks[profile][k])excluded++;
    }
    assert.ok(excluded>0,'terrain mask must not be presented as body clearance');
    const independent=createProfileMask(map,navigation,profile,api.canStand);
    independent.fill(0);assert.ok(masks[profile].some(Boolean),'mask owns a copy');
  }
});

function connected(mask,start) {
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);
  const index=p=>Math.floor((320-p.z)/2)*260+Math.floor((p.x+260)/2);
  let head=0,tail=0;const first=index(start);assert.equal(mask[first],1);queue[tail++]=first;seen[first]=1;
  while(head<tail) {
    const k=queue[head++],x=k%260,z=Math.floor(k/260);
    for(const n of [x>0?k-1:-1,x<259?k+1:-1,z>0?k-260:-1,z<319?k+260:-1])
      if(n>=0&&mask[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}
  }
  return p=>Boolean(seen[index(p)]);
}
test('actual exported ascent, every branch/loop and both inner portals connect for both unchanged profiles',()=>{
  assert.ok(map.routes.some(r=>r.kind==='loop'));
  for(const profile of ['marine','tank']) {
    const reachable=connected(masks[profile],session.portals.south);
    assert.ok(reachable(session.portals.north));
    for(const route of map.routes) {
      let checked=0;
      for(let i=1;i<route.points.length;i++) {
        const a=route.points[i-1],b=route.points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);
        for(let n=0;n<=steps;n++) {
          const t=n/Math.max(1,steps),x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
          if(Math.abs(z)>316)continue; // External portals and the conservative border are not body centers.
          assert.ok(api.canStand(navigation,profile,x,z),`${profile} ${route.kind} clearance at ${x},${z}`);
          assert.ok(reachable({x,z}),`${profile} ${route.kind} belongs to the common component`);checked++;
        }
      }
      assert.ok(checked>0,`route ${route.kind} has an interior`);
    }
  }
});

function nearbyGoal(zOffset) {
  const target={x:session.portals.south.x,z:session.portals.south.z-zOffset};
  let best=null,distance=Infinity;
  for(let k=0;k<map.corridors.length;k++) if(map.corridors[k]&&masks.marine[k]&&masks.tank[k]) {
    const p={x:-259+(k%260)*2,z:319-Math.floor(k/260)*2},d=(p.x-target.x)**2+(p.z-target.z)**2;
    if(d<distance){best=p;distance=d;}
  }
  return best;
}
test('small Marine/tank groups reach real reserved places and interpolation never steps imported terrain',()=>{
  assert.equal(session.spawnComplete,true);assert.equal(crowd.size,10);
  assert.ok(crowd.command({kind:'move',group:0,destination:nearbyGoal(24)}).ok);
  assert.ok(crowd.command({kind:'move',group:1,destination:nearbyGoal(48)}).ok);
  let complete=false;
  for(let tick=0;tick<3600;tick++) {
    crowd.step();
    if(tick%30)continue;
    crowd.writeFrame(session.frame,1);
    for(let i=0;i<session.frame.count;i++) {
      const id=session.frame.ids[i],agent=crowd.getAgent(id);
      assert.equal(agent.y,surface.heightAt(agent.x,agent.z));
      assert.ok(api.canStand(navigation,crowd.getGroups()[agent.group].profile,agent.x,agent.z));
    }
    if(session.frame.states.subarray(0,10).every(state=>state===api.AgentState.Arrived)){complete=true;break;}
  }
  assert.ok(complete,'all 8 Marines and 2 tanks actually arrive, not just accepted commands');
  const before=JSON.stringify(Array.from(session.frame.ids.subarray(0,10),id=>crowd.getAgent(id))),tick=crowd.tick;
  for(const alpha of [0,.5,1]) {
    crowd.writeFrame(session.frame,alpha);
    for(let i=0;i<session.frame.count;i++)near(session.frame.positions[i*3+1],heightAt(map,session.frame.positions[i*3],session.frame.positions[i*3+2]));
  }
  for(let n=0;n<60;n++)crowd.step();
  assert.equal(JSON.stringify(Array.from(session.frame.ids.subarray(0,10),id=>crowd.getAgent(id))),before);
  assert.equal(crowd.tick,tick+60);assert.equal(crowd.getStats().reservations,10);
});
