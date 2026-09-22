/* Reusable ship architecture: baked primitives, no GPU state or frame-time work. */
'use strict';
(() => {
  const steel=0x627987, mid=0x435864, dark=0x1c2a34, deep=0x0b141d,
    trim=0x9aabb0, pale=0xc7d4d5, amber=0xe2a94f, ice=0x8debf0, red=0xd86652;
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
    const plate=(points: number[][],y: number,c: number)=>{
      const center=[points.reduce((n,p)=>n+p[0],0)/points.length,y,points.reduce((n,p)=>n+p[1],0)/points.length],col=rgb(c);
      for(let i=0;i<points.length;i++) {
        const p=points[i],q=points[(i+1)%points.length];
        geom.tri(out,center,[q[0],y,q[1]],[p[0],y,p[1]],col,[0,1,0]);
      }
    };
    return {out,b,tube,oct,panel,ring,plate};
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
  TerrainModels.shipHangarLights=()=>{
    const k=kit(),{b,oct}=k;
    b(0,.745,.895,1.38,.022,.018,ice);
    for(const side of [-1,1]) {
      b(side*.79,.56,.886,.045,.045,.018,amber);
      for(let z=-.60;z<=.60;z+=.30) b(side*1.015,.40,z,.018,.06,.09,side>0?ice:amber);
    }
    for(let i=-3;i<=3;i++) b(i*.18,.13,1.00,.08,.018,.08,amber);
    oct(-.58,1.56,.16,.065,.05,red);
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

  TerrainModels.shipCrate=()=>{
    const k=kit(),{b,panel}=k;
    panel(0,.48,0,1.84,.96,1.92,.13,steel);
    for(const x of [-.82,.82])for(const z of [-.86,.86]) panel(x,.50,z,.16,1.08,.18,.035,dark);
    for(const z of [-.97,.97])for(let i=-2;i<=2;i++) b(i*.31,.50,z,.055,.72,.026,trim);
    b(0,.76,1.00,.72,.13,.025,amber);b(0,.24,1.00,1.15,.035,.025,dark);
    return k.out;
  };

  TerrainModels.shipTransport=()=>{
    const k=kit(),{b,tube,oct,panel}=k;
    panel(0,.30,-.08,.95,.50,1.46,.14,steel);
    panel(0,.60,.25,.70,.25,.82,.11,trim);
    panel(0,.70,.62,.56,.18,.28,.07,deep);
    panel(0,.27,.86,.66,.31,.22,.06,dark);
    for(const side of [-1,1]) {
      b(side*.66,.25,-.16,.76,.11,1.20,dark,side*.14);
      panel(side*.62,.38,-.44,.46,.25,.68,.08,mid);
      tube(side*.72,.37,-.62,.20,.86,steel,Math.PI/2);
      tube(side*.72,.37,-1.06,.15,.08,deep,Math.PI/2);
      b(side*.34,.08,.48,.08,.31,.38,dark);b(side*.34,.08,-.52,.08,.31,.38,dark);
      b(side*.32,.48,-.61,.08,.48,.26,trim,side*.2);
      panel(side*.83,.25,.42,.18,.18,.55,.04,mid);
    }
    oct(0,.56,-.55,.18,.16,dark,Math.PI/2);
    return k.out;
  };
  TerrainModels.shipTransportLights=()=>{
    const k=kit(),{b,tube}=k;
    for(const side of [-1,1]) {
      tube(side*.72,.37,-1.105,.095,.016,ice,Math.PI/2);
      b(side*.43,.49,.64,.035,.04,.10,amber);
      b(side*.88,.27,.55,.022,.045,.22,red);
    }
    return k.out;
  };

  TerrainModels.shipBridge=()=>{
    const k=kit(),{b,tube,oct,panel}=k;
    panel(0,.09,0,2.08,.18,1.96,.20,dark);
    panel(0,.31,-.12,1.58,.44,1.58,.15,steel);
    panel(0,.59,-.20,1.28,.14,1.39,.10,dark);
    panel(0,.72,-.22,1.42,.15,1.20,.09,trim);
    panel(0,.68,.44,1.16,.10,.055,.025,deep);
    for(let i=-5;i<=5;i++) b(i*.105,.69,.48,.065,.047,.025,ice);
    panel(0,.91,-.35,.78,.32,.77,.10,steel);
    for(const side of [-1,1]) {
      panel(side*.73,.49,-.42,.22,.56,.82,.06,mid);
      tube(side*.47,1.12,-.58,.025,.64,trim);
      b(side*.47,1.40,-.58,.38,.025,.09,dark);
      oct(side*.47,1.44,-.58,.065,.055,red);
      b(side*1.0,.23,.12,.12,.34,1.20,dark);
      for(let z=-.38;z<=.60;z+=.24)b(side*1.07,.30,z,.025,.15,.12,pale);
    }
    tube(0,1.22,-.30,.055,.56,steel);b(0,1.49,-.30,.55,.025,.07,trim,.08);
    return k.out;
  };

  TerrainModels.shipCargoPad=()=>{
    const k=kit(),{b,ring,plate}=k,shape=[[-5,-4.2],[-3.9,-5.1],[3.9,-5.1],[5,-4.2],[5,4.2],[3.9,5.1],[-3.9,5.1],[-5,4.2]];
    plate(shape,.035,dark);ring(0,.065,0,4.35,.18,mid,8,.92);ring(0,.072,0,3.45,.12,trim,32,.92);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      b(Math.sin(a)*4.72,.10,Math.cos(a)*4.25,.78,.07,.20,i%2?amber:trim,-a);
    }
    for(const side of [-1,1]) {
      b(side*5.15,.14,0,.18,.16,7.6,mid);
      for(let z=-3.2;z<=3.2;z+=1.6)b(side*5.28,.20,z,.16,.18,.38,dark);
    }
    return k.out;
  };

  TerrainModels.shipVentDock=()=>{
    const k=kit(),{b,oct,panel,ring}=k;
    panel(0,.045,0,4.6,.09,4.6,.48,dark);
    ring(0,.10,0,1.95,.16,trim,8,1);
    ring(0,.12,0,1.48,.10,mid,24,1);
    for(let i=0;i<8;i++) {
      const a=(i+.5)*Math.PI/4;
      b(Math.sin(a)*1.83,.18,Math.cos(a)*1.83,.26,.17,.58,i%2?mid:trim,-a);
    }
    for(const side of [-1,1]) {
      b(side*2.08,.16,0,.18,.15,2.30,mid);b(0,.16,side*2.08,2.30,.15,.18,mid);
      oct(side*1.66,.19,side*1.66,.20,.16,amber);
    }
    return k.out;
  };

  TerrainModels.shipDeckMarks=(seed,extent)=>{
    const k=kit(),{b,ring,plate}=k;
    // Central tactical well: broken concentric rings, radial access lanes and inset maintenance plates.
    ring(0,.055,0,35,.32,dark,64);ring(0,.062,0,28,.16,trim,64);ring(0,.065,0,19,.10,0x627b84,48);
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6,r=31;
      b(Math.sin(a)*r,.075,Math.cos(a)*r,4.2,.025,.34,i%3===0?amber:mid,-a);
    }
    plate([[-11,-8],[-8,-11],[8,-11],[11,-8],[11,8],[8,11],[-8,11],[-11,8]],.045,0x263844);
    ring(0,.068,0,10.2,.12,0x78919a,8);
    ring(0,.072,0,7.2,.16,0x536d78,32);ring(0,.075,0,3.8,.12,amber,16);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      b(Math.sin(a)*5.5,.08,Math.cos(a)*5.5,3.6,.026,.16,i%2?mid:trim,-a);
    }
    plate([[-2.4,-1.8],[-1.7,-2.5],[1.7,-2.5],[2.4,-1.8],[2.4,1.8],[1.7,2.5],[-1.7,2.5],[-2.4,1.8]],.078,deep);
    // Four longitudinal assault ramps and four transverse flank ramps receive readable edge guidance.
    for(const sx of [-1,1])for(const sz of [-1,1]) {
      for(const side of [-1,1]) b(sx*(72+side*9.1),.075,sz*36, .18,.035,24,side>0?amber:trim);
      for(let n=0;n<5;n++) {
        const z=sz*(26+n*5.2),x=sx*72;
        b(x,.085,z,7.0,.035,.34,n%2?mid:amber,sz*.55);
      }
      for(const side of [-1,1]) b(sx*30,.075,sz*(79+side*8.1),24,.035,.18,side>0?amber:trim);
      for(let n=0;n<4;n++) {
        const x=sx*(20+n*5.4),z=sz*79;
        b(x,.085,z,.32,.035,6.4,n%2?mid:amber,sx*.55);
      }
      // Rounded platform identity: inset arcs and segmented launch bays rather than square outlines.
      const cx=sx*72,cz=sz*79;
      ring(cx,.07,cz,27.8,.16,0x718b94,48,.82);
      for(let n=-3;n<=3;n++) b(cx+n*5.4,.085,cz+sz*23.4,3.2,.035,.30,n%2?amber:trim,-sx*sz*.35);
      for(let n=-2;n<=2;n++) b(cx+sx*29.2,.085,cz+n*6.1,.30,.035,3.4,n%2?mid:trim,sx*sz*.22);
      for(const [dx,dz] of [[-22,-13],[22,13],[-20,15],[20,-15]]) {
        const x=cx+dx,z=cz+dz;
        plate([[x-2.8,z-1.8],[x-1.9,z-2.7],[x+2.2,z-2.7],[x+2.8,z-1.9],[x+2.8,z+1.9],[x+1.9,z+2.7],[x-2.2,z+2.7],[x-2.8,z+1.8]],.06,0x314551);
      }
    }
    // Long deck seams avoid a single uninterrupted texture field.
    for(let x=-extent+12;x<=extent-12;x+=24)b(x,.018,0,.045,.012,extent*1.85,0x1d2b35);
    for(let z=-extent+12;z<=extent-12;z+=24)b(0,.019,z,extent*1.85,.012,.045,0x1d2b35);
    return k.out;
  };

  TerrainModels.shipDeckLights=(seed,extent)=>{
    const k=kit(),{b,oct}=k;
    for(let i=0;i<32;i++) {
      const a=i*Math.PI/16,r=i%2?34.1:28.1;
      oct(Math.sin(a)*r,.13,Math.cos(a)*r,.13,.12,i%4?ice:amber);
    }
    for(const sx of [-1,1])for(const sz of [-1,1]) {
      for(let n=0;n<6;n++) {
        const z=sz*(25+n*4.6);
        b(sx*(72-9.5),.13,z,.22,.11,.62,n%2?ice:amber);
        b(sx*(72+9.5),.13,z,.22,.11,.62,n%2?amber:ice);
      }
      for(let n=0;n<6;n++) {
        const x=sx*(19+n*4.3);
        b(x,.13,sz*(79-8.5),.62,.11,.22,n%2?ice:amber);
        b(x,.13,sz*(79+8.5),.62,.11,.22,n%2?amber:ice);
      }
      const cx=sx*72,cz=sz*79;
      for(let i=0;i<20;i++) {
        const a=i*Math.PI/10;
        if(i%4===1||i%4===2) continue;
        oct(cx+Math.sin(a)*28.1,.13,cz+Math.cos(a)*23.1,.12,.11,i%5?ice:amber);
      }
    }
    for(const s of [-1,1])for(let p=-extent+10;p<=extent-10;p+=10) {
      b(s*(extent-3.2),.15,p,.16,.13,.42,p%20?ice:amber);
      b(p,.15,s*(extent-3.2),.42,.13,.16,p%20?amber:ice);
    }
    return k.out;
  };

  TerrainModels.shipOuterDeck=(seed,extent)=>{
    const out: number[]=[],side=extent+58,fore=extent+82,
      quad=(x0: number,x1: number,z0: number,z1: number,c=[.72,.78,.82])=>{
        const a=[x0,-.13,z0],b=[x0,-.13,z1],d=[x1,-.13,z0],e=[x1,-.13,z1];
        geom.tri(out,a,b,e,c,[0,1,0]);geom.tri(out,a,e,d,c,[0,1,0]);
      };
    quad(-side,-extent,-extent,extent);quad(extent,side,-extent,extent);
    quad(-extent,extent,-fore,-extent);quad(-extent,extent,extent,fore);
    return out;
  };

  TerrainModels.shipHull=(seed,extent)=>{
    const k=kit(),{b,tube,panel}=k,side=extent+59,fore=extent+83;
    // Cross-shaped carrier section: deep armor on the four outer arms and stepped shoulders at each notch.
    for(const s of [-1,1]) {
      b(s*side,-7.5,0,5,15,extent*2+8,dark);
      panel(s*(side+3),-1.8,0,7,.85,extent*2-8,.5,steel);
      b(0,-7.5,s*fore,extent*2+8,15,5,dark);
      panel(0,-1.8,s*(fore+3),extent*2-8,.85,7,.5,steel);
      for(let p=-extent+7;p<extent;p+=13) {
        panel(s*(side+5),-5.8,p,.55,9,.75,.12,mid);
        panel(p,-5.8,s*(fore+5),.75,9,.55,.12,mid);
      }
      // Exposed inner arm edges make the deck silhouette architectural rather than one large square.
      for(const z of [-extent,extent]) {
        b(s*(extent+29),-3.4,z,58,6,.9,dark);
        for(let x=extent+4;x<side;x+=7) panel(s*x,-.25,z,3.6,.34,.75,.15,trim);
      }
      for(const x of [-extent,extent]) {
        b(x,-3.4,s*(extent+41),.9,6,82,dark);
        for(let z=extent+4;z<fore;z+=7) panel(x,-.25,s*z,.75,.34,3.6,.15,trim);
      }
      for(let i=0;i<3;i++) {
        tube(s*(extent+5+i*2),-.45,0,.42,extent*2-6,dark,Math.PI/2);
        tube(0,-.45,s*(extent+5+i*2),.42,extent*2-6,dark,Math.PI/2,Math.PI/2);
      }
    }
    return k.out;
  };
})();
