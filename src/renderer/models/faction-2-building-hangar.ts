/* Sky Sepulcher: a horizontal flight portal in a low armored octagonal basin.
 * Local +Z is the broad launch apron; all geometry is cached at upload time. */
'use strict';
(() => {
  const pale=[1,1,1], dark=[.3,.29,.38], trim=[1.1,1.07,1.03];
  const point=(a: number,r: number,y: number)=>[Math.sin(a)*r,y,Math.cos(a)*r];
  function wedge(out: number[],a: number,b: number,inner: number,outer: number,yi: number,yo: number,bottom: number,tint: number[]) {
    const ai=point(a,inner,yi),bi=point(b,inner,yi),ao=point(a,outer,yo),bo=point(b,outer,yo),
      aib=point(a,inner,bottom),bib=point(b,inner,bottom),aob=point(a,outer,bottom),bob=point(b,outer,bottom),
      side=tint.map(v=>v*.78);
    geom.tri(out,ai,ao,bo,tint);geom.tri(out,ai,bo,bi,tint);
    geom.tri(out,aob,aib,bib,dark);geom.tri(out,aob,bib,bob,dark);
    geom.tri(out,ai,bi,bib,side);geom.tri(out,ai,bib,aib,side);
    geom.tri(out,ao,aob,bob,side);geom.tri(out,ao,bob,bo,side);
    geom.tri(out,ai,aib,aob,side);geom.tri(out,ai,aob,ao,side);
    geom.tri(out,bi,bo,bob,side);geom.tri(out,bi,bob,bib,side);
  }
  function hull() {
    const out: number[]=[],box=geom.box(),base=geom.cylinder(12);
    const part=(mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],ry=0,rx=0)=>
      ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,ry,rx});
    // Broad dark plinth and recessed inner well.
    part(base,0,.18,0,3.42,.28,3.42,dark,Math.PI/12);
    part(geom.cylinder(12),0,.36,0,3.16,.16,3.16,trim,Math.PI/12);
    part(geom.cylinder(12),0,.47,0,2.74,.12,2.74,dark,Math.PI/12);
    // Eight separate pale armor blocks reproduce the broken ceremonial rim.
    for(let i=0;i<8;i++) {
      const c=i*Math.PI/4,gap=.075;
      wedge(out,c-Math.PI/8+gap,c+Math.PI/8-gap,2.34,3.12,.72,.63,.42,pale);
      // Dark raised shoulders carry long luminous slots near the outside edge.
      wedge(out,c-.22,c+.22,2.78,3.27,.68,.54,.35,dark);
    }
    // The rear three sections step upward like the reference retaining wall.
    for(const c of [Math.PI*.75,Math.PI,Math.PI*1.25]) {
      wedge(out,c-.28,c+.28,2.36,3.04,.84,.82,.63,dark);
      wedge(out,c-.23,c+.23,2.43,2.96,1.03,1.0,.81,trim);
    }
    // Wide trapezoidal launch apron, sloping down to the battlefield.
    const rampTop=[[-1.12,.77,2.08],[1.12,.77,2.08],[1.48,.58,3.62],[-1.48,.58,3.62]],
      rampBottom=rampTop.map(([x,,z])=>[x,.13,z]);
    geom.tri(out,rampTop[0],rampTop[2],rampTop[1],pale);geom.tri(out,rampTop[0],rampTop[3],rampTop[2],pale);
    for(let i=0;i<4;i++) {
      const k=(i+1)%4;
      geom.tri(out,rampTop[i],rampBottom[i],rampBottom[k],dark);
      geom.tri(out,rampTop[i],rampBottom[k],rampTop[k],dark);
    }
    // Angular toe armor and paired recessed vents flank the apron.
    for(const side of [-1,1]) {
      const a=.42*side,x=Math.sin(a)*3.18,z=Math.cos(a)*3.18;
      part(box,x,.43,z,.66,.25,.48,dark,a);
      part(box,x,.57,z,.42,.035,.28,[.17,.17,.22],a);
      for(let j=-2;j<=2;j++) part(box,x+j*.065*Math.cos(a),.594,z-j*.065*Math.sin(a),.025,.025,.27,trim,a);
      part(box,side*1.54,.34,3.18,.18,.32,.72,trim,side*.22);
    }
    return out;
  }
  function portal() {
    const out: number[]=[],n=48,r=2.31;
    for(let i=0;i<n;i++) {
      const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;
      geom.tri(out,[0,.665,0],point(a,r,.665),point(b,r,.665));
    }
    return out;
  }
  function ribbons() {
    const out: number[]=[];
    const strip=(a: number[],b: number[],width: number)=>{
      const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz),off=[-dz/len*width,0,dx/len*width],
        p=(v: number[],s: number)=>[v[0]+off[0]*s,v[1],v[2]+off[2]*s];
      geom.tri(out,p(a,-1),p(b,-1),p(b,1));geom.tri(out,p(a,-1),p(b,1),p(a,1));
    };
    // Continuous inner halo and one long slot on every armored outer shoulder.
    const n=48;
    for(let i=0;i<n;i++) strip(point(i/n*Math.PI*2,2.38,.755),point((i+1)/n*Math.PI*2,2.38,.755),.035);
    for(let i=0;i<8;i++) {
      const c=i*Math.PI/4;
      strip(point(c-.16,3.035,.705),point(c+.16,3.035,.705),.035);
    }
    // Twin apron rails and the long votive diamond from the supplied design.
    const floor=(x: number,z: number)=>[x,.77-(z-2.08)*(.19/1.54)+.012,z];
    for(const side of [-1,1]) strip(floor(side*.86,2.18),floor(side*1.2,3.48),.018);
    const mark=[[0,2.48],[.12,2.82],[.3,3.02],[.12,3.22],[0,3.52],[-.12,3.22],[-.3,3.02],[-.12,2.82]];
    for(let i=0;i<mark.length;i++) strip(floor(...mark[i] as [number,number]),floor(...mark[(i+1)%mark.length] as [number,number]),.018);
    return out;
  }
  registerEntityModel({
    id:'faction-2/building/hangar',
    meshes:{faction2HangarHull:hull,faction2HangarPortal:portal,faction2HangarRibbons:ribbons},
    render({entity:e,nightPart:p,metal,team,surfaceColor,pointLight}) {
      const s=(e.size||3.8)/3.8;
      pointLight(0, 1.8, 0, 11, 0x8e59e8, 4);
      p('faction2HangarHull',0,0,0,s,1,s,metal);
      p('faction2HangarPortal',0,0,0,s,1,s,surfaceColor(0x8e59e8),0,0,0,0,undefined,PORTAL_MATERIAL);
      p('faction2HangarRibbons',0,0,0,s,1,s,team,0,0,0,.9);
    }
  });
})();
