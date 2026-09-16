/* Fraktion 2 / building / barracks. Processional gate: a tall open portal and forward ceremonial ramp. */
'use strict';
(() => {
  function hull() {
    const out: number[]=[], hex=geom.cylinder(6), box=geom.box(),
      pale=[1,1,1], dark=[.35,.36,.45], edge=[1.16,1.14,1.12];
    const part=(mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],ry=0,rx=0,rz=0)=>
      ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,ry,rx,rz});
    const panel=(x: number,y: number,z: number,w: number,h: number,d: number,bevel: number,tint: number[],rz=0)=>{
      const mesh: number[]=[];
      ModelMesh.panel(mesh,{w,h,d,bevel,tint});
      ModelMesh.bake(out,mesh,{x,y,z,rz});
    };
    const brace=(x: number,y: number,z: number,u: number,v: number,w: number,width: number,tint: number[])=>{
      const dx=u-x,dy=v-y,dz=w-z;
      part(box,(x+u)/2,(y+v)/2,(z+w)/2,width,Math.hypot(dx,dy,dz),width,tint,
        Math.atan2(dx,dz),Math.atan2(Math.hypot(dx,dz),dy));
    };

    // A broad, low court and ramp replace the faction's usual central spire.
    part(hex,0,.38,-.08,2.55,.35,2.35,dark);
    panel(0,.68,-.05,4.45,.34,3.85,.08,pale);
    panel(0,.86,-.05,4.08,.15,3.48,.045,edge);
    for(const side of [-1,1]) {
      panel(side*1.67,.91,-.18,1.22,.5,2.7,.07,dark);
      panel(side*1.7,1.16,-.18,.93,.34,2.35,.055,pale);
      brace(side*2.25,.7,.75,side*1.74,3.25,-.18,.15,dark);
      brace(side*2.07,.78,-1.12,side*1.72,2.85,-.25,.1,edge);
    }
    // The processional lane remains readable from the isometric camera and points to local +Z.
    panel(0,.99,1.15,1.62,.2,3.15,.045,pale);
    panel(0,1.105,1.15,1.28,.035,2.98,.012,edge);
    for(const side of [-1,1]) {
      brace(side*.91,.92,-.38,side*.91,1.18,2.48,.07,dark);
      brace(side*.7,1.14,-.3,side*.7,1.25,2.42,.035,edge);
    }

    // Twin tapering pylons frame an actual void instead of hiding another pyramidal core.
    for(const side of [-1,1]) {
      const tilt=side*.06;
      panel(side*1.68,3.17,-.18,.86,4.72,.88,.075,pale,tilt);
      panel(side*1.68,3.18,.285,.36,3.42,.075,.018,dark,tilt);
      panel(side*1.68,1.02,-.18,1.28,.58,1.38,.07,edge);
      panel(side*1.68,5.52,-.18,.74,.32,.78,.045,dark,tilt);
      // Dark inner jamb and faceted arch shoulder.
      panel(side*.99,3.25,-.04,.42,2.62,.62,.055,dark);
      brace(side*.99,4.43,-.04,side*.28,5.24,-.04,.34,dark);
      brace(side*1.08,4.48,.285,side*.31,5.35,.285,.055,edge);
    }
    panel(0,5.24,-.04,.52,.46,.68,.055,dark);
    return out;
  }

  // A faceted, two-sided field matching the opening. Layered instances make it shimmer without per-frame geometry.
  function portal() {
    const out: number[]=[], points=[[-.76,-1.45],[.76,-1.45],[.76,.82],[.55,1.12],[0,1.55],[-.55,1.12],[-.76,.82]],
      center:[number,number]=[0,.05];
    for(let i=0;i<points.length;i++) {
      const a=points[i], b=points[(i+1)%points.length], shade=[.82+.12*(i%2),.72,.98];
      geom.tri(out,[center[0],center[1],0],[a[0],a[1],0],[b[0],b[1],0],shade);
      geom.tri(out,[center[0],center[1],0],[b[0],b[1],0],[a[0],a[1],0],shade);
    }
    return out;
  }

  registerEntityModel({
    id:'faction-2/building/barracks',
    meshes:{faction2BarracksHull:hull,faction2BarracksPortal:portal},
    render({entity:e,time,part:p,metal,dark,team,accent,surfaceColor}) {
      const s=e.size||3, wave=Math.sin(time*1.7+e.id*.71), drift=Math.sin(time*2.3+e.id)*.045;
      p('faction2BarracksHull',0,0,0,s/3,1,s/3,metal);
      p('faction2BarracksPortal',0,3.3,-.015,s/3*(1+wave*.025),1-wave*.018,s/3,
        surfaceColor(0x9168e8),0,0,0,.85,.62,MAT.CRYSTAL);
      p('faction2BarracksPortal',drift,3.3,.035,s/3*(.9-wave*.018),.94+wave*.025,s/3,
        surfaceColor(0xc2a2ff),0,0,0,1.05,.28,MAT.CRYSTAL);
      for(const side of [-1,1]) {
        p('octa',side*1.54,5.86,-.18,.24,.48,.24,accent,0,0,0,.8);
        p('octa',side*1.68,3.2,.32,.09,.34,.09,team,0,0,0,.55);
      }
      p('octa',0,5.05,.06,.2,.48,.2,dark,0,0,0,.25);
    }
  });
})();
