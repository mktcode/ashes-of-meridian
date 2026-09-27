const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { loadScripts, RENDERER_SCRIPTS } = require('./helpers/game-scripts.cjs');

// Intersect actual upward mesh triangles, not a second hand-built height recipe.
function surfaceHeight(data, x, z) {
  let height = -Infinity;
  for (let i = 0; i < data.length; i += 27) {
    if (data[i+4] < .2) continue;
    const ax = data[i], az = data[i+2], bx = data[i+9], bz = data[i+11], cx = data[i+18], cz = data[i+20];
    if (x < Math.min(ax,bx,cx) || x > Math.max(ax,bx,cx) || z < Math.min(az,bz,cz) || z > Math.max(az,bz,cz)) continue;
    const determinant = (bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
    if (Math.abs(determinant) < 1e-9) continue;
    const a = ((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/determinant,
      b = ((cz-az)*(x-cx)+(ax-cx)*(z-cz))/determinant, c = 1-a-b;
    if (Math.min(a,b,c) >= -1e-6) height = Math.max(height,a*data[i+1]+b*data[i+10]+c*data[i+19]);
  }
  return height;
}

test('Aurelion visual time retains real elapsed motion under slow completed frames', () => {
  const context=loadScripts(['experiment-aurelion']);
  const advance=vm.runInContext('advanceAurelionVisualTime',context);
  assert.equal(advance(12,0,9000),12,'the first visible frame establishes the clock without a jump');
  assert.equal(advance(12,1000,3500),14.5,'slow rendering must not cap motion to a tenth of a second');
  assert.equal(advance(14.5,3500,3516),14.516);
});

test('Aurelion light footprints are convex and their shared walkways have valid height ranges', () => {
  const context=loadScripts(['core','renderer-geometry','renderer-model-kit','renderer-aurelion-geometry']);
  const {outline,walkways,crown,height}=vm.runInContext('({outline:AURELION_DECK_OUTLINE,walkways:AURELION_WALKWAYS,crown:AURELION_CROWN_FLOOR,height:AURELION_SECTOR_HEIGHT})',context);
  assert.ok(outline.length>=3);
  for (let i=0;i<outline.length;i++) {
    const [ax,az]=outline[i],[bx,bz]=outline[(i+1)%outline.length];
    assert.ok([ax,az,bx,bz].every(Number.isFinite));
    assert.ok(Math.hypot(bx-ax,bz-az)>0);
    for (const [x,z] of outline)
      assert.ok((bx-ax)*(z-az)-(bz-az)*(x-ax)>=0,'convex counter-clockwise perimeter required by the light mask');
  }
  for (const path of walkways) {
    assert.equal(path.length,7);
    assert.ok(path.every(Number.isFinite));
    const [ax,az,bx,bz,width,ay,by]=path;
    assert.ok(Math.hypot(bx-ax,bz-az)>0&&width>3);
    assert.ok(ay>=0&&ay<=height&&by>=0&&by<=height,'light mask follows the ramp endpoints');
  }
  assert.ok(crown.radius>0&&crown.height>=0&&crown.height<height);
});

test('Aurelion geometry preserves broad precincts, clear approaches, a closed plaza and sub-deck flight corridors', () => {
  const context = loadScripts(['core','renderer-geometry','renderer-model-kit','renderer-aurelion-geometry','renderer-aurelion-traffic']);
  vm.runInContext('Math.random = () => { throw Error("ambient RNG used"); }', context);
  const meshes = vm.runInContext('createAurelionGeometry()', context);
  assert.equal(meshes.length, 3);
  assert.equal(new Set(meshes.map(mesh => mesh.name)).size, meshes.length);
  let triangles = 0;
  for (const mesh of meshes) {
    const data = mesh.data;
    assert.ok(data.length > 0 && data.length % 27 === 0);
    assert.equal(Object.prototype.toString.call(data), '[object Float32Array]', 'packed storage for the detailed scene');
    triangles += data.length / 27;
    for (let i = 0; i < data.length; i += 9) {
      for (let k = 0; k < 9; k++) assert.ok(Number.isFinite(data[i+k]));
      assert.ok(Math.abs(data[i]) <= 800 && Math.abs(data[i+2]) <= 800);
      assert.ok(data[i+1] >= -157 && data[i+1] < 120);
      assert.ok(Math.abs(Math.hypot(data[i+3],data[i+4],data[i+5])-1) < 1e-5);
      for (let k = 6; k < 9; k++) assert.ok(data[i+k] >= 0 && data[i+k] <= 1);
    }
    for (let i = 0; i < data.length; i += 27) {
      const ax = data[i+9]-data[i], ay = data[i+10]-data[i+1], az = data[i+11]-data[i+2],
        bx = data[i+18]-data[i], by = data[i+19]-data[i+1], bz = data[i+20]-data[i+2];
      assert.ok(Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx) > 1e-8, 'no collapsed triangles');
    }
  }
  // The approved high-detail pass deliberately replaces the coarse 200k massing-study budget.
  assert.ok(triangles < 650000, `bounded detailed-review budget (${triangles}), not a mobile performance claim`);
  const structure = meshes.find(mesh => mesh.name === 'aurelionStructure').data;
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    for (const [x,z] of [[55,90],[83,52],[130,48],[145,110],[72,119],[90,112]]) {
      const height = surfaceHeight(structure,sx*x,sz*z);
      assert.ok(Math.abs(height-8)<.2, `whole corner precinct is raised, including former bridge/interstitial areas: ${sx*x}/${sz*z} -> ${height}`);
    }
    // Open starting courts and generous bridge-side floor, verified against the actual mesh.
    const openPoints=[[124,55],[133,55],[140,55],[70,76],[58,73],[62,116]];
    for (let x=87;x<=135;x+=6) for (let z=70;z<=118;z+=6)
      if (Math.hypot(x-111,z-94)<27) openPoints.push([x,z]);
    for (const [x,z] of openPoints) {
      const height=surfaceHeight(structure,sx*x,sz*z);
      assert.ok(height>=7.99&&height<8.25,`clear starting court and bridge-side floor: ${sx*x}/${sz*z} -> ${height}`);
    }
    let area = 0;
    for (let i = 0; i < structure.length; i += 27) {
      if (structure[i]*sx<0 || structure[i+2]*sz<0 || structure[i+4]<.99 ||
          [1,10,19].some(k => Math.abs(structure[i+k]-8) > 1e-6)) continue;
      area += Math.abs((structure[i+9]-structure[i])*(structure[i+20]-structure[i+2])-
        (structure[i+18]-structure[i])*(structure[i+11]-structure[i+2]))/2;
    }
    assert.ok(area>9000 && area<11000, 'one broad upper district, not a small pedestal');
    for (const [ax,az,bx,bz,low] of [[112,40,112,18,2],[47,103,24,103,2],[60.5,53.5,43,36,0]]) {
      const length = Math.hypot(bx-ax,bz-az), nx = (bz-az)/length, nz = -(bx-ax)/length;
      for (const t of [.03,.1,.25,.5,.75,.95]) for (const offset of [-4,0,4]) {
        const x = sx*(ax+(bx-ax)*t+nx*offset), z = sz*(az+(bz-az)*t+nz*offset),
          height = surfaceHeight(structure,x,z);
        assert.ok(Math.abs(height-(8+(low-8)*t))<.2, `continuous central ramp lane without cornice obstructions: ${x}/${z} -> ${height}`);
      }
    }
    const length = Math.hypot(18,17);
    for (const offset of [-4,0,4]) {
      const ax = 43-17/length*offset, az = 36+18/length*offset, dot = ax*18+az*17,
        crossing = (dot-Math.sqrt(dot*dot-length*length*(ax*ax+az*az-41*41)))/(length*length);
      for (const t of [.1,.25,.4,.5,.6,.75,.9,crossing]) {
        const x = sx*(ax-18*t), z = sz*(az-17*t), height = surfaceHeight(structure,x,z);
        assert.ok(height>=-.01 && height<.4, `lower approach stays clear of the crown's new railing: ${x}/${z} -> ${height}`);
      }
    }
  }
  assert.ok(surfaceHeight(structure,20,6)<1, 'the central plaza remains below the four corner districts');
  const plaza=[];
  for (let i=0;i<structure.length;i+=27) {
    if (structure[i+4]>.99 && [0,9,18].every(k=>Math.abs(structure[i+k+1]-.15)<1e-5 &&
        Math.hypot(structure[i+k],structure[i+k+2])<41.01)) plaza.push(...structure.subarray(i,i+27));
  }
  for (let x=-40;x<=40;x+=2) for (let z=-40;z<=40;z+=2) if (Math.hypot(x,z)<40.5)
    assert.ok(Math.abs(surfaceHeight(plaza,x,z)-.15)<1e-5,`continuous circular floor, including former moat: ${x}/${z}`);
  let plazaArea=0;
  for (let i=0;i<plaza.length;i+=27) plazaArea+=Math.abs((plaza[i+9]-plaza[i])*(plaza[i+20]-plaza[i+2])-
    (plaza[i+18]-plaza[i])*(plaza[i+11]-plaza[i+2]))/2;
  assert.ok(Math.abs(plazaArea-Math.PI*41**2)<10,'one full disk, not overlapping strips or a perforated ring');
  const backdrop = vm.runInContext('createAurelionBackdrop()', context);
  assert.ok(backdrop.data.length/27<18000, 'distant silhouettes have their own small budget');
  for (const value of backdrop.data) assert.ok(Number.isFinite(value));
  // Three-dimensional surface occupancy allows underpasses; a highest-roof raster would forbid them.
  // Triangle AABBs conservatively include railings, bridge undersides and tower facades.
  const size=360,cell=2,extent=360,bottom=-160,levels=170,occupied=new Uint8Array(size*size*levels);
  for (const {data} of [...meshes,backdrop]) for (let i=0;i<data.length;i+=27) {
    const lo=[0,1,2].map(k=>Math.min(data[i+k],data[i+k+9],data[i+k+18])),
      hi=[0,1,2].map(k=>Math.max(data[i+k],data[i+k+9],data[i+k+18])),
      x0=Math.max(0,Math.floor((lo[0]+extent)/cell)),x1=Math.min(size-1,Math.floor((hi[0]+extent)/cell));
    if (x1<x0) continue;
    for (let y=Math.max(0,Math.floor((lo[1]-bottom)/cell));y<=Math.min(levels-1,Math.floor((hi[1]-bottom)/cell));y++)
      for (let z=Math.max(0,Math.floor((lo[2]+extent)/cell));z<=Math.min(size-1,Math.floor((hi[2]+extent)/cell));z++) {
        const row=(y*size+z)*size;occupied.fill(1,row+x0,row+x1+1);
      }
  }
  const fleet=vm.runInContext('({flights:createAurelionFlights(),models:createAurelionAircraft(),lanes:AURELION_AIR_LANES,sample:sampleAurelionFlight})',context);
  assert.ok(fleet.flights.every(f=>fleet.lanes[f.lane].height<0),
    'all civilian routes stay below the map, without an upper exception');
  assert.deepEqual(new Set(fleet.lanes.map(l=>l.route)),new Set(['east-west','north-south','side']),
    'two multi-lane trunks and separate side streets replace visible local loops');
  assert.ok(fleet.lanes.filter(l=>l.route!=='side').every(l=>Math.abs(Math.abs(l.angles[1]-l.angles[0])-Math.PI)<1e-9));
  assert.ok(fleet.lanes.filter(l=>l.route==='side').every(l=>Math.abs(l.angles[1]-l.angles[0])<Math.PI*.7),
    'feeder streets cannot recombine into the missing halves of the old loops');
  for (const flight of fleet.flights) {
    const lane=fleet.lanes[flight.lane],routeLength=lane.length,
      parts=fleet.models.filter(m=>m.name.startsWith(`aurelionAir${flight.kind}`)),
      lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for (const {data} of parts) for (let i=0;i<data.length;i+=9) for (let k=0;k<3;k++) {
      lo[k]=Math.min(lo[k],data[i+k]);hi[k]=Math.max(hi[k],data[i+k]);
    }
    let visibleSamples=0;
    for (let step=0;step<192;step++) {
      const t=step/192*routeLength/lane.speed,p=fleet.sample(flight,t);
      if (p.visibility<.02) continue;
      visibleSamples++;
      const a=[Infinity,Infinity,Infinity],b=[-Infinity,-Infinity,-Infinity];
      for (const x of [lo[0],hi[0]]) for (const y of [lo[1],hi[1]]) for (const z of [lo[2],hi[2]]) {
        const bx=x*Math.cos(p.bank)-y*Math.sin(p.bank),by=x*Math.sin(p.bank)+y*Math.cos(p.bank),
          q=[p.x+flight.scale*(bx*Math.cos(p.yaw)+z*Math.sin(p.yaw)),p.y+flight.scale*by,
            p.z+flight.scale*(-bx*Math.sin(p.yaw)+z*Math.cos(p.yaw))];
        for (let k=0;k<3;k++) {a[k]=Math.min(a[k],q[k]-2);b[k]=Math.max(b[k],q[k]+2);}
      }
      assert.ok(b[1]<-10,'every complete aircraft envelope stays safely below the lowest deck');
      let blocked='';
      for (let y=Math.floor((a[1]-bottom)/cell);y<=Math.floor((b[1]-bottom)/cell)&&!blocked;y++)
        for (let z=Math.floor((a[2]+extent)/cell);z<=Math.floor((b[2]+extent)/cell)&&!blocked;z++)
          for (let x=Math.floor((a[0]+extent)/cell);x<=Math.floor((b[0]+extent)/cell);x++) {
            assert.ok(x>=0&&x<size&&z>=0&&z<size&&y>=0&&y<levels);
            if (occupied[(y*size+z)*size+x]) {blocked=[x*cell-extent,y*cell+bottom,z*cell-extent].join('/');break;}
          }
      assert.equal(blocked,'',`aircraft envelope clears real scenery: lane ${flight.lane}, kind ${flight.kind}, pose ${p.x}/${p.y}/${p.z}`);
    }
    assert.ok(visibleSamples>140,'portal fades hide only short route ends');
  }
  for (const name of ['MeridianGame','Battlefield','document','window'])
    assert.equal(vm.runInContext(`typeof ${name}`, context), 'undefined');
  const digest = meshes => meshes.map(({data}) => createHash('sha256')
    .update(Buffer.from(data.buffer,data.byteOffset,data.byteLength)).digest('hex')).join('/');
  assert.equal(digest(vm.runInContext('createAurelionGeometry()', context)), digest(meshes),
    'rebuilding resets every local layout/facade stream and packed buffer');
  assert.equal(digest([vm.runInContext('createAurelionBackdrop()',context)]),digest([backdrop]));
});

test('civilian aircraft are bounded, non-degenerate models with deterministic continuous presentation', () => {
  const context=loadScripts(['core','renderer-geometry','renderer-model-kit','renderer-aurelion-traffic'],{globals:{MAT:{METAL:2}}});
  vm.runInContext('Math.random=()=>{throw Error("ambient RNG used")}',context);
  const api=vm.runInContext('({models:createAurelionAircraft(),flights:createAurelionFlights(),create:createAurelionFlights,sample:sampleAurelionFlight,draw:drawAurelionFlights})',context);
  assert.equal(api.models.length,6);assert.equal(api.flights.length,48);
  assert.equal(new Set(api.flights.map(f=>f.kind)).size,3,'taxis, couriers and compact freight all remain in the lower city');
  assert.ok(api.models.reduce((s,m)=>s+m.data.length/27,0)<5000);
  for (const {data} of api.models) {
    assert.equal(Object.prototype.toString.call(data),'[object Float32Array]');
    assert.equal(data.length%27,0);
    for (let i=0;i<data.length;i+=9) {
      for (let k=0;k<9;k++) assert.ok(Number.isFinite(data[i+k]));
      assert.ok(Math.abs(Math.hypot(data[i+3],data[i+4],data[i+5])-1)<1e-5);
      for (let k=6;k<9;k++) assert.ok(data[i+k]>=0&&data[i+k]<=1);
    }
    for (let i=0;i<data.length;i+=27) {
      const ax=data[i+9]-data[i],ay=data[i+10]-data[i+1],az=data[i+11]-data[i+2],
        bx=data[i+18]-data[i],by=data[i+19]-data[i+1],bz=data[i+20]-data[i+2];
      assert.ok(Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)>1e-8);
    }
  }
  const before=JSON.stringify(api.flights);assert.equal(JSON.stringify(api.create()),before);
  for (const flight of api.flights) {
    Object.freeze(flight);
    for (const t of [0,12,300,3600]) {
      const a=api.sample(flight,t),b=api.sample(flight,t+.01);
      for (const value of Object.values(a)) assert.ok(Number.isFinite(value));
      if (a.cycle===b.cycle) assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.8,'visible street motion stays continuous');
      else assert.ok(Math.min(a.visibility,b.visibility)<.03,'analytic route wrap is hidden inside a portal fade');
      assert.deepEqual(api.sample(flight,t),a,'sampling does not advance any clock or random stream');
    }
  }
  const draws=[],beams=[],renderer={add:(...args)=>draws.push(args),beam:(...args)=>beams.push(args)};
  api.draw(renderer,api.flights,12);
  assert.ok(draws.length>api.flights.length&&draws.length<=api.flights.length*2&&draws.length%2===0);
  assert.ok(beams.length>api.flights.length*4&&beams.length<=api.flights.length*6);
  assert.ok(draws.every(args=>['dynamic','effects'].includes(args[13])&&args[12]>0&&args[12]<=1));
  assert.ok(draws.some(args=>args[13]==='dynamic'),'traffic remains opaque away from short portal fades');
  assert.equal(JSON.stringify(api.flights),before);
  for (const [a,b,width,,glow,alpha] of beams) {
    assert.ok([...a,...b,width,glow,alpha].every(Number.isFinite));
    assert.ok(width>0&&alpha>0&&alpha<=1);
    assert.ok(Math.max(a[1],b[1])+width<0,'engine wakes also stay below the map');
    assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))>0);
  }
  for (const name of ['MeridianGame','Battlefield','document','window']) assert.equal(vm.runInContext(`typeof ${name}`,context),'undefined');
});

