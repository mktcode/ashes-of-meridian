'use strict';
// Stable bridge for the unchanged reference rigs and camera. No synthetic terrain/obstacles.
const CrowdObstacles = Object.freeze([]);
const CrowdTerrain = {
  halfSize: 320, cellSize: 2, source: null,
  use(source) { this.source = source; },
  heightAt(x, z) { return this.source.heightAt(x, z); },
  sample(x, z) { return this.source.sample(x, z); },
  pick(x, y, camera) { return this.source?.pick(x, y, camera) ?? null; },
};
