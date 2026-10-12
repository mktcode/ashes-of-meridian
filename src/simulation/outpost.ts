/* Cleared-world siege and irreversible evacuation. All clocks use simulation time. */
'use strict';
const OUTPOST_RULES = Object.freeze({ interval:180, warning:30, evacuation:60, upgrades:3, maxWaveUnits:80, maxAttackers:160 });
function createOutpostState(time: number): OutpostState {
  return {wave:0,nextWave:time+OUTPOST_RULES.interval,warned:false,entrance:null,
    remaining:0,spawned:0,nextSpawn:time,finished:false,evacuation:null};
}
function evacuatedUnit(e: UnitEntity): EvacuatedUnit {
  return {type:e.type,hp:clamp(e.hp/e.maxHp,0,1),shield:e.maxShield?clamp(e.shield/e.maxShield,0,1):0,kills:e.kills};
}
const outpostMethods = {
  evacuationReason(this: MeridianGame, id: number, team: PlayerTeam = 0): string {
    const s=this.s,b=this.get(id);
    if(team!==0 || !s || s.rules.kind!=='single-player' || !s.rules.completed || !s.outpost || s.outpost.finished)
      return 'Evacuation is only available in an active cleared outpost.';
    if(s.outpost.evacuation)return 'Evacuation is already underway and cannot be cancelled.';
    return b?.kind==='building' && b.type==='hq' && b.team===team && b.progress>=1 ? '' : 'Select a completed Command Center.';
  },
  startEvacuation(this: MeridianGame, id: number, team: PlayerTeam = 0): boolean {
    if(this.evacuationReason(id,team))return false;
    this.s!.outpost!.evacuation={hq:id,until:this.s!.time+OUTPOST_RULES.evacuation,units:[],upgrades:[]};
    this.notify(team,'alert',{text:'Evacuation started — 60 seconds. Send units to this Command Center and secure up to three building upgrades.',danger:true});
    return true;
  },
  evacuationUpgradeReason(this: MeridianGame, id: number, team: PlayerTeam = 0): string {
    const s=this.s,evac=s?.outpost?.evacuation,b=this.get(id);
    if(team!==0 || !s || s.rules.kind!=='single-player' || !s.rules.completed || !evac || s.outpost!.finished || s.time>=evac.until)
      return 'Start evacuation at your Command Center first.';
    if(evac.upgrades.some(u=>u.id===id))return '';
    if(b?.kind!=='building' || b.team!==team || b.progress<1 || !b.upgrade || !b.upgradeLevel ||
      !civilizationUpgradeOffered(b,b.upgrade) || b.settlementAt!==undefined ||
      !s.entities.some(f=>f.id===b.forumId && f.hp>0 && f.type==='meridianforum' && f.team===team && f.progress>=1))
      return 'Select an active civilian upgrade building.';
    return evac.upgrades.length>=OUTPOST_RULES.upgrades ? 'Three upgrades secured. Release one selection to replace it.' : '';
  },
  evacuateUpgrade(this: MeridianGame, id: number, team: PlayerTeam = 0): boolean {
    if(this.evacuationUpgradeReason(id,team))return false;
    const evac=this.s!.outpost!.evacuation!,index=evac.upgrades.findIndex(u=>u.id===id);
    if(index>=0)evac.upgrades.splice(index,1);
    else {
      const b=this.get(id) as BuildingEntity;
      evac.upgrades.push({id,upgrade:b.upgrade!,level:b.upgradeLevel!});
    }
    return true;
  },
  orderEvacuation(this: MeridianGame, units: UnitEntity[], hq: Entity | null, team: PlayerTeam): boolean {
    const evac=this.s?.outpost?.evacuation;
    if(team!==0 || !evac || this.s!.outpost!.finished || hq?.id!==evac.hq || hq.kind!=='building' || hq.hp<=0)return false;
    for(const e of units) {
      this.setOrder(e,{type:'move',x:hq.x,z:hq.z});
      e.evacuationHQ=hq.id;
    }
    return units.length>0;
  },
  outpostEntrance(this: MeridianGame): Position | null {
    const s=this.s!,world=this.world!,home=this.alive(e=>e.team===0 && e.type==='hq')[0] ||
      this.alive(e=>e.team===0 && e.type==='worker')[0];
    if(!home)return null;
    // Separate seed source: warnings and entrance selection never consume combat RNG.
    const random=seeded(s.seed ^ Math.imul(s.outpost!.wave+1,0x53e7a1)),side=Math.floor(random()*4),limit=world.extent-10;
    let best: Position | null=null,score=-Infinity;
    for(let i=0;i<world.deploymentReachable.length;i++) {
      if(!world.deploymentReachable[i])continue;
      const p=world.point(i);
      if(Math.abs(p.x)>limit || Math.abs(p.z)>limit || distance(p,home)<35 || world.blockedAt(p.x,p.z))continue;
      const edge=[p.x,p.z,-p.x,-p.z][side],value=edge+distance(p,home)*.15;
      if(value>score && world.surface!.fits(p.x,p.z,UNITS.tank.size*UNIT_BODY_SCALE)) {best=p;score=value;}
    }
    return best;
  },
  updateOutpost(this: MeridianGame) {
    const s=this.s!,out=s.outpost;
    if(!out || out.finished)return;
    const evac=out.evacuation,hq=evac?this.get(evac.hq):null;
    // Check before boarding: arrivals at or after the deadline are too late.
    if(evac ? s.time>=evac.until || !hq : !this.has('hq',0) &&
      (!this.party(0).deploymentPending || !this.alive(e=>e.team===0 && e.type==='worker').length)) {out.finished=true;return;}
    if(evac && hq) {
      const boarded=new Set<number>();
      for(const e of s.entities) {
        if(e.hp<=0 || e.kind!=='unit' || e.team!==0 || e.exit || e.evacuationHQ!==hq.id)continue;
        if(distance(e,hq)>hq.size+3.1 || (!isFlyingUnitType(e.type) &&
          (this.world!.blockedAt(e.x,e.z) || !this.world!.terrainFree(e,hq))))continue;
        evac.units.push(evacuatedUnit(e));
        // Boarding is not a death: no kills, explosions, refunds or resource deliveries.
        e.hp=0;e.target=null;this.updateUnitCollision(e);boarded.add(e.id);this.ids.delete(e.id);
      }
      if(boarded.size){s.entities=s.entities.filter(e=>!boarded.has(e.id));this.rehash();}
    }
    if(!out.warned && s.time>=out.nextWave-OUTPOST_RULES.warning) {
      out.entrance=this.outpostEntrance();out.warned=true;
      this.emit('alert',{text:`Wave ${out.wave+1} approaching in ${OUTPOST_RULES.warning}s.`,danger:true,outpostWave:true,...(out.entrance || {})});
    }
    if(s.time>=out.nextWave) {
      out.wave++;out.remaining=Math.min(OUTPOST_RULES.maxWaveUnits,4+out.wave*3+s.depth);
      out.spawned=0;out.nextSpawn=s.time;out.entrance ??=this.outpostEntrance();
      out.nextWave=s.time+OUTPOST_RULES.interval;out.warned=false;
      this.emit('alert',{text:`Wave ${out.wave} — defend the outpost!`,danger:true,outpostWave:true,...(out.entrance || {})});
    }
    if(!out.remaining || !out.entrance || s.time<out.nextSpawn)return;
    out.nextSpawn=s.time+1;
    const enemies=this.alive(e=>e.kind==='unit' && e.team!==0),room=OUTPOST_RULES.maxAttackers-enemies.length;
    for(let i=0;i<Math.min(8,room) && out.remaining;i++) {
      const types: UnitType[]=out.wave>=6?['rifle','tank','artillery','air','destroyer']:out.wave>=3?['rifle','tank','artillery']:['rifle','rifle','tank'],
        type=types[(out.spawned+out.wave)%types.length],team=(1+(out.wave-1)%(s.parties.length-1)) as PlayerTeam,
        unit=this.spawnUnit(type,out.entrance.x,out.entrance.z,team,this.factionFor(team));
      if(!unit)break;
      const power=Math.pow(1.16,Math.min(120,out.wave-1));
      unit.wavePower=power;unit.maxHp*=power;unit.hp=unit.maxHp;unit.maxShield*=power;unit.shield=unit.maxShield;
      const targets=this.alive(e=>e.team===0 && e.kind==='building' && e.progress>=1 && (e.type==='hq' || !!e.upgrade)),
        target=targets[out.spawned%Math.max(1,targets.length)] || this.alive(e=>e.team===0)[0];
      if(target)this.setOrder(unit,{type:'attackMove',x:target.x,z:target.z});
      out.remaining--;out.spawned++;
    }
  },
  moveToEvacuation(this: MeridianGame, e: UnitEntity, dt: number): boolean {
    const evac=this.s!.outpost?.evacuation,hq=this.get(e.evacuationHQ);
    if(!evac || !hq || hq.kind!=='building' || hq.id!==evac.hq) {delete e.evacuationHQ;return false;}
    this.move(e,hq,dt,0,false,{x:hq.x,z:hq.z,radius:hq.size+3});
    return true;
  },
  deliverEvacuatedArmy(this: MeridianGame) {
    const s=this.s!,pending=s.reinforcements;
    if(!pending?.units.length || s.rules.kind!=='single-player' || s.rules.completed || s.time<pending.nextAttempt)return;
    pending.nextAttempt=s.time+2;
    const home=this.alive(e=>e.team===0 && (e.type==='hq' && e.progress>=1 || e.type==='worker'))[0];
    if(!home)return;
    // Bounded retry and actual free body positions; blocked arrivals remain in the save.
    for(let i=0;i<8 && pending.units.length;i++) {
      const saved=pending.units[0],unit=this.spawnUpgradeReinforcement(saved.type,home,0);
      if(!unit)break;
      unit.hp=unit.maxHp*saved.hp;unit.shield=unit.maxShield*saved.shield;unit.kills=saved.kills;
      pending.units.shift();
    }
  }
};
type OutpostMethods = typeof outpostMethods;
interface MeridianGame extends OutpostMethods {}
defineMeridianGameMethods(outpostMethods);
