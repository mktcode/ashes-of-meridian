/* Silent Throne: six crystal pylons surround a suspended command reliquary and four-bladed crown. */
'use strict';
(() => {
  const pale=[1,1,1], dark=[.29,.29,.38], trim=[1.1,1.07,1.03];
  const point=(a: number,r: number,y: number)=>[Math.sin(a)*r,y,Math.cos(a)*r];
  function stone(out: number[],outline: number[][],z: number,depth: number,tint: number[]) {
    const area=outline.reduce((s,p,i)=>{const q=outline[(i+1)%outline.length];return s+p[0]*q[1]-q[0]*p[1];},0);
    if(area<0) outline=[...outline].reverse();
    const center=[outline.reduce((s,p)=>s+p[0],0)/outline.length,outline.reduce((s,p)=>s+p[1],0)/outline.length];
    for(let i=0;i<outline.length;i++) {
      const a=outline[i],b=outline[(i+1)%outline.length],af=[a[0],a[1],z+depth/2],bf=[b[0],b[1],z+depth/2],
        ab=[a[0],a[1],z-depth/2],bb=[b[0],b[1],z-depth/2],side=tint.map(v=>v*.8);
      geom.tri(out,[...center,z+depth*.62],af,bf,tint);geom.tri(out,[...center,z-depth/2],bb,ab,dark);
      geom.tri(out,af,ab,bb,side);geom.tri(out,af,bb,bf,side);
    }
  }
  function wedge(out: number[],a: number,b: number,inner: number,outer: number,yi: number,yo: number,bottom: number,tint: number[]) {
    const ai=point(a,inner,yi),bi=point(b,inner,yi),ao=point(a,outer,yo),bo=point(b,outer,yo),
      aib=point(a,inner,bottom),bib=point(b,inner,bottom),aob=point(a,outer,bottom),bob=point(b,outer,bottom),side=tint.map(v=>v*.8);
    geom.tri(out,ai,ao,bo,tint);geom.tri(out,ai,bo,bi,tint);
    geom.tri(out,aob,aib,bib,dark);geom.tri(out,aob,bib,bob,dark);
    geom.tri(out,ai,bi,bib,side);geom.tri(out,ai,bib,aib,side);
    geom.tri(out,ao,aob,bob,side);geom.tri(out,ao,bob,bo,side);
    geom.tri(out,ai,aib,aob,side);geom.tri(out,ai,aob,ao,side);
    geom.tri(out,bi,bo,bob,side);geom.tri(out,bi,bob,bib,side);
  }
  function hull() {
    const out: number[]=[],box=geom.box();
    const part=(mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],ry=0,rx=0)=>
      ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,ry,rx});
    // Broad twelve-sided command terrace with six separated ceremonial floor panels.
    part(geom.cylinder(12),0,.18,0,4.28,.3,4.28,dark,Math.PI/12);
    part(geom.cylinder(12),0,.4,0,3.96,.16,3.96,trim,Math.PI/12);
    for(let i=0;i<6;i++) {
      const c=i*Math.PI/3,g=.055;
      wedge(out,c-Math.PI/6+g,c+Math.PI/6-g,1.48,3.55,.72,.56,.38,pale);
      wedge(out,c-.24,c+.24,3.42,4.12,.58,.35,.2,dark);
    }
    // Three broad stair flights face the player and the front diagonals.
    for(const c of [-Math.PI/3,0,Math.PI/3]) for(let j=0;j<5;j++) {
      const r=3.48+j*.17,y=.52-j*.075;
      part(box,Math.sin(c)*r,y,Math.cos(c)*r,1.42,.12,.42,trim,c);
    }
    // Central recessed audience well and faceted command socket.
    part(geom.cylinder(8),0,.68,0,1.64,.35,1.64,dark,Math.PI/8);
    part(geom.cylinder(8),0,.9,0,1.34,.16,1.34,trim,Math.PI/8);
    part(geom.cylinder(8),0,1.08,0,.72,.22,.72,dark,Math.PI/8);
    // Six slender pylons use raised pale facets around long dark inlays.
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3,r=3.48,x=Math.sin(a)*r,z=Math.cos(a)*r,pylon: number[]=[];
      stone(pylon,[[-.52,.28],[.52,.28],[.4,1.18],[.25,4.35],[-.25,4.35],[-.4,1.18]],0,.7,pale);
      for(const face of [-1,1]) stone(pylon,[[-.19,.78],[.19,.78],[.1,3.84],[-.1,3.84]],face*.41,.035,dark);
      stone(pylon,[[-.49,.28],[-.3,.28],[-.18,2.2],[-.32,1.45]],.34,.24,trim);
      stone(pylon,[[.3,.28],[.49,.28],[.32,1.45],[.18,2.2]],.34,.24,trim);
      ModelMesh.bake(out,pylon,{x,z,ry:a});
      part(box,x,.36,z,.88,.22,.92,dark,a);
      part(box,x,4.43,z,.56,.18,.62,trim,a);
    }
    // Four long crown blades sweep down from the central needle onto the floating core.
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2+.785,blade: number[]=[];
      stone(blade,[[.12,4.62],[.2,7.92],[.4,7.42],[1.48,4.92],[1.2,4.48]],0,.38,pale);
      stone(blade,[[.24,5.02],[.27,7.5],[.34,7.24],[1.18,4.98]],.235,.025,dark);
      ModelMesh.bake(out,blade,{ry:a});
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
    // Hexagonal floor channels separate each command-sector panel.
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3+.055,b=(i+1)*Math.PI/3-.055;
      strip(point(a,1.55,.76),point(a,3.28,.6),.025);
      strip(point(a,3.28,.6),point(b,3.28,.6),.025);
    }
    // Vertical pylon conductors and the four central crown seams.
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3,r=3.48,x=Math.sin(a)*r,z=Math.cos(a)*r;
      const w=.025,lo=[x-Math.cos(a)*w,.86,z+Math.sin(a)*w],hi=[x-Math.cos(a)*w,3.8,z+Math.sin(a)*w],
        lo2=[x+Math.cos(a)*w,.86,z-Math.sin(a)*w],hi2=[x+Math.cos(a)*w,3.8,z-Math.sin(a)*w];
      geom.tri(out,lo,hi,hi2);geom.tri(out,lo,hi2,lo2);
    }
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2+.785,x=Math.sin(a)*.29,z=Math.cos(a)*.29,w=.025,tx=Math.cos(a)*w,tz=-Math.sin(a)*w,
        lo=[x-tx,5.08,z-tz],hi=[x-tx,7.52,z-tz],lo2=[x+tx,5.08,z+tz],hi2=[x+tx,7.52,z+tz];
      geom.tri(out,lo,hi,hi2);geom.tri(out,lo,hi2,lo2);
    }
    return out;
  }
  registerEntityModel({
    id:'faction-2/building/hq',
    meshes:{faction2HqHull:hull,faction2HqRibbons:ribbons},
    render({entity:e,time,part:p,ring,metal,dark,team,accent}) {
      const s=(e.size||4.4)/4.4;
      p('faction2HqHull',0,0,0,s,1,s,metal);
      p('octa',0,4.62,0,2.04*s,2.05,2.04*s,dark,.4,0,0,.18);
      p('faction2HqRibbons',0,0,0,s,1,s,team,0,0,0,.9);
      for(let i=0;i<6;i++) {
        const a=i*Math.PI/3;
        p('octa',Math.sin(a)*3.48*s,4.79,Math.cos(a)*3.48*s,.23*s,.38,.23*s,accent,0,0,0,.85);
      }
      p('octa',0,1.42,0,.28*s,.48,.28*s,team,.4,0,0,.9);
      p('octa',0,8.18,0,.2*s,.44,.2*s,team,.4,0,0,1);
      // Three tilted orbital traces reproduce the layered energy paths of the concept.
      ring(2.64*s,4.72,team,.72,.08,time*.15,.9);
      ring(2.9*s,5.72,team,.62,.2,-time*.11,.85);
      ring(2.48*s,6.62,team,.52,.34,time*.09+.7,.8);
    }
  });
})();
