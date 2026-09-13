/* Fraktion 0 / unit / air: the same twin-engine delta craft, with framed glazing and service detail. */
'use strict';
(() => {
  function hull() {
    const out=[], box=geom.box(), nozzle=geom.cylinder(12), dark=[.38,.44,.5], edge=[1.22,1.18,1.12];
    const panel=(x,y,z,w,h,d,bevel,tint)=>ModelMesh.panel(out,{x,y,z,w,h,d,bevel,tint});
    const part=(mesh,x,y,z,sx,sy,sz,tint,rx=0,rz=0)=>ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,rx,rz});
    // Closed eight-sided fuselage sections retain the old pointed nose and tail bounds.
    const levels=[[-1.95,.025,.025],[-1.1,.42,.30],[.25,.7,.43],[1.25,.4,.25],[2.45,.015,.015]],
      rings=levels.map(([z,w,h])=>Array.from({length:8},(_,i)=>{
        const a=i*Math.PI/4; return [Math.sin(a)*w,.65+Math.cos(a)*h,z];
      }));
    for(let i=0;i<8;i++) {
      const k=(i+1)%8;
      for(let j=0;j<rings.length-1;j++) {
        geom.tri(out,rings[j][i],rings[j+1][i],rings[j+1][k]);
        geom.tri(out,rings[j][i],rings[j+1][k],rings[j][k]);
      }
      geom.tri(out,[0,.65,levels[0][0]],rings[0][i],rings[0][k],dark);
      geom.tri(out,[0,.65,levels.at(-1)[0]],rings.at(-1)[k],rings.at(-1)[i],edge);
    }
    panel(0,.92,.8,.56,.2,.97,.045,dark);
    part(box,0,1.02,.36,.5,.035,.075,edge);
    for(const side of [-1,1]) {
      const wing=[];
      ModelMesh.bake(wing,geom.octa(),{sx:1.6,sy:.12,sz:1.1});
      for(const x of [-.9,-.45,.45,.9]) ModelMesh.bake(wing,box,{
        x,y:.12*(1-Math.abs(x)/1.6)+.013,z:0,sx:.31,sy:.028,sz:.065,tint:edge});
      ModelMesh.bake(out,wing,{x:side*1.35,y:.45,z:-.18,rz:side*.06});
      panel(side*1.05,.32,-.55,.53,.56,1.8,.08,dark);
      panel(side*1.05,.623,-.42,.43,.06,.67,.014,dark);
      for(let j=-2;j<=2;j++) part(box,side*1.05,.665,-.42+j*.11,.38,.025,.04,edge);
      part(nozzle,side*1.05,.3,-1.43,.29,.19,.29,dark,Math.PI/2);
      panel(side*.66,.38,1.1,.2,.23,1.1,.035,dark);
      const fin=[];
      ModelMesh.panel(fin,{x:0,y:0,z:0,w:.15,h:.7,d:.8,bevel:.025,tint:[1,1,1]});
      ModelMesh.bake(out,fin,{x:side*.42,y:1.13,z:-1.2,rx:.18,rz:side*.27});
    }
    return out;
  }
  registerEntityModel({
    id:'faction-0/unit/air', meshes:{faction0AirHull:hull},
    render({part:p,metal,dark,team,accent}) {
      // The adapter alone supplies flight height, exit climb and bobbing.
      p('faction0AirHull',0,0,0,1,1,1,metal);
      p('box',0,.99,.8,.42,.14,.75,0x81bdcc,0,0,0,.4);
      for(const side of [-1,1]) {
        p('cylinder',side*1.05,.3,-1.48,.23,.12,.23,accent,0,Math.PI/2,0,1.3);
        p('box',side*1.35,.575,-.18,.58,.025,.1,team,0,0,side*.06,.3);
        p('box',side*.66,.38,1.657,.09,.09,.025,dark);
      }
      p('sphere',0,.94,-.2,.09,.08,.09,team,0,0,0,1.4);
    }
  });
})();
