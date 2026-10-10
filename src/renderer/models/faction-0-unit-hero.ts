/* Cinder Pact / Breach Marshal: heavy command armor and a two-handed breach carbine.
   +Y up, +Z forward. Cosmetic scale/rig never change gameplay, entities or RNG. */
'use strict';
(() => {
  type Point = readonly [number,number,number];
  const SCALE=1.18;
  function createMarshal(): Record<string,number[]> {
    const parts: Record<string,number[]>={}, C={paint:[.105,.27,.30],ivory:[.78,.73,.58],orange:[.85,.27,.075],
      rubber:[.055,.075,.085],steel:[.25,.3,.32],bronze:[.63,.43,.19]};
    let out: number[]=[];
    function group(name: string,fn: () => void) {out=[];fn();parts[name]=out;}
    function plate(x: number,y: number,z: number,w: number,h: number,d: number,c: keyof typeof C | number[],rx=0,ry=0,rz=0) {
      const m: number[]=[];ModelMesh.panel(m,{w,h,d,bevel:Math.min(w,h,d)*.16});
      ModelMesh.bake(out,m,{x,y,z,tint:typeof c==='string'?C[c]:c,rx,ry,rz});
    }
    function joint(x: number,y: number,z: number,r: number,c: keyof typeof C='rubber') {
      ModelMesh.lobedShell(out,{x,y,z,sx:r,sy:r,sz:r,lobes:3,depth:0,segments:12,rings:8,tint:C[c]});
    }
    function link(a: Point,b: Point,w: number,d: number,c: keyof typeof C) {
      const v=b.map((p,i)=>p-a[i]),len=Math.hypot(...v);
      plate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,w,len,d,c,Math.acos(v[1]/len),Math.atan2(v[0],v[2]));
    }
    function shell(levels: number[][],c: keyof typeof C,x=0,z=0) {
      const rings=levels.map(([y,w,d,dz=0])=>{
        const a=w/2,b=d/2,k=Math.min(a,b)*.45;
        return [[-a+k,b],[a-k,b],[a,b-k],[a,-b+k],[a-k,-b],[-a+k,-b],[-a,-b+k],[-a,b-k]].map(([px,pz])=>[x+px,y,z+pz+dz]);
      });
      for(let i=0;i<8;i++) {
        const k=(i+1)%8;
        for(let j=0;j<rings.length-1;j++) {
          geom.tri(out,rings[j][i],rings[j][k],rings[j+1][k],C[c]);
          geom.tri(out,rings[j][i],rings[j+1][k],rings[j+1][i],C[c]);
        }
        geom.tri(out,[x,levels[0][0],z+(levels[0][3]||0)],rings[0][k],rings[0][i],C[c]);
        geom.tri(out,[x,levels.at(-1)![0],z+(levels.at(-1)![3]||0)],rings.at(-1)![i],rings.at(-1)![k],C[c]);
      }
    }
    group('torso',()=>{
      shell([[.88,.53,.36],[1.03,.62,.43],[1.36,.81,.49],[1.51,.64,.42],[1.55,.38,.32]],'rubber');
      shell([[1.02,.54,.39],[1.23,.77,.52,.025],[1.43,.80,.47],[1.52,.49,.35]],'paint');
      for(const s of [-1,1]) {
        plate(s*.21,1.37,.274,.33,.24,.067,'ivory',-.1,s*.15,s*.12);
        plate(s*.16,1.14,.266,.25,.17,.065,'paint');
        plate(s*.33,1.20,-.13,.07,.44,.09,'bronze',0,0,s*-.12);
        plate(s*.24,.96,.258,.18,.21,.14,'rubber');
        plate(s*.24,1.045,.337,.15,.028,.027,'bronze');
        plate(s*.30,.83,.025,.19,.30,.35,'paint',0,0,s*-.12);
        plate(s*.31,.85,.216,.13,.14,.036,'ivory');
      }
      for(let j=0;j<3;j++)plate(0,1.025+j*.065,.244,.26,.026,.045,'steel');
      plate(0,.95,.296,.15,.10,.047,'bronze');
      // Command sash and three rank bars; broader chest ceramic than the Oathguard.
      plate(-.23,1.335,.322,.075,.31,.024,'orange',0,0,-.27);
      for(let j=0;j<3;j++)plate(.13,1.38+j*.045,.317,.115,.018,.018,'bronze');
      plate(0,1.28,-.35,.49,.52,.24,'paint');
      plate(0,1.53,-.37,.36,.10,.23,'ivory');
      for(const s of [-1,1]) {
        plate(s*.20,1.25,-.49,.09,.38,.07,'steel');
        for(let j=0;j<5;j++)plate(s*.20,1.11+j*.065,-.535,.075,.024,.022,'rubber');
      }
      // Raised command beacon: reinforced mast and a bronze crystal socket.
      plate(-.275,1.60,-.36,.13,.19,.16,'bronze');
      ModelMesh.bake(out,geom.cylinder(10),{x:-.275,y:1.95,z:-.37,sx:.038,sy:.56,sz:.038,tint:C.steel});
      plate(-.275,1.77,-.37,.075,.07,.075,'rubber');
      plate(-.275,2.20,-.37,.19,.07,.19,'bronze');
      joint(0,1.57,0,.145);
    });
    group('helmet',()=>{
      shell([[1.62,.31,.32,.015],[1.72,.44,.40,.025],[1.91,.46,.43],[2.015,.33,.34],[2.055,.18,.20]],'ivory');
      plate(0,1.86,.226,.40,.13,.07,'rubber');
      plate(0,1.958,.23,.43,.055,.085,'bronze',-.15);
      plate(0,1.70,.234,.26,.12,.105,'paint');
      for(const s of [-1,1]) {
        plate(s*.187,1.74,.202,.10,.18,.105,'ivory',0,s*.2);
        plate(s*.247,1.82,-.025,.075,.15,.17,'steel');
        for(let j=0;j<3;j++)plate(s*.07,1.72,.295,.025,.045,.017,'rubber');
      }
      plate(0,2.034,.015,.083,.042,.22,'orange');
      plate(0,2.035,.126,.045,.044,.045,'bronze');
    });
    for(const s of [-1,1]) {
      const side=s<0?'left':'right',hip: Point=[s*.205,.85,0],knee: Point=[s*.255,.46,s<0?.12:-.075],ankle: Point=[s*.275,.15,s<0?.16:-.075];
      group(side+'Thigh',()=>{
        joint(...hip,.135);link(hip,knee,.29,.30,'rubber');
        link([hip[0],.80,hip[2]+.025],[knee[0],.50,knee[2]+.03],.31,.33,'paint');
        plate(knee[0],.57,knee[2]+.20,.18,.075,.035,'bronze');
      });
      group(side+'Shin',()=>{
        joint(...knee,.115,'steel');
        plate(knee[0],.46,knee[2]+.18,.285,.215,.12,'ivory',-.12);
        link(knee,ankle,.23,.26,'rubber');
        link([knee[0],.37,knee[2]+.065],[ankle[0],.17,ankle[2]+.05],.25,.27,'paint');
        plate(ankle[0],.195,ankle[2]+.20,.105,.15,.027,'orange');
      });
      group(side+'Boot',()=>{
        plate(ankle[0],.10,ankle[2]+.095,.33,.18,.51,'rubber');
        plate(ankle[0],.155,ankle[2]+.195,.31,.10,.29,'ivory',.12);
        plate(ankle[0],.026,ankle[2]+.10,.34,.047,.52,'steel');
      });
    }
    const arms: {name: string;shoulder: Point;elbow: Point;hand: Point}[]=[
      {name:'rightArm',shoulder:[.46,1.43,0],elbow:[.55,1.15,.14],hand:[.24,1.25,.32]},
      {name:'leftArm',shoulder:[-.46,1.43,0],elbow:[-.47,1.11,.27],hand:[.24,1.27,.72]}];
    for(const a of arms)group(a.name,()=>{
      joint(...a.shoulder,.165);link(a.shoulder,a.elbow,.21,.24,'rubber');
      link(a.shoulder,a.elbow,.24,.275,'paint');joint(...a.elbow,.115,'steel');
      link(a.elbow,a.hand,.18,.20,'rubber');
      const begin: Point=[a.elbow[0]*.7+a.hand[0]*.3,a.elbow[1]*.7+a.hand[1]*.3,a.elbow[2]*.7+a.hand[2]*.3];
      link(begin,a.hand,.23,.235,'paint');
      plate(a.shoulder[0]*1.1,1.46,.015,.38,.25,.44,'ivory',0,0,a.shoulder[0]>0?-.17:.17);
      plate(a.shoulder[0]*1.12,1.49,.245,.24,.105,.038,'orange');
      plate(a.shoulder[0]*1.16,1.57,.09,.29,.075,.33,'paint',0,0,a.shoulder[0]>0?-.17:.17);
      for(let j=0;j<3;j++)plate(a.shoulder[0]*1.16,1.49+j*.035,.27,.14,.014,.022,'bronze');
      joint(...a.hand,.098);
      for(let j=0;j<3;j++)plate(a.hand[0]+.069,a.hand[1]-.03+j*.037,a.hand[2]+.035,.045,.027,.135,'steel',0,0,.15);
    });
    group('carbine',()=>{
      plate(.24,1.405,.105,.18,.20,.26,'rubber');
      plate(.24,1.40,.315,.20,.20,.33,'steel');
      plate(.24,1.42,.69,.225,.185,.48,'paint');
      plate(.24,1.266,.32,.085,.20,.105,'rubber',-.22);
      plate(.24,1.24,.47,.15,.27,.16,'steel',-.18);
      plate(.24,1.102,.493,.155,.05,.17,'bronze',-.18);
      plate(.24,1.315,.70,.17,.065,.35,'rubber');
      plate(.24,1.536,.59,.09,.035,.66,'steel');
      for(let j=0;j<9;j++)plate(.24,1.56,.31+j*.068,.125,.02,.023,'rubber');
      plate(.24,1.61,.39,.135,.08,.19,'rubber');
      for(let j=0;j<4;j++)plate(.36,1.45,.57+j*.08,.02,.065,.045,'rubber');
      // Armored lower chamber makes this read as a breach weapon, not the rifle silhouette.
      plate(.24,1.29,.875,.16,.12,.33,'steel');
      plate(.24,1.29,1.02,.17,.13,.045,'bronze');
      plate(.24,1.425,1.02,.095,.10,.30,'steel');
      for(const s of [-1,1]) {
        plate(.24+s*.068,1.425,1.21,.032,.15,.18,'rubber');
        plate(.24,1.425+s*.060,1.21,.105,.03,.18,'rubber');
      }
      plate(.24,1.425,1.16,.096,.09,.01,'rubber');
      plate(.24,1.423,.91,.225,.185,.045,'bronze');
      plate(.345,1.407,.35,.018,.04,.085,'orange');
    });
    group('optics',()=>{
      plate(0,1.873,.265,.33,.053,.027,[1,1,1]);
      plate(.24,1.61,.493,.065,.048,.015,[1,1,1]);
      // Large faceted cyan crystal; shares the visor's emission and preview override.
      ModelMesh.bake(out,geom.octa(),{x:-.275,y:2.42,z:-.37,sx:.14,sy:.23,sz:.14});
    });
    group('team',()=>{
      for(const s of [-1,1])plate(s*.527,1.624,.09,.20,.027,.25,[1,1,1]);
      plate(0,1.31,-.48,.22,.10,.027,[1,1,1]);
    });
    group('flash',()=>ModelMesh.bake(out,geom.octa(),{x:.24,y:1.425,z:1.345,sx:.075,sy:.075,sz:.17}));
    return parts;
  }
  const names=['torso','helmet','leftThigh','leftShin','leftBoot','rightThigh','rightShin','rightBoot',
    'rightArm','leftArm','carbine','optics','team','flash'] as const;
  let geometry: Record<string,number[]> | undefined;
  const meshes: Record<string,()=>number[]>={};
  for(const name of names) {
    const mesh='breachMarshal'+name[0].toUpperCase()+name.slice(1);
    meshes[mesh]=()=>(geometry??=createMarshal())[name];
    if(!['optics','team','flash'].includes(name))meshes[mesh+'Neutral']=()=>{
      const data=meshes[mesh]().slice();
      for(let i=0;i<data.length;i+=9)data[i+6]=data[i+7]=data[i+8]=1;
      return data;
    };
  }
  interface Movement {time: number;walk: number;moved: number;weight: number}
  const movement=new WeakMap<RenderEntity,Movement>();
  function walking(e: RenderEntity,time: number) {
    if(!e.order)return e.walk?1:0;
    const walk=e.walk||0;
    let track=movement.get(e);
    if(!track||time<track.time||time-track.time>.25) {
      track={time,walk,moved:-Infinity,weight:0};movement.set(e,track);
    } else if(time>track.time) {
      if(walk>track.walk)track.moved=time;
      const target=time-track.moved<.12?1:0,dt=time-track.time;
      track.weight+=Math.max(-dt*8,Math.min(dt*8,target-track.weight));
      track.time=time;track.walk=walk;
    }
    return track.weight;
  }
  registerEntityModel({id:'faction-0/unit/hero',meshes,
    render({entity:e,time,part:p,team,surfaceColor,nightLight,lightPool,pointLight}) {
      const neutral=surfaceColor(0xffffff)!==0xffffff,white=surfaceColor(0xffffff),cyan=surfaceColor(0x38d9e8),
        weight=walking(e,time),phase=(e.walk||0)*4,
        breath=Math.sin(time*1.9)*(.007-weight*.004),hipY=.85+weight*(-.03+Math.cos(phase*2)*.008);
      const shotAge=UNITS.hero.reload-(e.cd??-1),firing=shotAge>=0&&shotAge<.18,
        kick=firing?Math.exp(-shotAge*24)*Math.sin(Math.min(shotAge*85,Math.PI/2)):0,
        upperRx=weight*.04-kick*.045,upperRz=weight*Math.sin(phase)*.013,
        upperTarget: Point=[0,hipY+breath,weight*.02-kick*.027];
      // One upper-body assembly preserves the stock seat and both hands during recoil.
      function draw(name: string,pivot: Point=[0,0,0],target: Point=pivot,rx=0,rz=0,color=white,glow=0) {
        const cx=Math.cos(rx),sx=Math.sin(rx),cz=Math.cos(rz),sz=Math.sin(rz),
          xx=pivot[0]*cz-pivot[1]*sz,yy=pivot[0]*sz+pivot[1]*cz,
          rotated: Point=[xx,yy*cx-pivot[2]*sx,yy*sx+pivot[2]*cx],
          suffix=neutral&&!['optics','team','flash'].includes(name)?'Neutral':'',
          base='breachMarshal'+name[0].toUpperCase()+name.slice(1);
        p(base+suffix,(target[0]-rotated[0])*SCALE,(target[1]-rotated[1])*SCALE,(target[2]-rotated[2])*SCALE,
          SCALE,SCALE,SCALE,color,0,rx,rz,glow);
      }
      for(const name of ['torso','helmet','rightArm','leftArm','carbine'])draw(name,[0,.85,0],upperTarget,upperRx,upperRz);
      draw('team',[0,.85,0],upperTarget,upperRx,upperRz,surfaceColor(team),.2);
      draw('optics',[0,.85,0],upperTarget,upperRx,upperRz,cyan,.95+1.55*nightLight);
      if(firing&&shotAge<.04)draw('flash',[0,.85,0],upperTarget,upperRx,upperRz,cyan,2.2);
      for(const s of [-1,1]) {
        const side=s<0?'left':'right',hip: Point=[s*.205,.85,0],knee: Point=[s*.255,.46,s<0?.12:-.075],ankle: Point=[s*.275,.15,s<0?.16:-.075];
        if(!weight){for(const name of ['Thigh','Shin','Boot'])draw(side+name);continue;}
        const q=((phase/(Math.PI*2)+(s<0?0:.5))%1+1)%1,swing=q>=.6,u=swing?(q-.6)/.4:q/.6,
          z=swing?-.20+.4*u*u*(3-2*u):.20-.4*u,lift=swing?.125*Math.sin(Math.PI*u):0,
          h: Point=[hip[0],hipY+breath,0],a: Point=[ankle[0],.15+lift,z],
          l1=Math.hypot(.39,knee[2]),l2=Math.hypot(.31,ankle[2]-knee[2]),dy=a[1]-h[1],dz=a[2]-h[2],distance=Math.hypot(dy,dz),
          alpha=Math.acos(Math.max(-1,Math.min(1,(l1*l1+distance*distance-l2*l2)/(2*l1*distance)))),
          angle=Math.atan2(dz,-dy)+alpha,k: Point=[knee[0],h[1]-l1*Math.cos(angle),h[2]+l1*Math.sin(angle)],
          shinAngle=Math.atan2(a[2]-k[2],k[1]-a[1]);
        const blend=(from: Point,to: Point): Point=>[from[0]+(to[0]-from[0])*weight,from[1]+(to[1]-from[1])*weight,from[2]+(to[2]-from[2])*weight];
        draw(side+'Thigh',hip,blend(hip,h),(Math.atan2(knee[2],.39)-angle)*weight);
        draw(side+'Shin',knee,blend(knee,k),(Math.atan2(ankle[2]-knee[2],.31)-shinAngle)*weight);
        draw(side+'Boot',ankle,blend(ankle,a),swing?-.18*Math.sin(Math.PI*u)*weight:0);
      }
      const cy=Math.cos(upperRx),sy=Math.sin(upperRx),cz=Math.cos(upperRz),sz=Math.sin(upperRz),
        beaconY=2.42-.85,bx=-.275*cz-beaconY*sz,by=-.275*sz+beaconY*cz,
        ly=upperTarget[1]+by*cy+.37*sy,lz=upperTarget[2]+by*sy-.37*cy;
      // Broad nocturnal beacon illuminates real nearby surfaces, even in Performance.
      pointLight(bx*SCALE,ly*SCALE,lz*SCALE,10,0x38d9e8,3.6);
      if(nightLight>0)lightPool(bx*SCALE,lz*SCALE,7,7,0x38d9e8,.5*nightLight);
    }
  });
})();
