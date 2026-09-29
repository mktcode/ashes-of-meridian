/* Reusable, opaque world morphology. All meshes are baked at residency; the same
 * normalized envelopes serve small colonies and large alien silhouettes. */
'use strict';
(()=>{
  const finish=(out:number[])=>{
    let r=1;for(let i=0;i<out.length;i+=9)r=Math.max(r,Math.hypot(out[i],out[i+2]));
    for(let i=0;i<out.length;i+=9) {
      out[i]/=r;out[i+2]/=r;
      const n=V.norm([out[i+3]*r,out[i+4],out[i+5]*r]);out[i+3]=n[0];out[i+4]=n[1];out[i+5]=n[2];
    }
    return out;
  };
  const tube=(out:number[],points:number[][],color:number[],sides=7)=>{
    const rings=points.map(([x,y,z,r])=>Array.from({length:sides},(_,i)=>
      [x+Math.cos(i*Math.PI*2/sides)*r,y,z+Math.sin(i*Math.PI*2/sides)*r]));
    for(let j=1;j<rings.length;j++)for(let i=0;i<sides;i++) {
      const k=(i+1)%sides,c=color.map(v=>v*(.78+.2*Math.cos(i*Math.PI*2/sides)));
      geom.tri(out,rings[j-1][i],rings[j][k],rings[j-1][k],c);
      geom.tri(out,rings[j-1][i],rings[j][i],rings[j][k],c);
    }
    for(const [j,top] of [[0,false],[points.length-1,true]] as const)for(let i=0;i<sides;i++) {
      const k=(i+1)%sides,p=points[j].slice(0,3);
      geom.tri(out,p,rings[j][top?k:i],rings[j][top?i:k],color);
    }
  };
  const blade=(out:number[],points:number[][],width:number,color:number[])=>{
    const left=points.map((p,i)=>[p[0]-width*Math.sin(i/(points.length-1)*Math.PI),p[1],p[2]]),
      right=points.map((p,i)=>[p[0]+width*Math.sin(i/(points.length-1)*Math.PI),p[1],p[2]]);
    for(let i=1;i<points.length;i++) {
      if(i<points.length-1) {
        geom.tri(out,left[i-1],points[i],left[i],color);
        geom.tri(out,right[i-1],right[i],points[i],color.map(v=>v*.82));
      }
      if(i>1) {
        geom.tri(out,left[i-1],points[i-1],points[i],color);
        geom.tri(out,right[i-1],points[i],points[i-1],color.map(v=>v*.82));
      }
    }
  };
  const turn=(out:number[],mesh:number[],angle:number)=>{
    const c=Math.cos(angle),s=Math.sin(angle);
    for(let i=0;i<mesh.length;i+=9)out.push(mesh[i]*c+mesh[i+2]*s,mesh[i+1],-mesh[i]*s+mesh[i+2]*c,
      mesh[i+3]*c+mesh[i+5]*s,mesh[i+4],-mesh[i+3]*s+mesh[i+5]*c,mesh[i+6],mesh[i+7],mesh[i+8]);
  };
  TerrainModels.ecologyCoral=(seed:number)=>{
    const out:number[]=[],r=seeded(seed);
    for(let i=0;i<7;i++) {
      const a=i*2.39996,x=Math.cos(a)*.45,z=Math.sin(a)*.45,h=.65+r()*.32;
      tube(out,[[0,0,0,.11],[x*.35,.28,z*.35,.085],[x*.7,.55,z*.7,.06],[x,h,z,.025]],[.91,.76,.84]);
      for(const side of [-1,1])tube(out,[[x*.55,.4,z*.55,.045],[x+Math.cos(a+side)*.22,h*.8,z+Math.sin(a+side)*.22,.035],
        [x+Math.cos(a+side)*.3,h+.1,z+Math.sin(a+side)*.3,.012]],[.72,.93,.88]);
    }
    return finish(out);
  };
  TerrainModels.ecologyFan=(seed:number)=>{
    const out:number[]=[],r=seeded(seed);
    for(let i=0;i<5;i++) {
      const a=i*2.39996,h=.48+r()*.3,mesh:number[]=[];
      tube(mesh,[[0,0,0,.055],[0,h*.6,.13,.04],[0,h,.22,.015]],[.61,.69,.59]);
      for(let j=0;j<12;j++) {
        const t=j*Math.PI/12,b=(j+1)*Math.PI/12,
          p=[Math.cos(t)*.63,h+Math.sin(t)*.28,.22+Math.sin(j*1.7)*.035],
          q=[Math.cos(b)*.63,h+Math.sin(b)*.28,.22+Math.sin((j+1)*1.7)*.035];
        geom.tri(mesh,[0,h-.12,.13],p,q,j%2?[1,.91,.73]:[.68,.75,.77]);
      }
      turn(out,mesh,a);
    }
    return finish(out);
  };
  TerrainModels.ecologyPod=(seed:number)=>{
    const out:number[]=[],r=seeded(seed);
    for(let i=0;i<5;i++) {
      const a=i*2.39996,x=Math.cos(a)*(i?.48:0),z=Math.sin(a)*(i?.48:0),h=.66+r()*.3;
      tube(out,[[x,0,z,.05],[x*.9,h*.4,z*.9,.07],[x,h*.53,z,.15],[x,h*.72,z,.23],
        [x,h*.94,z,.15],[x,h,z,.035]],[1,.83,.9],10);
      for(let j=0;j<5;j++) {
        const b=j*Math.PI*2/5;
        geom.tri(out,[x,h,z],[x+Math.cos(b)*.22,h+.07,z+Math.sin(b)*.22],
          [x+Math.cos(b+.7)*.16,h*.87,z+Math.sin(b+.7)*.16],[.64,.91,.84]);
      }
    }
    return finish(out);
  };
  TerrainModels.ecologyArch=(seed:number)=>{
    const out:number[]=[],r=seeded(seed);
    for(let j=0;j<3;j++) {
      const mesh:number[]=[],h=.72+j*.12,width=.5+r()*.2;
      tube(mesh,Array.from({length:13},(_,i)=>{
        const a=i*Math.PI/12;return [Math.cos(a)*width,.02+Math.sin(a)*h,Math.sin(a*2)*.11,.045+Math.sin(a)*.018];
      }),[.90,.91,.82]);turn(out,mesh,j*Math.PI/3);
    }
    return finish(out);
  };
  TerrainModels.ecologyReed=(seed:number)=>{
    const out:number[]=[],r=seeded(seed);
    for(let i=0;i<14;i++) {
      const a=i*2.39996,d=Math.sqrt(r())*.64,x=Math.cos(a)*d,z=Math.sin(a)*d,h=.48+r()*.5;
      tube(out,[[x,0,z,.016],[x+.09,h*.8,z,.013],[x+.1,h,z,.008]],[.66,.82,.73],5);
      tube(out,[[x+.09,h*.73,z,.025],[x+.1,h*.88,z,.075],[x+.12,h*1.08,z,.009]],[.89,.96,1],7);
    }
    return finish(out);
  };
  TerrainModels.ecologyShelf=(seed:number)=>{
    const out:number[]=[],r=seeded(seed);
    tube(out,[[0,0,0,.15],[.04,.55,0,.09],[0,1,0,.05]],[.64,.70,.78]);
    for(let j=0;j<6;j++) {
      const a=j*2.39996,h=.18+j*.14,radius=.35+r()*.25;
      for(let i=0;i<14;i++) {
        const u=a+(i/14-.5)*Math.PI*1.5,v=a+((i+1)/14-.5)*Math.PI*1.5,
          p=[Math.cos(u)*radius,h+.07,Math.sin(u)*radius],q=[Math.cos(v)*radius,h+.07,Math.sin(v)*radius];
        geom.tri(out,[0,h+.16,0],q,p,[.91,.89,1]);geom.tri(out,[0,h-.035,0],p,q,i%2?[.54,.70,.77]:[.82,.78,.95]);
      }
    }
    return finish(out);
  };
  TerrainModels.ecologyCactus=(seed:number)=>{
    const out:number[]=[],r=seeded(seed);
    tube(out,[[0,0,0,.12],[0,.88,0,.10],[0,1,0,.035]],[.73,.88,.68],10);
    for(let i=0;i<4;i++) {
      const a=i*2.39996,x=Math.cos(a)*.4,z=Math.sin(a)*.4,h=.55+r()*.35;
      tube(out,[[0,.24,0,.06],[x,.32,z,.085],[x,h,z,.07],[x,h+.08,z,.02]],[.77,.89,.72],8);
    }
    return finish(out);
  };
  TerrainModels.ecologyPalm=(seed:number)=>{
    const out:number[]=[],r=seeded(seed);
    tube(out,Array.from({length:9},(_,i)=>[Math.sin(i*.19)*.08,i*.095,0,.075-i*.005]),[.72,.61,.48],8);
    for(let i=0;i<10;i++) {
      const mesh:number[]=[],reach=.75+r()*.15;
      blade(mesh,[[0,.75,0],[0,.95,reach*.27],[0,.86,reach*.62],[0,.57,reach]],.14,[.78,.94,.69]);
      turn(out,mesh,i*Math.PI/5);
    }
    return finish(out);
  };
  const box=(out:number[],x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number[])=>{
    const mesh=geom.box();for(let i=0;i<mesh.length;i+=9)out.push(x+mesh[i]*sx,y+mesh[i+1]*sy,z+mesh[i+2]*sz,
      mesh[i+3],mesh[i+4],mesh[i+5],...color);
  };
  TerrainModels.variationRadar=(seed:number)=>{
    const out:number[]=[];box(out,0,.12,0,.9,.24,.7,[.5,.62,.65]);box(out,0,.55,0,.13,.85,.13,[.74,.77,.76]);
    for(let i=0;i<16;i++) {
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
      geom.tri(out,[0,.87,.16],[Math.cos(a)*.61,.91+Math.sin(a)*.29,-.08],[Math.cos(b)*.61,.91+Math.sin(b)*.29,-.08],[.72,.83,.91]);
    }
    tube(out,[[0,.86,.16,.025],[0,.91,.51,.012]],[.95,.73,.34],6);return finish(out);
  };
  TerrainModels.variationPylon=(seed:number)=>{
    const out:number[]=[];box(out,0,.07,0,1.05,.14,.82,[.43,.51,.57]);
    for(const side of [-1,1]) {
      box(out,side*.32,.49,0,.14,.85,.28,[.67,.74,.80]);
      box(out,side*.32,.87,0,.25,.12,.4,[.8,.9,.94]);
      box(out,side*.32,.46,.15,.035,.65,.035,[.43,.88,1]);
    }
    box(out,0,.68,0,.56,.12,.21,[.55,.66,.71]);return finish(out);
  };
  TerrainModels.variationWreck=(seed:number)=>{
    const out:number[]=[],r=seeded(seed);
    for(let i=0;i<9;i++)box(out,(r()-.5)*1.1,.04+r()*.19,(r()-.5)*1.1,.24+r()*.38,.1+r()*.18,.19+r()*.25,[.54,.45,.34]);
    tube(out,[[-.33,.09,0,.22],[-.26,.42,0,.24],[-.18,.58,0,.14]],[.72,.61,.41],8);
    box(out,.28,.34,0,.2,.48,.7,[.42,.51,.54]);return finish(out);
  };
  // Alien replacement meshes retain the original instancing footprint/placement RNG.
  // A family has a complete silhouette; no floating old mushroom gills are retained.
  for(const family of ['Coral','Fan','Spire','Pod','Arch','Reed','Shelf','Cactus','Palm'] as const)
    TerrainModels[`variationAlien${family}`]=(seed:number)=>{
      const factory=TerrainModels[`ecology${family}`] as (seed:number)=>number[],mesh=factory(seed),
        height={Coral:1.65,Fan:1.2,Spire:2.4,Pod:1.6,Arch:1.25,Reed:2,Shelf:1.5,Cactus:1.8,Palm:2.6}[family];
      for(let i=0;i<mesh.length;i+=9) {
        mesh[i+1]*=height;const n=V.norm([mesh[i+3],mesh[i+4]/height,mesh[i+5]]);
        mesh[i+3]=n[0];mesh[i+4]=n[1];mesh[i+5]=n[2];
      }
      return mesh;
    };
})();
