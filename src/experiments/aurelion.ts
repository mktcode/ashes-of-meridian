/* Opt-in geometry review. No game, UI controller, storage, simulation clock or map registration. */
'use strict';
async function launchAurelionPreview(canvas: HTMLCanvasElement) {
  const renderer = new MeridianRenderer(canvas);
  renderer.quality = 1; // Balanced keeps the geometry review sharp; normal High is unchanged.
  renderer.resize();
  renderer.battlefieldProfile = {
    groundTexture:'metal',skyTexture:'sky',groundPixelsPerMeter:30,
    rockDecor:{density:0,opacity:0},shrubDecor:{density:0,opacity:0},
    haze:[.22,.30,.37],
    lighting:{sun:[1.15,1.05,.90],sky:[.48,.59,.72],bounce:[.22,.28,.34]}
  };
  renderer.haze = renderer.battlefieldProfile.haze;
  renderer.fogOn = false;
  renderer.cinema = false;
  renderer.extent = 300;
  await renderer.prepareBattlefieldTextures(renderer.battlefieldProfile);
  const geometry = createAurelionGeometry();
  let triangles = 0;
  for (const mesh of geometry) {
    renderer.geometry(mesh.name,mesh.data);
    renderer.add(mesh.name,0,0,0,1,1,1,0xffffff,0,0,0,mesh.glow,1,'static',MAT.METAL);
    triangles += mesh.data.length/27;
  }
  const panel = document.createElement('section');
  panel.className = 'aurelion-review';
  panel.innerHTML = `<header><small>THE CROWN DISTRICT · GEOMETRY STUDY 02</small><h1>AURELION</h1>
    <p>Proportionen & Architektur · noch keine spielbare Karte</p></header>
    <footer><span>Ziehen: verschieben · Rechts ziehen: drehen · Mausrad: Zoom</span>
    <nav><button type="button" data-view="reset">Referenzblick</button><button type="button" data-view="top">Draufsicht</button>
    <button type="button" data-view="detail">Zentrum</button><button type="button" data-view="sector">Hochplateau</button>
    <a href="./index.html">Zurück zum Spiel</a></nav>
    <small>Reklameflächen: Platzhalter · Materialien, Wolken und Flugverkehr folgen nach Geometrieabnahme</small></footer>`;
  document.body.append(panel);
  const overlay = $('overlay'), context = overlay.getContext('2d');
  if (!context) throw Error('Canvas 2D is unavailable');
  const camera = {x:0,z:0,height:-12,zoom:256,yaw:.07,pitch:.76};
  let failed = false, queued = false;
  function draw() {
    queued = false;
    if (failed) return;
    const bounds = canvas.getBoundingClientRect();
    if (renderer.width !== Math.round(bounds.width) || renderer.height !== Math.round(bounds.height)) renderer.resize();
    const v = renderer.viewport, aspect = v.width/v.height, dpr = Math.min(devicePixelRatio||1,2),
      target = [camera.x,camera.height,camera.z], distance = 190;
    renderer.eye = [target[0]+Math.sin(camera.yaw)*Math.cos(camera.pitch)*distance,
      target[1]+Math.sin(camera.pitch)*distance,target[2]+Math.cos(camera.yaw)*Math.cos(camera.pitch)*distance];
    renderer.vp = M4.mul(M4.ortho(-camera.zoom*aspect/2,camera.zoom*aspect/2,-camera.zoom/2,camera.zoom/2,.1,1000),
      M4.look(renderer.eye,target));
    renderer.inverseVP = M4.inverse(renderer.vp);
    renderer.lightVP = M4.mul(M4.ortho(-270,270,-270,270,1,950),M4.look([-256,440,172],[0,0,0]));
    renderer.shadowBias = .00018;
    renderer.begin();
    renderer.render(0);
    overlay.width = Math.round(v.width*dpr); overlay.height = Math.round(v.height*dpr);
    context!.setTransform(dpr,0,0,dpr,-v.left*dpr,-v.top*dpr);
    context!.font = '11px monospace';
    for (const [x,z,label,color] of [[-111,94,'01  AZUR','#9fe2ed'],[111,94,'02  EMBER','#efc282'],
        [111,-94,'03  VIOLET','#c5adeb'],[-111,-94,'04  JADE','#b6dac7']] as const) {
      const p = renderer.project(x,AURELION_SECTOR_HEIGHT+8,z);
      if (!p) continue;
      context!.fillStyle = '#10212dd9'; context!.fillRect(p.x-51,p.y-28,102,23);
      context!.fillStyle = color; context!.fillText(label,p.x-38,p.y-12);
    }
    canvas.dataset.aurelionReady = 'true';
    canvas.dataset.triangles = String(triangles);
    canvas.dataset.drawCalls = String(renderer.drawCalls);
  }
  function invalidate() {
    if (queued || failed) return;
    queued = true;
    requestAnimationFrame(() => {
      try { draw(); }
      catch (error) { failed = true; showFailure(error); }
    });
  }
  function showFailure(error: unknown) {
    console.error(error);
    $('loading').textContent = `Aurelion preview: ${error instanceof Error ? error.message : String(error)}`;
    $('loading').classList.remove('hidden');
  }
  panel.addEventListener('click',event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    switch (target.dataset.view) {
      case 'reset': Object.assign(camera,{x:0,z:0,height:-12,zoom:256,yaw:.07,pitch:.76}); break;
      case 'top': Object.assign(camera,{x:0,z:0,height:0,zoom:350,yaw:0,pitch:1.48}); break;
      case 'detail': Object.assign(camera,{x:0,z:0,height:0,zoom:122,yaw:.07,pitch:.76}); break;
      case 'sector': Object.assign(camera,{x:88,z:78,height:10,zoom:145,yaw:.38,pitch:.65}); break;
      default: return;
    }
    invalidate();
  });
  let drag: {id:number;x:number;y:number;rotate:boolean} | null = null;
  canvas.addEventListener('contextmenu',event => event.preventDefault());
  canvas.addEventListener('pointerdown',event => {
    if (drag || (event.button !== 0 && event.button !== 2)) return;
    drag = {id:event.pointerId,x:event.clientX,y:event.clientY,rotate:event.button===2};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event => {
    if (!drag || drag.id!==event.pointerId) return;
    const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
    drag.x = event.clientX; drag.y = event.clientY;
    if (drag.rotate) {
      camera.yaw -= dx*.005;
      camera.pitch = clamp(camera.pitch+dy*.004,.38,1.48);
    } else {
      const scale = camera.zoom/renderer.viewport.height, cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw),
        forward = -dy*scale/Math.sin(camera.pitch);
      camera.x += -dx*scale*cy+forward*sy;
      camera.z += dx*scale*sy+forward*cy;
    }
    invalidate();
  });
  for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,() => { drag = null; });
  canvas.addEventListener('wheel',event => {
    event.preventDefault();
    camera.zoom = clamp(camera.zoom*Math.exp(event.deltaY*.001),70,500);
    invalidate();
  },{passive:false});
  canvas.addEventListener('webglcontextlost',event => {
    event.preventDefault(); failed = true;
    showFailure(new Error('Graphics context lost. Reload to reopen the geometry study.'));
  });
  new ResizeObserver(invalidate).observe($('worldViewport'));
  addEventListener('resize',invalidate);
  $('vignette').classList.add('hidden');
  $('loading').classList.add('hidden');
  invalidate();
}
