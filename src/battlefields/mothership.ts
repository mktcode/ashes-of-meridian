/* An exposed flight deck within a much larger ship. No desert terrain or shared RNG phases. */
'use strict';
function mothershipLayout(): BattlefieldLayout {
  return {
    startSites: [{ x: -72, z: 78 }, { x: 72, z: -78 }, { x: -72, z: -78 }, { x: 72, z: 78 }],
    playerStart: { x: -72, z: 78 },
    enemySites: [{ x: 72, z: -78 }, { x: -72, z: -78 }, { x: 72, z: 78 }],
    centralClearings: [
      { x: 0, z: 0 }, { x: -28, z: 18 }, { x: 28, z: -18 },
      { x: -28, z: -18 }, { x: 28, z: 18 }
    ],
    outerClearings: [{ x: -108, z: 34 }, { x: 108, z: -34 }, { x: -34, z: -108 }, { x: 34, z: 108 }],
    resourceSites: [
      { x: -91.5, z: 73.5 }, { x: 81, z: -94 }, { x: -28, z: 20 }, { x: 28, z: -20 },
      { x: -88, z: -69 }, { x: 81, z: 62 }, { x: -12, z: -30 }, { x: 12, z: 30 }
    ],
    additionalClearings: [
      { x: -72, z: 101 }, { x: 72, z: -101 }, { x: -72, z: -101 }, { x: 72, z: 101 }
    ],
    corridors: [
      [[-72,78],[-72,23],[-30,0],[0,0],[30,0],[72,-23],[72,-78]],
      [[-72,-78],[-72,-23],[-30,0],[0,0],[30,0],[72,23],[72,78]],
      [[0,-82],[0,-45],[0,0],[0,45],[0,82]],
      [[-82,0],[-45,0],[0,0],[45,0],[82,0]]
    ]
  };
}

function populateMothership(builder: BattlefieldBuilder) {
  const { world, place } = builder, decor = builder.cosmeticRandom(0x4445434b);
  const groundHeight = (x: number, z: number) =>
    Math.max(Math.abs(x),Math.abs(z)) < world.extent ? world.surface!.heightAt(x,z) : 0;
  const part = (mesh: string, x: number, y: number, z: number, sx: number, sy: number, sz: number,
    yaw = 0, color = 0xffffff, glow = 0) =>
    place(mesh, x, y + groundHeight(x,z), z, sx, sy, sz, color, yaw, 0, 0, glow, 1, 'static', 'METAL');
  const models = ['shipHangar', 'shipHangarLights', 'shipPlant', 'shipCrate', 'shipTransport',
    'shipTransportLights', 'shipBridge', 'shipCargoPad', 'shipVentDock'];
  for (const model of models)
    world.renderData.geometries.push({ mesh: model, model, seed: world.terrainSeed, extent: world.extent });

  // Chamfered footprints match the visible foundations. The closed blast doors remain solid.
  const block = (model: 'shipHangar' | 'shipPlant', x: number, z: number,
      sx: number, h: number, sz: number, yaw = 0) => {
    const bevel = Math.min(sx,sz) * .2, local = [
        [-sx+bevel,-sz], [sx-bevel,-sz], [sx,-sz+bevel], [sx,sz-bevel],
        [sx-bevel,sz], [-sx+bevel,sz], [-sx,sz-bevel], [-sx,-sz+bevel]
      ], cs = Math.cos(yaw), sn = Math.sin(yaw),
      outline = local.map(([a,b]) => ({ x: x + a*cs+b*sn, z: z-a*sn+b*cs })),
      feature: WorldTerrainFeature = { x, z, width: sx, depth: sz, height: h, yaw, seed: world.terrainSeed, outline },
      clearance = world.cellSize * Math.SQRT1_2;
    world.renderData.features.push(feature);
    for (let i = 0; i < world.staticGrid.length; i++) {
      const p = world.point(i);
      if (insidePolygon(p,outline) || outline.some((a,j) =>
          pointSegment(p,a,outline[(j+1)%outline.length]) <= clearance))
        world.staticGrid[i] = world.terrainFeatureGrid[i] = 1;
    }
    part(model,x,-.1,z,sx,h,sz,yaw);
    if (model === 'shipHangar') part('shipHangarLights',x,-.1,z,sx,h,sz,yaw,0xffffff,1.15);
  };

  // Four cardinal hangars frame the combat deck; service plants break up the open middle symmetrically.
  block('shipHangar',-104,0,18,13,14,Math.PI/2);
  block('shipHangar',104,0,18,13,14,-Math.PI/2);
  block('shipHangar',0,-104,17,12,12,0);
  block('shipHangar',0,104,17,12,12,Math.PI);
  for (const x of [-52,52]) for (const z of [-31,31])
    block('shipPlant',x,z,9,6,7,(x*z > 0 ? 1 : -1)*Math.PI/2);

  // The same architecture continues onto the non-playable carrier hull, so the arena reads as one deck section.
  for (const side of [-1,1]) for (const z of [-102,-42,30,98]) {
    const x = side*(world.extent+34+decor()*5), y = 13+decor()*4,
      sx = 18+decor()*4, sz = 14+decor()*3, yaw = -side*Math.PI/2;
    part('shipHangar',x,-.1,z,sx,y,sz,yaw);
    part('shipHangarLights',x,-.1,z,sx,y,sz,yaw,0xffffff,.95);
    for (let i = 0; i < 3; i++)
      part('shipCrate',x+side*(sz+3.5),0,z+(i-1)*7,1.8+decor()*.7,2+decor()*1.5,2.2,
        decor()*.18,side<0?0x718994:0x9b8668);
  }
  for (const side of [-1,1]) for (const x of [-76,76]) {
    const z = side*(world.extent+39+decor()*4), y = 12+decor()*4,
      sx = 17+decor()*3, sz = 13+decor()*3, yaw = side < 0 ? 0 : Math.PI;
    part('shipHangar',x,-.1,z,sx,y,sz,yaw);
    part('shipHangarLights',x,-.1,z,sx,y,sz,yaw,0xffffff,.95);
  }
  part('shipBridge',0,-.1,-world.extent-57,28,35,24);
  for (const side of [-1,1]) for (const axis of [-1,1]) {
    const x = axis === -1 ? side*(world.extent+16) : side*52,
      z = axis === -1 ? side*-74 : side*(world.extent+23), yaw = side*Math.PI/11+(axis===1?Math.PI/2:0);
    part('shipTransport',x,.5,z,8,5,17,yaw);
    part('shipTransportLights',x,.5,z,8,5,17,yaw,0xffffff,1.1);
  }

  // Cargo frames and sockets follow the authoritative surface at each unchanged resource entity.
  for (const [i,p] of world.layout.resourceSites.entries()) {
    part('shipCargoPad',p.x,-.12,p.z,1,1,1,(i%2?1:-1)*.08);
    part('shipVentDock',p.x+(i?7:5),-.1,p.z+(i?7:18),1,1,1,i*.37);
  }

  // Grounded meshes add panel rhythm, runway guidance and emissive edge lighting without collision or RNG.
  for (const [model,glow] of [['shipDeckMarks',0],['shipDeckLights',1.15]] as const) {
    world.renderData.geometries.push({ mesh: model, model, seed: world.terrainSeed, extent: world.extent, grounded: true });
    place(model,0,0,0,1,1,1,0xffffff,0,0,0,glow,1,'static','METAL');
  }
  builder.boundary('shipOuterDeck','GROUND');
  builder.boundary('shipHull','METAL');
}

