/* Reusable ship scenery for procedural landscapes: baked primitives, no GPU state or frame-time work. */
'use strict';
(() => {
  const steel=0x627987, mid=0x435864, dark=0x1c2a34, deep=0x0b141d,
    trim=0x9aabb0, pale=0xc7d4d5, amber=0xe2a94f, ice=0x8debf0;
  function rgb(color: number, shade=1) {
    return [(color>>16&255)/255*shade,(color>>8&255)/255*shade,(color&255)/255*shade];
  }
  function kit() {
    const out: number[]=[],cube=geom.box(),cylinder=geom.cylinder(16),hex=geom.cylinder(8);
    const add=(mesh: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,color: number,
        yaw=0,pitch=0,roll=0)=>{
      const c=rgb(color),cy=Math.cos(yaw),ny=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),
        cr=Math.cos(roll),sr=Math.sin(roll);
      const rotate=([a,b,d]: number[])=>{
        const py=b*cp-d*sp,pz=b*sp+d*cp,px=a*cr-py*sr,ry=a*sr+py*cr;
        return [px*cy+pz*ny,ry,-px*ny+pz*cy];
      };
      for(let i=0;i<mesh.length;i+=9) {
        const p=rotate([mesh[i]*sx,mesh[i+1]*sy,mesh[i+2]*sz]),
          n=V.norm(rotate([mesh[i+3]/sx,mesh[i+4]/sy,mesh[i+5]/sz]));
        out.push(p[0]+x,p[1]+y,p[2]+z,...n,...c);
      }
    };
    const b=(x: number,y: number,z: number,w: number,h: number,d: number,c=steel,a=0,p=0,r=0)=>
      add(cube,x,y,z,w,h,d,c,a,p,r);
    const tube=(x: number,y: number,z: number,radius: number,h: number,c=steel,pitch=0,yaw=0)=>
      add(cylinder,x,y,z,radius,h,radius,c,yaw,pitch);
    const oct=(x: number,y: number,z: number,radius: number,h: number,c=steel,pitch=0,yaw=0)=>
      add(hex,x,y,z,radius,h,radius,c,yaw,pitch);
    const panel=(x: number,y: number,z: number,w: number,h: number,d: number,bevel: number,c=steel)=>{
      const bx=w/2,bz=d/2,e=Math.min(bevel,bx*.45,bz*.45), shape=[
          [-bx+e,-bz],[bx-e,-bz],[bx,-bz+e],[bx,bz-e],
          [bx-e,bz],[-bx+e,bz],[-bx,bz-e],[-bx,-bz+e]
        ], lo=shape.map(([px,pz])=>[x+px,y-h/2,z+pz]),hi=shape.map(([px,pz])=>[x+px,y+h/2,z+pz]),col=rgb(c);
      for(let i=0;i<8;i++) {
        const j=(i+1)%8;
        geom.tri(out,lo[i],hi[j],lo[j],col);geom.tri(out,lo[i],hi[i],hi[j],col);
        geom.tri(out,[x,y+h/2,z],hi[j],hi[i],col,[0,1,0]);
        geom.tri(out,[x,y-h/2,z],lo[i],lo[j],col,[0,-1,0]);
      }
    };
    const ring=(x: number,y: number,z: number,radius: number,width: number,c=trim,n=48,stretch=1)=>{
      const col=rgb(c);
      for(let i=0;i<n;i++) {
        const a=i/n*Math.PI*2,q=(i+1)/n*Math.PI*2,
          p=[x+Math.sin(a)*radius,y,z+Math.cos(a)*radius*stretch],
          v=[x+Math.sin(q)*radius,y,z+Math.cos(q)*radius*stretch],
          u=[x+Math.sin(q)*(radius-width),y,z+Math.cos(q)*(radius-width)*stretch],
          s=[x+Math.sin(a)*(radius-width),y,z+Math.cos(a)*(radius-width)*stretch];
        geom.tri(out,p,u,v,col,[0,1,0]);geom.tri(out,p,s,u,col,[0,1,0]);
      }
    };
    return {out,b,tube,oct,panel,ring};
  }

  TerrainModels.shipHangar=()=>{
    const k=kit(),{b,tube,oct,panel}=k;
    panel(0,.055,0,2.08,.11,1.94,.36,dark);
    panel(0,.16,-.05,1.94,.28,1.72,.29,mid);
    // Broad faceted shell: sloped shoulders and a raised central roof replace the old box silhouette.
    panel(0,.47,-.08,1.68,.60,1.48,.20,steel);
    for(const side of [-1,1]) {
      panel(side*.78,.43,-.08,.38,.64,1.56,.10,mid);
      b(side*.92,.39,-.05,.10,.66,1.50,dark);
      for(let z=-.66;z<=.62;z+=.32) {
        b(side*.985,.42,z,.075,.70,.085,trim,side*.08);
        b(side*.89,.78,z,.24,.065,.12,dark,side*.10);
      }
      b(side*.65,.78,-.10,.46,.10,1.36,trim,side*.09,0,side*.12);
      b(side*.48,.88,-.12,.36,.09,1.25,steel,side*.07,0,side*.17);
      // External coolant trunks and inspection boxes.
      tube(side*.89,.47,-.46,.055,.58,dark,0,0);
      tube(side*.89,.76,-.34,.055,.25,trim,Math.PI/2,0);
      panel(side*.91,.43,-.66,.18,.24,.23,.035,deep);
      for(let i=0;i<3;i++) b(side*.995,.40,-.56+i*.38,.018,.28,.18,pale);
    }
    panel(0,.87,-.14,.92,.26,1.12,.12,dark);
    panel(0,1.03,-.18,.66,.12,.86,.08,steel);
    // Recessed segmented blast door and angular frame at +Z.
    panel(0,.41,.755,1.42,.56,.055,.025,deep);
    for(let i=-5;i<=5;i++) b(i*.127,.41,.793,.095,.48,.025,i%2?mid:steel);
    for(const side of [-1,1]) {
      panel(side*.79,.43,.77,.13,.68,.21,.035,trim);
      b(side*.70,.42,.815,.028,.46,.028,amber);
      b(side*.93,.18,.73,.22,.18,.32,dark,side*.13);
    }
    panel(0,.72,.80,1.64,.12,.20,.06,dark);
    for(let i=-4;i<=4;i++) b(i*.17,.745,.875,.09,.035,.08,trim);
    // Roof machinery, vents, a portside control cabin and a compact sensor mast.
    for(const x of [-.34,.34]) {
      panel(x,1.105,-.30,.48,.12,.46,.045,deep);
      for(let i=-2;i<=2;i++) b(x,1.175,-.30+i*.075,.42,.022,.035,pale);
    }
    panel(-.56,1.12,.26,.35,.24,.38,.06,mid);
    b(-.56,1.20,.46,.25,.08,.025,deep);
    for(let i=-1;i<=1;i++) b(-.56+i*.09,1.20,.477,.055,.045,.018,ice);
    tube(-.58,1.30,.16,.026,.43,trim);
    oct(-.58,1.52,.16,.08,.06,pale);
    b(-.58,1.50,.16,.38,.025,.07,dark,.18);
    for(const z of [-.63,.58]) {
      panel(0,1.03,z,.22,.13,.17,.035,mid);
      tube(0,1.15,z,.045,.20,dark);
    }
    return k.out;
  };

  TerrainModels.shipPlant=()=>{
    const k=kit(),{b,tube,oct,panel,ring}=k;
    panel(0,.06,0,2.05,.12,1.92,.20,dark);
    panel(0,.18,0,1.83,.24,1.67,.16,mid);
    for(const side of [-1,1]) {
      oct(side*.56,.48,-.08,.56,.63,steel,0,Math.PI/8);
      ring(side*.56,.81,-.08,.57,.07,trim,16);
      oct(side*.56,.87,-.08,.47,.12,dark,0,Math.PI/8);
      for(let i=0;i<8;i++) {
        const a=(i+.5)*Math.PI/4;
        b(side*.56+Math.sin(a)*.46,.47,-.08+Math.cos(a)*.46,.11,.52,.09,i%2?mid:trim,a);
      }
      tube(side*.55,1.09,-.08,.105,.48,dark);
      oct(side*.55,1.35,-.08,.18,.09,trim);
      panel(side*.58,.37,.70,.52,.46,.18,.05,deep);
      for(let i=-2;i<=2;i++) b(side*.58+i*.085,.38,.805,.045,.29,.018,pale);
    }
    // Pipe bridge, horizontal turbine and low service housings.
    tube(0,.79,-.08,.13,1.12,amber,Math.PI/2);
    for(const side of [-1,1]) {
      tube(side*.33,.83,.24,.065,.70,trim,0);
      tube(side*.33,.83,.58,.065,.28,trim,Math.PI/2);
      panel(side*.88,.30,-.68,.30,.36,.38,.07,mid);
      b(side*.88,.52,-.68,.22,.08,.28,dark);
    }
    oct(0,.31,-.72,.29,.38,dark,0,Math.PI/8);
    oct(0,.52,-.72,.22,.08,trim,0,Math.PI/8);
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      b(Math.sin(a)*.14,.57,-.72+Math.cos(a)*.14,.035,.035,.16,pale,a);
    }
    return k.out;
  };
})();
