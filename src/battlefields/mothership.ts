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
      { x: -62, z: -51 }, { x: 62, z: 50 }, { x: -8, z: -60 }, { x: 5, z: 58 }
    ],
    additionalClearings: [{ x: -42, z: 75 }, { x: 42, z: -75 }],
    corridors: [
      [[-42,58],[-42,12],[0,0],[42,-12],[42,-58]],
      [[0,-83],[0,83]],
      [[-42,58],[-30,58],[-30,78],[0,78],[30,78],[30,58],[42,58]],
      [[-42,-58],[-30,-58],[-30,-78],[0,-78],[30,-78],[30,-58],[42,-58]]
    ]
  };
}

function populateMothership(builder: BattlefieldBuilder) {
  const { world, place } = builder, decor = builder.cosmeticRandom(0x4445434b);
  const part = (mesh: string, x: number, y: number, z: number, sx: number, sy: number, sz: number,
    yaw = 0, color = 0xffffff, glow = 0) =>
    place(mesh, x, y + (Math.max(Math.abs(x),Math.abs(z)) < world.extent ? world.surface!.heightAt(x,z) : 0),
      z, sx, sy, sz, color, yaw, 0, 0, glow, 1, 'static', 'METAL');
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
  block('shipHangar',-58,-72.5,15,10,10);
  block('shipHangar',58,72.5,15,10,10,Math.PI);
  block('shipPlant',-65,-25,9,5,6);
  block('shipPlant',65,25,9,5,6,Math.PI);

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
  builder.boundary('shipDeckPaint','METAL', true);
}

const MOTHERSHIP_BATTLEFIELD: BattlefieldDefinition = {
  name: 'MOTHERSHIP',
  size: { extent: 90, cellSize: 2.5 },
  layout: mothershipLayout(),
  palette: { ground: 0x475462, rock: 0xffffff, accent: 0xe7be88, flora: 0x718b99 },
  render: {
    groundTexture: 'metal', skyTexture: 'sky', groundPixelsPerMeter: 28, groundMirror: true,
    rockDecor: { density: 0, opacity: 0 }, shrubDecor: { density: 0, opacity: 0 },
    haze: [.055,.075,.11],
    lighting: { sun: [.88, 1.00, 1.14], sky: [.36, .44, .56], bounce: [.19, .22, .28] }
  },
  worldEvent: 'solarFlare',
  generate(builder) {
    const world = builder.world;
    world.surface = new BattlefieldSurface(world.extent, world.cellSize, (x,z) => {
      const ax = Math.abs(x), az = Math.abs(z);
      // Four public high decks; central floor remains low regardless of deployed parties.
      let deck = Math.min(clamp((ax-19.5)/2.5,0,1), clamp((az-35.5)/2.5,0,1));
      // Broad inward ramp and a separate rear/flank ramp for every starting deck.
      if (ax >= 30 && ax <= 55) deck = Math.max(deck, clamp((az-18)/20,0,1));
      if (az >= 72 && az <= 84) deck = Math.max(deck, clamp((ax-2)/20,0,1));
      return deck * 6;
    }, height => height >= 3 ? 1 : 0);
    world.staticGrid.set(world.surface.cliffs);
    world.terrainFeatureGrid.set(world.surface.cliffs);
    builder.ground();
    for (let i = 0; i < world.staticGrid.length; i++) {
      const p = world.point(i), shade = 1 + world.surface.heightAt(p.x,p.z) * .045;
      for (let c = 0; c < 3; c++) world.terrainColors[i*4+c] *= shade;
    }
    builder.boundary('shipOuterDeck','GROUND');
    builder.boundary('shipHull','METAL');
    populateMothership(builder);
  }
};
