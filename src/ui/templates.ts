/* Pure screen markup. No DOM, persistence, RNG or UI state changes. */
'use strict';

function renderAbilityLoadout(loadout: readonly AbilityType[], profile?: MeridianProfile): string {
  return `<div class="loadout-summary"><span>COMMAND LOADOUT</span>${loadout.map((key, index) => {
    const ability = ABILITIES[key], rank = profile?.upgrades[key] || 0;
    return `<b title="${esc(ability.desc)}"><i>${index + 1}</i>${uiIcon(ability.icon)}${esc(ability.name)}${profile ? ` · R${rank}` : ''}</b>`;
  }).join('')}</div>`;
}

function renderWorldDesign(world: Battlefield | null): string {
  if (!world) return '';
  const hour = world.renderProfile.atmosphere?.timeOfDay,
    minutes = hour === undefined ? null : Math.floor(hour * 60),
    clock = minutes === null ? '' : ` · ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const ecology=world.renderProfile.ecology,variation=world.renderProfile.variation;
  return `<p class="muted">${esc(world.definition.name)}${variation?` · ${esc(variation.name)}`:''}${ecology?` · ${esc(ecology.biome.toUpperCase())} / ${esc(ecology.weather.toUpperCase())}`:''} · LANDSCAPE ${world.terrainSeed}${world.definition.design?.terrainSeed !== undefined ? ' · FIXED DESIGN' : ''}${clock}<br>${world.extent * 2} × ${world.extent * 2} m · BATTLE SEED ${world.seed}</p>`;
}

function renderMissionBriefing(id: MissionId): string {
  const mission = MISSIONS[id];
  return `<p title="${esc(mission.objective)}"><b>${esc(mission.name)}</b> · ${esc(mission.briefing ?? mission.objective)}</p>`;
}

function renderExpeditionOpponents(expedition: MeridianExpedition): string {
  return `<div class="opponent-list">${expedition.encounter.enemies.map((id, slot) => {
    const faction = FACTIONS[id], perks = Object.entries(expedition.enemyBenefits[slot]).filter(([, count]) => count > 0)
      .map(([key, count]) => `${esc(expeditionBenefit(key)!.name)} ×${count}`).join(' · '),
      abilities = FACTION_ABILITY_LOADOUTS[id].map(key => ABILITIES[key].name).join(' · '),
      color = `#${faction.color.toString(16).padStart(6, '0')}`;
    return `<div class="opponent-card" style="--opponent-color:${color}"><span class="opponent-sigil" aria-hidden="true">${esc(faction.sigil)}</span><span class="opponent-copy"><span class="opponent-label">OPPONENT ${slot + 1}</span><strong>${esc(faction.short)}</strong><small>UPGRADES · ${perks || 'NONE'}</small><small>COMMAND · ${esc(abilities)}</small></span></div>`;
  }).join('')}</div>`;
}

function expeditionProgressText(expedition: MeridianExpedition): string {
  const unlocked = expeditionStageUnlocked(expedition), stage = expedition.depth + (unlocked ? 2 : 1),
    required = civilizationScoreRequirement(stage), score = expedition.civilizationScore || 0;
  const requirement = Number.isFinite(required)
    ? `${required.toLocaleString('en-US')} REQUIRED · ${Math.max(0, required - score).toLocaleString('en-US')} MORE`
    : 'SCORE REQUIREMENT EXCEEDS SUPPORTED RANGE';
  return `STAGE ${stage} · ${requirement} · ${unlocked ? 'MILITARY VICTORY ALSO REQUIRED' : 'BUILD IN ANY CLEARED WORLD'}`;
}

function renderCivilizationScore(score: number, stage: number | null, note: string, ready = false): string {
  const required = stage === null ? Infinity : civilizationScoreRequirement(stage), hasTarget = Number.isFinite(required),
    value = score.toLocaleString('en-US'), target = required.toLocaleString('en-US'),
    progress = ready || required === 0 ? 1 : hasTarget ? Math.min(1, score / required) : 0;
  return `<section class="civilization-score${ready ? ' stage-ready' : ''}" aria-label="Civilization Score">
    <span>CIVILIZATION SCORE</span><div class="civilization-amount"><strong>${value}</strong>${hasTarget ? `<span>/ ${target}</span>` : ''}</div>
    ${hasTarget ? `<div class="civilization-progress" role="progressbar" aria-label="Civilization Score toward Stage ${stage}" aria-valuemin="0" aria-valuemax="${required}" aria-valuenow="${ready ? required : Math.min(score, required)}" aria-valuetext="${ready ? `Stage ${stage} unlocked; ${value} current points` : `${value} of ${target} points`}"><i aria-hidden="true" style="width:${progress * 100}%"></i></div>` : ''}
    <small>${esc(note)}</small>
  </section>`;
}

function renderVictoryCivilizationScore(expedition: MeridianExpedition): string {
  const score = expedition.civilizationScore || 0, stage = expedition.depth + 1,
    required = civilizationScoreRequirement(stage), ready = expeditionStageUnlocked(expedition),
    note = ready ? `✓ STAGE ${stage} UNLOCKED · SCORE IS NOT SPENT` : Number.isFinite(required)
      ? `STAGE ${stage} · ${Math.max(0, required - score).toLocaleString('en-US')} MORE · BUILD IN ANY CLEARED WORLD`
      : 'NEXT TARGET EXCEEDS SUPPORTED SCORE RANGE';
  return renderCivilizationScore(score, stage, note, ready);
}

function renderHomeCivilizationScore(expedition: MeridianExpedition | null, lastScore: number): string {
  const score = expedition ? expedition.civilizationScore || 0 : lastScore;
  let stage = expedition ? Math.max(2, (expedition.unlockedStage ?? expedition.depth + 1) + 1) : 2,
    required = expedition ? civilizationScoreRequirement(stage) : Infinity;
  while (score >= required && Number.isFinite(required)) required = civilizationScoreRequirement(++stage);
  const note = !expedition ? 'LAST EXPEDITION' : Number.isFinite(required)
    ? `TARGET · STAGE ${stage} · ${(required - score).toLocaleString('en-US')} MORE` : 'NEXT TARGET EXCEEDS SUPPORTED SCORE RANGE';
  return renderCivilizationScore(score, expedition ? stage : null, note);
}

function renderHomeScreen(expedition: MeridianExpedition | null, hasPreviousStage = false, stageMapName = '', lastCivilizationScore = 0) {
  return `<div class="home-screen"><div class="home-layout">
            <div class="menu-main">
              <h1 class="menu-brand" aria-label="Ashes of Meridian"><span class="menu-emblem" aria-hidden="true"></span><span class="logo-ashes" aria-hidden="true"></span><span class="logo-of" aria-hidden="true"></span><span class="logo-meridian" aria-hidden="true"></span></h1>
              ${expedition ? `<section class="expedition-stage" aria-label="Expedition stage selection" aria-busy="false"><span class="stage-label">CHECKPOINT</span><div class="stage-navigation"><button class="stage-arrow previous" data-ui="previousStage" aria-label="Select previous stage"${hasPreviousStage ? '' : ' disabled'}><svg viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path class="trailing-chevron" d="M4 4 L13 18 L4 32"/><path d="M17 4 L26 18 L17 32"/></svg></button><div class="stage-crystal"><strong>${expedition.depth + 1}</strong></div><button class="stage-arrow next" data-ui="nextStage" aria-label="Select next stage" disabled><svg viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path class="trailing-chevron" d="M4 4 L13 18 L4 32"/><path d="M17 4 L26 18 L17 32"/></svg></button></div><div class="stage-caption" aria-live="polite" aria-atomic="true"><span class="stage-map">${esc(stageMapName)}</span><small class="stage-status">CURRENT · LANDSCAPE PREVIEW</small></div></section>` : ''}
              <div class="menu-actions">
                ${renderHomeCivilizationScore(expedition, lastCivilizationScore)}
                <div class="menu-buttons">
                  ${expedition ? `<div class="continue-row"><button class="primary" data-ui="enterSelectedStage" title="${expedition.battle ? 'Restore saved battle' : `Continue at stage ${expedition.depth + 1}`}">Continue expedition <span aria-hidden="true">→</span></button><button class="secondary expedition-perks-button" data-ui="expeditionBenefits" aria-label="View current expedition" title="Current expedition"><span class="menu-icon expedition-icon" aria-hidden="true"></span></button></div>` : ''}
                  <button class="${expedition ? 'secondary' : 'primary'}" data-ui="battle">New expedition <span aria-hidden="true">→</span></button>
                  <button class="secondary" data-ui="armory">Fleet upgrades <span aria-hidden="true">→</span></button>
                  <button class="secondary" data-ui="codex">Codex · Units &amp; Buildings <span aria-hidden="true">→</span></button>
                  <button class="secondary" data-ui="settings">Settings <span aria-hidden="true">→</span></button>
                </div>
              </div>
            </div>
          </div></div>`;
}

function renderBattleScreen(profile: MeridianProfile, selectedFaction: FactionId, unlockedFaction: FactionId,
  startingAlloy: number, loadout: readonly AbilityType[]) {
  return `<div class="subscreen command-setup"><header class="sub-header"><div><div class="eyebrow">NEW EXPEDITION</div><h1>Choose your command.</h1></div><button class="textbtn" data-ui="home">${uiIcon('back')}MAIN MENU</button></header><div class="command-setup-body"><div class="faction-options">${FACTIONS.map((f, i) => { const unlocked = i <= unlockedFaction, requirement = FACTION_DEPTH_REQUIREMENTS[i]; return `<button class="faction-option${selectedFaction === i ? ' active' : ''}${unlocked ? '' : ' locked'}" data-faction="${i}"${unlocked ? '' : ' disabled'}><span class="sigil" style="color:#${f.color.toString(16)}">${f.sigil}</span><strong>${esc(f.name)}</strong><small>${unlocked ? f.desc : `LOCKED · Reach expedition depth ${requirement}.`}</small></button>`; }).join('')}</div><p id="factionTrait" class="muted command-trait">${FACTIONS[selectedFaction].trait}</p><section class="loadout-picker"><div class="loadout-picker-heading"><div><div class="eyebrow">COMMAND LOADOUT</div><h2>Select four modules.</h2></div><span>${loadout.length} / 4</span></div><div class="loadout-options">${contentKeys(ABILITIES).map(key => {
    const ability = ABILITIES[key], slot = loadout.indexOf(key), rank = profile.upgrades[key] || 0,
      stats = abilityStats(key, rank);
    return `<button class="loadout-option${slot >= 0 ? ' active' : ''}" data-loadout-ability="${key}" aria-pressed="${slot >= 0}"><span class="loadout-slot">${slot >= 0 ? slot + 1 : ''}</span><span class="sigil">${uiIcon(ability.icon)}</span><span><strong>${esc(ability.name)}</strong><small>${esc(ability.desc)}</small><em>${stats.energy}ϟ · ${stats.cd}s · RANK ${rank}</em></span></button>`;
  }).join('')}</div></section><div class="launch-row battle-launch"><span class="battle-note">HQ + ${profile.upgrades.startingWorkers || 0} WORKERS · ${startingAlloy} CINDER · RANDOM FRONTIER</span><button class="primary" data-ui="startBattle"${loadout.length === 4 && new Set(loadout).size === 4 ? '' : ' disabled'}>START EXPEDITION ↗</button></div></div></div>`;
}

function renderSettingsScreen(st: MeridianSettings, storageAvailable = true) {
  return `<div class="eyebrow">EXPEDITION PREFERENCES</div><h1>Systems & sound.</h1><div class="settings-row"><label for="setting-quality">Render quality<small>Reduce quality for older graphics hardware.</small></label><select id="setting-quality" data-setting="quality"><option value="2" ${st.quality === 2 ? 'selected' : ''}>High · tilt-shift</option><option value="1" ${st.quality === 1 ? 'selected' : ''}>Balanced · native resolution</option><option value="0" ${st.quality === 0 ? 'selected' : ''}>Performance · no shadows</option></select></div><div class="settings-row"><label for="setting-volume">Master volume</label><input id="setting-volume" type="range" min="0" max="1" step=".01" value="${st.volume}" data-setting="volume"></div><div class="settings-row"><label for="setting-music">Atmospheric soundtrack</label><input id="setting-music" type="checkbox" data-setting="music" ${st.music ? 'checked' : ''}></div><div class="settings-row"><label for="setting-sfx">Battlefield audio</label><input id="setting-sfx" type="checkbox" data-setting="sfx" ${st.sfx ? 'checked' : ''}></div><div class="settings-row"><label for="setting-healthbars">Always show health bars</label><input id="setting-healthbars" type="checkbox" data-setting="healthbars" ${st.healthbars ? 'checked' : ''}></div><div class="settings-row"><label for="setting-showFps">Show FPS counter<small>Displays the rendered frame rate during play.</small></label><input id="setting-showFps" type="checkbox" data-setting="showFps" ${st.showFps ? 'checked' : ''}></div><div class="launch-row"><button class="primary" data-ui="closeModal">DONE</button></div><p class="ui-note"${storageAvailable ? '' : ' role="status"'}>${storageAvailable ? 'Expeditions and settings stay in this browser.' : 'Saving is unavailable. Changes stay in this tab only; reloading may restore older progress.'} Play is singleplayer only and makes no network requests. Running battles are autosaved and restored paused.</p>`;
}

function renderArmoryScreen(profile: MeridianProfile) {
  const cards = (catalog: Record<string, UpgradeDefinition>) => Object.entries(catalog).map(([k, m]) => {
    const n = profile.upgrades[k] || 0, cost = m.costs[n], affordable = profile.aether >= cost,
      effect = m.display.values[n];
    return `<div class="upgrade-card"><div class="upgrade-heading"><div class="sigil">${uiIcon(k, m.icon)}</div><div><h3>${m.name}</h3><span class="upgrade-rank">LEVEL ${n} / ${m.max}</span></div></div><p>${m.desc}</p><div class="upgrade-effect"><span>${m.display.label}</span><strong>${effect.toLocaleString()} <small>${m.display.unit}</small></strong></div><div class="upgrade-levels" aria-label="Level ${n} of ${m.max}">${Array.from({ length: m.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div><button class="secondary" data-upgrade="${k}" ${n >= m.max || !affordable ? 'disabled' : ''}>${n >= m.max ? '<span>FULLY REQUISITIONED</span>' : `<span>${cost} ECHO</span><small>${m.display.gains[n]}</small>`}</button></div>`;
  }).join('');
  return `<div class="armory-screen"><header class="armory-heading"><h1>Fleet upgrades</h1><div class="armory-balance"><strong>${profile.aether.toLocaleString()}</strong><span class="armory-aether-icon">${uiIcon('aether')}</span></div><button class="primary" data-ui="closeModal">${uiIcon('back')}RETURN</button></header><div class="armory-content"><section class="armory-section"><div class="eyebrow">FLEET SYSTEMS</div><div class="armory-grid">${cards(META)}</div></section><section class="armory-section"><div class="eyebrow">COMMAND MODULES</div><div class="armory-grid command-module-grid">${cards(COMMAND_MODULES)}</div></section></div></div>`;
}

function renderBenefitOptions(offers: readonly string[], selected?: string) {
  return offers.map(key => {
    const benefit = expeditionBenefit(key)!, active = key === selected;
    return `<button class="benefit-option${active ? ' active' : ''}" data-benefit="${key}" aria-pressed="${active}"><span class="sigil">${uiIcon(key, benefit.icon)}</span><strong>${benefit.name}</strong><small>${benefit.desc}</small></button>`;
  }).join('');
}
