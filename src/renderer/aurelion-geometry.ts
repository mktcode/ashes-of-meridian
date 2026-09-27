/* Aurelion architecture study. CPU-only scenery, deliberately not a playable battlefield. */
'use strict';
const AURELION_SECTOR_HEIGHT = 8;
// Shared scenery/light footprints, not a gameplay surface or navigation contract.
const AURELION_DECK_OUTLINE = [[74,40],[143,40],[157,54],[157,124],[144,137],[61,137],[47,123],[47,67]] as const;
const AURELION_CROWN_FLOOR = {radius:41,height:.15} as const;
// ax, az, bx, bz, width, start height, end height. First four: mirrored approaches; last two: crossings.
const AURELION_WALKWAYS = [
  [112,40,112,18,22,AURELION_SECTOR_HEIGHT,2], [47,103,24,103,20,AURELION_SECTOR_HEIGHT,2],
  [60.5,53.5,43,36,24,AURELION_SECTOR_HEIGHT,0], [43,36,25,19,15,0,0],
  [112,-18,112,18,22,2,2], [-24,103,24,103,20,2,2]
] as const;
// Shared only by the preview's physical cabinets and its atlas projection; all faces point toward +Z.
const AURELION_BILLBOARDS = [
  {x:-180,y:47,z:-91.8,w:22,h:48,design:0}, {x:182,y:64,z:-73.8,w:22,h:48,design:1},
  {x:-188,y:12,z:88.2,w:22,h:48,design:2}, {x:187,y:23,z:81.2,w:22,h:48,design:3},
  {x:-30,y:18,z:-42.1,w:6.2,h:17,design:0}, {x:30,y:18,z:53.9,w:6.2,h:17,design:1}
] as const;
// Deliberately inexpensive silhouettes fill the horizon; they never enlarge the four precincts.
function createAurelionBackdrop() {
  const data: number[]=[],random=seeded(0x44495354),cube=geom.box();
  function box(x:number,y:number,z:number,w:number,h:number,d:number,color:number) {
    ModelMesh.bake(data,cube,{x,y,z,sx:w,sy:h,sz:d,tint:[(color>>16&255)/255,(color>>8&255)/255,(color&255)/255]});
  }
  for (let iz=-10;iz<=6;iz++) for (let ix=-9;ix<=9;ix++) {
    const x=ix*61+(random()-.5)*20,z=iz*61+(random()-.5)*20;
    if (Math.abs(x)<325&&z>-275&&z<235) continue;
    const w=24+random()*23,d=24+random()*24,top=z>200?-75+random()*35:15+random()*115,
      bottom=-155,shoulder=top-16-random()*12;
    box(x,(bottom+shoulder)/2,z,w,shoulder-bottom,d,0x344a5a);
    box(x,shoulder+1,z,w+1.3,2,d+1.3,0x899798);
    box(x,(shoulder+top)/2,z,w*.7,top-shoulder,d*.73,0x415362);
    box(x,top+1,z,w*.77,2,d*.8,0x899798);
    box(x-w*.13,top+3,z+d*.1,w*.35,3,d*.32,0x526673);
    if ((ix+iz)%3===0) box(x+w*.19,top+8,z-d*.15,1.1,14,1.1,0x9aa9ad);
  }
  return {name:'aurelionBackdrop',data:new Float32Array(data)};
}
function createAurelionGeometry() {
  const solid: number[] = [], lights: number[] = [], screens: number[] = [],
    cube = geom.box(), cylinder = geom.cylinder(32), smallCylinder = geom.cylinder(12),
    random = seeded(0x41555245),
    steel = 0x52616b, dark = 0x25333f, trim = 0x92a0a5, paving = 0x899396,
    warm = 0xeed4a0, ice = 0x83ccec;
  // The detailed study has a larger, explicit budget. Flush bounded work arrays during assembly,
  // rather than retaining millions of boxed numbers alongside the final GPU buffers.
  const chunks: Float32Array[][] = [[],[],[]];
  function flush() {
    for (const [i,data] of [solid,lights,screens].entries()) if (data.length) {
      chunks[i].push(new Float32Array(data)); data.length = 0;
    }
  }
  function packed(parts: Float32Array[]) {
    const result = new Float32Array(parts.reduce((n,p) => n+p.length,0));
    let offset = 0;
    for (const p of parts) { result.set(p,offset); offset += p.length; }
    parts.length = 0;
    return result;
  }
  const rgb = (c: number) => [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255];
  function box(x: number, y: number, z: number, w: number, h: number, d: number,
      color = steel, yaw = 0, out = solid) {
    ModelMesh.bake(out, cube, {x,y,z,sx:w,sy:h,sz:d,ry:yaw,tint:rgb(color)});
  }
  function disc(x: number, y: number, z: number, r: number, h: number, color = steel) {
    ModelMesh.bake(solid, r<3?smallCylinder:cylinder, {x,y,z,sx:r,sy:h,sz:r,tint:rgb(color)});
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
  function armor(x: number, top: number, z: number, w: number, h: number, d: number, color = steel) {
    if (h<.8) prism(x,top,z,w,h,d,color,Math.min(w,d)*.17);
    else ModelMesh.panel(solid,{x,y:top-h/2,z,w,h,d,bevel:Math.min(.35,h*.22,w*.12,d*.12),tint:rgb(color)});
  }
  function fan(x: number, y: number, z: number, r: number) {
    disc(x,y,z,r,1,dark);
    annulus(x,y+.56,z,r,.22,.35,trim,solid,16);
    disc(x,y+.6,z,r*.19,.3,steel);
    for (let i = 0; i < 5; i++) {
      const a = i*Math.PI*2/5;
      box(x+Math.sin(a)*r*.45,y+.62,z+Math.cos(a)*r*.45,r*.24,.15,r*.6,steel,a+.3);
    }
  }
  function machinery(x: number, y: number, z: number, w: number, d: number, type = 0) {
    prism(x,y+1,z,w,1,d,dark,.6);
    armor(x,y+2.2,z,w*.82,1.2,d*.82,steel);
    if (type%2===0) {
      for (const side of [-1,1]) fan(x+side*w*.23,y+2.5,z,Math.min(w*.2,d*.32));
    } else {
      for (let i = -3; i <= 3; i++) box(x,y+2.35,z+i*d*.09,w*.7,.25,.24,trim);
      box(x-w*.3,y+1.65,z+d*.44,w*.23,.65,.2,ice,0,lights);
    }
    for (const side of [-1,1]) {
      box(x+side*w*.37,y+.5,z,.35,1,d*.92,trim);
      line([x+side*w*.36,y+1.4,z-d*.25],[x+side*w*.36,y+1.4,z+d*.55],.25,.25,0x8d8774);
    }
  }
  function dish(x: number, y: number, z: number, r: number) {
    disc(x,y+.8,z,r*.42,1.5,steel);
    const n = 24, rings = 4, point = (i: number, j: number, back = false) => {
      const a = i/n*Math.PI*2, radius = r*(.1+.9*j/rings);
      return [x+Math.sin(a)*radius,y+1.4+(radius/r)**2*r*.38-(back?.14:0),z+Math.cos(a)*radius];
    };
    for (const back of [false,true]) for (let j = 0; j < rings; j++) for (let i = 0; i < n; i++) {
      const a = point(i,j,back), b = point(i+1,j,back), c = point(i+1,j+1,back), d = point(i,j+1,back),
        tint = rgb(back?steel:trim);
      if (back) { geom.tri(solid,a,b,c,tint); geom.tri(solid,a,c,d,tint); }
      else { geom.tri(solid,a,d,c,tint); geom.tri(solid,a,c,b,tint); }
      if (j===rings-1 && !back) {
        const loC = point(i+1,j+1,true), loD = point(i,j+1,true);
        geom.tri(solid,d,loD,loC,tint); geom.tri(solid,d,loC,c,tint);
      }
    }
    box(x,y+2.3,z,.25,2,.25,dark);
    for (let i = 0; i < 3; i++) {
      const a = i*Math.PI*2/3;
      line([x+Math.sin(a)*r*.9,y+1.4+r*.31,z+Math.cos(a)*r*.9],[x,y+3.3,z],.12,.12,steel);
    }
  }
  function mast(x: number, y: number, z: number, height: number) {
    prism(x,y+1,z,2.4,1,2.4,dark,.4);
    box(x,y+height/2,z,.35,height,.35,trim);
    box(x,y+height*.7,z,3.5,.2,.25,steel);
    box(x,y+height,z,.55,.4,.55,ice,0,lights);
    for (const side of [-1,1]) line([x+side*.9,y+.5,z],[x,y+height*.45,z],.18,.18,steel);
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
  function rail(a: number[], b: number[], detailedPosts = true) {
    line(a,b,.38,.42,trim);
    line([a[0],a[1]-.65,a[2]],[b[0],b[1]-.65,b[2]],.28,.35,dark);
    if (!detailedPosts) {
      for (const p of [a,b]) box(p[0],p[1]-.7,p[2],.4,1.8,.4,steel);
      return;
    }
    const n = Math.max(1,Math.floor(Math.hypot(b[0]-a[0],b[2]-a[2])/6));
    for (let i = 0; i <= n; i++) {
      const t = i/n, x = a[0]+(b[0]-a[0])*t, z = a[2]+(b[2]-a[2])*t;
      const y = a[1]+(b[1]-a[1])*t;
      box(x,y-.7,z,.85,2,.85,dark);
      box(x,y-.7,z,1.15,.55,1.15,steel);
      box(x,y+.15,z,1.05,.24,1.05,trim);
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
      // Deep, flanged box girders and a visible diagonal web carry the deck over the city void.
      line([ax+x,y-2.4,az+z],[bx+x,endY-2.4,bz+z],.8,.7,trim);
      line([ax+x,y-7,az+z],[bx+x,endY-7,bz+z],1,.65,steel);
      const spans = Math.max(1,Math.ceil(length/7));
      for (let i = 0; i < spans; i++) {
        const t = i/spans, u = (i+1)/spans,
          p = [ax+dx*t+x,y+(endY-y)*t-2.7,az+dz*t+z],
          q = [ax+dx*u+x,y+(endY-y)*u-6.8,az+dz*u+z];
        line(p,q,.48,.48,steel);
        line([p[0],p[1]-3.8,p[2]],[q[0],q[1]+3.8,q[2]],.3,.3,trim);
      }
    }
    for (let d = 3; d < length-1; d += 5) {
      const x = ax+dx*d/length, z = az+dz*d/length, h = y+(endY-y)*d/length;
      line([x-nx*(width/2-1),h+.06,z-nz*(width/2-1)],
        [x+nx*(width/2-1),h+.06,z+nz*(width/2-1)],.10,.05,dark);
      line([x-nx*width/2,h-3,z-nz*width/2],[x+nx*width/2,h-3,z+nz*width/2],.65,.9,dark);
      for (const side of [-1,1]) {
        box(x+nx*(width/2-1)*side,h+.08,z+nz*(width/2-1)*side,.65,.1,1.4,trim,Math.atan2(dx,dz));
      }
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
  function windowQuad(x: number, y: number, z: number, w: number, h: number, yaw: number, color: number, out = lights) {
    const dx = Math.cos(yaw)*w/2, dz = -Math.sin(yaw)*w/2, c = rgb(color),
      a = [x-dx,y-h/2,z-dz], b = [x+dx,y-h/2,z+dz],
      q = [x+dx,y+h/2,z+dz], p = [x-dx,y+h/2,z-dz];
    geom.tri(out,a,b,q,c); geom.tri(out,a,q,p,c);
  }
  function shaft(x: number, z: number, w: number, d: number, bottom: number, top: number, style: number, facadeTop = top-1) {
    const h = top-bottom, glass = [0x243c4e,0x2b3740,0x25404b,0x303947][style],
      facadeRandom = seeded(Math.imul(Math.round(x*11),7919)^Math.imul(Math.round(z*13),104729)^Math.round(top*17));
    prism(x,top,z,w,h,d,dark,Math.min(w,d)*.17);
    for (let face = 0; face < 4; face++) {
      const a = face*Math.PI/2, nx = Math.sin(a), nz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a),
        span = (face%2?d:w)*.68, depth = (face%2?w:d)/2,
        front = (u: number, yy: number, lift = .05) => [x+nx*(depth+lift)+tx*u,yy,z+nz*(depth+lift)+tz*u],
        hi = Math.min(top-.7,facadeTop), lo = Math.max(bottom+1,top-120,-108),
        columns = Math.max(2,Math.floor(span/2.6)), step = span/columns;
      if (hi<=lo) continue;
      const p = front(0,(hi+lo)/2);
      windowQuad(p[0],p[1],p[2],span,hi-lo,a,glass,solid);
      for (let col = 0; col <= columns; col++) {
        const u = -span/2+col*step, p = front(u,(hi+lo)/2,.16);
        box(p[0],p[1],p[2],col===0||col===columns?.48:.15,hi-lo,.28,steel,a);
      }
      for (let yy = lo+2; yy < hi-1; yy += 3.2) {
        for (let col = 0; col < columns; col++) {
          const p = front(-span/2+(col+.5)*step,yy,.08), lit = facadeRandom()>.29;
          if (lit || col%3===0) windowQuad(p[0],p[1],p[2],step*.46,1.15,a,
            lit?(facadeRandom()>.18?warm:0x85b4cb):0x365363,lit?lights:solid);
          if (lit && style===0) windowQuad(p[0],p[1]-.85,p[2],step*.46,.22,a,warm);
        }
      }
      for (let yy = lo+7; yy < hi; yy += 12.8) {
        const p = front(0,yy,.24);
        box(p[0],p[1],p[2],span+.5,.44,.6,trim,a);
      }
      for (const side of [-1,1]) {
        const p = front(side*(span/2+.65),(top+bottom)/2,.24);
        box(p[0],p[1],p[2],1.05,h,.9,steel,a);
      }
    }
  }
  function tower(x: number, z: number, w: number, d: number, top: number, variant = 0, covered = false) {
    const style = ((variant%4)+4)%4, bottom = -150, shoulder = covered?top:top-18;
    shaft(x,z,w,d,bottom,shoulder,style,covered?AURELION_SECTOR_HEIGHT-28:shoulder-1);
    if (covered) { flush(); return; }
    // Four architectural families, all with real upper volumes rather than interchangeable flat caps.
    armor(x,shoulder+1,z,w+1.6,1.8,d+1.6,trim);
    if (style===0) {
      shaft(x,z,w*.8,d*.8,shoulder+1,top-4,style);
      armor(x,top-3,z,w*.87,1,d*.87,trim);
      prism(x,top+1,z,w*.6,4,d*.6,steel,1);
      machinery(x,top+1,z,w*.43,d*.42,1);
      for (const side of [-1,1]) {
        line([x+side*w*.43,shoulder-7,z],[x+side*w*.27,top-1,z],.8,.8,trim);
        box(x+side*w*.37,shoulder+4,z+d*.4,.4,6,.25,warm,0,lights);
      }
      mast(x,top+3,z-d*.17,9);
    } else if (style===1) {
      for (const side of [-1,1]) {
        const px = x+side*w*.26, cap = top+(side>0?-4:1);
        shaft(px,z,w*.37,d*.78,shoulder+1,cap,style);
        armor(px,cap+.6,z,w*.42,.6,d*.82,trim);
        machinery(px,cap+.6,z,w*.3,d*.45,0);
      }
      box(x,top-6,z,w*.3,1.2,d*.45,steel);
      box(x,top-5.3,z+d*.24,w*.32,.2,.25,warm,0,lights);
      mast(x-w*.26,top+1.6,z-d*.3,9.4);
    } else if (style===2) {
      const r = Math.min(w,d)*.45;
      disc(x,top-7.5,z,r,19,steel);
      for (let i = 0; i < 16; i++) {
        const a = i*Math.PI/8, px = x+Math.sin(a)*r, pz = z+Math.cos(a)*r;
        box(px,top-7,pz,.55,17,.8,trim,a);
        for (let yy = top-12; yy <= top-3; yy += 3)
          windowQuad(x+Math.sin(a+.07)*(r+.05),yy,z+Math.cos(a+.07)*(r+.05),.55,1.2,a+.07,warm);
      }
      for (const y of [top-15,top-7,top+2]) annulus(x,y,z,r+.6,.8,.5,trim,solid,48);
      disc(x,top+2.4,z,r*.87,.8,dark);
      annulus(x,top+2.9,z,r*.7,.26,0,warm,lights,48);
      machinery(x,top+2.8,z,r*.85,r*.65,0);
      mast(x-r*.55,top+2.8,z,7.2);
    } else {
      for (let tier = 0; tier < 3; tier++) {
        const scale = 1-tier*.2, px = x-tier*w*.09, py = shoulder+1+tier*6;
        shaft(px,z,w*scale*.9,d*scale*.9,py,py+5,style);
        armor(px,py+5.7,z,w*scale*.94,.7,d*scale*.94,trim);
        machinery(x+w*(.3-tier*.15),py+5.7,z+d*scale*.26,w*.21,d*.18,tier);
      }
      mast(x-w*.23,top+.7,z-d*.2,9.3);
    }
    // Mid-height setbacks, balconies and external service trunks break the uninterrupted shafts.
    for (const side of [-1,1]) {
      const yy = Math.min(top-28,-22), px = x+side*w*.54;
      armor(px,yy,z,w*.35,2.2,d*.76,steel);
      box(px,yy+.7,z+side*d*.28,w*.3,.8,.5,dark);
      line([x+side*w*.4,-112,z-d*.34],[x+side*w*.4,shoulder-4,z-d*.34],.48,.48,0x8e826d);
    }
    flush();
  }
  function billboard(x: number, y: number, z: number, w: number, h: number, color: number) {
    box(x,y,z,w+2,h+2,1.3,dark);
    box(x,y,z+.72,w,h,.10,color,0,screens);
    for (const side of [-1,1]) {
      box(x+side*(w/2+.55),y,z+.9,.35,h+1,.3,trim);
      box(x,y+side*(h/2+.55),z+.9,w+1,.35,.3,trim);
    }
    // A built media cabinet: panel seams, ventilation crown, rear brackets and a maintenance catwalk.
    armor(x,y+h/2+2,z,w+3,2,2.5,steel);
    for (let i = -3; i <= 3; i++) box(x+i*w*.12,y+h/2+2.08,z+1.3,.45,1,.15,dark);
    box(x,y-h/2-1.1,z+1.4,w+4,.8,4,steel);
    rail([x-w/2-1,y-h/2+.6,z+3],[x+w/2+1,y-h/2+.6,z+3]);
    for (const side of [-1,1]) {
      for (const yy of [y-h*.35,y,y+h*.35]) {
        line([x+side*w*.4,yy,z-2],[x+side*(w/2+.5),yy-2,z+.3],.55,.55,trim);
        box(x+side*(w/2+.6),yy,z+1,.6,1.3,.3,ice,0,lights);
      }
    }
    for (let yy = -h/2+4; yy < h/2; yy += 4) box(x,y+yy,z+.8,w,.06,.025,0x415878,0,screens);
  }

  // Geometric closure beneath the preview's depth-composited cloud layer.
  box(0,-156,0,1600,2,1600,0x526d82);
  // Separate layout samples from facade detail, so further window work cannot move whole city blocks.
  const city: {x:number;z:number;w:number;d:number;top:number;ix:number;iz:number}[] = [];
  for (let iz = -5; iz <= 4; iz++) for (let ix = -6; ix <= 6; ix++) {
    const x = ix*43+(random()-.5)*15, z = iz*43+(random()-.5)*15;
    if (Math.abs(x)<166 && Math.abs(z)<149) continue;
    const w = 10+random()*11, d = 11+random()*10,
      foreground = z>100 && Math.abs(x)<180,
      top = foreground ? -42+random()*32 : -22+random()*85;
    city.push({x,z,w,d,top,ix,iz});
    // Lower blocks form a continuous city fabric, not isolated sticks on the lower datum.
    prism(x,-83,z,w*1.7,57,d*1.65,steel,3);
    armor(x,-82,z,w*1.78,1.6,d*1.72,trim);
    // Deep service roofs get broad readable ducts; reserve the small mechanical meshes for upper roofs.
    box(x+w*.65,-81,z,w*.4,2,d*.35,dark);
    for (const side of [-1,1]) box(x+w*.65,-79.8,z+side*d*.09,w*.33,.4,d*.08,trim);
    tower(x,z,w,d,top,ix+iz*7);
  }
  for (const p of city) {
    const q = city.find(q => q.ix===p.ix+1 && q.iz===p.iz);
    if (!q || (p.ix+p.iz)%3!==0) continue;
    // Short aerial service bridges enter neighbouring facades below their roofs.
    const y = Math.min(p.top,q.top)-29;
    bridge(p.x,p.z,q.x,q.z,4.5,y);
    flush();
  }
  // Tall advertisement landmarks frame the four platforms without occupying them.
  for (const [x,z,top] of [[-180,-104,75],[182,-86,92],[-188,76,40],[187,69,51]])
    tower(x,z,26,23,top,0);
  tower(0,159,18,20,-11,0);
  tower(-67,-156,16,18,64,0);
  tower(56,-168,21,22,81,1);

  // Each entire corner is an upper city precinct, not an elevated pedestal on a flat bridge network.
  const precinct = AURELION_DECK_OUTLINE, deck = AURELION_SECTOR_HEIGHT;
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    const p = precinct.map(([px,pz]) => [sx*px,sz*pz]),
      skirt = precinct.map(([px,pz]) => [sx*(102+(px-102)*1.035),sz*(89+(pz-89)*1.035)]);
    // Broad interlocking shafts and a continuous shoulder replace four exposed thin stilts.
    for (const [px,pz,w,d,top] of [[78,112,36,34,3],[130,108,36,38,7],[126,63,37,29,5],[67,77,29,30,0]])
      tower(sx*px,sz*pz,w,d,top,1,true);
    polygonPrism(skirt,deck-4,24,dark);
    polygonPrism(skirt,deck-2,2,steel);
    polygonPrism(p,deck,2,paving);
    // Low inlaid approach lanes, inspection hatches and drains detail the floor without filling its open courts.
    for (const [ax,az,bx,bz] of [[112,41,112,81],[48,103,96,103],[61,54,94,77]]) {
      line([sx*ax,deck+.04,sz*az],[sx*bx,deck+.04,sz*bz],5,.04,0x617580);
      line([sx*ax,deck+.07,sz*az],[sx*bx,deck+.07,sz*bz],.18,.035,trim);
    }
    pavingGrid(p,deck);
    for (const [px,pz] of [[91,59],[74,97],[124,117],[133,76]]) {
      armor(sx*px,deck+.12,sz*pz,4.5,.1,3.6,dark);
      box(sx*px,deck+.14,sz*pz,3.9,.02,2.9,steel);
      for (const side of [-1,1]) box(sx*px+side*1.6,deck+.16,sz*pz,.2,.025,1,trim);
    }
    for (const [px,pz] of [[139,92],[85,125],[58,84]]) {
      box(sx*px,deck+.03,sz*pz,3,.05,11,dark);
      for (let i = -5; i <= 5; i++) box(sx*px,deck+.1,sz*pz+i*.9,2.8,.08,.18,trim);
    }
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
        // Layered piers, recessed panels and supported maintenance balconies below the public deck.
        line([px+nx*2,deck-20,pz+nz*2],[px+nx*3.4,deck-4,pz+nz*3.4],.7,.7,trim);
        box(px+nx*1.8,deck-8,pz+nz*1.8,2.2,4,.25,dark,yaw);
        for (const h of [deck-5.5,deck-11]) box(px+nx*2, h,pz+nz*2,2.8,.5,1.2,trim,yaw);
        if (Math.round((d-4)/9)%2===0) {
          box(px+nx*2.5,deck-16,pz+nz*2.5,7,.7,4,steel,yaw);
          const pa = [px-dx/span*3+nx*4,deck-14.6,pz-dz/span*3+nz*4],
            pb = [px+dx/span*3+nx*4,deck-14.6,pz+dz/span*3+nz*4];
          rail(pa,pb,false);
          for (const side of [-1,1])
            line([px+side*dx/span*2.5+nx*.5,deck-21,pz+side*dz/span*2.5+nz*.5],
              [px+side*dx/span*2.5+nx*4,deck-16,pz+side*dz/span*2.5+nz*4],.45,.45,steel);
        }
        // Flat panes, rather than unseen six-sided lamp boxes, keep this pass within its mesh budget.
        for (const off of [-2.7,2.7]) for (const h of [deck-7,deck-15,deck-23])
          windowQuad(px+dx/span*off+nx*.08,h,pz+dz/span*off+nz*.08,1.2,3,Math.atan2(nx,nz),warm);
      }
    }
    // Low service roofs and recessed terraces make the precinct read as an inhabited building crown.
    for (const [px,pz,w,d,h] of [[89,130,22,8,6],[149,88,9,24,5]]) {
      prism(sx*px,deck+1,sz*pz,w+2,1,d+2,dark,2);
      prism(sx*px,deck+h,sz*pz,w,h,d,steel,2);
      armor(sx*px,deck+h+.5,sz*pz,w+1,.7,d+1,trim);
      machinery(sx*px,deck+h+.5,sz*pz,w*.62,d*.6,sx===sz?0:1);
      for (const side of [-1,1]) {
        windowQuad(sx*px,deck+h*.55,sz*pz+side*(d/2+.06),w*.6,1.3,side>0?0:Math.PI,ice);
        for (let i = -2; i <= 2; i++)
          box(sx*px+i*w*.17,deck+h*.55,sz*pz+side*(d/2+.16),.3,h*.72,.4,trim);
      }
      mast(sx*(px+w*.32),deck+h+.5,sz*(pz-d*.3),4);
    }
    for (const [px,pz,h] of [[145,121,16],[150,57,23],[77,45,10]]) {
      shaft(sx*px,sz*pz,8,9,deck,deck+h-3,sx===sz?0:3);
      armor(sx*px,deck+h-2,sz*pz,9,1,10,trim);
      prism(sx*px,deck+h,sz*pz,5,2,6,steel,1);
      fan(sx*px,deck+h+.2,sz*pz,1.8);
      mast(sx*(px-2),deck+h,sz*(pz-2),5);
      for (const side of [-1,1]) {
        line([sx*px+side*4.4,deck,sz*pz],[sx*px+side*3.2,deck+h-1,sz*pz],.65,.65,trim);
        box(sx*px+side*2,deck+h-4,sz*pz+4.6,.6,2,.15,ice,0,lights);
      }
    }
    // Offset annexes turn the simple extruded precinct into a layered collection of roof volumes.
    for (const [px,pz,w,d] of [[164,100,18,28],[96,143,27,16]]) {
      shaft(sx*px,sz*pz,w,d,-119,deck-5,sx===sz?1:2);
      armor(sx*px,deck-4,sz*pz,w+1,1,d+1,trim);
      machinery(sx*px,deck-4,sz*pz,w*.52,d*.47,sx===sz?1:0);
      for (const side of [-1,1]) {
        rail([sx*px+side*(w/2-1),deck-2.5,sz*pz-d*.3],
          [sx*px+side*(w/2-1),deck-2.5,sz*pz+d*.3]);
      }
    }
    // Keep peripheral service roofs; arrival courts and the bridge-adjacent floor stay open.
    for (const [px,pz,w,d,h] of [[133,125,16,8,5]]) {
      shaft(sx*px,sz*pz,w,d,deck,deck+h,sx===sz?3:1);
      armor(sx*px,deck+h+.7,sz*pz,w+1,.7,d+1,trim);
      machinery(sx*px,deck+h+.7,sz*pz,w*.4,d*.48,sx===sz?1:0);
      for (const side of [-1,1]) {
        box(sx*px+side*(w/2-1),deck+1.6,sz*(pz+d/2+.5),1.2,3.2,1.2,steel);
        line([sx*px+side*(w/2-1),deck+3,sz*(pz+d/2+2.5)],
          [sx*px+side*(w/2-1),deck+3,sz*(pz+d/2)],.35,.35,trim);
      }
      box(sx*px,deck+3.2,sz*(pz+d/2+1),w*.8,.4,2,steel);
    }
    // Sloped causeways terminate at the actual perimeter openings, not through a railing or raised wall.
    for (const [ax,az,bx,bz,width,ay,by] of AURELION_WALKWAYS.slice(0,4))
      bridge(sx*ax,sz*az,sx*bx,sz*bz,width,ay,by);
    tower(sx*43,sz*36,19,19,-6,1);
    disc(sx*43,-1.18,sz*36,12,2,steel);
    annulus(sx*43,.12,sz*36,10,.4,0,trim);
    annulus(sx*43,.16,sz*36,5,.32,0,warm,lights,48);
    // Inset roof terrace beside the diagonal approach, lower than the whole corner precinct.
    prism(sx*75,5,sz*33,23,9,12,steel,2.5);
    prism(sx*75,5.3,sz*33,21,.3,10,paving,2);
    annulus(sx*75,5.4,sz*33,3.5,.3,0,warm,lights,32);
    disc(sx*75,5.8,sz*33,2.1,.7,dark);
    fan(sx*75,6.3,sz*33,1.6);
    for (const side of [-1,1]) {
      machinery(sx*(75+side*8),5.3,sz*33,3,4,1);
      rail([sx*(75+side*10),6.8,sz*29],[sx*(75+side*10),6.8,sz*37]);
    }
    // A landing's service crown stays outside the crossing lanes.
    for (const [px,pz] of [[35,43],[48,27]]) machinery(sx*px,0,sz*pz,3.2,3.2,1);
    flush();
  }
  for (const side of [-1,1]) {
    for (const [i,[ax,az,bx,bz,width,ay,by]] of AURELION_WALKWAYS.slice(4).entries()) {
      const sx=i===0?side:1,sz=i===1?side:1;
      bridge(sx*ax,sz*az,sx*bx,sz*bz,width,ay,by);
    }
    // Service blocks carry the lower cross-sector streets, well below the four upper districts.
    for (const [px,pz,w,d] of [[side*112,0,24,25],[0,side*103,25,22]]) {
      prism(px,1,pz,w,36,d,dark,3);
      for (let face=0;face<4;face++) {
        const a=face*Math.PI/2,nx=Math.sin(a),nz=Math.cos(a),tx=Math.cos(a),tz=-Math.sin(a),
          depth=(face%2?w:d)/2+.06;
        for (let row=0;row<8;row++) for (let col=0;col<6;col++) {
          if ((col*7+row*3+face)%5===0) continue;
          const u=(col-2.5)*2.5;
          windowQuad(px+nx*depth+tx*u,-29+row*3.2,pz+nz*depth+tz*u,1.1,1.15,a,warm);
        }
      }
    }
    // Slender skyline pylons and their oversized media faces.
    tower(side*30,side*48,9,11,29,0);
  }
  for (const board of AURELION_BILLBOARDS) {
    billboard(board.x,board.y,board.z,board.w,board.h,0xffffff);
  }

  // One continuous circular plaza: the former inner moat and its four footbridges are closed.
  const crown = Array.from({length:96},(_,i) => {
    const a=i*Math.PI*2/96;return [Math.sin(a)*AURELION_CROWN_FLOOR.radius,Math.cos(a)*AURELION_CROWN_FLOOR.radius];
  });
  polygonPrism(crown,0,3,steel);
  polygonPrism(crown,AURELION_CROWN_FLOOR.height,AURELION_CROWN_FLOOR.height,paving);
  annulus(0,.23,0,40.2,.32,0,ice,lights);
  annulus(0,.23,0,35.6,.35,0,warm,lights);
  annulus(0,-3.2,0,41.7,1.4,1,trim);
  annulus(0,-9,0,43.5,3,1.2,dark);
  for (let i = 0; i < 48; i++) {
    const a = i*Math.PI/24, b = (i+.7)*Math.PI/24,
      pt = (angle: number, radius: number, y: number) => [Math.sin(angle)*radius,y,Math.cos(angle)*radius];
    line(pt(a,35.9,.28),pt(a,39.8,.28),.14,.06,trim);
    line(pt(a,41.3,-8),pt(a,41.3,-.4),.65,.8,steel);
    // The diagonal roads do not enter exactly at 45 degrees. Reserve their full width,
    // including this rail segment's half-length, instead of opening only a nominal radial spoke.
    const middle = pt((a+b)/2,41,0), px = Math.abs(middle[0]), pz = Math.abs(middle[2]),
      t = Math.max(0,Math.min(1,((43-px)*18+(36-pz)*17)/(18*18+17*17))),
      onApproach = Math.hypot(px-(43-18*t),pz-(36-17*t))<10;
    if (onApproach || i%12===0 || i%12===11) continue;
    rail(pt(a,41,1.5),pt(b,41,1.5),false);
    line(pt(a,43,-8),pt(b,41,-3.5),.4,.4,trim);
    box(Math.sin(a)*41,-1.4,Math.cos(a)*41,1.6,.4,.4,ice,a,lights);
  }
  annulus(0,.23,0,24.7,1.6,0,warm,lights);
  annulus(0,.20,0,19,.30,0,dark);
  for (let i = 0; i < 16; i++) {
    const a = i*Math.PI/8;
    line([Math.sin(a)*15,.22,Math.cos(a)*15],[Math.sin(a)*24,.22,Math.cos(a)*24],.18,.04,dark);
    line([Math.sin(a)*24,-9,Math.cos(a)*24],[Math.sin(a)*25.5,-1,Math.cos(a)*25.5],1.1,1.1,steel);
    if (i%4) {
      box(Math.sin(a)*26,-.3,Math.cos(a)*26,2,1.2,2,steel,a);
      box(Math.sin(a)*26,.4,Math.cos(a)*26,.8,.2,.8,warm,0,lights);
    }
  }
  for (let i = 0; i < 32; i++) {
    const a = i*Math.PI/16;
    box(Math.sin(a)*22,.23,Math.cos(a)*22,.7,.14,2.3,trim,a);
  }
  disc(0,1.7,0,14,3.2,dark);
  disc(0,3.5,0,12,1,steel);
  annulus(0,4.1,0,11.9,.8,0,ice,lights);
  for (let i = 0; i < 12; i++) {
    const a = i*Math.PI/6, x = Math.sin(a)*13, z = Math.cos(a)*13;
    box(x,2.4,z,1.8,5,2.8,trim,a);
    box(x,4.95,z,1.1,.18,1.4,ice,a,lights);
    line([Math.sin(a)*15,0,Math.cos(a)*15],[Math.sin(a)*12,4,Math.cos(a)*12],.7,.7,steel);
    windowQuad(Math.sin(a)*13.6,2.2,Math.cos(a)*13.6,.7,1.8,a,ice);
  }
  annulus(0,2.4,0,14.6,.5,.5,trim);
  annulus(0,4.3,0,10.8,.3,0,warm,lights);
  // Closed tube sections remain legible from every review angle; no one-sided flat globe ribbons.
  function globeRing(y: number, radius: number, tilt = 0, yaw = 0) {
    const n = 72, sides = 5, tint = rgb(ice), point = (i: number, j: number) => {
      const a = (i%n)/n*Math.PI*2, b = (j%sides)/sides*Math.PI*2, r = radius+.065*Math.cos(b),
        x = Math.sin(a)*r, h = .065*Math.sin(b), z = Math.cos(a)*r,
        yy = h*Math.cos(tilt)-z*Math.sin(tilt), zz = z*Math.cos(tilt)+h*Math.sin(tilt);
      return [x*Math.cos(yaw)+zz*Math.sin(yaw),y+yy,zz*Math.cos(yaw)-x*Math.sin(yaw)];
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < sides; j++) {
      const a = point(i,j), b = point(i+1,j), c = point(i+1,j+1), d = point(i,j+1);
      geom.tri(lights,a,b,c,tint); geom.tri(lights,a,c,d,tint);
    }
  }
  for (let i = 0; i < 8; i++) globeRing(15,10,Math.PI/2,i*Math.PI/8);
  for (let i = -4; i <= 4; i++) globeRing(15+i*2,Math.sqrt(100-i*i*4));
  // A recessed city foundation under the crown, not a second playable floor.
  tower(0,0,20,20,-6,1);
  for (const side of [-1,1]) {
    tower(side*71,0,12,15,-15,0);
    tower(side*28,-side*71,13,14,-22,1);
  }
  flush();
  return [
    {name:'aurelionStructure',data:packed(chunks[0]),glow:0},
    {name:'aurelionLights',data:packed(chunks[1]),glow:1.15},
    {name:'aurelionScreens',data:packed(chunks[2]),glow:.8}
  ];
}
