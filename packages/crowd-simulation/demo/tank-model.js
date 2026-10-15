'use strict';

// Deliberately rigid placeholder: no suspension, track animation, turret aiming or vehicle steering.
const TankModel = (() => {
  const armor = [0.32, 0.43, 0.29], track = [0.16, 0.18, 0.19], steel = [0.28, 0.31, 0.32];
  const parts = [
    { name: 'leftTrack', center: [-0.72, 0.22, 0], size: [0.38, 0.44, 2.1], color: track },
    { name: 'rightTrack', center: [0.72, 0.22, 0], size: [0.38, 0.44, 2.1], color: track },
    { name: 'hull', center: [0, 0.48, -0.08], size: [1.45, 0.42, 1.8], color: armor },
    { name: 'deck', center: [0, 0.73, -0.1], size: [1.2, 0.14, 1.45], color: armor },
    { name: 'turret', center: [0, 0.96, -0.13], size: [0.95, 0.4, 0.85], color: armor },
    { name: 'barrel', center: [0, 1, 0.86], size: [0.13, 0.13, 0.96], color: steel },
    { name: 'muzzle', center: [0, 1, 1.25], size: [0.2, 0.19, 0.18], color: steel },
    { name: 'hatch', center: [0, 1.2, -0.18], size: [0.4, 0.08, 0.4], color: steel },
    { name: 'rearGrille', center: [0, 0.58, -0.98], size: [0.7, 0.12, 0.07], color: track },
    ...[-0.5, 0.5].map((x, i) => ({ name: `light${i}`, center: [x, 0.6, 0.86], size: [0.15, 0.1, 0.05], color: [0.6, 0.85, 0.9] })),
  ];
  function sampleRoot(unit) {
    const radius = CrowdProfiles.tank.radius, step = CrowdTerrain.cellSize;
    let y = -Infinity;
    // Enclose complete terrain triangles, so the rigid flat underside never cuts a hill.
    // This intentionally allows hovering on slopes rather than pretending to provide suspension.
    const left = Math.floor((unit.x - radius) / step), right = Math.ceil((unit.x + radius) / step);
    const back = Math.floor((unit.z - radius) / step), front = Math.ceil((unit.z + radius) / step);
    for (let z = back; z <= front; z++) for (let x = left; x <= right; x++) y = Math.max(y, CrowdTerrain.heightAt(x * step, z * step));
    const c = Math.cos(unit.yaw), s = Math.sin(unit.yaw);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, unit.x, y + 0.02, unit.z, 1];
  }
  return { parts, armor, sampleRoot, cullingRadius: 4 };
})();
