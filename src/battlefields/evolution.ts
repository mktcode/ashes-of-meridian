/* Technical composition over authored recipes: real walkable relief, not shader
 * displacement. Original placement streams/layouts survive; the new surface owns
 * navigation, foundations, model grounding and the rendered triangle samples. */
'use strict';
function worldReliefField(world:Battlefield,style:WorldVariation):(x:number,z:number)=>number {
  const {Math}=globalThis;
  if(style.relief==='deck')return ()=>0;
  const rand=seeded(world.terrainSeed^0x52454c46),angle=rand()*Math.PI*2,phase=rand()*Math.PI*2,
    cs=Math.cos(angle),sn=Math.sin(angle),extent=world.extent,
    pads=[...world.layout.startSites.map(p=>({...p,r:31})),...world.layout.resourceSites.map(p=>({...p,r:12})),
      ...world.layout.resourceSites.map((p,i)=>({x:p.x+(i?7:5),z:p.z+(i?7:18),r:9}))],
    bridges=world.renderData.geometries.flatMap(g=>g.model==='westmarkBridge'&&'feature' in g?[g.feature]:[]);
  return (x,z)=>{
    let room=extent-Math.max(Math.abs(x),Math.abs(z))-6;
    for(const p of pads)room=Math.min(room,Math.hypot(x-p.x,z-p.z)-p.r);
    if(style.family==='alpine') {
      room=Math.min(room,westmarkRiver(x,z).bank-6);
      for(const b of bridges)room=Math.min(room,Math.hypot(x-b.x,z-b.z)-Math.hypot(b.width,b.depth)-6);
    }
    if(room<=0)return 0;
    const u=x*cs-z*sn,v=x*sn+z*cs,a=style.amplitude;
    let h=0;
    switch(style.relief) {
      case 'rolling':h=a*(.5+.28*Math.sin(u*.025+phase)+.18*Math.cos(v*.022-phase));break;
      case 'dunes':h=a*(.48+.42*Math.sin(u*.038+phase+Math.sin(v*.018)*.6));break;
      case 'basin':h=a*(.12+.8*(1-Math.exp(-(u*u+v*v)/(extent*.65)**2)));break;
      case 'folds':h=a*(.5+.28*Math.sin(u*.027+phase)+.17*Math.sin((u+v)*.021-phase));break;
      case 'craters':h=a*(.12+.36*(1-Math.cos(Math.hypot(u+extent*.17,v-extent*.1)/extent*Math.PI*2))+ .08*Math.sin(v*.02+phase));break;
      case 'terraces':{
        const raw=a*(.48+.38*Math.sin(u*.024+phase)),band=raw/2,t=band-Math.floor(band);
        h=2*(Math.floor(band)+t*t*(3-2*t));break;
      }
      case 'deck':return 0;
    }
    // A common zero datum at all economy reserves avoids incompatible overlapping pads.
    // The cone also gives every base/vent a gradual approach instead of a hidden step.
    return Math.max(0,Math.min(h,room*.22));
  };
}
function evolveBattlefield(builder:BattlefieldBuilder) {
  const {Math}=globalThis;
  const w=builder.world,style=w.renderProfile.variation;if(!style)return;
  // Frontier already owns variable walkable landforms and dimensioned CPU meshes.
  if(style.family==='frontier')return;
  const original=w.surface,desert=w.renderData.geometries.find(g=>g.model==='desertRelief'&&'relief' in g&&!g.relief.innerExtent),
    canyon=desert&&'relief' in desert?desert.relief:null,
    base=(x:number,z:number)=>original?original.heightAt(x,z):canyon?Math.max(0,desertReliefHeight(canyon,x,z)+.13):0,
    field=worldReliefField(w,style),scale=style.heightScale,visibility=original?.visibilityLevel,
    height=(x:number,z:number)=>base(x,z)*scale+field(x,z),
    s=w.surface=new BattlefieldSurface(w.extent,w.cellSize,height,
      style.relief==='deck'&&visibility?(h,x,z)=>visibility(h/scale,x,z):undefined);
  // Natural families deliberately have no height tiers. Never reevaluate the
  // analytic relief field in the per-frame sight path: only stored samples/tier rules.
  if(original?.buildBlocked)s.buildBlocked=original.buildBlocked.slice();
  for(let i=0;i<s.cliffs.length;i++) {
    // Retain authored permanent barriers, but do not reinterpret circular rock/tree
    // occupancy as expanded square cliffs (that would change body clearance).
    s.cliffs[i]|=original?.cliffs[i]??0;
    w.staticGrid[i]|=s.cliffs[i];w.terrainFeatureGrid[i]|=s.cliffs[i];
  }
  // Every displaced prop reads the sampled surface, not a second analytic approximation.
  const delta=(x:number,z:number)=>Math.max(Math.abs(x),Math.abs(z))>w.extent?0:s.heightAt(x,z)-base(x,z),
    descriptors=new Map(w.renderData.geometries.map(g=>[g.mesh,g]));
  for(const p of w.renderData.placements) {
    const g=descriptors.get(p.mesh);
    if(p.mesh==='terrain'||p.mesh==='box'||p.mesh==='alienForestFloor'||p.mesh==='shipHull'||p.mesh==='shipOuterDeck'||
      g&&('relief' in g||'feature' in g||g.grounded))continue;
    const [x,,z]=p.position,r=p.scale[0];
    if(canyon&&p.mesh.startsWith('desert')&&Math.max(Math.abs(x),Math.abs(z))+r<w.extent) {
      const points=[[x,z],[x+r,z],[x-r,z],[x,z+r],[x,z-r]],
        oldFoot=Math.min(...points.map(([px,pz])=>desertReliefHeight(canyon,px,pz))),
        newFoot=Math.min(...points.map(([px,pz])=>s.heightAt(px,pz)-.13));
      p.position[1]+=newFoot-oldFoot;
    }else p.position[1]+=delta(x,z);
    if(['alienFern','alienSpore','alienGlowTuft','alienLanternPool'].includes(p.mesh)) {
      const span=Math.max(.5,r),dx=(s.heightAt(x+span,z)-s.heightAt(x-span,z))/(2*span),
        dz=(s.heightAt(x,z+span)-s.heightAt(x,z-span))/(2*span),c=Math.cos(p.rotation[0]),t=Math.sin(p.rotation[0]),
        gx=dx*c-dz*t,gz=dx*t+dz*c;
      p.rotation[1]=-Math.atan(gz);p.rotation[2]=Math.atan(gx/Math.hypot(1,gz));
    }
  }
  w.renderData.placements=w.renderData.placements.filter(p=>p.mesh!=='box');
  for(const g of w.renderData.geometries)if('relief' in g&&g.model==='landscapeRelief') {
    const r=g.relief,heights=r.heights.slice();
    for(let z=0;z<r.size;z++)for(let x=0;x<r.size;x++) {
      const px=(x-1)*r.step-r.extent,pz=(z-1)*r.step-r.extent;
      heights[z*r.size+x]+=delta(px,pz);
    }
    g.relief={...r,heights};
  }
  if(!original) {
    // Alien soil and canyon floors now use the same diagonal/samples as navigation.
    // Keep the large non-playable canyon exterior, but do not draw a second inner skin.
    if(desert) {
      w.renderData.geometries=w.renderData.geometries.filter(g=>g!==desert);
      w.renderData.placements=w.renderData.placements.filter(p=>p.mesh!==desert.mesh);
    }
    const step=s.step,size=s.size+2,heights=new Float32Array(size*size),colors=new Float32Array(size*size*3),
      routes=w.layout.corridors.flatMap(route=>route.slice(1).map((b,i)=>{
        const a=route[i],dx=b[0]-a[0],dz=b[1]-a[1];
        return {x:a[0],z:a[1],dx,dz,length2:dx*dx+dz*dz||1,
          left:Math.min(a[0],b[0])-3,right:Math.max(a[0],b[0])+3,
          top:Math.min(a[1],b[1])-3,bottom:Math.max(a[1],b[1])+3};
      }));
    for(let z=0;z<size;z++)for(let x=0;x<size;x++) {
      const px=(x-1)*step-w.extent,pz=(z-1)*step-w.extent,i=z*size+x,
        h=s.heightAt(px,pz),rock=canyon?clamp(base(clamp(px,-w.extent,w.extent),clamp(pz,-w.extent,w.extent))/3,0,1):0;
      heights[i]=h-.13;colors[i*3+1]=rock;
      // Road tint has only a three-metre influence. Avoid allocating endpoint
      // objects and taking a square root for every segment at every terrain sample.
      let road2=9;
      for(const r of routes) {
        if(px<r.left||px>r.right||pz<r.top||pz>r.bottom)continue;
        const t=Math.max(0,Math.min(1,((px-r.x)*r.dx+(pz-r.z)*r.dz)/r.length2)),
          dx=px-r.x-t*r.dx,dz=pz-r.z-t*r.dz;
        road2=Math.min(road2,dx*dx+dz*dz);
      }
      colors[i*3]=(1-Math.sqrt(road2)/3)*(1-rock);
    }
    w.renderData.geometries.push({mesh:'terrain',model:'landscapeRelief',relief:{extent:w.extent,step,size,heights,colors,innerExtent:0}});
    const floor=w.renderData.placements.find(p=>p.mesh==='terrain')!;floor.material='LANDSCAPE';
  }
  if(w.renderData.scenery)w.renderData.heightScale=scale;
  for(let i=0;i<w.staticGrid.length;i++) {
    const p=w.point(i),shade=clamp(1+field(p.x,p.z)*.018,.8,1.25);
    for(let c=0;c<3;c++)w.terrainColors[i*4+c]*=shade;
  }
  // Validate actual public starts and economy foundations; never repair by rerolling.
  for(const p of w.layout.startSites)if(!s.foundation(p,7))throw Error(`Invalid ${style.id} start terrace`);
  for(const [i,p] of w.layout.resourceSites.entries())
    if(!s.foundation({x:p.x+(i?7:5),z:p.z+(i?7:18)},2.3))
      throw Error(`Invalid ${style.id} vent terrace at resource ${i}`);
}
