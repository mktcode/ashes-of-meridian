/* Post-victory settlements. No draws from combat/effect RNG; all timers/cursors are saved. */
'use strict';
const FORUM_SETTLEMENT = Object.freeze({ capacity: 2000, buildings: 60, radius: 60, interval: 10, corridorWidth: 5 });
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
  return civilizationClearanceFootprints(p, type, team, rotation);
}
// The actual navigation blocker is a rasterized circle, not only the authored decks.
function forumCorridorBlocked(forum: BuildingEntity, p: Position, radius: number, shapes: Position[][] = []): boolean {
  const square = [{x:p.x-radius,z:p.z-radius},{x:p.x+radius,z:p.z-radius},
    {x:p.x+radius,z:p.z+radius},{x:p.x-radius,z:p.z+radius}];
  return forumCorridors(forum).some(c => civilizationFootprintsOverlap(c, square) || shapes.some(s => civilizationFootprintsOverlap(c,s)));
}
function settlementBuildingType(radius: number, roll: number, variant: number): BuildingType {
  const outer = clamp((radius - 18) / (FORUM_SETTLEMENT.radius - 18), 0, 1),
    // Mid-rise keeps a substantial share throughout; towers give way to cottages outward.
    small = .1 + .5 * outer, large = .5 * (1 - outer),
    tier = roll < small ? 0 : roll < small + large ? 2 : 1;
  return SETTLEMENT_TYPES[tier][variant < .5 ? 0 : 1];
}
const settlementMethods = {
  deliveryTarget(this: MeridianGame, e: UnitEntity): BuildingEntity | null {
    const b = e.deliveryForum === undefined ? null : this.get(e.deliveryForum);
    return b?.kind === 'building' && b.type === 'meridianforum' && b.team === e.team && b.progress >= 1 ? b : null;
  },
  canSupplyForum(this: MeridianGame, target: Entity | null, team: PlayerTeam): target is BuildingEntity {
    return !!this.s && !this.s.result && !this.s.stopped && this.s.rules.kind === 'single-player' &&
      !!this.s.rules.completed && target?.kind === 'building' && target.type === 'meridianforum' &&
      target.hp > 0 && target.team === team && target.progress >= 1;
  },
  forumServicePoints(this: MeridianGame, forum: BuildingEntity): Position[] {
    const yaw = buildingVisualYaw(forum), cs = Math.cos(yaw), sn = Math.sin(yaw), radius = forum.size + 2.5;
    return civilizationBuildingEntries('meridianforum').map(entry => {
      const a = Math.atan2(entry.x, entry.z), x = Math.sin(a)*radius, z = Math.cos(a)*radius;
      const p = {x:forum.x+x*cs+z*sn,z:forum.z-x*sn+z*cs};
      // A sub-cell service area may contain no A* goal when the route needs a detour.
      return this.world!.point(this.world!.idx(p.x,p.z));
    });
  },
  forumDropoff(this: MeridianGame, worker: UnitEntity, forum: BuildingEntity): Position | null {
    const world = this.world!, body = worker.size * UNIT_BODY_SCALE;
    for (const p of this.forumServicePoints(forum).sort((a,b) => distance(worker,a)-distance(worker,b))) {
      const area: NavigationArea = {...p,radius:1.2,terrainConnection:false};
      const path = world.path(worker.x,worker.z,p.x,p.z,false,area,body);
      if (path.status === 'complete') return path.goal || p;
    }
    return null;
  },
  settlementPlacementReason(this: MeridianGame, type: BuildingType, p: Position, team: PlayerTeam): string {
    const world = this.world!, r = BUILDINGS[type].size,
      reason = buildingFoundationReason(world,type,p,team);
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
  forumAccessReason(this: MeridianGame, p: Position, radius: number, except?: number, type?: BuildingType, team: PlayerTeam = 0): string {
    // Half a cell protects the raster edges too. Overlapping settlements share these exclusions.
    for (const e of this.s!.entities) if (e.hp > 0 && e.kind === 'building' && e.type === 'meridianforum' && e.id !== except &&
      forumCorridorBlocked(e,p,radius+.35+this.world!.cellSize/2,
        type && isCivilizationBuildingType(type) ? settlementFootprints(p,type,team) : [])) return 'Leave the forum streets and entrance plaza clear.';
    return '';
  },
  forumRotationReason(this: MeridianGame, forum: BuildingEntity, rotation: number): string {
    const next = {...forum,visualRotation:rotation}, shapes = settlementFootprints(next,next.type,next.team as PlayerTeam,rotation);
    for (const e of this.s!.entities) if (e.hp > 0 && e.kind !== 'unit' && e.id !== forum.id) {
      if (e.kind === 'building' && isCivilizationBuildingType(e.type)) {
        const other = settlementFootprints(e,e.type,e.team as PlayerTeam,e.visualRotation || 0);
        if (shapes.some(a => other.some(b => civilizationFootprintsOverlap(a,b)))) return 'Leave room for forum stairs.';
      }
      if (forumCorridorBlocked(next,e,e.size+.35+this.world!.cellSize/2,
        e.kind === 'building' && isCivilizationBuildingType(e.type) ? settlementFootprints(e,e.type,e.team as PlayerTeam,e.visualRotation || 0) : [])) return 'Rotation would block a forum street or entrance plaza.';
    }
    return '';
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
        {progress:.06,paid:{cost:0,gas:0},forumId:forum.id});
      b.hp = b.maxHp * b.progress;
      this.world!.rebuild(this.s!.entities);
      return true;
    }
    return false;
  },
  updateSettlements(this: MeridianGame, dt = 0) {
    const s = this.s!;
    if (s.rules.kind !== 'single-player' || !s.rules.completed) return;
    const groups = new Map<number,BuildingEntity[]>();
    for (const e of s.entities) if (e.hp > 0 && e.kind === 'building' && e.forumId !== undefined) {
      const group = groups.get(e.forumId) || [];
      group.push(e); groups.set(e.forumId,group);
    }
    for (const e of [...s.entities]) if (e.hp > 0 && e.kind === 'building' && e.type === 'meridianforum' && e.progress >= 1) {
      if (e.settlementAt === undefined) e.settlementAt = s.time + FORUM_SETTLEMENT.interval;
      if (s.time < e.settlementAt) continue;
      e.settlementAt = s.time + FORUM_SETTLEMENT.interval;
      if ((groups.get(e.id)?.length || 0) < forumBuildingTarget(e)) this.growSettlement(e);
    }
    for (const [owner,buildings] of groups) {
      const forum = this.get(owner);
      if (forum?.kind === 'building' && forum.type === 'meridianforum' && forum.team === buildings[0].team) {
        if (forum.progress >= 1) for (const b of buildings) this.advanceConstruction(b,dt);
        continue;
      }
      const first = buildings[0];
      if (first.settlementAt === undefined) first.settlementAt = s.time + FORUM_SETTLEMENT.interval;
      if (s.time < first.settlementAt) continue;
      first.hp = 0; first.deathAt = s.time;
      if (buildings[1]) buildings[1].settlementAt = s.time + FORUM_SETTLEMENT.interval;
      this.world!.rebuild(s.entities);
    }
  }
};
type SettlementMethods = typeof settlementMethods;
interface MeridianGame extends SettlementMethods {}
defineMeridianGameMethods(settlementMethods);
