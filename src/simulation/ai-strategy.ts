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
    const world=this.world!, unexplored=(p:Position)=>!world.sight[team].explored[world.idx(p.x,p.z)],
      corners=world.startSites.filter(p=>distance(p,home)>25)
        .sort((a,b)=>distance(a,home)-distance(b,home)),
      sites=[...corners,...world.layout.resourceSites];
    // Once explored, revisit candidates instead of camping forever at the first corner.
    return sites.find(unexplored) || sites[(this.aiFor(team)?.scoutSite || 0)%sites.length] || home;
  },
  aiRetreat(this: MeridianGame, team: PlayerTeam, squad: UnitEntity[], home: BuildingEntity) {
    const ai=this.aiFor(team)!;
    if (ai.goal) ai.failedGoal={...ai.goal,until:this.s!.time+AI_TUNING.failedGoalSeconds};
    this.aiSetMode(team,'recover');
    ai.recoverUntil=this.s!.time+aiRulesFor(this.factionFor(team),this.s!.depth).recoveryTime;
    ai.attackProgress=undefined;
    this.aiOrder(team,squad,home,false);
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
  aiSalvageStrategy(this: MeridianGame, team: PlayerTeam, own: Entity[], visible: AIContact[], home?: BuildingEntity) {
    const rules = this.s!.rules;
    if (rules.kind !== 'single-player' || rules.mission.id !== 'echo-salvage') return;
    const zone = rules.mission.site, ai = this.aiFor(team)!, world = this.world!,
      workers = own.filter(e=>e.kind==='unit' && e.type==='worker' && !e.exit) as UnitEntity[],
      available = workers.filter(e=>['idle','mine','salvage'].includes(this.get(e.id)?.order.type || '')),
      salvagers = available.sort((a,b)=>(a.order.type==='salvage'?-1:0)-(b.order.type==='salvage'?-1:0)||a.id-b.id)
        .slice(0,home ? Math.min(4,Math.max(0,Math.floor((workers.length-2)/2))) : 0),
      army = own.filter(e => e.kind === 'unit' && !e.exit && e.type !== 'worker') as UnitEntity[];
    for(const worker of salvagers) if(worker.order.type!=='salvage')
      this.executeAction(team,{kind:'order',ids:[worker.id],order:{type:'salvage',x:zone.x,z:zone.z}},false);
    // A small escort follows the most exposed observed carrier; the rest secures extraction.
    const carrier=salvagers.filter(e=>(e.salvageCarry || 0)>0).sort((a,b)=>distance(b,zone)-distance(a,zone))[0],
      escort=carrier ? army.slice(0,2) : [];
    for(const unit of escort) if(unit.order.type!=='follow' || unit.order.id!==carrier!.id)
      this.executeAction(team,{kind:'order',ids:[unit.id],order:{type:'follow',id:carrier!.id}},false);
    const
      danger = home && visible.find(e => this.enemy({team}, e) && e.kind === 'unit' && distance(e, home) < 30),
      guards = danger ? army.filter(e => !escort.includes(e) && distance(e, home!) < 35).slice(0, 2) : [];
    // Local reserves may defend, but do not recall the occupying force to hunt HQs.
    if (danger) this.aiOrder(team, guards, danger);
    const occupying = army.filter(e => !guards.includes(e) && !escort.includes(e)), reserved: (Position & { size: number; flying: boolean })[] = [];
    this.aiSetMode(team, occupying.length ? 'attack' : 'bootstrap');
    ai.squad = occupying.map(e => e.id); ai.goal = { x: zone.x, z: zone.z }; ai.attackProgress = undefined;
    for (const unit of occupying) {
      const flying = !!(UNITS[unit.type] as UnitDefinitionShape).flying;
      if (distance(unit, zone) <= zone.radius + 4) {
        if (unit.order.type !== 'hold') this.executeAction(team, {kind:'order', ids:[unit.id], order:{type:'hold'}}, false);
        reserved.push({...unit, flying});
        continue;
      }
      // Public terrain only, never live hidden occupants. Individual move orders avoid
      // formation offsets and ranged units stopping to shoot outside the extraction perimeter.
      const candidates = Array.from({length:32}, (_, i) => {
        const angle = i * Math.PI / 16, radius = zone.radius + 2;
        const p = {x:zone.x + Math.cos(angle)*radius, z:zone.z + Math.sin(angle)*radius};
        // Ground targets must fit at the actual pathfinding cell center as well.
        return flying ? p : world.point(world.idx(p.x,p.z));
      }).filter(p => distance(p,zone) < zone.radius + 4 &&
        (flying || (!world.staticGrid[world.idx(p.x,p.z)] && world.terrainFree(p,p,unit.size*UNIT_BODY_SCALE))))
        .sort((a,b) => distance(a,unit)-distance(b,unit));
      const target = candidates.find(p => reserved.every(other => other.flying !== flying ||
        distance(p,other) > (unit.size+other.size)*UNIT_BODY_SCALE+.2)) || candidates[0];
      if (target) {
        this.aiOrder(team, [unit], target, false);
        reserved.push({...target, size:unit.size, flying});
      }
    }
  },
  aiStrategy(this: MeridianGame, team: PlayerTeam, own: Entity[], visible: AIContact[], home: BuildingEntity) {
    const s=this.s!, ai=this.aiFor(team)!, rules=aiRulesFor(this.factionFor(team),s.depth),
      foes=visible.filter(e=>this.enemy({team},e)),
      army=own.filter(e=>e.kind==='unit'&&e.type!=='worker'&&!e.exit) as UnitEntity[],
      danger=foes.filter(e=>e.kind==='unit'&&distance(e,home)<30),
      power=(units: (Entity | AIContact)[])=>units.reduce((n,e)=>n+this.aiPower(e),0);
    let squad=army.filter(e=>ai.squad.includes(e.id));
    const guards=army.filter(e=>!ai.squad.includes(e.id) && distance(e,home)<35),
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
      const restored=squad.every(e=>distance(e,home)<22 &&
        (this.factionFor(team)===FACTION_ID.THIRD ? e.shield>=e.maxShield*.75 : e.hp>=e.maxHp*.85));
      if (squad.length && s.time<(ai.recoverUntil || 0) && (!restored || s.time-ai.restStartedAt<6)) {
        this.aiOrder(team,squad,home,false);return;
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
      if (threatened) { this.aiRetreat(team,squad,home);return; }
      const current=targets.find(t=>t.contact.id===ai.attackProgress?.targetId);
      if (current && squad.some(u=>this.aiCanDamage(u,current.contact))) {
        // Update progress before testing patience; the total sortie age never forces retreat.
        this.aiAttackGoal(team,squad,current);
        if (s.time-ai.attackProgress!.at>=AI_TUNING.stalledSeconds) {
          this.aiRetreat(team,squad,home);return;
        }
        const alternative=targets.find(t=>t.score>current.score+AI_TUNING.targetSwitchMargin &&
          power(squad)>Math.max(42,t.defense*rules.forceRatio) && squad.some(u=>this.aiCanDamage(u,t.contact)));
        if (alternative && s.time-ai.attackProgress!.startedAt>=AI_TUNING.targetCommitSeconds)
          this.aiAttackGoal(team,squad,alternative);
        return;
      }
      // Destroyed/invalidated objectives can be replaced immediately, without a failure penalty.
    }
    if (army.length>=3 && (!ai.scout || !army.some(e=>e.id===ai.scout)))
      ai.scout=(army.find(e=>e.type==='rifle') || army.find(e=>UNITS[e.type].damage))?.id;
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
      const ready=target.finish ? elapsed>=AI_TUNING.finishWaitSeconds :
        attackers.length>=rules.attackers && power(attackers)>Math.max(42,target.defense*(elapsed>180?.8:rules.forceRatio)) &&
        elapsed>=rules.attackWait;
      if (ai.mode==='attack' ? (target.finish || localContinuation || power(attackers)>Math.max(42,target.defense*rules.forceRatio)) : ready) {
        this.aiAttackGoal(team,attackers,target);return;
      }
    }
    if (scout && !(danger.length && holding && guards.includes(scout)) && s.time-ai.lastScout>rules.scoutInterval) {
      if (ai.scoutGoal && distance(scout,ai.scoutGoal)<10) ai.scoutSite=(ai.scoutSite || 0)+1;
      ai.scoutGoal=this.aiScoutGoal(team,home);
      this.aiOrder(team,[scout],scout.hp<scout.maxHp*.4?home:ai.scoutGoal,false);ai.lastScout=s.time;
    }
    this.aiSetMode(team,army.length?'assemble':'bootstrap');ai.squad=[];ai.attackProgress=undefined;
    const rally={x:home.x-Math.sign(home.x)*13,z:home.z-Math.sign(home.z)*13};
    this.aiOrder(team,pool,rally);
  }
};
type AIStrategyMethods = typeof aiStrategyMethods;
interface MeridianGame extends AIStrategyMethods {}
defineMeridianGameMethods(aiStrategyMethods);
