/* A deterministic controller. All mutations go through the same actions as the local UI. */
'use strict';
const AI_RULES = Object.freeze({ think: 1, buildRetry: 3, workers: 6, reserve: 2,
  attackWait: 65, contactLife: 90, buildingMemory: 300 });
const aiMethods = {
  enableAI(this: MeridianGame, team: PlayerTeam) {
    this.s!.ai[team] = { nextThink: 0, mode: 'bootstrap', contacts: {}, squad: [],
      lastAttack: 0, launched: 0, search: 0, nextBuild: 0, lastScout: -100 };
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
    if (s.time < ai.nextBuild || this.canBuild(type,null,team) || !this.afford(this.cost(type,'building',team),team)) return false;
    ai.nextBuild = s.time + AI_RULES.buildRetry;
    const vents = Object.values(ai.contacts).filter(e=>e.type==='gas')
      .sort((a,b)=>distance(a,home)-distance(b,home)||a.id-b.id);
    const centers: Position[] = type==='refinery' ? vents : [home];
    const known = this.alive(e=>e.team===team || this.canSee(team,e));
    for (const center of centers) for (let j=0;j<64;j++) {
      const i=(j+ai.search)%64, angle=(i%16)*Math.PI/8,
        radius=type==='refinery'?4+(Math.floor(i/16))*.8:11+Math.floor(i/16)*5,
        p={x:center.x+Math.sin(angle)*radius,z:center.z+Math.cos(angle)*radius};
      // Inspect only a fully visible footprint, including a body-sized margin. Otherwise an
      // unseen unit could occupy the proposed plot (the general UI placement bug is separate).
      const margin=BUILDINGS[type].size+3, CELL=this.world!.cellSize;
      let observed=true;
      for (let z=p.z-margin;z<=p.z+margin+CELL;z+=CELL)
        for (let x=p.x-margin;x<=p.x+margin+CELL;x+=CELL)
          if (!this.canSee(team,{x,z})) observed=false;
      if (!observed) continue;
      if (known.some(e=>e.kind==='unit' &&
        (distance(e,p)<BUILDINGS[type].size+e.size*UNIT_BODY_SCALE+1 ||
          (e.exit && distance(e.exit,p)<BUILDINGS[type].size+e.size*UNIT_BODY_SCALE+1)))) continue;
      if (this.canBuild(type,p,team)) continue;
      if (this.build(type,p,[],team)) { ai.search=(i+9)%64; return true; }
    }
    ai.search=(ai.search+7)%64;
    return false;
  },
  aiEconomy(this: MeridianGame, team: PlayerTeam, own: Entity[], home: BuildingEntity): number {
    const s=this.s!, account=this.account(team), ai=s.ai[team]!,
      buildings=own.filter(e=>e.kind==='building') as BuildingEntity[],
      workers=own.filter(e=>e.type==='worker') as UnitEntity[],
      count=(type:EntityType)=>own.filter(e=>e.type===type).length,
      queued=(type:UnitType)=>buildings.reduce((n,b)=>n+b.queue.filter(q=>q.type===type).length,0),
      desired=AI_RULES.workers+(count('factory')?2:0)+(count('hangar')?2:0);
    if (workers.length+queued('worker') < desired && queued('worker')<2) this.train('worker',team);
    const free=this.availableWorkers(team);
    for (const b of buildings.filter(b=>b.progress<1)) {
      if (!workers.some(w=>w.order.type==='build' && w.order.id===b.id) && free.length) {
        const w=free.shift()!;
        this.command([w.id],{type:'build',id:b.id,x:b.x,z:b.z},team);
      }
    }
    if (free.length>2 && (account.alloy>150 || home.hp<home.maxHp*.5)) {
      const damaged=own.filter(e=>e.hp<e.maxHp*.65 && e.progress>=1)
        .sort((a,b)=>(a.type==='hq'?-1:0)-(b.type==='hq'?-1:0)||a.hp/a.maxHp-b.hp/b.maxHp);
      const b=damaged.find(b=>!workers.some(w=>w.order.type==='repair' && w.order.id===b.id));
      if (b) this.command([free[0].id],{type:'repair',id:b.id,x:b.x,z:b.z},team);
    }
    let next: BuildingType | null = !count('barracks')?'barracks':!count('refinery')?'refinery':
      this.cap(team)-this.supply(team)<=6 && this.cap(team)<180 && !buildings.some(b=>b.type==='depot'&&b.progress<1)?'depot':
      !count('factory')?'factory':!count('hangar')?'hangar':
      !count('turret')?'turret':count('refinery')<2?'refinery':count('barracks')<2?'barracks':null;
    if (next && !this.canBuild(next,null,team)) {
      this.aiBuild(team,next,home);
      // Reserve for near-term tech, not an unreachable second vent or a distant gas requirement.
      const c=this.cost(next,'building',team);
      if (next!=='refinery' && account.gas >= c.gas*.7) return c.cost;
    }
    return workers.length<2?50:0;
  },
  aiProduction(this: MeridianGame, team: PlayerTeam, own: Entity[], visible: AIContact[], reserve: number) {
    const units=own.filter(e=>e.kind==='unit' && e.type!=='worker'),
      count=(type:UnitType)=>units.filter(e=>e.type===type).length,
      pending=(type:UnitType)=>own.some(e=>e.queue.some(q=>q.type===type)),
      needAA=visible.some(e=>e.type==='air'),
      siege=Object.values(this.s!.ai[team]!.contacts).some(e=>e.team!==-1&&e.kind==='building'),
      choices: UnitType[] = [];
    if (units.length>=8 && !count('hero') && !pending('hero')) choices.push('hero');
    if (this.has('hangar',team) && count('air')<Math.max(2,units.length/5)) choices.push('air');
    if (units.length>=4 && this.has('factory',team) && !needAA)
      choices.push(siege && count('artillery')<Math.max(1,count('tank')/2)?'artillery':'tank');
    if (units.length>=3 && count('medic')<Math.floor(units.length/4)) choices.push('medic');
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
    const s=this.s!, ai=s.ai[team]!, foes=visible.filter(e=>e.team!==-1);
    const ready=(kind:AbilityType)=>this.account(team).energy>=ABILITIES[kind].energy && this.account(team).abilities[kind]<=s.time;
    if (ready('repair')) {
      const p=own.map(e=>({e,missing:own.filter(n=>n.progress>=1 && distance(e,n)<12).reduce((n,a)=>n+a.maxHp-a.hp,0)}))
        .sort((a,b)=>b.missing-a.missing)[0];
      if (p?.missing>=250) this.ability('repair',p.e,team);
    }
    if (ready('orbital')) {
      const p=foes.map(e=>({e,value:foes.filter(n=>distance(e,n)<8).reduce((n,a)=>n+Math.min(a.hp,300),0)}))
        .sort((a,b)=>b.value-a.value)[0];
      if (p?.value>=450) this.ability('orbital',p.e,team);
    }
    if (ready('drop') && this.supply(team)+8<=this.cap(team) &&
      (ai.mode==='attack' || foes.some(e=>distance(e,home)<30))) {
      const p=ai.mode==='attack'?own.find(e=>ai.squad.includes(e.id)):home;
      if (p) this.ability('drop',p,team);
    }
    if (ready('scan') && s.time>60 && !foes.length && own.some(e=>e.type==='rifle')) {
      const layout=this.world!.layout, p=ai.goal || (team===1?layout.playerStart:layout.enemySites[0]);
      if (!this.canSee(team,p) && !s.scans.some(scan=>scan.team===team)) this.ability('scan',p,team);
    }
  },
  aiStrategy(this: MeridianGame, team: PlayerTeam, own: Entity[], visible: AIContact[], home: BuildingEntity) {
    const s=this.s!,ai=s.ai[team]!, foes=visible.filter(e=>e.team!==-1),
      army=own.filter(e=>e.kind==='unit'&&e.type!=='worker'&&!e.exit) as UnitEntity[],
      danger=foes.filter(e=>e.kind==='unit'&&distance(e,home)<30);
    if (danger.length) {
      ai.mode='defend'; ai.squad=[];
      this.aiOrder(team,army,danger[0]); return;
    }
    let squad=army.filter(e=>ai.squad.includes(e.id));
    if (ai.mode==='attack' && ai.goal && squad.length) {
      const power=squad.reduce((n,e)=>n+this.aiPower(e),0),
        opposition=foes.filter(e=>squad.some(u=>distance(u,e)<25)).reduce((n,e)=>n+this.aiPower(e),0),
        arrived=squad.some(e=>distance(e,ai.goal!)<10);
      if (squad.length<ai.launched*.45 || power<opposition*.5 || s.time-ai.lastAttack>150) {
        ai.mode='recover';ai.squad=[];ai.lastAttack=s.time;
        this.aiOrder(team,squad,home,false);return;
      }
      if (!arrived) { this.aiOrder(team,squad,ai.goal);return; }
      // Reassess at the last-known location, not at a hidden live entity's new coordinates.
    }
    const known=Object.values(ai.contacts).filter(e=>e.team!==-1 && e.kind!=='resource');
    if (army.length>=2 && (!ai.scout || !army.some(e=>e.id===ai.scout))) ai.scout=army[0].id;
    const scout=army.find(e=>e.id===ai.scout);
    if (scout && ai.mode!=='attack' && s.time-ai.lastScout>15) {
      const layout=this.world!.layout, p=team===1?layout.playerStart:layout.enemySites[0];
      const goals=[p,...layout.resourceSites];
      const goal=goals.find(p=>!this.world!.sight[team].explored[this.world!.idx(p.x,p.z)]) || p;
      this.aiOrder(team,[scout],scout.hp<scout.maxHp*.4?home:goal,false);ai.lastScout=s.time;
    }
    const pool=army.filter(e=>e.id!==ai.scout), attackers=ai.mode==='attack'?squad:pool.slice(AI_RULES.reserve),
      strength=attackers.reduce((n,e)=>n+this.aiPower(e),0),elapsed=s.time-ai.lastAttack;
    const value=(e:AIContact)=>e.type==='worker'?65:e.type==='refinery'?95:
      ['factory','hangar','barracks'].includes(e.type)?100:e.type==='depot'?65:e.type==='hq'?85:25;
    const targets=known.map(e=>({e,defense:known.filter(n=>distance(e,n)<25).reduce((n,note)=>n+this.aiPower(note),0)}))
      .sort((a,b)=>(value(b.e)-b.defense*.5-distance(b.e,home)*.2)-(value(a.e)-a.defense*.5-distance(a.e,home)*.2)||a.e.id-b.e.id);
    const target=targets.find(t=>strength>Math.max(42,t.defense*(elapsed>180?.8:1.15)));
    if (target && attackers.length>=3 && (ai.mode==='attack'||elapsed>=AI_RULES.attackWait)) {
      ai.mode='attack';ai.goal={x:target.e.x,z:target.e.z};
      ai.squad=attackers.map(e=>e.id);ai.launched=attackers.length;ai.lastAttack=s.time;
      this.aiOrder(team,attackers,ai.goal);return;
    }
    ai.mode=army.length?'assemble':'bootstrap'; ai.squad=[];
    // Hold near the base without pinning the producer exits.
    const rally={x:home.x+(team===1?-13:13),z:home.z+(team===1?13:-13)};
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
