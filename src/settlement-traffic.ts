/* Cosmetic, world-bound traffic. Never inserted into entities, saves, collision or combat. */
'use strict';
type SettlementTrafficPoint = Position & { y: number };
interface SettlementTrafficPortal {
  building: BuildingEntity;
  inside: SettlementTrafficPoint;
  door: SettlementTrafficPoint;
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
  rot: number;
  walk: number;
  alpha: number;
  tripKey: string;
  homeId?: number;
  destinationId: number;
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
  private navigation = -1;
  private nextSearch = 0;
  private cursor = 0;
  reset() {
    this.world=null;this.state=null;this.team=null;this.time=null;this.layout='';
    this.groups.clear();this.actors=[];this.routes.clear();this.navigation=-1;this.nextSearch=0;this.cursor=0;
  }
  update(world: Battlefield, state: RunState, quality: number, observed: (e: Entity) => boolean) {
    if(state.rules.kind!=='single-player'||!state.rules.completed||state.result||state.stopped) {this.reset();return;}
    if(this.world!==world||this.state!==state||this.team!==world.viewTeam) {
      this.reset();this.world=world;this.state=state;this.team=world.viewTeam;
    }
    const now=state.time,dt=this.time===null?0:now-this.time;
    this.time=now;
    const forums=new Map(state.entities.filter((e):e is BuildingEntity=>e.kind==='building'&&e.type==='meridianforum'&&e.hp>0&&e.progress>=1)
      .map(e=>[e.id,e.team]));
    const buildings=state.entities.filter((e):e is BuildingEntity=>e.kind==='building'&&e.hp>0&&e.progress>=1&&
      e.forumId!==undefined&&forums.get(e.forumId)===e.team&&e.settlementAt===undefined&&observed(e));
    const key=`${quality===0?0:1}|`+buildings.map(b=>`${b.id}:${b.forumId}:${b.type}:${b.x}:${b.z}:${b.size}:${b.team}:${b.visualRotation||0}`).join('|');
    if(key!==this.layout||dt<0||dt>1) {
      const previous=new Map(this.actors.map(a=>[a.id,a]));
      this.layout=key;this.groups.clear();this.routes.clear();this.actors=[];this.cursor=0;
      for(const b of buildings) {
        const portal=this.portal(world,b);
        if(!portal) continue;
        const group=this.groups.get(b.forumId!)||[];group.push(portal);this.groups.set(b.forumId!,group);
      }
      // Round-robin allocation prevents the first Forum consuming the entire budget.
      const eligible=[...this.groups].filter(([,g])=>g.length>=2),
        portalKeys=new Set(buildings.map(b=>this.portalKey(b)));
      const groundLimit=quality===0?12:24,airLimit=quality===0?3:6;
      for(const air of [false,true]) {
        let count=0;
        for(let slot=0;slot<(air?2:8);slot++) for(const [forumId,group] of eligible) {
          if(count>=(air?airLimit:groundLimit)||slot>=(air?Math.min(2,Math.ceil(group.length/12)):Math.min(8,group.length))) continue;
          const id=-(forumId*32+slot+(air?16:0)+1),random=seeded(state.seed^Math.imul(forumId,0x45d9f3b)^Math.imul(-id,0x119de1f3)),
            old=previous.get(id);
          if(old&&dt>=0&&dt<=1) {
            if(old.route&&!old.tripKey.split('|').every(k=>portalKeys.has(k))) {
              old.route=null;old.alpha=0;old.nextTrip=now+1+old.random()*6;
            }
            this.actors.push(old);
          } else this.actors.push({id,forumId,air,random,nextTrip:now+.5+random()*6,route:null,segment:0,
            x:0,y:0,z:0,rot:0,walk:0,alpha:0,tripKey:'',destinationId:0});count++;
        }
      }
      this.nextSearch=Math.max(this.nextSearch,now+.5);
    }
    if(this.navigation!==world.pathVersion) {
      this.navigation=world.pathVersion;this.routes.clear();
      // Preserve unaffected trips during normal settlement growth. Recheck only on navigation changes.
      for(const actor of this.actors) if(actor.route&&!actor.air) {
        let valid=true;
        for(let i=4;i<actor.route.length-5;i++)
          if(!world.lineFree(actor.route[i],actor.route[i+1],.2)) {valid=false;break;}
        if(!valid) {actor.route=null;actor.alpha=0;actor.nextTrip=now+1+actor.random()*6;}
      }
    }
    if(dt<=0||dt>1) return;
    for(const actor of this.actors) if(actor.route) this.advance(actor,world,dt,now);
    // At most one trip preparation per half-second, globally; only ground trips can run A*.
    if(now<this.nextSearch||!this.actors.length) return;
    for(let i=0;i<this.actors.length;i++) {
      const actor=this.actors[this.cursor++%this.actors.length];
      if(actor.route||actor.nextTrip>now) continue;
      this.nextSearch=now+.5;actor.nextTrip=now+8+actor.random()*8;
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
      inside=point(entry.doorZ*scale-.28,base+.35*scale),
      door=point(entry.doorZ*scale+.26,inside.y),
      stairs=point(entry.z*scale,inside.y),
      landing=point(entry.z*scale+entry.length,0),
      service=point(Math.max(entry.z*scale+entry.length+.6,b.size+world.cellSize*1.5),0);
    landing.y=world.surface.heightAt(landing.x,landing.z);service.y=world.surface.heightAt(service.x,service.z);
    const groundAccess=!world.blockedAt(service.x,service.z)&&world.surface.fits(service.x,service.z,.2)&&
      world.terrainFree(landing,service,.2)&&this.approachFree(world,b,landing,service);
    return {building:b,inside,door,stairs,landing,service,groundAccess};
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
  private depart(actor: SettlementTrafficActor,world: Battlefield) {
    const group=this.groups.get(actor.forumId)!;
    const candidates=actor.air?group:group.filter(p=>p.groundAccess);
    if(candidates.length<2) return;
    const home=candidates.findIndex(p=>p.building.id===actor.homeId),
      index=home<0?Math.floor(actor.random()*candidates.length):home,from=candidates[index],
      to=candidates[(index+1+Math.floor(actor.random()*(candidates.length-1)))%candidates.length];
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
      const key=`${from.building.id}:${to.building.id}`;
      let route=this.routes.get(key);
      if(route===undefined) {
        const result=world.path(from.service.x,from.service.z,to.service.x,to.service.z,false,undefined,.2,false,600);
        route=result.status==='complete'?result.points.map(p=>({...p})):null;
        if(this.routes.size>=64) this.routes.delete(this.routes.keys().next().value!);
        this.routes.set(key,route);
      }
      if(!route) return;
      middle=route.map(p=>({...p,y:world.surface?.heightAt(p.x,p.z)||0}));
    }
    actor.route=[from.inside,from.door,from.stairs,from.landing,from.service,...middle,to.service,to.landing,to.stairs,to.door,to.inside]
      .filter((p,i,all)=>!i||Math.hypot(p.x-all[i-1].x,p.y-all[i-1].y,p.z-all[i-1].z)>.01)
      .map(p=>({...p}));
    actor.destinationId=to.building.id;
    actor.tripKey=`${this.portalKey(from.building)}|${this.portalKey(to.building)}`;
    Object.assign(actor,actor.route[0]);actor.segment=0;actor.alpha=0;actor.walk=0;
  }
  private advance(actor: SettlementTrafficActor,world: Battlefield,dt:number,now:number) {
    const route=actor.route!;
    let remaining=dt*(actor.air?7:1.8);
    while(remaining>0&&actor.segment<route.length-1) {
      const goal=route[actor.segment+1],dx=goal.x-actor.x,dy=goal.y-actor.y,dz=goal.z-actor.z,
        length=Math.hypot(dx,dy,dz),step=Math.min(remaining,length),t=length?step/length:1;
      if(Math.hypot(dx,dz)>.001) actor.rot=Math.atan2(dx,dz);
      actor.x+=dx*t;actor.y+=dy*t;actor.z+=dz*t;actor.walk+=step;remaining-=step;
      if(length<=step+.0001) actor.segment++;
    }
    if(actor.segment>=route.length-1) {actor.homeId=actor.destinationId;actor.route=null;actor.alpha=0;actor.nextTrip=now+3+actor.random()*7;return;}
    // Door crossings fade only inside the wall, never while waiting in front of it.
    const edge=actor.segment===0?distance(actor,route[0])/.3:
      actor.segment===route.length-2?distance(actor,route[route.length-1])/.3:1;
    actor.alpha=Math.min(1,edge);
    // The navigation path sits on the real triangles; staircase/deck links retain their authored heights.
    if(!actor.air&&actor.segment>=4&&actor.segment<route.length-5)
      actor.y=world.surface?.heightAt(actor.x,actor.z)||0;
  }
  walkers(): readonly SettlementTrafficActor[] {
    return this.actors.filter(a=>!a.air&&a.route&&a.alpha>0&&this.world!.visible[this.world!.idx(a.x,a.z)]);
  }
  draw(R: MeridianRenderer) {
    if(!this.world) return;
    for(const actor of this.actors) {
      if(!actor.route||actor.alpha<=0||!this.world.visible[this.world.idx(actor.x,actor.z)]) continue;
      const projected=R.project(actor.x,actor.y,actor.z),v=R.viewport;
      if(projected&&(projected.x<v.left-30||projected.x>v.right+30||projected.y<v.top-60||projected.y>v.bottom+30)) continue;
      const cs=Math.cos(actor.rot),sn=Math.sin(actor.rot),
        part:ModelPart=(shape,x,y,z,sx,sy,sz,color,ry=0,rx=0,rz=0,glow=0)=>
          R.add(shape,actor.x+x*cs+z*sn,actor.y+y,actor.z-x*sn+z*cs,sx,sy,sz,color,
            actor.rot+ry,rx,rz,glow,actor.alpha,'dynamic',MAT.METAL);
      const color=[0x9aafa4,0xb9a58b,0x819bac][-actor.id%3];
      SettlementTrafficModels[actor.air?'drone':'civilian']({part,walk:actor.walk,color});
    }
  }
}
