/* One battle group, driven only by the controller's observations. */
'use strict';
const aiStrategyMethods = {
  aiScoutGoal(this: MeridianGame, team: PlayerTeam, home: BuildingEntity): Position {
    const world=this.world!, unexplored=(p:Position)=>!world.sight[team].explored[world.idx(p.x,p.z)],
      corners=world.startSites.filter(p=>distance(p,home)>25)
        .sort((a,b)=>distance(a,home)-distance(b,home));
    // Candidate terrain sites are public; actual opponent assignment and hidden HQs are not.
    return [...corners,...world.layout.resourceSites].find(unexplored) || corners[0] || home;
  },
  aiStrategy(this: MeridianGame, team: PlayerTeam, own: Entity[], visible: AIContact[], home: BuildingEntity) {
    const s=this.s!,ai=this.aiFor(team)!, rules=aiRulesFor(this.factionFor(team),s.depth),
      foes=visible.filter(e=>this.enemy({team},e)),
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
    const known=Object.values(ai.contacts).filter(e=>this.enemy({team},e) && e.kind!=='resource');
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
  }
};
type AIStrategyMethods = typeof aiStrategyMethods;
interface MeridianGame extends AIStrategyMethods {}
defineMeridianGameMethods(aiStrategyMethods);
