/* Crownwing: a ribbed living carrier with six veined, independently flapping leaves.
   Model-local dimensions before the .72 render scale; +Z is forward. */
'use strict';
(() => {
  const bark=[.45,.42,.29], shell=[.23,.25,.19], veins=[.58,.78,.36],
    membrane=[.44,.40,.39], ivory=[.70,.69,.49];
  function rod(out: number[],a: number[],b: number[],radius: number,tint=bark) {
    const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);
    ModelMesh.bake(out,geom.cylinder(8),{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,z:(a[2]+b[2])/2,
      sx:radius,sy:length,sz:radius,rx:Math.acos(d[1]/length),ry:Math.atan2(d[0],d[2]),tint});
  }
  function bulb(out: number[],x: number,y: number,z: number,sx: number,sy: number,sz: number,tint=shell) {
    ModelMesh.lobedShell(out,{x,y,z,sx,sy,sz,lobes:6,depth:.025,segments:24,rings:10,tint});
  }
  // Closed X-axis leaf loft. Finite root/tip sections avoid collapsed triangles.
  function leaf(length: number,width: number,sweep: number,ridge: number,tint: number[]) {
    const out: number[]=[],steps=16;
    const point=(t: number,side: number,back=false)=>{
      const arch=Math.sin(Math.PI*t),w=.025+width*Math.pow(arch,.85);
      return [t*length,arch*ridge*(side===0?1:.30)+t*.025-(back?.055:0),t*sweep+side*w];
    };
    const rings=Array.from({length:steps+1},(_,i)=>{
      const t=i/steps;
      return [point(t,0),point(t,1),point(t,0,true),point(t,-1)];
    });
    for(let i=0;i<4;i++) {
      const k=(i+1)%4;
      for(let j=0;j<steps;j++) {
        geom.tri(out,rings[j][i],rings[j][k],rings[j+1][k],tint);
        geom.tri(out,rings[j][i],rings[j+1][k],rings[j+1][i],tint);
      }
      geom.tri(out,[0,-.0275,0],rings[0][k],rings[0][i],tint);
      geom.tri(out,[length,-.0025,sweep],rings[steps][i],rings[steps][k],tint);
    }
    return out;
  }
  function preview(out: number[],neutral: boolean) {
    if(neutral) for(let i=0;i<out.length;i+=9) out[i+6]=out[i+7]=out[i+8]=1;
    return out;
  }
  // Reflect geometry and reverse winding, not the leading/trailing-edge direction.
  function mirror(data: number[]) {
    const out: number[]=[];
    for(let i=0;i<data.length;i+=27)
      geom.tri(out,[-data[i],data[i+1],data[i+2]],[-data[i+18],data[i+19],data[i+20]],
        [-data[i+9],data[i+10],data[i+11]],data.slice(i+6,i+9));
    return out;
  }
  function wing(side: number,kind: 'main'|'front'|'rear',neutral=false) {
    const main=kind==='main',length=main?7.12:kind==='front'?2.82:3.13,
      width=main?1.73:.57,sweep=main?.48:kind==='front'?2.10:-1.60,ridge=main?.48:.25,
      out=leaf(length,width,sweep,ridge,main?bark:membrane),steps=8;
    const center=(t: number)=>[t*length,Math.sin(Math.PI*t)*ridge+.025*t+.03,t*sweep];
    for(let i=0;i<steps;i++) rod(out,center(i/steps),center((i+1)/steps),main?.038:.025,veins);
    for(let i=1;i<steps;i++) for(const edge of [-1,1]) {
      const t=i/steps,tip=Math.min(.96,t+.10),a=center(t),
        b=[tip*length,Math.sin(Math.PI*tip)*ridge*.30+.025*tip+.02,
          tip*sweep+edge*(.025+width*Math.pow(Math.sin(Math.PI*tip),.85))*.92];
      rod(out,a,b,main?.025:.018,veins);
    }
    return preview(side<0?mirror(out):out,neutral);
  }
  function backHeight(x: number,z: number) {
    return -.25+1.45*Math.sqrt(Math.max(.025,1-(x/2.65)**2-((z+.25)/5.25)**2));
  }
  function dorsalPlates(out: number[]) {
    // Overlapping leaf armor follows the curved back; recompute normals after warping.
    for(const side of [-1,1]) for(let row=0;row<7;row++) {
      const plate: number[]=[];
      ModelMesh.bake(plate,leaf(1.50,.67,side*.12,.22,bark),{x:side*1.05,z:-4.55+row*1.16,ry:-Math.PI/2});
      for(let i=0;i<plate.length;i+=27) {
        const points=[0,9,18].map(j=>{
          const x=plate[i+j],z=plate[i+j+2];return [x,plate[i+j+1]+backHeight(x,z),z];
        });
        geom.tri(out,points[0],points[1],points[2],plate.slice(i+6,i+9));
      }
    }
    for(let row=0;row<8;row++) {
      const z=-4.2+row*1.1,w=2.65*Math.sqrt(Math.max(.08,1-((z+.25)/5.25)**2));
      for(let i=0;i<12;i++) {
        const point=(a: number)=>[Math.cos(a)*w,-.25+Math.sin(a)*1.45*Math.max(.35,w/2.65),z];
        rod(out,point(i*Math.PI/12),point((i+1)*Math.PI/12),.055,bark);
      }
    }
  }
  function sensoryCrown(out: number[]) {
    // Six swept feelers; the end buds, not extra emissive geometry, supply color.
    for(const side of [-1,1]) for(let antenna=0;antenna<3;antenna++) {
      const point=(t: number)=>[side*(.42+antenna*.22+1.15*Math.sin(t*Math.PI*.65)),
        .12+.48*Math.sin(t*Math.PI)-antenna*.11,4.62+t*(2.05-antenna*.15)];
      for(let step=0;step<8;step++) rod(out,point(step/8),point((step+1)/8),.035,bark);
      const [x,y,z]=point(1);bulb(out,x,y,z,.07,.11,.10,veins);
    }
  }
  function broodBatteries(out: number[]) {
    for(const x of [-1.35,0,1.35]) {
      bulb(out,x,-1.70,3.3,.40,.58,.67,bark);
      for(let petal=0;petal<5;petal++) {
        const a=petal*Math.PI*2/5,start=[x+Math.cos(a)*.22,-1.75+Math.sin(a)*.22,3.62],
          tip=[x+Math.cos(a)*.50,-2.04+Math.sin(a)*.50,4.95];
        rod(out,start,tip,.055,ivory);
        bulb(out,tip[0],tip[1],tip[2],.09,.14,.25,ivory);
      }
    }
    for(const side of [-1,1]) for(let segment=0;segment<4;segment++) {
      const z=1.5-segment*1.35;
      rod(out,[side*2.05,-.65,z],[side*2.45,-1.20,z-.35],.07,bark);
      bulb(out,side*2.45,-1.22,z-.40,.27,.24,.32,veins);
    }
  }
  function hull(neutral=false) {
    const out: number[]=[];
    bulb(out,0,-.25,-.25,2.65,1.45,5.25);
    bulb(out,0,.06,4.35,1.05,.87,.90,bark);
    bulb(out,0,.46,-5.30,.58,.49,.65,membrane);
    ModelMesh.lobedShell(out,{y:.95,z:-.40,sx:.62,sy:.86,sz:3.72,
      lobes:4,depth:.02,segments:16,rings:8,tint:bark});
    for(let i=0;i<16;i++) {
      const crest=(t:number)=>[0,.95+.86*Math.sin(t*Math.PI),-.40-3.72*Math.cos(t*Math.PI)];
      rod(out,crest(i/16),crest((i+1)/16),.028,veins);
    }
    dorsalPlates(out);sensoryCrown(out);broodBatteries(out);
    return preview(out,neutral);
  }
  const moving: HeavyModelData['moving'] = [
    {index:2,name:'CW_Main_wing_left',translation:[-1.95,.72,-1.18],mesh:n=>wing(-1,'main',n)},
    {index:3,name:'CW_Steering_wing_front_left',translation:[-1.73,-.08,1.67],mesh:n=>wing(-1,'front',n)},
    {index:4,name:'CW_Steering_wing_rear_left',translation:[-1.68,.30,-3.30],mesh:n=>wing(-1,'rear',n)},
    {index:5,name:'CW_Main_wing_right',translation:[1.95,.72,-1.18],mesh:n=>wing(1,'main',n)},
    {index:6,name:'CW_Steering_wing_front_right',translation:[1.73,-.08,1.67],mesh:n=>wing(1,'front',n)},
    {index:7,name:'CW_Steering_wing_rear_right',translation:[1.68,.30,-3.30],mesh:n=>wing(1,'rear',n)}
  ];
  const model: HeavyModelData={body:hull,moving};
  registerEntityModel({id:'faction-1/unit/destroyer',meshes:createHeavyMeshes(model,1),
    render({entity,time,nightPart:part,team,surfaceColor,pointLight}) {
      const scale=.72,surface=surfaceColor(0xffffff),neutral=surface!==0xffffff?'Neutral':'';
      pointLight(0,1.9,1.1,10,team,3);
      part(`heavy1Body${neutral}`,0,0,0,scale,scale,scale,surface);
      part('sphere',0,1.9,1.1,.16,.08,.16,surfaceColor(team),0,0,0,.35);
      for(const {name:partName,translation,index} of moving) {
        const [x,y,z]=translation,phase=time*1.5+entity.id*.13,
          flap=Math.sin(phase)*(partName.includes('Main_')?.22:.13)*(x<0?-1:1);
        part(`heavy1Part${index}${neutral}`,x*scale,y*scale,z*scale,scale,scale,scale,surface,0,0,flap);
      }
    }});
})();
