/* Breakwater: armored carrier hull, four caged turbines and forward batteries.
   Model-local dimensions before the existing .72 render scale; +Z is forward. */
'use strict';
(() => {
  const steel = [.47,.50,.53], edge = [.57,.61,.64], dark = [.15,.18,.21],
    armor = [.33,.37,.40], orange = [.90,.47,.16];
  const turbines: { index: number; name: string; translation: [number,number,number] }[] = [
    {index:9,name:'BW_Turbine_rotor_1',translation:[-7.15,.32,1.99]},
    {index:11,name:'BW_Turbine_rotor_2',translation:[7.15,.32,1.99]},
    {index:13,name:'BW_Turbine_rotor_3',translation:[-4.6,.55,-3.71]},
    {index:15,name:'BW_Turbine_rotor_4',translation:[4.6,.55,-3.71]}
  ];
  function panel(out: number[], x: number, y: number, z: number,
    w: number, h: number, d: number, tint = steel) {
    ModelMesh.panel(out,{x,y,z,w,h,d,bevel:Math.min(w,h,d)*.18,tint});
  }
  function box(out: number[], x: number, y: number, z: number,
    sx: number, sy: number, sz: number, tint = steel, rz = 0) {
    ModelMesh.bake(out,geom.box(),{x,y,z,sx,sy,sz,tint,rz});
  }
  function barrel(out: number[], x: number, y: number, z: number,
    radius: number, length: number, tint = steel) {
    ModelMesh.bake(out,geom.cylinder(12),{x,y,z,sx:radius,sy:length,sz:radius,tint,rx:Math.PI/2});
  }
  // Closed longitudinal loft. Rings run clockwise when viewed from +Z.
  function loft(out: number[], rings: number[][][], tint: number[]) {
    const count = rings[0].length,
      center=(ring: number[][])=>ring.reduce((sum,p)=>sum.map((v,k)=>v+p[k]/count),[0,0,0]),
      rear=center(rings[0]),front=center(rings.at(-1)!);
    for (let i=0;i<count;i++) {
      const k=(i+1)%count;
      for(let j=0;j<rings.length-1;j++) {
        geom.tri(out,rings[j][i],rings[j+1][i],rings[j+1][k],tint);
        geom.tri(out,rings[j][i],rings[j+1][k],rings[j][k],tint);
      }
      geom.tri(out,rear,rings[0][i],rings[0][k],tint);
      geom.tri(out,front,rings.at(-1)![k],rings.at(-1)![i],tint);
    }
  }
  function fuselage(out: number[]) {
    // Tail → broad armored deck → narrowed bow; width, bottom and top per station.
    const stations = [
      [-5.7,1.25,-.8,.55], [-4.4,2.0,-1.15,1.35],
      [3.9,1.9,-1.15,1.6], [6.25,.88,-.6,1.1]
    ];
    loft(out,stations.map(([z,w,bottom,top])=>[
      [-w*.75,top,z],[w*.75,top,z],[w,top-.25,z],[w,bottom+.25,z],
      [w*.75,bottom,z],[-w*.75,bottom,z],[-w,bottom+.25,z],[-w,top-.25,z]
    ]),steel);
    panel(out,0,1.57,-.1,2.85,.14,7.5,armor);
    // Repeated deck plates, inset hatches and exposed edge fasteners.
    for(const z of [-3.25,-1.75,-.25,1.25,2.75]) {
      panel(out,0,1.68,z,2.45,.10,1.20,steel);
      for(const x of [-1.02,1.02]) for(const end of [-.45,.45])
        ModelMesh.bake(out,geom.cylinder(6),{x,y:1.75,z:z+end,sx:.045,sy:.025,sz:.045,tint:edge});
    }
    panel(out,0,1.76,-2.65,.9,.10,.8,dark);
    panel(out,0,1.83,-2.65,.72,.04,.62,steel);
    // Low bridge and twin radio masts retain the tall rear-deck silhouette.
    panel(out,0,2.0,-2.9,1.65,.48,1.15,armor);
    panel(out,0,2.30,-3.03,1.1,.12,.72,steel);
    for(const x of [-.65,.65]) {
      box(out,x,2.85,-3.25,.10,1.0,.10,dark);
      box(out,x,3.73,-3.25,.035,.84,.035,edge);
      for(const y of [2.55,2.75,2.95]) box(out,x,y,-3.25,.22,.065,.18,steel);
    }
    for(const side of [-1,1]) {
      box(out,side*1.82,.65,-.25,.10,.18,7.5,edge);
      panel(out,side*1.66,1.44,.25,.18,.15,5.5,armor);
    }
  }
  function wing(out: number[], side: number) {
    // A closed swept deck, not a scaled box: its taper leaves the aft turbines exposed.
    const outline=[[2,2.4],[6.65,1.4],[7.25,-.9],[5.25,-4.55],[2,-4.1]]
      .map(([x,z])=>[side*x,z]);
    if(side<0) outline.reverse();
    const top=outline.map(([x,z])=>[x,.35,z]), bottom=outline.map(([x,z])=>[x,-.25,z]),
      center=[side*4.2,.35,-1.1], under=[side*4.2,-.25,-1.1];
    for(let i=0;i<outline.length;i++) {
      const k=(i+1)%outline.length;
      geom.tri(out,center,top[i],top[k],steel);
      geom.tri(out,under,bottom[k],bottom[i],armor);
      geom.tri(out,top[i],bottom[i],bottom[k],armor);
      geom.tri(out,top[i],bottom[k],top[k],armor);
    }
    // Alternating access covers and dark ventilation grilles on both wing decks.
    for(const x of [2.85,3.9,4.95]) for(const [row,z] of [.65,-.4,-1.45,-2.5,-3.55].entries()) {
      if(x===4.95 && row===4) continue;
      panel(out,side*x,.385,z,.80,.07,.78,row%2 ? armor : dark);
      if((row+Math.round(x))%2===0) for(let rib=-2;rib<=2;rib++)
        box(out,side*x+rib*.11,.443,z,.035,.03,.53,edge);
    }
    panel(out,side*6.35,.39,-1.4,.82,.08,1.24,armor);
  }
  // Open-ended Z-axis tube with annular end faces and an actual hollow interior.
  function tube(out: number[], x: number, y: number, z: number,
    outer: number, inner: number, length: number, tint: number[], segments=24) {
    const ring=(radius: number,end: number)=>Array.from({length:segments},(_,i)=>{
      const a=i*Math.PI*2/segments;
      return [x+Math.cos(a)*radius,y+Math.sin(a)*radius,z+end*length/2];
    });
    const front=ring(outer,1), back=ring(outer,-1), insideFront=ring(inner,1), insideBack=ring(inner,-1);
    const quad=(a:number[],b:number[],c:number[],d:number[])=>{
      geom.tri(out,a,b,c,tint);geom.tri(out,a,c,d,tint);
    };
    for(let i=0;i<segments;i++) {
      const k=(i+1)%segments;
      quad(back[i],back[k],front[k],front[i]);
      quad(insideBack[k],insideBack[i],insideFront[i],insideFront[k]);
      quad(front[i],front[k],insideFront[k],insideFront[i]);
      quad(back[k],back[i],insideBack[i],insideBack[k]);
    }
  }
  function turbineHousing(out: number[], [x,y,z]: [number,number,number]) {
    tube(out,x,y,z-1.4,1.20,1.02,2.85,dark);
    for(const offset of [.08,-1.4,-2.88]) tube(out,x,y,z+offset,1.295,1.035,.18,steel);
    tube(out,x,y,z-.10,.99,.90,.14,orange);
    // Cage rails and raised clamps wrap the engine; they are static, unlike the fan.
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6, px=x+Math.cos(a)*1.235, py=y+Math.sin(a)*1.235;
      box(out,px,py,z-1.4,.11,.11,3.02,armor,a);
      for(const offset of [.08,-2.88])
        box(out,x+Math.cos(a)*1.20,y+Math.sin(a)*1.20,z+offset,.18,.16,.24,edge,a);
    }
    panel(out,x,y+1.30,z-1.4,.82,.12,1.0,armor);
  }
  function batteries(out: number[]) {
    barrel(out,0,.05,7.4,.24,3.15,armor);
    for(const z of [6.15,6.65,7.15,7.65,8.15]) barrel(out,0,.05,z,.30,.10,steel);
    panel(out,0,.05,9.03,.70,.62,.25,steel);
    panel(out,0,.05,9.17,.37,.31,.025,dark);
    box(out,0,.32,7.78,.45,.10,.20,steel);
    for(const side of [-1,1]) {
      // Twin deck guns and underslung twin-bore assault pods.
      panel(out,side*4.6,.57,1.75,1.65,.44,1.0,armor);
      for(const spread of [-.38,.38]) {
        const x=side*4.6+spread;
        barrel(out,x,.86,3.8,.16,2.8,dark);
        for(const z of [2.5,4.15,4.9]) barrel(out,x,.86,z,.23,.22,steel);
      }
      panel(out,side*4.6,-1.30,1.6,1.75,.96,2.4,armor);
      for(const spread of [-.42,.42]) tube(out,side*4.6+spread,-1.25,2.9,.27,.18,.28,steel,12);
      box(out,side*4.6,-.65,1.05,.28,.5,.8,dark);
    }
  }
  function hull(neutral=false) {
    const out: number[]=[];
    fuselage(out);
    for(const side of [-1,1]) wing(out,side);
    for(const {translation} of turbines) turbineHousing(out,translation);
    batteries(out);
    return preview(out,neutral);
  }
  function rotor(neutral=false) {
    const out: number[]=[];
    barrel(out,0,0,0,.17,.045,orange);
    // Eight swept blades around the original local-Z pivot. No frame-time geometry.
    for(let i=0;i<8;i++) {
      const angle=i*Math.PI/4, outline=[[.20,-.08],[.76,.06],[.70,.36],[.21,.42]]
        .map(([radius,offset])=>[Math.cos(angle+offset)*radius,Math.sin(angle+offset)*radius]);
      outline.reverse(); // Clockwise XY rings for the closed loft.
      loft(out,[-.0225,.0225].map(z=>outline.map(([x,y])=>[x,y,z])),steel);
    }
    return preview(out,neutral);
  }
  function preview(out: number[],neutral: boolean) {
    if(neutral) for(let i=0;i<out.length;i+=9) out[i+6]=out[i+7]=out[i+8]=1;
    return out;
  }
  function teamDetails() {
    const out: number[]=[];
    for(const {translation:[x,y,z]} of turbines) box(out,x,y+1.375,z-1.4,.60,.035,.64,[1,1,1]);
    for(const side of [-1,1]) {
      box(out,side*6.35,.45,-1.4,.68,.04,1.10,[1,1,1]);
      box(out,side*4.6,-1.30,2.82,.68,.30,.025,[1,1,1]);
      box(out,side*1.65,1.51,.2,.065,.035,3.9,[1,1,1]);
    }
    box(out,0,.37,7.78,.36,.035,.13,[1,1,1]);
    return out;
  }
  const model: HeavyModelData = {body:hull,team:teamDetails,
    moving:turbines.map(turbine=>({...turbine,mesh:rotor}))};
  registerEntityModel({id:'faction-0/unit/destroyer',meshes:createHeavyMeshes(model,0),
    render({time,nightPart:part,part:basePart,nightLight,team,surfaceColor,pointLight}) {
      const scale=.72,surface=surfaceColor(0xffffff),neutral=surface!==0xffffff?'Neutral':'';
      pointLight(0,1,3,10,team,3);
      part(`heavy0Body${neutral}`,0,0,0,scale,scale,scale,surface);
      basePart('heavy0Team',0,0,0,scale,scale,scale,surfaceColor(team),0,0,0,2.4*nightLight);
      for(const {translation:[x,y,z],index} of turbines)
        part(`heavy0Part${index}${neutral}`,x*scale,y*scale,z*scale,scale,scale,scale,surface,0,0,time*2.5);
    }});
})();