test('Aurelion cloud noise and media descriptors are local, repeatable and bounded', () => {
  const context=loadScripts(['core',...RENDERER_SCRIPTS]);
  vm.runInContext('Math.random=()=>{throw Error("ambient RNG used")}',context);
  const api=vm.runInContext('({noise:createAurelionNoiseVolume,boards:AURELION_BILLBOARDS})',context);
  const a=api.noise(),b=api.noise();
  assert.equal(a.length,32**3);assert.deepEqual(a,b);assert.ok(new Set(a).size>240);
  assert.equal(api.boards.length,6);
  for (const board of api.boards) {
    assert.ok(Object.values(board).every(Number.isFinite));
    assert.ok(board.w>0&&board.h>0&&board.design>=0&&board.design<4&&Number.isInteger(board.design));
  }
  assert.equal(vm.runInContext('typeof document',context),'undefined','loading visual programs allocates no browser or GPU resources');
});

test('preview depth targets are reused, replaced on resize and released on failed allocation or resolve', () => {
  const warnings=[],context=loadScripts(['core',...RENDERER_SCRIPTS],{globals:{console:{warn:message=>warnings.push(message)}}});
  const Renderer=vm.runInContext('AurelionAtmosphereRenderer',context);
  for (const failure of [null,'texture','framebuffer','incomplete','resolve']) {
    const textures=new Set(),framebuffers=new Set(),blits=[];let allocations=0;
    const gl={NO_ERROR:0,FRAMEBUFFER_COMPLETE:1,TEXTURE11:11,TEXTURE14:14,
      createTexture(){allocations++;if(failure==='texture')return null;const t={};textures.add(t);return t;},
      createFramebuffer(){if(failure==='framebuffer')return null;const f={};framebuffers.add(f);return f;},
      deleteTexture:t=>textures.delete(t),deleteFramebuffer:f=>framebuffers.delete(f),
      checkFramebufferStatus:()=>failure==='incomplete'?0:1,getError:()=>failure==='resolve'?1282:0,
      blitFramebuffer:(...args)=>blits.push(args),getUniformLocation:()=>({})};
    for (const method of ['activeTexture','bindTexture','texImage2D','texParameteri','bindFramebuffer','framebufferTexture2D',
        'drawBuffers','readBuffer','useProgram','uniform1i','uniform1f','uniformMatrix4fv','uniform3fv']) gl[method]=()=>{};
    const renderer=Object.assign(Object.create(Renderer.prototype),{gl,width:100,height:80,quality:0,atmosphere:1,
      depthSize:'',depthAvailable:false,depthVerified:false,cityDepth:null,cityDepthFbo:null,uniformCache:new Map(),postProg:{},
      sceneFbo:{},sceneMSAAFbo:null,eye:[0,0,0],inverseVP:new Float32Array(16),lightVP:new Float32Array(16)});
    renderer.renderBloom();
    assert.equal(renderer.depthAvailable,failure===null);
    assert.equal(textures.size,failure===null?1:0);assert.equal(framebuffers.size,failure===null?1:0);
    assert.equal(blits.length,failure===null||failure==='resolve'?1:0);
    if (blits.length) assert.deepEqual(blits[0].slice(0,8),[0,0,100,80,0,0,100,80]);
    renderer.renderBloom();assert.equal(allocations,1,'no allocations or retries on subsequent same-size frames');
    renderer.width=200;renderer.height=120;renderer.renderBloom();assert.equal(allocations,2);
    assert.equal(textures.size,failure===null?1:0,'old depth target is not retained across resize');
    renderer.disposeAtmosphere();assert.equal(textures.size,0);assert.equal(framebuffers.size,0);
  }
  assert.equal(warnings.length,8,'each failed target size reports its fallback once');
  let status=2,deleted=0;const waits=[],fence={};
  const renderer=Object.assign(Object.create(Renderer.prototype),{frameFence:fence,gl:{TIMEOUT_EXPIRED:2,WAIT_FAILED:3,
    clientWaitSync:(...args)=>{waits.push(args);return status;},deleteSync:()=>{deleted++;}}});
  assert.equal(renderer.frameReady(),false);assert.equal(deleted,0);
  assert.deepEqual(waits[0],[fence,0,0],'GPU polling has zero timeout and never blocks the event loop');
  status=1;assert.equal(renderer.frameReady(),true);assert.equal(deleted,1);
  assert.equal(renderer.frameReady(),true);assert.equal(waits.length,2,'no poll once the fence has been released');
  renderer.frameFence={};status=3;assert.throws(()=>renderer.frameReady(),/synchronization failed/);assert.equal(deleted,2);
});
