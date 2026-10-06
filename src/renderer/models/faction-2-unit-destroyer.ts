/* Catafalque: a suspended war barque with an upswept armored prow, exposed
   crystal furnace, double vaulted spars and articulated propulsion bells. */
'use strict';
(() => {
  const ivory=[.92,.90,.83],shadow=[.33,.36,.46],edge=[1.07,1.04,.96],violet=[.70,.57,.90];
  const engines=[-1,1].map(side=>({side,x:side*3.85,y:.48,z:-3.85}));
  function panel(out:number[],x:number,y:number,z:number,w:number,h:number,d:number,tint=ivory) {
    ModelMesh.panel(out,{x,y,z,w,h,d,bevel:Math.min(w,h,d)*.16,tint});
  }
  function box(out:number[],x:number,y:number,z:number,sx:number,sy:number,sz:number,tint=ivory) {
    ModelMesh.bake(out,geom.box(),{x,y,z,sx,sy,sz,tint});
  }
  function rod(out:number[],a:number[],b:number[],radius:number,tint=edge) {
    const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);
    ModelMesh.bake(out,geom.cylinder(8),{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,z:(a[2]+b[2])/2,
      sx:radius,sy:length,sz:radius,rx:Math.acos(d[1]/length),ry:Math.atan2(d[0],d[2]),tint});
  }
  // Closed XY armor profile, extruded along Z; reflections happen by rotation.
  function shield(out:number[],outline:number[][],z:number,depth:number,tint=ivory) {
    const area=outline.reduce((s,p,i)=>{const q=outline[(i+1)%outline.length];return s+p[0]*q[1]-q[0]*p[1];},0);
    if(area<0) outline=[...outline].reverse();
    const c=[outline.reduce((s,p)=>s+p[0],0)/outline.length,outline.reduce((s,p)=>s+p[1],0)/outline.length];
    for(let i=0;i<outline.length;i++) {
      const p=outline[i],q=outline[(i+1)%outline.length],a=[...p,z-depth/2],b=[...q,z-depth/2],
        A=[...p,z+depth/2],B=[...q,z+depth/2];
      geom.tri(out,[...c,z-depth/2],b,a,tint);geom.tri(out,[...c,z+depth/2],A,B,tint);
      geom.tri(out,a,b,B,tint);geom.tri(out,a,B,A,tint);
    }
  }
  // Solid annular arc with closed cut ends, not an emissive billboard or flat strip.
  function arc(radius:number,width:number,depth:number,start:number,end:number,tint=ivory) {
    const out:number[]=[],steps=24,closed=Math.abs(end-start-Math.PI*2)<1e-9,
      point=(a:number,r:number,z:number)=>[Math.cos(a)*r,Math.sin(a)*r,z];
    const quad=(a:number[],b:number[],c:number[],d:number[])=>{geom.tri(out,a,b,c,tint);geom.tri(out,a,c,d,tint);};
    for(let i=0;i<steps;i++) {
      const a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps,
        A=point(a,radius-width,-depth/2),B=point(b,radius-width,-depth/2),C=point(b,radius,-depth/2),D=point(a,radius,-depth/2),
        E=point(a,radius-width,depth/2),F=point(b,radius-width,depth/2),G=point(b,radius,depth/2),H=point(a,radius,depth/2);
      quad(A,B,C,D);quad(E,H,G,F);quad(D,C,G,H);quad(A,E,F,B);
      if(!closed && i===0)quad(A,D,H,E);if(!closed && i===steps-1)quad(B,F,G,C);
    }
    return out;
  }
  function preview(out:number[],neutral:boolean) {
    if(neutral)for(let i=0;i<out.length;i+=9)out[i+6]=out[i+7]=out[i+8]=1;
    return out;
  }
  function keel(out:number[]) {
    // Deep ship sections taper toward the stern but lift the broad bow upward.
    const stations=[[-6.4,.8,-.3,.55],[-4.7,2,-.8,.95],[-1.4,2.25,-1.35,1.15],
      [2.8,2.2,-1.15,1.2],[5.4,1.85,-.85,1.15],[7.6,1.15,-.50,1.65]],
      rings=stations.map(([z,w,b,t])=>[[-w*.72,t,z],[w*.72,t,z],[w,t-.25,z],
        [w,b+.25,z],[w*.70,b,z],[-w*.70,b,z],[-w,b+.25,z],[-w,t-.25,z]]);
    for(let i=0;i<8;i++) {
      const k=(i+1)%8;
      for(let j=0;j<rings.length-1;j++) {
        geom.tri(out,rings[j][i],rings[j+1][i],rings[j+1][k],i===3||i===4?shadow:ivory);
        geom.tri(out,rings[j][i],rings[j+1][k],rings[j][k],i===3||i===4?shadow:ivory);
      }
      const center=(r:number[][])=>r.reduce((s,p)=>s.map((v,k)=>v+p[k]/8),[0,0,0]);
      geom.tri(out,center(rings[0]),rings[0][i],rings[0][k],shadow);
      geom.tri(out,center(rings.at(-1)!),rings.at(-1)![k],rings.at(-1)![i],ivory);
    }
    // Stepped quarterdeck aft; the central reactor well deliberately stays open.
    for(let i=0;i<3;i++)panel(out,0,1.0+i*.20,-4.9+i*.55,1.8+i*.25,.25,.90,edge);
    ModelMesh.bake(out,geom.cylinder(12),{y:1.22,z:-1.5,sx:1.5,sy:.24,sz:1.5,tint:shadow});
    ModelMesh.bake(out,arc(1.48,.18,.17,0,Math.PI*2,edge),{y:1.39,z:-1.5,rx:Math.PI/2});
    for(const side of [-1,1]) {
      rod(out,[side*1.55,1.05,-3.4],[side*1.75,1.27,3.5],.075,edge);
      for(let i=0;i<5;i++)panel(out,side*1.75,1.28,-2.9+i*1.20,.20,.20,.32,shadow);
    }
  }
  function vault(out:number[]) {
    for(const side of [-1,1]) {
      ModelMesh.bake(out,arc(3.1,.21,.24,0,Math.PI),{x:side*1.60,y:1.10,z:-1.0,ry:Math.PI/2});
      ModelMesh.bake(out,arc(2.79,.065,.13,.08,Math.PI-.08,shadow),{x:side*1.60,y:1.10,z:-1.0,ry:Math.PI/2});
      for(const z of [-4.1,2.1])panel(out,side*1.60,1.08,z,.55,.40,.85,edge);
      // Riveted saddles and thin internal conduits break up the long structural ribs.
      for(const angle of [.35,.80,1.25,1.90,2.45,2.85]) {
        const y=1.1+Math.sin(angle)*3.02,z=-1-Math.cos(angle)*3.02;
        panel(out,side*1.60,y,z,.34,.12,.26,shadow);
        rod(out,[side*1.60,y-.20,z],[side*1.60,y+.15,z],.026,edge);
      }
    }
    // A broken transverse crown behind the furnace, distinct from a solid roof.
    ModelMesh.bake(out,arc(1.72,.16,.20,.12,Math.PI-.12,edge),{y:2.55,z:-3.05});
    for(const side of [-1,1])rod(out,[side*1.67,2.74,-3.05],[side*1.60,1.25,-3.50],.065,shadow);
  }
  function flankArmor(out:number[]) {
    const profile=[[-.55,.65],[.55,.65],[.70,-.30],[.36,-.72],[-.36,-.72],[-.70,-.30]];
    for(const side of [-1,1])for(const z of [-2.9,-.6,1.7]) {
      const armor:number[]=[];shield(armor,profile,0,.20);
      shield(armor,profile.map(([x,y])=>[x*.65,y*.66]),.12,.035,shadow);
      for(const y of [-.20,0,.20])box(armor,0,y,.151,.48,.042,.028,edge);
      ModelMesh.bake(out,armor,{x:side*2.22,y:.56,z,ry:side*Math.PI/2});
      rod(out,[side*2.08,.82,z-.48],[side*2.28,1.22,z-.48],.06,edge);
    }
  }
  function drives(out:number[]) {
    for(const {side,x,y,z}of engines) {
      const arm=[[side*1.8,.75,-2.35],[side*2.7,1.15,-2.85],[x,1.05,z]];
      for(let i=0;i<arm.length-1;i++) {
        rod(out,arm[i],arm[i+1],.16,shadow);
        rod(out,arm[i].map((v,k)=>v+(k===1?.15:0)),arm[i+1].map((v,k)=>v+(k===1?.15:0)),.065,edge);
      }
      // Short tapered bells hang from swept arms, not longitudinal tank runners.
      ModelMesh.bake(out,geom.cylinder(12,.72),{x,y,z,sx:.70,sy:1.65,sz:.70,rx:-.35,tint:shadow});
      for(const dy of [-.62,.05,.65])
        ModelMesh.bake(out,geom.cylinder(12),{x,y:y+dy,z:z-dy*.35,sx:.75,sy:.13,sz:.75,tint:edge});
      for(let i=0;i<6;i++) {
        const a=i*Math.PI/3;
        rod(out,[x+Math.cos(a)*.61,y-.50,z+Math.sin(a)*.61],
          [x+Math.cos(a)*.52,y+.63,z+Math.sin(a)*.52],.04,ivory);
      }
      ModelMesh.bake(out,geom.octa(),{x,y:y+.90,z,sx:.20,sy:.26,sz:.20,tint:violet});
    }
  }
  function weapons(out:number[]) {
    // Wide octagonal siege emitter below the raised armored bow.
    ModelMesh.bake(out,arc(.90,.23,.28,0,Math.PI*2,edge),{y:-.10,z:7.72});
    ModelMesh.bake(out,geom.cylinder(12),{y:-.10,z:7.67,sx:.66,sy:.055,sz:.66,rx:Math.PI/2,tint:shadow});
    panel(out,0,-.08,6.2,1.75,1.12,2.25,shadow);
    // Raised focusing spine and paired cooling grilles feed the buried siege lens.
    panel(out,0,1.38,4.2,1.40,.48,2.70,shadow);
    panel(out,0,1.61,4.3,1.15,.17,2.45,edge);
    panel(out,0,1.72,4.3,.13,.035,1.25,violet);
    for(const side of [-1,1])for(let i=0;i<5;i++)
      box(out,side*.43,1.72,3.42+i*.39,.13,.06,.22,shadow);
    for(const side of [-1,1]) {
      const mount:number[]=[];
      shield(mount,[[-.58,-.25],[.58,-.25],[.48,.70],[0,1.05],[-.48,.70]],0,.45,edge);
      ModelMesh.bake(out,mount,{x:side*1.2,y:.75,z:5.8,rz:side*.12});
      // Two underslung batteries: short clustered bores with visible collars.
      panel(out,side*2.22,-.64,3.0,1.0,1.03,1.45);
      for(const spread of [-.24,.24]) {
        const x=side*2.22+spread;
        rod(out,[x,-.68,3.2],[x,-.68,4.30],.14,shadow);
        ModelMesh.bake(out,arc(.21,.075,.13,0,Math.PI*2,edge),{x,y:-.68,z:4.31});
      }
      for(let i=0;i<4;i++)panel(out,side*1.57,.95,3.1+i*.58,.35,.15,.18,edge);
      for(const z of [3.8,4.9])panel(out,side*1.97,.42,z,.20,.90,.85,edge);
    }
  }
  function hull(neutral=false) {
    const out:number[]=[];keel(out);vault(out);flankArmor(out);drives(out);weapons(out);
    return preview(out,neutral);
  }
  function core(neutral=false) {
    const out:number[]=[];
    ModelMesh.bake(out,geom.octa(),{sx:.76,sy:1.12,sz:.76,tint:violet});
    for(const side of [-1,1])for(const z of [-.36,.36])
      ModelMesh.bake(out,geom.octa(),{x:side*.80,y:-.28,z,sx:.22,sy:.52,sz:.22,tint:violet});
    return preview(out,neutral);
  }
  function teamDetails() {
    const out:number[]=[];
    for(const {x,y,z}of engines)
      ModelMesh.bake(out,geom.cylinder(12),{x,y:y-.82,z:z+.28,sx:.46,sy:.05,sz:.46,rx:-.35});
    ModelMesh.bake(out,geom.octa(),{y:-.10,z:7.735,sx:.31,sy:.31,sz:.065});
    for(const side of [-1,1])box(out,side*1.67,1.25,3.85,.055,.04,1.58,[1,1,1]);
    return out;
  }
  registerEntityModel({id:'faction-2/unit/destroyer',meshes:{
    heavy2Body:hull,heavy2BodyNeutral:()=>hull(true),heavy2Team:teamDetails,
    heavy2Core:core,heavy2CoreNeutral:()=>core(true)
  },render({entity,time,nightPart:p,team,surfaceColor:c,pointLight}) {
    const scale=.72,surface=c(0xffffff),neutral=surface!==0xffffff?'Neutral':'',phase=time*1.5+entity.id*.13;
    pointLight(0,2.0,-1.08,9,team,3);
    for(const {x,y,z}of engines)pointLight(x*scale,(y-.82)*scale,(z+.28)*scale,5,team,2);
    p(`heavy2Body${neutral}`,0,0,0,scale,scale,scale,surface);
    p('heavy2Team',0,0,0,scale,scale,scale,c(team),0,0,0,.45);
    p(`heavy2Core${neutral}`,0,2.65*scale,-1.5*scale,scale,scale,scale,surface,time*.35,0,0,.30+.06*Math.sin(phase));
  }});
})();
