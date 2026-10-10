/* One battle group, driven only by the controller's delayed observations. */
'use strict';
interface AITarget {
  contact: AIContact;
  defense: number;
  finish: boolean;
  score: number;
}
const aiStrategyMethods = {
  aiAreaVisible(this: MeridianGame, team: PlayerTeam, p: Position, radius: number) {
    const world=this.world!, cell=world.cellSize;
    for (let z=p.z-radius;z<=p.z+radius;z+=cell)
      for (let x=p.x-radius;x<=p.x+radius;x+=cell)
        if (distance(p,{x,z})<=radius && !this.canSee(team,{x,z})) return false;
    return true;
  },
  aiCanDamage(this: MeridianGame, unit: Pick<Entity,'kind'|'type'>, target: AIContact) {
    if (unit.kind==='resource') return false;
    if (unit.kind==='building') {
      const d: BuildingDefinitionShape=BUILDINGS[unit.type as BuildingType];
      return !!d.damage;
    }
    const d: UnitDefinitionShape=UNITS[unit.type as UnitType];
    return !!d.damage && !(d.groundOnly && target.kind==='unit' && !!(UNITS[target.type as UnitType] as UnitDefinitionShape)?.flying);
  },
  aiTargets(this: MeridianGame, team: PlayerTeam, visible: AIContact[], origin: Position): AITarget[] {
    const ai=this.aiFor(team)!, rules=aiRulesFor(this.factionFor(team),this.s!.depth),
      known=Object.values(ai.contacts).filter(e=>this.enemy({team},e) && e.kind!=='resource'),
      weights: Partial<Record<EntityType,number>>=rules.targets;
    return known.map(contact=>{
      // Every hostile faction counts as a local hazard, not just the target's owner.
      const defense=known.filter(e=>distance(e,contact)<AI_TUNING.targetRadius)
        .reduce((n,e)=>n+this.aiPower(e),0),
        finish=contact.type==='hq' && defense===0 &&
          visible.some(e=>e.id===contact.id && e.areaVisible),
        failed=ai.failedGoal && this.s!.time<ai.failedGoal.until && distance(contact,ai.failedGoal)<AI_TUNING.targetRadius,
        score=(weights[contact.type] ?? (contact.type==='depot'?65:contact.type==='hq'?85:25)) +
          (finish?AI_TUNING.finishBonus:0) - (failed?100:0) - defense*.5 - distance(contact,origin)*.2;
      return {contact,defense,finish,score};
    }).sort((a,b)=>b.score-a.score || a.contact.id-b.contact.id);
  },
  aiScoutGoal(this: MeridianGame, team: PlayerTeam, home: Position): Position {
    const world = this.world!, ai=this.aiFor(team), sites: Position[] = [],
      unexplored=(p: Position)=>!world.sight[team].explored[world.idx(p.x,p.z)],
      starts=world.startSites.filter(p=>distance(p,home)>25 && unexplored(p))
        .sort((a,b)=>distance(a,home)-distance(b,home));
    // Probe plausible landing regions before slowly sweeping the local fog boundary.
    if (starts.length) return starts[(ai?.scoutSite || 0)%starts.length];
    for (let z = 4; z < world.gridSize - 4; z += 4) for (let x = 4; x < world.gridSize - 4; x += 4) {
      const i = z * world.gridSize + x;
      if (world.deploymentReachable[i] && !world.sight[team].explored[i]) sites.push(world.point(i));
    }
    sites.sort((a, b) => distance(a, home) - distance(b, home));
    return sites.length ? sites[(ai?.scoutSite || 0)%sites.length] :
      world.startSites[(ai?.scoutSite || 0)%world.startSites.length] || home;
  },
  aiHold(this: MeridianGame, team: PlayerTeam, units: UnitEntity[], own: Entity[], home: BuildingEntity, attack = true) {
    const world=this.world!, known=[...own,...Object.values(this.aiFor(team)!.contacts)],
      buildings=known.filter(e=>e.kind==='building'),
      producers=buildings.filter(b=>(Object.values(UNITS) as UnitDefinitionShape[]).some(d=>d.from===b.type)),
      resources=known.filter(e=>e.kind==='resource' && distance(e,home)<45),
      reserved: {p:Position,r:number}[]=[];
    let navigation:Uint8Array | undefined, searches=0;
    const reachable=(unit:UnitEntity,p:Position)=>{
      if ((UNITS[unit.type] as UnitDefinitionShape).flying) return true;
      if (searches>=12) return false;
      searches++;
      // The live blocked grid can contain hidden foundations. Build a planning view
      // from public terrain and delayed knowledge only; actions still use live navigation.
      if (!navigation) {
        navigation=world.staticGrid.slice();
        for (const b of buildings) world.mark(navigation,b.x,b.z,b.size+.35);
      }
      const blocked=world.blocked;
      try {
        world.blocked=navigation;
        return world.path(unit.x,unit.z,p.x,p.z,false,undefined,unit.size*UNIT_BODY_SCALE,false,1024).status==='complete';
      } finally { world.blocked=blocked; }
    };
    const laneDistance=(p:Position,a:Position,b:Position)=>{
      const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz || 1),0,1);
      return distance(p,{x:a.x+t*dx,z:a.z+t*dz});
    };
    for (const unit of units) {
      const r=unit.size*UNIT_BODY_SCALE, flying=!!(UNITS[unit.type] as UnitDefinitionShape).flying,
        valid=(p:Position)=>distance(p,home)>=20 && distance(p,home)<=44 &&
          Math.abs(p.x)<world.extent-5-r && Math.abs(p.z)<world.extent-5-r &&
          (flying || (!!world.deploymentReachable[world.idx(p.x,p.z)] &&
            !world.staticGrid[world.idx(p.x,p.z)] && !!world.surface?.fits(p.x,p.z,r) && world.terrainFree(home,p,r))) &&
          buildings.every(b=>distance(p,b)>b.size+r+3) &&
          producers.every(b=>laneDistance(p,b,{x:b.x+Math.sin(BUILDING_YAW+(b.team===1?Math.PI:0))*(b.size+12),
            z:b.z+Math.cos(BUILDING_YAW+(b.team===1?Math.PI:0))*(b.size+12)})>=r+3) &&
          resources.every(c=>distance(p,c)>c.size+r+3 && laneDistance(p,home,c)>r+4) &&
          own.every(e=>e.type!=='worker' || distance(p,e)>r+e.size*UNIT_BODY_SCALE+2) &&
          reserved.every(slot=>distance(p,slot.p)>r+slot.r+3);
      const moving=unit.order.type==='move' || unit.order.type==='attackMove',
        old=moving?unit.order as Position:unit,
        stalled=unit.pathStatus==='unreachable' || (unit.recoveryAttempts || 0)>=4;
      let goal:Position | undefined;
      // Preserve safe holding positions and paths. Re-plan only proven stalls or a changed layout.
      if (!stalled && valid(old)) goal={x:old.x,z:old.z};
      let attempts=0;
      if (!goal) for (let i=0;i<96;i++) {
        if (!flying && (attempts>=3 || searches>=12)) break;
        const index=(i+unit.id*7)%96, angle=(index%32)*Math.PI/16,
          radius=24+Math.floor(index/32)*8,
          p={x:home.x+Math.sin(angle)*radius,z:home.z+Math.cos(angle)*radius};
        if ((stalled && distance(p,old)<8) || !valid(p)) continue;
        attempts++;
        if (!reachable(unit,p)) continue;
        goal=p;break;
      }
      if (!goal) {
        // Retreat must cancel an assault even when local planning runs out of budget.
        // Ordinary waiting troops keep their order instead of piling onto the HQ.
        if (!attack) this.aiOrder(team,[unit],home,false);
        continue;
      }
      reserved.push({p:goal,r});
      if (!moving && distance(unit,goal)<2) continue;
      this.aiOrder(team,[unit],goal,attack,.1);
    }
  },
  aiRetreat(this: MeridianGame, team: PlayerTeam, squad: UnitEntity[], home: BuildingEntity, own: Entity[]) {
    const ai=this.aiFor(team)!;
    if (ai.goal) ai.failedGoal={...ai.goal,until:this.s!.time+AI_TUNING.failedGoalSeconds};
    this.aiSetMode(team,'recover');
    ai.recoverUntil=this.s!.time+aiRulesFor(this.factionFor(team),this.s!.depth).recoveryTime;
    ai.attackProgress=undefined;
    this.aiHold(team,squad,own,home,false);
  },
  aiAttackGoal(this: MeridianGame, team: PlayerTeam, squad: UnitEntity[], target: AITarget) {
    const ai=this.aiFor(team)!, e=target.contact, now=this.s!.time;
    if (ai.mode!=='attack') { ai.launched=squad.length; ai.attackProgress=undefined; }
    this.aiSetMode(team,'attack');
    const nearest=Math.min(...squad.filter(u=>this.aiCanDamage(u,e)).map(u=>distance(u,e)));
    if (ai.attackProgress?.targetId!==e.id)
      ai.attackProgress={targetId:e.id,distance:nearest,hp:e.hp,at:now,startedAt:now};
    else {
      const progress=ai.attackProgress;
      // Meaningful approach or observed damage keeps a productive assault alive.
      if (nearest<progress.distance-2 || e.hp<progress.hp) {
        progress.at=now; progress.distance=nearest;
      }
      progress.hp=e.hp;
      // Fighting the defenders around an objective is progress too, not only hitting the HQ.
      progress.at=Math.max(progress.at,ai.combatProgressAt ?? 0);
    }
    ai.goal={x:e.x,z:e.z}; ai.squad=squad.map(u=>u.id);
    this.aiOrder(team,squad,ai.goal);
  },
  aiStrategy(this: MeridianGame, team: PlayerTeam, own: Entity[], visible: AIContact[], home: BuildingEntity) {
    const s=this.s!, ai=this.aiFor(team)!, rules=aiRulesFor(this.factionFor(team),s.depth),
      foes=visible.filter(e=>this.enemy({team},e)),
      army=own.filter(e=>e.kind==='unit'&&e.type!=='worker'&&!e.exit) as UnitEntity[],
      danger=foes.filter(e=>e.kind==='unit'&&distance(e,home)<30),
      power=(units: (Entity | AIContact)[])=>units.reduce((n,e)=>n+this.aiPower(e),0);
    let squad=army.filter(e=>ai.squad.includes(e.id));
    const guards=army.filter(e=>!ai.squad.includes(e.id) && distance(e,home)<45),
      baseDefense=own.filter(e=>e.kind==='building' && distance(e,home)<30);
    // A small raid should not recall the entire army when local reserves can handle it.
    const localDefense=[...guards,...baseDefense],
      holding=ai.mode==='attack' && home.hp>home.maxHp*.35 &&
        power(localDefense)>=power(danger)*rules.forceRatio &&
        danger.every(e=>localDefense.some(u=>this.aiCanDamage(u,e)));
    if (danger.length) {
      this.aiOrder(team,holding?guards:army,danger[0]);
      if (!holding) {
        this.aiSetMode(team,'defend'); ai.squad=[]; ai.attackProgress=undefined; return;
      }
    }
    if (ai.mode==='recover') {
      const restored=squad.every(e=>distance(e,home)<44 &&
        (this.factionFor(team)===FACTION_ID.THIRD ? e.shield>=e.maxShield*.75 : e.hp>=e.maxHp*.85));
      if (squad.length && s.time<(ai.recoverUntil || 0) && (!restored || s.time-ai.restStartedAt<6)) {
        this.aiHold(team,army,own,home,false);return;
      }
      this.aiSetMode(team,'assemble');ai.squad=[];squad=[];
    }
    const targets=this.aiTargets(team,visible,ai.mode==='attack' && ai.goal ? ai.goal : home);
    if (ai.mode==='attack' && ai.goal && squad.length) {
      const opposition=power(foes.filter(e=>squad.some(u=>distance(u,e)<AI_TUNING.targetRadius))),
        hull=squad.reduce((n,e)=>n+e.hp,0)/squad.reduce((n,e)=>n+e.maxHp,0),
        shields=squad.reduce((n,e)=>n+e.shield,0)/Math.max(1,squad.reduce((n,e)=>n+e.maxShield,0)),
        exhausted=opposition>0 && s.time-ai.attackStartedAt>6 &&
          (this.factionFor(team)===FACTION_ID.SECOND ? hull<.6 :
            this.factionFor(team)===FACTION_ID.THIRD && shields<.2),
        threatened=opposition>0 && (exhausted || squad.length<ai.launched*AI_TUNING.retreatLossRatio ||
          power(squad)<opposition*AI_TUNING.retreatPowerRatio);
      if (threatened) { this.aiRetreat(team,squad,home,own);return; }
      const reinforcements=army.filter(e=>!ai.squad.includes(e.id) && !(danger.length && holding && guards.includes(e))).slice(rules.reserve)
        .filter(e=>e.hp>=e.maxHp*.6);
      if (reinforcements.length) {
        squad=[...squad,...reinforcements];
        ai.launched+=reinforcements.length;ai.squad=squad.map(e=>e.id);
      }
      if (!danger.length) this.aiHold(team,army.filter(e=>!ai.squad.includes(e.id)),own,home);
      const current=targets.find(t=>t.contact.id===ai.attackProgress?.targetId);
      if (current && squad.some(u=>this.aiCanDamage(u,current.contact))) {
        // Update progress before testing patience; the total sortie age never forces retreat.
        this.aiAttackGoal(team,squad,current);
        if (s.time-ai.attackProgress!.at>=AI_TUNING.stalledSeconds) {
          this.aiRetreat(team,squad,home,own);return;
        }
        const alternative=targets.find(t=>t.score>current.score+AI_TUNING.targetSwitchMargin &&
          power(squad)>Math.max(42,t.defense*rules.forceRatio) && squad.some(u=>this.aiCanDamage(u,t.contact)));
        if (alternative && s.time-ai.attackProgress!.startedAt>=AI_TUNING.targetCommitSeconds)
          this.aiAttackGoal(team,squad,alternative);
        return;
      }
      // Destroyed/invalidated objectives can be replaced immediately, without a failure penalty.
    }
    const fitScouts=army.filter(e=>UNITS[e.type].damage && e.hp>=e.maxHp*.4);
    if (army.length>=3 && !fitScouts.some(e=>e.id===ai.scout))
      ai.scout=(fitScouts.find(e=>e.type==='rifle') || fitScouts[0])?.id;
    const scout=army.find(e=>e.id===ai.scout),
      pool=army.filter(e=>e.id!==ai.scout && !(danger.length && holding && guards.includes(e))),
      regular=ai.mode==='attack'?squad:pool.slice(rules.reserve),
      elapsed=s.time-(ai.mode==='attack'?ai.attackStartedAt:ai.restStartedAt);
    for (const target of targets) {
      // A confirmed undefended HQ needs a damaging unit, not a whole fresh attack wave.
      const attackers=target.finish ? (danger.length?regular:army) : regular,
        localContinuation=ai.mode==='attack' && target.defense===0 &&
          visible.some(e=>e.id===target.contact.id) && squad.some(u=>distance(u,target.contact)<AI_TUNING.targetRadius);
      if (!attackers.some(u=>this.aiCanDamage(u,target.contact))) continue;
      const raid=['worker','refinery','barracks','factory','hangar'].includes(target.contact.type) &&
        visible.some(e=>e.id===target.contact.id) &&
        attackers.filter(e=>this.aiCanDamage(e,target.contact)).length>=2 &&
        power(attackers)>Math.max(18,target.defense*rules.forceRatio) && elapsed>=AI_TUNING.finishWaitSeconds,
        ready=target.finish ? elapsed>=AI_TUNING.finishWaitSeconds : raid ||
          attackers.length>=rules.attackers && power(attackers)>Math.max(42,target.defense*(elapsed>180?.8:rules.forceRatio)) &&
          elapsed>=rules.attackWait;
      if (ai.mode==='attack' ? (target.finish || localContinuation || power(attackers)>Math.max(42,target.defense*rules.forceRatio)) : ready) {
        this.aiAttackGoal(team,attackers,target);return;
      }
    }
    // Armed reconnaissance can engage exposed workers instead of walking past them.
    // Leave the doctrine's reserves at home and never steal guards during a base raid.
    const searchParty=scout && !danger.length && scout.hp>=scout.maxHp*.4 ? [scout,...pool.slice(rules.reserve)
      .filter(e=>fitScouts.includes(e)).sort((a,b)=>distance(a,scout)-distance(b,scout)||a.id-b.id)
      .slice(0,AI_TUNING.searchPartySize-1)] : [];
    if (scout && !danger.length && s.time-ai.lastScout>rules.scoutInterval) {
      if (ai.scoutGoal && (distance(scout,ai.scoutGoal)<10 || scout.pathStatus==='unreachable')) {
        ai.scoutSite=(ai.scoutSite || 0)+1;ai.scoutGoal=undefined;
      }
      // Keep a distant destination through periodic orders; do not redirect each interval.
      ai.scoutGoal ||= this.aiScoutGoal(team,home);
      ai.lastScout=s.time;
    }
    if (scout && !danger.length && ai.scoutGoal)
      this.aiOrder(team,searchParty.length?searchParty:[scout],searchParty.length?ai.scoutGoal:home,!!searchParty.length);
    this.aiSetMode(team,army.length?'assemble':'bootstrap');ai.squad=[];ai.attackProgress=undefined;
    this.aiHold(team,pool.filter(e=>!searchParty.includes(e)),own,home);
  }
};
type AIStrategyMethods = typeof aiStrategyMethods;
interface MeridianGame extends AIStrategyMethods {}
defineMeridianGameMethods(aiStrategyMethods);
