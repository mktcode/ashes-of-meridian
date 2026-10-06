import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'release/itch-media');
const screenshots = resolve(output, 'screenshots');
const mobileScreenshots = resolve(output, 'screenshots-mobile');
const browserCandidates = [process.env.CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
let executablePath;
for (const candidate of browserCandidates) {
  try { await access(candidate, constants.X_OK); executablePath = candidate; break; } catch {}
}
if (!executablePath) throw new Error('Chromium not found. Set CHROMIUM_PATH to a Chromium/Chrome executable.');
await mkdir(screenshots, { recursive: true });
await mkdir(mobileScreenshots, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true, chromiumSandbox: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`file://${root}/index.html`);
  await page.waitForFunction(() => window.Meridian && document.querySelector('#loading').classList.contains('hidden'));
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(screenshots, '05-expedition-command.jpg'), type: 'jpeg', quality: 92 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => Meridian.renderer.resize());
  await page.waitForTimeout(120);
  await page.screenshot({ path: resolve(mobileScreenshots, '05-expedition-command.jpg'), type: 'jpeg', quality: 92 });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => Meridian.renderer.resize());
  await page.addStyleTag({ content: '#toast,#radio{display:none!important}' });
  let cleanStyle = await page.addStyleTag({ content: '#hud{display:none!important} #worldViewport.in-battle{top:0!important;bottom:0!important}' });

  const scenes = [
    { file: '01-desert-firefight.jpg', map: 'desert', seed: 1409, faction: 0, enemy: 1, view: 'front' },
    { file: '02-desert-outpost.jpg', map: 'desert', seed: 1409, faction: 0, enemy: 1, view: 'base' },
    { file: '03-alien-frontier.jpg', map: 'alien-planet', seed: 24080, faction: 1, enemy: 2, view: 'front' },
    { file: '04-mothership-assault.jpg', map: 'mothership', seed: 43015, faction: 2, enemy: 0, view: 'front' }
  ];
  for (const scene of scenes) {
    const result = await page.evaluate(({ map, seed, faction, enemy, view }) => {
      const { game, ui, renderer } = Meridian;
      game.start({ map, seed, faction, enemies: [enemy], benefits: {}, enemyBenefits: [{}], depth: 6 });
      ui.paused = true;
      renderer.quality = 2;
      renderer.resize();
      const homes = [0, 1].map(team => game.alive(entity =>
        entity.kind === 'building' && entity.type === 'hq' && entity.team === team)[0]);

      function clearBuilding(type, x, z) {
        const radius = BUILDINGS[type].size, limit = game.world.extent - radius - 3;
        if (Math.abs(x) > limit || Math.abs(z) > limit) return false;
        for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++)
          if (game.world.blockedAt(x + dx, z + dz)) return false;
        return !game.alive(entity => Math.hypot(entity.x - x, entity.z - z) < entity.size + radius + 1.7).length;
      }
      function addBuilding(type, team, index) {
        const home = homes[team], toward = Math.atan2(-home.z, -home.x), start = 10 + index * 4;
        for (let ring = start; ring < start + 26; ring += 2) for (let step = 0; step < 32; step++) {
          const angle = toward + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * Math.PI / 20,
            x = home.x + Math.cos(angle) * ring, z = home.z + Math.sin(angle) * ring;
          if (!clearBuilding(type, x, z)) continue;
          const building = game.spawnBuilding(type, x, z, team, game.factionFor(team));
          game.world.rebuild(game.s.entities);
          return building;
        }
        return null;
      }
      for (const team of [0, 1])
        ['barracks', 'factory', 'depot', 'turret', 'depot', 'depot', 'depot'].forEach((type, index) => addBuilding(type, team, index));
      game.world.rebuild(game.s.entities);

      const armies = [[], []];
      function addUnit(type, team, x, z, rot) {
        const entity = game.spawnUnit(type, x, z, team, game.factionFor(team), { rot, walk: 2.2 });
        if (entity && type !== 'worker') armies[team].push(entity.id);
        return entity;
      }
      for (const team of [0, 1]) {
        const home = homes[team], angle = Math.atan2(-home.z, -home.x), dx = Math.cos(angle), dz = Math.sin(angle),
          sideX = -dz, sideZ = dx;
        for (let i = 0; i < 5; i++) addUnit('worker', team, home.x + dx * 8 + sideX * (i - 2) * 2, home.z + dz * 8 + sideZ * (i - 2) * 2, angle);
        for (let i = 0; i < 10; i++) addUnit('rifle', team, home.x + dx * 16 + sideX * ((i % 5) - 2) * 2, home.z + dz * 16 + sideZ * (Math.floor(i / 5) - .5) * 2, angle);
        for (const [index, type] of ['tank', 'artillery', 'medic', 'hero', 'air'].entries())
          addUnit(type, team, home.x + dx * 23 + sideX * (index - 2) * 3.5, home.z + dz * 23 + sideZ * (index - 2) * 3.5, angle);
      }
      // Close opposing formations create real weapon fire and effects during the capture window.
      for (const team of [0, 1]) {
        const side = team ? 1 : -1, angle = team ? Math.PI : 0;
        for (let i = 0; i < 12; i++) addUnit('rifle', team, side * (7 + (i % 6) * 1.7), -5 + Math.floor(i / 6) * 2.1, angle);
        for (const [index, type] of ['tank', 'tank', 'artillery', 'medic', 'air'].entries())
          addUnit(type, team, side * (5 + index * 2.4), 5 + index * .7, angle);
      }
      game.rehash();
      game.world.rebuild(game.s.entities);
      game.world.reveal(game.s.entities, [{ team: 0, x: 0, z: 0, r: game.world.extent * 3 }]);
      game.s.parties[0].account.alloy = 1280; game.s.parties[0].account.gas = 420; game.s.parties[0].account.energy = 88;
      game.command(armies[0], { type: 'attackMove', x: 13, z: 0 }, 0, false);
      game.command(armies[1], { type: 'attackMove', x: -13, z: 0 }, 1, false);
      const home = homes[0], length = Math.hypot(home.x, home.z) || 1;
      if (view === 'base') Object.assign(game.s.cam, {
        x: home.x - home.x / length * 19, z: home.z - home.z / length * 19, zoom: 51
      });
      else Object.assign(game.s.cam, { x: 0, z: 1, zoom: map === 'alien-planet' ? 64 : 60 });
      ui.selected = armies[0].slice(-7); ui.hover = null; ui.pointer.inside = false;
      ui.renderActions(); ui.updateHUD();
      ui.paused = view === 'base';
      return { entities: game.s.entities.length, view };
    }, scene);
    if (scene.view === 'front') await page.waitForTimeout(2200);
    await page.evaluate(() => { Meridian.ui.paused = true; });
    await page.waitForTimeout(120);
    const glError = await page.evaluate(() => Meridian.renderer.gl.getError());
    if (glError) throw new Error(`${scene.file}: WebGL error ${glError}`);
    await page.screenshot({ path: resolve(screenshots, scene.file), type: 'jpeg', quality: 92 });
    await cleanStyle.evaluate(element => element.remove());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { Meridian.renderer.resize(); Meridian.ui.updateHUD(); });
    await page.waitForTimeout(150);
    await page.screenshot({ path: resolve(mobileScreenshots, scene.file), type: 'jpeg', quality: 92 });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => Meridian.renderer.resize());
    cleanStyle = await page.addStyleTag({ content: '#hud{display:none!important} #worldViewport.in-battle{top:0!important;bottom:0!important}' });
    console.log(`Captured desktop and mobile ${scene.file} (${result.entities} entities)`);
  }

  async function imageData(file) {
    return `data:image/jpeg;base64,${(await readFile(resolve(screenshots, file))).toString('base64')}`;
  }
  async function compose(file, width, height, source, markup, style = '') {
    const art = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await art.setContent(`<!doctype html><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{background:#080e17 url('${await imageData(source)}') center/cover no-repeat}${style}</style>${markup}`);
    await art.screenshot({ path: resolve(output, file), type: 'jpeg', quality: 94 });
    await art.close();
  }
  await compose('background-2560x1440.jpg', 2560, 1440, '01-desert-firefight.jpg', '<div class="shade"></div>',
    '.shade{position:fixed;inset:0;background:radial-gradient(circle at center,#080e1718 20%,#080e1760 100%),linear-gradient(#04101b22,#04101b66)}');
  await compose('embed-background-1920x1080.jpg', 1920, 1080, '04-mothership-assault.jpg',
    '<div class="shade"></div><div class="label">MERIDIAN TACTICAL LINK<br><small>CLICK RUN GAME TO DEPLOY</small></div>',
    '.shade{position:fixed;inset:0;background:radial-gradient(circle at center,#080e1740,#080e1788 100%)}.label{position:fixed;left:55px;bottom:45px;padding-left:18px;border-left:2px solid #74e5d3;color:#eef3ed;font:18px/1.6 monospace;letter-spacing:3px;text-shadow:0 2px 8px #000}.label small{color:#edb875;font-size:12px}');
  await compose('banner-1920x600.jpg', 1920, 600, '01-desert-firefight.jpg',
    '<div class="shade"></div><div class="title"><strong>ASHES <i>OF</i><br>MERIDIAN</strong><span>A ROGUELITE REAL-TIME STRATEGY PROTOTYPE</span></div>',
    '.shade{position:fixed;inset:0;background:linear-gradient(90deg,#04101bf5 0%,#06131ecb 31%,#06131e38 64%,#06131e70),linear-gradient(0deg,#04101b80,transparent 55%)}.title{position:fixed;left:125px;top:115px;color:#eef3ed;text-shadow:0 3px 14px #000}.title strong{font:72px/.88 Georgia,serif;letter-spacing:2px}.title i{color:#edb875;font:16px monospace;letter-spacing:5px}.title span{display:block;margin-top:30px;color:#9fc9db;font:14px monospace;letter-spacing:4px}');

  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
  const notes = `Ashes of Meridian – itch.io media\n\nTheme colors\nBG:      #080e17\nBG 2:    #0b1522\nText:    #eef3ed\nLink:    #edb875\nEmbed 1: #080e17\nEmbed 2: #102d3d\n\nImages\nbackground-2560x1440.jpg  Background · Repeat: None · Align: Center · Fixed: enabled\nbanner-1920x600.jpg       Banner · Align: Center\nembed-background-1920x1080.jpg  Embed BG · suggested alpha: 35%\nscreenshots/*.jpg         Five clean gallery screenshots, 1920x1080\nscreenshots-mobile/*.jpg  Five portrait screenshots with UI, 390x844 mobile viewport\n\nSuggested theme: Anonymous Pro or Lato, Large, screenshot layout Sidebar.\nGenerated from the current local build with Chromium; scenes are arranged populated fixtures.\n`;
  await writeFile(resolve(output, 'README.txt'), notes);
  await writeFile(resolve(output, 'preview.html'), `<!doctype html><html><meta charset="utf-8"><title>Ashes of Meridian · itch.io preview</title><style>*{box-sizing:border-box}body{margin:0;background:#080e17 url('background-2560x1440.jpg') center top/cover fixed no-repeat;color:#eef3ed;font:18px/1.55 monospace}main{width:min(960px,100%);margin:auto;background:#0b1522;min-height:100vh;box-shadow:0 0 60px #000;padding-bottom:45px}.banner{display:block;width:100%}article{padding:30px}.embed{position:relative;margin-bottom:28px}.embed img,.shot{display:block;width:100%}.run{position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);padding:16px 25px;background:#edb875;color:#080e17;font-weight:bold}.colors{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:25px 0}.colors span{padding:10px;border:1px solid #eef3ed33}a{color:#edb875}h1{font-family:Georgia,serif;font-size:38px}.gallery{display:grid;grid-template-columns:1fr 1fr;gap:12px}</style><main><img class="banner" src="banner-1920x600.jpg"><article><h1>Media preview</h1><div class="embed"><img src="embed-background-1920x1080.jpg"><b class="run">▶ RUN GAME</b></div><p>Theme colors and the generated gallery in an approximation of the itch.io content column.</p><div class="colors"><span>BG<br>#080e17</span><span>BG 2<br>#0b1522</span><span>Text<br>#eef3ed</span><span style="color:#edb875">Link<br>#edb875</span><span>Embed 1<br>#080e17</span><span style="background:#102d3d">Embed 2<br>#102d3d</span></div><div class="gallery">${scenes.map(scene => `<img class="shot" src="screenshots-mobile/${scene.file}">`).join('')}<img class="shot" src="screenshots-mobile/05-expedition-command.jpg"></div></article></main></html>`);
  console.log(`Created itch.io media in ${output}`);
} finally {
  await browser.close();
}
