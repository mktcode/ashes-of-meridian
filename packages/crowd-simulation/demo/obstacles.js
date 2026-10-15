'use strict';
const CrowdObstacles = [
  { x: 2.5, z: 0, width: 2, depth: 6, height: 3 },
  { x: -16, z: -12, width: 7, depth: 3, height: 2.8 },
  { x: 14, z: -14, width: 3, depth: 9, height: 3.2 },
  { x: -18, z: 10, width: 4, depth: 8, height: 3.5 },
  { x: 14, z: 12, width: 8, depth: 3, height: 2.5 },
  { x: 0, z: 19, width: 3, depth: 7, height: 3 },
  { x: 0, z: -20, width: 9, depth: 3, height: 3.2 },
  { x: 23, z: 1, width: 3, depth: 9, height: 2.6 },
  { x: -24, z: -2, width: 3, depth: 6, height: 2.8 },
];
for (const box of CrowdObstacles) {
  box.baseY = Math.min(...[-1, 1].flatMap(sx => [-1, 1].map(sz => CrowdTerrain.heightAt(box.x + sx * box.width / 2, box.z + sz * box.depth / 2)))) - 0.1;
  Object.freeze(box);
}
Object.freeze(CrowdObstacles);
