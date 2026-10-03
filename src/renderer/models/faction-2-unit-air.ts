/* Seraph — rigid crescent interceptor, open wing slots, spear keel and twin aft drives. Geometry is baked once; animation never allocates meshes or consumes RNG. */
'use strict';
(() => {
  function rod(out: number[], a: number[], b: number[], radius: number, tint=[1,1,1], top=1) {
    const d=b.map((v,i)=>v-a[i]), length=Math.hypot(...d);
    ModelMesh.bake(out,geom.cylinder(8,top),{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,z:(a[2]+b[2])/2,
      sx:radius,sy:length,sz:radius,rx:Math.acos(d[1]/length),ry:Math.atan2(d[0],d[2]),tint});
  }
  function panel(out: number[], x: number, y: number, z: number, w: number, h: number, d: number, tint=[1,1,1]) {
    ModelMesh.panel(out,{x,y,z,w,h,d,bevel:Math.min(w,h,d)*.16,tint});
  }
  // Closed polygonal plate, CCW outline in X/Z. Crown creates readable broad facets.
  function plate(out: number[], outline: number[][], y: number, thickness: number, crown=0, tint=[1,1,1]) {
    const cx=outline.reduce((n,p)=>n+p[0],0)/outline.length, cz=outline.reduce((n,p)=>n+p[1],0)/outline.length;
    for(let i=0;i<outline.length;i++) {
      const p=outline[i], q=outline[(i+1)%outline.length], a=[p[0],y,p[1]], b=[q[0],y,q[1]],
        c=[p[0],y-thickness,p[1]], d=[q[0],y-thickness,q[1]];
      geom.tri(out,[cx,y+crown,cz],b,a,tint);
      geom.tri(out,[cx,y-thickness,cz],c,d,tint.map(v=>v*.65));
      geom.tri(out,a,b,d,tint);geom.tri(out,a,d,c,tint);
    }
  }

  function hull() {
    const o: number[]=[];
    plate(o,[[-.29,-1.51],[.29,-1.51],[.38,-.31],[.14,1.94],[0,2.33],[-.14,1.94],[-.38,-.31]],.61,.22,.25);
    panel(o,0,.91,-.1,.37,.16,.73,[.42,.46,.58]);
    for(const s of [-1,1]) {
      const shape=[[.29,.45],[.83,.54],[1.47,.03],[2.54,-1.15],[2.29,-1.47],[1.19,-.63],[.76,-.8],[.41,-.46]].map(([x,z])=>[x*s,z]);
      // This outline runs clockwise on the right; normalize before tessellation.
      if(s>0) shape.reverse();plate(o,shape,.51,.13,.16);
      const lower=[[.62,-.68],[1.22,-.76],[1.77,-1.82],[1.26,-1.44],[.64,-1.12]].map(([x,z])=>[x*s,z]);
      if(s>0) lower.reverse();plate(o,lower,.35,.08,.08,[.65,.67,.77]);
      panel(o,s*.63,.52,-1.18,.31,.36,.99);
      panel(o,s*.63,.58,-1.74,.35,.27,.14,[.4,.43,.54]);
      const fin: number[]=[];plate(fin,[[-.11,-.6],[.12,-.6],[.09,.39],[-.09,.64]],0,.065,.07);
      ModelMesh.bake(o,fin,{x:s*.57,y:.76,z:-.9,rz:s*.95});
      rod(o,[s*.58,.67,.23],[s*2.1,.61,-1.07],.022,[1.28,1.24,1.11]);
    }
    return o;
  }
  registerEntityModel({id:'faction-2/unit/air',meshes:{courtSeraphHull:hull},
    render({nightPart:p,metal,team,surfaceColor:c,pointLight}) {
      pointLight(0, .9, .8, 6, team, 2.5);
      p('courtSeraphHull',0,0,0,1,1,1,metal);
      for(const s of [-1,1]) {
        p('box',s*.63,.57,-1.823,.2,.13,.035,c(0x79d9e3),0,0,0,.8);
        p('octa',s*1.05,.69,-.09,.14,.055,.27,team,s*.55,0,0,.4);
      }
      p('octa',0,.88,.68,.095,.06,.57,team,0,0,0,.5);
    }
  });
})();
