/* Shared civilian research and residential architecture. Static hulls are built once; only the
   separate stilt lengths/entry stairs sample the CPU surface at render time. */
'use strict';
(() => {
  type Material = 'steel' | 'edge' | 'dark' | 'orange' | 'cyan' | 'glass' | 'window' | 'warm' | 'dim' | 'soil' | 'leaf';
  type Variant = 'fieldlab' | 'researchhub' | 'researchspire' | 'embercottage' | 'terracecommons' | 'hearthtower';
  type Foot = { x: number; z: number; top: number };
  const colors: Record<Material, number> = {steel:0x68797d,edge:0xabb4b2,dark:0x23333e,
    orange:0xb46a31,cyan:0x3fdcea,glass:0x235b68,window:0x55ccdf,
    warm:0xff6613,dim:0x7a3513,soil:0x384438,leaf:0x385938};
  const variants: Variant[] = ['fieldlab','researchhub','researchspire','embercottage','terracecommons','hearthtower'];
  const feet = (x:number,z:number,w:number,d:number,top=0):Foot[] =>
    [-w/2+.2,w/2-.2].flatMap(dx=>[-d/2+.15,0,d/2-.15].map(dz=>({x:x+dx,z:z+dz,top})));
  function assembly(type: Variant): Record<Material, number[]> {
    const meshes: Record<Material, number[]> = {steel:[],edge:[],dark:[],orange:[],cyan:[],glass:[],window:[],warm:[],dim:[],soil:[],leaf:[]};
    const tri = (a:number[],b:number[],c:number[],m:Material) => geom.tri(meshes[m],a,b,c,[1,1,1]);
    const quad = (a:number[],b:number[],c:number[],d:number[],m:Material) => {tri(a,b,c,m);tri(a,c,d,m);};
    const box = (x:number,y:number,z:number,w:number,h:number,d:number,m:Material='steel') => {
      ModelMesh.panel(meshes[m],{x,y,z,w,h,d,bevel:Math.min(.04,w*.18,h*.18,d*.18)});
    };
    const cylinder = (x:number,y:number,z:number,r:number,h:number,m:Material='edge') =>
      ModelMesh.bake(meshes[m],geom.cylinder(12),{x,y,z,sx:r,sy:h,sz:r});
    const beam = (a:number[],b:number[],width:number,m:Material='edge') => {
      const dir=V.norm(V.sub(b,a)),u=V.norm(V.cross(dir,Math.abs(dir[1])>.9?[1,0,0]:[0,1,0])),v=V.cross(dir,u);
      const pts=(p:number[])=>[[1,1],[-1,1],[-1,-1],[1,-1]].map(([i,j])=>p.map((n,k)=>n+width/2*(i*u[k]+j*v[k])));
      const A=pts(a),B=pts(b);
      for(let i=0;i<4;i++){const j=(i+1)%4;quad(A[i],A[j],B[j],B[i],m);}
      quad(A[3],A[2],A[1],A[0],m);quad(B[0],B[1],B[2],B[3],m);
    };
    const ring = (x:number,y:number,z:number,w:number,d:number,cut:number) =>
      [[-w/2+cut,-d/2],[w/2-cut,-d/2],[w/2,-d/2+cut],[w/2,d/2-cut],[w/2-cut,d/2],[-w/2+cut,d/2],[-w/2,d/2-cut],[-w/2,-d/2+cut]]
        .map(([X,Z])=>[x+X,y,z+Z]);
    const oct = (x:number,y:number,z:number,w:number,h:number,d:number,cut:number,m:Material='steel',corner:Material=m) => {
      const A=ring(x,y-h/2,z,w,d,cut),B=ring(x,y+h/2,z,w,d,cut);
      for(let i=0;i<8;i++){const j=(i+1)%8;quad(A[j],A[i],B[i],B[j],i%2?corner:m);
        tri([x,y-h/2,z],A[i],A[j],m);tri([x,y+h/2,z],B[j],B[i],m);}
    };
    const band = (x:number,y:number,z:number,w:number,d:number) => {
      const p=ring(x,y,z,w+.13,d+.13,Math.min(.78,d*.28)+.04);
      for(let i=0;i<8;i++)beam(p[i],p[(i+1)%8],.045,'cyan');
    };
    const module = (x:number,y:number,z:number,w:number,d:number,floors=1) => {
      const H=floors*1.55,cut=Math.min(.78,d*.28),fw=w-2*cut-.20,sw=d-2*cut-.20;
      oct(x,y+H/2,z,w,H,d,cut,'steel','dark');oct(x,y+.12,z,w+.18,.24,d+.18,cut+.05,'dark');
      for(let f=0;f<floors;f++){
        const Y=y+f*1.55;
        box(x,Y+.90,z+d/2+.015,fw+.18,.74,.13,'dark');
        box(x,Y+.90,z+d/2+.095,fw,.56,.025,'window');
        box(x,Y+.56,z+d/2+.12,fw+.18,.08,.18,'edge');
        box(x+w/2+.015,Y+.90,z,.13,.74,sw+.18,'dark');
        box(x+w/2+.095,Y+.90,z,.025,.56,sw,'window');
        box(x+w/2+.12,Y+.56,z,.18,.08,sw+.18,'edge');
        for(const t of [-.25,0,.25]){
          box(x+fw*t,Y+.90,z+d/2+.12,.05,.56,.045,'dark');
          box(x+w/2+.12,Y+.90,z+sw*t,.045,.56,.05,'dark');
        }
        oct(x,Y+1.48,z,w+.10,.10,d+.10,cut+.03,'edge');
        for(const sx of [-1,1])for(const sz of [-1,1]){
          const X=x+sx*(w/2-cut*.5+.015),Z=z+sz*(d/2-cut*.5+.015);
          beam([X,Y+.15,Z],[X,Y+1.38,Z],.095);
          beam([X+sx*.075,Y+.29,Z-sz*.075],[X+sx*.075,Y+1.22,Z-sz*.075],.045,'cyan');
        }
      }
      oct(x,y+H+.055,z,w+.40,.21,d+.40,cut+.16,'edge');
      oct(x,y+H+.18,z,w+.08,.08,d+.08,cut+.04,'dark');
      return y+H+.22;
    };
    const deck = (x:number,z:number,w:number,d:number,top=0) => {
      oct(x,top+.10,z,w+.60,.20,d+.60,.45,'dark');
      oct(x,top+.25,z,w+.76,.10,d+.76,.51,'edge');
    };
    const railing = (x:number,y:number,z:number,w:number,d:number,gap=0) => {
      for(const dx of [-w/2,w/2]){
        beam([x+dx,y,z-d/2],[x+dx,y+.78,z-d/2],.055);
        beam([x+dx,y,z+d/2],[x+dx,y+.78,z+d/2],.055);
        beam([x+dx,y+.78,z-d/2],[x+dx,y+.78,z+d/2],.06);
      }
      for(let i=0;i<=Math.ceil(w);i++){
        const X=x-w/2+i*w/Math.ceil(w);if(gap&&Math.abs(X-x)<gap/2)continue;
        beam([X,y,z+d/2],[X,y+.78,z+d/2],.05);
      }
      for(const [a,b]of(gap?[[-w/2,-gap/2],[gap/2,w/2]]:[[-w/2,w/2]])){
        for(const h of [.36,.78])beam([x+a,y+h,z+d/2],[x+b,y+h,z+d/2],.05);
        beam([x+a,y,z+d/2],[x+a,y+.78,z+d/2],.05);beam([x+b,y,z+d/2],[x+b,y+.78,z+d/2],.05);
      }
    };
    const entry = (x:number,y:number,z:number) => {
      box(x,y+.59,z,1,1.18,.14,'dark');box(x,y+.58,z+.08,.74,1.08,.04);
      box(x,y+.58,z+.12,.025,1.05,.022,'dark');box(x+.43,y+.60,z+.12,.055,.85,.035,'cyan');
      box(x,y+1.3,z+.28,1.35,.10,.70,'edge');box(x,y+1.26,z+.64,.75,.035,.035,'cyan');
    };
    const equipment = (x:number,y:number,z:number) => {
      box(x,y+.22,z,1.05,.44,.75);box(x,y+.46,z,1.16,.08,.85,'edge');
      for(let i=-3;i<=3;i++)box(x+i*.13,y+.51,z,.045,.025,.62,'dark');
    };
    const grille = (x:number,y:number,z:number,w:number) => {
      box(x,y,z,w,.52,.12,'dark');for(let i=-2;i<=2;i++)box(x,y+i*.083,z+.07,w-.14,.035,.035,'edge');
    };
    const sign = (x:number,y:number,z:number) => {
      box(x,y,z,.60,.44,.08,'dark');for(const [dy,w]of [[.11,.28],[0,.36],[-.11,.18]])box(x-.03,y+dy,z+.055,w,.045,.035,'cyan');
    };
    const skylight = (x:number,y:number,z:number,w:number,d:number) => {
      box(x,y+.12,z,w+.20,.24,d+.20,'edge');box(x,y+.31,z,w,.27,d,'glass');
      for(let i=0;i<=3;i++)box(x-w/2+i*w/3,y+.45,z,.045,.035,d+.08,'edge');
      box(x,y+.45,z+d/2,w,.035,.045,'cyan');
    };
    const dish = (x:number,y:number,z:number,r:number) => {
      cylinder(x,y+.12,z,r*.55,.24,'dark');cylinder(x,y+.38,z,.14,.44);
      const axis=V.norm([0,.85,.53]),U=[1,0,0],Vv=V.norm(V.cross(axis,U)),center=[x,y+.58,z];
      const point=(rad:number,a:number)=>center.map((n,k)=>n+rad*(Math.cos(a)*U[k]+Math.sin(a)*Vv[k])+axis[k]*rad*rad/r*.28);
      const rings=5,segs=24,back=(rad:number,a:number)=>point(rad,a).map((n,k)=>n-axis[k]*.035);
      for(let i=0;i<rings;i++)for(let j=0;j<segs;j++){
        const a=j*Math.PI*2/segs,b=(j+1)*Math.PI*2/segs;
        if(i===0){
          tri(center,point(r/rings,a),point(r/rings,b),'edge');
          tri(back(0,0),back(r/rings,b),back(r/rings,a),'dark');
        }else{
          quad(point(i*r/rings,a),point((i+1)*r/rings,a),point((i+1)*r/rings,b),point(i*r/rings,b),'edge');
          quad(back(i*r/rings,b),back((i+1)*r/rings,b),back((i+1)*r/rings,a),back(i*r/rings,a),'dark');
        }
      }
      for(let i=0;i<segs;i++)beam(point(r,i*Math.PI*2/segs),point(r,(i+1)*Math.PI*2/segs),.045,'cyan');
      const focus=center.map((n,k)=>n+axis[k]*r*.85);
      for(const a of [0,Math.PI*2/3,Math.PI*4/3])beam(point(r*.85,a),focus,.035,'dark');
      box(focus[0],focus[1],focus[2],.13,.13,.13,'cyan');
    };
    const residential = (x:number,y:number,z:number,w:number,d:number,floors=1) => {
      const H=floors*1.55;
      box(x,y+H/2,z,w,H,d);box(x,y+.16,z,w+.15,.20,d+.14,'dark');
      for(let f=0;f<floors;f++){
        const Y=y+f*1.55;box(x,Y+1.46,z,w+.17,.15,d+.18,'dark');
        for(let j=0;j<Math.floor(w/1.02);j++){
          const X=x+(j-(Math.floor(w/1.02)-1)/2)*1.02,Z=z+d/2+.017;
          box(X,Y+.80,Z,.80,.88,.13,'dark');box(X,Y+.80,Z+.073,.62,.70,.027,(j+f)%5!==2?'warm':'dim');
          box(X,Y+.80,Z+.096,.035,.70,.032,'dark');box(X,Y+.405,Z+.11,.85,.08,.21,'edge');
        }
        for(let j=0;j<Math.floor(d/1.03);j++){
          const X=x+w/2+.02,Z=z+(j-(Math.floor(d/1.03)-1)/2)*1.03;
          box(X,Y+.80,Z,.13,.88,.80,'dark');box(X+.074,Y+.80,Z,.027,.70,.62,(j+f)%4!==1?'warm':'dim');
          box(X+.095,Y+.80,Z,.028,.70,.035,'dark');box(X+.1,Y+.405,Z,.20,.08,.85,'edge');
        }
      }
      for(const dx of [-w/2+.1,w/2-.1]){
        box(x+dx,y+H/2,z+d/2+.085,.14,H,.15,'edge');
        for(let k=0;k<floors;k++)box(x+dx,y+k*1.55+.3,z+d/2+.18,.16,.26,.045,'orange');
      }
      box(x,y+H+.06,z,w+.28,.20,d+.28,'edge');box(x,y+H+.18,z,w-.22,.08,d-.22,'dark');
      return y+H+.22;
    };
    const planter = (x:number,y:number,z:number,w:number) => {
      box(x,y+.18,z,w,.36,.55,'orange');box(x,y+.37,z,w-.13,.025,.42,'soil');
      for(let i=0;i<4;i++)box(x-w*.33+i*w*.22,y+.49,z,.20,.24,.27,'leaf');
    };
    for(const d of (BUILDINGS[type] as BuildingDefinitionShape).civilizationDecks!)deck(d.x,d.z,d.w,d.d,d.top);
    if(type==='fieldlab'){
      const roof=module(0,.35,0,4.4,3.3);
      band(0,1.76,0,4.4,3.3);skylight(.45,roof,.2,2.15,1.5);dish(-1.3,roof+.04,-.70,.78);
      box(2.28,.78,-.30,.65,.88,1.95,'dark');for(let i=-2;i<=2;i++)box(2.62,.74+i*.13,-.30,.035,.055,1.60,'edge');
      equipment(.6,roof,-1.1);grille(-1.02,.69,1.71,.55);
      entry(.55,.35,1.72);railing(.55,.35,2.2,3.2,.9,1.3);sign(-.56,1.02,1.84);
    }else if(type==='researchhub'){
      const back=1.45,roof=module(-.8,back+.35,-1.1,4.65,2.6,2),terrace=module(.75,.35,1.7,5.3,2.55);
      band(-.8,back+3.31,-1.1,4.65,2.6);band(.75,1.76,1.7,5.3,2.55);railing(.75,terrace+.04,1.73,5.45,2.65);
      for(const x of [-1.1,0,1.1]){
        box(x,terrace+.16,1.55,.76,.24,.72,'dark');cylinder(x,terrace+.65,1.55,.24,.78,'glass');
        for(const h of [.27,.99])cylinder(x,terrace+h,1.55,.30,.10);box(x,terrace+.65,1.81,.055,.56,.025,'cyan');
      }
      equipment(2.48,terrace+.04,1.5);dish(-1.72,roof+.03,-1.08,.96);skylight(.40,roof+.02,-1.02,1.45,1.68);
      box(-3.05,back+1.44,-1.1,.35,2.65,2.1,'dark');for(let j=0;j<3;j++)grille(-1.85+j*.70,back+.67,.26,.55);
      const top=back+1.90,end=terrace+.04;box(2.61,top-.08,-.25,2.7,.16,.86,'edge');
      for(let i=0;i<8;i++){const rise=(top-end)/8;box(3.7,top-(i+.5)*rise,-.1+i*.27,.88,rise,.28,'edge');}
      beam([4.14,top+.6,-.1],[4.14,end+.6,1.9],.055);
      entry(.3,.35,3.01);sign(-.77,.99,3.12);
    }else if(type==='researchspire'){
      const podium=module(0,.35,-.4,4.7,3.95,2),roof=module(.12,podium-.10,-.58,3.72,3.30,4);
      box(-2.13,4.88,-1.0,.70,9.40,2.50,'dark');for(const x of [-2.29,-1.97])box(x,4.90,.32,.07,9.12,.07,'cyan');
      for(let f=0;f<6;f++){
        const Y=.79+f*1.55;box(-2.50,Y,-1,.065,.17,2.48,'edge');
        if(f<2)band(0,Y+.92,-.4,4.7,3.95);else band(.12,Y+.96,-.58,3.72,3.30);
      }
      oct(.12,roof+.06,-.45,4.8,.20,4.15,.90,'edge');oct(.12,roof+.20,-.45,4.52,.08,3.87,.82,'dark');
      oct(-.58,roof+.72,-1.15,1.65,1,1.5,.35);band(-.58,roof+1.12,-1.15,1.65,1.5);
      dish(-.58,roof+1.23,-1.15,1.84);dish(1.32,roof+.26,.67,.94);dish(-1.16,roof+.26,1.01,.49);
      equipment(1.20,podium+.03,.72);grille(-1.15,.71,1.63,.61);grille(1.35,.71,1.63,.48);
      entry(.2,.35,1.63);railing(.2,.35,2.28,4.2,1.26,1.5);sign(-.77,1,1.75);
    }
    if(type==='embercottage'){
      const roof=residential(0,.35,0,4.4,3.3);
      box(-1.8,1.34,-.9,.52,1.8,1.5,'dark');box(-1.8,roof+.15,-.9,.65,.16,1.62,'edge');
      equipment(.45,roof+.03,-.55);cylinder(-1.1,roof+.42,-.7,.36,.70);cylinder(-1.1,roof+.81,-.7,.4,.12,'dark');
      for(const dx of [-1.75,1.75])box(dx,roof+.005,.25,.07,.03,2.45,'orange');
      entry(.55,.35,1.72);railing(.55,.35,2.2,3.2,.9,1.3);planter(-1.05,.35,2.14,.65);
    }else if(type==='terracecommons'){
      const back=1.1,roof=residential(-.8,back+.35,-1.1,4.65,2.6,2),terrace=residential(.75,.35,1.7,5.3,2.55);
      railing(.75,terrace+.04,1.73,5.45,2.65);planter(-1.38,terrace+.03,2.4,1.25);planter(2.55,terrace+.03,2.4,1.1);
      box(.7,terrace+.18,1.52,1.5,.22,.72,'edge');box(.7,terrace+.34,1.52,1.25,.12,.64,'dark');
      equipment(-1.6,roof+.04,-1.1);cylinder(.3,roof+.5,-1.55,.48,.8,'steel');cylinder(.3,roof+.96,-1.55,.51,.13,'dark');
      for(const x of [-2.45,1.1])box(x,roof+.02,-1.05,.075,.035,2.2,'orange');
      const top=back+1.90,end=terrace+.04;box(2.61,top-.08,-.25,2.7,.16,.86,'edge');
      for(let i=0;i<8;i++){const rise=(top-end)/8;box(3.7,top-(i+.5)*rise,-.1+i*.27,.88,rise,.28,'edge');}
      beam([4.14,top+.6,-.1],[4.14,end+.6,1.9],.055);entry(.3,.35,3.01);box(-2.94,back+1.74,-1.1,.16,2.8,1.6,'orange');
    }else if(type==='hearthtower'){
      const roof=residential(0,.35,-.4,4.25,3.6,6);
      box(-2.12,4.69,-.83,.82,8.8,2.7,'dark');box(-2.46,4.69,.10,.13,8.8,.25,'orange');
      for(let f=0;f<6;f++){const y=.54+f*1.55;box(-2.5,y,-.83,.08,.14,2.65,'edge');box(0,y,1.54,4.5,.16,.35,'dark');}
      for(const dx of [-1.65,1.65]){
        box(dx,4.91,1.52,.17,9.32,.18,'edge');for(let f=0;f<6;f++)box(dx,.77+f*1.55,1.63,.18,.24,.06,'orange');
      }
      box(-.63,roof+.46,-.6,2.1,.86,2,'steel');box(-.63,roof+.92,-.6,2.26,.15,2.16,'edge');
      equipment(1.15,roof+.04,-.7);cylinder(-.62,roof+1.25,-.65,.5,.54,'dark');cylinder(-.62,roof+1.53,-.65,.57,.08,'edge');
      beam([-1.35,roof+.92,-1.2],[-1.35,roof+2.12,-1.2],.055);box(-1.35,roof+2.14,-1.2,.10,.10,.10,'warm');
      for(const x of [-1.84,1.84])box(x,roof+.025,-.4,.07,.035,3,'orange');
      entry(.2,.35,1.47);railing(.2,.35,2.13,4.2,1.26,1.5);planter(-1.32,.35,2.04,.8);
    }
    return meshes;
  }
  for(const type of variants){
    let geometry: Record<Material,number[]> | undefined,supports: Foot[] | undefined;
    const meshes: Record<string,()=>number[]> = {};
    const housing=type==='embercottage'||type==='terracecommons'||type==='hearthtower',
      materials: Material[] = housing ? ['steel','edge','dark','orange','cyan','warm','dim','soil','leaf']
        : ['steel','edge','dark','cyan','window',...(type==='researchspire'?[]:['glass' as const])];
    for(const material of materials)
      meshes[`civil${type[0].toUpperCase()+type.slice(1)}${material[0].toUpperCase()+material.slice(1)}`] = () => (geometry ??= assembly(type))[material];
    const render = ({part:p,nightPart,groundHeight,surfaceColor,pointLight}:EntityModelContext) => {
      const scale=CIVILIZATION_MODEL_SCALE,name=`civil${type[0].toUpperCase()+type.slice(1)}`;
      for(const material of materials){
        const glow=material==='cyan'?1.1:material==='window'?.65:material==='warm'?1:material==='dim'?.28:0;
        (glow?nightPart:p)(name+material[0].toUpperCase()+material.slice(1),0,0,0,scale,scale,scale,
          surfaceColor(colors[material]),0,0,0,glow,undefined,MAT.METAL);
      }
      for(const foot of (supports ??= (BUILDINGS[type] as BuildingDefinitionShape).civilizationDecks!.flatMap(d=>feet(d.x,d.z,d.w,d.d,d.top)))){
        const x=foot.x*scale,z=foot.z*scale,top=foot.top*scale,
          ground=groundHeight?.(x,z) ?? -.7,base=ground,height=Math.max(.03,top-base),
          dx=groundHeight ? (groundHeight(x+.275,z)-groundHeight(x-.275,z))/.55 : 0,
          dz=groundHeight ? (groundHeight(x,z+.275)-groundHeight(x,z-.275))/.55 : 0,
          pitch=-Math.atan(dz),roll=Math.atan(dx*Math.cos(pitch));
        p('box',x,base+.04,z,.55,.15,.55,surfaceColor(0x69706a),0,pitch,roll,0,undefined,MAT.METAL);
        p('box',x,base+height/2,z,.23,height,.25,surfaceColor(colors.edge),0,0,0,0,undefined,MAT.METAL);
        p('box',x,top-.06,z,.38,.17,.38,surfaceColor(colors.orange),0,0,0,0,undefined,MAT.METAL);
      }
      // Compact stairs span to the sampled terrain without flattening the hillside.
      const entry=(BUILDINGS[type] as BuildingDefinitionShape).civilizationEntry!,x=entry.x*scale,start=entry.z*scale,
        count=6,length=entry.length,
        end=groundHeight?.(x,start+length) ?? -.7,top=.35*scale,rise=(top-end)/count;
      for(let i=0;i<count;i++){
        const z=start+(i+.5)*length/count,y=top-(i+.5)*rise;
        p('box',x,y,z,1.05,Math.max(.025,Math.abs(rise)),length/count+.015,surfaceColor(colors.edge),0,0,0,0,undefined,MAT.METAL);
      }
      pointLight(0,1.1,2.6,8,housing?0xff882b:0x55d9e9,2.5);
      if(type==='hearthtower')pointLight(-.6,8.6,-.7,9,0xff882b,2.5);
      if(type==='researchspire')pointLight(-.5,10.6,-.7,9,0x55d9e9,2.5);
    };
    for(const faction of [0,1,2])registerEntityModel({id:`faction-${faction}/building/${type}`,meshes:faction===0?meshes:{},render});
  }
})();
