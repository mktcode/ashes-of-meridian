/* The Unmasked — levitating sovereign, stepped vestments, dark face, open aureole and script tablets. Geometry is baked once; animation never allocates meshes or consumes RNG. */
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
  // Faceted annular frame in X/Y, with closed ends; not a glowing billboard.
  function arc(out: number[], radius: number, width: number, depth: number, start: number, end: number, y=0, z=0, tint=[1,1,1]) {
    const steps=24, point=(a: number,r: number,d: number)=>[Math.cos(a)*r,y+Math.sin(a)*r,z+d];
    for(let i=0;i<steps;i++) {
      const a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps;
      const A=point(a,radius-width,-depth/2), B=point(b,radius-width,-depth/2), C=point(b,radius,-depth/2), D=point(a,radius,-depth/2),
        E=point(a,radius-width,depth/2), F=point(b,radius-width,depth/2), G=point(b,radius,depth/2), H=point(a,radius,depth/2);
      const quad=(p: number[],q: number[],r: number[],s: number[])=>{geom.tri(out,p,q,r,tint);geom.tri(out,p,r,s,tint);};
      quad(A,B,C,D);quad(E,H,G,F);quad(D,C,G,H);quad(A,E,F,B);
      if(i===0) quad(A,D,H,E);if(i===steps-1) quad(B,F,G,C);
    }
  }

  function body() {
    const o: number[]=[];
    panel(o,0,1.32,0,.53,.71,.39);
    for(let i=0;i<4;i++) {
      const w=.99-i*.14, y=.3+i*.23;
      panel(o,0,y,-.045,w,.26,.46,[.72+i*.1,.72+i*.09,.85+i*.055]);
      panel(o,0,y+.1,.201,w*.8,.04,.035,[1.2,1.17,1.05]);
    }
    for(const s of [-1,1]) {
      panel(o,s*.4,1.55,0,.38,.15,.59,[1.18,1.15,1.05]);
      rod(o,[s*.37,1.45,.02],[s*.59,1.03,.16],.085,[.53,.52,.66]);
      panel(o,s*.6,1.02,.18,.14,.23,.19);
      panel(o,s*.53,1.5,-.24,.11,.62,.27);
    }
    ModelMesh.bake(o,geom.cylinder(8,.67),{y:1.99,z:-.02,sx:.21,sy:.54,sz:.18,ry:Math.PI/8,tint:[.4,.42,.55]});
    panel(o,0,1.93,.157,.22,.29,.035,[.22,.25,.34]);
    for(const s of [-1,1]) {
      rod(o,[s*.17,1.77,.1],[s*.135,2.19,.1],.028,[1.25,1.2,1.1]);
      rod(o,[s*.105,2.2,0],[s*.14,2.42,-.02],.03,[1.25,1.2,1.1],.15);
    }
    panel(o,0,2.25,.045,.31,.055,.17,[1.25,1.2,1.1]);
    arc(o,.88,.115,.12,-.12,Math.PI+.12,1.88,-.2,[1.24,1.2,1.08]);
    return o;
  }
  function tablet() {
    const o: number[]=[];panel(o,0,0,0,.25,.72,.1);
    for(let i=0;i<5;i++) panel(o,0,-.23+i*.115,.057,i%2?.11:.17,.029,.02,[.42,.43,.53]);return o;
  }
  function staff() {
    const o: number[]=[];rod(o,[.66,.05,.41],[.66,2.24,.41],.034);
    for(const s of [-1,1]) rod(o,[.66,1.99,.41],[.66+s*.18,2.39,.41],.045,[1.15,1.11,1],.4);return o;
  }
  registerEntityModel({id:'faction-2/unit/hero',meshes:{courtUnmaskedBody:body,courtUnmaskedTablet:tablet,courtUnmaskedStaff:staff},
    render({time,part:p,metal,team,surfaceColor:c}) {
      p('courtUnmaskedBody',0,0,0,1,1,1,metal);p('courtUnmaskedStaff',0,0,0,1,1,1,metal);
      for(const s of [-1,1]) p('courtUnmaskedTablet',s*.98,1.38+Math.sin(time*1.1+s)*.06,-.1,1,1,1,metal,s*.24,0,s*.09);
      p('octa',.66,2.26,.41,.12,.22,.1,c(0x79d9e3),0,0,0,.6);
      p('octa',0,1.35,.23,.15,.23,.055,team,0,0,0,.5);
      for(const s of [-1,1]) p('box',s*.055,1.98,.184,.031,.022,.015,team,0,0,0,.35);
    }
  });
})();
