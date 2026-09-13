/* Fraktion 2 / building / hq. Silent throne: inset dais, fluted pylons and a four-pronged crown. */
'use strict';
(() => {
  function hull() {
    const out=[], s=4.4, h=7.8, hex=geom.cylinder(6), box=geom.box(), octa=geom.octa(),
      dark=[.35,.36,.45], edge=[1.16,1.14,1.12];
    const part=(mesh,x,y,z,sx,sy,sz,tint,ry=0,rx=0)=>ModelMesh.bake(out,mesh,{x,y,z,sx,sy,sz,tint,ry,rx});
    const panel=(x,y,z,w,h,d,bevel,tint)=>ModelMesh.panel(out,{x,y,z,w,h,d,bevel,tint});
    const brace=(x,y,z,u,v,w,width,tint)=>{
      const dx=u-x,dy=v-y,dz=w-z;
      part(box,(x+u)/2,(y+v)/2,(z+w)/2,width,Math.hypot(dx,dy,dz),width,tint,Math.atan2(dx,dz),Math.atan2(Math.hypot(dx,dz),dy));
    };
    part(hex,0,.55,0,s*.8,.5,s*.8,[1,1,1]);
    part(hex,0,.84,0,s*.71,.14,s*.71,dark);
    part(hex,0,.94,0,s*.65,.09,s*.65,edge);
    // Existing four-pylon plan, now beveled with feet, capitals and recessed grooves.
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2+.785,x=Math.sin(a)*s*.74,z=Math.cos(a)*s*.74,pylon=[];
      ModelMesh.panel(pylon,{x:0,y:h*.3,z:0,w:.42,h:h*.57,d:.65,bevel:.055,tint:[1,1,1]});
      ModelMesh.panel(pylon,{x:0,y:.24,z:0,w:.64,h:.21,d:.83,bevel:.045,tint:dark});
      ModelMesh.panel(pylon,{x:0,y:h*.59,z:0,w:.58,h:.17,d:.79,bevel:.035,tint:edge});
      ModelMesh.bake(out,pylon,{x,z,ry:a});
      for(let j=-1;j<=1;j++) {
        const dx=j*.09,dz=.335;
        part(box,x+dx*Math.cos(a)+dz*Math.sin(a),h*.32,z-dx*Math.sin(a)+dz*Math.cos(a),.035,h*.36,.025,dark,a);
      }
      const b=i*Math.PI/2+.4,rx=Math.sin(b)*s*.38,rz=Math.cos(b)*s*.38;
      brace(0,h*.24,0,rx,h*.67,rz,.048,edge);
      brace(rx,h*.67,rz,0,h*1.1,0,.048,edge);
    }
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2+.4;
      part(octa,Math.sin(a)*s*.2,h*.91,Math.cos(a)*s*.2,.17,h*.15,.3,edge,a);
      brace(Math.sin(a)*s*.36,h*.67,Math.cos(a)*s*.36,Math.sin(a)*s*.2,h*.86,Math.cos(a)*s*.2,.1,dark);
    }
    return out;
  }
  registerEntityModel({
    id:'faction-2/building/hq', meshes:{faction2HqHull:hull},
    render({entity:e,time,part:p,ring,metal,dark,team,accent}) {
      const s=e.size||3, h=7.8;
      p('faction2HqHull',0,0,0,s/4.4,1,s/4.4,metal);
      p('octa',0,h*.48,0,s*.5,h*.53,s*.5,dark,.4);
      // Retain the original core's instanced normals, local texture frame and pale highlights.
      p('octa',0,h*.67,0,s*.38,h*.43,s*.38,metal,.4);
      p('octa',0,h*.79,0,s*.21,h*.35,s*.21,team,time*.1,0,0,.75);
      for(let i=0;i<4;i++) {
        const a=i*Math.PI/2+.785;
        p('octa',Math.sin(a)*s*.74,h*.63,Math.cos(a)*s*.74,.25,.7,.25,accent,0,0,0,.8);
      }
      ring(s*.88,h*.62,accent,.8,Math.PI/2,time*.18,.85);
      ring(s*.85,h*.4,team,.6);
    }
  });
})();
