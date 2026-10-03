/* Verdant Choir / Chrysalis — an opened moth cocoon whose four veined wings shelter a leaf launch tongue. */
'use strict';
(() => {
  const leaf=[1.18,1.3,.82], vein=[.63,.76,.56], bark=[.43,.53,.47], cocoon=[.94,1.02,.74];
  function rod(out: number[],a: number[],b: number[],radius: number,tint: number[],top=1) {
    const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);
    ModelMesh.bake(out,geom.cylinder(8,top),{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,z:(a[2]+b[2])/2,
      sx:radius,sy:length,sz:radius,rx:Math.acos(d[1]/length),ry:Math.atan2(d[0],d[2]),tint});
  }
  function shell(out: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint: number[],lobes=4) {
    ModelMesh.lobedShell(out,{x,y,z,sx,sy,sz,lobes,segments:20,rings:8,depth:.045,tint});
  }
  function hull() {
    const out: number[]=[];
    // A forward leaf reads as a runway while four lateral lobes form a moth rather than another root dome.
    shell(out,0,.28,1.45,1.12,.16,2.25,leaf,3);
    rod(out,[0,.31,-.42],[0,.36,3.25],.085,vein);
    for(const side of [-1,1]) {
      shell(out,side*1.88,2.18,-.55,1.72,.16,1.82,leaf,3);
      shell(out,side*1.52,1.25,.76,1.38,.14,1.48,[1.05,1.2,.76],3);
      rod(out,[side*.36,1.63,-.3],[side*3.28,3.06,-1.14],.105,vein);
      rod(out,[side*.34,1.48,.02],[side*2.66,1.45,1.68],.085,vein);
      rod(out,[side*.65,.46,-.52],[side*.46,3.34,-.58],.16,bark,.72);
      rod(out,[side*.45,3.2,-.55],[side*.98,4.28,-.72],.075,vein,.35);
      rod(out,[side*.98,4.28,-.72],[side*1.36,4.56,-.48],.045,vein,.25);
      // Short vein branches make the broad panels read as wings at game zoom.
      for(const t of [.32,.56,.78]) {
        const x=side*(.36+(3.28-.36)*t),y=1.63+(3.06-1.63)*t,z=-.3+(-1.14+.3)*t;
        rod(out,[x,y,z],[x+side*(.5-.18*t),y+.18,z+.58],.035,vein,.45);
      }
    }
    shell(out,0,2.18,-.58,1.02,1.72,.88,cocoon,5);
    // Split lips frame the luminous emergence seam at the front.
    for(const side of [-1,1]) shell(out,side*.48,2.15,.17,.42,1.34,.25,[1.08,1.17,.79],3);
    shell(out,0,.38,-.72,1.42,.34,1.2,bark,5);
    return out;
  }
  function membrane() {
    const out: number[]=[];
    shell(out,0,2.16,.43,.42,1.03,.08,[1,1,1],4);
    return out;
  }
  registerEntityModel({
    id:'faction-1/building/hangar',meshes:{faction1HangarHull:hull,faction1HangarMembrane:membrane},
    render({entity:e,time,nightPart:p,ring,metal,team,accent,surfaceColor,pointLight}) {
      const scale=(e.size||3.8)/3.8;
      pointLight(0, 1.3, 2.5*scale, 11, team, 4);
      p('faction1HangarHull',0,0,0,scale,1,scale,metal);
      p('faction1HangarMembrane',0,0,0,scale,1,scale,surfaceColor(team),0,0,0,.72+.08*Math.sin(time*1.6+e.id));
      ring((e.size||3.8)*.76,.43,accent,.48,0,time*.08,.65);
    }
  });
})();
