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
interface ExpeditionCompletion {
  expedition: MeridianExpedition | null;
  factionUnlocked: FactionId | null;
}
interface ExpeditionCompletionDependencies {
  snapshotVictory: () => ExpeditionBattleSave;
  createEncounter: (depth: number, previousMap: BattlefieldId) => ExpeditionEncounter;
}
function createExpeditionResultProcessor() {
  const completed = new WeakSet<RunState>();
  return (profile: MeridianProfile, expedition: MeridianExpedition | null, state: RunState,
    win: boolean, deps: ExpeditionCompletionDependencies): ExpeditionCompletion | null => {
    if (completed.has(state) || (state.rules.kind === 'single-player' && state.rules.completed)) return null;
    let victoryWorld: ExpeditionWorld | undefined;
    if (win && expedition) {
      const recipe: ExpeditionBattleRecipe = JSON.parse(JSON.stringify({
        faction: expedition.faction, abilities: expedition.abilities, depth: expedition.depth,
        upgrades: expedition.upgrades, benefits: expedition.benefits, enemyBenefits: expedition.enemyBenefits,
        encounter: expedition.encounter
      }));
      victoryWorld = { stage: recipe.depth + 1, map: recipe.encounter.map, seed: recipe.encounter.seed,
        recipe, battle: deps.snapshotVictory() };
    }
    // Snapshot failure is retryable; a failure after progression begins is not.
    completed.add(state);
    let factionUnlocked: FactionId | null = null;
    if (win && expedition) {
      const previousUnlock = unlockedExpeditionFaction(profile.expeditionDepth);
      expedition.worlds ??= [];
      expedition.worlds.push(victoryWorld!);
      if(state.reinforcements?.units.length)
        (expedition.rescuedArmy ??= []).push(...state.reinforcements.units);
      expedition.depth++;
      if (expedition.depth > profile.expeditionDepth) profile.expeditionDepth = expedition.depth;
      const currentUnlock = unlockedExpeditionFaction(profile.expeditionDepth);
      if (currentUnlock > previousUnlock) factionUnlocked = currentUnlock;
      expedition.encounter = deps.createEncounter(expedition.depth, expedition.encounter.map);
      expedition.enemyBenefits = expedition.encounter.enemies.map(() => ({}));
      expedition.upgrades = {};
      expedition.benefits = {};
      expedition.battle = null;
    }
    return { expedition: win ? expedition : null, factionUnlocked };
  };
}
// One-way archive retirement. Presence of the stage makes this idempotent across UI retries.
function retireExpeditionOutpost(expedition: MeridianExpedition, stage: number, state: RunState): boolean {
  const world=expedition.worlds?.find(w=>w.stage===stage),out=state.outpost;
  if(!world?.recipe || !out?.finished || state.rules.kind!=='single-player' || !state.rules.completed ||
    state.depth+1!==stage || world.map!==state.map || world.seed!==state.seed)return false;
  const rescued=expedition.rescuedUpgrades ??= {upgrades:{},benefits:{}};
  for(const saved of out.evacuation?.upgrades || []) {
    const group=hasContentKey(BATTLE_UPGRADES,saved.upgrade)?rescued.upgrades:rescued.benefits;
    const max=hasContentKey(BATTLE_UPGRADES,saved.upgrade)?BATTLE_UPGRADES[saved.upgrade].max:
      expeditionBenefit(saved.upgrade)?.max ?? 999999;
    group[saved.upgrade]=Math.min(max,(group[saved.upgrade] || 0)+saved.level);
  }
  (expedition.rescuedArmy ??= []).push(...out.evacuation?.units || []);
  expedition.worlds=expedition.worlds!.filter(w=>w!==world);
  return true;
}
