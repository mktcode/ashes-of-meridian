/* Votive Pillar: a compact segmented Aether accumulator held by four ritual contacts. */
'use strict';
(() => {
  const pale=[1,1,1], dark=[.31,.30,.39], trim=[1.12,1.09,1.05];
  function prism(out: number[], outline: number[][], z: number, depth: number, tint: number[]) {
    const area=outline.reduce((s,p,i)=>{const q=outline[(i+1)%outline.length];return s+p[0]*q[1]-q[0]*p[1];},0);
    if(area<0) outline=[...outline].reverse();
    const center=[outline.reduce((s,p)=>s+p[0],0)/outline.length,
      outline.reduce((s,p)=>s+p[1],0)/outline.length];
    for(let i=0;i<outline.length;i++) {
      const a=outline[i],b=outline[(i+1)%outline.length],af=[a[0],a[1],z+depth/2],
        bf=[b[0],b[1],z+depth/2],ab=[a[0],a[1],z-depth/2],bb=[b[0],b[1],z-depth/2];
      geom.tri(out,[...center,z+depth*.62],af,bf,tint);
      geom.tri(out,[...center,z-depth/2],bb,ab,tint);
      geom.tri(out,af,ab,bb,tint.map(v=>v*.82));geom.tri(out,af,bb,bf,tint.map(v=>v*.82));
    }
  }
  function terrace(out: number[]) {
    const n=16, point=(i: number,r: number,y: number)=>{
      const a=i/n*Math.PI*2+.196, tooth=i%4===0?1.2:i%4===2?.94:1.04;
      return [Math.sin(a)*r*tooth,y,Math.cos(a)*r*tooth];
    };
    const levels=[[2.23,.07],[2.23,.23],[1.98,.25],[1.98,.43],[1.64,.45]];
    for(let i=0;i<n;i++) {
      const k=(i+1)%n;
      for(let j=0;j<levels.length-1;j++) {
        const [ra,ya]=levels[j],[rb,yb]=levels[j+1],tint=j<2?dark:trim,
          a=point(i,ra,ya),b=point(k,ra,ya),c=point(k,rb,yb),d=point(i,rb,yb);
        geom.tri(out,a,d,c,tint);geom.tri(out,a,c,b,tint);
      }
      geom.tri(out,[0,.45,0],point(i,levels[4][0],.45),point(k,levels[4][0],.45),dark);
      geom.tri(out,[0,.07,0],point(k,levels[0][0],.07),point(i,levels[0][0],.07),dark);
    }
  }
  function hull() {
    const out: number[]=[], box=geom.box();terrace(out);
    const part=(mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],ry=0)=>
      ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,ry});
    // Four tall contacts leave the two glowing chambers visible from every camera quadrant.
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2+.785,r=1.68,x=Math.sin(a)*r,z=Math.cos(a)*r,contact: number[]=[];
      prism(contact,[[-.6,.45],[.6,.45],[.43,1.18],[.25,4.25],[-.25,4.25],[-.43,1.18]],0,.62,pale);
      prism(contact,[[-.2,1.03],[.2,1.03],[.12,3.8],[-.12,3.8]],.35,.025,dark);
      // Split lower fins form a votive frame around each dark contact face.
      prism(contact,[[-.58,.45],[-.34,.45],[-.22,2.15],[-.34,1.5]],.28,.2,trim);
      prism(contact,[[.34,.45],[.58,.45],[.34,1.5],[.22,2.15]],.28,.2,trim);
      ModelMesh.bake(out,contact,{x,z,ry:a});
      // Forked pale conductor reaches toward the battery without covering it.
      const dx=-Math.sin(a),dz=-Math.cos(a);
      part(box,x+dx*.38,2.65,z+dz*.38,.07,1.3,.07,trim,a,);
      part(box,x+dx*.62,3.22,z+dz*.62,.07,.62,.07,dark,a);
    }
    // Armored collar, chamber separators and vertical cage ribs.
    part(geom.cylinder(8),0,.68,0,1.28,.26,1.28,pale,Math.PI/8);
    for(const y of [1.05,2.25,2.48,3.68]) part(geom.cylinder(10),0,y,0,1.08,.13,1.08,dark);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      for(const y of [1.64,3.08]) part(box,Math.sin(a)*.91,y,Math.cos(a)*.91,.045,.9,.045,trim,a);
    }
    // Four pointed crown petals clasp the upper charge crystal.
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2+.785,petal: number[]=[];
      prism(petal,[[-.3,3.66],[.3,3.66],[.18,4.38],[0,4.62],[-.18,4.38]],0,.42,pale);
      prism(petal,[[-.1,3.82],[.1,3.82],[.05,4.35],[-.05,4.35]],.25,.025,dark);
      ModelMesh.bake(out,petal,{x:Math.sin(a)*.58,z:Math.cos(a)*.58,ry:a});
    }
    return out;
  }
  function charge() {
    const out: number[]=[],n=12;
    for(let i=0;i<n;i++) {
      const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,
        p=[Math.sin(a),-.5,Math.cos(a)],q=[Math.sin(b),-.5,Math.cos(b)],
        r=[Math.sin(b),.5,Math.cos(b)],s=[Math.sin(a),.5,Math.cos(a)],shade=[.84+.12*(i%3),.72,.98];
      geom.tri(out,p,s,r,shade);geom.tri(out,p,r,q,shade);
    }
    return out;
  }
  function bolt() {
    const out: number[]=[], points=[[.78,0],[.96,.1],[1.12,-.07],[1.28,.08],[1.45,-.1],[1.62,.04]],w=.035;
    for(let i=0;i<points.length-1;i++) {
      const a=points[i],b=points[i+1];
      geom.tri(out,[a[0],a[1]-w,0],[b[0],b[1]-w,0],[b[0],b[1]+w,0]);
      geom.tri(out,[a[0],a[1]-w,0],[b[0],b[1]+w,0],[a[0],a[1]+w,0]);
    }
    return out;
  }
  registerEntityModel({
    id:'faction-2/building/depot',
    meshes:{faction2DepotHull:hull,faction2DepotCharge:charge,faction2DepotBolt:bolt},
    render({entity:e,time,animated,part:p,metal,dark,team,accent,surfaceColor}) {
      const s=(e.size||2.3)/2.3,energy=surfaceColor(0x9a68ee);
      p('faction2DepotHull',0,0,0,s,1,s,metal);
      for(const [y,h] of [[1.65,.98],[3.07,.98]])
        p('faction2DepotCharge',0,y,0,.92*s,h,.92*s,energy,0,0,0,0,undefined,PORTAL_MATERIAL);
      p('octa',0,4.78,0,.48*s,1.18,.48*s,energy,time*.08,0,0,.95,undefined,MAT.CRYSTAL);
      for(let i=0;i<4;i++) {
        const a=i*Math.PI/2+.785;
        p('octa',Math.sin(a)*1.68*s,4.5,Math.cos(a)*1.68*s,.2*s,.34,.2*s,accent,0,0,0,.75);
      }
      // Fixed cached paths flash in a deterministic sequence; no RNG or per-frame mesh creation.
      if(animated) for(let i=0;i<4;i++) {
        const flash=Math.max(0,(Math.sin(time*5.2+e.id*1.7+i*2.1)-.58)/.42);
        if(flash>0) p('faction2DepotBolt',0,2.72+(i%2)*.58,0,s,1,s,energy,i*Math.PI/2+.785,0,0,1.25,flash*.82,MAT.CRYSTAL);
      }
      p('octa',0,.78,0,.22*s,.34,.22*s,team,0,0,0,.55);
    }
  });
})();
