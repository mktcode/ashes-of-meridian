/* Aurelion massing study. CPU-only scenery, deliberately not a playable battlefield. */
'use strict';
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
  function prism(x: number, top: number, z: number, w: number, h: number, d: number, color = steel, bevel = 2) {
    const p = outline(x,z,w,d,bevel), c = rgb(color);
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i+1)%p.length],
        hiA = [a[0],top,a[1]], hiB = [b[0],top,b[1]],
        loA = [a[0],top-h,a[1]], loB = [b[0],top-h,b[1]];
      geom.tri(solid,[x,top,z],hiB,hiA,c);
      geom.tri(solid,hiA,hiB,loB,c); geom.tri(solid,hiA,loB,loA,c);
      geom.tri(solid,[x,top-h,z],loA,loB,c);
    }
  }
  function line(a: number[], b: number[], width: number, height: number, color: number, out = solid) {
    const dx = b[0]-a[0], dz = b[2]-a[2];
    box((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,width,height,Math.hypot(dx,dz),
      color,Math.atan2(dx,dz),out);
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
      box(x,a[1]-.7,z,.85,2,.85,dark);
      box(x,a[1]+.35,z,.65,.2,.65,warm,0,lights);
    }
  }
  function bridge(ax: number, az: number, bx: number, bz: number, width = 11, y = 0) {
    const dx = bx-ax, dz = bz-az, length = Math.hypot(dx,dz), nx = dz/length, nz = -dx/length;
    line([ax,y-1.5,az],[bx,y-1.5,bz],width,3,steel);
    line([ax,y+.03,az],[bx,y+.03,bz],width-1,.16,paving);
    for (const side of [-1,1]) {
      const x = nx*(width/2-.25)*side, z = nz*(width/2-.25)*side;
      rail([ax+x,y+1.6,az+z],[bx+x,y+1.6,bz+z]);
      line([ax+x,y-1,az+z],[bx+x,y-1,bz+z],.16,.24,warm,lights);
    }
    for (let d = 3; d < length-1; d += 5) {
      const x = ax+dx*d/length, z = az+dz*d/length;
      line([x-nx*(width/2-1),y+.14,z-nz*(width/2-1)],
        [x+nx*(width/2-1),y+.14,z+nz*(width/2-1)],.10,.06,dark);
    }
  }
  function windowQuad(x: number, y: number, z: number, w: number, h: number, yaw: number, color: number) {
    const dx = Math.cos(yaw)*w/2, dz = -Math.sin(yaw)*w/2, c = rgb(color),
      a = [x-dx,y-h/2,z-dz], b = [x+dx,y-h/2,z+dz],
      q = [x+dx,y+h/2,z+dz], p = [x-dx,y+h/2,z-dz];
    geom.tri(lights,a,b,q,c); geom.tri(lights,a,q,p,c);
  }
  function tower(x: number, z: number, w: number, d: number, top: number, variant = 0) {
    const bottom = -150, height = top-bottom;
    prism(x,top,z,w,height,d,dark,Math.min(w,d)*.17);
    // Narrow ribs and stepped crowns keep the towers architectural at overview scale.
    for (const side of [-1,1]) {
      for (const px of [-.34,.34]) box(x+w*px,top-height/2,z+side*d*.48,.65,height,.5,steel);
      for (const pz of [-.34,.34]) box(x+side*w*.48,top-height/2,z+d*pz,.5,height,.65,steel);
      for (let yy = bottom+8; yy < top-6; yy += 23) {
        box(x,yy,z+side*d*.501,w*.76,.65,.22,steel);
        box(x+side*w*.501,yy,z,.22,.65,d*.76,steel);
      }
    }
    prism(x,top+.8,z,w+1.1,1.8,d+1.1,trim,2);
    prism(x,top+1.1,z,w-1.6,.35,d-1.6,dark,1.5);
    prism(x-w*.12,top+4,z,w*.55,3,d*.48,steel,1);
    prism(x-w*.12,top+4.25,z,w*.48,.35,d*.41,trim,.7);
    for (let i = 0; i < 3; i++) box(x+w*.28,top+1.8,z+(i-1)*d*.22,w*.18,1.4,d*.13,steel);
    if (variant%3 === 0) {
      box(x-w*.24,top+7,z-d*.2,.35,10,.35,trim);
      box(x-w*.24,top+12,z-d*.2,.5,.4,.5,ice,0,lights);
    }
    for (let yy = Math.max(bottom+6,top-125); yy < top-4; yy += 4.2) {
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

  // Four large chamfered decks, each supported by a cluster of deep city blocks.
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    const x = sx*111, z = sz*94, w = 76, d = 67;
    for (const dx of [-21,21]) for (const dz of [-17,17]) tower(x+dx,z+dz,28,24,-5,1);
    prism(x,-1,z,w+2,5,d+2,steel,9);
    prism(x,0,z,w,1.2,d,paving,9);
    const p = outline(x,z,w-1,d-1,9);
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i+1)%p.length];
      // Openings at the middle of the inner X and Z edges become the bridge mouths.
      if ((i===0 && sz>0)||(i===4 && sz<0)||(i===2 && sx<0)||(i===6 && sx>0)) {
        for (const [lo,hi] of [[0,.33],[.67,1]]) rail(
          [a[0]+(b[0]-a[0])*lo,1.6,a[1]+(b[1]-a[1])*lo],
          [a[0]+(b[0]-a[0])*hi,1.6,a[1]+(b[1]-a[1])*hi]);
      } else rail([a[0],1.6,a[1]],[b[0],1.6,b[1]]);
    }
    for (let dx = -30; dx <= 30; dx += 6)
      box(x+dx,.07,z,.10,.06,d-10,0x52636e);
    for (let dz = -24; dz <= 24; dz += 6)
      box(x,.08,z+dz,w-11,.06,.10,0x52636e);
    // Neutral landing pavilion stands in for a future HQ; no faction assets or resource entities.
    prism(x,1.2,z,19,1.1,16,dark,4);
    prism(x,3.6,z,15,2.4,12,steel,3);
    prism(x,4.3,z,13,.7,10,trim,2);
    disc(x,4.6,z,3,.65,dark);
    annulus(x,4.95,z,3,.28,0,warm,lights,32);
    for (let i = 0; i < 15; i++) {
      const a = i/14*Math.PI*1.4+Math.PI*.3, px = x+Math.cos(a)*25, pz = z+Math.sin(a)*23;
      prism(px,.5,pz,2.2,.5,2.2,dark,.3);
      box(px,1.2,pz,1,1.3,1,ice,0,lights);
    }
  }

  // Inner diamond and perimeter routes expose several separate urban voids.
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    bridge(sx*111,sz*61,sx*111,sz*37,14);
    bridge(sx*111,sz*37,sx*51,sz*37,13);
    bridge(sx*73,sz*94,sx*52,sz*94,14);
    bridge(sx*52,sz*94,sx*52,sz*38,13);
    bridge(sx*52,sz*38,sx*25,sz*19,13);
    tower(sx*52,sz*38,20,20,-1,1);
    disc(sx*52,1,sz*38,12,2,steel);
    annulus(sx*52,2.1,sz*38,9,.5,0,trim);
    annulus(sx*52,2.15,sz*38,5,.32,0,warm,lights,48);
    prism(sx*53,14,sz*94,12,160,14,steel,2);
    prism(sx*53,15,sz*94,13,1,15,trim,2);
  }
  for (const side of [-1,1]) {
    bridge(side*111,-37,side*111,37,10);
    bridge(-52,side*94,52,side*94,10);
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
