/* A deterministic controller. All mutations go through the same actions as the local UI. */
'use strict';
const aiMethods = {
  enableAI(this: MeridianGame, team: PlayerTeam) {
    this.party(team).controller = { kind: 'ai', state: { nextThink: 0, mode: 'bootstrap', contacts: {}, squad: [],
      attackStartedAt: 0, restStartedAt: 0, launched: 0, search: 0, nextBuild: 0, buildWindowAt: -1, buildAttempts: {}, lastScout: -100 } };
  },
  aiFor(this: MeridianGame, team: PlayerTeam): AIState | undefined {
    const controller = this.party(team).controller;
    return controller.kind === 'ai' ? controller.state : undefined;
  },
  aiSetMode(this: MeridianGame, team: PlayerTeam, mode: AIState['mode']) {
    const ai=this.aiFor(team)!;
    if (ai.mode===mode) return;
    if (mode==='attack') ai.attackStartedAt=this.s!.time;
    else if (ai.mode==='attack' || mode==='recover') ai.restStartedAt=this.s!.time;
    ai.mode=mode;
  },
  aiObserve(this: MeridianGame, team: PlayerTeam): AIContact[] {
    const s = this.s!, ai = this.aiFor(team)!, view = this.world!.sight[team], visible: AIContact[] = [];
    for (const e of s.entities) {
      if (e.hp <= 0 || e.team === team || !this.canSee(team, e)) continue;
      // Copy only observable properties. Never retain an Entity reference or its queue/order.
      const contact: AIContact = { id:e.id, team:e.team, kind:e.kind, type:e.type,
        x:e.x, z:e.z, hp:e.hp, maxHp:e.maxHp, size:e.size, progress:e.progress, seenAt:s.time };
      if (e.type === 'hq') contact.areaVisible = this.aiAreaVisible(team, e, AI_TUNING.targetRadius);
      if (ai.mode==='attack' && ai.goal && this.enemy({team},contact) &&
          distance(contact,ai.goal)<AI_TUNING.targetRadius && contact.hp<(ai.contacts[e.id]?.hp ?? contact.hp))
        ai.combatProgressAt=s.time;
      ai.contacts[e.id] = contact;
      visible.push(contact);
    }
    const ids = new Set(visible.map(e => e.id));
    for (const c of Object.values(ai.contacts)) {
      const lifetime = c.kind === 'unit' ? AI_RULES.contactLife : AI_RULES.buildingMemory;
      if ((!ids.has(c.id) && view.visible[this.world!.idx(c.x,c.z)]) || s.time-c.seenAt > lifetime)
        delete ai.contacts[c.id];
    }
    return visible;
  },
  aiPower(this: MeridianGame, e: Pick<AIContact,'kind'|'type'|'hp'|'maxHp'|'progress'>) {
    if (e.kind === 'resource' || e.progress < 1) return 0;
    const d: UnitDefinitionShape | BuildingDefinitionShape = e.kind === 'unit'
      ? UNITS[e.type as UnitType] : BUILDINGS[e.type as BuildingType];
    return ((d.damage || 0) / (d.reload || 1) +
      (e.kind === 'unit' ? (e.type === 'medic' ? 8 : d.hp / 80) : 0)) * e.hp/e.maxHp;
  },
  aiOrder(this: MeridianGame, team: PlayerTeam, units: UnitEntity[], p: Position, attack = true) {
    // Do not erase path progress every strategic tick. The command API handles formation/ownership.
    const changed = units.filter(e => !e.exit &&
      (e.order.type !== (attack ? 'attackMove' : 'move') || distance(e.order as Position,p) > 8 ||
        (e.pathStatus==='unreachable' && distance(e.order as Position,p)>.1)));
    if (changed.length) this.executeAction(team, {kind:'order',ids:changed.map(e=>e.id),
      order:{type:attack?'attackMove':'move',x:p.x,z:p.z}},false);
  },
  aiBuild(this: MeridianGame, team: PlayerTeam, type: BuildingType, home: Position) {
    const s=this.s!, ai=this.aiFor(team)!;
    if ((s.time < ai.nextBuild && ai.buildWindowAt !== s.time) || ai.buildAttempts[type] === s.time ||
      this.canBuild(type,null,team) || !this.afford(this.cost(type,'building',team),team)) return false;
    // One planning window per retry interval; each type can search once in that window.
    // Alternative plots share the window, not the failed candidate's cooldown.
    ai.nextBuild = s.time + AI_RULES.buildRetry;
    ai.buildWindowAt = s.time;
    ai.buildAttempts[type] = s.time;
    const vents = Object.values(ai.contacts).filter(e=>e.type==='gas')
      .sort((a,b)=>distance(a,home)-distance(b,home)||a.id-b.id);
    const centers: Position[] = type==='refinery' ? vents : [home];
    for (const center of centers) for (let j=0;j<(type==='refinery'?1:64);j++) {
      const i=(j+ai.search)%64, angle=(i%16)*Math.PI/8,
        deploying=type==='hq' && !!this.party(team).deploymentPending,
        radius=deploying ? 7+Math.floor(i/16)*2 : 11+Math.floor(i/16)*5,
        p=type==='refinery'?{x:center.x,z:center.z}:
          {x:center.x+Math.sin(angle)*radius,z:center.z+Math.cos(angle)*radius};
      // Inspect the full footprint before the common validator checks live bodies. Otherwise
      // its rejection could reveal an unseen unit to the controller.
      const margin=BUILDINGS[type].size+(deploying?0:3), CELL=this.world!.cellSize;
      let observed=true;
      for (let z=p.z-margin;z<=p.z+margin+CELL;z+=CELL)
        for (let x=p.x-margin;x<=p.x+margin+CELL;x+=CELL)
          if (!this.canSee(team,{x,z})) observed=false;
      if (!observed) continue;
      if (this.canBuild(type,p,team)) continue;
      if (this.executeAction(team,{kind:'build',building:type,position:p,selected:[]})) { ai.search=(i+9)%64; return true; }
    }
    ai.search=(ai.search+7)%64;
    return false;
  },
  aiEconomy(this: MeridianGame, team: PlayerTeam, own: Entity[], home: BuildingEntity): number {
    const s=this.s!, account=this.account(team), rules=aiRulesFor(this.factionFor(team),s.depth),
      buildings=own.filter(e=>e.kind==='building') as BuildingEntity[],
      workers=own.filter(e=>e.type==='worker') as UnitEntity[],
      count=(type:EntityType)=>own.filter(e=>e.type===type).length,
      queued=(type:UnitType)=>buildings.reduce((n,b)=>n+b.queue.filter(q=>q.type===type).length,0),
      desired=rules.workers+(count('factory')?2:0)+(count('hangar')?2:0);
    if (workers.length+queued('worker') < desired && queued('worker')<2) this.executeAction(team,{kind:'train',unit:'worker'});
    const free=this.availableWorkers(team).sort((a,b)=>
      a.id - b.id);
    for (const b of buildings.filter(b=>b.progress<1)) {
      if (!workers.some(w=>w.order.type==='build' && w.order.id===b.id) && free.length) {
        const w=free.shift()!;
        this.executeAction(team,{kind:'order',ids:[w.id],order:{type:'build',id:b.id,x:b.x,z:b.z}});
      }
    }
    if (free.length>2 && (account.alloy>150 || home.hp<home.maxHp*.5)) {
      const damaged=own.filter(e=>e.hp<e.maxHp*rules.repairHull && e.progress>=1)
        .sort((a,b)=>(a.type==='hq'?-1:0)-(b.type==='hq'?-1:0)||a.hp/a.maxHp-b.hp/b.maxHp);
      const b=damaged.find(b=>!workers.some(w=>w.order.type==='repair' && w.order.id===b.id));
      if (b) this.executeAction(team,{kind:'order',ids:[free[0].id],order:{type:'repair',id:b.id,x:b.x,z:b.z}});
    }
    const candidates=rules.build.filter((type,i,plan)=>count(type)<plan.slice(0,i+1).filter(t=>t===type).length);
    if (this.cap(team)-this.supply(team)<=6 && this.cap(team)<180 &&
      !buildings.some(b=>b.type==='depot'&&b.progress<1)) candidates.unshift('depot');
    for (const next of new Set(candidates)) {
      if (this.canBuild(next,null,team)) continue;
      const built=this.aiBuild(team,next,home), c=this.cost(next,'building',team);
      // An unseen/unreachable second vent must not lock out the rest of the doctrine.
      if (built) return workers.length<2?50:0;
      if (next!=='refinery' && !this.afford(c,team) && account.gas >= c.gas*.7) return c.cost;
    }
    return workers.length<2?50:0;
  },
  aiProduction(this: MeridianGame, team: PlayerTeam, own: Entity[], visible: AIContact[], reserve: number) {
    const rules=aiRulesFor(this.factionFor(team),this.s!.depth),
      units=own.filter(e=>e.kind==='unit' && e.type!=='worker'),
      count=(type:UnitType)=>units.filter(e=>e.type===type).length +
        own.reduce((n,e)=>n+e.queue.filter(q=>q.type===type).length,0),
      needAA=visible.some(e=>this.enemy({team},e)&&e.kind==='unit' && !!(UNITS[e.type as UnitType] as UnitDefinitionShape)?.flying),
      siege=Object.values(this.aiFor(team)!.contacts).some(e=>this.enemy({team},e)&&e.kind==='building'),
      choices: UnitType[] = [];
    if (needAA) choices.push('rifle');
    if (units.length>=8 && !count('hero')) choices.push('hero');
    const canBuildDestroyer=this.has('hangar',team) && units.length>=10 &&
      count('destroyer')<Math.max(1,Math.floor(units.length/14)) && (!needAA || count('rifle')>=4);
    // Save only after a viable army and economy exist; avoid a rifle purchase resetting the goal.
    const destroyerCost=this.cost('destroyer','unit',team), account=this.account(team);
    if (canBuildDestroyer && account.gas>=destroyerCost.gas*.65) {
      if (account.gas<destroyerCost.gas || account.alloy<destroyerCost.cost+reserve) return;
      choices.push('destroyer');
    }
    if (this.has('hangar',team) && count('air')<Math.max(1,units.length*rules.airShare)) choices.push('air');
    if (units.length>=4 && this.has('factory',team) && !needAA) {
      if (siege && count('artillery')<Math.max(1,count('tank')/2)) choices.push('artillery');
      if (count('tank')<Math.max(1,units.length*rules.tankShare)) choices.push('tank');
    }
    if (units.length>=3 && count('medic')<Math.floor(units.length/rules.medicRatio)) choices.push('medic');
    choices.push('rifle');
    for (const type of choices) {
      if (!this.availableProducers(UNITS[type].from,team).some(b=>!b.queue.length)) continue;
      const cost=this.cost(type,'unit',team), keep=units.length<4?0:reserve;
      if (this.account(team).gas<cost.gas) continue;
      // Save for the chosen counter/tech unit instead of spending every 75 alloy on rifles.
      if (this.account(team).alloy-cost.cost<keep) return;
      this.executeAction(team,{kind:'train',unit:type});
      return;
    }
  },
  aiAbilities(this: MeridianGame, team: PlayerTeam, own: Entity[], visible: AIContact[], home: Position) {
    const s=this.s!, ai=this.aiFor(team)!, rules=aiRulesFor(this.factionFor(team),s.depth),
      foes=visible.filter(e=>this.enemy({team},e));
    const ready=(kind:AbilityType)=>!this.abilityRequirement(kind,team) &&
      this.account(team).energy>=this.abilityStats(kind,team).energy && this.account(team).abilities[kind]<=s.time;
    if (ready('repair')) {
      const p=own.map(e=>({e,missing:own.filter(n=>n.progress>=1 && distance(e,n)<12).reduce((n,a)=>n+a.maxHp-a.hp,0)}))
        .sort((a,b)=>b.missing-a.missing)[0];
      if (p?.missing>=rules.repairMissing) this.executeAction(team,{kind:'ability',ability:'repair',position:p.e});
    }
    if (ready('orbital')) {
      const p=foes.map(e=>({e,value:foes.filter(n=>distance(e,n)<8).reduce((n,a)=>n+Math.min(a.hp,300),0)}))
        .sort((a,b)=>b.value-a.value)[0];
      if (p?.value>=rules.orbitalValue) this.executeAction(team,{kind:'ability',ability:'orbital',position:p.e});
    }
    if (ready('drop') && this.supply(team)+this.abilityStats('drop',team).supply!<=this.cap(team) &&
      (ai.mode==='attack' || foes.some(e=>distance(e,home)<30))) {
      const p=ai.mode==='attack'?own.find(e=>ai.squad.includes(e.id)):home;
      if (p) this.executeAction(team,{kind:'ability',ability:'drop',position:p});
    }
    if (ready('bulwark') && foes.length) {
      const p=own.filter(e=>e.kind!=='resource').map(e=>({e,value:own.filter(n=>n.kind!=='resource'&&distance(e,n)<10).length+
        foes.filter(n=>distance(e,n)<15).length*2})).sort((a,b)=>b.value-a.value)[0];
      if (p?.value>=6) this.executeAction(team,{kind:'ability',ability:'bulwark',position:p.e});
    }
    if (ready('disruption')) {
      const p=foes.map(e=>({e,value:foes.filter(n=>distance(e,n)<11).length})).sort((a,b)=>b.value-a.value)[0];
      if (p?.value>=3) this.executeAction(team,{kind:'ability',ability:'disruption',position:p.e});
    }
    if (ready('surge') && ai.mode==='attack') {
      const p=own.filter(e=>e.kind==='unit'&&e.type!=='worker').map(e=>({e,value:own.filter(n=>n.kind==='unit'&&
        n.type!=='worker'&&distance(e,n)<10).length})).sort((a,b)=>b.value-a.value)[0];
      if (p?.value>=4) this.executeAction(team,{kind:'ability',ability:'surge',position:p.e});
    }
    if (ready('recall')) {
      const p=own.filter(e=>e.kind==='unit'&&e.type!=='worker'&&e.hp/e.maxHp<.35)
        .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
      if (p && foes.some(e=>distance(e,p)<18)) this.executeAction(team,{kind:'ability',ability:'recall',position:p});
    }
    if (ready('scan') && s.time>rules.scanAfter && !foes.length && own.some(e=>e.type==='rifle')) {
      const p=ai.goal || this.aiScoutGoal(team,home);
      if (!this.canSee(team,p) && !s.scans.some(scan=>scan.team===team)) this.executeAction(team,{kind:'ability',ability:'scan',position:p});
    }
  },
  aiDeployment(this: MeridianGame, team: PlayerTeam, own: Entity[]) {
    const worker = own.find(e => e.kind === 'unit' && e.type === 'worker') as UnitEntity | undefined,
      foundation = own.find(e => e.type === 'hq' && e.progress < 1), ai = this.aiFor(team)!, world = this.world!, now = this.s!.time;
    if (!worker) return;
    if (foundation) {
      if (!own.some(e => e.type === 'worker' && e.order.type === 'build' && e.order.id === foundation.id))
        this.executeAction(team, { kind: 'order', ids: [worker.id], order: { type: 'build', id: foundation.id, x: foundation.x, z: foundation.z } });
      return;
    }
    // Only observed deposits can justify a base. Never read hidden resource entities/layout anchors.
    const resource = Object.values(ai.contacts).filter(c => c.kind === 'resource' && c.type === 'crystal')
      .sort((a, b) => distance(a, worker) - distance(b, worker) || a.id - b.id)[0];
    if (ai.deploymentGoal && worker.order.type === 'move' && distance(worker, ai.deploymentGoal) > 4 &&
      worker.pathStatus !== 'unreachable' && now - (ai.deploymentGoalAt || 0) < 18) return;
    const nearbyResource = !!resource && distance(resource, worker) < 13;
    if (nearbyResource) {
      if (this.aiBuild(team, 'hq', worker)) { ai.deploymentGoal = undefined; return; }
      // Only relocate after an actual failed search, not during its retry cooldown
      // or when the worker/resources are temporarily unavailable.
      if (ai.buildAttempts.hq !== now) return;
    }
    const targets: Position[] = [];
    if (resource && distance(resource, worker) >= 13) targets.push({ x: resource.x - 6, z: resource.z + 6 });
    for (let z = 4; z < world.gridSize - 4; z += 4) for (let x = 4; x < world.gridSize - 4; x += 4) {
      const i = z * world.gridSize + x, p = world.point(i), d = distance(p, worker);
      if (world.deploymentReachable[i] && (nearbyResource || !world.sight[team].explored[i]) && d > (nearbyResource ? 6 : 12) &&
        (!ai.deploymentGoal || distance(p, ai.deploymentGoal) > 6)) targets.push(p);
    }
    const choices = resource && !nearbyResource ? targets : targets.sort((a, b) => distance(a, worker) - distance(b, worker));
    for (const p of choices.slice(0, 12)) {
      // The public vehicle component already guarantees a terrain route for this worker.
      // Inspecting live navigation here would leak unseen opponent foundations.
      if (!world.deploymentReachable[world.idx(p.x, p.z)] || !world.surface!.fits(p.x, p.z, worker.size * UNIT_BODY_SCALE)) continue;
      if (this.executeAction(team, { kind: 'order', ids: [worker.id], order: { type: 'move', ...p } }, false)) {
        ai.deploymentGoal = { ...p }; ai.deploymentGoalAt = now; return;
      }
    }
  },
  aiTick(this: MeridianGame, team: PlayerTeam) {
    const s=this.s!, ai=this.aiFor(team);
    if (!ai || this.party(team).eliminated || s.result || s.stopped || s.time<ai.nextThink) return;
    const rules=aiRulesFor(this.factionFor(team),s.depth);
    if (!ai.observation) {
      // Freeze decision inputs, including own damage/positions. A think interval alone
      // permits zero-latency reactions to enemies appearing just before that tick.
      const own=this.alive(e=>e.team===team).map(e=>({...e,
        order:{...e.order},queue:e.queue.map(q=>({...q}))}));
      ai.observation={readyAt:s.time+rules.reactionDelay,own,visible:this.aiObserve(team)};
      ai.nextThink=ai.observation.readyAt;
      return;
    }
    const {own,visible}=ai.observation;
    ai.observation=undefined;
    ai.nextThink=s.time+Math.max(0,rules.think-rules.reactionDelay);
    const home=own.find(e=>e.type==='hq'&&e.progress>=1) as BuildingEntity | undefined;
    if (!home && this.party(team).deploymentPending) {
      this.aiDeployment(team, own);
      return;
    }
    if (!home) return;
    // Actions still validate live ownership, visibility, technology and resources.
    const reserve=this.aiEconomy(team,own,home);
    this.aiProduction(team,own,visible,reserve);
    this.aiStrategy(team,own,visible,home);
    this.aiAbilities(team,own,visible,home);
  }
};
type AIMethods = typeof aiMethods;
interface MeridianGame extends AIMethods {}
defineMeridianGameMethods(aiMethods);
