/* Civilian scenery, not game entities. Analytic routes and an entirely private cosmetic seed. */
'use strict';
// Local canyon loops pass below the decks, around—not through—their supporting towers.
// Only a small, distant freight lane remains above the skyline.
const AURELION_AIR_LANES = [
  {x:0,z:68,rx:10,rz:42,height:-43,speed:9,count:12,direction:1,kinds:[1,0,0]},
  {x:0,z:-68,rx:10,rz:42,height:-47,speed:10,count:12,direction:-1,kinds:[1,0,0]},
  // Wingless taxis fit between the eastern/western approach piers and the central service towers.
  {x:75,z:0,rx:49,rz:20,height:-44,speed:12,count:12,direction:1,kinds:[0]},
  {x:-75,z:0,rx:49,rz:20,height:-49,speed:11,count:12,direction:-1,kinds:[0]},
  {x:0,z:0,rx:270,rz:215,height:132,speed:26,count:10,direction:1,kinds:[2,0,0,1,0]}
] as const;
interface AurelionFlight { lane:number; phase:number; altitudeOffset:number; kind:number; scale:number; color:number }
function createAurelionFlights(): AurelionFlight[] {
  const random = seeded(0x464c5934), flights: AurelionFlight[] = [], colors = [0xcab78b,0xd5dce1,0x839aab,0xd89464,0x88bbcf];
  for (const [lane,path] of AURELION_AIR_LANES.entries()) for (let i = 0; i < path.count; i++) {
    flights.push({lane,phase:(i+.12+random()*.32)/path.count*Math.PI*2,
      // Interleaved heights leave room between neighbours in the narrower canyon lanes.
      altitudeOffset:path.height<0?-(i%2)*7:0,
      kind:path.kinds[i%path.kinds.length],scale:path.height>0?.55+random()*.25:.7+random()*.35,
      color:colors[Math.floor(random()*colors.length)]});
  }
  return flights;
}
function sampleAurelionFlight(flight: AurelionFlight, time: number) {
  const path = AURELION_AIR_LANES[flight.lane], a = flight.phase+time*path.speed/((path.rx+path.rz)/2)*path.direction,
    dx = -path.rx*Math.sin(a)*path.direction, dz = path.rz*Math.cos(a)*path.direction;
  return {x:path.x+Math.cos(a)*path.rx,y:path.height+flight.altitudeOffset+Math.sin(a*3+flight.phase)*.65,z:path.z+Math.sin(a)*path.rz,
    yaw:Math.atan2(dx,dz),bank:path.direction*.075};
}
function createAurelionAircraft() {
  const cube = geom.box(), engine = geom.cylinder(12), meshes: {name:string;data:Float32Array;glow:number}[] = [];
  const rgb = (c: number) => [(c>>16&255)/255,(c>>8&255)/255,(c&255)/255];
  for (let kind = 0; kind < 3; kind++) {
    const solid: number[] = [], lights: number[] = [];
    function box(x: number,y: number,z: number,w: number,h: number,d: number,c: number,out=solid,ry=0) {
      ModelMesh.bake(out,cube,{x,y,z,sx:w,sy:h,sz:d,ry,tint:rgb(c)});
    }
    function panel(x: number,y: number,z: number,w: number,h: number,d: number,c: number) {
      ModelMesh.panel(solid,{x,y,z,w,h,d,bevel:Math.min(.18,h*.2),tint:rgb(c)});
    }
    function hull(sections: number[][], color: number, out=solid) {
      const rings = sections.map(([z,w,y,h]) => Array.from({length:8},(_,i) => {
        const a = i*Math.PI/4; return [Math.cos(a)*w,y+Math.sin(a)*h,z];
      })), c = rgb(color);
      for (let j = 0; j < rings.length-1; j++) for (let i = 0; i < 8; i++) {
        const k = (i+1)%8, a = rings[j][i], b = rings[j][k], q = rings[j+1][k], p = rings[j+1][i];
        geom.tri(out,a,b,q,c); geom.tri(out,a,q,p,c);
      }
      for (let i = 0; i < 8; i++) {
        const k = (i+1)%8, last = sections.length-1;
        geom.tri(out,[0,sections[0][2],sections[0][0]],rings[0][k],rings[0][i],c);
        geom.tri(out,[0,sections[last][2],sections[last][0]],rings[last][i],rings[last][k],c);
      }
    }
    function wing(points: number[][], y: number, h: number) {
      const area = points.reduce((s,a,i) => {const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0),
        p = area<0?[...points].reverse():points, x=p.reduce((s,a)=>s+a[0],0)/p.length,z=p.reduce((s,a)=>s+a[1],0)/p.length,
        c=rgb(0xaab5be);
      for (let i=0;i<p.length;i++) {
        const a=p[i],b=p[(i+1)%p.length],ah=[a[0],y+h/2,a[1]],bh=[b[0],y+h/2,b[1]],al=[a[0],y-h/2,a[1]],bl=[b[0],y-h/2,b[1]];
        geom.tri(solid,[x,y+h/2,z],bh,ah,c); geom.tri(solid,[x,y-h/2,z],al,bl,c);
        geom.tri(solid,ah,bh,bl,c); geom.tri(solid,ah,bl,al,c);
      }
    }
    if (kind===0) {
      hull([[-3.6,1.25,0,.52],[-2.5,1.9,0,.68],[1.7,1.65,0,.65],[3.6,.75,-.1,.28]],0xbdc6ce);
      hull([[-1.5,1.25,.55,.22],[-.7,1.2,.75,.4],[1.5,.85,.72,.34],[2.1,.55,.45,.1]],0x153c52);
      panel(0,-.45,-.2,3.1,.4,4.8,0x394751);
      for (const side of [-1,1]) {
        panel(side*1.72,-.13,-1, .55,.6,4.2,0x647d90);
        box(side*1.36,0,2.35,.48,.22,.65,0xc4edff,lights);
        box(side*1.2,.13,-3.3,.54,.27,.15,0x66d9ff,lights);
        box(side*1.65,.24,-.4,.1,.13,2.2,0xd1b674);
      }
    } else if (kind===1) {
      hull([[-4.7,1.0,0,.5],[-2,1.35,.1,.8],[1.5,.85,.15,.5],[5,.12,-.02,.12]],0xc1ccd1);
      hull([[-.8,.75,.69,.15],[.5,.66,.81,.3],[2.1,.38,.62,.12]],0x18506a);
      for (const side of [-1,1]) {
        wing([[side*.8,1.1],[side*5.6,-2.6],[side*4.5,-3.7],[side*.8,-2.4]],0,.32);
        panel(side*2.4,.15,-2.5,1.2,.85,4.1,0x697d8d);
        ModelMesh.bake(lights,engine,{x:side*2.4,y:.15,z:-4.61,sx:.36,sy:.16,sz:.36,rx:Math.PI/2,tint:rgb(0x70e4ff)});
        box(side*5.15,.1,-2.85,.2,.13,.4,side>0?0xa5efcb:0xf2ac8f,lights);
      }
      box(0,.45,-3.3,.24,1.9,1.5,0x819cac);
    } else {
      hull([[-9,1.8,0,1],[-6,2.5,.1,1.35],[4.7,2.2,.15,1.15],[8.8,1,.1,.4]],0x8599a7);
      panel(0,1.7,3,3.6,1.3,4.8,0xbbc6ce);
      box(0,2.1,5.43,2.8,.55,.1,0x89cfe3,lights);
      for (const side of [-1,1]) {
        panel(side*3.4,-.1,-2,2.2,1.8,11.5,0x5c7183);
        for (let i=0;i<4;i++) panel(side*3.4,1.18,-5.8+i*2.6,2.0,.65,2.2,0xa8a38f);
        box(side*3.4,.1,-7.85,1.5,.55,.12,0x6addff,lights);
        wing([[side*1.8,5.5],[side*5.9,1.2],[side*5.5,-.5],[side*2,-1]],-.4,.48);
        for (let i=0;i<6;i++) box(side*2.23,.75,-5+i*1.4,.1,.18,.48,0xe5d6a5,lights);
      }
    }
    meshes.push({name:`aurelionAir${kind}`,data:new Float32Array(solid),glow:0},
      {name:`aurelionAir${kind}Lights`,data:new Float32Array(lights),glow:2});
  }
  return meshes;
}
function drawAurelionFlights(renderer: Pick<MeridianRenderer,'add'|'beam'>, flights: readonly AurelionFlight[], time: number) {
  for (const flight of flights) {
    const p = sampleAurelionFlight(flight,time), s=flight.scale, tail=[3.6,4.7,9][flight.kind]*s;
    renderer.add(`aurelionAir${flight.kind}`,p.x,p.y,p.z,s,s,s,flight.color,p.yaw,0,p.bank,0,1,'dynamic',MAT.METAL);
    renderer.add(`aurelionAir${flight.kind}Lights`,p.x,p.y,p.z,s,s,s,0xffffff,p.yaw,0,p.bank,2,1,'dynamic',MAT.METAL);
    for (const side of [-1,1]) {
      const wing=[1.2,2.4,3.4][flight.kind]*side*s;
      let a=[p.x-Math.sin(p.yaw)*tail+Math.cos(p.yaw)*wing,p.y,p.z-Math.cos(p.yaw)*tail-Math.sin(p.yaw)*wing];
      for (let segment=0;segment<3;segment++) {
        const q=sampleAurelionFlight(flight,time-(segment+1)*.10),
          b=[q.x-Math.sin(q.yaw)*tail+Math.cos(q.yaw)*wing,q.y,q.z-Math.cos(q.yaw)*tail-Math.sin(q.yaw)*wing];
        renderer.beam(a,b,(.13-segment*.035)*s,0x84dfff,2,.45-segment*.13); a=b;
      }
    }
  }
}
