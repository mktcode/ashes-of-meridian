/* Pure markup; the shared renderer fills these canvases from the current model catalog. */
'use strict';
function renderModelThumbnail(faction: FactionId, kind: 'unit' | 'building', type: UnitType | BuildingType, className: string, zoom = 1) {
  return `<canvas class="${className}" data-model-faction="${faction}" data-model-kind="${kind}" data-model-type="${type}" data-model-zoom="${zoom}" aria-hidden="true"></canvas>`;
}
