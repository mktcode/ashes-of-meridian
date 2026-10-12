/* Presentation adapter for the authoritative surface and its original landscape
 * field. Exterior terrain is scenery, never another playable surface. */
'use strict';
function battlefieldReliefField(playableExtent: number, surface: BattlefieldSurface, height: BattlefieldHeightField,
    extent: number, step: number, innerExtent = 0): WorldRelief {
  const size = Math.round(extent * 2 / step) + 3, heights = new Float32Array(size * size), colors = new Float32Array(size * size * 3);
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const px = (x - 1) * step - extent, pz = (z - 1) * step - extent, i = z * size + x,
      inside = Math.max(Math.abs(px), Math.abs(pz)) <= playableExtent,
      edge = Math.max(Math.abs(px), Math.abs(pz)),
      ex = clamp(px, -playableExtent, playableExtent), ez = clamp(pz, -playableExtent, playableExtent),
      fade = clamp(1 - (edge - playableExtent) / 32, 0, 1),
      exterior = inside ? 0 : height(px, pz) +
        (surface.heightAt(ex, ez) - height(ex, ez)) * fade * fade * (3 - 2 * fade);
    heights[i] = (inside ? surface.heightAt(px, pz) : exterior) - .13;
    colors[i * 3 + 1] = clamp((heights[i] - 25) / 22, 0, 1);
  }
  return { extent, step, size, heights, colors, innerExtent };
}
function buildBattlefieldTerrainView(builder: BattlefieldBuilder, surface: BattlefieldSurface, height: BattlefieldHeightField): void {
  const w = builder.world;
  builder.ground();
  w.renderData.placements.find(p => p.mesh === 'terrain')!.material = 'LANDSCAPE';
  w.renderData.geometries.push({ mesh: 'terrain', model: 'landscapeRelief',
      relief: battlefieldReliefField(w.extent, surface, height, w.extent, surface.step) },
    { mesh: 'dynamicBackdrop', model: 'landscapeRelief',
      relief: battlefieldReliefField(w.extent, surface, height, w.extent + 100, 5, w.extent) });
  builder.place('dynamicBackdrop', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0, 0, 1, 'static', 'LANDSCAPE');
  for (let i = 0; i < w.staticGrid.length; i++) {
    const p = w.point(i), shade = .7 + surface.heightAt(p.x, p.z) * .012;
    for (let c = 0; c < 3; c++) w.terrainColors[i * 4 + c] *= shade;
  }
}
