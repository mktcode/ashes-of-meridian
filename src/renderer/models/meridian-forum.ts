/* Shared Stage-4 Forum. Static approved hull; terrain-adaptive feet and three stair approaches. */
'use strict';
(() => {
  // Match the established civilian metal, warm residential glazing and cyan accents.
  const colors={steel:0x68797d,wall:0x68797d,edge:0xabb4b2,light:0xabb4b2,dark:0x23333e,roof:0x23333e,
    gold:0xb46a31,glass:0x235b68,warm:0xffdab0,dim:0x806e58,cyan:0x3fdcea,jade:0x235b68,leaf:0x385938,soil:0x384438};
  type Material=keyof typeof colors;
  const materials=Object.keys(colors) as Material[];
  function assembly():Record<Material,number[]> {
    const meshes:Record<Material,number[]>={steel:[],wall:[],edge:[],light:[],dark:[],roof:[],gold:[],glass:[],warm:[],dim:[],cyan:[],jade:[],leaf:[],soil:[]};
    const sub=(a:number[],b:number[])=>a.map((v,i)=>v-b[i]),cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=(a:number[])=>{const l=Math.hypot(...a);return a.map(v=>v/(l||1));},add=(a:number[],b:number[])=>a.map((v,i)=>v+b[i]),mul=(a:number[],s:number)=>a.map(v=>v*s);
    function tri(a:number[],b:number[],c:number[],m:Material){const point=(p:number[])=>p.map((v,i)=>(i===1?v-FORUM_DECK_BASE:v)*FORUM_MODEL_SCALE);geom.tri(meshes[m],point(a),point(b),point(c),[1,1,1]);}
    function quad(a:number[],b:number[],c:number[],d:number[],m:Material){tri(a,b,c,m);tri(a,c,d,m);}
    function box(x:number,y:number,z:number,w:number,h:number,d:number,m:Material='steel'){const p=(i:number,j:number,k:number)=>[x+i*w/2,y+j*h/2,z+k*d/2];quad(p(1,-1,-1),p(-1,-1,-1),p(-1,1,-1),p(1,1,-1),m);quad(p(-1,-1,1),p(1,-1,1),p(1,1,1),p(-1,1,1),m);quad(p(-1,-1,-1),p(-1,-1,1),p(-1,1,1),p(-1,1,-1),m);quad(p(1,-1,1),p(1,-1,-1),p(1,1,-1),p(1,1,1),m);quad(p(-1,1,-1),p(-1,1,1),p(1,1,1),p(1,1,-1),m);quad(p(-1,-1,-1),p(1,-1,-1),p(1,-1,1),p(-1,-1,1),m);}
    function beam(a:number[],b:number[],w:number,m:Material='edge'){const v=norm(sub(b,a)),u=norm(cross(v,Math.abs(v[1])>.9?[1,0,0]:[0,1,0])),t=cross(v,u),pts=(p:number[])=>[[1,1],[-1,1],[-1,-1],[1,-1]].map(([s,r])=>add(p,add(mul(u,s*w/2),mul(t,r*w/2))));const A=pts(a),B=pts(b);for(let i=0;i<4;i++)quad(A[i],A[(i+1)%4],B[(i+1)%4],B[i],m);quad(A[3],A[2],A[1],A[0],m);quad(B[0],B[1],B[2],B[3],m);}
    function octRing(x:number,y:number,z:number,w:number,d:number,cut:number){return [[-w/2+cut,-d/2],[w/2-cut,-d/2],[w/2,-d/2+cut],[w/2,d/2-cut],[w/2-cut,d/2],[-w/2+cut,d/2],[-w/2,d/2-cut],[-w/2,-d/2+cut]].map(([X,Z])=>[x+X,y,z+Z]);}
    function oct(x:number,y:number,z:number,w:number,h:number,d:number,cut:number=.38,m:Material='steel'){const A=octRing(x,y-h/2,z,w,d,cut),B=octRing(x,y+h/2,z,w,d,cut);for(let i=0;i<8;i++){const j=(i+1)%8;quad(A[j],A[i],B[i],B[j],m);tri([x,y+h/2,z],B[j],B[i],m);tri([x,y-h/2,z],A[i],A[j],m);}}
    function outline(x:number,y:number,z:number,w:number,d:number,cut:number,m:Material='gold',thick:number=.045){const p=octRing(x,y,z,w,d,cut);for(let i=0;i<8;i++)beam(p[i],p[(i+1)%8],thick,m);}
    function cylinder(x:number,y:number,z:number,r:number,h:number,m:Material='edge',n:number=16){for(let i=0;i<n;i++){const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n,p=(a:number,Y:number)=>[x+Math.sin(a)*r,Y,z+Math.cos(a)*r];quad(p(a,y-h/2),p(b,y-h/2),p(b,y+h/2),p(a,y+h/2),m);tri([x,y+h/2,z],p(a,y+h/2),p(b,y+h/2),m);tri([x,y-h/2,z],p(b,y-h/2),p(a,y-h/2),m);}}
    function roof(x:number,y:number,z:number,w:number,d:number){oct(x,y,z,w+.48,.25,d+.48,.52,'edge');oct(x,y+.18,z,w+.19,.15,d+.19,.43,'dark');oct(x,y+.28,z,w-.22,.10,d-.22,.34,'roof');outline(x,y+.37,z,w+.07,d+.07,.45);}
    function deck(x:number,y:number,z:number,w:number,d:number){oct(x,y-.12,z,w,.32,d,.60,'steel');oct(x,y+.08,z,w+.12,.10,d+.12,.65,'edge');outline(x,y+.15,z,w-.20,d-.20,.53,'dark',.035);}
    function rail(a:number[],b:number[],y:number){const n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/1.2));for(let i=0;i<=n;i++){const t=i/n,X=a[0]+(b[0]-a[0])*t,Z=a[1]+(b[1]-a[1])*t;beam([X,y,Z],[X,y+.72,Z],.045,'edge');}for(const h of [.33,.72])beam([a[0],y+h,a[1]],[b[0],y+h,b[1]],.045,'edge');}
    function planter(x:number,y:number,z:number,w:number,d:number=.6){oct(x,y+.20,z,w,.40,d,.12,'gold');box(x,y+.415,z,w-.13,.04,d-.12,'soil');for(let i=0;i<Math.ceil(w/.48);i++){const X=x-w/2+.24+i*(w-.48)/Math.max(1,Math.ceil(w/.48)-1);oct(X,y+.56,z,.44,.31,d-.11,.13,'leaf');}}
    function hvac(x:number,y:number,z:number,w:number=1.3){oct(x,y+.2,z,w,.4,.9,.10,'steel');box(x,y+.45,z,w+.10,.12,1,'edge');for(let i=0;i<7;i++)box(x-w*.4+i*w*.8/6,y+.52,z,.05,.035,.78,'dark');}
    function tank(x:number,y:number,z:number,r:number=.55){oct(x,y+.12,z,r*2.8,.24,r*2.8,.15,'dark');cylinder(x,y+.5,z,r,.74,'steel');cylinder(x,y+.91,z,r*1.08,.12,'dark');}
    function lamp(x:number,y:number,z:number){oct(x,y+.12,z,.42,.24,.42,.08,'steel');box(x,y+.45,z,.16,.46,.16,'dark');box(x,y+.68,z,.22,.15,.22,'warm');box(x,y+.80,z,.30,.09,.30,'gold');}
    function windows(x:number,y:number,z:number,w:number,d:number,floors:number,spacing:number=1.65){
      // The Forum's authored units are larger; panes and rhythm retain residential world dimensions.
      const pitch=1.02/FORUM_MODEL_SCALE,paneW=.62/FORUM_MODEL_SCALE,paneH=.70/FORUM_MODEL_SCALE,
        frameW=.80/FORUM_MODEL_SCALE,frameH=.88/FORUM_MODEL_SCALE,mullion=.035/FORUM_MODEL_SCALE;
      for(let f=0;f<floors;f++){
        const Y=y+f*spacing;oct(x,Y+.13,z,w+.09,.20,d+.09,.42,'dark');
        for(const s of [-1,1]){
          const n=Math.max(1,Math.floor((w-.9)/pitch));
          for(let j=0;j<n;j++){
            const X=x+(j-(n-1)/2)*pitch,Z=z+s*(d/2+.094);
            box(X,Y+.90,z+s*(d/2+.028),frameW,frameH,.11,'dark');
            box(X,Y+.90,Z,paneW,paneH,.035,(j+f)%5===2?'dim':'warm');
            box(X,Y+.90,Z+s*.025,mullion,paneH,.032,'dark');
            box(X,Y+.275,z+s*(d/2+.13),.85/FORUM_MODEL_SCALE,.075,.14,'edge');
          }
          const side=Math.max(1,Math.floor((d-.9)/pitch));
          for(let j=0;j<side;j++){
            const Z=z+(j-(side-1)/2)*pitch,X=x+s*(w/2+.094);
            box(x+s*(w/2+.028),Y+.90,Z,.11,frameH,frameW,'dark');
            box(X,Y+.90,Z,.035,paneH,paneW,(j+f)%4===1?'dim':'warm');
            box(X+s*.025,Y+.90,Z,.032,paneH,mullion,'dark');
            box(x+s*(w/2+.13),Y+.275,Z,.14,.075,.85/FORUM_MODEL_SCALE,'edge');
          }
        }
        oct(x,Y+spacing-.05,z,w+.19,.12,d+.19,.47,'edge');
      }
    }
    function pilasters(x:number,y:number,z:number,w:number,d:number,h:number){for(const s of [-1,1]){
      for(const X of [x-w/2+.24,x+w/2-.24]){box(X,y+h/2,z+s*(d/2-.05),.38,h,.30,'steel');box(X,y+h/2,z+s*(d/2+.115),.095,h-.22,.06,'gold');}
      for(const Z of [z-d/2+.24,z+d/2-.24])box(x+s*(w/2-.04),y+h/2,Z,.3,h,.38,'steel');
      }}
    // One full-width, connected plinth; matching platform/stilt vocabulary from the reference.
    deck(0,1.58,0,29,20);deck(0,1.9,-.65,27.7,18.5);
    // A continuous civic podium joins every tier; no free-standing side buildings.
    oct(0,3.05,-1.25,25.5,2.25,15.0,.70,'wall');
    for(const z of [-7,5.2])for(const x of [-11.8,-6.5,0,6.5,11.8]){box(x,3,z,.48,2.2,.55,'steel');box(x,2.4,z,.8,.30,.75,'edge');}
    // Main tower: cathedral-like tall atrium and stacked occupied floors above it.
    const tx=0,tz=-3.65,tw=8.8,td=7.3;
    oct(tx,16.15,tz,tw,27.7,td,.55,'wall');
    pilasters(tx,2.3,tz,tw,td,27.7);
    // A tall central glazing axis, with warm vertical ribs, teal glass and fine transoms.
    box(0,19.95,.065,5.0,17.5,.23,'dark');box(0,19.95,.205,4.35,17.15,.045,'glass');
    for(const x of [-2.4,-1.55,0,1.55,2.4]){box(x,19.95,.27,x===0?.13:.22,17.5,.15,'light');box(x+.09,19.95,.37,.035,17.25,.045,'warm');}
    for(let f=0;f<11;f++)box(0,11.5+f*1.6,.31,4.45,.075,.11,'dark');
    // Embedded jade motifs behind the main glass axis, not detached spires.
    for(const y of [15,20.5,26]){const p=[[0,y+1.4,.36],[-.53,y,.36],[0,y-1.4,.36],[.53,y,.36]];quad(p[0],p[1],p[2],p[3],'jade');beam(p[0],p[2],.045,'cyan');}
    // Rear and side tower walls have narrower occupied windows and service recesses.
    for(const s of [-1,1]){
      for(let f=0;f<12;f++){const Y=6.5+f*1.8;for(const z of [-5.55,-3.65,-1.75]){
        box(s*4.47,Y,z,.10,1.45,1.30,'dark');box(s*4.53,Y,z,.04,1.16,1.03,(f+Math.round(z))%5===0?'dim':'warm');
        box(s*4.56,Y,z,.03,1.16,.058,'dark');
      }}
      box(s*3.55,18.5,-7.43,.65,24,.28,'steel');box(s*3.55,18.5,-7.60,.13,23.8,.075,'gold');
    }
    for(let f=0;f<12;f++)for(const x of [-2.4,-.8,.8,2.4]){
      box(x,7.0+f*1.8,-7.37,1.30,1.45,.10,'dark');box(x,7.0+f*1.8,-7.44,1.03,1.16,.035,'warm');
      box(x,7.0+f*1.8,-7.47,.058,1.16,.032,'dark');
    }
    roof(0,30.05,tz,tw,td);
    // Three prominent warm-windowed penthouse floors crown the central mass, as in the image.
    oct(0,32.77,tz,8.25,5.0,6.8,.5,'steel');windows(0,30.3,tz,8.25,6.8,3);pilasters(0,30.3,tz,8.25,6.8,4.95);roof(0,35.39,tz,8.25,6.8);
    // Unobstructed shuttle landing pad on the highest roof; all markings are flush.
    const padY=35.98;
    oct(0,35.84,tz,7.45,.20,5.95,.65,'steel');oct(0,35.95,tz,7.12,.04,5.62,.56,'roof');
    outline(0,padY,tz,6.90,5.40,.60,'light',.07);
    // Segmented landing target and stylized spacecraft/approach glyph (not a helicopter H).
    for(let i=0;i<32;i++)if(i%8<6){const a=i*Math.PI/16,b=(i+.8)*Math.PI/16;beam([Math.sin(a)*1.78,padY,tz+Math.cos(a)*1.78],[Math.sin(b)*1.78,padY,tz+Math.cos(b)*1.78],.065,'gold');}
    quad([0,padY+.018,tz-1.12],[-.76,padY+.018,tz+.92],[0,padY+.018,tz+.45],[.76,padY+.018,tz+.92],'light');
    for(const s of [-1,1]){
      box(s*1.1,padY+.018,tz+.46,.10,.025,.72,'light');
      for(const z of [tz-2.48,tz+2.48]){
        oct(s*3.30,36.01,z,.36,.16,.36,.065,'dark');box(s*3.30,36.13,z,.23,.10,.23,'cyan');
      }
      for(let j=0;j<3;j++)box(s*(2.54+j*.22),padY+.015,tz,.09,.025,.72,'gold');
    }
    // Nested setbacks on either side. Tiers overlap physically and share their inner walls.
    const tiers=[{x:6.65,z:-3.35,w:5.0,d:7.8,top:24.0},{x:8.15,z:.0,w:5.1,d:7.9,top:18.9},{x:9.65,z:3.0,w:5.0,d:7.8,top:12.8}];
    for(const s of [-1,1])for(let k=0;k<tiers.length;k++){
      const T=tiers[k],x=s*T.x,z=T.z,y=4.05,top=T.top;
      oct(x,(y+top)/2,z,T.w,top-y,T.d,.45,'wall');pilasters(x,y,z,T.w,T.d,top-y);
      // Upper pair of bright floors and broad balcony deck at each setback.
      windows(x,top-3.4,z,T.w,T.d,2);roof(x,top,z,T.w,T.d);
      deck(x,top-3.65,z+.22,T.w+.88,T.d+.85);
      // Tall lower facade with central turquoise inset; bronze border rather than ring machinery.
      const fy=z+T.d/2+.1,H=Math.max(3.4,top-8.0);
      box(x,4.2+H/2,fy,2.50,H,.20,'dark');box(x,4.2+H/2,fy+.13,1.42,H-.42,.035,'glass');
      for(const dx of [-1.05,1.05]){box(x+dx,4.2+H/2,fy+.16,.24,H+.15,.23,'light');box(x+dx*.79,4.2+H/2,fy+.28,.05,H-.25,.04,'gold');}
      box(x,4.2+H/2,fy+.22,.19,H-.8,.04,'cyan');
      // Slender service strips break up large walls without turning the volume into separate towers.
      for(let f=0;f<Math.floor((top-7)/1.9);f++)for(const Z of [z-2.5,z,z+2.5]){
        box(x+s*(T.w/2+.06),5.2+f*1.9,Z,.1,1.45,1.30,'dark');box(x+s*(T.w/2+.12),5.2+f*1.9,Z,.03,1.16,1.03,'warm');
        box(x+s*(T.w/2+.15),5.2+f*1.9,Z,.03,1.16,.058,'dark');
      }
      // Occupied roof terraces: stepped planted strips and exposed maintenance details.
      planter(x,top+.40,z+T.d/2-.60,T.w-1.35);planter(x+s*(T.w/2-.48),top+.40,z-.8,.58,2.0);
      rail([x-T.w/2-.15,z+T.d/2+.14],[x+T.w/2+.15,z+T.d/2+.14],top+.42);
      rail([x+s*(T.w/2+.14),z-.9],[x+s*(T.w/2+.14),z+T.d/2+.14],top+.42);
      hvac(x-s*.75,top+.40,z-2.15,1.0);tank(x+s*.6,top+.40,z-2.05,.37);
      for(const dx of [-T.w/2+.38,T.w/2-.38])lamp(x+dx,top+.41,z+T.d/2-.3);
      // Diagonal terrace support brackets and inset under-balcony vents.
      for(const dx of [-1.45,1.45])beam([x+dx,top-4.8,z+T.d/2-.1],[x+dx,top-3.75,z+T.d/2+.44],.15,'steel');
    }
    // Grand front portico integrated into the central tower's foot.
    const hz=3.05,hw=8.0,hd=5.9;
    oct(0,7.10,hz,hw,9.8,hd,.45,'wall');
    box(0,6.85,6.07,6.35,8.15,.20,'dark');box(0,6.85,6.21,5.85,7.65,.045,'glass');
    for(const x of [-3.05,-1.78,1.78,3.05]){
      oct(x,6.85,6.40,.47,8.45,.50,.08,'light');box(x-.13,6.85,6.70,.075,8.1,.04,'gold');
      oct(x,2.75,6.4,.7,.34,.7,.10,'edge');oct(x,11.0,6.4,.75,.35,.75,.11,'edge');
      box(x+.17,6.85,6.67,.035,7.9,.035,'warm');
    }
    box(0,10.75,6.40,7.35,.60,.66,'steel');box(0,10.47,6.79,6.8,.07,.04,'gold');
    roof(0,12.13,hz,hw,hd);deck(0,12.52,hz+.2,8.65,6.30);
    planter(-2.65,12.65,4.90,1.90);planter(2.65,12.65,4.90,1.90);planter(0,12.65,1.20,3.15);
    rail([-4.0,5.80],[4.0,5.80],12.66);rail([-4.0,2.3],[-4.0,5.80],12.66);rail([4.0,2.3],[4.0,5.80],12.66);
    // Recessed double entry doors behind the illuminated sculpture court.
    box(0,4.06,6.28,2.9,3.3,.18,'steel');box(0,4.02,6.40,2.42,2.97,.03,'glass');box(0,4.02,6.45,.075,2.97,.045,'gold');
    // Shallow reflecting basin and faceted cyan civic sculpture from the reference.
    oct(0,2.35,7.3,6.55,.32,2.65,.40,'edge');oct(0,2.55,7.3,5.98,.07,2.13,.31,'glass');outline(0,2.62,7.3,6.05,2.19,.34,'gold',.035);
    cylinder(0,2.73,7.32,.66,.24,'steel',24);cylinder(0,2.89,7.32,.50,.12,'gold',24);
    function crystal(x:number,y:number,z:number,w:number,h:number,d:number){const ring=[[-w/2,y+h*.32,z],[0,y+h*.24,z+d/2],[w/2,y+h*.38,z],[0,y+h*.28,z-d/2]],ring2=ring.map(p=>[x+(p[0])* .77,y+h*.72,z+(p[2]-z)*.80]),tip=[x,y+h,z],base=[x,y,z];for(let i=0;i<4;i++){const j=(i+1)%4;tri(base,ring[j].map((v,k)=>k===0?v+x:v),ring[i].map((v,k)=>k===0?v+x:v),'jade');quad(ring[i].map((v,k)=>k===0?v+x:v),ring[j].map((v,k)=>k===0?v+x:v),ring2[j],ring2[i],i%2?'cyan':'jade');tri(ring2[i],ring2[j],tip,'cyan');}}
    crystal(0,3.0,7.32,.73,5.65,.54);
    // Connected forecourt, broad ceremonial stair and smaller side approaches.
    deck(0,2.12,7.08,12.8,5.2);
    for(const s of [-1,1]){deck(s*10.0,1.9,7.4,5.8,4.8);for(const x of [s*6.1,s*13.0]){lamp(x,2.02,9.25);planter(x,2.02,7.9,.60,1.25);}}
    for(const x of [-5.7,5.7]){lamp(x,2.26,9.05);lamp(x,2.26,5.3);}
    // Ornamental sloped facade reveals, modest bronze Art-Deco accents.
    for(const s of [-1,1]){
      beam([s*4.45,4.0,1.3],[s*4.45,12.3,.8],.25,'gold');beam([s*4.45,12.3,.8],[s*4.45,27.8,-.02],.18,'steel');
      for(let i=0;i<5;i++)box(s*3.58,14.6+i*2.4,.07,.38,.38,.14,'edge');
    }
    // Rear service access stays below the unobstructed roof landing area.
    box(0,3.6,-8.87,4.3,2.5,.15,'dark');for(const x of [-1.65,0,1.65]){box(x,3.6,-8.99,1.3,2.1,.13,'steel');box(x+.38,3.6,-9.08,.08,.6,.05,'gold');}

    return meshes;
  }
  let geometry:Record<Material,number[]>|undefined;
  const meshes:Record<string,()=>number[]>={};
  const name=(m:Material)=>'meridianForum'+m[0].toUpperCase()+m.slice(1);
  for(const m of materials)meshes[name(m)]=()=>(geometry??=assembly())[m];
  const render=({part:p,nightPart,groundHeight,surfaceColor,pointLight}:EntityModelContext)=>{
    const scale=CIVILIZATION_MODEL_SCALE,authoredScale=FORUM_MODEL_SCALE*scale;
    for(const m of materials){
      const glow=m==='cyan'?1.1:m==='warm'?1:m==='dim'?.28:0;
      (glow?nightPart:p)(name(m),0,0,0,scale,scale,scale,surfaceColor(colors[m]),0,0,0,glow,undefined,MAT.METAL);
    }
    // Hull meshes never change with terrain, faction, construction or preview pose.
    for(const X of [-12,-6,0,6,12])for(const Z of [-7.5,0,7.5]){
      const x=X*authoredScale,z=Z*authoredScale,base=groundHeight?.(x,z)??-.7,height=Math.max(.03,-base),
        dx=groundHeight?(groundHeight(x+.275,z)-groundHeight(x-.275,z))/.55:0,
        dz=groundHeight?(groundHeight(x,z+.275)-groundHeight(x,z-.275))/.55:0,
        pitch=-Math.atan(dz),roll=Math.atan(dx*Math.cos(pitch));
      p('box',x,base+.04,z,.55,.15,.55,surfaceColor(colors.edge),0,pitch,roll,0,undefined,MAT.METAL);
      p('box',x,base+height/2,z,.23,height,.25,surfaceColor(colors.steel),0,0,0,0,undefined,MAT.METAL);
      p('box',x,-.06,z,.38,.17,.38,surfaceColor(colors.gold),0,0,0,0,undefined,MAT.METAL);
    }
    const drawRail=(a:number[],b:number[])=>{
      const delta=V.sub(b,a),length=Math.hypot(...delta),mid=a.map((v,i)=>(v+b[i])/2),
        yaw=Math.atan2(delta[0],delta[2]),pitch=-Math.atan2(delta[1],Math.hypot(delta[0],delta[2]));
      p('box',mid[0],mid[1],mid[2],.055,.055,length,surfaceColor(colors.gold),yaw,pitch,0,0,undefined,MAT.METAL);
    };
    for(const [i,entry] of civilizationBuildingEntries('meridianforum').entries()){
      const x=entry.x*scale,start=entry.z*scale,top=(entry.top??.35)*scale,
        width=entry.width??1.05,length=entry.length,count=i===0?10:9,
        end=groundHeight?.(x,start+length)??-.7,rise=(top-end)/count;
      for(let j=0;j<count;j++){
        const z=start+(j+.5)*length/count,y=top-(j+.5)*rise;
        p('box',x,y,z,width,Math.max(.025,Math.abs(rise)),length/count+.015,surfaceColor(colors.edge),0,0,0,0,undefined,MAT.METAL);
      }
      // Low edge rails follow the same terrain-adaptive flight, leaving the pad unobstructed.
      for(const side of [-1,1]){
        const X=x+side*(width/2-.035),a=[X,top+.34,start],b=[X,end+.34,start+length];
        drawRail(a,b);
        for(const t of [0,.5,1]){
          const z=start+t*length,y=top+(end-top)*t;
          p('box',X,y+.17,z,.04,.34,.04,surfaceColor(colors.edge),0,0,0,0,undefined,MAT.METAL);
        }
      }
    }
    pointLight(0,(5-FORUM_DECK_BASE)*authoredScale,7.4*authoredScale,5,colors.cyan,2.1);
    pointLight(0,(32.5-FORUM_DECK_BASE)*authoredScale,-3.65*authoredScale,6,colors.warm,1.5);
    pointLight(0,(36.13-FORUM_DECK_BASE)*authoredScale,-3.65*authoredScale,4,colors.cyan,1.1);
  };
  for(const faction of [0,1,2])registerEntityModel({id:`faction-${faction}/building/meridianforum`,meshes:faction===0?meshes:{},render});

})();
