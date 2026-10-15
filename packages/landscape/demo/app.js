import sample from '../tests/fixtures/strata-417.zip';
import { prepareSession } from './session.js';
import { createRenderer } from './renderer.js';

const $ = id => document.getElementById(id);
const canvas = $('scene'), status = $('status'), api = MeridianCrowd;
const events = new AbortController(), on = (target, type, fn, options = {}) =>
  target.addEventListener(type, fn, { ...options, signal: events.signal });
let session = null, renderer = null, stopped = false, loadId = 0, raf = 0, previous = null, pendingLoad = null;
let yaw = .55, pitch = .9, zoom = 1, focus = null, paused = false, drag = null;
const MAX_DEMO_UNITS = 64;
const selected = () => Number($('group').value);
const camera = () => CrowdCamera.cameraFrame(yaw, pitch, zoom, canvas.clientWidth, canvas.clientHeight, focus ?? { x:0, z:0 });
function tell(message) { status.textContent = message; }
function focusPoint(point, scale = 12) { focus = { x: point.x, z: point.z }; zoom = scale; }
function shutdown() {
  if (stopped) return;
  stopped = true; loadId++; pendingLoad?.abort(); cancelAnimationFrame(raf); events.abort();
  session?.dispose(); session = null; renderer?.dispose(); CrowdTerrain.use(null);
}
function move(point) {
  if (!session) return false;
  const result = session.crowd.command({ kind: 'move', group: selected(), destination: point });
  tell(result.ok ? 'Befehl angenommen; Ankunft wird getrennt gezählt.' : 'Ziel gesperrt, nicht erreichbar oder zu wenig freie Ankunftsplätze.');
  return result.ok;
}
function focusGroup() {
  if (!session) return;
  const members = Array.from(session.frame.ids.subarray(0, session.frame.count), id => session.crowd.getAgent(id))
    .filter(agent => agent.group === selected());
  if (!members.length) { focusPoint(session.portals.south); return; }
  focusPoint({ x: members.reduce((sum,m) => sum+m.x,0)/members.length,
    z: members.reduce((sum,m) => sum+m.z,0)/members.length });
}
async function load(input, label = 'Karten-ZIP') {
  if (stopped) return false;
  pendingLoad?.abort();
  const controller = new AbortController(); pendingLoad = controller;
  const id = ++loadId;
  $('controls').disabled = true; $('sample').disabled = true; previous = null;
  status.setAttribute('aria-busy','true'); tell('Karte prüfen und Profilnavigation aufbauen …');
  // Let the bounded, synchronous terrain/navigation preparation follow a painted loading state.
  await new Promise(resolve => requestAnimationFrame(resolve));
  let next = null;
  try {
    controller.signal.throwIfAborted();
    next = await prepareSession(input, api, CrowdProfiles, controller.signal);
    if (stopped || id !== loadId) { next.dispose(); return false; }
    renderer.install(next.map);
    const old = session;
    session = next; drag = null; CrowdTerrain.use(next.terrain); old?.dispose();
    session.crowd.writeFrame(session.frame,0); previous = null;
    $('waypoint').replaceChildren();
    for (const [name,point] of session.waypoints) {
      const option = document.createElement('option'); option.value = name;
      option.textContent = `${name === 'south' ? 'Südzugang' : name === 'north' ? 'Nordzugang' : name} (${point.x}, ${point.z})`;
      $('waypoint').append(option);
    }
    $('waypoint').value = 'north'; $('group').value = '0';
    $('map-info').textContent = `${label} · ${next.map.manifest.grid.width} × ${next.map.manifest.grid.length} m · 2-m-Raster · Seed ${next.map.manifest.generation.seed}`;
    focusGroup();
    tell(next.spawnComplete ? 'Karte geladen. Kleine Gruppen warten im Süden; Klick oder Wegpunkt erteilt einen Befehl.' : 'Karte geladen; nicht alle Startkörper fanden freie Plätze.');
    return true;
  } catch (error) {
    if (next && next !== session) next.dispose();
    if (!stopped && id === loadId) tell(`Karte nicht geladen: ${error.message}${session ? ' Vorherige Karte bleibt aktiv.' : ''}`);
    return false;
  } finally {
    if (!stopped && id === loadId) {
      $('controls').disabled = !session; $('sample').disabled = false; status.removeAttribute('aria-busy');
    }
  }
}
try {
  renderer = createRenderer(canvas);
  globalThis.StrataCrowdDemo = Object.freeze({ get session() { return session; }, renderer, load,
    get camera() { return session ? camera() : null; }, get paused() { return paused; } });
  on($('sample'),'click',() => load(sample,'STRATA-Beispielkarte'));
  on($('map-file'),'change',event => {
    const file = event.target.files?.[0];
    if (file) load(file,file.name);
    event.target.value = '';
  });
  on($('hold'),'click',() => { session.crowd.command({ kind:'hold',group:selected() }); tell('Gruppe hält; Zielreservierungen freigegeben.'); });
  on($('spawn'),'click',() => {
    if (session.crowd.size >= MAX_DEMO_UNITS) { tell(`Diese kleine Demo ist auf ${MAX_DEMO_UNITS} Körper begrenzt.`); return; }
    const result = session.crowd.spawn(selected(),1);
    tell(result.complete ? 'Einheit gespawnt.' : 'Kein freier Spawn-/Ankunftsplatz.');
  });
  on($('move'),'click',() => move(session.waypoints.get($('waypoint').value)));
  on($('focus-target'),'click',() => focusPoint(session.waypoints.get($('waypoint').value)));
  on($('focus'),'click',focusGroup);
  on($('overview'),'click',() => { focus = null; zoom = 1; });
  on($('pause'),'click',() => {
    paused = !paused; previous = null;
    $('pause').textContent = paused ? 'Fortsetzen' : 'Pause'; $('pause').setAttribute('aria-pressed',String(paused));
    tell(paused ? 'Pausiert.' : 'Simulation läuft.');
  });
  on($('speed'),'input',() => { $('speed-value').textContent = `${Number($('speed').value).toFixed(2)}×`; });
  on($('group'),'change',() => { tell('Aktive Gruppe gewechselt; das Overlay zeigt deren tatsächliche Körperfreiheit.'); });
  on(canvas,'contextmenu',event => event.preventDefault());
  on(canvas,'pointerdown',event => {
    if (drag) { drag.cancelled = true; return; }
    if (!session || ![0,1,2].includes(event.button)) return;
    drag = { id:event.pointerId, startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,
      pan:event.button===1||event.shiftKey,button:event.button,moved:false };
    canvas.setPointerCapture(event.pointerId);
  });
  on(canvas,'pointermove',event => {
    if (!drag || drag.cancelled || drag.id!==event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<=6) return;
    drag.moved = true;
    if (drag.pan) {
      const c = camera(), dx=-(event.clientX-drag.x)*2/(canvas.clientWidth*c.scale[0]);
      const dy=(event.clientY-drag.y)*2/(canvas.clientHeight*c.scale[1]*Math.sin(pitch)**2);
      focus={ x:Math.max(-260,Math.min(260,(focus?.x||0)+c.right[0]*dx+c.up[0]*dy)),
        z:Math.max(-320,Math.min(320,(focus?.z||0)+c.right[2]*dx+c.up[2]*dy)) };
    } else { yaw-=(event.clientX-drag.x)*.008; pitch=Math.max(.35,Math.min(1.35,pitch+(event.clientY-drag.y)*.008)); }
    drag.x=event.clientX; drag.y=event.clientY;
  });
  on(canvas,'pointerup',event => {
    if (!drag || drag.id!==event.pointerId) return;
    if (!drag.moved && !drag.cancelled && !drag.pan && drag.button===0 && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<=6) {
      const rect=canvas.getBoundingClientRect();
      const x=(event.clientX-rect.left-canvas.clientLeft)/canvas.clientWidth*2-1;
      const y=1-(event.clientY-rect.top-canvas.clientTop)/canvas.clientHeight*2;
      const point=CrowdCamera.groundPoint(x,y,camera());
      if (point) move(point); else tell('Kein Boden unter diesem Punkt.');
    }
    drag=null; canvas.releasePointerCapture(event.pointerId);
  });
  for (const name of ['pointercancel','lostpointercapture']) on(canvas,name,() => { drag=null; });
  on(canvas,'wheel',event => { event.preventDefault(); zoom=Math.max(.7,Math.min(80,zoom*Math.exp(-event.deltaY*.001))); },{passive:false});
  on(document,'visibilitychange',() => { previous=null; });
  on(canvas,'webglcontextlost',event => {
    event.preventDefault(); tell('Grafikkontext verloren. Bitte neu laden.'); $('controls').disabled=true; $('map-file').disabled=true; $('sample').disabled=true; shutdown();
  });
  on(window,'pagehide',shutdown);
  function frame(now) {
    if (stopped) return;
    if (session) {
      const dt=previous===null?0:Math.min((now-previous)/1000,.05); previous=now;
      if (!paused && !document.hidden) session.clock.advance(dt*Number($('speed').value),session.crowd.step);
      session.crowd.writeFrame(session.frame,session.clock.alpha);
      const group=session.crowd.getGroups()[selected()], data=session.frame;
      $('spawn').disabled = session.crowd.size >= MAX_DEMO_UNITS;
      let count=0,arrived=0,waiting=0;
      for (let i=0;i<data.count;i++) if (data.groups[i]===group.id) {
        count++; arrived+=Number(data.states[i]===api.AgentState.Arrived); waiting+=Number(data.states[i]===api.AgentState.Waiting);
      }
      const text=`${group.profile==='tank'?'Panzer':'Marines'}: ${count} · angekommen ${arrived} · wartend ${waiting} · Tick ${data.tick} · ${session.crowd.getStats().reservations} reservierte Plätze`;
      if ($('metrics').textContent!==text) $('metrics').textContent=text;
      const mode=$('overlay').value;
      const mask=mode==='profile'?session.masks[group.profile]:mode==='corridor'?session.map.corridors:null;
      const key=`${data.tick}:${data.revision}:${session.clock.alpha}:${yaw}:${pitch}:${zoom}:${focus?.x}:${focus?.z}:${canvas.clientWidth}:${canvas.clientHeight}`;
      renderer.draw(session,camera(),mask,key);
    }
    raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  load(sample,'STRATA-Beispielkarte');
} catch (error) {
  tell(`Demo nicht verfügbar: ${error.message}`); $('controls').disabled=true; $('map-file').disabled=true; $('sample').disabled=true; shutdown();
}
