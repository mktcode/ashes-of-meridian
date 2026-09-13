/* Fraktion 0 / unit / medic: plated infantry; the original walk phase moves only the legs. */
'use strict';
(() => {
  function hull() {
    const out=[], h=1, box=geom.box(), bolt=geom.cylinder(6),
      dark=[.38,.44,.49], edge=[1.22,1.18,1.1];
    const panel=(x,y,z,w,h,d,bevel,tint)=>ModelMesh.panel(out,{x,y,z,w,h,d,bevel,tint});
    const part=(x,y,z,sx,sy,sz,tint,ry=0,rx=0)=>ModelMesh.bake(out,box,{x,y,z,sx,sy,sz,tint,ry,rx});
    panel(0,h,0,.78*h,.75*h,.5*h,.075,[1,1,1]);
    panel(0,1.65*h,.02,.45*h,.43*h,.43*h,.06,[1,1,1]);
    // Armored brow and cheek pieces surround the original visor position.
    part(0,1.76*h,.25*h,.48*h,.075,.1,edge);
    for(const side of [-1,1]) {
      panel(side*.5*h,1.32*h,side>0?.08:0,.34,.35,.54,.055,[1,1,1]);
      part(side*.18*h,1.56*h,.245*h,.055,.07,.075,dark);
      part(side*.25*h,.81*h,.285*h,.16,.2,.09,dark);
      part(side*.27*h,1.34*h,.278*h,.095,.095,.055,edge);
      ModelMesh.bake(out,bolt,{x:side*.247*h,y:1.66*h,z:.015,sx:.065,sy:.04,sz:.065,rz:Math.PI/2,tint:dark});
    }
    part(0,.75*h,.02,.81*h,.09,.52*h,dark);
    part(0,.75*h,.29*h,.16,.12,.06,edge);
    panel(0,1.08,-.37,.49,.66,.26,.05,dark);
    for(let j=-1;j<=1;j++) part(j*.12,1.12,-.509,.035,.34,.025,edge);
    part(-.48,1,.27,.22,.47,.22,dark,-.3,-.5);
    panel(.5,1.09,.48,.25,.23,.85,.04,dark);
    part(.5,1.236,.48,.08,.06,.31,edge);
    part(.5,.94,.43,.14,.2,.18,dark,0,-.15);
    // Four barrel walls and a recessed end: no bright solid muzzle cap.
    for(const side of [-1,1]) {
      part(.5+side*.048,1.12,.98,.028,.12,.42,edge);
      part(.5,1.12+side*.048,.98,.068,.024,.42,edge);
    }
    part(.5,1.12,.85,.068,.072,.025,dark);
    panel(-.30,1.21,-.36,.16,.4,.25,.032,[1.25,1.3,1.25]);
    return out;
  }
  function leg() {
    const out=[];
    ModelMesh.panel(out,{x:0,y:.35,z:0,w:.25,h:.65,d:.33,bevel:.04,tint:[1,1,1]});
    ModelMesh.panel(out,{x:0,y:.13,z:.09,w:.32,h:.22,d:.48,bevel:.04,tint:[.8,.85,.9]});
    ModelMesh.bake(out,geom.box(),{x:0,y:.48,z:.176,sx:.22,sy:.17,sz:.055,tint:[1.45,1.4,1.3]});
    ModelMesh.bake(out,geom.box(),{x:0,y:.079,z:.335,sx:.26,sy:.045,sz:.035,tint:[.6,.65,.7]});
    return out;
  }
  registerEntityModel({
    id:'faction-0/unit/medic', meshes:{faction0MedicHull:hull,faction0MedicLeg:leg},
    render({entity:e,part:p,metal,dark,team,accent}) {
      const h=1, step=Math.sin((e.walk||0)*7)*.23;
      p('faction0MedicHull',0,0,0,1,1,1,0xb9c3be);
      for(const side of [-1,1]) p('faction0MedicLeg',side*.24,0,side*step,1,1,1,dark);
      p('box',0,1.16*h,.28,.48,.26,.1,team,0,0,0,.35);
      p('box',0,1.65*h,.25,.43,.115,.08,0x84dfc1,0,0,0,.85);
      p('box',0,1.15,-.53,.36,.11,.02,0x92e5c5,0,0,0,.7);
      p('box',0,1.15,-.53,.11,.38,.02,0x92e5c5,0,0,0,.7);
      p('box',-.5,1.512,0,.21,.025,.07,0x92e5c5,0,0,0,.4);
      p('box',-.5,1.512,0,.07,.025,.3,0x92e5c5,0,0,0,.4);
    }
  });
})();
