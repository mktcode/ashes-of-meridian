/* Veiled Court turret: forked aether projector on a faceted octagonal bastion. */
'use strict';
(() => {
  const pale=[1,1,1], ivory=[1.38,1.32,1.22], trim=[1.12,1.09,1.03], dark=[.29,.3,.39], recess=[.21,.23,.32];
  // Closed side-profile extrusion. Coordinates are [z,y], extruded across x.
  function slab(out: number[],outline: number[][],x: number,width: number,tint: number[]) {
    const area=outline.reduce((sum,p,i)=>{const q=outline[(i+1)%outline.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    if(area<0) outline=[...outline].reverse();
    const center=[outline.reduce((s,p)=>s+p[0],0)/outline.length,outline.reduce((s,p)=>s+p[1],0)/outline.length],
      side=tint.map(v=>v*.82),a=x-width/2,b=x+width/2;
    for(let i=0;i<outline.length;i++) {
      const p=outline[i],q=outline[(i+1)%outline.length],pa=[a,p[1],p[0]],qa=[a,q[1],q[0]],
        pb=[b,p[1],p[0]],qb=[b,q[1],q[0]];
      geom.tri(out,[a,center[1],center[0]],qa,pa,tint.map(v=>v*.9));
      geom.tri(out,[b,center[1],center[0]],pb,qb,tint);
      geom.tri(out,pa,qa,qb,side);geom.tri(out,pa,qb,pb,side);
    }
  }
  function hull() {
    const out: number[]=[],box=geom.box(),oct=geom.cylinder(8),cyl=geom.cylinder(12);
    const part=(mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],ry=0,rx=0,rz=0)=>
      ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,ry,rx,rz});
    // Three-tier octagonal bunker, with a dark armored skirt and pale sloped crown.
    part(oct,0,.16,0,1.82,.3,1.82,dark,Math.PI/8);
    part(oct,0,.43,0,1.68,.26,1.68,recess,Math.PI/8);
    part(oct,0,.72,0,1.48,.34,1.48,pale,Math.PI/8);
    part(oct,0,1.02,0,1.31,.28,1.31,trim,Math.PI/8);
    part(oct,0,1.17,0,1.14,.11,1.14,dark,Math.PI/8);
    // Eight inset skirt plates and alternating pale upper armor facets.
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4,r=1.62;
      part(box,Math.sin(a)*r,.51,Math.cos(a)*r,.57,.43,.055,i%2?dark:recess,a);
      if(i%2===0) part(box,Math.sin(a)*1.34,.9,Math.cos(a)*1.34,.62,.34,.045,trim,a);
    }
    // Front corner capacitor towers with deeply cut ventilation grilles.
    for(const side of [-1,1]) {
      const x=side*1.19,z=1.08;
      ModelMesh.panel(out,{x,y:.84,z,w:.42,h:.92,d:.5,bevel:.06,tint:pale});
      ModelMesh.panel(out,{x,y:.85,z:z+.258,w:.29,h:.55,d:.035,bevel:.008,tint:dark});
      for(let k=-1.5;k<=1.5;k++) part(box,x+k*.065,.84,z+.282,.022,.4,.018,recess);
      part(oct,x,1.33,z,.31,.12,.31,dark,Math.PI/8);
    }
    // Turret race and segmented violet-bearing recess.
    part(cyl,0,1.31,0,1.02,.16,1.02,recess,Math.PI/12);
    part(cyl,0,1.43,0,.91,.1,.91,trim,Math.PI/12);
    part(cyl,0,1.52,0,.79,.09,.79,dark,Math.PI/12);
    for(let i=0;i<12;i+=2) {
      const a=i*Math.PI/6;
      part(box,Math.sin(a)*.84,1.48,Math.cos(a)*.84,.24,.09,.045,trim,a);
    }
    // Sloped armored neck carries the weapon above the race.
    for(const side of [-1,1]) slab(out,[[-.72,1.42],[.74,1.42],[.58,2.52],[.27,2.83],[-.42,2.72]],side*.43,.5,pale);
    slab(out,[[-.58,1.53],[.59,1.53],[.45,2.38],[-.36,2.38]],0,.36,dark);
    // Rear counterweight, pale cheek armor and cyan-cap socket.
    slab(out,[[-1.28,2.45],[-.58,2.35],[-.27,2.77],[-.38,3.62],[-.88,3.94],[-1.39,3.62]],0,1.02,recess);
    for(const side of [-1,1]) slab(out,[[-1.35,2.55],[-.91,2.48],[-.72,3.79],[-1.24,3.68]],side*.59,.22,pale);
    part(box,0,3.83,-1.06,.72,.16,.67,trim);
    part(oct,0,3.94,-1.08,.35,.12,.35,dark,Math.PI/8);
    // Large faceted side breeches around the circular emitter.
    for(const side of [-1,1]) {
      slab(out,[[-.64,2.53],[.42,2.61],[.73,3.13],[.31,3.67],[-.58,3.77],[-.84,3.28]],side*.62,.48,ivory);
      slab(out,[[-.47,2.72],[.19,2.77],[.39,3.14],[.14,3.43],[-.43,3.49]],side*.885,.055,trim);
    }
    part(cyl,0,3.18,.12,.52,.24,.52,dark,0,Math.PI/2);
    part(cyl,0,3.18,.34,.38,.18,.38,trim,0,Math.PI/2);
    // Four long fork rails surround the suspended aether lance.
    for(const side of [-1,1]) {
      slab(out,[[.2,3.45],[2.12,3.18],[2.42,3.25],[2.23,3.47],[.48,3.86]],side*.57,.25,ivory);
      slab(out,[[.35,3.64],[2.14,3.34],[2.27,3.39],[.5,3.82]],side*.575,.11,dark);
      slab(out,[[.12,3.05],[2.03,2.69],[2.3,2.75],[2.12,3.02],[.43,3.37]],side*.63,.27,ivory);
      slab(out,[[.37,3.09],[2.04,2.78],[2.17,2.83],[.49,3.27]],side*.635,.12,dark);
      // Angular ivory knuckle plate where each fork meets the breech.
      slab(out,[[-.08,2.77],[.68,2.84],[.83,3.37],[.42,3.69],[-.25,3.58]],side*.79,.14,trim);
    }
    // Dark end caps make each fork read as a heavy armored rail.
    for(const side of [-1,1]) {
      part(box,side*.57,3.3,2.25,.27,.22,.28,dark,0,.18);
      part(box,side*.63,2.85,2.17,.29,.2,.28,dark,0,.18);
    }
    return out;
  }
  function lights() {
    const out: number[]=[],box=geom.box(),cyl=geom.cylinder(12);
    const part=(mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,ry=0,rx=0,rz=0)=>
      ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,ry,rx,rz});
    // Foundation sill, bearing segments, rear charge strip and four rail conductors.
    part(box,0,.38,1.69,.72,.055,.035);
    for(let i=0;i<12;i+=2) {
      const a=i*Math.PI/6;
      part(box,Math.sin(a)*.85,1.5,Math.cos(a)*.85,.27,.045,.035,a);
    }
    part(box,-.515,3.18,-1.24,.035,.72,.025);
    for(const side of [-1,1]) {
      part(box,side*.71,3.48,1.22,.035,.035,1.3,0,.17);
      part(box,side*.76,2.98,1.18,.035,.035,1.25,0,.17);
    }
    part(cyl,0,3.18,.47,.24,.045,.24,0,Math.PI/2);
    return out;
  }
  registerEntityModel({
    id:'faction-2/building/turret',
    meshes:{faction2TurretHull:hull,faction2TurretLights:lights},
    render({entity:e,time,part:p,metal,dark,team,accent,surfaceColor}) {
      const s=(e.size||1.7)/1.7;
      p('faction2TurretHull',0,0,0,s,1,s,metal);
      p('faction2TurretLights',0,0,0,s,1,s,surfaceColor(team),0,0,0,1.15);
      // Three cyan crystal caps and the suspended violet aether lance.
      for(const side of [-1,1]) p('octa',side*1.19,1.56,1.08,.19,.31,.19,accent,0,0,0,.8);
      p('octa',0,4.27,-1.08,.27,.43,.27,accent,time*.12,0,0,.85);
      p('octa',0,3.18,1.34,.25,.21,1.02,team,0,0,0,1.1);
      p('octa',0,3.18,2.35,.12,.13,.18,accent,0,0,0,.9);
    }
  });
})();
