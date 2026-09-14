/* Fraktion 0 / unit / worker: the established hull/drill plus restrained service fittings. */
'use strict';
registerEntityModel({
  id: 'faction-0/unit/worker',
  meshes: {
    faction0WorkerFittings() {
      const out: number[]=[], box=geom.box(), bolt=geom.cylinder(6), edge=[1.12,1.15,1.16];
      ModelMesh.panel(out,{x:.15,y:1.25,z:-.13,w:.3,h:.04,d:.3,bevel:.009,tint:[.54,.74,1.08]});
      for(let j=-1;j<=1;j++) ModelMesh.bake(out,box,{
        x:.15+j*.07,y:1.277,z:-.13,sx:.032,sy:.025,sz:.22,tint:edge});
      for(const x of [-.03,.33]) for(const z of [-.32,.06]) ModelMesh.bake(out,bolt,{
        x,y:1.248,z,sx:.025,sy:.025,sz:.025,tint:edge});
      ModelMesh.panel(out,{x:-.43,y:1.03,z:-.27,w:.03,h:.18,d:.26,bevel:.009,tint:[.54,.74,1.08]});
      ModelMesh.bake(out,box,{x:-.449,y:1.03,z:-.27,sx:.018,sy:.1,sz:.04,tint:[.21,.33,.54]});
      return out;
    }
  },
  render({entity:e,part:p,metal,dark,team,accent,surfaceColor}) {
    p('workerHull', 0, 0, 0, 1, 1, 1, surfaceColor(0xb7a27b));
    p('faction0WorkerFittings', 0, 0, 0, 1, 1, 1, surfaceColor(0xb7a27b));
    p('box', 0, 1.05, 0.295, 0.67, 0.20, 0.065, dark);
    p('box', 0, 1.065, 0.334, 0.49, 0.105, 0.025, team, 0, 0, 0, 0.65);
    for (const side of [-1, 1]) {
      p('box', side * .43, .60, .731, .11, .07, .025, 0xffe4aa, 0, 0, 0, .55);
      p('box', side * .62, .80, -.08, .065, .025, .66, accent);
    }
    p('box', 0.67, 0.94, 0.45, 0.18, 0.2, 0.95, accent, 0, -0.35);
    p('cylinder', .63, .95, .08, .14, .18, .14, metal, 0, 0, Math.PI/2);
    p('cylinder', .67, .86, .88, .21, .13, .21, dark, 0, -1.1);
    p('workerDrill', 0.67, 0.8, 1.0, 0.18, 0.55, 0.18, 0xd9cdb5, 0, -1.1);
    p('cylinder', -0.3, 1.28, -0.4, 0.18, 0.4, 0.18, accent);
    p('cylinder', -.3, 1.49, -.4, .19, .055, .19, dark);
    p('sphere', -.3, 1.53, -.4, .095, .035, .095, team, 0, 0, 0, .5);
    if ((e.carry || 0) > 0) p('octa', 0, 1.4, -0.4, 0.32, 0.46, 0.3, 0xecc88a, 0, 0, 0, 0.35);
  }
});
