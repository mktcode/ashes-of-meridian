/* Faction is the doctrine; depth only strengthens its execution. No encounter roll. */
'use strict';
const AI_RULES = Object.freeze({ think: 1, buildRetry: 3, contactLife: 90, buildingMemory: 300 });
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
