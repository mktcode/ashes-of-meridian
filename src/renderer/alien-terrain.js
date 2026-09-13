/* Alien-only baked terrain meshes. No frame work, renderer state or simulation RNG. */
'use strict';
(() => {
  const bark = [.25,.31,.34], root = [.27,.19,.29], jade = [.39,.58,.52], plum = [.56,.33,.51],
    rim = [.69,.55,.68], light = [.62,.91,.79];
  const mix = (a,b,t) => a.map((v,i)=>v*(1-t)+b[i]*t);
  const ring = (x,y,z,r,n,phase=0) => Array.from({length:n},(_,i)=> {
    const a=i*Math.PI*2/n+phase; return [x+Math.cos(a)*r,y,z+Math.sin(a)*r];
  });
  function skin(out, rings, colors) {
    const n=rings[0].length, start=out.length;
    for(let j=0;j<rings.length-1;j++) for(let i=0;i<n;i++) {
      const k=(i+1)%n, c=colors[j%colors.length].map(v=>v*(i%3===0?1.08:.96));
      geom.tri(out,rings[j][i],rings[j+1][k],rings[j][k],c);
      geom.tri(out,rings[j][i],rings[j+1][i],rings[j+1][k],c);
    }
    for(const [j,up] of [[0,false],[rings.length-1,true]]) {
      const c=rings[j].reduce((a,p)=>a.map((v,k)=>v+p[k]/n),[0,0,0]);
      for(let i=0;i<n;i++) {
        const a=rings[j][i],b=rings[j][(i+1)%n];
        geom.tri(out,c,up?b:a,up?a:b,colors[j%colors.length]);
      }
    }
    // Soft organic surfaces, without smoothing the separate double-sided fern blades.
    const normals=new Map();
    for(let i=start;i<out.length;i+=9) {
      const key=out.slice(i,i+3).map(v=>v.toFixed(5)).join(','), sum=normals.get(key)||[0,0,0];
      for(let k=0;k<3;k++)sum[k]+=out[i+3+k];normals.set(key,sum);
    }
    for(let i=start;i<out.length;i+=9) {
      const sum=normals.get(out.slice(i,i+3).map(v=>v.toFixed(5)).join(',')),normal=V.norm(sum);
      for(let k=0;k<3;k++)out[i+3+k]=normal[k];
    }
  }
  function tube(out, points, color, n=7) {
    skin(out,points.map(([x,y,z,r])=>ring(x,y,z,r,n)),[color]);
  }
  function mushroom(out,x,z,h,r,phase,variant=0) {
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
  function fern(out,x=0,z=0,scale=1,phase=0) {
    for(let i=0;i<7;i++) {
      const a=phase+i*Math.PI*2/7,l=scale*(.85+(i%3)*.22),
        c=[x,.08,z],m=[x+Math.cos(a)*l*.65,l*.85,z+Math.sin(a)*l*.65],
        tip=[x+Math.cos(a)*l,l*.55,z+Math.sin(a)*l],
        left=[m[0]+Math.sin(a)*l*.23,m[1]-.16*l,m[2]-Math.cos(a)*l*.23],
        right=[m[0]-Math.sin(a)*l*.23,m[1]-.16*l,m[2]+Math.cos(a)*l*.23];
      for(const [p,q,r,col] of [[c,left,m,jade],[c,m,right,bark],[m,left,tip,jade],[m,tip,right,plum]]) {
        geom.tri(out,p,q,r,col);geom.tri(out,r,q,p,col.map(v=>v*.65));
      }
    }
  }
  function spore(out,x,z,h,r) {
    tube(out,[[x,0,z,r*.22],[x+r*.3,h*.7,z,r*.15],[x,h,z,r*.4]],jade,5);
    skin(out,[[h*.74,r*.5],[h,r],[h*1.25,r*.15]].map(([y,s])=>ring(x,y,z,s,7)),[jade,light,plum]);
  }
  function bed(out,m,height=.55) {
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
  const within = (x,z,outline) => {
    let yes=false;
    for(let i=0,j=outline.length-1;i<outline.length;j=i++) {
      const a=outline[i],b=outline[j];
      if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)yes=!yes;
    }
    return yes;
  };
  function grove(m, luminous) {
    const rand=seeded(m.seed ^ 0x47524f56),out=[];
    if(!luminous)bed(out,m);
    // The same private sequence supplies the body and its separate low-intensity phosphor mesh.
    for(let i=0;i<85;i++) {
      const x=m.x+(rand()-.5)*m.width*1.8,z=m.z+(rand()-.5)*m.depth*1.8,
        phase=rand()*Math.PI*2,h=4+rand()*(m.height-4),r=1.8+rand()*2.1;
      // Contract the sampling footprint so crowns and roots stay inside the blocking mat.
      if(!within(m.x+(x-m.x)*1.22,m.z+(z-m.z)*1.22,m.outline))continue;
      if(luminous) {
        if(i%3===0)spore(out,x+r*.5,z-r*.3,.65+rand()*.25,.22);
        else rand();
      } else {
        const small=rand();
        mushroom(out,x,z,h,r,phase,i);
        if(i%2===0)fern(out,x+r,z-r,1.1+small,phase);
        // Broad, interlocking root ridges fill the occupied understory.
        tube(out,[[x-r,.08,z-r,.1],[x-r*.4,.65,z,r*.32],[x+r,.1,z+r,.1]],root,6);
      }
    }
    if(!luminous) for(let i=0;i<140;i++) {
      const x=m.x+(rand()-.5)*m.width*2,z=m.z+(rand()-.5)*m.depth*2;
      if(within(m.x+(x-m.x)*1.06,m.z+(z-m.z)*1.06,m.outline))
        fern(out,x,z,1.4+rand()*1.4,rand()*Math.PI*2);
    }
    return out;
  }
  TerrainModels.alienGrove=m=>grove(m,false);
  TerrainModels.alienGroveLight=m=>grove(m,true);
  TerrainModels.alienFern=()=>{const out=[];fern(out);return out;};
  TerrainModels.alienSpore=()=>{
    const out=[];spore(out,0,0,.85,.25);spore(out,.4,.25,.5,.19);spore(out,-.3,.15,.65,.22);return out;
  };
  TerrainModels.alienPod=seed=>{
    const out=[],rand=seeded(seed ^ 0x504f4453);
    const m={x:0,z:0,outline:Array.from({length:16},(_,i)=>({x:Math.cos(i*Math.PI/8)*.95,z:Math.sin(i*Math.PI/8)*.95}))};
    bed(out,m,.18);
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2,r=.32;
      mushroom(out,Math.cos(a)*r,Math.sin(a)*r,1.1+rand()*.7,.35+rand()*.1,a,i);
    }
    return out;
  };
  TerrainModels.alienCanopy=(seed,extent)=>{
    const out=[],rand=seeded(seed ^ 0x43414e4f),n=192,inner=extent-3;
    const perimeter=(a,r)=>{const x=Math.cos(a),z=Math.sin(a),d=Math.max(Math.abs(x),Math.abs(z));return [x/d*r,z/d*r];};
    const rows=[];
    for(let j=0;j<4;j++)rows.push(Array.from({length:n},(_,i)=>{
      const a=i*Math.PI*2/n,[x,z]=perimeter(a,[inner,extent+12,extent+38,extent+70][j]);
      return [x,j===0?-.2:j===3?-8:(j===1?4:11)+Math.sin(a*13)*1.7,z];
    }));
    // Ground-facing root bank, not a reskinned mountain wall.
    for(let j=0;j<3;j++)for(let i=0;i<n;i++) {
      const k=(i+1)%n,c=mix(root,bark,(i%5)/5);
      geom.tri(out,rows[j][i],rows[j][k],rows[j+1][k],c);
      geom.tri(out,rows[j][i],rows[j+1][k],rows[j+1][i],c);
    }
    for(let i=0;i<144;i++) {
      const a=(i+rand()*.5)*Math.PI*2/144,[x,z]=perimeter(a,extent+(i%2?25:7)+rand()*13),h=12+rand()*12;
      mushroom(out,x,z,h,3+rand()*2.5,rand()*Math.PI*2,i);
    }
    return out;
  };
})();
