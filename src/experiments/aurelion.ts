/* Opt-in visual review. No game, UI controller, storage, simulation clock or map registration. */
'use strict';
async function launchAurelionPreview(canvas: HTMLCanvasElement) {
  const renderer = new AurelionAtmosphereRenderer(canvas);
  renderer.quality = 1; // Native CSS resolution + MSAA; the normal quality presets remain untouched.
  renderer.resize();
  renderer.battlefieldProfile = {
    groundTexture:'metal',skyTexture:'sky',groundPixelsPerMeter:30,
    rockDecor:{density:0,opacity:0},shrubDecor:{density:0,opacity:0},haze:[.025,.04,.075],
    lighting:{sun:[.42,.52,.72],sky:[.085,.12,.19],bounce:[.016,.025,.045]}
  };
  renderer.haze = renderer.battlefieldProfile.haze;
  renderer.fogOn = false; renderer.cinema = false; renderer.extent = 300;
  await renderer.prepareBattlefieldTextures(renderer.battlefieldProfile);
  let triangles = 0;
  for (const mesh of createAurelionGeometry()) {
    renderer.geometry(mesh.name,mesh.data);
    renderer.add(mesh.name,0,0,0,1,1,1,0xffffff,0,0,0,mesh.glow,1,'static',
      mesh.name==='aurelionScreens'?AURELION_SCREEN_MATERIAL:MAT.METAL);
    triangles += mesh.data.length/27;
  }
  const backdrop=createAurelionBackdrop();
  renderer.geometry(backdrop.name,backdrop.data);
  renderer.add(backdrop.name,0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static',AURELION_BACKDROP_MATERIAL);
  triangles+=backdrop.data.length/27;
  const flights=createAurelionFlights();
  let aircraftTriangles=0;
  for (const mesh of createAurelionAircraft()) {
    renderer.geometry(mesh.name,mesh.data); aircraftTriangles+=mesh.data.length/27;
  }
  const globe: number[]=[],halo: number[]=[];
  ModelMesh.lobedShell(globe,{sx:1,sy:1,sz:1,lobes:4,depth:0,segments:64,rings:32});
  geom.tri(halo,[-1,0,-1],[-1,0,1],[1,0,1]);geom.tri(halo,[-1,0,-1],[1,0,1],[1,0,-1]);
  renderer.geometry('aurelionHologram',new Float32Array(globe));renderer.geometry('aurelionHalo',new Float32Array(halo));
  const panel = document.createElement('section');
  panel.className = 'aurelion-review';
  panel.innerHTML = `<header><small>THE CROWN DISTRICT · VISUAL STUDY 07</small><h1>AURELION</h1>
    <p>Eine Stadt über den Wolken</p></header>
    <footer><span>Ziehen: verschieben · Rechts ziehen: drehen · Mausrad: Zoom · H: Bildmodus</span>
    <nav><button type="button" data-view="reset">Referenzblick</button><button type="button" data-view="top">Draufsicht</button>
    <button type="button" data-view="detail">Zentrum</button><button type="button" data-view="sector">Hochplateau</button>
    <button type="button" data-view="skyline">Skyline</button><button type="button" data-view="geometry">Alte Kamera</button>
    <button type="button" data-action="motion" aria-pressed="false">Bewegung pausieren</button>
    <button type="button" data-action="atmosphere" aria-pressed="true">Atmosphäre an</button>
    <a href="./index.html">Zurück zum Spiel</a></nav>
    <small data-status>Nachtstudie · keine spielbare Karte · Leertaste: Bewegung</small></footer>`;
  document.body.append(panel);
  const overlay = $('overlay'), context = overlay.getContext('2d');
  if (!context) throw Error('Canvas 2D is unavailable');
  const camera = {x:0,z:0,height:-22,zoom:290,yaw:.04,pitch:.80,perspective:true,fov:.18},
    params=new URLSearchParams(location.search),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)'),
    motionButton=panel.querySelector<HTMLButtonElement>('[data-action="motion"]')!,
    atmosphereButton=panel.querySelector<HTMLButtonElement>('[data-action="atmosphere"]')!;
  let failed=false,frameRequest=0,paused=params.get('still')==='1'||reducedMotion.matches,time=12,lastTime=0,nextDraw=0;
  function syncMotion() {
    motionButton.textContent=paused?'Bewegung fortsetzen':'Bewegung pausieren';
    motionButton.setAttribute('aria-pressed',String(paused));
    canvas.dataset.motion=paused?'paused':'playing';
  }
  function draw() {
    const bounds = canvas.getBoundingClientRect();
    if (renderer.width!==Math.max(1,Math.round(bounds.width)) || renderer.height!==Math.max(1,Math.round(bounds.height))) renderer.resize();
    const v=renderer.viewport,aspect=v.width/v.height,dpr=Math.min(devicePixelRatio||1,2),
      target=[camera.x,camera.height,camera.z],distance=camera.perspective?camera.zoom/(2*Math.tan(camera.fov/2)):190;
    renderer.eye=[target[0]+Math.sin(camera.yaw)*Math.cos(camera.pitch)*distance,
      target[1]+Math.sin(camera.pitch)*distance,target[2]+Math.cos(camera.yaw)*Math.cos(camera.pitch)*distance];
    const projection=camera.perspective?M4.perspective(camera.fov,aspect,8,4000):
      M4.ortho(-camera.zoom*aspect/2,camera.zoom*aspect/2,-camera.zoom/2,camera.zoom/2,.1,1000);
    renderer.vp=M4.mul(projection,M4.look(renderer.eye,target));renderer.inverseVP=M4.inverse(renderer.vp);
    renderer.lightVP=M4.mul(M4.ortho(-320,320,-320,320,1,1050),M4.look([-256,440,172],[0,0,0]));
    renderer.shadowBias=.00012;
    // Keep the artistic haze falloff anchored to the city, not the chosen lens's camera distance.
    renderer.hazeStart=Math.max(0,Math.cos(camera.pitch)*distance-140);
    renderer.begin();
    drawAurelionFlights(renderer,flights,time);
    renderer.add('aurelionHalo',0,.42,0,24,1,24,0xffffff,0,0,0,1,.4,'effects',AURELION_HALO_MATERIAL);
    renderer.add('aurelionHologram',0,15,0,10.08,10.08,10.08,0xffffff,time*.025,0,0,2,.7,'effects',AURELION_HOLOGRAM_MATERIAL);
    renderer.render(time);
    const w=Math.round(v.width*dpr),h=Math.round(v.height*dpr);
    if (overlay.width!==w || overlay.height!==h) {overlay.width=w;overlay.height=h;}
    context!.setTransform(1,0,0,1,0,0);context!.clearRect(0,0,w,h);
    context!.setTransform(dpr,0,0,dpr,-v.left*dpr,-v.top*dpr);context!.font='11px monospace';
    for (const [x,z,label,color] of [[-111,94,'01  AZUR','#9fe2ed'],[111,94,'02  EMBER','#efc282'],
        [111,-94,'03  VIOLET','#c5adeb'],[-111,-94,'04  JADE','#b6dac7']] as const) {
      const p=renderer.project(x,AURELION_SECTOR_HEIGHT+8,z);
      if (!p) continue;
      context!.fillStyle='#10212dbb';context!.fillRect(p.x-51,p.y-28,102,23);
      context!.fillStyle=color;context!.fillText(label,p.x-38,p.y-12);
    }
    canvas.dataset.aurelionReady='true';canvas.dataset.triangles=String(triangles);
    canvas.dataset.aircraftTriangles=String(aircraftTriangles);canvas.dataset.aircraft=String(flights.length);
    canvas.dataset.drawCalls=String(renderer.drawCalls);canvas.dataset.visualTime=time.toFixed(4);
    canvas.dataset.depthEffects=String(renderer.depthAvailable);canvas.dataset.frames=String(renderer.frame);
    if (!renderer.depthAvailable) panel.querySelector('[data-status]')!.textContent='Tiefeneffekte nicht verfügbar · Licht/Bloom aktiv · keine spielbare Karte';
  }
  function tick(now: number) {
    frameRequest=0;
    if (failed||document.hidden) {lastTime=0;nextDraw=0;return;}
    // Bound work on high-refresh displays; carry cadence, never replay missed frames.
    if (!paused&&now<nextDraw) {invalidate();return;}
    try {
      if (!renderer.frameReady()) {invalidate();return;}
      nextDraw=now+1000/60-(nextDraw?(now-nextDraw)%(1000/60):0);
      if (!paused&&lastTime) time+=Math.min((now-lastTime)/1000,.1);
      lastTime=now;draw();
    } catch(error) {failed=true;showFailure(error);return;}
    if (!paused) invalidate();
  }
  function invalidate() {if (!frameRequest&&!failed&&!document.hidden) frameRequest=requestAnimationFrame(tick);}
  function showFailure(error: unknown) {
    console.error(error);
    $('loading').textContent=`Aurelion preview: ${error instanceof Error?error.message:String(error)}`;
    $('loading').classList.remove('hidden');
  }
  function toggleMotion() {paused=!paused;lastTime=0;nextDraw=0;syncMotion();invalidate();}
  panel.addEventListener('click',event => {
    const target=event.target;if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action==='motion') {toggleMotion();return;}
    if (target.dataset.action==='atmosphere') {
      renderer.atmosphere=renderer.atmosphere?0:1;
      atmosphereButton.textContent=renderer.atmosphere?'Atmosphäre an':'Atmosphäre aus';
      atmosphereButton.setAttribute('aria-pressed',String(!!renderer.atmosphere));invalidate();return;
    }
    switch (target.dataset.view) {
      case 'reset': Object.assign(camera,{x:0,z:0,height:-22,zoom:290,yaw:.04,pitch:.80,perspective:true,fov:.18});break;
      case 'top': Object.assign(camera,{x:0,z:0,height:0,zoom:350,yaw:0,pitch:1.48,perspective:false});break;
      case 'detail': Object.assign(camera,{x:0,z:0,height:0,zoom:122,yaw:.07,pitch:.76,perspective:true,fov:.45});break;
      case 'sector': Object.assign(camera,{x:88,z:78,height:10,zoom:145,yaw:.38,pitch:.65,perspective:false});break;
      case 'skyline': Object.assign(camera,{x:171,z:14,height:7,zoom:185,yaw:-.4,pitch:.58,perspective:true,fov:.45});break;
      case 'geometry': Object.assign(camera,{x:0,z:0,height:-12,zoom:256,yaw:.07,pitch:.76,perspective:false});break;
      default:return;
    }
    invalidate();
  });
  let drag: {id:number;x:number;y:number;rotate:boolean}|null=null;
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointerdown',event=>{
    if (drag||(event.button!==0&&event.button!==2)) return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,rotate:event.button===2};canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if (!drag||drag.id!==event.pointerId) return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;
    if (drag.rotate) {camera.yaw-=dx*.005;camera.pitch=clamp(camera.pitch+dy*.004,.38,1.48);}
    else {
      const scale=camera.zoom/renderer.viewport.height,cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),forward=-dy*scale/Math.sin(camera.pitch);
      camera.x+=-dx*scale*cy+forward*sy;camera.z+=dx*scale*sy+forward*cy;
    }
    invalidate();
  });
  for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,()=>{drag=null;});
  canvas.addEventListener('wheel',event=>{event.preventDefault();camera.zoom=clamp(camera.zoom*Math.exp(event.deltaY*.001),70,500);invalidate();},{passive:false});
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();failed=true;cancelAnimationFrame(frameRequest);frameRequest=0;
    showFailure(new Error('Graphics context lost. Reload to reopen the visual study.'));
  });
  addEventListener('keydown',event=>{
    if (event.repeat) return;
    if (event.key.toLowerCase()==='h') panel.classList.toggle('photo');
    if (event.code==='Space'&&!(event.target instanceof HTMLButtonElement)&&!(event.target instanceof HTMLAnchorElement)) {
      event.preventDefault();toggleMotion();
    }
  });
  document.addEventListener('visibilitychange',()=>{
    lastTime=0;nextDraw=0;
    if (document.hidden) {cancelAnimationFrame(frameRequest);frameRequest=0;}
    else invalidate();
  });
  reducedMotion.addEventListener('change',event=>{if (event.matches) {paused=true;lastTime=0;syncMotion();invalidate();}});
  const observer=new ResizeObserver(invalidate);observer.observe($('worldViewport'));
  addEventListener('resize',invalidate);
  addEventListener('pagehide',event=>{
    cancelAnimationFrame(frameRequest);frameRequest=0;lastTime=0;
    if (!event.persisted) {failed=true;observer.disconnect();renderer.disposeAtmosphere();}
  });
  addEventListener('pageshow',invalidate);
  $('vignette').classList.add('hidden');$('loading').classList.add('hidden');syncMotion();invalidate();
}
