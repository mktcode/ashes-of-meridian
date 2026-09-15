/* A deterministic controller. All mutations go through the same actions as the local UI. */
'use strict';
const AI_RULES = Object.freeze({ think: 1, buildRetry: 3, contactLife: 90, buildingMemory: 300 });
// Faction is the doctrine; depth only strengthens its execution. No additional encounter roll.
const AI_DOCTRINES = [
  { workers: 6, reserve: 3, attackWait: 75, attackers: 4, airShare: .12, tankShare: .35, medicRatio: 4,
    repairHull: .75, repairMissing: 200, orbitalValue: 450, scanAfter: 60,
    build: ['barracks','refinery','turret','factory','refinery','hangar','barracks'], extra: 'factory',
    targets: { worker: 65, refinery: 95, factory: 120, hangar: 120, barracks: 110, turret: 105, artillery: 80 } },
  { workers: 7, reserve: 1, attackWait: 55, attackers: 3, airShare: .1, tankShare: .15, medicRatio: 3,
    repairHull: .6, repairMissing: 250, orbitalValue: 450, scanAfter: 60,
    build: ['barracks','refinery','barracks','factory','turret','refinery','hangar'], extra: 'barracks',
    targets: { worker: 130, refinery: 140, factory: 95, hangar: 95, barracks: 90, turret: 25, artillery: 60 } },
  { workers: 6, reserve: 2, attackWait: 65, attackers: 3, airShare: .3, tankShare: .22, medicRatio: 5,
    repairHull: .65, repairMissing: 250, orbitalValue: 350, scanAfter: 40,
    build: ['barracks','refinery','factory','hangar','refinery','turret','barracks'], extra: 'hangar',
    targets: { worker: 65, refinery: 125, factory: 120, hangar: 120, barracks: 100, turret: 25, artillery: 140 } }
] as const;
function aiRulesFor(faction: FactionId, depth: number) {
  const doctrine = AI_DOCTRINES[faction], stage = clamp(Math.floor((Number(depth) || 0) / 4), 0, 4);
  return { ...doctrine, stage, workers: doctrine.workers + stage,
    attackWait: doctrine.attackWait - stage * 5, scoutInterval: 15 - stage * 2,
    forceRatio: 1.15 - stage * .04, recoveryTime: 30 - stage * 3,
    build: [...doctrine.build, ...(stage >= 2 ? [doctrine.extra] : []),
      ...(stage >= 4 ? [doctrine.extra] : [])] as BuildingType[] };
}
const aiMethods = {
  enableAI(this: MeridianGame, team: PlayerTeam) {
    this.s!.ai[team] = { nextThink: 0, mode: 'bootstrap', contacts: {}, squad: [],
      attackStartedAt: 0, restStartedAt: 0, launched: 0, search: 0, nextBuild: 0, buildWindowAt: -1, buildAttempts: {}, lastScout: -100 };
  },
  aiSetMode(this: MeridianGame, team: PlayerTeam, mode: AIState['mode']) {
    const ai=this.s!.ai[team]!;
    if (ai.mode===mode) return;
    if (mode==='attack') ai.attackStartedAt=this.s!.time;
    else if (ai.mode==='attack' || mode==='recover') ai.restStartedAt=this.s!.time;
    ai.mode=mode;
  },
  aiObserve(this: MeridianGame, team: PlayerTeam): AIContact[] {
    const s = this.s!, ai = s.ai[team]!, view = this.world!.sight[team], visible: AIContact[] = [];
    for (const e of s.entities) {
      if (e.hp <= 0 || e.team === team || !this.canSee(team, e)) continue;
      // Copy only observable properties. Never retain an Entity reference or its queue/order.
      const contact: AIContact = { id:e.id, team:e.team, kind:e.kind, type:e.type,
        x:e.x, z:e.z, hp:e.hp, maxHp:e.maxHp, size:e.size, progress:e.progress, seenAt:s.time };
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
      (e.order.type !== (attack ? 'attackMove' : 'move') || distance(e.order as Position,p) > 8));
    if (changed.length) this.command(changed.map(e=>e.id),
      {type:attack?'attackMove':'move',x:p.x,z:p.z},team,false);
  },
  aiBuild(this: MeridianGame, team: PlayerTeam, type: BuildingType, home: BuildingEntity) {
    const s=this.s!, ai=s.ai[team]!;
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
        radius=11+Math.floor(i/16)*5,
        p=type==='refinery'?{x:center.x,z:center.z}:
          {x:center.x+Math.sin(angle)*radius,z:center.z+Math.cos(angle)*radius};
      // Inspect the full footprint before the common validator checks live bodies. Otherwise
      // its rejection could reveal an unseen unit to the controller.
      const margin=BUILDINGS[type].size+3, CELL=this.world!.cellSize;
      let observed=true;
      for (let z=p.z-margin;z<=p.z+margin+CELL;z+=CELL)
        for (let x=p.x-margin;x<=p.x+margin+CELL;x+=CELL)
          if (!this.canSee(team,{x,z})) observed=false;
      if (!observed) continue;
      if (this.canBuild(type,p,team)) continue;
      if (this.build(type,p,[],team)) { ai.search=(i+9)%64; return true; }
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
    if (workers.length+queued('worker') < desired && queued('worker')<2) this.train('worker',team);
    const free=this.availableWorkers(team);
    for (const b of buildings.filter(b=>b.progress<1)) {
      if (!workers.some(w=>w.order.type==='build' && w.order.id===b.id) && free.length) {
        const w=free.shift()!;
        this.command([w.id],{type:'build',id:b.id,x:b.x,z:b.z},team);
      }
    }
    if (free.length>2 && (account.alloy>150 || home.hp<home.maxHp*.5)) {
      const damaged=own.filter(e=>e.hp<e.maxHp*rules.repairHull && e.progress>=1)
        .sort((a,b)=>(a.type==='hq'?-1:0)-(b.type==='hq'?-1:0)||a.hp/a.maxHp-b.hp/b.maxHp);
      const b=damaged.find(b=>!workers.some(w=>w.order.type==='repair' && w.order.id===b.id));
      if (b) this.command([free[0].id],{type:'repair',id:b.id,x:b.x,z:b.z},team);
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
      needAA=visible.some(e=>e.type==='air'),
      siege=Object.values(this.s!.ai[team]!.contacts).some(e=>e.team!==-1&&e.kind==='building'),
      choices: UnitType[] = [];
    if (needAA) choices.push('rifle');
    if (units.length>=8 && !count('hero')) choices.push('hero');
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
      this.train(type,team);
      return;
    }
  },
  aiAbilities(this: MeridianGame, team: PlayerTeam, own: Entity[], visible: AIContact[], home: BuildingEntity) {
    const s=this.s!, ai=s.ai[team]!, rules=aiRulesFor(this.factionFor(team),s.depth),
      foes=visible.filter(e=>e.team!==-1);
    const ready=(kind:AbilityType)=>!this.abilityRequirement(kind,team) &&
      this.account(team).energy>=ABILITIES[kind].energy && this.account(team).abilities[kind]<=s.time;
    if (ready('repair')) {
      const p=own.map(e=>({e,missing:own.filter(n=>n.progress>=1 && distance(e,n)<12).reduce((n,a)=>n+a.maxHp-a.hp,0)}))
        .sort((a,b)=>b.missing-a.missing)[0];
      if (p?.missing>=rules.repairMissing) this.ability('repair',p.e,team);
    }
    if (ready('orbital')) {
      const p=foes.map(e=>({e,value:foes.filter(n=>distance(e,n)<8).reduce((n,a)=>n+Math.min(a.hp,300),0)}))
        .sort((a,b)=>b.value-a.value)[0];
      if (p?.value>=rules.orbitalValue) this.ability('orbital',p.e,team);
    }
    if (ready('drop') && this.supply(team)+8<=this.cap(team) &&
      (ai.mode==='attack' || foes.some(e=>distance(e,home)<30))) {
      const p=ai.mode==='attack'?own.find(e=>ai.squad.includes(e.id)):home;
      if (p) this.ability('drop',p,team);
    }
    if (ready('scan') && s.time>rules.scanAfter && !foes.length && own.some(e=>e.type==='rifle')) {
      const p=ai.goal || this.aiScoutGoal(team,home);
      if (!this.canSee(team,p) && !s.scans.some(scan=>scan.team===team)) this.ability('scan',p,team);
    }
  },
  aiScoutGoal(this: MeridianGame, team: PlayerTeam, home: BuildingEntity): Position {
    const world=this.world!, unexplored=(p:Position)=>!world.sight[team].explored[world.idx(p.x,p.z)],
      corners=world.startSites.filter(p=>distance(p,home)>25)
        .sort((a,b)=>distance(a,home)-distance(b,home));
    // Candidate terrain sites are public; actual opponent assignment and hidden HQs are not.
    return [...corners,...world.layout.resourceSites].find(unexplored) || corners[0] || home;
  },
  aiStrategy(this: MeridianGame, team: PlayerTeam, own: Entity[], visible: AIContact[], home: BuildingEntity) {
    const s=this.s!,ai=s.ai[team]!, rules=aiRulesFor(this.factionFor(team),s.depth),
      foes=visible.filter(e=>e.team!==-1),
      army=own.filter(e=>e.kind==='unit'&&e.type!=='worker'&&!e.exit) as UnitEntity[],
      danger=foes.filter(e=>e.kind==='unit'&&distance(e,home)<30);
    if (danger.length) {
      this.aiSetMode(team,'defend'); ai.squad=[];
      this.aiOrder(team,army,danger[0]); return;
    }
    let squad=army.filter(e=>ai.squad.includes(e.id));
    if (ai.mode==='recover') {
      // Keep the retreat order across strategic ticks, but never wait forever for healing.
      const restored=squad.every(e=>distance(e,home)<22 &&
        (this.factionFor(team)===FACTION_ID.THIRD ? e.shield>=e.maxShield*.75 : e.hp>=e.maxHp*.85));
      if (squad.length && s.time<(ai.recoverUntil || 0) && (!restored || s.time-ai.restStartedAt<6)) {
        this.aiOrder(team,squad,home,false);return;
      }
      this.aiSetMode(team,'assemble');ai.squad=[];squad=[];
    }
    if (ai.mode==='attack' && ai.goal && squad.length) {
      const power=squad.reduce((n,e)=>n+this.aiPower(e),0),
        opposition=foes.filter(e=>squad.some(u=>distance(u,e)<25)).reduce((n,e)=>n+this.aiPower(e),0),
        arrived=squad.some(e=>distance(e,ai.goal!)<10),
        hull=squad.reduce((n,e)=>n+e.hp,0)/squad.reduce((n,e)=>n+e.maxHp,0),
        shields=squad.reduce((n,e)=>n+e.shield,0)/Math.max(1,squad.reduce((n,e)=>n+e.maxShield,0)),
        exhausted=opposition>0 && s.time-ai.attackStartedAt>6 &&
          (this.factionFor(team)===FACTION_ID.SECOND ? hull<.6 :
            this.factionFor(team)===FACTION_ID.THIRD && shields<.2);
      if (exhausted || squad.length<ai.launched*.45 || power<opposition*.5 || s.time-ai.attackStartedAt>150) {
        ai.failedGoal={...ai.goal,until:s.time+AI_RULES.contactLife};
        this.aiSetMode(team,'recover');ai.recoverUntil=s.time+rules.recoveryTime;
        this.aiOrder(team,squad,home,false);return;
      }
      if (!arrived) { this.aiOrder(team,squad,ai.goal);return; }
      // Reassess at the last-known location, not at a hidden live entity's new coordinates.
    }
    const known=Object.values(ai.contacts).filter(e=>e.team!==-1 && e.kind!=='resource');
    if (army.length>=2 && (!ai.scout || !army.some(e=>e.id===ai.scout))) ai.scout=army[0].id;
    const scout=army.find(e=>e.id===ai.scout);
    if (scout && ai.mode!=='attack' && s.time-ai.lastScout>rules.scoutInterval) {
      const goal=this.aiScoutGoal(team,home);
      this.aiOrder(team,[scout],scout.hp<scout.maxHp*.4?home:goal,false);ai.lastScout=s.time;
    }
    const pool=army.filter(e=>e.id!==ai.scout), attackers=ai.mode==='attack'?squad:pool.slice(rules.reserve),
      strength=attackers.reduce((n,e)=>n+this.aiPower(e),0),
      elapsed=s.time-(ai.mode==='attack'?ai.attackStartedAt:ai.restStartedAt);
    const weights: Partial<Record<EntityType,number>>=rules.targets,
      value=(e:AIContact)=>(weights[e.type] ?? (e.type==='depot'?65:e.type==='hq'?85:25)) -
        (ai.failedGoal && s.time<ai.failedGoal.until && distance(e,ai.failedGoal)<25 ? 100 : 0);
    const targets=known.map(e=>({e,defense:known.filter(n=>distance(e,n)<25).reduce((n,note)=>n+this.aiPower(note),0)}))
      .sort((a,b)=>(value(b.e)-b.defense*.5-distance(b.e,home)*.2)-(value(a.e)-a.defense*.5-distance(a.e,home)*.2)||a.e.id-b.e.id);
    const target=targets.find(t=>strength>Math.max(42,t.defense*(elapsed>180?.8:rules.forceRatio)));
    if (target && attackers.length>=rules.attackers && (ai.mode==='attack'||elapsed>=rules.attackWait)) {
      if (ai.mode!=='attack') ai.launched=attackers.length;
      this.aiSetMode(team,'attack');ai.goal={x:target.e.x,z:target.e.z};
      ai.squad=attackers.map(e=>e.id);
      this.aiOrder(team,attackers,ai.goal);return;
    }
    this.aiSetMode(team,army.length?'assemble':'bootstrap'); ai.squad=[];
    // Hold near the base without pinning the producer exits.
    const rally={x:home.x-Math.sign(home.x)*13,z:home.z-Math.sign(home.z)*13};
    this.aiOrder(team,pool,rally);
  },
  aiTick(this: MeridianGame, team: PlayerTeam) {
    const s=this.s!, ai=s.ai[team];
    if (!ai || s.result || s.time<ai.nextThink) return;
    ai.nextThink=s.time+AI_RULES.think;
    const own=this.alive(e=>e.team===team), home=own.find(e=>e.type==='hq'&&e.progress>=1) as BuildingEntity | undefined;
    if (!home) return;
    const visible=this.aiObserve(team),reserve=this.aiEconomy(team,own,home);
    this.aiProduction(team,own,visible,reserve);
    this.aiStrategy(team,own,visible,home);
    this.aiAbilities(team,own,visible,home);
  }
};
type AIMethods = typeof aiMethods;
interface MeridianGame extends AIMethods {}
defineMeridianGameMethods(aiMethods);
