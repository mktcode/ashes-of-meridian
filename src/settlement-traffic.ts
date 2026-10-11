/* Cosmetic, world-bound traffic. Never inserted into entities, saves, collision or combat. */
'use strict';
type SettlementTrafficPoint = Position & { y: number };
interface SettlementTrafficPortal {
  building: BuildingEntity;
  inside: SettlementTrafficPoint;
  door: SettlementTrafficPoint;
  deck: SettlementTrafficPoint[];
  stairs: SettlementTrafficPoint;
  landing: SettlementTrafficPoint;
  service: SettlementTrafficPoint;
  groundAccess: boolean;
}
interface SettlementTrafficActor extends SettlementTrafficPoint {
  id: number;
  forumId: number;
  air: boolean;
  random: () => number;
  nextTrip: number;
  route: SettlementTrafficPoint[] | null;
  segment: number;
  groundStart: number;
  groundEnd: number;
  rot: number;
  walk: number;
  alpha: number;
  tripKey: string;
  homeId?: number;
  destinationId: number;
  outside: boolean;
  sourceOutside: boolean;
  destinationOutside: boolean;
  lingerUntil: number;
}
class SettlementTraffic {
  private world: Battlefield | null = null;
  private state: RunState | null = null;
  private team: PlayerTeam | null = null;
  private time: number | null = null;
  private layout = '';
  private groups = new Map<number,SettlementTrafficPortal[]>();
  private actors: SettlementTrafficActor[] = [];
  private routes = new Map<string,readonly Position[] | null>();
  private meetingPoints = new Map<number,SettlementTrafficPoint>();
  private navigation = -1;
  private nextSearch = 0;
  private cursor = 0;
  private nextRouteRefresh = 0;
  private roadUsage: ((x: number,z: number) => number) | undefined;
  reset() {
    this.world=null;this.state=null;this.team=null;this.time=null;this.layout='';
    this.groups.clear();this.actors=[];this.routes.clear();this.meetingPoints.clear();this.navigation=-1;this.nextSearch=0;this.cursor=0;this.nextRouteRefresh=0;this.roadUsage=undefined;
  }
  update(world: Battlefield, state: RunState, quality: number, observed: (e: Entity) => boolean,
      roadUsage?: (x: number,z: number) => number) {
    if(state.rules.kind!=='single-player'||!state.rules.completed||state.result||state.stopped) {this.reset();return;}
    if(this.world!==world||this.state!==state||this.team!==world.viewTeam) {
      this.reset();this.world=world;this.state=state;this.team=world.viewTeam;
    }
    this.roadUsage=roadUsage;
    const now=state.time,dt=this.time===null?0:now-this.time;
    this.time=now;
    const forums=new Map(state.entities.filter((e):e is BuildingEntity=>e.kind==='building'&&e.type==='meridianforum'&&e.hp>0&&e.progress>=1)
      .map(e=>[e.id,e.team]));
    const upgrades=state.entities.filter((e):e is BuildingEntity=>e.kind==='building'&&e.hp>0&&e.progress>=1&&
      e.forumId!==undefined&&forums.get(e.forumId)===e.team&&e.settlementAt===undefined&&observed(e));
    const suppliedForums=new Set(upgrades.map(b=>b.forumId));
    const buildings=[...upgrades,...state.entities.filter((e):e is BuildingEntity=>e.kind==='building'&&
      forums.has(e.id)&&suppliedForums.has(e.id)&&observed(e))];
    const key=`${quality===0?0:1}:${world.pathVersion}|`+buildings.map(b=>`${b.id}:${b.forumId}:${b.type}:${b.x}:${b.z}:${b.size}:${b.team}:${b.visualRotation||0}`).join('|');
    if(key!==this.layout||dt<0||dt>1) {
      const previous=new Map(this.actors.map(a=>[a.id,a]));
      this.layout=key;this.groups.clear();this.routes.clear();this.meetingPoints.clear();this.actors=[];this.cursor=0;
      for(const b of buildings) {
        const portal=this.portal(world,b);
        if(!portal) continue;
        const forumId=b.type==='meridianforum'?b.id:b.forumId!;
        const group=this.groups.get(forumId)||[];group.push(portal);this.groups.set(forumId,group);
      }
      // Round-robin allocation prevents the first Forum consuming the entire budget.
      const eligible=[...this.groups].filter(([,g])=>g.length>=2),
        portalKeys=new Set(buildings.map(b=>this.portalKey(b)));
      const groundLimit=quality===0?30:60,localGroundLimit=quality===0?12:24,airLimit=quality===0?3:6;
      for(const air of [false,true]) {
        let count=0;
        for(let slot=0;slot<(air?3:localGroundLimit);slot++) for(const [forumId,group] of eligible) {
          const upgradeCount=group.filter(p=>p.building.type!=='meridianforum').length;
          if((air&&upgradeCount<2)||count>=(air?airLimit:groundLimit)||
            slot>=(air?Math.min(3,upgradeCount):Math.min(localGroundLimit,upgradeCount*2))) continue;
          const id=-(forumId*64+slot+(air?32:0)+1),random=seeded(state.seed^Math.imul(forumId,0x45d9f3b)^Math.imul(-id,0x119de1f3)),
            old=previous.get(id);
          if(old&&dt>=0&&dt<=1) {
            if((old.route||old.outside)&&!old.tripKey.split('|').every(k=>portalKeys.has(k))) {
              old.route=null;old.alpha=0;old.outside=false;old.lingerUntil=0;old.homeId=undefined;old.nextTrip=now+1+old.random()*6;
            }
            this.actors.push(old);
          } else this.actors.push({id,forumId,air,random,nextTrip:now+.5+random()*6,route:null,segment:0,groundStart:0,groundEnd:0,
            x:0,y:0,z:0,rot:0,walk:0,alpha:0,tripKey:'',destinationId:0,outside:false,sourceOutside:false,destinationOutside:false,lingerUntil:0});count++;
        }
      }
      this.nextSearch=Math.max(this.nextSearch,now+.5);
    }
    if(this.navigation!==world.pathVersion) {
      this.navigation=world.pathVersion;this.routes.clear();this.meetingPoints.clear();
      // Preserve unaffected trips during normal settlement growth. Recheck only on navigation changes.
      for(const actor of this.actors) if(!actor.air&&(actor.route||actor.outside)) {
        let valid=!actor.outside||(!!actor.route&&!actor.lingerUntil)||
          (!world.blockedAt(actor.x,actor.z)&&!!world.surface?.fits(actor.x,actor.z,.2));
        if(actor.route) for(let i=actor.groundStart;i<actor.groundEnd;i++)
          if(!world.lineFree(actor.route[i],actor.route[i+1],.2)) {valid=false;break;}
        if(!valid) {actor.route=null;actor.alpha=0;actor.outside=false;actor.lingerUntil=0;actor.homeId=undefined;actor.nextTrip=now+1+actor.random()*6;}
      }
    }
    // Refresh only future trips occasionally, so evolving/fading roads can influence routes.
    if(now>=this.nextRouteRefresh) {this.routes.clear();this.nextRouteRefresh=now+30;}
    if(dt<=0||dt>1) return;
    for(const actor of this.actors) if(actor.route) this.advance(actor,world,dt,now);
    // At most one trip preparation per quarter-second, globally; only ground trips can run A*.
    if(now<this.nextSearch||!this.actors.length) return;
    for(let i=0;i<this.actors.length;i++) {
      const actor=this.actors[this.cursor++%this.actors.length];
      if(actor.route||actor.nextTrip>now) continue;
      this.nextSearch=now+.25;actor.nextTrip=now+8+actor.random()*8;
      this.depart(actor,world);break;
    }
  }
  private portalKey(b: BuildingEntity): string {
    return `${b.id}:${b.type}:${b.x}:${b.z}:${b.size}:${b.team}:${b.visualRotation||0}`;
  }
  private portal(world: Battlefield,b: BuildingEntity): SettlementTrafficPortal | null {
    const entry=(BUILDINGS[b.type] as BuildingDefinitionShape).civilizationEntry;
    if(entry?.doorZ===undefined||!world.surface) return null;
    const yaw=buildingVisualYaw(b),cs=Math.cos(yaw),sn=Math.sin(yaw),scale=CIVILIZATION_MODEL_SCALE,
      base=world.surface.buildingPose(b,b.size).height,
      point=(z:number,y:number):SettlementTrafficPoint=>({x:b.x+entry.x*scale*cs+z*sn,z:b.z-entry.x*scale*sn+z*cs,y}),
      inside=point(entry.doorZ*scale-.28,base+(entry.top??.35)*scale),
      door=point(entry.doorZ*scale+.26,inside.y),
      stairs=point(entry.z*scale,inside.y),
      landing=point(entry.z*scale+entry.length,0),
      service=point(Math.max(entry.z*scale+entry.length+.6,b.size+world.cellSize*1.5),0);
    landing.y=world.surface.heightAt(landing.x,landing.z);service.y=world.surface.heightAt(service.x,service.z);
    const groundAccess=!world.blockedAt(service.x,service.z)&&world.surface.fits(service.x,service.z,.2)&&
      world.terrainFree(landing,service,.2)&&this.approachFree(world,b,landing,service);
    const deck:SettlementTrafficPoint[]=b.type==='meridianforum' ? [[4,6.4],[4,9],[0,9]].map(([x,z])=>{
      const s=FORUM_MODEL_SCALE*scale;
      return {x:b.x+x*s*cs+z*s*sn,z:b.z-x*s*sn+z*s*cs,y:inside.y};
    }) : [];
    return {building:b,inside,door,deck,stairs,landing,service,groundAccess};
  }
  private approachFree(world: Battlefield,owner: BuildingEntity,a: Position,b: Position): boolean {
    // The owning structure intentionally contains the doorway/stairs. No other obstacle is exempt.
    const n=Math.ceil(distance(a,b)/.4);
    for(let i=0;i<=n;i++) {
      const t=n?i/n:0,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,idx=world.idx(x,z);
      if(world.staticGrid[idx]&&!world.surface?.cliffs[idx]) return false;
      for(const e of this.state!.entities) if(e.id!==owner.id&&e.hp>0&&e.kind!=='unit'&&Math.hypot(x-e.x,z-e.z)<e.size+.2) return false;
    }
    return true;
  }
  private outdoorPortal(portal: SettlementTrafficPortal,p: SettlementTrafficPoint): SettlementTrafficPortal {
    const point={x:p.x,y:p.y,z:p.z};
    return {...portal,inside:point,door:point,deck:[],stairs:point,landing:point,service:point,groundAccess:true};
  }
  private meetingSpot(actor: SettlementTrafficActor,world: Battlefield,forum: BuildingEntity,goal: SettlementTrafficPoint): SettlementTrafficPoint {
    const anchor=this.meetingPoints.get(forum.id)!,center=distance(anchor,goal)<3?anchor:goal,
      area=civilizationForumServiceArea(forum);
    for(let i=0;i<16;i++) {
      const slot=(-actor.id+i)%16,angle=slot*Math.PI/4,radius=slot<8?.9:1.8,
        p={x:center.x+Math.sin(angle)*radius,z:center.z+Math.cos(angle)*radius,y:0};
      if(distance(p,area)>area.radius||world.blockedAt(p.x,p.z)||!world.surface!.fits(p.x,p.z,.2)||
        !world.lineFree(goal,p,.2)) continue;
      if(this.actors.some(a=>a!==actor&&a.forumId===actor.forumId&&
        ((a.outside&&distance(a,p)<.65)||(a.destinationOutside&&a.route&&distance(a.route[a.route.length-1],p)<.65)))) continue;
      p.y=world.surface!.heightAt(p.x,p.z);return p;
    }
    return {...goal};
  }
  private depart(actor: SettlementTrafficActor,world: Battlefield) {
    const group=this.groups.get(actor.forumId)!;
    const candidates=group.filter(p=>actor.air ? p.building.type!=='meridianforum' :
      p.building.type==='meridianforum'||p.groundAccess);
    if(candidates.length<2) return;
    const sources=candidates.filter(p=>p.building.type!=='meridianforum'),
      home=candidates.find(p=>p.building.id===actor.homeId),
      source=home||sources[Math.floor(actor.random()*sources.length)];
    if(!source) return;
    const from=source.building.type==='meridianforum' ? this.outdoorPortal(source,actor) : source,
      forum=candidates.find(p=>p.building.type==='meridianforum'),
      others=candidates.filter(p=>p!==source&&p!==forum);
    let to=forum&&source!==forum&&(!others.length||actor.random()<1/3)?forum:
        others[Math.floor(actor.random()*others.length)];
    if(!to) return;
    let middle:SettlementTrafficPoint[];
    if(actor.air) {
      // Only nearby buildings affect this flight: a distant hilltop Forum must not raise all traffic.
      let cruise=Math.max(from.service.y,to.service.y)+12;
      const dx=to.service.x-from.service.x,dz=to.service.z-from.service.z,length2=dx*dx+dz*dz;
      for(const e of this.state!.entities) if(e.kind==='building'&&e.hp>0) {
        const t=length2?Math.max(0,Math.min(1,((e.x-from.service.x)*dx+(e.z-from.service.z)*dz)/length2)):0;
        if(Math.hypot(e.x-from.service.x-dx*t,e.z-from.service.z-dz*t)>e.size+3) continue;
        cruise=Math.max(cruise,(world.surface?.buildingPose(e,e.size).height||0)+(e.size>8?24:16));
      }
      // Sample the straight cruise corridor, keeping aircraft above natural terrain too.
      const steps=Math.ceil(distance(from.service,to.service)/2);
      for(let i=0;i<=steps;i++) {
        const t=steps?i/steps:0;
        cruise=Math.max(cruise,(world.surface?.heightAt(from.service.x+(to.service.x-from.service.x)*t,
          from.service.z+(to.service.z-from.service.z)*t)||0)+12);
      }
      middle=[{...from.service,y:cruise},{...to.service,y:cruise}];
    } else {
      const key=`${from.building.id}:${to.building.id}`+
        (source.building.type==='meridianforum'?`:${from.service.x}:${from.service.z}`:'');
      let route=this.routes.get(key);
      if(route===undefined) {
        const target=to.building.type==='meridianforum' ? this.meetingPoints.get(to.building.id)||to.service : to.service,
          area=to.building.type==='meridianforum' ? civilizationForumServiceArea(to.building) : undefined;
        const result=world.path(from.service.x,from.service.z,target.x,target.z,false,area,.2,false,600,
          this.roadUsage ? (x,z)=>1+.3*(1-clamp(this.roadUsage!(x,z),0,1)) : undefined);
        route=result.status==='complete'?result.points.map(p=>({...p})):null;
        if(this.routes.size>=64) this.routes.delete(this.routes.keys().next().value!);
        this.routes.set(key,route);
      }
      if(!route) return;
      middle=route.map(p=>({...p,y:world.surface?.heightAt(p.x,p.z)||0}));
      if(to.building.type==='meridianforum') {
        const goal=middle[middle.length-1]||from.service;
        if(!this.meetingPoints.has(to.building.id)) this.meetingPoints.set(to.building.id,{...goal});
        to=this.outdoorPortal(to,this.meetingSpot(actor,world,to.building,goal));
        // The extra short connection is independently checked; never walk across a cliff to join a group.
        middle.push(to.service);
      }
    }
    const trip=[from.inside,from.door,...from.deck,from.stairs,from.landing,from.service,...middle,to.service,to.landing,to.stairs,...[...to.deck].reverse(),to.door,to.inside]
      .filter((p,i,all)=>!i||Math.hypot(p.x-all[i-1].x,p.y-all[i-1].y,p.z-all[i-1].z)>.01);
    actor.groundStart=trip.indexOf(from.service);
    actor.groundEnd=to.building.type==='meridianforum'?trip.length-1:trip.length-5-to.deck.length;
    actor.route=trip.map(p=>({...p}));
    actor.sourceOutside=from.building.type==='meridianforum';actor.destinationOutside=to.building.type==='meridianforum';
    actor.outside=actor.sourceOutside;actor.lingerUntil=0;
    actor.destinationId=to.building.id;
    actor.tripKey=`${this.portalKey(from.building)}|${this.portalKey(to.building)}`;
    Object.assign(actor,actor.route[0]);actor.segment=0;actor.alpha=actor.sourceOutside?1:0;actor.walk=0;
  }
  private advance(actor: SettlementTrafficActor,world: Battlefield,dt:number,now:number) {
    const route=actor.route!;
    if(actor.lingerUntil>now) return;
    if(actor.lingerUntil) {actor.route=null;actor.lingerUntil=0;actor.nextTrip=now;return;}
    let remaining=dt*(actor.air?7:1.8);
    while(remaining>0&&actor.segment<route.length-1) {
      const goal=route[actor.segment+1],dx=goal.x-actor.x,dy=goal.y-actor.y,dz=goal.z-actor.z,
        length=Math.hypot(dx,dy,dz),step=Math.min(remaining,length),t=length?step/length:1;
      if(Math.hypot(dx,dz)>.001) actor.rot=Math.atan2(dx,dz);
      actor.x+=dx*t;actor.y+=dy*t;actor.z+=dz*t;actor.walk+=step;remaining-=step;
      if(length<=step+.0001) actor.segment++;
    }
    if(actor.segment>=route.length-1) {
      actor.homeId=actor.destinationId;actor.walk=0;
      if(actor.destinationOutside) {
        actor.outside=true;actor.alpha=1;
        const peers=this.actors.filter(a=>a!==actor&&a.forumId===actor.forumId&&a.lingerUntil>now),
          center=this.meetingPoints.get(actor.forumId);
        actor.lingerUntil=now+(peers.length<6&&actor.random()<.7 ? 12+actor.random()*16 : 2+actor.random()*4);
        if(center) actor.rot=Math.atan2(center.x-actor.x,center.z-actor.z);
      } else {
        actor.route=null;actor.outside=false;actor.alpha=0;actor.nextTrip=now+(actor.air?3:1)+actor.random()*(actor.air?7:4);
      }
      return;
    }
    // Door crossings fade only inside the wall, never while waiting in front of it.
    const edge=actor.segment===0&&!actor.sourceOutside?distance(actor,route[0])/.3:
      actor.segment===route.length-2&&!actor.destinationOutside?distance(actor,route[route.length-1])/.3:1;
    actor.alpha=Math.min(1,edge);
    // The navigation path sits on the real triangles; staircase/deck links retain their authored heights.
    if(!actor.air&&actor.segment>=actor.groundStart&&actor.segment<actor.groundEnd)
      actor.y=world.surface?.heightAt(actor.x,actor.z)||0;
  }
  walkers(): readonly SettlementTrafficActor[] {
    return this.actors.filter(a=>!a.air&&a.route&&a.alpha>0&&this.world!.visible[this.world!.idx(a.x,a.z)]);
  }
  draw(R: MeridianRenderer) {
    if(!this.world) return;
    for(const actor of this.actors) {
      if((!actor.route&&!actor.outside)||actor.alpha<=0||!this.world.visible[this.world.idx(actor.x,actor.z)]) continue;
      const projected=R.project(actor.x,actor.y,actor.z),v=R.viewport;
      if(projected&&(projected.x<v.left-30||projected.x>v.right+30||projected.y<v.top-60||projected.y>v.bottom+30)) continue;
      const cs=Math.cos(actor.rot),sn=Math.sin(actor.rot),
        part:ModelPart=(shape,x,y,z,sx,sy,sz,color,ry=0,rx=0,rz=0,glow=0)=>
          R.add(shape,actor.x+x*cs+z*sn,actor.y+y,actor.z-x*sn+z*cs,sx,sy,sz,color,
            actor.rot+ry,rx,rz,glow,actor.alpha,'dynamic',MAT.METAL);
      const color=[0x9aafa4,0xb9a58b,0x819bac,0xd83b35,0xf28c28][-actor.id%5];
      SettlementTrafficModels[actor.air?'drone':'civilian']({part,walk:actor.walk,color});
    }
  }
}
