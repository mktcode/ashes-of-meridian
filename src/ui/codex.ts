/* Read-only catalog and story, available regardless of expedition unlocks. */
'use strict';

// English player-facing story is authored here; no runtime fetch or build-time generation.
const CODEX_STORY_MARKDOWN = `# Ashes of Meridian — Story and World

> “We call it ash because we hope the fire is over.”
>
> — Inscription on an abandoned survey station

## 1. The Meridian

The stars in this region form a vast ring around a dark center. From some worlds, its distant edge stretches across the night sky as a pale band. Astronomers suspect that an unimaginably massive object once collapsed at its center. No one knows what really happened there. Even the stars' orbits raise more questions than they answer.

A line of unusual gravitational conditions has served as a reference for star charts for centuries. Navigators called it the **Meridian**; today the entire region bears that name. Its soil and wreckage contain materials found nowhere else in such quantities. Perhaps they are remnants of that distant catastrophe. Perhaps they came from somewhere else.

## 2. What the Fleets Seek

**Cinder** forms metallic, shimmering crystals. It can be worked on site into armor, tools, and supports for living tissue. Wherever an expedition lands, Cinder makes it possible to establish a foothold quickly.

Rarer still is **Echo**. It rises with mineral vapors from certain deep fractures and is captured in shielded cores. Those cores keep delicate machinery, protective fields, and biological processes stable even under severe strain. Once their bound field trace is spent, it cannot simply be restored.

The richest sources often lie beyond safe routes. In the **Dark Fringes**, conditions for long-range navigation shift; some destinations are reliably accessible only for a limited time. A joint survey mission, the **Seventh Survey**, found new corridors there and exceptionally rich Echo deposits. Not all of its ships returned. What remained were charts, scattered samples, and a final report containing readings no one has since been able to explain.

Researchers followed the new routes first. Then salvage fleets. Today armed expeditions set out with charts that may have been altered by parties unknown.

## 3. Three Claims

**The Cinder Pact** arose when supply companies abandoned remote stations. Their inhabitants survived by sharing tools and dismantling equipment that belonged to others. The Pact swore never again to leave an inhabited station behind because saving it cost too much. It seeks Echo sources of its own so no supplier can cut off its people. But a lifeline for the Pact may cost someone else their home.

**The Manyroot** joins rooted organisms, mobile plant beings, and thinking guardians in many independent seed-clans. Their intertwined lives depend on one another and on soil rich in Echo. When a source runs dry, the smallest creatures suffer first; years later, entire groves fail to bloom. The clans search for new soil for their descendants. They know how much life depends on a single source — and sometimes claim it at the expense of others anyway.

**The Mourning Houses** hold the estates of fallen civilizations in trust. Their members protect archives, care for survivors, and honor promises to people who can no longer speak for themselves. Some of their claims reach back centuries. The last archive of a lost city may lie beneath a coveted Echo source; a living settlement may also suffer under the weight of an ancient contract.

None of these powers speaks with a single voice. Pact stations, seed-clans, and individual Houses have obligations of their own. Even allies can become enemies over the same source.

## 4. The Next Advance

An expedition fleet cannot send unlimited ships through an unstable corridor. Its advance force lands with limited supplies, establishes a base, and secures extraction sites for the journey ahead. What it can recover strengthens the fleet; what it leaves behind may fall to a rival.

The Seventh Survey left traces among all three powers. The Pact holds logs from a transport that turned back, a seed-clan keeps seed capsules of unknown origin, and a Mourning House has sealed away a contradictory reading. No one yet knows what the survey really found — or why not everyone returned.

For the fleets, the next safe landing comes first. To a station, a shipment of Echo might mean one more winter with air to breathe. To a grove, the same source holds the future of its roots. And to a Mourning House, it may shelter a name that must not be forgotten.
`;

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
  return `<div class="codex-model-screen"><header class="sub-header"><div><div class="eyebrow">${esc(FACTIONS[faction].name)} / ${kind.toUpperCase()}</div><h1>${esc(name)}</h1></div><button class="textbtn" data-ui="codex">← CODEX</button></header><div class="codex-model-caption"><p>${esc(desc)}</p></div></div>`;
}

function storyInline(text: string): string {
  return esc(text).replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>');
}
function renderStoryScreen(): string {
  const lines = CODEX_STORY_MARKDOWN.split(/\r?\n/);
  let html = '', paragraph: string[] = [], list: string[] = [], ordered: string[] = [], table: string[] = [], quote: string[] = [], chapter = 0;
  const chapters = lines.filter(line => /^## \d+\. /.test(line)).map((line,index) =>
    `<a href="#codex-chapter-${index + 1}">${storyInline(line.slice(3))}</a>`).join('');
  function flush() {
    if (paragraph.length) { html += `<p>${storyInline(paragraph.join(' '))}</p>`; paragraph = []; }
    if (list.length) { html += `<ul>${list.map(item => `<li>${storyInline(item)}</li>`).join('')}</ul>`; list = []; }
    if (ordered.length) { html += `<ol>${ordered.map(item => `<li>${storyInline(item)}</li>`).join('')}</ol>`; ordered = []; }
    if (table.length) { html += `<pre class="codex-table">${esc(table.join('\n'))}</pre>`; table = []; }
    if (quote.length) { html += `<blockquote>${quote.map(storyInline).join('<br>')}</blockquote>`; quote = []; }
  }
  for (const line of lines) {
    const heading = /^(#{1,3}) (.*)/.exec(line);
    if (heading) { flush(); const level = heading[1].length;
      html += `<h${level}${level === 2 ? ` id="codex-chapter-${++chapter}"` : ''}>${storyInline(heading[2])}</h${level}>`; }
    else if (line.startsWith('>')) {
      if (!quote.length) flush();
      if (line.startsWith('> ')) quote.push(line.slice(2));
    }
    else if (!line.trim()) flush();
    else if (line.startsWith('|')) { if (paragraph.length || list.length || ordered.length || quote.length) flush(); table.push(line); }
    else if (/^[-*] /.test(line)) { if (paragraph.length || table.length || ordered.length || quote.length) flush(); list.push(line.slice(2)); }
    else if (/^\d+\. /.test(line)) { if (paragraph.length || table.length || list.length || quote.length) flush(); ordered.push(line.replace(/^\d+\. /,'')); }
    else { if (list.length || ordered.length || table.length || quote.length) flush(); paragraph.push(line); }
  }
  flush();
  return `<div class="subscreen codex-story-screen"><header class="sub-header"><div><div class="eyebrow">THE MERIDIAN / ARCHIVE</div><h1>The Story</h1></div><button class="textbtn" data-ui="codex">← CODEX</button></header><nav class="codex-chapters" aria-label="Story chapters">${chapters}</nav><article class="codex-story">${html}</article></div>`;
}
