/* Mothwing — four veined, scalloped living wings with eye spots; never a crystal aircraft. Geometry is baked once; animation never allocates meshes or consumes RNG. */
'use strict';
(() => {
  function shell(out: number[], x: number, y: number, z: number, sx: number, sy: number, sz: number, tint=[1,1,1]) {
    ModelMesh.lobedShell(out,{x,y,z,sx,sy,sz,lobes:4,segments:24,rings:10,depth:.035,tint});
  }
  function rod(out: number[], a: number[], b: number[], radius: number, tint=[1,1,1], top=1) {
    const d=b.map((v,i)=>v-a[i]), length=Math.hypot(...d);
    ModelMesh.bake(out,geom.cylinder(8,top),{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,z:(a[2]+b[2])/2,
      sx:radius,sy:length,sz:radius,rx:Math.acos(d[1]/length),ry:Math.atan2(d[0],d[2]),tint});
  }
  // Closed curved leaf: central ridge, tapered edges and separately wound underside.
  function leaf(out: number[], x: number, y: number, z: number, width: number, length: number, ry=0, rx=0, tint=[1,1,1]) {
    const data: number[]=[], steps=10;
    const point=(i: number, side: number, back: boolean) => {
      const t=i/steps, arch=Math.sin(Math.PI*t);
      return [side*width*arch*(.85+.15*t),length*(.18*t*t+.07*arch)*(1-Math.abs(side)*.65)-(back?.045*arch:0),t*length];
    };
    for (const back of [false,true]) for(let i=0;i<steps;i++) for(const side of [-1,1]) {
      const a=point(i,0,back), b=point(i,side,back), c=point(i+1,side,back), d=point(i+1,0,back);
      const tri=(u: number[],v: number[],w: number[])=>back !== (side>0)?geom.tri(data,u,w,v,tint):geom.tri(data,u,v,w,tint);
      if(i>0) tri(a,b,c);
      if(i<steps-1) tri(a,c,d);
    }
    ModelMesh.bake(out,data,{x,y,z,ry,rx});
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

  function body() {
    const o: number[]=[];
    shell(o,0,.65,-.19,.25,.26,.84,[1.12,1.06,.72]);shell(o,0,.74,.48,.31,.3,.37);
    for(let i=0;i<5;i++) shell(o,0,.64,-.83+i*.24,.15+i*.017,.23,.12,[.72,.9,.67]);
    shell(o,0,.75,.87,.23,.23,.24,[1.25,1.18,.78]);
    for(const s of [-1,1]) {
      rod(o,[s*.13,.92,.94],[s*.35,1.2,1.24],.035,[1.3,1.2,.85]);
      for(let i=0;i<4;i++) rod(o,[s*(.2+i*.04),1.01+i*.05,1.04+i*.045],[s*(.32+i*.055),1.05+i*.05,1.12+i*.045],.017);
      for(let i=0;i<3;i++) rod(o,[s*.17,.58,.45-i*.3],[s*.43,.28,.67-i*.3],.034,[.7,.8,.6]);
    }
    return o;
  }
  function wing() {
    const o: number[]=[], outline: number[][]=[];
    // Rounded forewing with a scalloped trailing edge, built as a shallow closed shell.
    for(let i=0;i<32;i++) {const a=i*2*Math.PI/32,scallop=1+.065*Math.cos(a*7);outline.push([1.15+Math.cos(a)*1.18*scallop,.25+Math.sin(a)*.89*scallop]);}
    plate(o,outline,0,.035,.15,[1.04,.92,1.17]);
    for(let i=0;i<9;i++) {const a=-1.35+i*.34;rod(o,[.12,.045,.05],[1.15+Math.cos(a)*1.03,.06,.25+Math.sin(a)*.79],.019,[.48,.62,.5]);}
    shell(o,1.66,.11,.39,.3,.035,.27,[.5,.64,.5]);shell(o,1.66,.15,.39,.18,.025,.16,[1.35,1.12,.65]);
    shell(o,1.66,.18,.39,.073,.015,.1,[.36,.42,.42]);return o;
  }
  function hindwing() {const o: number[]=[];leaf(o,0,0,0,.6,1.62,2.25,0,[.82,1.12,.79]);for(let i=0;i<4;i++)rod(o,[.06,.03,0],[.75+i*.12,.1,-.55-i*.16],.018,[.45,.7,.5]);return o;}
  // Reflect positions and reverse winding; rotating the left wing would also reverse its leading edge.
  function mirror(factory: () => number[]) {
    const data=factory(), out: number[]=[];
    for(let i=0;i<data.length;i+=27) {
      const a=[-data[i],data[i+1],data[i+2]], b=[-data[i+9],data[i+10],data[i+11]], c=[-data[i+18],data[i+19],data[i+20]];
      geom.tri(out,a,c,b,data.slice(i+6,i+9));
    }
    return out;
  }
  registerEntityModel({id:'faction-1/unit/air',meshes:{choirMothwingBody:body,choirMothwingFore:wing,choirMothwingHind:hindwing,
    choirMothwingForeLeft:()=>mirror(wing),choirMothwingHindLeft:()=>mirror(hindwing)},
    render({time,part:p,metal,team,surfaceColor:c}) {
      p('choirMothwingBody',0,0,0,1,1,1,metal);
      const flap=Math.sin(time*7)*.23;
      for(const s of [-1,1]) {
        p(s<0?'choirMothwingForeLeft':'choirMothwingFore',s*.16,.75,.24,1,1,1,c(0xc6adba),0,0,s*flap);
        p(s<0?'choirMothwingHindLeft':'choirMothwingHind',s*.12,.67,-.06,1,1,1,c(0x93b986),0,0,-s*flap*.7);
        p('octa',s*.16,.8,1.03,.08,.1,.055,team,0,0,0,.45);
      }
    }
  });
})();
