/* Faction is the doctrine; depth only strengthens its execution. No encounter roll. */
'use strict';
// Designer knobs, in simulation seconds. These are not resource/combat bonuses.
const AI_TUNING = {
  depthPerTier: 4, maxTier: 4,
  decisionSeconds: [1.5, 1], reactionSeconds: [1, .6],
  attackWaitReduction: 5, forceRatio: [1.15, .99],
  scoutSeconds: [15, 7], searchPartySize: 3, recoverySeconds: [30, 18],
  stalledSeconds: 45, targetCommitSeconds: 12, targetSwitchMargin: 40,
  finishWaitSeconds: 8, finishBonus: 100,
  targetRadius: 25, failedGoalSeconds: 90,
  retreatLossRatio: .45, retreatPowerRatio: .5
} as const;
// Hard floors apply even if tuning endpoints are made more aggressive.
const AI_RULES = Object.freeze({ minReaction: .6, minDecision: 1,
  buildRetry: 3, contactLife: 90, buildingMemory: 300 });
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
  const doctrine = AI_DOCTRINES[faction], tuning = AI_TUNING,
    stage = clamp(Math.floor((Number(depth) || 0) / tuning.depthPerTier), 0, tuning.maxTier),
    blend = (ends: readonly [number, number]) => ends[0] + (ends[1] - ends[0]) * stage / tuning.maxTier,
    reactionDelay = Math.max(AI_RULES.minReaction, blend(tuning.reactionSeconds));
  return { ...doctrine, stage, workers: doctrine.workers + stage,
    reactionDelay, think: Math.max(AI_RULES.minDecision, reactionDelay, blend(tuning.decisionSeconds)),
    attackWait: Math.max(30, doctrine.attackWait - stage * tuning.attackWaitReduction),
    scoutInterval: blend(tuning.scoutSeconds),
    forceRatio: blend(tuning.forceRatio), recoveryTime: blend(tuning.recoverySeconds),
    build: [...doctrine.build, ...(stage >= 2 ? [doctrine.extra] : []),
      ...(stage >= 4 ? [doctrine.extra] : [])] as BuildingType[] };
}
