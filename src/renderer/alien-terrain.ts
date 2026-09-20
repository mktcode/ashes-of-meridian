/* Alien-only baked terrain meshes. No frame work, renderer state or simulation RNG. */
'use strict';
(() => {
  const bark = [.25,.31,.34], root = [.27,.19,.29], jade = [.39,.58,.52], plum = [.56,.33,.51],
    rim = [.69,.55,.68], light = [.62,.91,.79];
  const ring = (x: number,y: number,z: number,r: number,n: number,phase=0) => Array.from({length:n},(_,i)=> {
    const a=i*Math.PI*2/n+phase; return [x+Math.cos(a)*r,y,z+Math.sin(a)*r];
  });
  function skin(out: number[], rings: number[][][], colors: number[][]) {
    const n=rings[0].length, start=out.length;
    for(let j=0;j<rings.length-1;j++) for(let i=0;i<n;i++) {
      const k=(i+1)%n, c=colors[j%colors.length].map(v=>v*(i%3===0?1.08:.96));
      geom.tri(out,rings[j][i],rings[j+1][k],rings[j][k],c);
      geom.tri(out,rings[j][i],rings[j+1][i],rings[j+1][k],c);
    }
    for(const [j,up] of [[0,false],[rings.length-1,true]] as const) {
      const c=rings[j].reduce((a,p)=>a.map((v,k)=>v+p[k]/n),[0,0,0]);
      for(let i=0;i<n;i++) {
        const a=rings[j][i],b=rings[j][(i+1)%n];
        geom.tri(out,c,up?b:a,up?a:b,colors[j%colors.length]);
      }
    }
    // Soft organic surfaces, without smoothing the separate double-sided fern blades.
    const normals=new Map<string, number[]>();
    for(let i=start;i<out.length;i+=9) {
      const key=out.slice(i,i+3).map(v=>v.toFixed(5)).join(','), sum=normals.get(key)||[0,0,0];
      for(let k=0;k<3;k++)sum[k]+=out[i+3+k];normals.set(key,sum);
    }
    for(let i=start;i<out.length;i+=9) {
      const sum=normals.get(out.slice(i,i+3).map(v=>v.toFixed(5)).join(',')),normal=V.norm(sum!);
      for(let k=0;k<3;k++)out[i+3+k]=normal[k];
    }
  }
  function tube(out: number[], points: number[][], color: number[], n=7) {
    skin(out,points.map(([x,y,z,r])=>ring(x,y,z,r,n)),[color]);
  }
  function mushroom(out: number[],x: number,z: number,h: number,r: number,phase: number,variant=0) {
    const dx=Math.cos(phase)*h*.13,dz=Math.sin(phase)*h*.13;
    tube(out,[[x,.15,z,r*.25],[x-dx*.2,h*.3,z-dz*.2,r*.14],
      [x+dx*.5,h*.68,z+dz*.5,r*.13],[x+dx,h*.85,z+dz,r*.22]],bark);
    const colors=variant%3===0?[bark,jade,light,jade,jade,bark]:[root,plum,rim,plum,plum,root];
    const profiles=[[.77,.22],[.8,.82],[.85,1.06],[.89,1.08],[.96,.91],[1.04,.55],[1.08,.055]];
    skin(out,profiles.map(([y,s])=>Array.from({length:16},(_,i)=>{
      const a=i*Math.PI/8+phase, wave=1+.075*Math.sin(a*5+phase);
      return [x+dx+Math.cos(a)*r*s*wave,h*(y+Math.sin(a*5+phase)*.012*s),z+dz+Math.sin(a)*r*s*wave];
    })),colors);
    // Buttress roots make the base look anchored rather than balanced on a stick.
    for(let i=0;i<3;i++) {
      const a=phase+i*Math.PI*2/3,rx=Math.cos(a)*r,rz=Math.sin(a)*r;
      tube(out,[[x+rx,.04,z+rz,.06],[x+rx*.45,.4,z+rz*.45,r*.12],[x,h*.24,z,r*.12]],root,5);
    }
  }
  function fern(out: number[],x=0,z=0,scale=1,phase=0) {
    // Arched, faceted fronds replace the old four-triangle fans while retaining their footprint.
    for(let i=0;i<7;i++) {
      const a=phase+i*Math.PI*2/7,l=scale*(.88+(i%3)*.2),dx=Math.cos(a),dz=Math.sin(a),
        side=i%2 ? .07 : -.055, ts=[.035,.34,.7,1], widths=[.035,.18,.245,.025],
        heights=[.08,.54,.76,.49], left: number[][]=[],right: number[][]=[];
      for(let j=0;j<ts.length;j++) {
        const t=ts[j],bend=side*Math.sin(t*Math.PI)*l,cx=x+dx*l*t+dz*bend,cz=z+dz*l*t-dx*bend,
          w=widths[j]*l*(j===2&&i%2 ? .88 : 1);
        left.push([cx+dz*w,heights[j]*l,cz-dx*w]);
        right.push([cx-dz*w,heights[j]*l,cz+dx*w]);
      }
      for(let j=0;j<3;j++) {
        const ca=(j===0?jade:j===1?bark:plum),cb=(j===0?bark:j===1?jade:rim),
          p=left[j],q=left[j+1],r=right[j+1],s=right[j];
        geom.tri(out,p,q,r,ca);geom.tri(out,p,r,s,cb);
        geom.tri(out,r,q,p,ca.map(v=>v*.62));geom.tri(out,s,r,p,cb.map(v=>v*.62));
      }
    }
    // Pale curled shoots and a plum heart keep the center from reading as a flat pinwheel.
    for(let i=0;i<3;i++) {
      const a=phase+.45+i*Math.PI*2/3,l=scale*(.28+i*.035),
        p=[x+Math.sin(a)*l*.13,.08,z-Math.cos(a)*l*.13],
        q=[x-Math.sin(a)*l*.13,.08,z+Math.cos(a)*l*.13],
        r=[x+Math.cos(a)*l,.62*l,z+Math.sin(a)*l];
      geom.tri(out,p,r,q,light);geom.tri(out,q,r,p,rim.map(v=>v*.7));
    }
    const base=ring(x,.08,z,scale*.11,4,phase+Math.PI/4),top=[x,.28*scale,z];
    for(let i=0;i<4;i++) {
      const k=(i+1)%4;geom.tri(out,base[i],base[k],top,plum);geom.tri(out,[x,.06,z],base[k],base[i],root);
    }
  }
  function spore(out: number[],x: number,z: number,h: number,r: number) {
    tube(out,[[x,0,z,r*.22],[x+r*.3,h*.7,z,r*.15],[x,h,z,r*.4]],jade,5);
    skin(out,[[h*.74,r*.5],[h,r],[h*1.25,r*.15]].map(([y,s])=>ring(x,y,z,s,7)),[jade,light,plum]);
  }
  function glowPearl(out: number[],x: number,y: number,z: number,r: number,color: number[]) {
    const n=8,upper=ring(x,y+r*.58,z,r*.72,n,Math.PI/8),equator=ring(x,y,z,r,n,Math.PI/8),
      lower=ring(x,y-r*.58,z,r*.72,n,Math.PI/8),top=[x,y+r*1.08,z],bottom=[x,y-r*1.08,z];
    for(let i=0;i<n;i++) {
      const k=(i+1)%n;
      geom.tri(out,top,upper[k],upper[i],color);
      geom.tri(out,upper[i],upper[k],equator[k],color);geom.tri(out,upper[i],equator[k],equator[i],color);
      geom.tri(out,equator[i],equator[k],lower[k],color.map(v=>v*.88));geom.tri(out,equator[i],lower[k],lower[i],color.map(v=>v*.88));
      geom.tri(out,bottom,lower[i],lower[k],color.map(v=>v*.66));
    }
  }
  function capGills(out: number[],h: number,r: number,phase: number,variant: number) {
    const dx=Math.cos(phase)*h*.13,dz=Math.sin(phase)*h*.13,n=20,
      under=variant%2?[.48,.2,.47]:[.25,.56,.5],
      underside=[ring(dx,h*.756,dz,r*.15,n,phase),ring(dx,h*.776,dz,r*.46,n,phase),
        ring(dx,h*.797,dz,r*.79,n,phase)];
    // A broad emissive underside turns the cap itself into a lantern, not only its ornaments.
    for(let i=0;i<n;i++) {
      const k=(i+1)%n;
      geom.tri(out,[dx,h*.752,dz],underside[0][i],underside[0][k],under);
      for(let j=0;j<underside.length-1;j++) {
        geom.tri(out,underside[j][i],underside[j+1][k],underside[j][k],under);
        geom.tri(out,underside[j][i],underside[j+1][i],underside[j+1][k],under);
      }
    }
    // Brighter radial lamellae remain visible across the softly glowing underside.
    for(let i=0;i<12;i++) {
      const a=phase+i*Math.PI/6+.08,side=.014*r,inner=.18*r,outer=.78*r,
        p=[dx+Math.cos(a)*inner,h*.759,dz+Math.sin(a)*inner],
        q=[dx+Math.cos(a)*outer+Math.sin(a)*side,h*.799,dz+Math.sin(a)*outer-Math.cos(a)*side],
        s=[dx+Math.cos(a)*outer-Math.sin(a)*side,h*.799,dz+Math.sin(a)*outer+Math.cos(a)*side],
        color=(i+variant)%3===0?plum:light;
      geom.tri(out,p,q,s,color);geom.tri(out,s,q,p,color.map(v=>v*.78));
    }
    // A dense curtain of straight, hair-fine threads carries dew-like pearls at varied intervals.
    for(let i=0;i<12;i++) {
      const a=phase+.12+i*Math.PI/6,reach=r*(.48+(i%4)*.1),x=dx+Math.cos(a)*reach,
        z=dz+Math.sin(a)*reach,top=h*.798,drop=h*(.16+(i%5)*.033),
        color=(i+variant)%3===0?plum:light;
      tube(out,[[x,top,z,.0055],[x,top-drop,z,.0035]],color,6);
      const pearls=3+i%2;
      for(let j=0;j<pearls;j++) {
        const t=(j+1)/(pearls+1),size=.011+((i+j)%3)*.0045;
        glowPearl(out,x,top-drop*t,z,size,(i+j+variant)%4===0?(color===light?plum:light):color);
      }
    }
  }
  function lanternPool() {
    const out: number[]=[],n=32,radii=[0,.28,.58,1],colors=[[.42,1,.82],[.3,.72,.65],[.15,.34,.38],[0,0,0]],
      point=(radius: number,i: number)=>[Math.cos(i*Math.PI*2/n)*radius,.015,Math.sin(i*Math.PI*2/n)*radius],
      vertex=(p: number[],c: number[])=>out.push(...p,0,1,0,...c),
      face=(a: number[],b: number[],c: number[],ca: number[],cb: number[],cc: number[])=>{
        vertex(a,ca);vertex(b,cb);vertex(c,cc);
      };
    for(let i=0;i<n;i++) {
      const k=(i+1)%n;
      face(point(0,0),point(radii[1],k),point(radii[1],i),colors[0],colors[1],colors[1]);
      for(let j=1;j<radii.length-1;j++) {
        const a=point(radii[j],i),b=point(radii[j],k),c=point(radii[j+1],k),d=point(radii[j+1],i);
        face(a,c,b,colors[j],colors[j+1],colors[j]);face(a,d,c,colors[j],colors[j+1],colors[j+1]);
      }
    }
    return out;
  }
  function glowTuft(out: number[]) {
    // Low, bright leaves and pearl buds read as a fluorescent carpet around mature trees.
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3+.2,l=.36+(i%2)*.12,w=.085,
        base=[Math.cos(a)*.06,.02,Math.sin(a)*.06],tip=[Math.cos(a)*l,.12+(i%3)*.055,Math.sin(a)*l],
        left=[base[0]+Math.sin(a)*w,base[1],base[2]-Math.cos(a)*w],
        right=[base[0]-Math.sin(a)*w,base[1],base[2]+Math.cos(a)*w],c=i%2?light:plum;
      geom.tri(out,left,tip,right,c);geom.tri(out,right,tip,left,c.map(v=>v*.68));
    }
    glowPearl(out,0,.22,0,.075,light);
    glowPearl(out,.18,.14,-.08,.045,plum);
  }
  function bed(out: number[],m: Pick<WorldTerrainFeature, "x" | "z" | "outline">,height=.55) {
    const n=m.outline.length, rows=[];
    for(let j=0;j<5;j++)rows.push(m.outline.map((p,i)=>{
      const t=1-j*.2;
      return [m.x+(p.x-m.x)*t,j===0?-.08:height*(1-t)+Math.sin(i*2.1+j)*height*.15,m.z+(p.z-m.z)*t];
    }));
    for(let j=0;j<4;j++)for(let i=0;i<n;i++){
      const k=(i+1)%n,c=root.map(v=>v*(.93+.035*Math.sin(i*4+j)));
      geom.tri(out,rows[j][i],rows[j+1][i],rows[j+1][k],c);
      geom.tri(out,rows[j][i],rows[j+1][k],rows[j][k],c);
    }
    for(let i=0;i<n;i++)geom.tri(out,[m.x,height,m.z],rows[4][(i+1)%n],rows[4][i],root);
  }
  // Reusable single plants. The recipe controls age, canopy mix and placement, not a grove mesh.
  TerrainModels.alienTreePlum=()=>{const out: number[]=[];mushroom(out,0,0,3.4,1,.8,1);return out;};
  TerrainModels.alienTreeJade=()=>{const out: number[]=[];mushroom(out,0,0,3.7,.95,2.1,0);return out;};
  TerrainModels.alienTreeUmbrella=()=>{const out: number[]=[];mushroom(out,0,0,2.6,1.24,4.3,2);return out;};
  TerrainModels.alienFern=()=>{const out: number[]=[];fern(out);return out;};
  TerrainModels.alienSpore=()=>{
    const out: number[]=[];spore(out,0,0,.85,.25);spore(out,.4,.25,.5,.19);spore(out,-.3,.15,.65,.22);return out;
  };
  TerrainModels.alienGlowTuft=()=>{const out: number[]=[];glowTuft(out);return out;};
  TerrainModels.alienLanternPool=()=>lanternPool();
  TerrainModels.alienCapGillsPlum=()=>{const out: number[]=[];capGills(out,3.4,1,.8,1);return out;};
  TerrainModels.alienCapGillsJade=()=>{const out: number[]=[];capGills(out,3.7,.95,2.1,0);return out;};
  TerrainModels.alienCapGillsUmbrella=()=>{const out: number[]=[];capGills(out,2.6,1.24,4.3,2);return out;};
  TerrainModels.alienSapling=()=>{const out: number[]=[];mushroom(out,0,0,2.4,.8,.4,0);return out;};
  TerrainModels.alienPod=(seed: number)=>{
    const out: number[]=[],rand=seeded(seed ^ 0x504f4453);
    const m={x:0,z:0,outline:Array.from({length:16},(_,i)=>({x:Math.cos(i*Math.PI/8)*.95,z:Math.sin(i*Math.PI/8)*.95}))};
    bed(out,m,.18);
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2,r=.32;
      mushroom(out,Math.cos(a)*r,Math.sin(a)*r,1.1+rand()*.7,.35+rand()*.1,a,i);
    }
    return out;
  };
  TerrainModels.alienForestFloor=(seed,extent)=>{
    const out: number[]=[],far=extent+100;
    // Coplanar continuation of the playable soil, without banks, stripes or raised mats.
    for(const [x0,x1,z0,z1] of [[-far,-extent,-far,far],[extent,far,-far,far],
      [-extent,extent,-far,-extent],[-extent,extent,extent,far]]) {
      const a=[x0,-.13,z0],b=[x0,-.13,z1],c=[x1,-.13,z1],d=[x1,-.13,z0];
      geom.tri(out,a,b,c,[1,1,1]);geom.tri(out,a,c,d,[1,1,1]);
    }
    return out;
  };
})();
