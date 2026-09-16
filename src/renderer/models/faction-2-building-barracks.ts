/* Processional gate: swept stone pylons, a split arch and a shader-driven veil.
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
  function hull() {
    const out: number[]=[], box=geom.box();
    const panel=(x: number,y: number,z: number,w: number,h: number,d: number,tint: number[])=>
      ModelMesh.panel(out,{x,y,z,w,h,d,bevel:Math.min(w,h,d)*.16,tint});
    // Separate angular feet, not a circular temple platform.
    for(const side of [-1,1]) {
      panel(side*1.7,.22,0,2.06,.32,3.7,dark);
      panel(side*1.7,.42,0,1.9,.22,3.48,pale);
      panel(side*1.69,.59,-.08,1.36,.22,2.85,dark);
      const profile=[[1.06,.55],[2.24,.55],[2.02,1.25],[1.94,5.46],[1.47,5.46],[1.39,2.0]];
      stone(out,profile.map(([x,y])=>[side*x,y]),-.3,.83,pale);
      stone(out,[[1.52,1.32],[1.82,1.68],[1.81,4.92],[1.66,4.92]].map(([x,y])=>[side*x,y]),.27,.035,dark);
      // Long flying buttresses anchor each spire toward the rear and outer foot.
      const buttress: number[]=[];
      stone(buttress,[[0,.52],[.82,.52],[.21,3.25],[.06,2.2]],0,.24,trim);
      ModelMesh.bake(out,buttress,{x:side*1.73,z:-.36,ry:side*-.75});
      ModelMesh.bake(out,buttress,{x:side*1.84,z:-.75,ry:side*2.35});
      panel(side*1.705,5.47,-.3,.64,.18,.72,dark);
      panel(side*1.705,5.61,-.3,.58,.14,.64,trim);
      panel(side*1.1,.62,2.19,.53,.82,.63,pale);
      panel(side*1.1,1.07,2.19,.58,.12,.68,dark);
    }
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
    const diamond=[[0,.42],[.26,1],[0,1.58],[-.26,1]];
    for(let i=0;i<4;i++) line(floor(...diamond[i] as [number,number]),floor(...diamond[(i+1)%4] as [number,number]),.024);
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
    id:'faction-2/building/barracks',
    meshes:{faction2BarracksHull:hull,faction2BarracksPortal:portal,faction2BarracksRibbons:ribbons},
    render({entity:e,part:p,metal,dark,team,accent,surfaceColor}) {
      const s=(e.size||3)/3;
      p('faction2BarracksHull',0,0,0,s,1,s,metal);
      p('faction2BarracksPortal',0,0,0,s,1,s,surfaceColor(0x9561ec),0,0,0,0,undefined,PORTAL_MATERIAL);
      p('faction2BarracksRibbons',0,0,0,s,1,s,team,0,0,0,.85);
      for(const side of [-1,1]) {
        p('octa',side*1.705*s,5.94,-.3*s,.24*s,.36,.24*s,accent,0,0,0,.8);
        p('octa',side*1.1*s,1.32,2.19*s,.14*s,.22,.14*s,accent,0,0,0,.8);
      }
      p('octa',0,4.62,.13*s,.18*s,.46,.17*s,dark);
      p('octa',0,5.24,.1*s,.07*s,.31,.07*s,team,0,0,0,.8);
    }
  });
})();
