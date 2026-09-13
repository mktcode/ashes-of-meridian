/* Reusable ship architecture: baked primitives, no GPU state or frame-time work. */
'use strict';
(() => {
  const steel=0x637887, dark=0x293942, trim=0x93a6ad, black=0x101a24, amber=0xd4a452, ice=0xa9e8ed;
  function kit() {
    const out=[],cube=geom.box(),cylinder=geom.cylinder(12);
    const add=(mesh,x,y,z,sx,sy,sz,color,yaw=0,pitch=0)=>{
      const c=[(color>>16&255)/255,(color>>8&255)/255,(color&255)/255],cs=Math.cos(yaw),sn=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const rotate=([a,b,d])=>{const e=b*cp-d*sp,f=b*sp+d*cp;return [a*cs+f*sn,e,-a*sn+f*cs];};
      for(let i=0;i<mesh.length;i+=9) {
        const p=rotate([mesh[i]*sx,mesh[i+1]*sy,mesh[i+2]*sz]),n=V.norm(rotate([mesh[i+3]/sx,mesh[i+4]/sy,mesh[i+5]/sz]));
        out.push(p[0]+x,p[1]+y,p[2]+z,...n,...c);
      }
    };
    return {out,b:(x,y,z,w,h,d,c=steel,a=0)=>add(cube,x,y,z,w,h,d,c,a),
      tube:(x,y,z,r,h,c=steel,pitch=0)=>add(cylinder,x,y,z,r,h,r,c,0,pitch)};
  }
  TerrainModels.shipHangar=()=>{
    const k=kit(),{b,tube}=k;
    b(0,.025,0,2,.05,2,dark);
    b(0,.35,-.08,1.9,.65,1.8,steel);
    b(0,.73,-.03,1.98,.12,1.94,trim);
    const rim=[[-.95,-.84],[-.84,-.96],[.84,-.96],[.95,-.84],[.95,.84],[.84,.96],[-.84,.96],[-.95,.84]],
      lower=rim.map(([x,z])=>[x,.79,z]),upper=rim.map(([x,z])=>[x*.88,.93,z*.88]);
    for(let i=0;i<8;i++) {
      const j=(i+1)%8,c=[.36,.44,.50];
      geom.tri(k.out,lower[i],lower[j],upper[j],c);geom.tri(k.out,lower[i],upper[j],upper[i],c);
      geom.tri(k.out,[0,.93,0],upper[j],upper[i],[.39,.47,.53]);
    }
    // Sealed, recessed door with reinforced posts and a projecting service lintel.
    b(0,.34,.829,1.53,.56,.026,black);
    for(let i=-4;i<=4;i++) b(i*.166,.34,.851,.145,.50,.025,i%2?dark:steel);
    b(0,.34,.876,.013,.50,.02,amber);
    for(const s of [-1,1]) {
      b(s*.87,.34,.85,.11,.65,.17,trim);
      b(s*.78,.36,.91,.025,.47,.025,amber);
      b(s*.95,.33,-.25,.055,.55,1.22,dark);
      for(let i=0;i<5;i++) b(s*.985,.34,-.76+i*.25,.025,.5,.045,trim);
    }
    b(0,.665,.94,1.88,.07,.12,dark);
    for(let i=-3;i<=3;i++) b(i*.23,.944,-.15,.025,.025,1.45,trim);
    for(const x of [-.43,.43]) {
      b(x,1,-.29,.39,.10,.53,black);
      for(let i=0;i<6;i++) b(x,1.058,-.50+i*.085,.36,.018,.031,trim);
    }
    tube(-.68,1.12,-.70,.025,.39,dark);
    b(-.68,1.3,-.70,.12,.018,.20,trim);
    return k.out;
  };
  TerrainModels.shipHangarLights=()=>{
    const k=kit();k.b(0,.665,1.005,1.45,.018,.018,ice);
    for(const s of [-1,1]) k.b(s*.87,.55,.946,.05,.035,.015,amber);
    return k.out;
  };
  TerrainModels.shipPlant=()=>{
    const k=kit();k.b(0,.025,0,2,.05,2,dark);
    for(const x of [-.52,.52]) {
      k.b(x,.38,0,.78,.7,1.68,steel);k.b(x,.77,0,.88,.08,1.78,dark);
      for(let i=0;i<7;i++)k.b(x,.825,-.65+i*.21,.74,.03,.07,trim);
      k.b(x,.3,.87,.51,.40,.03,black);
    }
    k.tube(0,.42,0,.14,1.7,amber,Math.PI/2);
    for(const z of [-.7,.7])k.b(0,.15,z,.45,.3,.14,trim);
    return k.out;
  };
  TerrainModels.shipCrate=()=>{
    const k=kit();k.b(0,.5,0,1.8,1,1.9,steel);
    for(const x of [-.84,.84])for(const z of [-.9,.9])k.b(x,.5,z,.12,1.08,.12,dark);
    for(const z of [-.98,.98])for(let i=-2;i<=2;i++)k.b(i*.32,.5,z,.06,.86,.03,trim);
    k.b(0,.6,1,.65,.16,.02,amber);return k.out;
  };
  TerrainModels.shipTransport=()=>{
    const k=kit();k.b(0,.32,0,.82,.54,1.68,steel);k.b(0,.62,.28,.6,.25,.9,trim);
    k.b(0,.68,.68,.51,.18,.19,black);k.b(0,.31,.89,.62,.30,.18,dark);
    for(const s of [-1,1]) {
      k.b(s*.64,.24,-.18,.73,.09,1.16,dark,s*.12);
      k.tube(s*.69,.35,-.59,.21,.91,steel,Math.PI/2);
      k.tube(s*.69,.35,-1.06,.155,.04,black,Math.PI/2);
      k.b(s*.31,.07,.50,.07,.3,.35,dark);
      k.b(s*.31,.07,-.55,.07,.3,.35,dark);
      k.b(s*.30,.45,-.66,.07,.46,.24,trim,s*.2);
    }
    return k.out;
  };
  TerrainModels.shipTransportLights=()=>{
    const k=kit();for(const s of [-1,1]) {
      k.tube(s*.69,.35,-1.084,.10,.012,ice,Math.PI/2);
      k.b(s*.39,.43,.63,.025,.03,.09,amber);
    }return k.out;
  };
  TerrainModels.shipBridge=()=>{
    const k=kit();k.b(0,.08,0,2,.16,2,dark);k.b(0,.30,-.10,1.44,.44,1.56,steel);
    k.b(0,.57,-.2,1.14,.12,1.42,dark);k.b(0,.67,-.22,1.32,.1,1.25,trim);
    k.b(0,.61,.515,1.10,.062,.025,black);
    for(let i=-4;i<=4;i++)k.b(i*.125,.61,.532,.08,.033,.012,ice);
    k.b(0,.76,-.30,.69,.12,.88,steel);
    for(const s of [-1,1]) {
      k.tube(s*.43,.93,-.56,.026,.64,trim);
      k.b(s*.43,1.19,-.56,.36,.014,.09,dark);
    }k.b(0,1.0,-.25,.07,.42,.09,steel);k.b(0,1.20,-.25,.45,.015,.06,trim);
    return k.out;
  };
  TerrainModels.shipCargoPad=()=>{
    const k=kit();k.b(0,.06,0,12,.10,11,dark);
    for(const s of [-1,1]) {
      k.b(s*5.8,.15,0,.20,.08,10.8,trim);
      for(let i=-3;i<=3;i++)k.b(i*1.45,.15,s*5.3,.65,.035,.3,amber,-.5);
    }return k.out;
  };
  TerrainModels.shipVentDock=()=>{
    const k=kit();k.b(0,.04,0,4.5,.08,4.5,dark);
    for(const s of [-1,1]) {
      k.b(s*1.75,.19,0,.23,.18,3.8,trim);k.b(0,.19,s*1.75,3.8,.18,.23,trim);
      k.b(s*2.04,.12,0,.12,.07,1,amber);
    }return k.out;
  };
  TerrainModels.shipOuterDeck=(seed,extent)=>{
    const out=[],x=extent+85,z=extent+125;
    for(const [x0,x1,z0,z1] of [[-x,-extent,-z,z],[extent,x,-z,z],[-extent,extent,-z,-extent],[-extent,extent,extent,z]]) {
      const a=[x0,-.13,z0],b=[x0,-.13,z1],c=[x1,-.13,z1],d=[x1,-.13,z0];
      geom.tri(out,a,b,c);geom.tri(out,a,c,d);
    }return out;
  };
  TerrainModels.shipHull=(seed,extent)=>{
    const k=kit(),w=extent+83,d=extent+123;
    for(const s of [-1,1]) {
      k.b(s*w,-8,0,4,16,d*2,dark);
      k.b(s*(w+4),-3,0,8,.8,d*2-12,steel);
      for(let z=-d+6;z<d;z+=13) {
        k.b(s*(w+6),-1.8,z,.35,2.1,.4,trim);
        k.b(s*w,-9,z,5,13,.65,steel);
      }
      k.b(s*(w+6),-.76,0,.18,.15,d*2-12,trim);
      for(let i=0;i<3;i++)k.tube(s*(extent+8+i*2),-.4,0,.45,d*2-8,dark,Math.PI/2);
    }
    for(const s of [-1,1])k.b(0,-8,s*d,w*2,16,4,dark);
    return k.out;
  };
  TerrainModels.shipDeckPaint=(seed,extent)=>{
    const k=kit(),end=extent+70;
    k.b(0,-.09,0,22,.035,end*2,dark);
    for(let z=-end+4;z<end;z+=8)k.b(0,-.062,z,21.5,.008,.06,0x405460);
    for(const s of [-1,1]) {
      for(let z=-end+4;z<end;z+=12) {
        k.b(s*10.7,-.055,z,.22,.025,5,trim);
        k.b(s*13,-.055,z,.5,.025,.7,ice);
      }
      for(const z of [-extent+15,extent-15])for(let i=0;i<5;i++) k.b(s*(3+i*1.2),-.055,z,.65,.025,4,trim);
    }
    for(const z of [-27,27])for(const s of [-1,1]) k.b(s*1.2,-.052,z,.26,.025,3.5,amber,s*.65);
    for(const x of [-38,38])for(const z of [-49,49]) {
      for(let i=-2;i<=2;i++) k.b(x+i*1.1,-.055,z,.7,.025,.35,amber,-.6);
    }
    return k.out;
  };
})();
