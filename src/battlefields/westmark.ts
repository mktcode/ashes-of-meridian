/* A playable adaptation of the Westmark valley. Rivers, decks and blockers are
 * CPU-owned; scenery never depends on GPU quality or the simulation RNG. */
'use strict';
const WESTMARK_SCALE = 1 / 3;
const WESTMARK_FLOOR = 10;
function westmarkLayout(): BattlefieldLayout {
  const starts: BattlefieldLayout['startSites'] = [
    {x:-83,z:-74}, {x:83,z:-74}, {x:-83,z:78}, {x:83,z:78}
  ];
  return {
    startSites: starts, playerStart: starts[0], enemySites: starts.slice(1),
    resourceSites: [{x:-101,z:-74},{x:101,z:-74},{x:-101,z:78},{x:101,z:78},
      {x:-30,z:-24},{x:0,z:-34},{x:-27,z:11},{x:15,z:5}],
    centralClearings: [{x:0,z:0}], outerClearings: [], additionalClearings: [],
    corridors: WESTMARK_SOURCE.roads.map(road => road.map(([x,z]) => [x*WESTMARK_SCALE,z*WESTMARK_SCALE]))
  };
}
const WESTMARK_RIVERS = WESTMARK_SOURCE.rivers.map(river => river.map(([x,y,z,r]) =>
  ({x:x*WESTMARK_SCALE,z:z*WESTMARK_SCALE,y:8+(y-6)*.12,r:r*WESTMARK_SCALE})));
