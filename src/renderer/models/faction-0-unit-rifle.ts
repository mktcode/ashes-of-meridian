/* Cinder Pact / Oathguard: two-handed rifle, painted armor and CPU-only rigid rig.
   +Y up, +Z forward. Cosmetic poses never mutate entities, gameplay or RNG. */
'use strict';
(() => {
  type Point = readonly [number,number,number];
function createOathguard(): Record<string, number[]> {
  const parts: Record<string, number[]> = {};
  const C = {paint:[.12,.32,.34], ivory:[.78,.73,.58], orange:[.85,.27,.075],
    rubber:[.055,.075,.085], steel:[.25,.3,.32], bronze:[.53,.35,.15], glow:[.22,.85,.91]};
  let out: number[] = [];
  function group(name: string,fn: () => void){out=[];fn();parts[name]=out;}
  function plate(x: number,y: number,z: number,w: number,h: number,d: number,c: keyof typeof C | number[],rx=0,ry=0,rz=0) {
    const m: number[]=[];ModelMesh.panel(m,{w,h,d,bevel:Math.min(w,h,d)*.16});
    ModelMesh.bake(out,m,{x,y,z,tint:typeof c === 'string' ? C[c] : c,rx,ry,rz});
  }
  function joint(x: number,y: number,z: number,r: number,c: keyof typeof C='rubber') {ModelMesh.lobedShell(out,{x,y,z,sx:r,sy:r,sz:r,lobes:3,depth:0,segments:12,rings:8,tint:C[c]});}
  function link(a: Point,b: Point,w: number,d: number,c: keyof typeof C) {
    const v=b.map((p,i)=>p-a[i]),len=Math.hypot(...v);
    plate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,w,len,d,c,Math.acos(v[1]/len),Math.atan2(v[0],v[2]));
  }
  function shell(levels: number[][],c: keyof typeof C,x=0,z=0) {
    const rings=levels.map(([y,w,d,dz=0])=>{
      const a=w/2,b=d/2,k=Math.min(a,b)*.45;
      return [[-a+k,b],[a-k,b],[a,b-k],[a,-b+k],[a-k,-b],[-a+k,-b],[-a,-b+k],[-a,b-k]].map(([px,pz])=>[x+px,y,z+pz+dz]);
    });
    for(let i=0;i<8;i++) {let k=(i+1)%8;
      for(let j=0;j<rings.length-1;j++) {
        geom.tri(out,rings[j][i],rings[j][k],rings[j+1][k],C[c]);
        geom.tri(out,rings[j][i],rings[j+1][k],rings[j+1][i],C[c]);
      }
      geom.tri(out,[x,levels[0][0],z+(levels[0][3]||0)],rings[0][k],rings[0][i],C[c]);
      geom.tri(out,[x,levels.at(-1)![0],z+(levels.at(-1)![3]||0)],rings.at(-1)![i],rings.at(-1)![k],C[c]);
    }
  }
  group('torso',()=>{
    shell([[.88,.48,.33],[1.03,.57,.4],[1.36,.73,.45],[1.51,.57,.38],[1.55,.35,.29]],'rubber');
    shell([[1.02,.49,.36],[1.23,.7,.48,.025],[1.43,.72,.43],[1.52,.43,.32]],'paint');
    for(const s of [-1,1]) {
      plate(s*.18,1.37,.249,.29,.21,.055,'ivory',-.1,s*.15,s*.12);
      plate(s*.13,1.13,.248,.22,.16,.055,'paint');
      plate(s*.3,1.19,-.12,.065,.43,.08,'bronze',0,0,s*-.12);
      plate(s*.22,.95,.237,.16,.2,.13,'rubber');
      plate(s*.22,1.03,.31,.13,.028,.027,'bronze');
      plate(s*.29,.83,.03,.17,.29,.32,'paint',0,0,s*-.12);
    }
    for(let j=0;j<3;j++)plate(0,1.025+j*.06,.22,.23,.025,.04,'steel');
    plate(0,.94,.272,.12,.09,.045,'ivory');
    plate(-.13,1.39,.291,.10,.024,.015,'orange',0,0,-.1);
    plate(0,1.27,-.32,.43,.49,.23,'paint');
    plate(0,1.5,-.33,.31,.09,.21,'ivory');
    for(const s of [-1,1]) {
      plate(s*.18,1.24,-.46,.085,.37,.07,'steel');
      for(let j=0;j<5;j++)plate(s*.18,1.1+j*.065,-.505,.07,.025,.025,'rubber');
    }
    joint(0,1.57,0,.135);
  });
  group('helmet',()=>{
    shell([[1.62,.29,.3,.015],[1.72,.42,.39,.025],[1.91,.44,.41],[2.015,.31,.32],[2.045,.16,.19]],'ivory');
    plate(0,1.86,.215,.38,.13,.065,'rubber');

    plate(0,1.958,.214,.4,.055,.08,'paint',-.15);
    plate(0,1.7,.221,.23,.115,.10,'paint');
    for(const s of [-1,1]) {
      plate(s*.173,1.74,.186,.09,.17,.1,'ivory',0,s*.2);
      plate(s*.235,1.81,-.025,.07,.14,.15,'steel');
      for(let i=0;i<3;i++)plate(s*.07,1.72,.277,.025,.044,.016,'rubber');
    }
    plate(-.095,2.02,.005,.063,.035,.19,'orange');
  });
  for(const s of [-1,1]) {
    const side=s<0?'left':'right';
    const hip: Point=[s*.205,.85,0],knee: Point=[s*.255,.46,s<0?.12:-.075],ankle: Point=[s*.275,.15,s<0?.16:-.075];
    group(side+'Thigh',()=>{
      joint(...hip,.125);link(hip,knee,.27,.28,'rubber');
      link([hip[0],.8,hip[2]+.025],[knee[0],.5,knee[2]+.03],.285,.31,'paint');
    });
    group(side+'Shin',()=>{
      joint(...knee,.105,'steel');
      plate(knee[0],.46,knee[2]+.16,.26,.205,.11,'ivory',-.12);
      link(knee,ankle,.215,.24,'rubber');
      link([knee[0],.37,knee[2]+.065],[ankle[0],.17,ankle[2]+.05],.23,.25,'paint');
      plate(ankle[0],.195,ankle[2]+.19,.09,.15,.027,'orange');
    });
    group(side+'Boot',()=>{
      plate(ankle[0],.10,ankle[2]+.095,.31,.18,.49,'rubber');
      plate(ankle[0],.155,ankle[2]+.19,.29,.10,.28,'ivory',.12);
      plate(ankle[0],.026,ankle[2]+.1,.32,.047,.5,'steel');
    });
  }
  const arms: {name: string; shoulder: Point; elbow: Point; hand: Point}[]=[{name:'rightArm',shoulder:[.42,1.43,0],elbow:[.51,1.15,.14],hand:[.24,1.25,.32]},
    {name:'leftArm',shoulder:[-.42,1.43,0],elbow:[-.43,1.11,.27],hand:[.24,1.27,.72]}];
  for(const a of arms)group(a.name,()=>{
    joint(...a.shoulder,.155);link(a.shoulder,a.elbow,.19,.22,'rubber');
    link(a.shoulder,a.elbow,.22,.255,'paint');joint(...a.elbow,.105,'steel');
    link(a.elbow,a.hand,.16,.18,'rubber');
    const begin: Point=[a.elbow[0]*.7+a.hand[0]*.3,a.elbow[1]*.7+a.hand[1]*.3,a.elbow[2]*.7+a.hand[2]*.3];
    link(begin,a.hand,.21,.215,'paint');
    plate(a.shoulder[0]*1.1,1.46,.015,.34,.22,.39,'ivory',0,0,a.shoulder[0]>0?-.17:.17);
    plate(a.shoulder[0]*1.12,1.477,.218,.19,.08,.035,'orange');
    joint(...a.hand,.092);
    // Finger bands curl around the pistol grip / fore-end, not hovering beside it.
    for(let j=0;j<3;j++)plate(a.hand[0]+.064,a.hand[1]-.03+j*.037,a.hand[2]+.035,.045,.027,.135,'steel',0,0,.15);
  });
  group('rifle',()=>{
    // Stock seats into right shoulder; right index hand on grip, left palm under handguard.
    plate(.24,1.405,.105,.16,.19,.26,'rubber');
    plate(.24,1.4,.315,.17,.18,.33,'steel');
    plate(.24,1.42,.66,.19,.16,.42,'paint');
    plate(.24,1.266,.32,.085,.20,.105,'rubber',-.22);
    plate(.24,1.24,.47,.12,.26,.145,'steel',-.18);
    plate(.24,1.107,.493,.125,.05,.15,'bronze',-.18);
    plate(.24,1.315,.67,.15,.065,.31,'rubber');
    plate(.24,1.523,.55,.075,.035,.6,'steel');
    for(let j=0;j<8;j++)plate(.24,1.548,.3+j*.066,.105,.02,.022,'rubber');
    plate(.24,1.584,.375,.115,.07,.17,'rubber');

    for(let j=0;j<4;j++)plate(.342,1.437,.54+j*.075,.02,.055,.042,'rubber');
    plate(.24,1.425,.946,.085,.09,.26,'steel');
    // Open muzzle: four walls around a dark recessed bore.
    for(const s of [-1,1]) {
      plate(.24+s*.062,1.425,1.079,.03,.14,.15,'rubber');
      plate(.24,1.425+s*.055,1.079,.096,.03,.15,'rubber');
    }
    plate(.24,1.425,1.04,.09,.085,.01,'rubber');
    plate(.24,1.423,.83,.19,.17,.045,'bronze');
    plate(.333,1.407,.35,.018,.036,.085,'orange');
  });
  group('optics',()=>{
    plate(0,1.873,.25,.315,.053,.027,[1,1,1]);
    plate(.24,1.582,.466,.057,.043,.015,[1,1,1]);
  });
  group('team',()=>{
    for(const s of [-1,1])plate(s*.465,1.56,.065,.18,.025,.23,[1,1,1]);
    plate(0,1.285,-.445,.19,.08,.025,[1,1,1]);
  });
  group('flash',()=>ModelMesh.bake(out,geom.octa(),{x:.24,y:1.425,z:1.2,sx:.065,sy:.065,sz:.15}));
  return parts;
}

  const names = ['torso','helmet','leftThigh','leftShin','leftBoot','rightThigh','rightShin','rightBoot',
    'rightArm','leftArm','rifle','optics','team','flash'] as const;
  let geometry: Record<string,number[]> | undefined;
  const meshes: Record<string, () => number[]> = {};
  for (const name of names) {
    const mesh = 'oathguard'+name[0].toUpperCase()+name.slice(1);
    meshes[mesh] = () => (geometry ??= createOathguard())[name];
    // Painted vertex tints must not fight the shared ghost/preview override.
    if (!['optics','team','flash'].includes(name)) meshes[mesh+'Neutral'] = () => {
      const data = meshes[mesh]().slice();
      for (let i=0;i<data.length;i+=9) data[i+6]=data[i+7]=data[i+8]=1;
      return data;
    };
  }
  interface Movement {time: number; walk: number; moved: number; weight: number}
  const movement = new WeakMap<RenderEntity,Movement>();
  function walking(e: RenderEntity,time: number) {
    // Codex demo entities deliberately have no order/path/cooldown; thumbnails have walk=0.
    if (!e.order) return e.walk ? 1 : 0;
    const walk=e.walk || 0;
    let track=movement.get(e);
    if (!track || time < track.time || time-track.time>.25) {
      track={time,walk,moved:-Infinity,weight:0};movement.set(e,track);
    } else if (time > track.time) {
      if (walk > track.walk) track.moved=time;
      const target=time-track.moved<.12?1:0, dt=time-track.time;
      track.weight += Math.max(-dt*8,Math.min(dt*8,target-track.weight));
      track.time=time;track.walk=walk;
    }
    return track.weight;
  }
  registerEntityModel({
    id:'faction-0/unit/rifle', meshes,
    render({entity:e,time,part:p,team,surfaceColor,nightLight,lightPool,pointLight}) {
      const neutral=surfaceColor(0xffffff)!==0xffffff, white=surfaceColor(0xffffff),cyan=surfaceColor(0x38d9e8);
      const weight=walking(e,time),phase=(e.walk||0)*4.5;
      const breath=Math.sin(time*2.2)*(.008-weight*.004);
      const hipY=.85+weight*(-.03+Math.cos(phase*2)*.009);
      // Cooldown is reset only by real shots; initial random cooldown is below this window.
      // No timer/salvo loop, so buffs, pause and save/restore retain their simulation semantics.
      const shotAge=UNITS.rifle.reload-(e.cd ?? -1);
      const firing=shotAge>=0 && shotAge<.18;
      const kick=firing?Math.exp(-shotAge*24)*Math.sin(Math.min(shotAge*85,Math.PI/2)):0;
      const upperRx=weight*.055-kick*.035, upperRz=weight*Math.sin(phase)*.018;
      const upperTarget: Point=[0,hipY+breath,weight*.025-kick*.022];
      // Move one rigid assembly about the hips; stock and both grip targets stay attached.
      function draw(name: string,pivot: Point=[0,0,0],target: Point=pivot,rx=0,rz=0,color=white,glow=0) {
        const cx=Math.cos(rx),sx=Math.sin(rx),cz=Math.cos(rz),sz=Math.sin(rz),
          xx=pivot[0]*cz-pivot[1]*sz,yy=pivot[0]*sz+pivot[1]*cz,
          rotated: Point=[xx,yy*cx-pivot[2]*sx,yy*sx+pivot[2]*cx];
        const base='oathguard'+name[0].toUpperCase()+name.slice(1),suffix=neutral&&!['optics','team','flash'].includes(name)?'Neutral':'';
        p(base+suffix,target[0]-rotated[0],target[1]-rotated[1],target[2]-rotated[2],1,1,1,color,0,rx,rz,glow);
      }
      for (const name of ['torso','helmet','rightArm','leftArm','rifle'])draw(name,[0,.85,0],upperTarget,upperRx,upperRz);
      draw('team',[0,.85,0],upperTarget,upperRx,upperRz,surfaceColor(team),.2);
      draw('optics',[0,.85,0],upperTarget,upperRx,upperRz,cyan,.85+1.55*nightLight);
      // A short local cyan flash at the animated muzzle, including on Performance.
      if (firing && shotAge<.04)draw('flash',[0,.85,0],upperTarget,upperRx,upperRz,cyan,2.2);
      for (const s of [-1,1]) {
        const side=s<0?'left':'right',hip: Point=[s*.205,.85,0],knee: Point=[s*.255,.46,s<0?.12:-.075],ankle: Point=[s*.275,.15,s<0?.16:-.075];
        if (!weight) {for(const part of ['Thigh','Shin','Boot'])draw(side+part);continue;}
        const q=((phase/(Math.PI*2)+(s<0?0:.5))%1+1)%1, swing=q>=.6,u=swing?(q-.6)/.4:q/.6;
        const z=swing?-.20+.4*u*u*(3-2*u):.20-.4*u, lift=swing?.125*Math.sin(Math.PI*u):0;
        const h: Point=[hip[0],hipY+breath,0],a: Point=[ankle[0],.15+lift,z];
        const l1=Math.hypot(.39,knee[2]),l2=Math.hypot(.31,ankle[2]-knee[2]),
          dy=a[1]-h[1],dz=a[2]-h[2],distance=Math.hypot(dy,dz),
          alpha=Math.acos(Math.max(-1,Math.min(1,(l1*l1+distance*distance-l2*l2)/(2*l1*distance)))),
          angle=Math.atan2(dz,-dy)+alpha,
          k: Point=[knee[0],h[1]-l1*Math.cos(angle),h[2]+l1*Math.sin(angle)],
          shinAngle=Math.atan2(a[2]-k[2],k[1]-a[1]);
        const blend=(from: Point,to: Point): Point => [from[0]+(to[0]-from[0])*weight,from[1]+(to[1]-from[1])*weight,from[2]+(to[2]-from[2])*weight];
        draw(side+'Thigh',hip,blend(hip,h),(Math.atan2(knee[2],.39)-angle)*weight);
        draw(side+'Shin',knee,blend(knee,k),(Math.atan2(ankle[2]-knee[2],.31)-shinAngle)*weight);
        draw(side+'Boot',ankle,blend(ankle,a),swing?-.18*Math.sin(Math.PI*u)*weight:0);
      }
      // Lamp shares the moving helmet frame, instead of floating at the old head height.
      const cy=Math.cos(upperRx),sy=Math.sin(upperRx),cz=Math.cos(upperRz),sz=Math.sin(upperRz),
        visorY=1.873-.85, vx=-visorY*sz,vy=visorY*cz,
        ly=upperTarget[1]+vy*cy-.27*sy,lz=upperTarget[2]+vy*sy+.27*cy;
      pointLight(vx,ly,lz,4,0x38d9e8,1.5);
      if(nightLight>0)lightPool(0,1.3,1.8,2.3,0x38d9e8,.65*nightLight);
    }
  });

})();
