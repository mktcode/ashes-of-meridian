/* Expedition progression rules. No DOM, audio, storage or live-game dependency. */
'use strict';
function unlockedExpeditionFaction(depth: number): FactionId {
  let unlocked: FactionId = FACTION_ID.FIRST;
  for (let i = 1; i < FACTION_DEPTH_REQUIREMENTS.length; i++)
    if (depth >= FACTION_DEPTH_REQUIREMENTS[i]) unlocked = i as FactionId;
  return unlocked;
}
function createExpeditionEncounter(profile: MeridianProfile, depth = 0, previousMap?: BattlefieldId,
  random: () => number = Math.random): ExpeditionEncounter {
  const maps = availableBattlefields(), choices = contentKeys(MISSIONS)
    .filter(id => depth + 1 >= MISSIONS[id].firstStage)
    .flatMap(mission => MISSIONS[mission].maps.filter(map => maps.includes(map)).map(map => ({ mission, map }))),
    alternatives = choices.filter(choice => choice.map !== previousMap), pool = alternatives.length ? alternatives : choices;
  // Preserve faction → map → seed draws, with no extra mission draw.
  const enemies = expeditionEnemyFactions(depth, random), choice = pool[Math.floor(random() * pool.length)];
  return { ...choice, deployment: depth === 0 && profile.expeditionDepth === 0 && !profile.tutorialComplete ? 'resource-start' : 'exploration',
    enemies, seed: 1 + Math.floor(random() * 99999999) };
}
function createExpeditionBenefitOffers(expedition: MeridianExpedition) {
  return expeditionBenefitOffers(expedition.benefits, seeded(expedition.encounter.seed + expedition.depth * 7919));
}
function refreshExpeditionCivilization(profile: MeridianProfile, expedition: MeridianExpedition,
  live: RunState | null = null, activeStage: number | null = null): number {
  expedition.unlockedStage ??= expedition.depth + 1;
  expedition.civilizationScore = expeditionCivilizationScore(expedition, live, activeStage);
  if (expedition.civilizationScore >= civilizationScoreRequirement(expedition.depth + 1))
    expedition.unlockedStage = expedition.depth + 1;
  profile.lastCivilizationScore = expedition.civilizationScore;
  return expedition.civilizationScore;
}
interface ExpeditionCompletion {
  expedition: MeridianExpedition | null;
  evacuated: number;
  structures: number;
  recovered: number;
  civilizationTotal: number;
  civilizationStage: number | null;
  factionUnlocked: FactionId | null;
}
interface ExpeditionCompletionDependencies {
  snapshotVictory: () => ExpeditionBattleSave;
  createEncounter: (depth: number, previousMap: BattlefieldId) => ExpeditionEncounter;
  createBenefitOffers: (expedition: MeridianExpedition) => string[];
}
function createExpeditionResultProcessor() {
  // Battle identity owns exactly-once processing, never a presentation field.
  const completed = new WeakSet<RunState>();
  return (profile: MeridianProfile, expedition: MeridianExpedition | null, state: RunState,
    win: boolean, deps: ExpeditionCompletionDependencies): ExpeditionCompletion | null => {
    if (completed.has(state) || (state.rules.kind === 'single-player' && state.rules.completed)) return null;
    if (expedition) refreshExpeditionCivilization(profile, expedition, state);
    let victoryWorld: ExpeditionWorld | undefined;
    if (win && expedition) {
      const recipe: ExpeditionBattleRecipe = JSON.parse(JSON.stringify({
        faction: expedition.faction, abilities: expedition.abilities, depth: expedition.depth,
        benefits: expedition.benefits, enemyBenefits: expedition.enemyBenefits, encounter: expedition.encounter
      }));
      victoryWorld = { stage: recipe.depth + 1, map: recipe.encounter.map, seed: recipe.encounter.seed,
        recipe, battle: deps.snapshotVictory() };
    }
    // No automatic retry after payout/progression begins; callbacks may fail after mutation.
    completed.add(state);
    const level = Math.min(AETHER_EVACUATION_CAPS.length - 1, Math.max(0, Math.floor(state.parties[0].meta?.aetherEvacuation || 0))),
      evacuated = Math.min(AETHER_EVACUATION_CAPS[level], Math.max(0, Math.floor(state.parties[0].account.gas || 0))),
      structures = Math.max(0, Math.floor(state.stats?.structuresDestroyed || 0)) * AETHER_STRUCTURE_RECOVERY[level],
      recovered = evacuated + structures;
    if (recovered) profile.aether = Math.min(999999, profile.aether + recovered);
    let factionUnlocked: FactionId | null = null;
    if (win && expedition) {
      const previousUnlock = unlockedExpeditionFaction(profile.expeditionDepth);
      expedition.worlds ??= [];
      expedition.worlds.push(victoryWorld!);
      expedition.depth++;
      if (expedition.depth > profile.expeditionDepth) profile.expeditionDepth = expedition.depth;
      const currentUnlock = unlockedExpeditionFaction(profile.expeditionDepth);
      if (currentUnlock > previousUnlock) factionUnlocked = currentUnlock;
      expedition.encounter = deps.createEncounter(expedition.depth, expedition.encounter.map);
      expedition.enemyBenefits = advanceEnemyBenefits(expedition.enemyBenefits, expedition.encounter, expedition.depth);
      expedition.offers = deps.createBenefitOffers(expedition);
      expedition.battle = null;
    }
    const civilizationTotal = expedition ? refreshExpeditionCivilization(profile, expedition, state) : 0,
      civilizationStage = expedition?.unlockedStage ?? null;
    return { expedition: win ? expedition : null, evacuated, structures, recovered,
      civilizationTotal, civilizationStage, factionUnlocked };
  };
}
