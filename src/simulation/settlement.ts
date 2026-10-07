/* Post-victory settlements. No combat/effect RNG; settlement timers/cursors are saved, delivery retries derived. */
'use strict';
const FORUM_SETTLEMENT = Object.freeze({ capacity: 2000, buildings: 60, radius: 60, interval: 10, corridorWidth: 5 });
type ForumServiceSite = Pick<BuildingEntity,'x'|'z'|'size'>;
interface ForumDeliveryAttempt {
  forum: BuildingEntity; version: number; nextTry: number; warned: boolean;
}
// Derived navigation scheduling, not entity/snapshot data. A restored/new world gets a fresh cache.
const forumDeliveries = new WeakMap<Battlefield,{
  workers: WeakMap<UnitEntity,ForumDeliveryAttempt>; searchAfter: number;
}>();
function forumServiceFree(world: Battlefield, p: Position, body: number): boolean {
  return !world.blockedAt(p.x,p.z) && (world.surface?.fits(p.x,p.z,body) ?? true);
}
function forumServiceHasGoal(world: Battlefield, area: NavigationArea, body: number): boolean {
  // Cheap local goal check only; connectivity is proved by one area path search.
  const cell=world.idx(area.x,area.z),column=cell%world.gridSize,row=Math.floor(cell/world.gridSize),r=Math.ceil(area.radius/world.cellSize);
  for(let z=Math.max(1,row-r);z<=Math.min(world.gridSize-2,row+r);z++)
    for(let x=Math.max(1,column-r);x<=Math.min(world.gridSize-2,column+r);x++) {
      const q=world.point(z*world.gridSize+x);
      if(distance(q,area)<=area.radius && forumServiceFree(world,q,body)) return true;
    }
  return false;
}
const SETTLEMENT_TYPES: readonly (readonly BuildingType[])[] = [
  ['embercottage', 'fieldlab'], ['terracecommons', 'researchhub'], ['hearthtower', 'researchspire']
];
function forumBuildingTarget(forum: BuildingEntity): number {
  return Math.floor(clamp(forum.cinderStock || 0, 0, FORUM_SETTLEMENT.capacity) / FORUM_SETTLEMENT.capacity * FORUM_SETTLEMENT.buildings);
}
function forumCorridors(forum: BuildingEntity, plazaRadius = forum.size + 2.5 + FORUM_SETTLEMENT.corridorWidth / 2): Position[][] {
  const yaw = buildingVisualYaw(forum), cs = Math.cos(yaw), sn = Math.sin(yaw),
    radius = FORUM_SETTLEMENT.radius, half = FORUM_SETTLEMENT.corridorWidth / 2, reach = radius + 6;
  // Three parallel streets and one cross-axis cut the circle into eight parcels.
  const streets = [-radius/2,0,radius/2].map(x => {
    const length = Math.sqrt(radius*radius-x*x) + 6;
    return [[x-half,-length],[x+half,-length],[x+half,length],[x-half,length]];
  });
  streets.push([[-reach,-half],[reach,-half],[reach,half],[-reach,half]]);
  // The default round plaza protects delivery entries and connects the street arms.
  // Presentation may use a tighter contour without reducing this navigation reserve.
  streets.push(Array.from({length:64}, (_,i) => {
    const angle = i*Math.PI*2/64;
    return [Math.cos(angle)*plazaRadius,Math.sin(angle)*plazaRadius];
  }));
  return streets.map(polygon => polygon.map(([x,z]) =>
    ({x:forum.x+x*cs+z*sn,z:forum.z-x*sn+z*cs})));
}
function settlementFootprints(p: Position, type: BuildingType, team: PlayerTeam, rotation = 0): Position[][] {
  return type === 'meridianforum' ? civilizationClearanceFootprints(p, type, team, rotation) :
    settlementReservedFootprints(p, type, team, rotation);
}
// The actual navigation blocker is a rasterized circle, not only the authored decks.
function forumCorridorBlocked(forum: BuildingEntity, p: Position, radius: number, shapes: Position[][] = []): boolean {
  const square = [{x:p.x-radius,z:p.z-radius},{x:p.x+radius,z:p.z-radius},
    {x:p.x+radius,z:p.z+radius},{x:p.x-radius,z:p.z+radius}];
  return forumCorridors(forum).some(c => civilizationFootprintsOverlap(c, square) || shapes.some(s => civilizationFootprintsOverlap(c,s)));
}
function settlementBuildingType(_radius: number, _roll: number, variant: number): BuildingType {
  return SETTLEMENT_TYPES[0][variant < .5 ? 0 : 1];
}
const settlementMethods = {
  settlementUpgradeBuilding(this: MeridianGame, id: number, team: PlayerTeam): BuildingEntity | null {
    const s = this.s, b = this.get(id);
    if (!s || s.result || s.stopped || s.rules.kind !== 'single-player' || !s.rules.completed ||
      b?.kind !== 'building' || !isCivilizationBuildingType(b.type) || b.type === 'meridianforum' ||
      b.team !== team || b.hp <= 0 || b.progress < 1 ||
      b.forumId === undefined || b.settlementAt !== undefined) return null;
    const forum = this.get(b.forumId);
    return forum?.kind === 'building' && forum.type === 'meridianforum' && forum.team === team &&
      forum.hp > 0 && forum.progress >= 1 ? b : null;
  },
  settlementUpgradeReason(this: MeridianGame, id: number, upgrade: CivilizationUpgradeType | null, team: PlayerTeam = 0): string {
    const b = this.settlementUpgradeBuilding(id, team);
    if (!b) return 'Select a completed civilian building in a supplied, cleared world.';
    if (upgrade !== null && !hasContentKey(CIVILIZATION_UPGRADES, upgrade)) return 'Unknown upgrade effect.';
    if (upgrade !== null && !civilizationUpgradeAllowed(b.type, upgrade)) return 'This effect belongs to the other civilian building family.';
    if (upgrade !== null && !b.upgradeLevel && this.account(team).gas < CIVILIZATION_UPGRADE_COSTS[0]) return 'Not enough Echo.';
    return '';
  },
  configureSettlementUpgrade(this: MeridianGame, id: number, upgrade: CivilizationUpgradeType | null, team: PlayerTeam = 0): boolean {
    const reason = this.settlementUpgradeReason(id, upgrade, team);
    if (reason) { this.notify(team, 'toast', reason); return false; }
    const b = this.settlementUpgradeBuilding(id, team)!;
    if (upgrade === null) delete b.upgrade;
    else {
      if (!b.upgradeLevel) {
        if (!this.spend({cost:0, gas:CIVILIZATION_UPGRADE_COSTS[0]}, team)) return false;
        b.upgradeLevel = 1;
      }
      b.upgrade = upgrade;
    }
    return true;
  },
  settlementExpansionReason(this: MeridianGame, id: number, team: PlayerTeam = 0): string {
    const b = this.settlementUpgradeBuilding(id, team);
    if (!b) return 'Select a completed civilian building in a supplied, cleared world.';
    if (!b.upgrade || !b.upgradeLevel) return 'Choose an upgrade effect first.';
    if (!civilizationUpgradeAllowed(b.type, b.upgrade)) return 'Choose an effect available for this building family first.';
    if (b.upgradeLevel >= 3) return 'This building is fully expanded.';
    if (this.account(team).gas < CIVILIZATION_UPGRADE_COSTS[b.upgradeLevel]) return 'Not enough Echo.';
    return '';
  },
  expandSettlementBuilding(this: MeridianGame, id: number, team: PlayerTeam = 0): boolean {
    const reason = this.settlementExpansionReason(id, team);
    if (reason) { this.notify(team, 'toast', reason); return false; }
    const b = this.settlementUpgradeBuilding(id, team)!, level = b.upgradeLevel!;
    if (!this.spend({cost:0, gas:CIVILIZATION_UPGRADE_COSTS[level]}, team)) return false;
    const health = clamp(b.hp / b.maxHp, 0, 1);
    b.upgradeLevel = level + 1;
    b.type = civilizationBuildingAtTier(b.type, b.upgradeLevel);
    b.maxHp = BUILDINGS[b.type].hp;
    b.hp = b.maxHp * health;
    // The maximal footprint was already reserved; expansion changes no navigation or RNG.
    return true;
  },
  deliveryTarget(this: MeridianGame, e: UnitEntity): BuildingEntity | null {
    const b = e.deliveryForum === undefined ? null : this.get(e.deliveryForum);
    return b?.kind === 'building' && b.type === 'meridianforum' && b.team === e.team && b.progress >= 1 ? b : null;
  },
  canSupplyForum(this: MeridianGame, target: Entity | null, team: PlayerTeam): target is BuildingEntity {
    return !!this.s && !this.s.result && !this.s.stopped && this.s.rules.kind === 'single-player' &&
      !!this.s.rules.completed && target?.kind === 'building' && target.type === 'meridianforum' &&
      target.hp > 0 && target.team === team && target.progress >= 1;
  },
  forumServiceArea(this: MeridianGame, forum: ForumServiceSite): NavigationArea {
    // Same ground work area as construction; the foundation still blocks its interior.
    // Model entrances/rotation do not restrict which side may receive a delivery.
    return {x:forum.x,z:forum.z,radius:forum.size+2.9,terrainConnection:false};
  },
  forumRoute(this: MeridianGame, worker: UnitEntity, forum: ForumServiceSite): NavigationPath | null {
    const world=this.world!,body=worker.size*UNIT_BODY_SCALE,area=this.forumServiceArea(forum);
    if(distance(worker,area)<=area.radius && forumServiceFree(world,worker,body))
      return {status:'complete',points:[],goal:{x:worker.x,z:worker.z}};
    const preferred=this.workerDropoff(worker,forum);
    if(!(distance(preferred,area)<=area.radius && forumServiceFree(world,preferred,body)) &&
      !forumServiceHasGoal(world,area,body)) return null;
    const path=world.path(worker.x,worker.z,preferred.x,preferred.z,false,area,body);
    return path.status==='complete' ? {...path,goal:path.goal || preferred} : null;
  },
  forumDropoff(this: MeridianGame, worker: UnitEntity, forum: ForumServiceSite): Position | null {
    return this.forumRoute(worker,forum)?.goal || null;
  },
  forgetForumDelivery(this: MeridianGame, worker: UnitEntity) {
    if(this.world) forumDeliveries.get(this.world)?.workers.delete(worker);
  },
  forumDeliveryPoint(this: MeridianGame, worker: UnitEntity, forum: BuildingEntity): Position | null {
    const world=this.world!,now=this.s!.time,body=worker.size*UNIT_BODY_SCALE;
    let cache=forumDeliveries.get(world);
    if(!cache) {
      cache={workers:new WeakMap(),searchAfter:0};forumDeliveries.set(world,cache);
    }
    let attempt=cache.workers.get(worker);
    const fresh=!attempt,changed=attempt && (attempt.forum!==forum || attempt.version!==world.pathVersion);
    if(!attempt || changed) {
      attempt={forum,version:world.pathVersion,nextTry:0,warned:attempt?.warned || false};
      cache.workers.set(worker,attempt);
    }
    const area=this.forumServiceArea(forum),point=worker.deliveryPoint,
      valid=point && distance(point,area)<=area.radius && forumServiceFree(world,point,body),
      failedRoute=worker.pathStatus!==undefined && worker.pathStatus!=='complete' && now>=worker.nextPath;
    // Preserve a restored complete route, but never trust a stale/blocked saved goal.
    if(valid && !changed && !failedRoute && (!fresh ||
      (worker.pathStatus==='complete' && worker.pathVersion===world.pathVersion))) return point;
    if(point) {
      delete worker.deliveryPoint;worker.path=[];worker.nextPath=0;
      attempt.nextTry=0;
    }
    if(now<attempt.nextTry) return null;
    const here=distance(worker,area)<=area.radius && forumServiceFree(world,worker,body);
    if(!here && now<cache.searchAfter) return null;
    // At most one search over the whole area per retry, staggered across workers.
    if(!here) cache.searchAfter=now+.25;
    const route=this.forumRoute(worker,forum);
    if(route?.goal) {
      const goal=route.goal;
      worker.deliveryPoint=goal;
      worker.path=route.points;worker.pi=0;worker.pathStatus=route.status;worker.pathResolvedGoal=route.goal;
      worker.pathGoal={...goal};worker.pathArea=area;
      worker.pathVersion=world.pathVersion;worker.nextPath=now+Math.min(3.2,.8*(1+(worker.recoveryAttempts || 0)));
      delete worker.steerLocked;
      attempt.warned=false;
      return route.goal;
    }
    attempt.nextTry=now+3.2;
    if(!attempt.warned) {
      this.notify(worker.team as PlayerTeam,'toast','No complete Forum delivery route found yet. Cargo stays with the Worker; clear an approach or relocate the Forum.');
      attempt.warned=true;
    }
    return null;
  },
  settlementPlacementReason(this: MeridianGame, type: BuildingType, p: Position, team: PlayerTeam): string {
    const world = this.world!, r = settlementReservedRadius(type),
      reason = Math.abs(p.x) > world.extent - 1 - r || Math.abs(p.z) > world.extent - 1 - r
        ? 'Too close to the battlefield boundary.' : buildingFoundationReason(world,type,p,team);
    if (reason) return reason;
    if (!world.sight[team].explored[world.idx(p.x,p.z)]) return 'Scout this location before building.';
    if (buildingTerrainObstructed(world,p,r,true)) return 'Terrain obstructs the foundation.';
    if (this.s!.supplyCaches.some(c => !c.collected && distance(c,p)<r+3)) return 'Recover nearby supply caches before building here.';
    for (const e of this.s!.entities) {
      const reason = buildingBlockerReason(p,r,e,type,team);
      if (reason) return reason;
    }
    return this.forumAccessReason(p,r,undefined,type,team);
  },
  forumAccessReason(this: MeridianGame, p: Position, radius: number, except?: number, type?: BuildingType, team: PlayerTeam = 0, rotation = 0): string {
    // Half a cell protects the raster edges too. Overlapping settlements share these exclusions.
    for (const e of this.s!.entities) if (e.hp > 0 && e.kind === 'building' && e.type === 'meridianforum' && e.id !== except &&
      forumCorridorBlocked(e,p,radius+.35+this.world!.cellSize/2,
        type && isCivilizationBuildingType(type) ? settlementFootprints(p,type,team,rotation) : [])) return 'Leave the forum streets and entrance plaza clear.';
    return '';
  },
  refreshSettlementLayouts(this: MeridianGame) {
    const s = this.s!;
    if (s.rules.kind !== 'single-player' || !s.rules.completed) return;
    for (const b of s.entities) if (b.hp > 0 && b.kind === 'building' && b.forumId !== undefined) {
      const forum = this.get(b.forumId);
      if (forum?.kind !== 'building' || forum.type !== 'meridianforum' || forum.team !== b.team || forum.progress < 1) continue;
      const invalid = distance(b,forum) > FORUM_SETTLEMENT.radius ||
        !!this.forumAccessReason(b,b.size,undefined,b.type,b.team as PlayerTeam,b.visualRotation || 0);
      if (invalid) b.settlementAt ??= s.time + FORUM_SETTLEMENT.interval;
      else delete b.settlementAt;
    }
  },
  growSettlement(this: MeridianGame, forum: BuildingEntity): boolean {
    // Sample the whole area without radial bands or angular slots; retry later if space changes.
    const random = seeded(this.s!.seed ^ Math.imul(forum.id,0x45d9f3b) ^ Math.imul(forum.settlementAttempt || 0,0x27d4eb2d));
    for (let i=0;i<32;i++) {
      const attempt = forum.settlementAttempt || 0;
      forum.settlementAttempt = (attempt + 1) % 1000000;
      const radius = 18 + (FORUM_SETTLEMENT.radius - 18) * random(),
        angle = random() * Math.PI*2 + buildingVisualYaw(forum),
        p = {x:forum.x+Math.sin(angle)*radius,z:forum.z+Math.cos(angle)*radius},
        type = settlementBuildingType(radius,random(),random());
      if (this.settlementPlacementReason(type,p,forum.team as PlayerTeam)) continue;
      const b = this.spawnBuilding(type,p.x,p.z,forum.team as PlayerTeam,forum.faction,
        {progress:.06,paid:{cost:0,gas:0},forumId:forum.id,size:settlementReservedRadius(type)});
      b.hp = b.maxHp * b.progress;
      this.world!.rebuild(this.s!.entities);
      return true;
    }
    return false;
  },
  updateSettlements(this: MeridianGame, dt = 0) {
    const s = this.s!;
    if (s.rules.kind !== 'single-player' || !s.rules.completed) return;
    const forums = s.entities.filter((e): e is BuildingEntity => e.hp > 0 && e.kind === 'building' && e.type === 'meridianforum' && e.progress >= 1);
    const groups = new Map<number,BuildingEntity[]>();
    for (const e of s.entities) if (e.hp > 0 && e.kind === 'building' && e.forumId !== undefined) {
      const group = groups.get(e.forumId) || [];
      group.push(e); groups.set(e.forumId,group);
    }
    // Check on layout actions, growth beats and expiring deadlines, not every tick.
    if (forums.some(e => e.settlementAt === undefined || s.time >= e.settlementAt ||
      groups.get(e.id)?.some(b => b.settlementAt !== undefined && s.time >= b.settlementAt))) this.refreshSettlementLayouts();
    let removed = false;
    for (const [owner,buildings] of groups) {
      const forum = this.get(owner);
      if (forum?.kind === 'building' && forum.type === 'meridianforum' && forum.team === buildings[0].team) {
        if (forum.progress >= 1) for (const b of buildings) {
          if (b.settlementAt !== undefined) {
            if (s.time >= b.settlementAt) { b.hp = 0; b.deathAt = s.time; removed = true; }
          } else this.advanceConstruction(b,dt);
        }
        continue;
      }
      const first = buildings[0];
      if (first.settlementAt === undefined) first.settlementAt = s.time + FORUM_SETTLEMENT.interval;
      if (s.time < first.settlementAt) continue;
      first.hp = 0; first.deathAt = s.time;
      if (buildings[1]) buildings[1].settlementAt = s.time + FORUM_SETTLEMENT.interval;
      removed = true;
    }
    if (removed) this.world!.rebuild(s.entities);
    for (const e of forums) {
      e.settlementAt ??= s.time + FORUM_SETTLEMENT.interval;
      if (s.time < e.settlementAt) continue;
      e.settlementAt = s.time + FORUM_SETTLEMENT.interval;
      if ((groups.get(e.id)?.filter(b => b.hp > 0).length || 0) < forumBuildingTarget(e)) this.growSettlement(e);
    }
  }
};
type SettlementMethods = typeof settlementMethods;
interface MeridianGame extends SettlementMethods {}
defineMeridianGameMethods(settlementMethods);