const MOTHERSHIP_BATTLEFIELD: BattlefieldDefinition = {
  name: 'MOTHERSHIP',
  size: { extent: 120, cellSize: 2.5 },
  layout: mothershipLayout(),
  palette: { ground: 0x424f5d, rock: 0xffffff, accent: 0xf0b764, flora: 0x79aab5 },
  render: {
    groundTexture: 'metal', skyTexture: 'sky',
    rockDecor: { density: 0, opacity: 0 }, shrubDecor: { density: 0, opacity: 0 },
    haze: [.035,.055,.09], terrainReceiverHeight: 16,
    lighting: { sun: [1.12,.98,.84], sky: [.30,.40,.55], bounce: [.13,.18,.25] }
  },
  worldEvent: 'solarFlare',
  generate(builder) {
    const world = builder.world;
    world.surface = new BattlefieldSurface(world.extent, world.cellSize, (x,z) => {
      const ax = Math.abs(x), az = Math.abs(z),
        // A rounded rectangular pod in each quadrant, separated from the hull by a low service trench.
        qx = Math.abs(ax-72)-(36-14), qz = Math.abs(az-79)-(33-14),
        roundedDistance = Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-14;
      let deck = clamp(-roundedDistance/5,0,1);
      // Wide tapered assault ramps point inward; separate flank ramps meet the transverse service lanes.
      const main = clamp((az-23)/27,0,1);
      if (Math.abs(ax-72) <= 10+main*8) deck = Math.max(deck,main);
      const flank = clamp((ax-18)/24,0,1);
      if (Math.abs(az-79) <= 9+flank*7) deck = Math.max(deck,flank);
      return deck*6;
    }, height => height >= 3 ? 1 : 0);
    world.staticGrid.set(world.surface.cliffs);
    world.terrainFeatureGrid.set(world.surface.cliffs);
    builder.ground();
    for (let i = 0; i < world.staticGrid.length; i++) {
      const p = world.point(i), height = world.surface.heightAt(p.x,p.z),
        shade = 1 + height*.036 + (height < .1 ? .02*Math.cos(p.x*.08-p.z*.05) : 0);
      for (let c = 0; c < 3; c++) world.terrainColors[i*4+c] *= shade;
    }
    populateMothership(builder);
  }
};
