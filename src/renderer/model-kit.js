/* Synchronous model catalog and CPU-only mesh helpers. No GPU work at script load. */
'use strict';
function createEntityModelRegistry() {
  const models = new Map(), factories = new Map();
  return Object.freeze({
    register({ id, meshes = {}, render }) {
      if (!/^faction-\d+\/(building|unit)\/[a-z][a-z0-9-]*$/.test(id) || typeof render !== 'function')
        throw Error(`Invalid entity model: ${id}`);
      if (models.has(id)) throw Error(`Duplicate entity model: ${id}`);
      const entries = Object.entries(meshes);
      for (const [name, factory] of entries) {
        if (!/^[a-z][a-zA-Z0-9]*$/.test(name) || typeof factory !== 'function')
          throw Error(`Invalid model mesh: ${name}`);
        if (factories.has(name)) throw Error(`Duplicate model mesh: ${name}`);
      }
      // Validate the whole definition before changing either map.
      models.set(id, Object.freeze({ id, render }));
      for (const [name, factory] of entries) factories.set(name, factory);
    },
    find(entity) {
      return models.get(`faction-${entity.faction}/${entity.kind}/${entity.type}`);
    },
    upload(renderer) {
      // Also reject collisions with the renderer's existing primitive/terrain names.
      for (const name of factories.keys())
        if (Object.hasOwn(renderer.meshes, name)) throw Error(`Duplicate renderer mesh: ${name}`);
      for (const [name, factory] of factories) renderer.geometry(name, factory());
    }
  });
}
const EntityModels = createEntityModelRegistry();
const registerEntityModel = definition => EntityModels.register(definition);

const ModelMesh = Object.freeze({
  // Positive scales only. Rotation order matches MeridianRenderer.add: Y * X * Z.
  bake(out, mesh, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1,
    ry = 0, rx = 0, rz = 0, tint = [1, 1, 1] } = {}) {
    if (![sx, sy, sz].every(v => Number.isFinite(v) && v > 0)) throw Error('Invalid model scale');
    const cy = Math.cos(ry), ay = Math.sin(ry), cx = Math.cos(rx), ax = Math.sin(rx),
      cz = Math.cos(rz), az = Math.sin(rz);
    for (let i = 0; i < mesh.length; i += 27) {
      const points = [0, 9, 18].map(k => {
        const px = mesh[i + k] * sx, py = mesh[i + k + 1] * sy, pz = mesh[i + k + 2] * sz,
          xx = px * cz - py * az, yy = px * az + py * cz,
          vy = yy * cx - pz * ax, vz = yy * ax + pz * cx;
        return [x + xx * cy + vz * ay, y + vy, z - xx * ay + vz * cy];
      });
      const normal = V.norm(V.cross(V.sub(points[1], points[0]), V.sub(points[2], points[0])));
      for (let j = 0; j < 3; j++)
        out.push(...points[j], ...normal, ...tint.map((v, k) => v * mesh[i + j * 9 + 6 + k]));
    }
  },
  // Closed ribbed organic shell. Unlike the legacy sphere, poles have no collapsed faces.
  lobedShell(out, { x = 0, y = 0, z = 0, sx, sy, sz, lobes = 6, depth = .055,
    segments = 24, rings = 8, tint = [1, 1, 1] }) {
    if (![sx, sy, sz].every(v => Number.isFinite(v) && v > 0) ||
        !Number.isInteger(lobes) || lobes < 1 || !Number.isInteger(segments) || segments < lobes * 4 ||
        !Number.isInteger(rings) || rings < 3 || !Number.isFinite(depth) || depth < 0 || depth > .2)
      throw Error('Invalid organic shell dimensions');
    const point = (i, j) => {
      if (j === 0 || j === rings) return [x, y + (j === 0 ? sy : -sy), z];
      const a = (i % segments) / segments * Math.PI * 2, b = j / rings * Math.PI,
        r = Math.sin(b) * (1 + depth * Math.cos(lobes * a) * Math.sin(b));
      return [x + Math.cos(a) * r * sx, y + Math.cos(b) * sy, z + Math.sin(a) * r * sz];
    };
    for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
      const a = point(i, j), b = point(i + 1, j), c = point(i + 1, j + 1), d = point(i, j + 1),
        shade = tint.map(v => v * (.96 + .04 * Math.cos(i / segments * Math.PI * 2 * lobes)));
      if (j > 0) geom.tri(out, a, b, c, shade);
      if (j < rings - 1) geom.tri(out, a, c, d, shade);
    }
  },
  // Closed octagonal armor panel; 64 outward triangles, bevel on top and bottom.
  panel(out, { x = 0, y = 0, z = 0, w, h, d, bevel, tint = [1, 1, 1] }) {
    if (![w, h, d, bevel].every(v => Number.isFinite(v) && v > 0) || bevel >= Math.min(w, h, d) / 2)
      throw Error('Invalid armor panel dimensions');
    const ring = (inset, height) => {
      const a = w / 2 - inset, b = d / 2 - inset, c = Math.min(a, b) * .26;
      return [[-a+c,b], [a-c,b], [a,b-c], [a,-b+c],
        [a-c,-b], [-a+c,-b], [-a,-b+c], [-a,b-c]]
        .map(([px, pz]) => [x + px, height, z + pz]);
    };
    const rings = [ring(bevel, y-h/2), ring(0, y-h/2+bevel),
      ring(0, y+h/2-bevel), ring(bevel, y+h/2)];
    for (let i = 0; i < 8; i++) {
      const k = (i + 1) % 8;
      for (let j = 0; j < 3; j++) {
        const shade = tint.map(v => v * (j === 0 ? .8 : j === 2 ? 1.12 : 1));
        geom.tri(out, rings[j][i], rings[j][k], rings[j + 1][k], shade);
        geom.tri(out, rings[j][i], rings[j + 1][k], rings[j + 1][i], shade);
      }
      geom.tri(out, [x, y+h/2, z], rings[3][i], rings[3][k], tint);
      geom.tri(out, [x, y-h/2, z], rings[0][k], rings[0][i], tint.map(v => v * .8));
    }
  }
});
