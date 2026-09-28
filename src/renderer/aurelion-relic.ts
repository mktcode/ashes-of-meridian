/* The Crown's unknown reactor: static, opaque salvage landmark. No simulation RNG. */
'use strict';
function createAurelionRelic() {
  const hull:number[]=[], inlay:number[]=[], crystal:number[]=[], cube=geom.box(), bolt=geom.cylinder(8),
    rgb=(c:number)=>[(c>>16&255)/255,(c>>8&255)/255,(c&255)/255];
  const plate:number[]=[];
  ModelMesh.panel(plate,{w:1,h:1,d:1,bevel:.09});
  function part(out:number[],mesh:MeshData,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number,ry=0,rx=0,rz=0) {
    ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,ry,rx,rz,tint:rgb(color)});
  }
  // Faceted, asymmetric double-terminated crystals, not glowing spheres. Long faces
  // carry smaller embedded veins and broken satellite growths rather than a white halo.
  function shard(x:number,y:number,z:number,r:number,h:number,lean:number,yaw:number,color:number) {
    const data:number[]=[],n=7,point=(i:number,level:number)=>{
      const a=i*Math.PI*2/n+.16,scale=level===0?.68:1;
      return [Math.sin(a)*r*scale,(level===0?-.34:.27)*h,Math.cos(a)*r*scale];
    };
    for(let i=0;i<n;i++) {
      const a=point(i,0),b=point((i+1)%n,0),c=point((i+1)%n,1),d=point(i,1),
        tint=rgb(color).map(v=>v*(.68+(i%3)*.14));
      geom.tri(data,a,b,c,tint);geom.tri(data,a,c,d,tint);
      geom.tri(data,[r*.22,h*.66,-r*.17],d,c,tint.map(v=>v*1.15));
      geom.tri(data,[-r*.16,-h*.53,r*.13],b,a,tint.map(v=>v*.75));
    }
    part(crystal,data,x,y,z,1,1,1,0xffffff,yaw,lean*.3,lean);
  }
  shard(1,11,0,3.6,18,-.18,.15,0x8cd8e0);
  shard(-4.7,8,1.5,2.1,10,.35,1.2,0xabb5ee);
  shard(4.4,7,2,1.8,8,-.42,.6,0x6cc7d7);
  for(let i=0;i<9;i++) {
    const a=i*Math.PI*2/9,r=5.2+(i%3)*.75;
    shard(Math.sin(a)*r,4.4+(i%3)*.3,Math.cos(a)*r,.5+(i%2)*.3,2.4+(i%4),Math.sin(a)*.38,a,0x83cbd7);
  }
  // Split containment toroid, pitched across the core. Radial caps close its torn
  // ends; brass ribs, fasteners and luminous inscriptions expose its layered build.
  const tilt=1.03,yaw=.38,point=(a:number,r:number,offset=0)=>{
    const x=Math.sin(a)*r,z=Math.cos(a)*r,yy=offset*Math.cos(tilt)-z*Math.sin(tilt),zz=z*Math.cos(tilt)+offset*Math.sin(tilt);
    return [x*Math.cos(yaw)+zz*Math.sin(yaw),11+yy,-x*Math.sin(yaw)+zz*Math.cos(yaw)];
  };
  for(const [r,thickness,offset,color] of [[8.7,.64,0,0x677b8c],[8.7,.22,.85,0xb39c74],[7.7,.14,0,0x45616f]]) {
    const count=80,sides=8,start=.35,end=5.1;
    const v=(i:number,j:number)=>{
      const a=start+(end-start)*i/count,b=j*Math.PI*2/sides;
      return point(a,r+Math.cos(b)*thickness,offset+Math.sin(b)*thickness);
    };
    for(let i=0;i<count;i++)for(let j=0;j<sides;j++) {
      const a=v(i,j),b=v(i+1,j),c=v(i+1,j+1),d=v(i,j+1),tint=rgb(color);
      geom.tri(hull,a,b,c,tint);geom.tri(hull,a,c,d,tint);
    }
    for(let j=0;j<sides;j++) {
      geom.tri(hull,point(start,r,offset),v(0,j+1),v(0,j),rgb(0xd0ae87));
      geom.tri(hull,point(end,r,offset),v(count,j),v(count,j+1),rgb(0xd0ae87));
    }
  }
  for(let i=0;i<38;i++) {
    const a=.42+i*.12,p=point(a,8.75),q=point(a,8.77,.73);
    part(hull,plate,p[0],p[1],p[2],.55,.7,1.75,i%3?0x364650:0xaaa086,yaw,tilt,-a);
    part(inlay,cube,q[0],q[1],q[2],.10,.06,.42,i%5?0x79cdd8:0xe0b079,yaw,tilt,-a);
  }
  // Torn petal armour and exposed radiator stacks. Deliberately unequal silhouettes
  // suggest a damaged machine, not another symmetric monument or a complete ship.
  for(let i=0;i<9;i++) {
    const a=i*Math.PI*2/9,high=[7,4,9,5,3,6,8,4,5][i],r=8.8;
    part(hull,plate,Math.sin(a)*r,3.5+high/2,Math.cos(a)*r,3,high,.85,i%2?0x53626b:0x75848c,a,0,(i%3-1)*.1);
    for(let j=0;j<5;j++) {
      const rr=r-.8;
      part(hull,cube,Math.sin(a)*rr,4+j*.47,Math.cos(a)*rr,2.8,.17,1.8,0x26373e,a);
    }
    for(const side of [-1,1]) {
      const x=Math.sin(a)*r+Math.cos(a)*side,z=Math.cos(a)*r-Math.sin(a)*side;
      for(let j=0;j<3;j++) part(hull,bolt,x,4+j*1.1,z,.12,.18,.12,0xc5aa7f,a);
    }
    // Flush alien glyphs use segmented, non-alphabetic forms on each armour crown.
    for(let j=0;j<4;j++) {
      const x=Math.sin(a)*(r+.47)+Math.cos(a)*(j-1.5)*.36,z=Math.cos(a)*(r+.47)-Math.sin(a)*(j-1.5)*.36;
      part(inlay,cube,x,4.1+high*.65+(j%2)*.2,z,.12,.4+(j%3)*.14,.06,0x81d1df,a);
    }
  }
  // Broken collars and fallen plates stay entirely on the already impassable plinth.
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6,r=10.4+(i%2)*.6;
    part(hull,plate,Math.sin(a)*r,4.2,Math.cos(a)*r,2.6,.6,2.1,0x687880,a,.12,(i%3-1)*.2);
    for(let j=0;j<3;j++) part(hull,cube,Math.sin(a)*r,4.56+j*.13,Math.cos(a)*r,1.4,.05,.9,0x273941,a);
  }
  return [
    {name:'echoRelicHull',data:new Float32Array(hull),glow:0,static:true,material:MAT.METAL},
    {name:'echoRelicInlay',data:new Float32Array(inlay),glow:.65,static:true,material:MAT.CRYSTAL},
    {name:'echoRelicCrystal',data:new Float32Array(crystal),glow:.35,static:true,material:MAT.CRYSTAL}
  ];
}
