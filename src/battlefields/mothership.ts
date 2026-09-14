/* An exposed flight deck within a much larger ship. No desert terrain or shared RNG phases. */
'use strict';
function mothershipLayout(): BattlefieldLayout {
  return {
    startSites: [{ x: -42, z: 58 }, { x: 42, z: -58 }, { x: -42, z: -58 }, { x: 42, z: 58 }],
    playerStart: { x: -42, z: 58 },
    enemySites: [{ x: 42, z: -58 }, { x: -42, z: -58 }, { x: 42, z: 58 }],
    centralClearings: [{ x: 0, z: 0 }, { x: -14, z: 28 }, { x: 14, z: -28 }],
    outerClearings: [{ x: -80, z: 32 }, { x: 80, z: -32 }],
    resourceSites: [
      { x: -62, z: 53 }, { x: 58, z: -52 }, { x: -29, z: 15 }, { x: 29, z: -15 },
      { x: -64, z: -41 }, { x: 64, z: 41 }, { x: -16, z: -65 }, { x: 16, z: 65 }
    ],
    additionalClearings: [{ x: -42, z: 75 }, { x: 42, z: -75 }],
    corridors: [
      [[-42,58],[-14,28],[14,-28],[42,-58]],
      [[0,-83],[0,83]],
      [[-42,58],[-80,36],[-80,-40],[-33,-51],[42,-58]],
      [[-42,58],[33,51],[80,40],[80,-36],[42,-58]]
    ]
  };
}

function populateMothership(builder: BattlefieldBuilder) {
  const { world, place } = builder, decor = builder.cosmeticRandom(0x4445434b);
  const part = (mesh: string, x: number, y: number, z: number, sx: number, sy: number, sz: number,
    yaw = 0, color = 0xffffff, glow = 0) =>
    place(mesh, x, y, z, sx, sy, sz, color, yaw, 0, 0, glow, 1, 'static', 'METAL');
  for (const model of ['shipHangar', 'shipHangarLights', 'shipPlant', 'shipCrate', 'shipTransport',
    'shipTransportLights', 'shipBridge', 'shipCargoPad', 'shipVentDock'])
    world.renderData.geometries.push({ mesh: model, model, seed: world.seed, extent: world.extent });

  // Closed hangars and machinery islands have honest rectangular ground footprints.
  // Their approaches are deliberately open; the detailed door graphics are not traversable portals.
  const block = (model: string, x: number, z: number, sx: number, h: number, sz: number, yaw = 0) => {
    // Quarter-turn roundoff must not drop cells exactly on a padded rectangle edge.
    const snap = (v: number) => Math.abs(v) < 1e-12 ? 0 : v,
      cs = snap(Math.cos(yaw)), sn = snap(Math.sin(yaw)),
      outline = [[-sx,-sz],[sx,-sz],[sx,sz],[-sx,sz]].map(([a,b]) => ({ x: x + a*cs+b*sn, z: z-a*sn+b*cs })),
      feature: WorldTerrainFeature = { x, z, width: sx, depth: sz, height: h, yaw, seed: world.seed, outline };
    world.renderData.features.push(feature);
    for (let i = 0; i < world.staticGrid.length; i++) {
      const p = world.point(i), dx = p.x-x, dz = p.z-z;
      if (Math.abs(dx*cs-dz*sn) <= sx+world.cellSize*.5 && Math.abs(dx*sn+dz*cs) <= sz+world.cellSize*.5)
        world.staticGrid[i] = world.terrainFeatureGrid[i] = 1;
    }
    part(model,x,-.1,z,sx,h,sz,yaw);
    if (model === 'shipHangar') part('shipHangarLights',x,-.1,z,sx,h,sz,yaw,0xffffff,.8);
  };
  block('shipHangar',-59,0,16,12,12,Math.PI/2);
  block('shipHangar',59,0,16,12,12,-Math.PI/2);
  block('shipHangar',-58,-69,15,10,10);
  block('shipHangar',58,69,15,10,10,Math.PI);
  block('shipPlant',-31,-29,9,5,6);
  block('shipPlant',31,29,9,5,6,Math.PI);

  // The same industrial modules continue beyond the playable bounds, at a larger scale.
  for (const side of [-1,1]) for (const z of [-112,-49,22,99]) {
    const x = side*(world.extent+43+decor()*5), y = 14+decor()*5,
      sx = 20+decor()*4, sz = 15+decor()*3, yaw = -side*Math.PI/2;
    part('shipHangar',x,-.1,z,sx,y,sz,yaw);
    part('shipHangarLights',x,-.1,z,sx,y,sz,yaw,0xffffff,.7);
    for (let i = 0; i < 4; i++)
      part('shipCrate',x+side*(sz+4),0,z+(i-1.5)*7,2+decor(),2+decor()*2,2.4,0,side<0?0x748b94:0x958276);
  }
  part('shipBridge',0,-.1,-world.extent-30,23,32,21);
  for (const side of [-1,1]) {
    part('shipTransport',side*(world.extent+15),.6,side*-68,8,5,17,side*Math.PI/12);
    part('shipTransportLights',side*(world.extent+15),.6,side*-68,8,5,17,side*Math.PI/12,0xffffff,.85);
  }

  // Cargo securing frames and service sockets contextualize the unchanged resource entities.
  for (const [i,p] of world.layout.resourceSites.entries()) {
    part('shipCargoPad',p.x,-.12,p.z,1,1,1);
    part('shipVentDock',p.x+(i?7:5),-.1,p.z+(i?7:18),1,1,1);
  }
  // Low painted deck furniture, no invisible cargo obstacles or extra simulation RNG.
  builder.boundary('shipDeckPaint','METAL');
}

const MOTHERSHIP_BATTLEFIELD: BattlefieldDefinition = {
  name: 'MOTHERSHIP',
  size: { extent: 90, cellSize: 2.5 },
  layout: mothershipLayout(),
  palette: { ground: 0x475462, rock: 0xffffff, accent: 0xe7be88, flora: 0x718b99 },
  render: {
    groundTexture: 'metal', skyTexture: 'sky', groundPixelsPerMeter: 28, groundMirror: true,
    rockDecor: { density: 0, opacity: 0 }, shrubDecor: { density: 0, opacity: 0 },
    haze: [.055,.075,.11]
  },
  worldEvent: 'solarFlare',
  generate(builder) {
    builder.ground();
    builder.boundary('shipOuterDeck','GROUND');
    builder.boundary('shipHull','METAL');
    populateMothership(builder);
  }
};
