/* Pure screen markup. No DOM, persistence, RNG or UI state changes. */
'use strict';

function renderHomeScreen(expedition: MeridianExpedition | null, bestDepth: number, briefing: string) {
  return `<div class="home-screen"><div class="home-layout">
            <svg class="menu-frame" viewBox="0 0 22 887" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M1 0V72L17 88V178L6 190V674L20 688V778L1 797V887"/></svg>
            <header class="menu-header">
              <div class="menu-system">SOL SYSTEM <span>//</span> M-472</div>
              <div class="version">ROGUELITE PROTOTYPE</div>
            </header>
            <div class="menu-main">
              <div class="menu-title">
                <div class="menu-wordmark"><svg class="menu-emblem" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="22"/><path d="M24 3V11M24 37V45M3 24H11M37 24H45M24 10L28 20L38 24L28 28L24 38L20 28L10 24L20 20Z"/><circle cx="24" cy="24" r="4"/></svg><h1 class="wordmark" aria-label="Ashes of Meridian"><span class="wordmark-first">ASHES <b>OF</b></span><span>MERIDIAN</span></h1></div>
                <p class="menu-tagline">A roguelite RTS.</p>
                ${expedition ? `<div class="expedition-stage" aria-label="Checkpoint ${expedition.depth + 1}"><span class="stage-label">CHECKPOINT</span><div class="stage-crystal"><svg viewBox="0 0 200 190" aria-hidden="true" focusable="false"><defs><linearGradient id="stageCrystalCore" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfffff"/><stop offset=".35" stop-color="#48d9ed"/><stop offset="1" stop-color="#07344c"/></linearGradient></defs><path class="crystal-halo" d="M100 3 174 34 194 104 143 184 57 184 6 104 26 34Z"/><path class="crystal-body" d="M100 10 168 40 185 102 138 176 62 176 15 102 32 40Z"/><path class="crystal-facet light" d="m15 102 85-92v166l-38-10Z"/><path class="crystal-facet shade" d="m100 10 68 30 17 62-47 74-38-10 34-62Z"/><path class="crystal-lines" d="m32 40 68 64 68-64M15 102h170M62 176l38-72 38 72M100 10v94"/></svg><strong>${expedition.depth + 1}</strong></div></div>` : ''}
              </div>
              <div class="menu-actions">
                <div class="menu-buttons">
                  ${briefing}
                  ${expedition ? `<div class="continue-row"><button class="primary" data-ui="continueExpedition">Continue expedition <span aria-hidden="true">→</span></button><button class="secondary expedition-perks-button" data-ui="expeditionBenefits" aria-label="View expedition benefits">${icon('hero')}</button></div>` : ''}
                  <button class="${expedition ? 'secondary' : 'primary'}" data-ui="battle">New expedition <span aria-hidden="true">→</span></button>
                  <button class="secondary" data-ui="armory">Fleet upgrades <span aria-hidden="true">→</span></button>
                </div>
                <nav class="menu-subnav" aria-label="More options"><button class="textbtn" data-ui="help">FIELD MANUAL</button><button class="textbtn" data-ui="settings">SETTINGS</button></nav>
              </div>
            </div>
            <div class="menu-quote">One expedition.<br>How deep can you go?<small>${expedition ? `${expedition.depth} SECTORS CLEARED` : `BEST DEPTH ${bestDepth}`}</small></div>
            <footer class="menu-footer"><span class="menu-progress">LOCAL & OFFLINE</span></footer>
          </div></div>`;
}

function renderBattleScreen(profile: MeridianProfile, selectedFaction: FactionId, unlockedFaction: FactionId, startingAlloy: number) {
  return `<div class="subscreen"><header class="sub-header"><div><div class="eyebrow">NEW EXPEDITION</div><h1>Choose your command.</h1></div><button class="textbtn" data-ui="home">← MAIN MENU</button></header><div style="max-width:910px;margin:0 auto"><div class="faction-options">${FACTIONS.map((f, i) => { const unlocked = i <= unlockedFaction, requirement = FACTION_DEPTH_REQUIREMENTS[i]; return `<button class="faction-option${selectedFaction === i ? ' active' : ''}${unlocked ? '' : ' locked'}" data-faction="${i}"${unlocked ? '' : ' disabled'}><span class="sigil" style="color:#${f.color.toString(16)}">${f.sigil}</span><strong>${esc(f.name)}</strong><small>${unlocked ? f.desc : `LOCKED · Reach expedition depth ${requirement}.`}</small></button>`; }).join('')}</div><p id="factionTrait" class="muted" style="min-height:42px;font-size:13px">${FACTIONS[selectedFaction].trait}</p><div class="launch-row battle-launch"><span class="battle-note">HQ + ${profile.upgrades.startingWorkers || 0} WORKERS · ${startingAlloy} ALLOY · RANDOM FRONTIER</span><button class="primary" data-ui="startBattle">START EXPEDITION ↗</button></div></div></div>`;
}

function renderSettingsScreen(st: MeridianSettings) {
  return `<div class="eyebrow">EXPEDITION PREFERENCES</div><h1>Systems & sound.</h1><div class="settings-row"><label>Render quality<small>Reduce quality for older graphics hardware.</small></label><select data-setting="quality"><option value="2" ${st.quality === 2 ? 'selected' : ''}>High · tilt-shift</option><option value="1" ${st.quality === 1 ? 'selected' : ''}>Balanced · native resolution</option><option value="0" ${st.quality === 0 ? 'selected' : ''}>Performance · no shadows</option></select></div><div class="settings-row"><label>Master volume</label><input type="range" min="0" max="1" step=".01" value="${st.volume}" data-setting="volume"></div><div class="settings-row"><label>Atmospheric soundtrack</label><input type="checkbox" data-setting="music" ${st.music ? 'checked' : ''}></div><div class="settings-row"><label>Battlefield audio</label><input type="checkbox" data-setting="sfx" ${st.sfx ? 'checked' : ''}></div><div class="settings-row"><label>Always show health bars</label><input type="checkbox" data-setting="healthbars" ${st.healthbars ? 'checked' : ''}></div><div class="launch-row"><button class="primary" data-ui="closeModal">DONE</button></div><p style="font-size:10px">Everything stays in this browser. No accounts, analytics, external assets, or network requests. The expedition is saved only between battles.</p>`;
}

function renderFieldManual() {
        const renderHelpLines = (rows: string[][]) => rows
          .map(([a, b]) => `<div class="help-line"><span>${a}</span><span class="help-input">${b}</span></div>`)
          .join('');
  return `<div class="eyebrow">ASHES OF MERIDIAN</div><h1>Field manual</h1><p>Destroy the enemy HQ. Protect your last HQ.</p><div class="help-grid"><div><h3>Controls</h3>${renderHelpLines([
            ['Select', 'Tap or left-click your unit or building'],
            ['Move / attack', 'Select troops → tap ground / enemy · right-click'],
            ['Group visible units', 'Double-tap/click: same type · triple-tap: all except workers'],
            ['Combat force', 'Group icon: select all combat units'],
            ['Attack-move', 'Crossed swords: gold = stop to fight'],
            ['Pan / zoom', 'Drag or middle-drag · wheel, pinch or ＋ / −'],
            ['Navigate', '⌂: base · minimap: tap, click or drag']
          ])}<p style="font-size:12px">Turn Attack-move off to prioritize moving or retreating. Workers always move normally.</p><h3>Battle controls</h3>${renderHelpLines([
            ['Abilities', 'Choose in the bottom-center bar → tap target'],
            ['Cancel', 'Tap the selected action again'],
            ['Speed', 'Tap the multiplier below the clock'],
            ['Pause / help', 'Ⅱ → FIELD MANUAL']
          ])}<p style="font-size:12px"><b>Between-battle checkpoints.</b> The current battle is not saved. Reloading resumes from its preceding expedition checkpoint.</p></div><div><h3>Base & economy</h3><p style="font-size:12px"><b>Start:</b> HQ, plus 0–5 workers and 250–500 alloy from fleet upgrades. Expedition benefits can add workers, alloy, aether and your commander. Survey drones map resources without enemy vision; Field workshop speeds your first foundation (lost on cancellation); Command capacitor adds ${EXPEDITION_EFFECTS.energy} starting energy per stack; base energy is ${COMMAND_ENERGY.start}. No workers? Recruit one through <b>Infantry</b>.</p><p style="font-size:12px"><b>Resources:</b> Workers automatically gather alloy. Place a refinery within 6 meters of an explored vent; its foundation snaps onto the vent and needs no assigned worker after construction. Depots add 16 supply.</p><p style="font-size:12px"><b>Build:</b> Buildings → choose → tap clear, explored ground. Requires a free worker. Recruit via <b>Infantry / Vehicles / Aircraft</b>. <b>Back</b> returns to categories. Tap a queue icon above the minimap to cancel one order for a full refund.</p><p style="font-size:12px"><b>Manage:</b> Select a completed building for <b>Repair / Sell / Rally point</b>. For rally, then tap a destination. Select a worker and tap your foundation or damaged unit/building to resume construction or repair.</p><h3>Enemy doctrines</h3><p style="font-size:12px">${FACTIONS.map(f => `<b>${esc(f.short)}:</b> ${esc(f.doctrine.desc)}`).join('<br>')}<br>Behavioral pressure rises at depths 4, 8, 12 and 16, then stops scaling. The opposition also gains one lasting benefit after each victory, from the same pool and with the same stack limits as yours. Factions have weighted preferences, not exclusive or stronger benefits. All accumulated enemy benefits are shown in the next briefing and remain when the enemy faction changes. Beyond these declared starting benefits, enemies pay for their economy and troops and use only their own current vision and remembered contacts.</p><h3>Command abilities</h3><p style="font-size:12px"><b>Orbital strike:</b> requires a completed ${FACTIONS.map((_, faction) => esc(buildingName(ABILITY_RULES.orbitalBuilding, faction as FactionId))).join(' / ')} (the TECH badge means it is missing) and current vision at the target. Losing your last factory locks the ability again. <b>Reinforcements:</b> only on explored ground within ${ABILITY_RULES.reinforcementRange} meters of own units or completed buildings. A scan alone cannot establish a drop site. <b>Recon scan:</b> still reveals distant areas without a forward unit.</p><h3>Between battles</h3><p style="font-size:12px">A victory secures the next checkpoint and lets you choose a benefit for the rest of the expedition. A lost HQ ends the expedition. Unspent aether is recovered up to your evacuation limit (100–1,000) after every battle.</p><p style="font-size:12px">Reach depth <b>10</b> to unlock <b>${esc(FACTIONS[FACTION_ID.SECOND].name)}</b> and depth <b>25</b> to unlock <b>${esc(FACTIONS[FACTION_ID.THIRD].name)}</b>. Fleet upgrades also improve construction speed, supply capacity and worker repair costs; purchases apply only at the next battle start. Construction protocols adds to Field workshop rather than multiplying it. Fleet upgrades, reserve and best depth stay in this browser.</p></div></div><div class="launch-row"><button class="primary" data-ui="closeModal">RETURN ↗</button></div>`;
}

function renderArmoryScreen(profile: MeridianProfile) {
  return `<div class="armory-screen"><header class="armory-heading"><h1>Upgrades</h1><div class="armory-balance"><strong>${profile.aether.toLocaleString()}</strong><span class="armory-aether-icon">${icon('crystal')}</span></div></header><div class="armory-grid">${Object.entries(
            META
          )
            .map(([k, m]) => {
              let n = profile.upgrades[k] || 0, cost = m.costs[n], affordable = profile.aether >= cost,
                effect = m.display.values[n];
              return `<div class="upgrade-card"><div class="upgrade-heading"><div class="sigil">${icon(m.icon)}</div><div><h3>${m.name}</h3><span class="upgrade-rank">LEVEL ${n} / ${m.max}</span></div></div><p>${m.desc}</p><div class="upgrade-effect"><span>${m.display.label}</span><strong>${effect.toLocaleString()} <small>${m.display.unit}</small></strong></div><div class="upgrade-levels" aria-label="Level ${n} of ${m.max}">${Array.from({ length: m.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div><button class="secondary" data-upgrade="${k}" ${n >= m.max || !affordable ? 'disabled' : ''}>${n >= m.max ? 'FULLY REQUISITIONED' : cost + ' AETHER · LEVEL ' + (n + 1)}</button></div>`;
            })
            .join(
              ''
            )}</div><div class="launch-row"><button class="primary" data-ui="closeModal">RETURN ↗</button></div></div>`;
}

function renderBenefitOptions(offers: readonly string[], selected?: string) {
  return offers.map(key => {
    const benefit = expeditionBenefit(key)!, active = key === selected;
    return `<button class="benefit-option${active ? ' active' : ''}" data-benefit="${key}" aria-pressed="${active}"><span class="sigil">${icon(benefit.icon)}</span><strong>${benefit.name}</strong><small>${benefit.desc}</small></button>`;
  }).join('');
}
