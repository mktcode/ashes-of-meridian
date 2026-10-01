import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createMultiplayerServer } from '../dist/server.js';

test('procedural Haven starts with filtered Workers and rejects the previous terrain protocol', async t => {
  const server=createMultiplayerServer({tickIntervalMs:100000});
  server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
  t.after(()=>server.close());
  const url=`ws://127.0.0.1:${server.http.address().port}`;
  async function connect() {
    const ws=new WebSocket(url,{origin:'null'}),messages=[],waiters=new Set();
    ws.on('message',raw=>{messages.push(JSON.parse(raw));for(const wake of waiters)wake();});
    await once(ws,'open');t.after(()=>ws.terminate());
    return {send:data=>ws.send(JSON.stringify(data)),receive:predicate=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{waiters.delete(check);reject(Error('Missing protocol message'));},10000);
      function check(){const i=messages.findIndex(predicate);if(i<0)return;
        clearTimeout(timer);waiters.delete(check);resolve(messages.splice(i,1)[0]);}
      waiters.add(check);check();
    })};
  }
  const old=await connect();old.send({type:'create',version:4,map:'haven',faction:0});
  assert.equal((await old.receive(m=>m.type==='error')).type,'error');
  const host=await connect(),guest=await connect();
  host.send({type:'create',version:5,map:'haven',faction:0});
  const waiting=await host.receive(m=>m.type==='waiting');
  guest.send({type:'join',version:5,code:waiting.code,faction:2});
  const a=await host.receive(m=>m.type==='start'),b=await guest.receive(m=>m.type==='start');
  assert.equal(a.version,5);assert.equal(a.map,'haven');assert.equal(a.seed,b.seed);
  assert.equal(a.startSeed,undefined);assert.equal(b.startSeed,undefined);
  host.send({type:'ready'});guest.send({type:'ready'});
  for(const [client,team]of [[host,0],[guest,1]]) {
    const frame=await client.receive(m=>m.type==='frame');
    assert.equal(frame.tick,0,'opening projection requires no autonomous ticks');
    assert.equal(frame.entities.filter(e=>e.type==='hq').length,0);
    assert.equal(frame.entities.filter(e=>e.team===team&&e.type==='worker').length,1);
    assert.ok(!frame.entities.some(e=>e.team===1-team));
    assert.ok(frame.party.account.alloy>=400);
  }
});
