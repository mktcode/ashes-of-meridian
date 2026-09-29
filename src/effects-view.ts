/* View-only embellishments: never mutate CPU effects or consume simulation RNG. */
'use strict';
interface BattleScar { x:number; z:number; at:number; radius:number; }
const battleScarViews=new WeakMap<MeridianRenderer,{world:Battlefield;team:PlayerTeam;seen:WeakSet<BattlefieldEffect>;scars:BattleScar[]}>();
function renderBattleScars(R:MeridianRenderer,effects:MeridianEffects,world:Battlefield,time:number,team:PlayerTeam) {
  if(!(R.quality>0)||R.cinema){battleScarViews.delete(R);return;}
  let view=battleScarViews.get(R);
  if(!view||view.world!==world||view.team!==team){view={world,team,seen:new WeakSet(),scars:[]};battleScarViews.set(R,view);}
  for(const f of effects.fx)if(f.type==='blast'&&!view.seen.has(f)) {
    view.seen.add(f);
    if(!world.visible[world.idx(f.x,f.z)])continue;
    const radius=clamp(f.size*.8,.6,3.5);
    view.scars.push({x:f.x,z:f.z,at:time,radius});
    if(view.scars.length>32)view.scars.shift();
  }
  let live=0;
  for(const scar of view.scars)if(time-scar.at<38)view.scars[live++]=scar;
  view.scars.length=live;
  let budget=R.quality>1?24:10;
  for(let i=view.scars.length-1;i>=0&&budget>0;i--) {
    const f=view.scars[i],life=1-clamp((time-f.at)/38,0,1);
    if(!world.visible[world.idx(f.x,f.z)])continue;
    budget--;
    // Small local patches follow the slope; they never deform terrain or become obstacles.
    for(let j=0;j<3;j++) {
      const angle=j*2.39996+f.x*.17,x=f.x+Math.cos(angle)*f.radius*.28,z=f.z+Math.sin(angle)*f.radius*.28,
        y=(world.surface?.heightAt(x,z)??0)+.035,r=f.radius*(j?.68:1),
        dx=((world.surface?.heightAt(x+.35,z)??0)-(world.surface?.heightAt(x-.35,z)??0))/.7,
        dz=((world.surface?.heightAt(x,z+.35)??0)-(world.surface?.heightAt(x,z-.35)??0))/.7;
      if(effectBoundsVisible(R,x,y,z,r,.5,r))R.add('plane',x,y,z,r*2,1,r*2,0x302b29,0,-Math.atan(dz),Math.atan(dx),0,life*.19,'effects',CONTACT_SHADOW_MATERIAL);
    }
  }
}
function renderEcologyWeather(R:MeridianRenderer,world:Battlefield,s:RunState) {
  const e=world.renderProfile?.ecology;
  if(!e||!(R.quality>0)||R.cinema||e.weather==='clear')return;
  const radius=R.quality>1?5:3,cx=Math.floor(s.cam.x/12),cz=Math.floor(s.cam.z/12),time=s.time,
    rain=e.weather==='rain',snow=e.weather==='snow',precipitation=rain||snow,
    count=precipitation?(R.quality>1?5:3):1,angle=(e.phase??0)+.4,
    windX=Math.cos(angle)*.36,windZ=Math.sin(angle)*.36,
    eyeX=(R.eye?.[0]??s.cam.x)-s.cam.x,eyeZ=(R.eye?.[2]??s.cam.z+.82)-s.cam.z,
    yaw=Math.atan2(eyeX,eyeZ),pitch=Math.atan2(Math.hypot(eyeX,eyeZ),R.eye?.[1]??1.1),
    visible=(x:number,z:number)=>Math.max(Math.abs(x),Math.abs(z))<world.extent&&!!world.visible[world.idx(x,z)];
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++) {
    const ix=cx+dx,iz=cz+dz,hash=(Math.imul(ix,374761393)^Math.imul(iz,668265263)^world.terrainSeed)>>>0;
    for(let i=0;i<count;i++) {
      const bits=Math.imul(hash^Math.imul(i+1,1597334677),1274126177)>>>0,
        a=precipitation?(bits&65535)/65536:((Math.imul(hash^(hash>>>13),1274126177)>>>0)%65536)/65536,
        b=bits/4294967296,tx=ix*12+a*(precipitation?12:10),tz=iz*12+(precipitation?b*12:((a*7.31)%1)*10);
      if(!visible(tx,tz))continue;
      const floor=world.surface?.heightAt(tx,tz)??0;
      if(e.weather==='mist') {
        if(hash%8)continue;
        const r=4+a*3,y=floor+.35;
        if(effectBoundsVisible(R,tx,y,tz,r,.5,r))R.add('sphere',tx,y,tz,r,.45,r,e.dry,0,0,0,.15,.035,'effects');
      }else if(precipitation) {
        const fall=((a+b*.37)+time*(rain?1+b*.35:.085+b*.055))%1,
          height=(1-fall)*(rain?18:16),fade=Math.min(1,fall*12,(1-fall)*15),
          sway=snow?Math.sin(fall*Math.PI):0,phase=time*(.65+a*.4)+a*Math.PI*2,
          x=tx-windX*height+Math.sin(phase)*sway*(.4+a*.7),
          z=tz-windZ*height+Math.cos(phase*.73)*sway*.6,y=floor+.08+height;
        // Anchor the flight to its landing height, not the changing ground beneath
        // the moving drop. Otherwise slopes bend its trajectory away from the streak.
        if(!visible(x,z)||y<(world.surface?.heightAt(x,z)??0)+.04||fade<=0)continue;
        if(rain) {
          const length=1.2+a*.8,bx=x-windX*length,bz=z-windZ*length;
          if(visible(bx,bz))drawVisibleEffectBeam(R,[x,y,z],[bx,y+length,bz],.04+b*.025,0xc4dbe6,.45,(.42+b*.2)*fade);
        }else {
          const size=.30+b*.45;
          if(effectBoundsVisible(R,x,y,z,size,size,size))R.add('plane',x,y,z,size,1,size,0xe5eff5,yaw,pitch,0,0,
            (.60+a*.26)*fade,'effects',SNOWFLAKE_MATERIAL);
        }
      }else {
        const fall=(a+time*.22)%1,y=floor+(1-fall)*12+.1;
        if(effectBoundsVisible(R,tx,y,tz,.18,.18,.18))R.add('octa',tx+Math.sin(time*.6+a*9)*.6,y,tz,.10,.035,.10,
          0xc6a681,time+a*9,0,time*.3,.25,.36,'effects');
      }
    }
  }
}
function renderWeaponSignature(R:MeridianRenderer,f:Extract<BattlefieldEffect,{type:'beam'}>,faction:FactionId) {
  const life=clamp(f.life/(faction===FACTION_ID.THIRD?.19:.1),0,1),age=1-life,dx=f.tx-f.x,dz=f.tz-f.z,len=Math.hypot(dx,dz)||1,
    sx=-dz/len,sz=dx/len;
  if(faction===FACTION_ID.SECOND) {
    // Helical seed pulses, not the Pact's instantaneous luminous tracer.
    for(let i=0;i<4;i++) {
      const t=clamp(age*1.4-i*.13,0,1),curl=Math.sin(t*12+f.x)*.19;
      const x=f.x+dx*t+sx*curl,z=f.z+dz*t+sz*curl,y=f.y+(f.ty-f.y)*t;
      if(effectBoundsVisible(R,x,y,z,.15,.15,.15))R.add('octa',x,y,z,.10,.13,.10,0xc5ed97,t*6,0,0,1.2,life*.8,'effects');
    }
  }else if(faction===FACTION_ID.THIRD) {
    const width=.10*(1-age);
    for(const side of [-1,1])drawVisibleEffectBeam(R,[f.x+sx*width*side,f.y,f.z+sz*width*side],
      [f.tx,f.ty,f.tz],f.width*.30,0x96dfed,1.8,life*.7);
    drawVisibleEffectBeam(R,[f.tx-sx*.3,f.ty-.3,f.tz-sz*.3],[f.tx+sx*.3,f.ty+.3,f.tz+sz*.3],.035,0xe3cdff,1.8,life*.65);
  }else{
    const start=clamp(age*1.5,0,1),end=clamp(start+.18,0,1);
    drawVisibleEffectBeam(R,[f.x+dx*start,f.y+(f.ty-f.y)*start,f.z+dz*start],
      [f.x+dx*end,f.y+(f.ty-f.y)*end,f.z+dz*end],f.width*.65,0xffedb8,2.1,life);
  }
}
interface MotionDustTrack {
  walk: number;
  emitted: number;
  puffs: { x: number; z: number; at: number }[];
}
const motionDustViews = new WeakMap<MeridianRenderer, { world: Battlefield; team: PlayerTeam; color: readonly number[]; tracks: Map<UnitEntity, MotionDustTrack> }>();
function renderMotionDust(R: MeridianRenderer, world: Battlefield, s: RunState, localTeam: PlayerTeam = 0) {
  if (!(R.quality > 0) || R.cinema) { motionDustViews.delete(R); return; }
  let view = motionDustViews.get(R);
  if (!view || view.world !== world || view.team !== localTeam) {
    view = { world, team: localTeam, color: Array.from(world.renderProfile?.ecology?.dry ?? R.color(world.definition.palette.ground), c => c * .55 + .35), tracks: new Map() };
    motionDustViews.set(R, view);
  }
  const seen = new Set<UnitEntity>(), cap = R.quality > 1 ? 48 : 24, now = s.time;
  for (const e of s.entities) {
    if (seen.size >= cap) break;
    if (e.kind !== 'unit' || e.hp <= 0 || (e.type !== 'tank' && e.type !== 'artillery') || !world.visible[world.idx(e.x,e.z)]) continue;
    const p = R.project(e.x, world.surface?.heightAt(e.x,e.z) ?? 0, e.z), v = R.viewport;
    if (!p || p.x < v.left - 30 || p.x > v.right + 30 || p.y < v.top - 30 || p.y > v.bottom + 30) continue;
    seen.add(e);
    let track = view.tracks.get(e);
    if (!track) { track = { walk: e.walk, emitted: now, puffs: [] }; view.tracks.set(e, track); }
    if (e.walk > track.walk && now - track.emitted >= .18) {
      const side = Math.sin(e.id * 7 + Math.floor(e.walk * 3)) > 0 ? 1 : -1;
      track.puffs.push({ x: e.x - Math.sin(e.rot) * e.size + Math.cos(e.rot) * side * e.size * .65,
        z: e.z - Math.cos(e.rot) * e.size - Math.sin(e.rot) * side * e.size * .65, at: now });
      track.emitted = now;
    }
    track.walk = e.walk;
    track.puffs = track.puffs.filter(puff => now - puff.at < .42).slice(R.quality > 1 ? -2 : -1);
    for (const puff of track.puffs) {
      if (!world.visible[world.idx(puff.x,puff.z)]) continue;
      const age = clamp((now - puff.at) / .42, 0, 1), radius = .3 + age * .6;
      R.add('sphere', puff.x, (world.surface?.heightAt(puff.x,puff.z) ?? 0) + .18 + age * .35, puff.z, radius, radius * .45, radius,
        view.color, 0, 0, 0, 0, (1 - age) * .17, 'effects');
    }
  }
  for (const e of view.tracks.keys()) if (!seen.has(e)) view.tracks.delete(e);
}
// Conservative clip-plane test of a world AABB, padded for bloom/postprocessing.
// Missing camera data in CPU-only views means no culling, not an invisible effect.
function effectBoundsVisible(R: MeridianRenderer, x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  const m = R.vp;
  if (!m || !Number.isFinite(x + y + z + rx + ry + rz)) return true;
  for (let axis = 0; axis < 3; axis++) {
    const pad = axis === 2 ? 1 : 1 + 128 / (axis === 0 ? R.viewport.width : R.viewport.height);
    for (let sign = -1; sign <= 1; sign += 2) {
      const a = pad * m[3] + sign * m[axis], b = pad * m[7] + sign * m[4 + axis],
        c = pad * m[11] + sign * m[8 + axis], d = pad * m[15] + sign * m[12 + axis];
      if (a * x + b * y + c * z + d + Math.abs(a) * rx + Math.abs(b) * ry + Math.abs(c) * rz < 0) return false;
    }
  }
  return true;
}
const effectSurfaceBounds = new WeakMap<BattlefieldSurface, { low: number; high: number }>();
// At most 192 segments plus the closing point; reused only within synchronous drawing.
const effectRingPoints = new WeakMap<MeridianRenderer, Float64Array>();
function effectGroundBounds(R: MeridianRenderer) {
  const surface = R.surface;
  if (!surface || R.cinema) return { low: 0, high: 0 };
  let bounds = effectSurfaceBounds.get(surface);
  if (!bounds) {
    let low = Infinity, high = -Infinity;
    // Heights are immutable for the lifetime of a battlefield surface. Include
    // negative terrain too; maxHeight alone is not a conservative lower bound.
    for (const h of surface.heights || []) { low = Math.min(low, h); high = Math.max(high, h); }
    bounds = { low, high };
    effectSurfaceBounds.set(surface, bounds);
  }
  return bounds;
}
function drawVisibleEffectBeam(R: MeridianRenderer, a: number[], b: number[], width: number, color: RenderColor, glow: number, alpha: number) {
  if (effectBoundsVisible(R, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2,
    Math.abs(a[0] - b[0]) / 2 + width, Math.abs(a[1] - b[1]) / 2 + width, Math.abs(a[2] - b[2]) / 2 + width))
    R.beam(a, b, width, color, glow, alpha);
}
        function drawEffectRing(R: MeridianRenderer, x: number, z: number, r: number, color: RenderColor, alpha = 0.65, y = 0.1, rot = 0) {
          const ground = effectGroundBounds(R), thickness = .05;
          if (!effectBoundsVisible(R, x, (ground.low + ground.high) / 2 + y, z,
            Math.abs(r) + thickness, (ground.high - ground.low) / 2 + thickness, Math.abs(r) + thickness)) return;
          if (R.surface && !R.cinema) {
            // Follow each local surface segment, rather than floating a large flat ring over ramps.
            const count = Math.min(192,Math.max(24,Math.ceil(r * Math.PI * 2 / 1.25)));
            let low = Infinity, high = -Infinity;
            let points = effectRingPoints.get(R);
            if (!points) { points = new Float64Array(193 * 3); effectRingPoints.set(R, points); }
            for (let i = 0; i <= count; i++) {
              const a = rot+i*Math.PI*2/count, px = x+Math.sin(a)*r, pz = z+Math.cos(a)*r,
                h = R.surface.heightAt(px,pz);
              points[i*3] = px; points[i*3+1] = h+y; points[i*3+2] = pz;
              if (i < count) { low = Math.min(low,h); high = Math.max(high,h); }
            }
            if (high-low < .01) {
              R.add('ring',x,high+y,z,r,1,r,color,rot,0,0,.45,alpha,'effects');
              return;
            }
            for (let i = 0; i < count; i++) {
              const a = i*3, b = (i+1)*3;
              R.beam([points[a],points[a+1],points[a+2]],[points[b],points[b+1],points[b+2]],.045,color,.45,alpha);
            }
          } else R.add('ring', x, y, z, r, 1, r, color, rot, 0, 0, 0.45, alpha, 'effects');
        }
        function renderBattlefieldEffects(R: MeridianRenderer, effects: MeridianEffects, world: Battlefield, s: RunState, pings: UIPing[], t: number, localTeam: PlayerTeam = 0) {
          const ring = (...args: EffectRingArgs) => drawEffectRing(R, ...args);
          renderMotionDust(R, world, s, localTeam);
          renderEcologyWeather(R, world, s);
          renderBattleScars(R, effects, world, s.time, localTeam);
          for (const e of s.entities) {
            if (e.kind !== 'unit' || e.type !== 'hero' || e.hp <= 0 || e.team === -1 ||
              !(s.parties[e.team]?.benefits.commandDrill > 0) || !world.visible[world.idx(e.x,e.z)]) continue;
            const color = e.team === localTeam ? 0x94e4d1 : 0xf2a490,
              alpha = .16 + (.5 + .5 * Math.sin(t * 1.7 + e.id)) * .05;
            ring(e.x, e.z, COMMAND_DRILL.radius, color, alpha, .11);
          }
          // Culling must not redistribute the existing accent budget to later effects.
          let accents = R.quality > 1 ? 48 : R.quality > 0 ? 16 : 0,
            signatures = R.quality > 1 ? 32 : R.quality > 0 ? 12 : 0;
          for (let f of effects.fx) {
            if (!world.visible[world.idx(f.x, f.z)] && (f.type !== 'drop' || (f.team ?? 0) !== localTeam)) continue;
            let life = clamp(f.life / f.maxLife, 0, 1),
              age = 1 - life;
            if (f.type === 'beam') {
              drawVisibleEffectBeam(R, [f.x, f.y, f.z], [f.tx, f.ty, f.tz], f.width, f.color, 1.6, Math.min(1, life * 3));
              const faction=effects.weaponFactions?.get(f);
              if(signatures>0&&faction!==undefined&&world.visible[world.idx(f.tx,f.tz)]){
                signatures--;renderWeaponSignature(R,f,faction);
              }
              if (accents > 0 && effects.combatBeams.has(f)) {
                accents--;
                const flash = clamp(f.life / .1, 0, 1), radius = .14 + f.width * 2;
                if (effectBoundsVisible(R, f.x, f.y, f.z, radius, radius * .7, radius))
                  R.add('sphere', f.x, f.y, f.z, radius, radius * .7, radius, f.color, 0, 0, 0, 2, flash * .8, 'effects');
                // Place the accent at the approximate hull, not inside the target mesh.
                const dx = f.x - f.tx, dz = f.z - f.tz, distance = Math.max(.001, Math.hypot(dx,dz));
                const hitRadius = Math.min(effects.combatBeams.get(f) || .65, distance * .5);
                const hitX = f.tx + dx / distance * hitRadius, hitZ = f.tz + dz / distance * hitRadius;
                if (world.visible[world.idx(f.tx,f.tz)] && world.visible[world.idx(hitX,hitZ)]) {
                  for (let i = 0; i < (R.quality > 1 ? 3 : 1); i++) {
                    const angle = Math.atan2(dx,dz) + Math.sin(f.tx * 1.7 + f.tz * 2.3 + i * 2.39996) * .9, length = .15 + age * .8;
                    drawVisibleEffectBeam(R, [hitX, f.ty, hitZ], [hitX + Math.sin(angle) * length, f.ty + length * .7, hitZ + Math.cos(angle) * length],
                      .025, f.color, 1.5, life * .7);
                  }
                }
              }
            } else if (f.type === 'shell') {
              if (accents > 0 && age * f.maxLife < .1) {
                accents--;
                if (effectBoundsVisible(R, f.x, f.y, f.z, .27, .2, .27))
                  R.add('sphere', f.x, f.y, f.z, .27, .2, .27, f.color, 0, 0, 0, 2, (1 - age * f.maxLife / .1) * .8, 'effects');
              }
              let x = f.x + (f.tx - f.x) * age,
                z = f.z + (f.tz - f.z) * age,
                y = f.startY * (1 - age) + (f.endY ?? 0) * age + Math.sin(age * Math.PI) * 12;
              // Shell bodies and particles use the dynamic layer and may cast into view.
              R.add('sphere', x, y, z, 0.22, 0.22, 0.22, f.color, 0, 0, 0, 2);
              drawVisibleEffectBeam(R,
                [x, y, z],
                [x - (f.tx - f.x) * 0.03, y + 0.3, z - (f.tz - f.z) * 0.03],
                0.07,
                f.color,
                1.4,
                0.65
              );
            } else if (f.type === 'blast') {
              let r = (0.4 + age * 1.8) * f.size,
                y = (world.surface?.heightAt(f.x,f.z) ?? 0) + 0.6 + age * f.size * 0.6;
              if (effectBoundsVisible(R, f.x, y, f.z, r, r * .6, r)) R.add(
                'sphere',
                f.x,
                y,
                f.z,
                r,
                r * 0.6,
                r,
                f.color,
                0,
                0,
                0,
                1.6,
                life * 0.7,
                'effects'
              );
              ring(f.x, f.z, r * 1.7, f.color, life * 0.8, 0.16);
              if(signatures>0){
                signatures--;
                for(let i=0;i<(R.quality>1?3:1);i++){
                  const a=i*2.39996+f.x*.31+f.z*.19,x=f.x+Math.sin(a)*r*.48,z=f.z+Math.cos(a)*r*.48,
                    py=y+Math.sin(a+age*4)*r*.18,size=r*(.38+i*.05);
                  if(effectBoundsVisible(R,x,py,z,size,size,size))R.add('sphere',x,py,z,size,size*.7,size,
                    i%2?f.color:0xffdfac,0,0,0,1.4,life*.23,'effects');
                }
              }
            } else if (f.type === 'particle')
              R.add(
                'box',
                f.x,
                f.y,
                f.z,
                f.size,
                f.size,
                f.size,
                f.color,
                age * 7,
                age * 5,
                0,
                life * 0.8
              );
            else if (f.type === 'smoke') {
              let r = f.size * (1 + age * 0.9);
              if (effectBoundsVisible(R, f.x, f.y, f.z, r, r * .8, r))
                R.add('sphere', f.x, f.y, f.z, r, r * 0.8, r, f.color, 0, 0, 0, 0, life * 0.2, 'effects');
            } else if (f.type === 'drop') {
              const base = world.surface?.heightAt(f.x,f.z) ?? 0;
              drawVisibleEffectBeam(R, [f.x, base + 0.2, f.z], [f.x, base + life * 24 + 2, f.z], life * 0.24, f.color, 1.3, life);
              ring(f.x, f.z, 1 + age * 2.5, f.color, life);
            }
          }
          for (let p of pings)
            ring(p.x, p.z, 1 + (1 - p.life / p.maxLife) * 4, p.color || 0x9fe9d6, p.life / p.maxLife);
          for (let f of s.fields) {
            if ((f.team ?? 0) !== localTeam && !world.visible[world.idx(f.x,f.z)]) continue;
            let left = f.until - s.time;
            if (left <= 0) continue;
            const colors: Record<Field['type'], [number, number]> = {
              bloom: [0xb5e794, 0xa3cc8b], repair: [0x91e5d3, 0x7ecebb],
              disruption: [0xb49aef, 0x7964bd], bulwark: [0x7ed9f2, 0x5babc9], surge: [0xf1bc72, 0xd08d47]
            }, color = colors[f.type];
            ring(f.x, f.z, f.r || 12, color[0], 0.3 + 0.15 * Math.sin(t * 3));
            const y = (world.surface?.heightAt(f.x,f.z) ?? 0) + 0.25, radius = f.r || 12;
            if (effectBoundsVisible(R, f.x, y, f.z, radius, .16, radius)) R.add(
              'sphere', f.x, y, f.z, f.r || 12, 0.16, f.r || 12, color[1],
              0, 0, 0, 0.3, 0.04, 'effects'
            );
          }
          for (const recall of s.recalls || []) {
            if (recall.team !== localTeam && !world.visible[world.idx(recall.x, recall.z)]) continue;
            const life = clamp((recall.at - s.time) / 3, 0, 1);
            ring(recall.x, recall.z, 9 * (.45 + life * .55), 0xd1b3f4, .45 + (1 - life) * .35, .14);
          }
          for (let scan of s.scans) {
            if ((scan.team ?? 0) !== localTeam) continue;
            let left = scan.until - s.time;
            if (left > 0)
              ring(scan.x, scan.z, scan.r || 32, 0x9bc6ea, 0.1 + (0.5 + 0.5 * Math.sin(t * 2)) * 0.1);
          }
          for (let a of s.strikes) {
            if (a.type === 'shell' || (a.team !== localTeam && !world.visible[world.idx(a.x,a.z)])) continue;
            let wait = a.at - s.time,
              col = a.team === localTeam ? 0x9fe3d1 : 0xf4ad84,
              rad = a.radius || 10;
            ring(a.x, a.z, rad, col, 0.58, 0.14);
            ring(
              a.x,
              a.z,
              rad * clamp(wait / (a.type === 'flare' ? 5 : a.warning || 2.2), 0.05, 1),
              col,
              0.85,
              0.15
            );
            const base = world.surface?.heightAt(a.x,a.z) ?? 0;
            drawVisibleEffectBeam(R, [a.x, base + 0.1, a.z], [a.x, base + 10 + Math.sin(t * 4) * 1, a.z], 0.045, col, 1.2, 0.5);
          }
        }
