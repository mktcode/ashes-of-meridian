/* Shared battle-start/return deliveries. High-water credits and pending arrivals belong to the snapshot. */
'use strict';
const UPGRADE_DELIVERIES: Readonly<Record<string, { resource?: 'alloy' | 'gas' | 'energy'; amount?: number; unit?: 'worker' | 'hero'; max?: number }>> = Object.freeze({
  startingAlloy: {resource:'alloy',amount:EXPEDITION_EFFECTS.alloy},
  aetherAllocation: {resource:'gas',amount:EXPEDITION_EFFECTS.aether},
  commandCapacitor: {resource:'energy',amount:EXPEDITION_EFFECTS.energy},
  startingWorkers: {unit:'worker',max:5},
  commanderMandate: {unit:'hero',max:1}
});
function creditUpgradeDeliveries(party: PartyState) {
  const delivery=party.upgradeDelivery;
  for(const [key,effect] of Object.entries(UPGRADE_DELIVERIES)) {
    const rank=Math.min(party.benefits[key] || 0,effect.max ?? 999999),
      previous=delivery.credited[key] || 0,delta=Math.max(0,rank-previous);
    if(!delta)continue;
    if(effect.resource) {
      party.account[effect.resource]+=delta*effect.amount!;
      if(effect.resource==='energy')party.account.energy=Math.min(COMMAND_ENERGY.max,party.account.energy);
    } else if(effect.unit==='worker')delivery.workers+=delta;
    else delivery.commander=true;
    delivery.credited[key]=rank;
  }
}
const upgradeMethods = {
  synchronizeCivilizationUpgrades(this: MeridianGame, totals: CivilizationUpgradeTotals) {
    const s=this.s;
    if(!s || s.rules.kind!=='single-player' || s.rules.completed || s.result || s.stopped || this.stepping)
      throw Error('Upgrade synchronization requires a restored active expedition battle');
    const party=this.party(0),cooldowns=party.loadout.map(kind=>[kind,this.abilityStats(kind).cd] as const);
    party.meta=Object.fromEntries(contentKeys(BATTLE_UPGRADES).flatMap(key=>{
      const rank=clamp(Math.floor(totals.upgrades[key] || 0),0,BATTLE_UPGRADES[key].max);
      return rank ? [[key,rank]] : [];
    }));
    party.benefits=normalizedBenefits(totals.benefits);
    for(const [kind,previous] of cooldowns){
      const remaining=Math.max(0,party.account.abilities[kind]-s.time),next=this.abilityStats(kind).cd;
      if(remaining && next!==previous)party.account.abilities[kind]=s.time+remaining*next/previous;
    }
    creditUpgradeDeliveries(party);
    this.deliverUpgradeUnits(0);
  },
  deliverUpgradeUnits(this: MeridianGame, team: PlayerTeam, initialHome?: Position) {
    const s=this.s!,party=this.party(team),delivery=party.upgradeDelivery;
    if(party.eliminated || (!delivery.workers && !delivery.commander))return;
    if(!initialHome && s.time<delivery.nextAttempt)return;
    // A live base/worker is an actual reachable anchor, not a historic terrain start site.
    const available=initialHome ? [initialHome] : this.alive(e=>e.team===team &&
      ((e.kind==='building' && e.type==='hq' && e.progress>=1) || (e.kind==='unit' && e.type==='worker')));
    // Rotate a bounded window, so blocked early anchors cannot starve later ones.
    const offset=initialHome ? 0 : Math.floor(s.time/3)*8%Math.max(1,available.length),
      anchors=Array.from({length:Math.min(8,available.length)},(_,i)=>available[(offset+i)%available.length]);
    const arrive=(type:'worker'|'hero'): boolean => {
      for(const home of anchors){
        const unit=initialHome
          ? this.spawnDeploymentUnit(type,{x:home.x-(type==='worker'?7:9),
              z:home.z+(type==='hero'?7:-4+((delivery.credited.startingWorkers || 0)-delivery.workers)*2)},home,team,party.faction)
          : this.spawnUpgradeReinforcement(type,home,team);
        if(unit)return true;
      }
      return false;
    };
    while(delivery.workers>0){
      if(!arrive('worker'))break;
      delivery.workers--;
    }
    if(delivery.commander){
      const existing=this.alive(e=>e.team===team && e.kind==='unit' && e.type==='hero').length>0,
        queued=this.alive(e=>e.team===team && e.kind==='building' && e.queue.some(q=>q.type==='hero')).length>0;
      if(existing || (!queued && arrive('hero')))delivery.commander=false;
    }
    delivery.nextAttempt=s.time+3;
    if(initialHome && (delivery.workers || delivery.commander))throw Error('No free space for upgrade deployment');
    if(!initialHome)this.rehash();
  },
  spawnUpgradeReinforcement(this: MeridianGame, type:'worker'|'hero', home: Position, team: PlayerTeam) {
    const world=this.world!,size=UNITS[type].size*UNIT_BODY_SCALE;
    // Bounded local probe, no path search and no random draw until a unit is actually spawned.
    const points: Position[]=[{x:home.x,z:home.z}];
    for(let radius=3;radius<=21;radius+=3)for(let i=0;i<16;i++){
      const angle=i*Math.PI/8;points.push({x:home.x+Math.cos(angle)*radius,z:home.z+Math.sin(angle)*radius});
    }
    for(const p of points)if(!world.blockedAt(p.x,p.z) && world.surface!.fits(p.x,p.z,size) &&
      world.surface!.segment(home,p,size) && this.unitFits({type,size:UNITS[type].size,...p},p.x,p.z))
      return this.spawnUnit(type,p.x,p.z,team,this.factionFor(team));
    return null;
  },
  healingFactor(this: MeridianGame, team: TeamId) {
    return team===-1 ? 1 : 1+(this.party(team).meta.fieldMedicine || 0)*CIVILIZATION_EFFECTS.medicine;
  }
};
type UpgradeMethods = typeof upgradeMethods;
interface MeridianGame extends UpgradeMethods {}
defineMeridianGameMethods(upgradeMethods);
