import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { withBrowser } from '../../../scripts/browser/harness.mjs';
import { chromium } from 'playwright-core';

const root=fileURLToPath(new URL('../../../',import.meta.url));
await withBrowser(root, async browser => {
  console.log('Terrain browser: creating page');
  const page=await browser.newPage({viewport:{width:1280,height:1100}}),errors=[],network=[];
  page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(...args){
      const gl=get.apply(this,args);if(args[0]!=='webgl2'||!gl)return gl;
      const draw=gl.drawElements.bind(gl);
      gl.drawElements=(...values)=>{window.terrainVao=gl.getParameter(gl.VERTEX_ARRAY_BINDING);window.terrainCount=values[1];return draw(...values);};
      return gl;
    };
  });
  const release=process.argv.includes('--release');
  console.log('Terrain browser: opening offline demo');
  await page.goto(new URL(release?'../../../dist/landscape/demo/index.html':'../demo/index.html',import.meta.url).href);
  await page.waitForFunction(()=>globalThis.StrataCrowdDemo?.session&&StrataCrowdDemo.renderer.draws>=2);
  assert.equal(await page.locator('script[type="module"],script[async],script[defer]').count(),0);
  assert.match(await page.textContent('#map-info'),/520 × 640 m/);
  assert.equal(await page.evaluate(()=>StrataCrowdDemo.session.crowd.size),10);
  await page.click('#pause');
  console.log('Terrain browser: checking indexed geometry');
  const geometry=await page.evaluate(()=>{
    const {renderer,session}=StrataCrowdDemo,gl=renderer.gl,oldVao=gl.getParameter(gl.VERTEX_ARRAY_BINDING),oldBuffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    gl.bindVertexArray(window.terrainVao);
    gl.bindBuffer(gl.ARRAY_BUFFER,gl.getVertexAttrib(0,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));
    const points=[];
    for(const k of [0,261*160+130,261*321-1]){
      const p=new Float32Array(6);gl.getBufferSubData(gl.ARRAY_BUFFER,k*24,p);
      if(p[1]!==session.map.heights[k])throw Error('GPU height mismatch');points.push(Array.from(p.subarray(0,3)));
    }
    gl.bindVertexArray(oldVao);gl.bindBuffer(gl.ARRAY_BUFFER,oldBuffer);
    return {points,count:window.terrainCount,error:gl.getError(),tick:session.crowd.tick};
  });
  assert.equal(geometry.count,260*320*6);assert.equal(geometry.error,0);
  assert.equal(geometry.points[0][0],-260);assert.equal(geometry.points[0][2],320);
  assert.equal(geometry.points[2][0],260);assert.equal(geometry.points[2][2],-320);
  const frozen=await page.evaluate(()=>({tick:StrataCrowdDemo.session.crowd.tick,uploads:StrataCrowdDemo.renderer.uploads,draws:StrataCrowdDemo.renderer.draws}));
  await page.waitForFunction(n=>StrataCrowdDemo.renderer.draws>n+3,frozen.draws);
  assert.deepEqual(await page.evaluate(()=>({tick:StrataCrowdDemo.session.crowd.tick,uploads:StrataCrowdDemo.renderer.uploads})),{tick:frozen.tick,uploads:frozen.uploads});
  console.log('Terrain browser: checking profile texture');
  await page.selectOption('#group','1');
  const beforeOverlay=await page.evaluate(()=>StrataCrowdDemo.renderer.draws);
  await page.waitForFunction(n=>StrataCrowdDemo.renderer.draws>n+1,beforeOverlay);
  const overlay=await page.evaluate(()=>{
    const {renderer,session}=StrataCrowdDemo,gl=renderer.gl;
    const k=session.masks.tank.findIndex((v,i)=>v!==session.map.walkable[i]);
    if(k<0)throw Error('fixture must distinguish body clearance from radius-zero terrain');
    const old=gl.getParameter(gl.FRAMEBUFFER_BINDING),texture=gl.getParameter(gl.TEXTURE_BINDING_2D),fbo=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    const format=gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT),type=gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE),pixel=new Uint8Array(4);
    if(type!==gl.UNSIGNED_BYTE)throw Error('unexpected mask format');
    gl.readPixels(k%260,Math.floor(k/260),1,1,format,type,pixel);
    gl.bindFramebuffer(gl.FRAMEBUFFER,old);gl.deleteFramebuffer(fbo);
    return {value:pixel[0],expected:session.masks.tank[k]*255,error:gl.getError()};
  });
  assert.equal(overlay.value,overlay.expected);assert.equal(overlay.error,0);
  await page.selectOption('#group','0');
  const target=await page.evaluate(()=>{
    const {session}=StrataCrowdDemo,target={x:session.portals.south.x,z:session.portals.south.z-24};
    let best=null,distance=Infinity;
    for(let k=0;k<session.map.corridors.length;k++)if(session.map.corridors[k]&&session.masks.marine[k]&&session.masks.tank[k]){
      const p={x:-259+(k%260)*2,z:319-Math.floor(k/260)*2},d=(p.x-target.x)**2+(p.z-target.z)**2;
      if(d<distance){best=p;distance=d;}
    }
    const c=StrataCrowdDemo.camera,b=document.querySelector('canvas').getBoundingClientRect();
    const p=[best.x-c.center[0],session.terrain.heightAt(best.x,best.z)-c.center[1],best.z-c.center[2]],dot=a=>p.reduce((s,v,i)=>s+v*a[i],0);
    const canvas=document.querySelector('canvas');
    return {world:best,x:b.left+canvas.clientLeft+(dot(c.right)*c.scale[0]+1)*canvas.clientWidth/2,
      y:b.top+canvas.clientTop+(1-dot(c.up)*c.scale[1])*canvas.clientHeight/2};
  });
  console.log('Terrain browser: checking real-mesh click');
  await page.mouse.click(target.x,target.y);
  const clicked=await page.evaluate(()=>StrataCrowdDemo.session.crowd.getGroups()[0].destination);
  assert.ok(clicked,'mesh click accepts a real navigation destination');
  assert.ok(Math.hypot(clicked.x-target.world.x,clicked.z-target.world.z)<.1);
  const oldTick=await page.evaluate(()=>StrataCrowdDemo.session.crowd.tick);
  await page.selectOption('#overlay','corridor');
  await page.selectOption('#overlay','none');
  await page.fill('#speed','5');assert.equal(await page.textContent('#speed-value'),'5.00×');
  assert.equal(await page.evaluate(()=>StrataCrowdDemo.session.crowd.tick),oldTick);
  console.log('Terrain browser: checking atomic file replacement');
  await page.evaluate(()=>{globalThis.oldCrowd=StrataCrowdDemo.session.crowd;});
  await page.locator('#map-file').setInputFiles({name:'broken.zip',mimeType:'application/zip',buffer:Buffer.from('not a ZIP')});
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Vorherige Karte bleibt aktiv'));
  assert.equal(await page.evaluate(()=>StrataCrowdDemo.session.crowd===oldCrowd),true);
  await page.locator('#map-file').setInputFiles({name:'strata-417.zip',mimeType:'application/zip',buffer:readFileSync(new URL('./fixtures/strata-417.zip',import.meta.url))});
  await page.waitForFunction(()=>StrataCrowdDemo.session.crowd!==oldCrowd&&!document.querySelector('#controls').disabled);
  assert.equal(await page.evaluate(()=>{try{oldCrowd.step();return false;}catch{return true;}}),true);
  assert.equal(await page.evaluate(()=>StrataCrowdDemo.session.crowd.size),10);
  assert.equal(await page.evaluate(()=>StrataCrowdDemo.paused),true);
  assert.equal(await page.evaluate(()=>StrataCrowdDemo.renderer.gl.getError()),0);
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  // The additive shared profiles script must not break the original standalone demo.
  console.log('Terrain browser: checking reference startup and disposal');
  const reference=await browser.newPage();
  await reference.goto(new URL(release?'../../../dist/crowd-simulation/demo/index.html':'../../crowd-simulation/demo/index.html',import.meta.url).href);
  await reference.waitForFunction(()=>globalThis.CrowdDemo?.crowd.size===1);
  await reference.close();
  await page.evaluate(()=>StrataCrowdDemo.renderer.gl.getExtension('WEBGL_lose_context').loseContext());
  await page.waitForFunction(()=>StrataCrowdDemo.session===null);
  assert.equal(await page.locator('#controls').isDisabled(),true);
  console.log(`Terrain file:// (${release?'release':'source'}): actual STRATA map, indexed GPU heights, exact profile overlay, mesh picking, paused uploads/ticks, atomic invalid/replacement import, old-world disposal, no HTTP, original demo startup and context-loss shutdown.`);
}, { timeoutMs: 60000,
  // Deterministic software GL for this contract check; retain the shared sandbox/path policy.
  launch: options => chromium.launch({ ...options, args: ['--use-angle=swiftshader'] }),
});
