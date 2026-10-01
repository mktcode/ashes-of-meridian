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

function renderHomeScreen(expedition: MeridianExpedition | null, hasPreviousStage = false, stageMapName = '') {
  return `<div class="home-screen"><div class="home-layout">
            <div class="menu-main">
              <h1 class="menu-brand" aria-label="Ashes of Meridian"><span class="menu-emblem" aria-hidden="true"></span><span class="logo-ashes" aria-hidden="true"></span><span class="logo-of" aria-hidden="true"></span><span class="logo-meridian" aria-hidden="true"></span></h1>
              ${expedition ? `<section class="expedition-stage" aria-label="Expedition landscape preview" aria-busy="false"><span class="stage-label">CHECKPOINT</span><div class="stage-navigation"><button class="stage-arrow previous" data-ui="previousStage" aria-label="Preview previous stage"${hasPreviousStage ? '' : ' disabled'}><svg viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path class="trailing-chevron" d="M4 4 L13 18 L4 32"/><path d="M17 4 L26 18 L17 32"/></svg></button><div class="stage-crystal"><strong>${expedition.depth + 1}</strong></div><button class="stage-arrow next" data-ui="nextStage" aria-label="Preview next stage" disabled><svg viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path class="trailing-chevron" d="M4 4 L13 18 L4 32"/><path d="M17 4 L26 18 L17 32"/></svg></button></div><div class="stage-caption" aria-live="polite" aria-atomic="true"><span class="stage-map">${esc(stageMapName)}</span><small class="stage-status">CURRENT · LANDSCAPE PREVIEW</small></div></section>` : ''}
              <div class="menu-actions">
                <div class="menu-buttons">
                  ${expedition ? `<div class="continue-row"><button class="primary" data-ui="continueExpedition" title="Continue at checkpoint ${expedition.depth + 1}">Continue expedition <span aria-hidden="true">→</span></button><button class="secondary expedition-perks-button" data-ui="expeditionBenefits" aria-label="View current expedition" title="Current expedition"><span class="menu-icon expedition-icon" aria-hidden="true"></span></button></div>` : ''}
                  <button class="${expedition ? 'secondary' : 'primary'}" data-ui="battle">New expedition <span aria-hidden="true">→</span></button>
                  <button class="secondary" data-ui="armory">Fleet upgrades <span aria-hidden="true">→</span></button>
                  <button class="secondary" data-ui="codex">Codex · Units &amp; Buildings <span aria-hidden="true">→</span></button>
                </div>
                <nav class="menu-subnav" aria-label="More options"><button class="textbtn" data-ui="help"><span class="menu-icon manual-icon" aria-hidden="true"></span>FIELD MANUAL</button><button class="textbtn" data-ui="settings"><span class="menu-icon settings-icon" aria-hidden="true"></span>SETTINGS</button></nav>
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

function renderSettingsScreen(st: MeridianSettings) {
  return `<div class="eyebrow">EXPEDITION PREFERENCES</div><h1>Systems & sound.</h1><div class="settings-row"><label for="setting-quality">Render quality<small>Reduce quality for older graphics hardware.</small></label><select id="setting-quality" data-setting="quality"><option value="2" ${st.quality === 2 ? 'selected' : ''}>High · tilt-shift</option><option value="1" ${st.quality === 1 ? 'selected' : ''}>Balanced · native resolution</option><option value="0" ${st.quality === 0 ? 'selected' : ''}>Performance · no shadows</option></select></div><div class="settings-row"><label for="setting-volume">Master volume</label><input id="setting-volume" type="range" min="0" max="1" step=".01" value="${st.volume}" data-setting="volume"></div><div class="settings-row"><label for="setting-music">Atmospheric soundtrack</label><input id="setting-music" type="checkbox" data-setting="music" ${st.music ? 'checked' : ''}></div><div class="settings-row"><label for="setting-sfx">Battlefield audio</label><input id="setting-sfx" type="checkbox" data-setting="sfx" ${st.sfx ? 'checked' : ''}></div><div class="settings-row"><label for="setting-healthbars">Always show health bars</label><input id="setting-healthbars" type="checkbox" data-setting="healthbars" ${st.healthbars ? 'checked' : ''}></div><div class="settings-row"><label for="setting-showFps">Show FPS counter<small>Displays the rendered frame rate during play.</small></label><input id="setting-showFps" type="checkbox" data-setting="showFps" ${st.showFps ? 'checked' : ''}></div><div class="launch-row"><button class="primary" data-ui="closeModal">DONE</button></div><p class="ui-note">Expeditions and settings stay in this browser. Play is singleplayer only and makes no network requests. The expedition is saved only between battles.</p>`;
}

function renderFieldManual(mission: MissionId = DEFAULT_MISSION) {
        const renderHelpLines = (rows: string[][]) => rows
          .map(([a, b]) => `<div class="help-line"><span>${a}</span><span class="help-input">${b}</span></div>`)
          .join('');
  return `<div class="eyebrow">ASHES OF MERIDIAN</div><h1>Field manual</h1><p>${esc(MISSIONS[mission].objective)}</p><div class="help-grid"><div><h3>Controls</h3>${renderHelpLines([
            ['Select', 'Tap or left-click your unit or building'],
            ['Move / attack', 'Select troops → tap ground / enemy · right-click'],
            ['Group visible units', 'Double-tap/click: same type · triple-tap: all except workers'],
            ['Visible combat force', 'Framed group icon: select combat units in view'],
            ['Combat force', 'Group icon: select all combat units on the map'],
            ['Attack-move', 'Crossed swords: gold = stop to fight'],
            ['Pan / zoom', 'Drag · wheel, pinch or ＋ / −'],
            ['Rotate camera', 'Twist two fingers or middle-drag'],
            ['Navigate', '⌂: base · minimap: tap, click or drag']
          ])}<p style="font-size:12px">Turn Attack-move off to prioritize moving or retreating. Workers always move normally.</p><h3>Battle controls</h3>${renderHelpLines([
            ['Abilities', 'Choose in the bottom-center bar → tap target'],
            ['Cancel', 'Tap the selected action again'],
            ['Speed', 'Tap the multiplier below the clock'],
            ['Pause / help', 'Ⅱ → FIELD MANUAL']
          ])}<p style="font-size:12px"><b>Between-battle checkpoints.</b> The current battle is not saved. Reloading resumes from its preceding expedition checkpoint.</p></div><div><h3>Base & economy</h3><p style="font-size:12px"><b>Start:</b> A deployment worker and HQ construction reserves, plus 0–5 workers and 250–500 Cinder from fleet upgrades. Your first field tutorial begins beside resources; later encounters require exploration before choosing a base site. Expedition benefits can add workers, Cinder, Echo and your commander. Survey drones map resources without enemy vision; Field workshop speeds your first foundation (lost on cancellation); Command capacitor adds ${EXPEDITION_EFFECTS.energy} starting energy per stack; base energy is ${COMMAND_ENERGY.start}. Deploy an HQ before recruiting additional workers through <b>Infantry</b>.</p><p style="font-size:12px"><b>Resources:</b> Workers automatically gather Cinder. Place a refinery within 6 meters of an explored vent; its foundation snaps onto the vent and needs no assigned worker after construction. Depots add 16 supply.</p><p style="font-size:12px"><b>Build:</b> Buildings → choose → tap clear, explored ground. Requires a free worker and stable ground; gentle slopes are allowed, cliffs are not. Recruit via <b>Infantry / Vehicles / Aircraft</b>. <b>Back</b> returns to categories. Tap a queue icon above the minimap to cancel one order for a full refund.</p><p style="font-size:12px"><b>Manage:</b> Select a completed building for <b>Repair / Sell / Rally point</b>. For rally, then tap a destination. Select a worker and tap your foundation or damaged unit/building to resume construction or repair.</p><h3>Enemy doctrines</h3><p style="font-size:12px">${FACTIONS.map(f => `<b>${esc(f.short)}:</b> ${esc(f.doctrine.desc)}`).join('<br>')}<br>Stages 1–3 feature one opponent in order: ${FACTIONS.map(f => esc(f.name)).join(', then ')}. Behavioral pressure rises at depths 4, 8, 12 and 16, then stops scaling. Stage ${EXPEDITION_ENEMY_ENTRY_STAGES[1]} introduces a second opponent; stage ${EXPEDITION_ENEMY_ENTRY_STAGES[2]} a third. Everyone fights everyone, even with matching factions. Each existing opponent slot gains one lasting benefit after each of your victories, from the same pool and with the same stack limits as yours. New slots start without benefits; their first benefit follows their first battle. All opponents use the current expedition pressure. Factions have weighted preferences, not exclusive or stronger benefits. All accumulated enemy benefits are shown in the next briefing and remain when the enemy faction changes. Beyond these declared starting benefits, enemies pay for their economy and troops and use only their own current vision and remembered contacts.</p><h3>Command abilities</h3><p style="font-size:12px">Choose four different abilities before an expedition; their order becomes the fixed four-slot HUD for that run. <b>Orbital strike:</b> requires a completed ${FACTIONS.map((_, faction) => esc(buildingName(ABILITY_RULES.orbitalBuilding, faction as FactionId))).join(' / ')} (the TECH badge means it is missing) and current vision at the target. Losing your last factory locks it again. <b>Reinforcements:</b> require an explored target near own forces; a scan alone is no drop anchor. <b>Disruption:</b> slows enemy units. <b>Bulwark:</b> protects allies. <b>Command surge:</b> accelerates own combat troops, not workers. <b>Emergency recall:</b> extracts a limited selection of ground troops to a completed HQ after a delay.</p><h3>Between battles</h3><p style="font-size:12px">A victory secures the next checkpoint and lets you choose a benefit for the rest of the expedition. A defeat ends the expedition. Unspent Echo is recovered up to your evacuation limit (100–1,000) after every battle. Each completed enemy structure destroyed by your forces recovers additional permanent Echo beyond that limit; Echo recovery raises the amount from 5 to 30.</p><p style="font-size:12px">Reach depth <b>10</b> to unlock <b>${esc(FACTIONS[FACTION_ID.SECOND].name)}</b> and depth <b>25</b> to unlock <b>${esc(FACTIONS[FACTION_ID.THIRD].name)}</b>. Fleet systems improve construction speed, supply capacity and worker repair costs; Command modules add three ranks to each ability. Purchases apply only at the next battle start. Construction protocols adds to Field workshop rather than multiplying it. Permanent upgrades, reserve and best depth stay in this browser.</p></div></div><div class="launch-row"><button class="primary" data-ui="closeModal">${uiIcon('back')}RETURN</button></div>`;
}

function renderArmoryScreen(profile: MeridianProfile) {
  const cards = (catalog: Record<string, UpgradeDefinition>) => Object.entries(catalog).map(([k, m]) => {
    const n = profile.upgrades[k] || 0, cost = m.costs[n], affordable = profile.aether >= cost,
      effect = m.display.values[n];
    return `<div class="upgrade-card"><div class="upgrade-heading"><div class="sigil">${uiIcon(k, m.icon)}</div><div><h3>${m.name}</h3><span class="upgrade-rank">LEVEL ${n} / ${m.max}</span></div></div><p>${m.desc}</p><div class="upgrade-effect"><span>${m.display.label}</span><strong>${effect.toLocaleString()} <small>${m.display.unit}</small></strong></div><div class="upgrade-levels" aria-label="Level ${n} of ${m.max}">${Array.from({ length: m.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div><button class="secondary" data-upgrade="${k}" ${n >= m.max || !affordable ? 'disabled' : ''}>${n >= m.max ? '<span>FULLY REQUISITIONED</span>' : `<span>${cost} ECHO</span><small>${m.display.gains[n]}</small>`}</button></div>`;
  }).join('');
  return `<div class="armory-screen"><header class="armory-heading"><h1>Fleet upgrades</h1><div class="armory-balance"><strong>${profile.aether.toLocaleString()}</strong><span class="armory-aether-icon">${uiIcon('aether')}</span></div></header><section class="armory-section"><div class="eyebrow">FLEET SYSTEMS</div><div class="armory-grid">${cards(META)}</div></section><section class="armory-section"><div class="eyebrow">COMMAND MODULES</div><div class="armory-grid command-module-grid">${cards(COMMAND_MODULES)}</div></section><div class="launch-row"><button class="primary" data-ui="closeModal">${uiIcon('back')}RETURN</button></div></div>`;
}

function renderBenefitOptions(offers: readonly string[], selected?: string) {
  return offers.map(key => {
    const benefit = expeditionBenefit(key)!, active = key === selected;
    return `<button class="benefit-option${active ? ' active' : ''}" data-benefit="${key}" aria-pressed="${active}"><span class="sigil">${uiIcon(key, benefit.icon)}</span><strong>${benefit.name}</strong><small>${benefit.desc}</small></button>`;
  }).join('');
}
