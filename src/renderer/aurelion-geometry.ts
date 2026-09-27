/* Aurelion massing study. CPU-only scenery, deliberately not a playable battlefield. */
'use strict';
const AURELION_SECTOR_HEIGHT = 14;
function createAurelionGeometry() {
  const solid: number[] = [], lights: number[] = [], screens: number[] = [],
    cube = geom.box(), cylinder = geom.cylinder(32),
    random = seeded(0x41555245),
    steel = 0x52616b, dark = 0x25333f, trim = 0x92a0a5, paving = 0x899396,
    warm = 0xeed4a0, ice = 0x83ccec;
  const rgb = (c: number) => [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255];
  function box(x: number, y: number, z: number, w: number, h: number, d: number,
      color = steel, yaw = 0, out = solid) {
    ModelMesh.bake(out, cube, {x,y,z,sx:w,sy:h,sz:d,ry:yaw,tint:rgb(color)});
  }
  function disc(x: number, y: number, z: number, r: number, h: number, color = steel) {
    ModelMesh.bake(solid, cylinder, {x,y,z,sx:r,sy:h,sz:r,tint:rgb(color)});
  }
  function outline(x: number, z: number, w: number, d: number, bevel: number) {
    const a = w / 2, b = d / 2, e = Math.min(bevel, a * .5, b * .5);
    return [[-a+e,-b],[a-e,-b],[a,-b+e],[a,b-e],[a-e,b],[-a+e,b],[-a,b-e],[-a,-b+e]]
      .map(([px,pz]) => [x+px,z+pz]);
  }
  // Convex precinct footprints may be reflected into any quadrant; preserve outward winding.
  function polygonPrism(points: number[][], top: number, h: number, color: number) {
    const area = points.reduce((sum,a,i) => {
      const b = points[(i+1)%points.length]; return sum+a[0]*b[1]-b[0]*a[1];
    },0), p = area < 0 ? [...points].reverse() : points, c = rgb(color),
      x = p.reduce((sum,a) => sum+a[0],0)/p.length, z = p.reduce((sum,a) => sum+a[1],0)/p.length;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i+1)%p.length],
        hiA = [a[0],top,a[1]], hiB = [b[0],top,b[1]],
        loA = [a[0],top-h,a[1]], loB = [b[0],top-h,b[1]];
      geom.tri(solid,[x,top,z],hiB,hiA,c);
      geom.tri(solid,hiA,hiB,loB,c); geom.tri(solid,hiA,loB,loA,c);
      geom.tri(solid,[x,top-h,z],loA,loB,c);
    }
  }
  function prism(x: number, top: number, z: number, w: number, h: number, d: number, color = steel, bevel = 2) {
    polygonPrism(outline(x,z,w,d,bevel),top,h,color);
  }
  function line(a: number[], b: number[], width: number, height: number, color: number, out = solid) {
    const dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2];
    ModelMesh.bake(out,cube,{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,z:(a[2]+b[2])/2,
      sx:width,sy:height,sz:Math.hypot(dx,dy,dz),ry:Math.atan2(dx,dz),
      rx:-Math.atan2(dy,Math.hypot(dx,dz)),tint:rgb(color)});
  }
  function pavingGrid(p: number[][], y: number) {
    // Clip seams to the actual convex deck instead of letting a rectangular grid overhang its bevels.
    for (const axis of [0,1]) {
      const min = Math.min(...p.map(a => a[axis])), max = Math.max(...p.map(a => a[axis]));
      for (let t = Math.ceil(min/6)*6; t < max; t += 6) {
        const hits: number[] = [];
        for (let i = 0; i < p.length; i++) {
          const a = p[i], b = p[(i+1)%p.length];
          if ((a[axis]<=t && b[axis]>t)||(b[axis]<=t && a[axis]>t))
            hits.push(a[1-axis]+(b[1-axis]-a[1-axis])*(t-a[axis])/(b[axis]-a[axis]));
        }
        if (hits.length !== 2) continue;
        const lo = Math.min(...hits)+1.5, hi = Math.max(...hits)-1.5;
        if (hi <= lo) continue;
        if (axis===0) box(t,y+.06,(lo+hi)/2,.085,.05,hi-lo,0x52636e);
        else box((lo+hi)/2,y+.06,t,hi-lo,.05,.085,0x52636e);
      }
    }
  }
  function annulus(x: number, y: number, z: number, radius: number, width: number, h: number,
      color: number, out = solid, segments = 96) {
    const point = (i: number, r: number, dy = 0) => {
      const a = i / segments * Math.PI * 2;
      return [x+Math.sin(a)*r,y+dy,z+Math.cos(a)*r];
    }, c = rgb(color);
    for (let i = 0; i < segments; i++) {
      const a = point(i,radius), b = point(i+1,radius),
        q = point(i+1,radius-width), p = point(i,radius-width);
      geom.tri(out,a,b,q,c); geom.tri(out,a,q,p,c);
      if (h <= 0) continue;
      const al = point(i,radius,-h), bl = point(i+1,radius,-h),
        pl = point(i,radius-width,-h), ql = point(i+1,radius-width,-h);
      geom.tri(out,a,al,bl,c); geom.tri(out,a,bl,b,c);
      geom.tri(out,p,q,ql,c); geom.tri(out,p,ql,pl,c);
      geom.tri(out,al,pl,ql,c); geom.tri(out,al,ql,bl,c);
    }
  }
  function rail(a: number[], b: number[], posts = true) {
    line(a,b,.38,.42,trim);
    line([a[0],a[1]-.65,a[2]],[b[0],b[1]-.65,b[2]],.28,.35,dark);
    if (!posts) return;
    const n = Math.max(1,Math.floor(Math.hypot(b[0]-a[0],b[2]-a[2])/6));
    for (let i = 0; i <= n; i++) {
      const t = i/n, x = a[0]+(b[0]-a[0])*t, z = a[2]+(b[2]-a[2])*t;
      const y = a[1]+(b[1]-a[1])*t;
      box(x,y-.7,z,.85,2,.85,dark);
      box(x,y+.35,z,.65,.2,.65,warm,0,lights);
    }
  }
  function bridge(ax: number, az: number, bx: number, bz: number, width = 11, y = 0, endY = y) {
    const dx = bx-ax, dz = bz-az, length = Math.hypot(dx,dz), nx = dz/length, nz = -dx/length;
    // Sheared slabs meet both horizontal landings exactly; rotating a thick box would leave lips/gaps.
    const slab = (w: number, offset: number, h: number, color: number) => {
      const p = [[ax-nx*w/2,y+offset,az-nz*w/2],[ax+nx*w/2,y+offset,az+nz*w/2],
        [bx+nx*w/2,endY+offset,bz+nz*w/2],[bx-nx*w/2,endY+offset,bz-nz*w/2]], c = rgb(color);
      for (let i = 0; i < 4; i++) p.push([p[i][0],p[i][1]-h,p[i][2]]);
      for (const [a,b,q] of [[0,2,1],[0,3,2],[4,5,6],[4,6,7]]) geom.tri(solid,p[a],p[b],p[q],c);
      for (let i = 0; i < 4; i++) {
        const j = (i+1)%4;
        geom.tri(solid,p[i],p[j],p[j+4],c); geom.tri(solid,p[i],p[j+4],p[i+4],c);
      }
    };
    slab(width,-.15,3,steel); slab(width-1,0,.3,paving);
    for (const side of [-1,1]) {
      const x = nx*(width/2-.25)*side, z = nz*(width/2-.25)*side;
      rail([ax+x,y+1.6,az+z],[bx+x,endY+1.6,bz+z]);
      line([ax+x,y-1,az+z],[bx+x,endY-1,bz+z],.16,.24,warm,lights);
    }
    for (let d = 3; d < length-1; d += 5) {
      const x = ax+dx*d/length, z = az+dz*d/length, h = y+(endY-y)*d/length;
      line([x-nx*(width/2-1),h+.06,z-nz*(width/2-1)],
        [x+nx*(width/2-1),h+.06,z+nz*(width/2-1)],.10,.05,dark);
    }
    if (endY !== y) {
      // Stairs flank a broad continuous central ramp; these are visual, not navigation geometry.
      const count = Math.ceil(Math.abs(endY-y)/.6), yaw = Math.atan2(dx,dz);
      for (let i = 0; i < count; i++) for (const side of [-1,1]) {
        const t = (i+.5)/count, h = Math.max(y+(endY-y)*i/count,y+(endY-y)*(i+1)/count),
          x = ax+dx*t+nx*(width/2-2.2)*side, z = az+dz*t+nz*(width/2-2.2)*side;
        box(x,h-.25,z,2.5,.65,length/count,trim,yaw);
      }
    }
  }
  function windowQuad(x: number, y: number, z: number, w: number, h: number, yaw: number, color: number) {
    const dx = Math.cos(yaw)*w/2, dz = -Math.sin(yaw)*w/2, c = rgb(color),
      a = [x-dx,y-h/2,z-dz], b = [x+dx,y-h/2,z+dz],
      q = [x+dx,y+h/2,z+dz], p = [x-dx,y+h/2,z-dz];
    geom.tri(lights,a,b,q,c); geom.tri(lights,a,q,p,c);
  }
  function tower(x: number, z: number, w: number, d: number, top: number, variant = 0, covered = false) {
    const bottom = -150, height = top-bottom, facadeTop = covered ? -14 : top-4;
    prism(x,top,z,w,height,d,dark,Math.min(w,d)*.17);
    // Narrow ribs and stepped crowns keep the towers architectural at overview scale.
    for (const side of [-1,1]) {
      for (const px of [-.34,.34]) box(x+w*px,top-height/2,z+side*d*.48,.65,height,.5,steel);
      for (const pz of [-.34,.34]) box(x+side*w*.48,top-height/2,z+d*pz,.5,height,.65,steel);
      for (let yy = bottom+8; yy < facadeTop-2; yy += 23) {
        box(x,yy,z+side*d*.501,w*.76,.65,.22,steel);
        box(x+side*w*.501,yy,z,.22,.65,d*.76,steel);
      }
    }
    // A continuous precinct shoulder encloses the upper supports: do not bake hidden roofs/windows.
    if (!covered) {
      prism(x,top+.8,z,w+1.1,1.8,d+1.1,trim,2);
      prism(x,top+1.1,z,w-1.6,.35,d-1.6,dark,1.5);
      prism(x-w*.12,top+4,z,w*.55,3,d*.48,steel,1);
      prism(x-w*.12,top+4.25,z,w*.48,.35,d*.41,trim,.7);
      for (let i = 0; i < 3; i++) box(x+w*.28,top+1.8,z+(i-1)*d*.22,w*.18,1.4,d*.13,steel);
      if (variant%3 === 0) {
        box(x-w*.24,top+7,z-d*.2,.35,10,.35,trim);
        box(x-w*.24,top+12,z-d*.2,.5,.4,.5,ice,0,lights);
      }
    }
    for (let yy = Math.max(bottom+6,top-125); yy < facadeTop; yy += 4.2) {
      for (const side of [-1,1]) {
        for (let xx = -w*.32; xx <= w*.33; xx += 2.8)
          if (random() > .33) windowQuad(x+xx,yy,z+side*(d/2+.04),.7,1.5,side>0?0:Math.PI,
            random()>.22?warm:0x7ca8c4);
        for (let zz = -d*.32; zz <= d*.33; zz += 2.8)
          if (random() > .33) windowQuad(x+side*(w/2+.04),yy,z+zz,.7,1.5,side*Math.PI/2,
            random()>.22?warm:0x7ca8c4);
      }
    }
  }
  function billboard(x: number, y: number, z: number, w: number, h: number, color: number) {
    box(x,y,z,w+2,h+2,1.3,dark);
    box(x,y,z+.72,w,h,.10,color,0,screens);
    for (const side of [-1,1]) {
      box(x+side*(w/2+.55),y,z+.9,.35,h+1,.3,trim);
      box(x,y+side*(h/2+.55),z+.9,w+1,.35,.3,trim);
    }
    // Abstract placeholder, not final advertising artwork: retain the screen's physical scale.
    box(x,y-h*.33,z+.83,w*.70,.25,.10,ice,0,lights);
    box(x,y-h*.38,z+.83,w*.42,.18,.10,ice,0,lights);
    for (let i = 0; i < 3; i++)
      box(x+(i-1)*w*.19,y+h*.08,z+.84,w*.10,h*(.26+i*.08),.10,ice,0,lights);
  }

  // A neutral lower-city datum closes the view; cloud/fog materials are a later approval stage.
  box(0,-156,0,1600,2,1600,0x526d82);
  // Background streets leave a deliberate open crown district rather than filling the arena with towers.
  for (let iz = -5; iz <= 4; iz++) for (let ix = -6; ix <= 6; ix++) {
    const x = ix*43+(random()-.5)*15, z = iz*43+(random()-.5)*15;
    if (Math.abs(x)<166 && Math.abs(z)<149) continue;
    const w = 10+random()*11, d = 11+random()*10,
      foreground = z>100 && Math.abs(x)<180,
      top = foreground ? -42+random()*32 : -22+random()*85;
    tower(x,z,w,d,top,ix+iz*7);
  }
  // Tall advertisement landmarks frame the four platforms without occupying them.
  for (const [x,z,top,c] of [[-180,-104,75,0x345599],[182,-86,92,0x56477f],
      [-188,76,40,0x31557e],[187,69,51,0x394fa5]]) {
    tower(x,z,26,23,top,0);
    billboard(x,top-28,z+12.2,18,40,c);
  }
  tower(0,159,18,20,-11,0);
  tower(-67,-156,16,18,64,0);
  tower(56,-168,21,22,81,1);

  // Each entire corner is an upper city precinct, not an elevated pedestal on a flat bridge network.
  const precinct = [[74,40],[143,40],[157,54],[157,124],[144,137],[61,137],[47,123],[47,67]],
    deck = AURELION_SECTOR_HEIGHT;
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    const x = sx*111, z = sz*94, p = precinct.map(([px,pz]) => [sx*px,sz*pz]),
      skirt = precinct.map(([px,pz]) => [sx*(102+(px-102)*1.035),sz*(89+(pz-89)*1.035)]);
    // Broad interlocking shafts and a continuous shoulder replace four exposed thin stilts.
    for (const [px,pz,w,d,top] of [[78,112,36,34,3],[130,108,36,38,7],[126,63,37,29,5],[67,77,29,30,0]])
      tower(sx*px,sz*pz,w,d,top,1,true);
    polygonPrism(skirt,deck-4,24,dark);
    polygonPrism(skirt,deck-2,2,steel);
    polygonPrism(p,deck,2,paving);
    pavingGrid(p,deck);
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i+1)%p.length], length = Math.hypot(b[0]-a[0],b[1]-a[1]);
      // Three honest mouths: two flanking ramps and a broad diagonal descent to the lower crown.
      const mouth = i===0 ? [112-74,22] : i===6 ? [123-103,20] : i===7 ? [length/2,24] : null;
      const spans = mouth ? [[0,(mouth[0]-mouth[1]/2)/length],[(mouth[0]+mouth[1]/2)/length,1]] : [[0,1]];
      for (const [lo,hi] of spans) {
        const pa = [a[0]+(b[0]-a[0])*lo,deck+1.7,a[1]+(b[1]-a[1])*lo],
          pb = [a[0]+(b[0]-a[0])*hi,deck+1.7,a[1]+(b[1]-a[1])*hi];
        rail(pa,pb);
        line([pa[0],deck-.7,pa[2]],[pb[0],deck-.7,pb[2]],1.3,.8,trim);
      }
      // Facade details follow the wider lower shoulder, not the inset deck hidden inside it.
      const wa = skirt[i], wb = skirt[(i+1)%skirt.length],
        dx = wb[0]-wa[0], dz = wb[1]-wa[1], span = Math.hypot(dx,dz),
        nx = dz/span*sx*sz, nz = -dx/span*sx*sz, yaw = Math.atan2(dx,dz);
      line([wa[0],deck-3.5,wa[1]],[wb[0],deck-3.5,wb[1]],.5,.45,warm,lights);
      for (const h of [deck-12,deck-21])
        line([wa[0]+nx*.3,h,wa[1]+nz*.3],[wb[0]+nx*.3,h,wb[1]+nz*.3],.8,.8,steel);
      for (let d = 4; d < span-2; d += 9) {
        // The widened shoulder must not put cornice blocks through a descending ramp mouth.
        if (mouth && Math.abs(d/span*length-mouth[0]) < mouth[1]/2+2) continue;
        const px = wa[0]+dx*d/span, pz = wa[1]+dz*d/span;
        box(px+nx*.6,deck-14,pz+nz*.6,3,25,2.2,steel,yaw);
        box(px+nx*.6,deck-1.8,pz+nz*.6,4,2.3,3.5,trim,yaw);
        // Flat panes, rather than unseen six-sided lamp boxes, keep this pass within its mesh budget.
        for (const off of [-2.7,2.7]) for (const h of [deck-7,deck-15,deck-23])
          windowQuad(px+dx/span*off+nx*.08,h,pz+dz/span*off+nz*.08,1.2,3,Math.atan2(nx,nz),warm);
      }
    }
    // Low service roofs and recessed terraces make the precinct read as an inhabited building crown.
    for (const [px,pz,w,d,h] of [[89,130,22,8,6],[149,88,9,24,5],[62,116,13,17,4]]) {
      prism(sx*px,deck+1,sz*pz,w+2,1,d+2,dark,2);
      prism(sx*px,deck+h,sz*pz,w,h,d,steel,2);
      prism(sx*px,deck+h+.5,sz*pz,w+.7,.5,d+.7,trim,2);
      for (let i = -2; i <= 2; i++)
        box(sx*px,deck+h+.8,sz*(pz+i*d*.13),w*.65,.35,.45,dark);
    }
    for (const [px,pz,h] of [[145,121,16],[150,57,23],[77,45,10]]) {
      prism(sx*px,deck+h,sz*pz,7,h,8,steel,1.2);
      prism(sx*px,deck+h+1,sz*pz,8,1,9,trim,1.5);
      prism(sx*px,deck+h+2,sz*pz,5,1,6,dark,1);
      box(sx*px,deck+h+4,sz*pz,.3,4,.3,trim);
      for (const side of [-1,1]) {
        box(sx*px+side*2.7,deck+h/2,sz*pz,1,h,8.2,dark);
        box(sx*px+side*2,deck+h-2,sz*pz+4.1,.6,2,.15,ice,0,lights);
      }
    }
    // Neutral pavilion and light markers stay on the new upper datum, with generous surrounding floor.
    prism(x,deck+1.2,z,19,1.1,16,dark,4);
    prism(x,deck+3.6,z,15,2.4,12,steel,3);
    prism(x,deck+4.3,z,13,.7,10,trim,2);
    disc(x,deck+4.6,z,3,.65,dark);
    annulus(x,deck+4.95,z,3,.28,0,warm,lights,32);
    for (let i = 0; i < 15; i++) {
      const a = i/14*Math.PI*1.4+Math.PI*.3, px = x+Math.cos(a)*25, pz = z+Math.sin(a)*23;
      prism(px,deck+.5,pz,2.2,.5,2.2,dark,.3);
      box(px,deck+1.2,pz,1,1.3,1,ice,0,lights);
    }
    // Sloped causeways terminate at the actual perimeter openings, not through a railing or raised wall.
    bridge(sx*112,sz*40,sx*112,sz*18,22,deck,2);
    bridge(sx*47,sz*103,sx*24,sz*103,20,deck,2);
    bridge(sx*60.5,sz*53.5,sx*43,sz*36,24,deck,0);
    bridge(sx*43,sz*36,sx*25,sz*19,15);
    tower(sx*43,sz*36,19,19,-6,1);
    disc(sx*43,-1.18,sz*36,12,2,steel);
    annulus(sx*43,.12,sz*36,10,.4,0,trim);
    annulus(sx*43,.16,sz*36,5,.32,0,warm,lights,48);
    // Inset roof terrace beside the diagonal approach, lower than the whole corner precinct.
    prism(sx*75,5,sz*33,23,9,12,steel,2.5);
    prism(sx*75,5.3,sz*33,21,.3,10,paving,2);
    annulus(sx*75,5.4,sz*33,3.5,.3,0,warm,lights,32);
  }
  for (const side of [-1,1]) {
    bridge(side*112,-18,side*112,18,22,2);
    bridge(-24,side*103,24,side*103,20,2);
    // Service blocks carry the lower cross-sector streets, well below the four upper districts.
    prism(side*112,1,0,24,36,25,dark,3);
    prism(0,1,side*103,25,36,22,dark,3);
    // Slender skyline pylons and their oversized media faces.
    tower(side*30,side*48,9,11,29,0);
    billboard(side*30,18,side*48+5.9,6.2,17,side>0?0x6f4487:0x296a7b);
  }

  // Central crown: thick annular road, separated inner plaza, buttresses and luminous armillary.
  annulus(0,0,0,41,6,3,steel);
  annulus(0,.15,0,40,4,0,paving);
  annulus(0,.23,0,40.2,.32,0,ice,lights);
  annulus(0,.23,0,35.6,.35,0,warm,lights);
  disc(0,-2,0,26,4,steel);
  disc(0,.1,0,25.4,.5,paving);
  for (const side of [-1,1]) {
    bridge(side*23,0,side*37,0,10);
    bridge(0,side*23,0,side*37,10);
  }
  annulus(0,.5,0,24.7,1.6,0,warm,lights);
  annulus(0,.55,0,19,.30,0,dark);
  for (let i = 0; i < 32; i++) {
    const a = i*Math.PI/16;
    box(Math.sin(a)*22,.62,Math.cos(a)*22,.7,.14,2.3,trim,a);
  }
  disc(0,1.8,0,14,3,dark);
  disc(0,3.5,0,12,1,steel);
  annulus(0,4.1,0,11.9,.8,0,ice,lights);
  for (let i = 0; i < 12; i++) {
    const a = i*Math.PI/6, x = Math.sin(a)*13, z = Math.cos(a)*13;
    box(x,2.4,z,1.8,5,2.8,trim,a);
    box(x,4.95,z,1.1,.18,1.4,ice,a,lights);
  }
  const sphereRing = geom.ring(96,.012);
  for (let i = 0; i < 6; i++) ModelMesh.bake(lights,sphereRing,
    {x:0,y:15,z:0,sx:10,sy:10,sz:10,rx:Math.PI/2,ry:i*Math.PI/6,tint:rgb(ice)});
  for (let i = -3; i <= 3; i++) {
    const y = i*2.4, r = Math.sqrt(100-y*y);
    ModelMesh.bake(lights,sphereRing,{y:15+y,sx:r,sy:r,sz:r,tint:rgb(ice)});
  }
  // A recessed city foundation under the crown, not a second playable floor.
  tower(0,0,20,20,-6,1);
  for (const side of [-1,1]) {
    tower(side*71,0,12,15,-15,0);
    tower(side*28,-side*71,13,14,-22,1);
  }
  return [
    {name:'aurelionStructure',data:solid,glow:0},
    {name:'aurelionLights',data:lights,glow:1.15},
    {name:'aurelionScreens',data:screens,glow:.8}
  ];
}
