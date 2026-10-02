/* Instanced habitat vocabulary. Opaque folded leaves, layered needles, radial
 * fungal gills and assembled ruins: geometry is baked only on world residency. */
'use strict';
(() => {
  const rod=(out:number[],a:number[],b:number[],r:number,color:number[],sides=6)=>{
    const axis=V.norm(V.sub(b,a)),side=V.norm(V.cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),up=V.cross(axis,side),
      p=(base:number[],angle:number,width:number)=>base.map((v,k)=>v+(side[k]*Math.cos(angle)+up[k]*Math.sin(angle))*width);
    for(let i=0;i<sides;i++) {
      const u=i*Math.PI*2/sides,v=(i+1)*Math.PI*2/sides;
      geom.tri(out,p(a,u,r),p(a,v,r),p(b,v,r*.45),color);geom.tri(out,p(a,u,r),p(b,v,r*.45),p(b,u,r*.45),color);
      geom.tri(out,b,p(b,u,r*.45),p(b,v,r*.45),color);
    }
  };
  const finish=(out:number[])=>{
    let radius=1;for(let i=0;i<out.length;i+=9)radius=Math.max(radius,Math.hypot(out[i],out[i+2]));
    for(let i=0;i<out.length;i+=9) {
      out[i]/=radius;out[i+2]/=radius;
      const n=V.norm([out[i+3]*radius,out[i+4],out[i+5]*radius]);out[i+3]=n[0];out[i+4]=n[1];out[i+5]=n[2];
    }
    return out;
  };
  const branches=(seed:number,flat=false)=>{
    const rand=seeded(seed);return Array.from({length:8},(_,i)=>{
      const a=i*2.39996+rand()*.25,r=.27+rand()*.25;
      return {tip:[Math.cos(a)*r,flat?.78:.55+i*.042,Math.sin(a)*r],base:[.03,.25+i*.05,0]};
    });
  };
  TerrainModels.ecologyTrunk=(seed:number,flat:number)=>{
    const out:number[]=[];rod(out,[0,0,0],[.04,flat?.78:.89,0],.065,[.77,.73,.68]);
    for(const b of branches(seed,!!flat))rod(out,b.base,b.tip,.022,[.70,.68,.60]);
    return finish(out);
  };
  const broadleaf=(seed:number,flat:boolean)=>{
    const out:number[]=[],rand=seeded(seed^0x43414e4f);
    for(const branch of branches(seed,flat))for(let i=0;i<26;i++) {
      const a=rand()*Math.PI*2,r=Math.sqrt(rand())*.32,y=(rand()-.5)*(flat?.05:.24),
        p=[branch.tip[0]+Math.cos(a)*r,flat?.78+y:branch.tip[1]+y,branch.tip[2]+Math.sin(a)*r],
        yaw=rand()*Math.PI*2,w=.065+rand()*.05,l=w*1.7,shade=.66+rand()*.34,
        color=[shade,shade,shade*.92],points=[[0,-l],[-w,-l*.35],[-w*.8,l*.4],[0,l],[w*.8,l*.4],[w,-l*.35]].map(([x,z])=>
          [p[0]+x*Math.cos(yaw)-z*Math.sin(yaw),p[1]+z*.3,p[2]+x*Math.sin(yaw)+z*Math.cos(yaw)]);
      for(let k=0;k<6;k++)geom.tri(out,[p[0],p[1]+.025,p[2]],points[k],points[(k+1)%6],color);
    }
    return finish(out);
  };
  TerrainModels.ecologyGrove=(seed:number)=>broadleaf(seed,false);
  TerrainModels.ecologyAcacia=(seed:number)=>broadleaf(seed,true);
  TerrainModels.ecologyConifer=(seed:number)=>{
    const out:number[]=[],rand=seeded(seed);
    for(let tier=0;tier<7;tier++) {
      const y=.24+tier*.10,r=.76*(1-tier/8),points=Array.from({length:18},(_,i)=>{
        const a=i*Math.PI/9,reach=r*(.82+rand()*.18);return [Math.cos(a)*reach,y+(i%2)*.045,Math.sin(a)*reach];
      });
      for(let i=0;i<18;i++) {
        geom.tri(out,[0,y+.26,0],points[(i+1)%18],points[i],[.7+tier*.035,.79+tier*.025,.85+tier*.02]);
        geom.tri(out,[0,y+.01,0],points[i],points[(i+1)%18],[.45,.53,.56]);
      }
    }
    return finish(out);
  };
  TerrainModels.ecologyFungus=(seed:number)=>{
    const out:number[]=[],rand=seeded(seed);
    for(const [x,y,z,r] of [[0,.78,0,.73],[.45,.50,.1,.35],[-.32,.61,-.25,.40]]) {
      rod(out,[x,0,z],[x,y,z],.04,[.76,.72,.86]);
      const rings=Array.from({length:5},(_,j)=>Array.from({length:20},(_,i)=>{
        const a=i*Math.PI/10,reach=r*(j/4),ruffle=j===4?Math.sin(i*2.1+seed)*.024:0;
        return [x+Math.cos(a)*reach,y+.19*(1-(j/4)**2)+ruffle,z+Math.sin(a)*reach];
      }));
      for(let j=1;j<5;j++)for(let i=0;i<20;i++) {
        const next=(i+1)%20,shade=.65+rand()*.32;
        geom.tri(out,rings[j-1][i],rings[j][next],rings[j][i],[shade*.95,shade,shade]);
        if(j>1)geom.tri(out,rings[j-1][i],rings[j-1][next],rings[j][next],[shade*.95,shade,shade]);
      }
      for(let i=0;i<20;i++)geom.tri(out,[x,y-.055,z],rings[4][i],rings[4][(i+1)%20],i%2?[.39,.57,.67]:[.86,.67,.95]);
    }
    return finish(out);
  };
  TerrainModels.ecologyTuft=(seed:number)=>{
    const out:number[]=[],rand=seeded(seed);
    for(let i=0;i<16;i++) {
      const a=rand()*Math.PI*2,r=rand()*.7,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.3+rand()*.65,
        dx=Math.cos(a)*.12,dz=Math.sin(a)*.12,c=[.76+rand()*.24,.82+rand()*.18,.75+rand()*.25];
      geom.tri(out,[x-dz,0,z+dx],[x+dx,h,z+dz],[x+dz,0,z-dx],c);
      geom.tri(out,[x-dz,0,z+dx],[x+dx*.4,h*.45,z+dz*.4],[x+dx,h,z+dz],c);
      if(i%3===0)for(let p=0;p<5;p++) {
        const angle=p*Math.PI*2/5,px=Math.cos(angle)*.13,pz=Math.sin(angle)*.13;
        geom.tri(out,[x,h,z],[x+px-pz*.5,h+.03,z+pz+px*.5],[x+px+pz*.5,h+.02,z+pz-px*.5],[1,.91,.91]);
      }
    }
    return finish(out);
  };
  // Low, opaque shrub/fern mounds: visibly substantial but still traversable cover.
  TerrainModels.ecologyBrush=(seed:number)=>{
    const out:number[]=[],rand=seeded(seed);
    for(let clump=0;clump<5;clump++){
      const angle=clump*2.39996,reach=clump? .38:0,
        x=Math.cos(angle)*reach,z=Math.sin(angle)*reach,r=.28+rand()*.2,h=.65+rand()*.35,
        points=Array.from({length:8},(_,i)=>{
          const a=i*Math.PI/4,spread=r*(.8+rand()*.2);
          return [x+Math.cos(a)*spread,.1+rand()*.12,z+Math.sin(a)*spread];
        });
      for(let i=0;i<8;i++){
        const shade=.62+rand()*.35,c=[shade*.91,shade,shade*.8];
        geom.tri(out,[x,h,z],points[(i+1)%8],points[i],c);
        geom.tri(out,[x,.02,z],points[i],points[(i+1)%8],c);
      }
    }
    return finish(out);
  };
  TerrainModels.ecologyRelic=(seed:number)=>{
    const out:number[]=[],rand=seeded(seed),box=geom.box();
    const stone=(x:number,y:number,z:number,sx:number,sy:number,sz:number,ry:number,color:number[])=>{
      const c=Math.cos(ry),s=Math.sin(ry);
      for(let i=0;i<box.length;i+=9)out.push(x+box[i]*sx*c+box[i+2]*sz*s,y+box[i+1]*sy,
        z-box[i]*sx*s+box[i+2]*sz*c,box[i+3]*c+box[i+5]*s,box[i+4],-box[i+3]*s+box[i+5]*c,...color);
    };
    // Fractured lintels and broad footings read as ruins, not resource crystals or usable gates.
    for(const [x,z,h] of [[-.46,0,.74],[.46,0,.91],[0,.47,.38]]) {
      stone(x,.065,z,.36,.13,.34,0,[.72,.73,.70]);
      for(let j=0;j<4;j++)stone(x+(rand()-.5)*.035,.14+h*(j+.5)/4,z,.20,h/4-.018,.23,(rand()-.5)*.12,[.86-j*.035,.84-j*.035,.78-j*.035]);
    }
    stone(-.28,.94,0,.52,.13,.25,-.14,[.85,.83,.77]);stone(.32,1.07,0,.34,.10,.25,.24,[.75,.76,.70]);
    for(let i=0;i<9;i++)stone((rand()-.5)*1.6,.04+rand()*.04,(rand()-.5)*1.2,.13+rand()*.18,.08+rand()*.10,.13+rand()*.15,rand()*6.28,[.58,.60,.54]);
    return finish(out);
  };
  TerrainModels.ecologySpire=(seed:number)=>{
    const out:number[]=[],rand=seeded(seed);
    for(let i=0;i<7;i++) {
      const a=i*2.39996,r=i? .3+rand()*.35:0,h=i?.35+rand()*.4:1.1,x=Math.cos(a)*r,z=Math.sin(a)*r,
        ring=Array.from({length:6},(_,j)=>[x+Math.cos(j*Math.PI/3)*.16,h*.65,z+Math.sin(j*Math.PI/3)*.16]);
      for(let j=0;j<6;j++) {
        const next=(j+1)%6,color=j%2?[.55,.68,.80]:[.77,.85,.91];
        geom.tri(out,[x,0,z],ring[j],ring[next],color);geom.tri(out,[x+.05,h,z],ring[next],ring[j],color);
      }
    }
    return finish(out);
  };
})();
