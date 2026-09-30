/* Cinder Pact / Oathguard: fitted powered armor; only the existing two-leg walk phase moves. */
'use strict';
(() => {
  const dark=[.38,.44,.49], edge=[1.22,1.18,1.1];
  // Closed armor loft: changing cross-sections gives the chest, helmet and limbs
  // fitted contours rather than stacking rectangular blocks. +Z remains forward.
  function armor(out: number[], levels: number[][], tint=[1,1,1], x=0, z=0) {
    const rings=levels.map(([y,w,d,offset=0])=>{
      const a=w/2,b=d/2,c=Math.min(a,b)*.48;
      return [[-a+c,b],[a-c,b],[a,b-c],[a,-b+c],
        [a-c,-b],[-a+c,-b],[-a,-b+c],[-a,b-c]]
        .map(([px,pz])=>[x+px,y,z+pz+offset]);
    });
    for(let i=0;i<8;i++) {
      const k=(i+1)%8;
      for(let j=0;j<rings.length-1;j++) {
        geom.tri(out,rings[j][i],rings[j][k],rings[j+1][k],tint);
        geom.tri(out,rings[j][i],rings[j+1][k],rings[j+1][i],tint);
      }
      const bottom=levels[0],top=levels.at(-1)!;
      geom.tri(out,[x,bottom[0],z+(bottom[3]||0)],rings[0][k],rings[0][i],dark);
      geom.tri(out,[x,top[0],z+(top[3]||0)],rings.at(-1)![i],rings.at(-1)![k],tint);
    }
  }
  function hull() {
    const out: number[]=[],box=geom.box(),joint=geom.cylinder(10);
    const panel=(x: number,y: number,z: number,w: number,h: number,d: number,bevel: number,tint: number[])=>ModelMesh.panel(out,{x,y,z,w,h,d,bevel,tint});
    const part=(x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],ry=0,rx=0,rz=0)=>ModelMesh.bake(out,box,{x,y,z,sx,sy,sz,tint,ry,rx,rz});
    // Narrow waist, broad ribcage, sloping clavicles and a separate neck seal.
    armor(out,[[.72,.54,.35],[.84,.58,.4],[1.12,.77,.51],[1.3,.72,.47],[1.4,.46,.34]]);
    armor(out,[[.62,.49,.34],[.72,.58,.4],[.82,.52,.36]],dark);
    ModelMesh.bake(out,joint,{x:0,y:1.43,z:0,sx:.28,sy:.12,sz:.28,tint:dark});
    // Rounded crown, tapered jaw and an armored brow above the inset visor.
    armor(out,[[1.47,.28,.29,.04],[1.54,.43,.4,.03],[1.72,.46,.44,.02],
      [1.81,.38,.38],[1.86,.22,.24]]);
    panel(0,1.74,.246,.43,.06,.095,.018,edge);
    panel(0,1.51,.232,.25,.08,.08,.018,dark);
    part(0,1.545,.278,.1,.026,.018,edge);
    for(const side of [-1,1]) {
      panel(side*.18,1.58,.223,.075,.15,.095,.018,edge);
      ModelMesh.bake(out,joint,{x:side*.233,y:1.66,z:.005,sx:.095,sy:.045,sz:.095,rz:Math.PI/2,tint:dark});
      // Layered pauldrons sit over circular shoulder pivots, not box arms.
      ModelMesh.bake(out,joint,{x:side*.4,y:1.26,z:0,sx:.23,sy:.18,sz:.23,rz:Math.PI/2,tint:dark});
      armor(out,[[1.15,.26,.38],[1.23,.36,.49],[1.4,.32,.44],[1.49,.19,.29]], [1,1,1],side*.5,.015);
      panel(side*.5,1.2,.025,.33,.07,.47,.018,dark);
      panel(side*.5,1.435,.045,.2,.045,.29,.012,edge);
      // Belt pouches and overlapping hip plates break up the waist silhouette.
      panel(side*.24,.75,.217,.17,.19,.13,.026,dark);
      panel(side*.31,.66,.05,.14,.24,.34,.025,[.85,.9,.94]);
      part(side*.24,.788,.287,.11,.025,.018,edge);
    }
    for(let j=0;j<3;j++) panel(0,.88+j*.075,.224,.38-j*.035,.045,.07,.012,dark);
    panel(0,.72,.25,.13,.105,.07,.016,edge);
    // Compact power pack: recessed grille, two cooling stacks, service seams.
    panel(0,1.08,-.37,.47,.62,.26,.05,dark);
    panel(0,1.36,-.38,.33,.1,.22,.025,edge);
    for(const side of [-1,1]) {
      panel(side*.16,1.09,-.5,.1,.43,.07,.018,edge);
      for(let j=0;j<4;j++) part(side*.16,.95+j*.085,-.54,.082,.023,.02,dark);
    }
    for(let j=0;j<4;j++) part(0,.97+j*.075,-.505,.16,.024,.03,edge);
    // Left arm has an elbow and a fitted gauntlet; weapon-side hand grips the receiver.
    armor(out,[[.96,.18,.2],[1.12,.22,.24],[1.23,.2,.22]],dark,-.49,.03);
    ModelMesh.bake(out,joint,{x:-.49,y:.99,z:.12,sx:.17,sy:.2,sz:.17,rz:Math.PI/2,tint:edge});
    panel(-.48,.91,.24,.22,.3,.25,.045,[.8,.85,.9]);
    panel(-.48,.775,.3,.16,.13,.17,.025,dark);
    panel(.5,1.035,.25,.21,.24,.29,.035,[.8,.85,.9]);
    // Receiver, stock, rail, magazine and vented barrel shroud retain the old aim axis.
    panel(.5,1.09,.48,.25,.23,.85,.04,dark);
    panel(.5,1.11,.23,.2,.16,.29,.035,[.8,.85,.9]);
    part(.5,1.225,.48,.08,.045,.39,edge);
    panel(.5,1.265,.47,.11,.065,.14,.014,dark);
    part(.5,.94,.43,.14,.2,.18,dark,0,-.15);
    panel(.5,.915,.63,.15,.25,.2,.025,[.65,.7,.74]);
    for(let j=0;j<3;j++) part(.637,1.12,.58+j*.095,.018,.06,.035,edge);
    // Four barrel walls and a recessed end: no bright solid muzzle cap.
    for(const side of [-1,1]) {
      part(.5+side*.048,1.12,.98,.028,.12,.42,edge);
      part(.5,1.12+side*.048,.98,.068,.024,.42,edge);
    }
    part(.5,1.12,.85,.068,.072,.025,dark);
    return out;
  }
  function leg() {
    const out: number[]=[],box=geom.box();
    armor(out,[[.35,.19,.22],[.53,.27,.3],[.66,.24,.28]], [.8,.85,.9]);
    ModelMesh.bake(out,geom.cylinder(10),{x:0,y:.35,z:0,sx:.16,sy:.22,sz:.16,rz:Math.PI/2,tint:dark});
    armor(out,[[.12,.22,.26,.025],[.23,.24,.29],[.34,.2,.25]], [1,1,1]);
    ModelMesh.panel(out,{x:0,y:.36,z:.14,w:.23,h:.16,d:.1,bevel:.025,tint:edge});
    ModelMesh.panel(out,{x:0,y:.12,z:.085,w:.32,h:.21,d:.48,bevel:.04,tint:[.8,.85,.9]});
    ModelMesh.bake(out,box,{x:0,y:.05,z:.1,sx:.3,sy:.055,sz:.45,tint:dark});
    ModelMesh.bake(out,box,{x:0,y:.21,z:.154,sx:.11,sy:.16,sz:.025,tint:edge});
    return out;
  }
  function livery() {
    const out: number[]=[];
    for(const side of [-1,1]) {
      const plate: number[]=[];
      ModelMesh.panel(plate,{w:.285,h:.19,d:.055,bevel:.018});
      ModelMesh.bake(out,plate,{x:side*.172,y:1.235,z:.249,ry:side*.16,rz:side*.1});
      ModelMesh.panel(out,{x:side*.5,y:1.34,z:.245,w:.18,h:.095,d:.045,bevel:.012});
    }
    return out;
  }
  function visor() {
    const out: number[]=[];
    ModelMesh.panel(out,{w:.31,h:.08,d:.045,bevel:.012});
    return out;
  }
  registerEntityModel({
    id:'faction-0/unit/rifle', meshes:{faction0RifleHull:hull,faction0RifleLeg:leg,
      faction0RifleLivery:livery,faction0RifleVisor:visor},
    render({entity:e,part:p,metal,dark,team,surfaceColor}) {
      const step=Math.sin((e.walk||0)*7)*.23;
      p('faction0RifleHull',0,0,0,1,1,1,metal);
      for(const side of [-1,1]) p('faction0RifleLeg',side*.24,0,side*step,1,1,1,dark);
      p('faction0RifleLivery',0,0,0,1,1,1,team,0,0,0,.2);
      p('faction0RifleVisor',0,1.65,.257,1,1,1,surfaceColor(0x8ce1e2),0,0,0,.85);
    }
  });
})();
