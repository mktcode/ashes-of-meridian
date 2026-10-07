/* Pure screen markup. No DOM, persistence, RNG or UI state changes. */
'use strict';

function renderAbilityLoadout(loadout: readonly AbilityType[], upgrades: Record<string, number> = {}): string {
  return `<div class="loadout-summary"><span>COMMAND LOADOUT</span>${loadout.map((key, index) => {
    const ability = ABILITIES[key], rank = upgrades[key] || 0;
    return `<b title="${esc(ability.desc)}"><i>${index + 1}</i>${uiIcon(ability.icon)}${esc(ability.name)} · R${rank}</b>`;
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

function renderExpeditionUpgradeList(totals: CivilizationUpgradeTotals): string {
  const active = Object.entries({...totals.upgrades, ...totals.benefits}).filter(([, count]) => count > 0);
  return `<div class="expedition-benefit-list">${active.length ? active.map(([key, count]) => {
    const effect = CIVILIZATION_UPGRADES[key as CivilizationUpgradeType];
    return `<div class="expedition-benefit-row"><span class="sigil">${uiIcon(key, effect.icon)}</span><div><strong>${esc(effect.name)}</strong><small>${esc(effect.desc)}</small></div><b>×${count}</b></div>`;
  }).join('') : '<p class="empty-benefits">No configured civilian upgrades. Win a world, build a Forum and select a civilian building.</p>'}</div>`;
}

function renderHomeScreen(expedition: MeridianExpedition | null, hasPreviousStage = false, stageMapName = '') {
  return `<div class="home-screen"><div class="home-layout">
            <div class="menu-main">
              <h1 class="menu-brand" aria-label="Ashes of Meridian"><span class="menu-emblem" aria-hidden="true"></span><span class="logo-ashes" aria-hidden="true"></span><span class="logo-of" aria-hidden="true"></span><span class="logo-meridian" aria-hidden="true"></span></h1>
              ${expedition ? `<section class="expedition-stage" aria-label="Expedition stage selection" aria-busy="false"><span class="stage-label">CHECKPOINT</span><div class="stage-navigation"><button class="stage-arrow previous" data-ui="previousStage" aria-label="Select previous stage"${hasPreviousStage ? '' : ' disabled'}><svg viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path class="trailing-chevron" d="M4 4 L13 18 L4 32"/><path d="M17 4 L26 18 L17 32"/></svg></button><div class="stage-crystal"><strong>${expedition.depth + 1}</strong></div><button class="stage-arrow next" data-ui="nextStage" aria-label="Select next stage" disabled><svg viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path class="trailing-chevron" d="M4 4 L13 18 L4 32"/><path d="M17 4 L26 18 L17 32"/></svg></button></div><div class="stage-caption" aria-live="polite" aria-atomic="true"><span class="stage-map">${esc(stageMapName)}</span><small class="stage-status">CURRENT · LANDSCAPE PREVIEW</small></div></section>` : ''}
              <div class="menu-actions">
                <div class="menu-buttons">
                  ${expedition ? `<div class="continue-row"><button class="primary" data-ui="enterSelectedStage" title="${expedition.battle ? 'Restore saved battle' : `Continue at stage ${expedition.depth + 1}`}">Continue expedition <span aria-hidden="true">→</span></button><button class="secondary expedition-perks-button" data-ui="expeditionBenefits" aria-label="View current expedition" title="Current expedition"><span class="menu-icon expedition-icon" aria-hidden="true"></span></button></div>` : ''}
                  <button class="${expedition ? 'secondary' : 'primary'}" data-ui="battle">New expedition <span aria-hidden="true">→</span></button>
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
    const ability = ABILITIES[key], slot = loadout.indexOf(key), rank = 0,
      stats = abilityStats(key, rank);
    return `<button class="loadout-option${slot >= 0 ? ' active' : ''}" data-loadout-ability="${key}" aria-pressed="${slot >= 0}"><span class="loadout-slot">${slot >= 0 ? slot + 1 : ''}</span><span class="sigil">${uiIcon(ability.icon)}</span><span><strong>${esc(ability.name)}</strong><small>${esc(ability.desc)}</small><em>${stats.energy}ϟ · ${stats.cd}s · RANK ${rank}</em></span></button>`;
  }).join('')}</div></section><div class="launch-row battle-launch"><span class="battle-note">1 WORKER · BUILD YOUR HQ · ${startingAlloy} CINDER · RANDOM FRONTIER</span><button class="primary" data-ui="startBattle"${loadout.length === 4 && new Set(loadout).size === 4 ? '' : ' disabled'}>START EXPEDITION ↗</button></div></div></div>`;
}

function renderSettingsScreen(st: MeridianSettings, storageAvailable = true) {
  return `<div class="eyebrow">EXPEDITION PREFERENCES</div><h1>Systems & sound.</h1><div class="settings-row"><label for="setting-quality">Render quality<small>Reduce quality for older graphics hardware.</small></label><select id="setting-quality" data-setting="quality"><option value="2" ${st.quality === 2 ? 'selected' : ''}>High · tilt-shift</option><option value="1" ${st.quality === 1 ? 'selected' : ''}>Balanced · native resolution</option><option value="0" ${st.quality === 0 ? 'selected' : ''}>Performance · no shadows</option></select></div><div class="settings-row"><label for="setting-volume">Master volume</label><input id="setting-volume" type="range" min="0" max="1" step=".01" value="${st.volume}" data-setting="volume"></div><div class="settings-row"><label for="setting-music">Atmospheric soundtrack</label><input id="setting-music" type="checkbox" data-setting="music" ${st.music ? 'checked' : ''}></div><div class="settings-row"><label for="setting-sfx">Battlefield audio</label><input id="setting-sfx" type="checkbox" data-setting="sfx" ${st.sfx ? 'checked' : ''}></div><div class="settings-row"><label for="setting-healthbars">Always show health bars</label><input id="setting-healthbars" type="checkbox" data-setting="healthbars" ${st.healthbars ? 'checked' : ''}></div><div class="settings-row"><label for="setting-showFps">Show FPS counter<small>Displays the rendered frame rate during play.</small></label><input id="setting-showFps" type="checkbox" data-setting="showFps" ${st.showFps ? 'checked' : ''}></div><div class="launch-row"><button class="primary" data-ui="closeModal">DONE</button></div><p class="ui-note"${storageAvailable ? '' : ' role="status"'}>${storageAvailable ? 'Expeditions and settings stay in this browser.' : 'Saving is unavailable. Changes stay in this tab only; reloading may restore older progress.'} Play is singleplayer only and makes no network requests. Running battles are autosaved; Continue expedition resumes them directly.</p>`;
}
