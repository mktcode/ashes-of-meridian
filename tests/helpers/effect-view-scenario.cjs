const { createHash } = require('node:crypto');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function effectViewSample(render) {
  const calls = [];
  const R = { add: (...args) => calls.push(['add', ...args]), beam: (...args) => calls.push(['beam', ...args]) };
  const common = { x: 2, y: 1, z: 3, life: .4, maxLife: 1, color: 0x99aabb };
  const effects = { fx: [
    { ...common, type: 'beam', tx: 4, ty: 2, tz: 5, width: .04 },
    { ...common, type: 'shell', tx: 4, tz: 5, startY: 1.45 },
    { ...common, type: 'blast', size: 2 },
    { ...common, type: 'particle', size: .1 },
    { ...common, type: 'smoke', size: 2 },
    { ...common, type: 'drop' },
    { ...common, x: 100, type: 'beam', tx: 4, ty: 2, tz: 5, width: .04 },
    { ...common, x: 100, type: 'drop' }
  ] };
  const world = { visible: [255, 0], idx: x => x > 90 ? 1 : 0 };
  const state = { time: 2, entities: [], parties: [],
    fields: [{ x: 1, z: 3, until: 10, type: 'bloom', r: 7 }, { x: 4, z: 5, until: 10, type: 'repair' }, { until: 1 }],
    scans: [{ x: 3, z: 4, until: 10 }, { until: 1 }],
    strikes: [{ type: 'shell' }, { x: 5, z: 6, type: 'flare', team: 1, at: 4, radius: 8 },
      { x: 8, z: 9, type: 'orbital', team: 0, at: 3 }]
  };
  const pings = [{ x: 3, z: 4, life: .5, maxLife: 1 }, { x: 4, z: 5, life: .1, maxLife: 1, color: 0xff00ff }];
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  }
  [effects, world, state, pings].forEach(freeze);
  render(R, effects, world, state, pings, 2.5);
  return { calls: calls.length, hash: digest(calls) };
}
module.exports = { effectViewSample };