const WESTMARK_SEGMENTS = WESTMARK_RIVERS.flatMap(river => river.slice(1).map((b,i) => {
  const a=river[i], dx=b.x-a.x,dz=b.z-a.z;
  return {a,b,dx,dz,length2:dx*dx+dz*dz};
}));
// Spatial bins bound river queries to nearby segments, including bank/clearance
// margins. Distant scenery needs no exact nearest river. Shared immutable source
// indexing is identical in the browser and the Node host.
const WESTMARK_RIVER_BINS = (() => {
  const bins = new Map<string, typeof WESTMARK_SEGMENTS>();
  for (const s of WESTMARK_SEGMENTS) {
    const margin = Math.max(s.a.r,s.b.r)+20;
    for(let z=Math.floor((Math.min(s.a.z,s.b.z)-margin)/16);z<=Math.floor((Math.max(s.a.z,s.b.z)+margin)/16);z++)
      for(let x=Math.floor((Math.min(s.a.x,s.b.x)-margin)/16);x<=Math.floor((Math.max(s.a.x,s.b.x)+margin)/16);x++) {
        const key=`${x},${z}`,list=bins.get(key)??[];list.push(s);bins.set(key,list);
      }
  }
  return bins;
})();
function westmarkRiver(x: number,z: number) {
  const {Math}=globalThis;
  let best=Infinity, px=0,pz=0,y=8,r=4,dx=1,dz=0;
  for (const s of WESTMARK_RIVER_BINS.get(`${Math.floor(x/16)},${Math.floor(z/16)}`)??[]) {
    // Cheap conservative rejection before projecting onto the segment.
    if (x < Math.min(s.a.x,s.b.x)-best || x > Math.max(s.a.x,s.b.x)+best ||
        z < Math.min(s.a.z,s.b.z)-best || z > Math.max(s.a.z,s.b.z)+best) continue;
    const t=Math.max(0,Math.min(1,((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/(s.length2||1))),
      sx=s.a.x+s.dx*t,sz=s.a.z+s.dz*t,d=Math.hypot(x-sx,z-sz);
    if(d<best) {best=d;px=sx;pz=sz;y=s.a.y+(s.b.y-s.a.y)*t;r=s.a.r+(s.b.r-s.a.r)*t;dx=s.dx;dz=s.dz;}
  }
  return {x:px,z:pz,y,r,d:best,bank:best-r,dx,dz};
}
function westmarkBridges(): WorldTerrainFeature[] {
  return [[112,-160],[-157,91],[129,75]].map(([x,z],i) => {
    const p=westmarkRiver(x*WESTMARK_SCALE,z*WESTMARK_SCALE);
    // Local X crosses the river. 22 m decks leave room for opposing vehicles,
    // even after conservative cell rasterization and existing body clearance.
    return {x:p.x,z:p.z,width:p.r+10,depth:11,height:WESTMARK_FLOOR,
      yaw:Math.atan2(-p.dx,-p.dz),seed:i,outline:[]};
  });
}
function westmarkBridgePoint(b: WorldTerrainFeature,x: number,z: number) {
  const {Math}=globalThis;
  const dx=x-b.x,dz=z-b.z,c=Math.cos(b.yaw),s=Math.sin(b.yaw);
  return {u:dx*c-dz*s,v:dx*s+dz*c};
}
function westmarkDeckHeight(b: WorldTerrainFeature,u: number) {
  return WESTMARK_FLOOR+(b.height-WESTMARK_FLOOR)*clamp((b.width-Math.abs(u))/7,0,1);
}
function westmarkSourceHeight(x: number,z: number) {
  const {Math}=globalThis,clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
  const n=WESTMARK_SOURCE.size,gx=clamp((x+160)/320*(n-1),0,n-1),gz=clamp((z+160)/320*(n-1),0,n-1),
    ix=Math.min(n-2,Math.floor(gx)),iz=Math.min(n-2,Math.floor(gz)),u=gx-ix,v=gz-iz,h=WESTMARK_SOURCE.heights,
    a=h[iz*n+ix],b=h[iz*n+ix+1],c=h[(iz+1)*n+ix],d=h[(iz+1)*n+ix+1];
  return ((a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v)/65535*320-64;
}
function westmarkPlan(layout: BattlefieldLayout) {
  const {Math}=globalThis,clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
  const bridges=westmarkBridges(),vents=layout.resourceSites.map((p,i)=>({x:p.x+(i?7:5),z:p.z+(i?7:18)})),
    reserves=[...layout.startSites.map(p=>({...p,r:30})),...layout.resourceSites.map(p=>({...p,r:12})),
      ...vents.map(p=>({...p,r:8})),{x:0,z:0,r:14}],
    routes=[...layout.corridors.map(route=>route.map(([x,z])=>({x,z}))),
      ...layout.startSites.map((p,i)=>[p,{x:WESTMARK_SOURCE.roads[i][0][0]/3,z:WESTMARK_SOURCE.roads[i][0][1]/3}]),
      ...layout.resourceSites.map((p,i)=>[p,i<4?layout.startSites[i]:{x:0,z:0}])],
    lanes=routes.flatMap(route=>route.slice(1).map((b,i)=>[route[i],b] as const));
  const segments=lanes.map(([a,b])=>({a,dx:b.x-a.x,dz:b.z-a.z,length2:(b.x-a.x)**2+(b.z-a.z)**2,
    left:Math.min(a.x,b.x)-18,right:Math.max(a.x,b.x)+18,top:Math.min(a.z,b.z)-18,bottom:Math.max(a.z,b.z)+18}));
  const road=(x:number,z:number)=>{
    let best=18*18;
    for(const s of segments) {
      if(x<s.left||x>s.right||z<s.top||z>s.bottom)continue;
      const t=clamp(((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/(s.length2||1),0,1),dx=x-s.a.x-s.dx*t,dz=z-s.a.z-s.dz*t;
      best=Math.min(best,dx*dx+dz*dz);
    }
    return Math.sqrt(best);
  };
  const reserve=(x:number,z:number)=>{
    let best=Infinity;
    for(const p of reserves)best=Math.min(best,Math.hypot(x-p.x,z-p.z)-p.r);
    return best;
  };
  const bed=(x:number,z:number)=>{
    const river=westmarkRiver(x,z),raw=westmarkSourceHeight(x,z),
      edge=Math.max(Math.abs(x),Math.abs(z)),outside=Math.max(0,edge-160),
      // Flatten meadow lowlands for construction; retain the source's rocky hills/rim.
      mountain=Math.max(0,raw-28)*.14,
      grade=clamp(Math.min(reserve(x,z),road(x,z)-7)/10,0,1);
    let h=WESTMARK_FLOOR+mountain*grade;
    if(outside>0) h+=Math.min(28,outside*.16)*(1+.2*Math.sin(x*.038)*Math.cos(z*.043));
    if(river.bank<3 && edge<164) {
      const t=clamp((river.bank+1)/4,0,1),blend=t*t*(3-2*t);
      h=(river.y-1.7)*(1-blend)+h*blend;
    }
    return h;
  };
  const bridgeAt=(x:number,z:number,margin=0)=>bridges.find(b=>{
    const p=westmarkBridgePoint(b,x,z);return Math.abs(p.u)<b.width+margin&&Math.abs(p.v)<b.depth+margin;
  });
  const height=(x:number,z:number)=>{
    const b=bridgeAt(x,z);
    return b?westmarkDeckHeight(b,westmarkBridgePoint(b,x,z).u):bed(x,z);
  };
  return {bridges,vents,reserves,lanes,road,reserve,bed,bridgeAt,height};
}
const WESTMARK_BATTLEFIELD: BattlefieldDefinition = {
  name:'WESTMARK',size:{extent:160,cellSize:2.5},layout:westmarkLayout(),startHeight:WESTMARK_FLOOR,
  palette:{ground:0x637344,rock:0x828783,accent:0xbad49c,flora:0x355b3a},
  render:{groundTexture:'westmarkMeadow',skyTexture:'sky',
    rockSurface:{texture:'westmarkGranite',metersPerTile:9},
    landscape:{earth:'westmarkEarth',bark:'westmarkBark',foliage:'westmarkSpruce'},
    daylight:true,rockDecor:{density:0,opacity:0},shrubDecor:{density:0,opacity:0},
    haze:[.48,.59,.63],terrainReceiverHeight:55,
    lighting:{sun:[1.10,1.03,.88],sky:[.37,.46,.53],bounce:[.20,.23,.15]}},
  worldEvent:null,
  generate(builder) {
    const {Math}=globalThis;
    const w=builder.world,plan=westmarkPlan(w.layout),surface=w.surface=new BattlefieldSurface(w.extent,w.cellSize,plan.height);
    // No extra high-ground visibility rule: rolling meadow and bridges share one sight tier.
    surface.buildBlocked=new Uint8Array(w.staticGrid.length);
    for(let i=0;i<w.staticGrid.length;i++) {
      const p=w.point(i),river=westmarkRiver(p.x,p.z),b=plan.bridgeAt(p.x,p.z,2),
        margin=w.cellSize*Math.SQRT1_2,local=b?westmarkBridgePoint(b,p.x,p.z):null,
        crossing=b&&local&&Math.abs(local.v)<b.depth-1-margin&&Math.abs(local.u)<b.width+2,
        water=river.bank<margin+.5,
        rim=westmarkSourceHeight(p.x,p.z)>58&&plan.reserve(p.x,p.z)>0&&plan.road(p.x,p.z)>7;
      if(water&&!crossing || rim || b&&local&&Math.abs(local.v)>b.depth-1-margin&&Math.abs(local.u)<b.width-1)
        surface.cliffs[i]=1;
      // Replace bridge-side slope rasterization only inside a deck's clear passage.
      if(crossing) surface.cliffs[i]=0;
      if(water||plan.bridgeAt(p.x,p.z,3)) surface.buildBlocked[i]=1;
    }
    builder.ground();
    const terrain=w.renderData.placements.find(p=>p.mesh==='terrain')!;
    terrain.material='LANDSCAPE';
    // The generic foundation slab would show through the lowered river bed.
    w.renderData.placements=w.renderData.placements.filter(p=>p.mesh!=='box');
    const relief=(extent:number,step:number,innerExtent=0):WorldRelief=>{
      const size=Math.round(extent*2/step)+3,heights=new Float32Array(size*size),colors=new Float32Array(size*size*3);
      for(let z=0;z<size;z++) for(let x=0;x<size;x++) {
        const wx=(x-1)*step-extent,wz=(z-1)*step-extent,i=z*size+x,
          within=Math.max(Math.abs(wx),Math.abs(wz))<=w.extent,
          h=within?surface.heightAt(wx,wz):plan.bed(wx,wz),bridge=plan.bridgeAt(wx,wz),
          // The river bed remains visible under the visual arch; the CPU floor there is the deck.
          ground=bridge?plan.bed(wx,wz):h;
        heights[i]=ground-.13;
        const river=westmarkRiver(wx,wz),stone=clamp((ground-11)/5,0,1);
        // Negative snow weights identify damp sediment without changing the CPU shore.
        const wet=river.bank<4?clamp((river.y+1.8-ground)/3.5,0,1):0;
        colors.set([clamp(1-plan.road(wx,wz)/2.2,0,1)*(river.bank>2?1:0),
          stone,wet>0?-wet:clamp((ground-39)/12,0,.85)],i*3);
      }
      return {extent,step,size,heights,innerExtent,colors};
    };
    const ground=relief(w.extent,surface.step),water:WorldRelief={...ground,
      heights:new Float32Array(ground.heights.length),colors:new Float32Array(ground.heights.length*3)};
    for(let row=0;row<ground.size;row++)for(let col=0;col<ground.size;col++) {
      const i=row*ground.size+col,x=(col-1)*ground.step-ground.extent,z=(row-1)*ground.step-ground.extent,
        river=westmarkRiver(x,z),length=Math.hypot(river.dx,river.dz)||1;
      water.heights[i]=river.y;
      // One clipped field joins both rivers without coplanar overlapping strips.
      water.colors!.set([Math.max(-20,Math.min(river.y-ground.heights[i],.95-river.bank)),
        river.dx/length,river.dz/length],i*3);
    }
    w.renderData.geometries.push({mesh:'terrain',model:'westmarkRelief',relief:ground},
      {mesh:'westmarkBackdrop',model:'westmarkRelief',relief:relief(480,5,w.extent)},
      {mesh:'westmarkWater',model:'westmarkWater',relief:water});
    builder.place('westmarkBackdrop',0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static','LANDSCAPE');
    builder.place('westmarkWater',0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static','WATER');
    plan.bridges.forEach((b,i)=>{
      const mesh=`westmarkBridge${i}`;
      w.renderData.geometries.push({mesh,model:'westmarkBridge',feature:b});
      builder.place(mesh,0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static','MASONRY');
    });
    for(const model of ['westmarkTrunk','westmarkSpruce','westmarkBeacon'])
      w.renderData.geometries.push({mesh:model,model,seed:w.seed,extent:w.extent});
    const fixed=seeded(w.seed^0x57455354),decor=builder.cosmeticRandom(0x50494e45);
    const protectedAt=(x:number,z:number,r:number)=>plan.reserve(x,z)<r+3||plan.road(x,z)<r+6||
      !!plan.bridgeAt(x,z,r+10)||westmarkRiver(x,z).bank<r+4;
    const block=(x:number,z:number,r:number)=>{
      w.mark(surface.cliffs,x,z,r+w.cellSize*.5);
      w.rocks.push({x,z,r});
    };
    let trees=0;
    for(let j=0;j<4200&&trees<430;j++) {
      const x=(fixed()-.5)*284,z=(fixed()-.5)*284,scale=.64+fixed()*.45,angle=fixed()*6.283,
        cover=Math.sin(x*.071+Math.sin(z*.04)*2)+Math.cos(z*.083-x*.025);
      if(cover<.3||protectedAt(x,z,1.1)||!surface.fits(x,z,3)||surface.heightAt(x,z)>21) continue;
      const y=surface.heightAt(x,z)-.15;
      block(x,z,.7);trees++;
      builder.place('westmarkTrunk',x,y,z,scale,scale,scale,0xffffff,angle,0,0,0,1,'static','BARK');
      builder.place('westmarkSpruce',x,y,z,scale,scale,scale,0xffffff,angle,0,0,0,1,'static','FOLIAGE');
    }
    for(let j=0;j<180;j++) {
      const x=(fixed()-.5)*280,z=(fixed()-.5)*280,r=.65+fixed()*1.1,angle=fixed()*6.283;
      if(protectedAt(x,z,r)||!surface.fits(x,z,r+1)) continue;
      block(x,z,r);
      builder.place('rockBoulder',x,surface.heightAt(x,z),z,r,r*.85,r,0x939b91,angle,0,0,0,1,'static','ROCK');
    }
    // Beacons are landmarks only: no team assignment, vision bonus or resource rule.
    for(const [sx,sz] of [[-129,-87],[-142,24],[131,-48],[234,55],[-255,79],[-185,143],[84,230],[-56,-248]]) {
      const x=sx/3,z=sz/3;
      if(protectedAt(x,z,2.5)||!surface.fits(x,z,3)) continue;
      block(x,z,2.4);
      const y=surface.heightAt(x,z),angle=decor()*.3;
      builder.place('westmarkBeacon',x,y,z,1,1,1,0xffffff,angle,0,0,0,1,'static','BARK');
      builder.place('octa',x,y+7.3,z,.65,1.1,.65,0xffb54a,0,0,0,1.8,1,'static','CRYSTAL');
    }
    // Fill existing groves with younger trees, not new navigation obstacles.
    // Every added trunk footprint must fit entirely inside the existing blocked
    // cells. Run after fixed rocks/beacons so neither their proposals nor their
    // RNG stream/acceptance can change when decorative density is adjusted.
    const grove=builder.cosmeticRandom(0x47524f56),anchors=w.renderData.placements.filter(p=>p.mesh==='westmarkSpruce'),
      insideBlock=(x:number,z:number,radius=.6)=>{
        const cell=(v:number)=>Math.floor((v+w.extent)/w.cellSize);
        for(let row=cell(z-radius);row<=cell(z+radius);row++)for(let col=cell(x-radius);col<=cell(x+radius);col++)
          if(row<0||col<0||row>=w.gridSize||col>=w.gridSize||!surface.cliffs[row*w.gridSize+col])return false;
        return true;
      };
    for(const anchor of anchors) {
      const neighbors:Position[]=[],phase=grove()*Math.PI*2;
      for(let attempt=0;attempt<12&&neighbors.length<2;attempt++) {
        const angle=phase+attempt*2.39996,radius=1.55+grove()*.8,
          x=anchor.position[0]+Math.cos(angle)*radius,z=anchor.position[2]+Math.sin(angle)*radius,
          scale=.45+grove()*.17,yaw=grove()*Math.PI*2;
        if(protectedAt(x,z,1.1)||!insideBlock(x,z)||neighbors.some(p=>Math.hypot(p.x-x,p.z-z)<1.6))continue;
        neighbors.push({x,z});
        const y=surface.heightAt(x,z)-.15;
        builder.place('westmarkTrunk',x,y,z,scale,scale,scale,0xffffff,yaw,0,0,0,1,'static','BARK');
        builder.place('westmarkSpruce',x,y,z,scale,scale,scale,0xffffff,yaw,0,0,0,1,'static','FOLIAGE');
      }
    }
    // Partly buried bank stones interrupt the shoreline, entirely on existing blockers.
    const shore=builder.cosmeticRandom(0x53484f52);
    for(let j=0;j<360;j++) {
      const segment=WESTMARK_SEGMENTS[Math.floor(shore()*WESTMARK_SEGMENTS.length)],t=shore(),side=shore()<.5?-1:1,
        length=Math.sqrt(segment.length2)||1,r=.35+shore()*.85,
        offset=(segment.a.r+(segment.b.r-segment.a.r)*t-.8+shore()*2.4)*side,
        x=segment.a.x+segment.dx*t-segment.dz/length*offset,
        z=segment.a.z+segment.dz*t+segment.dx/length*offset,yaw=shore()*Math.PI*2,sy=r*(.6+shore()*.6);
      const patch=Math.sin(x*.12+Math.cos(z*.1)*2)+Math.cos(z*.16-x*.04);
      if(patch<.35||plan.bridgeAt(x,z,r+1.5)||plan.reserve(x,z)<r+2||plan.road(x,z)<r+2||!insideBlock(x,z,r))continue;
      builder.place('rockBoulder',x,surface.heightAt(x,z)-.2,z,r,sy,r*.8,0x899080,yaw,0,0,0,1,'static','ROCK');
    }
    w.staticGrid.set(surface.cliffs);w.terrainFeatureGrid.set(surface.cliffs);
    for(let i=0;i<w.staticGrid.length;i++) {
      const p=w.point(i),b=plan.bridgeAt(p.x,p.z),water=westmarkRiver(p.x,p.z).bank<0,
        c=b?[156,155,139]:water?[51,112,128]:w.staticGrid[i]?[84,101,78]:[111,129,78];
      w.terrainColors.set([...c,255],i*4);
    }
  }
};
