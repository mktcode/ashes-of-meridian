/* Tomb Forge: a broad vehicle gate with armored side housings and recessed cooling banks.
 * Local +Z remains the production front; all meshes are cached at renderer startup. */
'use strict';
(() => {
  const pale=[1,1,1], dark=[.31,.30,.39], trim=[1.1,1.08,1.05];
  // Extruded convex silhouette, with a raised front ridge rather than box-shaped columns.
  function stone(out: number[], outline: number[][], z: number, depth: number, tint: number[]) {
    // Mirrored pylons must keep outward-facing lighting normals.
    const area=outline.reduce((s,p,i)=>{const q=outline[(i+1)%outline.length];return s+p[0]*q[1]-q[0]*p[1];},0);
    if(area<0) outline=[...outline].reverse();
    const cx=outline.reduce((s,p)=>s+p[0],0)/outline.length,
      cy=outline.reduce((s,p)=>s+p[1],0)/outline.length;
    for(let i=0;i<outline.length;i++) {
      const a=outline[i],b=outline[(i+1)%outline.length],
        af=[a[0],a[1],z+depth/2],bf=[b[0],b[1],z+depth/2],
        ab=[a[0],a[1],z-depth/2],bb=[b[0],b[1],z-depth/2];
      geom.tri(out,[cx,cy,z+depth*.66],af,bf,tint);
      geom.tri(out,[cx,cy,z-depth/2],bb,ab,tint);
      geom.tri(out,af,ab,bb,tint.map(v=>v*.85));
      geom.tri(out,af,bb,bf,tint.map(v=>v*.85));
    }
  }
  // Star-shaped footprint with a real stepped perimeter; the terraces follow each notch.
  function terrace(out: number[], side: number) {
    const outline=[[.88,-1.32],[1.28,-1.48],[1.43,-1.92],[2.02,-1.82],
      [2.16,-1.3],[2.74,-1.23],[2.57,.28],[2.3,.94],[1.88,1.02],
      [1.65,1.57],[1.04,1.42],[.88,.78]], center=[1.72,-.12];
    const levels=[[1,.08],[1,.24],[.92,.25],[.92,.44],[.76,.45]],
      rings=levels.map(([scale,y])=>outline.map(([x,z])=>[
        side*(center[0]+(x-center[0])*scale),y,center[1]+(z-center[1])*scale]));
    const tri=(a: number[],b: number[],c: number[],tint: number[])=>
      geom.tri(out,a,side>0?c:b,side>0?b:c,tint);
    for(let i=0;i<outline.length;i++) {
      const n=(i+1)%outline.length;
      for(let j=0;j<rings.length-1;j++) {
        const tint=j<2?dark:trim;
        tri(rings[j][i],rings[j][n],rings[j+1][n],tint);
        tri(rings[j][i],rings[j+1][n],rings[j+1][i],tint);
      }
      tri([side*center[0],.45,center[1]],rings[4][i],rings[4][n],dark);
      tri([side*center[0],.08,center[1]],rings[0][n],rings[0][i],dark);
    }
  }
  // The forge owns its geometry; widening is baked once, never inherited from another model.
  function broad(mesh: number[]) {
    const out: number[]=[];
    ModelMesh.bake(out,mesh,{sx:1.35,sz:1.18});
    return out;
  }
  function hull() {
    const out: number[]=[], box=geom.box();
    const panel=(x: number,y: number,z: number,w: number,h: number,d: number,tint: number[])=>
      ModelMesh.panel(out,{x,y,z,w,h,d,bevel:Math.min(w,h,d)*.16,tint});
    // Separate angular feet, not a circular temple platform.
    for(const side of [-1,1]) {
      terrace(out,side);
      // Squat forge machinery sits behind each outer foot, leaving the central vehicle lane clear.
      panel(side*2.14,1.02,-.92,.83,1.1,1.35,pale);
      panel(side*2.14,1.07,-.21,.6,.55,.055,dark);
      for(let i=0;i<5;i++) panel(side*(1.92+i*.11),1.07,-.165,.035,.46,.08,trim);
      panel(side*2.14,1.63,-.92,.88,.14,1.4,trim);
      // Front armor wedge: a wider, low shoulder distinct from the infantry gate's slender toes.
      stone(out,[[1.96,.47],[2.54,.47],[2.2,2.0],[2.02,2.15]]
        .map(([x,y])=>[side*x,y]),.66,.48,pale);
      stone(out,[[2.11,.66],[2.39,.66],[2.19,1.74],[2.13,1.83]]
        .map(([x,y])=>[side*x,y]),1.0,.035,dark);
      const profile=[[1.1,.46],[2.22,.46],[2.02,1.25],[1.94,5.46],[1.47,5.46],[1.36,2.0]];
      stone(out,profile.map(([x,y])=>[side*x,y]),-.3,.83,pale);
      // Broad spear-shaped inlay sits on the front ridge, not buried inside the stone.
      stone(out,[[1.68,1.02],[1.39,1.78],[1.59,4.96],[1.73,4.96],[1.91,1.78]]
        .map(([x,y])=>[side*x,y]),.565,.025,dark);
      // Split ivory toes run down either side of the inlay, visibly projecting forward.
      for(const toe of [
        [[1.15,.46],[1.42,.46],[1.56,3.94],[1.43,2.28]],
        [[1.97,.46],[2.19,.46],[1.98,2.25],[1.82,3.94]]
      ]) stone(out,toe.map(([x,y])=>[side*x,y]),.48,.38,trim);
      // Long rearward flying buttresses, with pale rails surrounding dark recessed webs.
      for(const angle of [.65,1.65]) {
        const buttress: number[]=[];
        stone(buttress,[[1.02,.46],[1.23,.46],[.08,3.7],[-.06,3.5]],0,.22,pale);
        for(const face of [-1,1]) stone(buttress,[[1.07,.62],[1.14,.62],[.08,3.38],[.01,3.3]],face*.155,.025,dark);
        ModelMesh.bake(out,buttress,{x:side*1.7,z:-.45,sx:.88,ry:side>0?angle:Math.PI-angle});
      }
      panel(side*1.705,5.47,-.3,.64,.18,.72,dark);
      panel(side*1.705,5.61,-.3,.58,.14,.64,trim);
      panel(side*1.1,.18,2.19,.72,.22,.9,dark);
      stone(out,[[.88,.23],[1.33,.23],[1.28,1.04],[.94,1.04]].map(([x,y])=>[side*x,y]),2.19,.43,pale);
      stone(out,[[1.03,.12],[1.17,.12],[1.18,.92]].map(([x,y])=>[side*x,y]),2.51,.12,trim);
      panel(side*1.1,1.07,2.19,.5,.12,.57,trim);
    }
    // Dark ribbed loading bed extends behind the ceremonial ramp.
    panel(0,.53,-1.12,1.86,.2,1.05,dark);
    for(const side of [-1,1]) panel(side*.77,.65,-1.12,.055,.055,.92,trim);
    // Sloping ramp, touching the apron at the front instead of floating above it.
    const ramp: number[]=[];
    ModelMesh.panel(ramp,{w:1.85,h:.18,d:4.24,bevel:.035,tint:pale});
    ModelMesh.bake(out,ramp,{y:.52,z:.61,rx:.14});
    for(const side of [-1,1]) ModelMesh.bake(out,box,
      {x:side*.99,y:.52,z:.61,sx:.1,sy:.18,sz:4.24,rx:.14,tint:dark});
    // Each arch half follows paired inner/outer contours. The bevel is continuous across joints.
    const inner=[[1.12,.74],[1.07,2.5],[.98,3.53],[.75,4.13],[.12,4.73]],
      outer=[[1.42,.64],[1.51,2.55],[1.43,3.83],[1.19,4.54],[.075,5.3]];
    for(const side of [-1,1]) {
      const rows=inner.map(([x,y],i)=>{
        const [ox,oy]=outer[i];
        return [[side*ox,oy,-.57],[side*ox,oy,.03],
          [side*(ox*.85+x*.15),oy*.85+y*.15,.16],
          [side*(ox*.15+x*.85),oy*.15+y*.85,.16],
          [side*x,y,.03],[side*x,y,-.57]];
      });
      for(let j=0;j<rows.length-1;j++) for(let k=0;k<6;k++) {
        const n=(k+1)%6,tint=dark.map(v=>v*(k===1?1.45:k===2?1.12:1));
        const a=rows[j][k],b=rows[j+1][k],c=rows[j+1][n],d=rows[j][n];
        geom.tri(out,a,side>0?b:c,side>0?c:b,tint);
        geom.tri(out,a,side>0?c:d,side>0?d:c,tint);
      }
      for(const row of [rows[0],rows[rows.length-1]]) for(let k=1;k<5;k++)
        geom.tri(out,row[0],row[k],row[k+1],dark);
    }
    return out;
  }
  function ribbons() {
    const out: number[]=[];
    for(const side of [-1,1]) for(const upper of [false,true]) {
      const point=(t: number,dy: number)=>[
        side*(upper? .13+1.53*t : .98+.65*t),
        (upper?5.14-.45*t:3.33+.82*t)-Math.sin(t*Math.PI)*(upper?.23:.35)+dy,
        upper?-.12:.37];
      for(let i=0;i<16;i++) {
        const a=i/16,b=(i+1)/16,w=upper?.055:.075;
        geom.tri(out,point(a,-w),point(b,-w),point(b,w));
        geom.tri(out,point(a,-w),point(b,w),point(a,w));
      }
    }
    for(const side of [-1,1]) {
      ModelMesh.bake(out,geom.box(),{x:side*2.14,y:1.72,z:-.92,sx:.045,sy:.018,sz:1.15});
      ModelMesh.bake(out,geom.box(),{x:side*2.26,y:.9,z:1.03,sx:.035,sy:.42,sz:.025});
    }
    // Inlaid luminous lines and diamond on the processional ramp.
    const line=(a: number[],b: number[],width: number)=>{
      const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz),
        off=[-dz/len*width,0,dx/len*width],
        p=(v: number[],s: number)=>v.map((x,k)=>x+off[k]*s);
      geom.tri(out,p(a,-1),p(b,-1),p(b,1));
      geom.tri(out,p(a,-1),p(b,1),p(a,1));
    };
    const floor=(x: number,z: number)=>[x,.71-(z-.61)*Math.tan(.14),z];
    for(const side of [-1,1]) line(floor(side*.71,-1.2),floor(side*.71,2.7),.018);
    const diamond=[[0,.35],[.11,.85],[.29,1],[.11,1.15],[0,1.65],[-.11,1.15],[-.29,1],[-.11,.85]];
    for(let i=0;i<diamond.length;i++) line(floor(...diamond[i] as [number,number]),floor(...diamond[(i+1)%diamond.length] as [number,number]),.018);
    // Fine silver-violet pendant engravings on the broad dark pylon faces.
    for(const side of [-1,1]) {
      const mark=[[1.68,2.9],[1.78,2.63],[1.68,2.35],[1.58,2.63],[1.68,2.9],[1.68,4.58]],
        mesh: number[]=[];
      for(let i=0;i<mark.length-1;i++) {
        const [x,y]=mark[i],[u,v]=mark[i+1],dx=u-x,dy=v-y,len=Math.hypot(dx,dy),w=.012;
        const a=[side*(x-dy/len*w),y+dx/len*w,.59],b=[side*(u-dy/len*w),v+dx/len*w,.59],
          c=[side*(u+dy/len*w),v-dx/len*w,.59],d=[side*(x+dy/len*w),y-dx/len*w,.59];
        geom.tri(mesh,a,b,c);geom.tri(mesh,a,c,d);
      }
      out.push(...mesh);
    }
    return out;
  }
  function portal() {
    const out: number[]=[], points=[[-1.12,.74],[1.12,.74],[1.07,2.5],[.98,3.53],[.75,4.13],[0,4.85],[-.75,4.13],[-.98,3.53],[-1.07,2.5]];
    // WebGL renders both sides; duplicate coplanar triangles would cause depth/blend artifacts.
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length];
      geom.tri(out,[0,2.6,-.22],[...a,-.22],[...b,-.22]);
    }
    return out;
  }
  registerEntityModel({
    id:'faction-2/building/factory',
    meshes:{faction2FactoryHull:()=>broad(hull()),faction2FactoryPortal:()=>broad(portal()),faction2FactoryRibbons:()=>broad(ribbons())},
    render({entity:e,nightPart:p,metal,dark,team,accent,surfaceColor,pointLight}) {
      const s=(e.size||3.8)/3.8, x=s*1.35, z=s*1.18;
      pointLight(0, 2.2, 2.4*z, 11, 0x9561ec, 4);
      p('faction2FactoryHull',0,0,0,s,1,s,metal);
      p('faction2FactoryPortal',0,0,0,s,1,s,surfaceColor(0x9561ec),0,0,0,0,undefined,PORTAL_MATERIAL);
      p('faction2FactoryRibbons',0,0,0,s,1,s,team,0,0,0,.85);
      for(const side of [-1,1]) {
        p('octa',side*1.705*x,5.94,-.3*z,.28*s,.4,.28*s,accent,0,0,0,.8);
        p('octa',side*1.1*x,1.32,2.19*z,.14*s,.22,.14*s,accent,0,0,0,.8);
      }
      p('octa',0,4.62,.13*z,.22*s,.46,.17*s,dark);
      p('octa',0,5.24,.1*z,.07*s,.31,.07*s,team,0,0,0,.8);
    }
  });
})();
