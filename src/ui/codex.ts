/* Read-only catalog and story, available regardless of expedition unlocks. */
'use strict';

const CODEX_FACTION_STORIES = [
  'When supply companies abandoned remote stations, their crews survived by sharing tools and refusing to leave inhabited homes behind. The Pact now builds armored expeditions to secure its own lifelines—but its promises can become claims on somebody else’s world.',
  'The Manyroot is a community of interdependent lives, not a single mind. Its seed-clans search for new soil and fading Echo sources; their care for one another can still become a threat to those already living there.',
  'The Mourning Houses are trustees for lost civilizations, guarding archives and promises their original owners can no longer defend. Their precision protects irreplaceable inheritances, though the living may pay the price for old claims.'
] as const;

function renderCodexScreen(faction: FactionId): string {
  const f = FACTIONS[faction];
  const cards = (kind: 'unit' | 'building', types: string[]) => types.map(type => {
    const name = kind === 'unit' ? unitName(type,faction) : buildingName(type,faction);
    return `<button class="codex-card" data-codex-kind="${kind}" data-codex-type="${type}"><img src="assets/portraits/faction-${faction}-${kind}-${type}.webp" alt="" loading="lazy"><strong>${esc(name)}</strong><span>VIEW MODEL ↗</span></button>`;
  }).join('');
  return `<div class="subscreen codex-screen"><header class="sub-header"><div><div class="eyebrow">FIELD ARCHIVE</div><h1>Codex</h1></div><button class="textbtn" data-ui="home">← MAIN MENU</button></header>
    <nav class="codex-nav" aria-label="Codex sections">${FACTIONS.map((item,index) => `<button data-codex-faction="${index}" class="${index === faction ? 'active' : ''}" aria-pressed="${index === faction}">${esc(item.name)}</button>`).join('')}<button data-ui="codexStory">READ THE STORY ↗</button></nav>
    <section class="codex-faction"><span class="codex-sigil">${esc(f.sigil)}</span><div><h2>${esc(f.name)}</h2><p>${esc(CODEX_FACTION_STORIES[faction])}</p><small>${esc(f.trait)}</small></div></section>
    <h2 class="codex-section-title">Units</h2><div class="codex-grid">${cards('unit',contentKeys(UNITS))}</div>
    <h2 class="codex-section-title">Buildings</h2><div class="codex-grid">${cards('building',contentKeys(BUILDINGS))}</div></div>`;
}

function renderCodexModelScreen(faction: FactionId, kind: 'unit' | 'building', type: UnitType | BuildingType): string {
  const name = kind === 'unit' ? unitName(type,faction) : buildingName(type,faction);
  const desc = kind === 'unit' ? UNITS[type as UnitType].desc : BUILDINGS[type as BuildingType].desc;
  return `<div class="codex-model-screen"><header class="sub-header"><div><div class="eyebrow">${esc(FACTIONS[faction].name)} / ${kind.toUpperCase()}</div><h1>${esc(name)}</h1></div><button class="textbtn" data-ui="codex">← CODEX</button></header><div class="codex-model-caption"><p>${esc(desc)}</p><small>Animated game model · automatic rotation · no faction unlock required</small></div></div>`;
}

function storyInline(text: string): string {
  return esc(text).replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>');
}
function renderStoryScreen(): string {
  // docs/story.md is embedded at build time: no fetch (which is blocked on many file:// browsers).
  const lines = CODEX_STORY_MARKDOWN.split(/\r?\n/);
  let html = '', paragraph: string[] = [], list: string[] = [], ordered: string[] = [], table: string[] = [], chapter = 0;
  const chapters = lines.filter(line => /^## \d+\. /.test(line)).map((line,index) =>
    `<a href="#codex-chapter-${index + 1}">${storyInline(line.slice(3))}</a>`).join('');
  function flush() {
    if (paragraph.length) { html += `<p>${storyInline(paragraph.join(' '))}</p>`; paragraph = []; }
    if (list.length) { html += `<ul>${list.map(item => `<li>${storyInline(item)}</li>`).join('')}</ul>`; list = []; }
    if (ordered.length) { html += `<ol>${ordered.map(item => `<li>${storyInline(item)}</li>`).join('')}</ol>`; ordered = []; }
    if (table.length) { html += `<pre class="codex-table">${esc(table.join('\n'))}</pre>`; table = []; }
  }
  for (const line of lines) {
    const heading = /^(#{1,3}) (.*)/.exec(line);
    if (heading) { flush(); const level = heading[1].length;
      html += `<h${level}${level === 2 ? ` id="codex-chapter-${++chapter}"` : ''}>${storyInline(heading[2])}</h${level}>`; }
    else if (!line.trim() || line === '>') flush();
    else if (line.startsWith('|')) { if (paragraph.length || list.length || ordered.length) flush(); table.push(line); }
    else if (/^[-*] /.test(line)) { if (paragraph.length || table.length || ordered.length) flush(); list.push(line.slice(2)); }
    else if (/^\d+\. /.test(line)) { if (paragraph.length || table.length || list.length) flush(); ordered.push(line.replace(/^\d+\. /,'')); }
    else if (line.startsWith('> ')) { flush(); html += `<blockquote>${storyInline(line.slice(2))}</blockquote>`; }
    else { if (list.length || ordered.length || table.length) flush(); paragraph.push(line); }
  }
  flush();
  return `<div class="subscreen codex-story-screen"><header class="sub-header"><div><div class="eyebrow">THE MERIDIAN / ARCHIVE</div><h1>The Story</h1></div><button class="textbtn" data-ui="codex">← CODEX</button></header><nav class="codex-chapters" aria-label="Story chapters">${chapters}</nav><article class="codex-story">${html}</article></div>`;
}
