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
      geom.tri(out,[...center,z+depth*.62],af,bf,tint);geom.tri(out,[...center,z-depth/2],bb,ab,tint.map(v=>v*.88));
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
  const crownProfile=[[1.84,4.55],[1.17,5.55],[.72,6.38],[.36,7.32],[.13,8.35]];
  function core() {
    const out: number[]=[],n=8;
    for(let i=0;i<n;i++) {
      const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,p=point(a,1.86,4.55),q=point(b,1.86,4.55);
      geom.tri(out,[0,2.05,0],q,p);geom.tri(out,[0,5.2,0],p,q);
    }
    return out;
  }
  function lowerOrbit() {
    const out: number[]=[];
    ModelMesh.bake(out,geom.ring(80,.024),{y:4.52,sx:2.72,sz:2.72,rx:.17});
    return out;
  }
  function middleOrbit() {
    const out: number[]=[];
    ModelMesh.bake(out,geom.ring(80,.022),{y:5.28,sx:2.52,sz:2.52,rx:.29,ry:1.15});
    return out;
  }
  function upperOrbit() {
    const out: number[]=[];
    ModelMesh.bake(out,geom.ring(80,.021),{y:6.08,sx:2.24,sz:2.24,rx:.43,ry:.65});
    return out;
  }
  function crownOrbit() {
    const out: number[]=[];
    ModelMesh.bake(out,geom.ring(80,.019),{y:6.82,sx:1.68,sz:1.68,rx:.58,ry:1.62});
    return out;
  }
  function hull() {
    const out: number[]=[],box=geom.box();
    const part=(mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],ry=0,rx=0)=>
      ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,ry,rx});
    // Broad twelve-sided command terrace with six separated ceremonial floor panels.
    part(geom.cylinder(12),0,.18,0,4.28,.3,4.28,dark,Math.PI/12);
    part(geom.cylinder(12),0,.55,0,3.96,.46,3.96,dark,Math.PI/12);
    part(geom.cylinder(12),0,.77,0,3.9,.15,3.9,trim,Math.PI/12);
    for(let i=0;i<6;i++) {
      const c=i*Math.PI/3,g=.055;
      wedge(out,c-Math.PI/6+g,c+Math.PI/6-g,1.48,3.55,1.02,.92,.78,pale);
      wedge(out,c-.24,c+.24,3.42,4.12,.58,.35,.2,dark);
    }
    // Three broad stair flights face the player and the front diagonals.
    for(const c of [-Math.PI/3,0,Math.PI/3]) for(let j=0;j<5;j++) {
      const r=3.48+j*.17,y=.86-j*.15;
      part(box,Math.sin(c)*r,y,Math.cos(c)*r,1.75,.16,.42,trim,c);
    }
    // Pale stair cheeks frame the dark treads, following the same five-step rise.
    for(const c of [-Math.PI/3,0,Math.PI/3]) for(const side of [-1,1]) {
      const rail: number[]=[];
      stone(rail,[[3.34,.3],[4.36,.12],[4.36,.38],[3.34,1.15]],side*.98,.16,trim);
      ModelMesh.bake(out,rail,{ry:c-Math.PI/2});
    }
    // Central recessed audience well and faceted command socket.
    part(geom.cylinder(8),0,.68,0,1.64,.35,1.64,dark,Math.PI/8);
    part(geom.cylinder(8),0,.9,0,1.34,.16,1.34,trim,Math.PI/8);
    part(geom.cylinder(8),0,1.08,0,.72,.22,.72,trim,Math.PI/8);
    for(let i=0;i<4;i++) {
      const fin: number[]=[];
      stone(fin,[[1.22,.85],[1.62,.85],[1.53,3.08],[1.38,3.28]],0,.3,pale);
      ModelMesh.bake(out,fin,{ry:i*Math.PI/2+.785});
    }
    // Six slender pylons use raised pale facets around long dark inlays.
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3,r=3.48,x=Math.sin(a)*r,z=Math.cos(a)*r,pylon: number[]=[];
      stone(pylon,[[-.52,.28],[.52,.28],[.4,1.18],[.25,4.35],[-.25,4.35],[-.4,1.18]],0,.7,pale);
      for(const face of [-1,1]) stone(pylon,[[-.19,.78],[.19,.78],[.1,3.84],[-.1,3.84]],face*.41,.035,dark);
      stone(pylon,[[-.49,.28],[-.3,.28],[-.18,2.2],[-.32,1.45]],.34,.24,trim);
      stone(pylon,[[.3,.28],[.49,.28],[.32,1.45],[.18,2.2]],.34,.24,trim);
      // Broad swept outer foot replaces a straight obelisk planted on the floor.
      const foot: number[]=[];
      stone(foot,[[0,.28],[.91,.28],[.74,.64],[.49,1.12],[.3,1.95],[.2,3.1],[0,3.45]],0,.55,pale);
      stone(foot,[[.2,.44],[.66,.44],[.47,1.04],[.29,1.85]],.29,.025,dark);
      ModelMesh.bake(out,foot,{x,z,ry:a-Math.PI/2});
      ModelMesh.bake(out,pylon,{x,z,ry:a});
      part(box,x,.36,z,.88,.22,.92,dark,a);
      part(box,x,4.43,z,.56,.18,.62,trim,a);
    }
    // Curved flying buttresses anchor each pylon to the inner terrace.
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3,web: number[]=[];
      const profile=[[1.38,.86],[3.45,.5],[3.45,3.5],[3.29,2.6],[3.02,1.91],[2.63,1.5],[2.08,1.18]];
      stone(web,profile,0,.24,dark);
      // Raised pale rails follow the curved upper edge rather than a straight diagonal.
      for(let j=2;j<profile.length-1;j++) {
        const [x,y]=profile[j],[u,v]=profile[j+1];
        stone(web,[[x,y],[u,v],[u,v+.14],[x,y+.14]],0,.36,trim);
      }
      ModelMesh.bake(out,web,{ry:a-Math.PI/2});
    }
    // Closed, swept ivory mantle: four broad faceted petals, not freestanding sticks.
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2,rows=crownProfile.map(([r,y])=>[
        point(a-.71,r*.77,y+.15),point(a,r,y),point(a+.71,r*.77,y+.15)]);
      for(let j=0;j<rows.length-1;j++) for(let k=0;k<2;k++) {
        const p=rows[j][k],q=rows[j][k+1],r=rows[j+1][k+1],s=rows[j+1][k];
        geom.tri(out,p,q,r,k?trim:pale);geom.tri(out,p,r,s,k?trim:pale);
      }
      // Dark recessed seams close the narrow spaces between the mantle petals.
      for(let j=0;j<rows.length-1;j++) {
        const [r,y]=crownProfile[j],[rr,yy]=crownProfile[j+1],
          p=point(a+.71,r*.77,y+.15),q=point(a+.86,r*.77,y+.15),
          s=point(a+.71,rr*.77,yy+.15),t=point(a+.86,rr*.77,yy+.15);
        geom.tri(out,p,q,t,dark);geom.tri(out,p,t,s,dark);
      }
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
      strip(point(a,1.55,1.04),point(a,3.28,.955),.025);
      strip(point(a,3.28,.955),point(b,3.28,.955),.025);
    }
    // Vertical pylon conductors and the four central crown seams.
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3,r=3.48+.45,x=Math.sin(a)*r,z=Math.cos(a)*r;
      const w=.035,lo=[x-Math.cos(a)*w,.86,z+Math.sin(a)*w],hi=[x-Math.cos(a)*w,3.8,z+Math.sin(a)*w],
        lo2=[x+Math.cos(a)*w,.86,z-Math.sin(a)*w],hi2=[x+Math.cos(a)*w,3.8,z-Math.sin(a)*w];
      geom.tri(out,lo,hi,hi2);geom.tri(out,lo,hi2,lo2);
    }
    for(let i=0;i<4;i++) for(let j=0;j<crownProfile.length-1;j++) {
      const a=i*Math.PI/2+.785,[r,y]=crownProfile[j],[rr,yy]=crownProfile[j+1],
        p=point(a-.023,r*.785,y+.16),q=point(a+.023,r*.785,y+.16),
        s=point(a-.023,rr*.785,yy+.16),t=point(a+.023,rr*.785,yy+.16);
      geom.tri(out,p,s,t);geom.tri(out,p,t,q);
    }
    return out;
  }
  registerEntityModel({
    id:'faction-2/building/hq',
    meshes:{faction2HqHull:hull,faction2HqRibbons:ribbons,faction2HqCore:core,
      faction2HqLowerOrbit:lowerOrbit,faction2HqMiddleOrbit:middleOrbit,
      faction2HqUpperOrbit:upperOrbit,faction2HqCrownOrbit:crownOrbit},
    render({entity:e,time,part:p,metal,dark,team,accent,surfaceColor}) {
      const s=(e.size||4.4)/4.4;
      p('faction2HqHull',0,0,0,s,1,s,metal);
      p('faction2HqCore',0,0,0,s,1,s,dark);
      p('faction2HqLowerOrbit',0,0,0,s,1,s,surfaceColor(team),time*.42,0,0,1);
      p('faction2HqMiddleOrbit',0,0,0,s,1,s,surfaceColor(team),-time*.34,0,0,1);
      p('faction2HqUpperOrbit',0,0,0,s,1,s,surfaceColor(team),time*.29,0,0,1);
      p('faction2HqCrownOrbit',0,0,0,s,1,s,surfaceColor(team),-time*.24,0,0,1);
      p('faction2HqRibbons',0,0,0,s,1,s,surfaceColor(team),0,0,0,.9);
      for(let i=0;i<6;i++) {
        const a=i*Math.PI/3;
        p('octa',Math.sin(a)*3.48*s,4.89,Math.cos(a)*3.48*s,.23*s,.48,.23*s,accent,0,0,0,.85);
      }
      p('octa',0,1.42,0,.28*s,.48,.28*s,team,.4,0,0,.9);
      p('octa',0,8.66,0,.13*s,.38,.13*s,team,.4,0,0,1);
    }
  });
})();
