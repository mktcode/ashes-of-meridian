/* Fraktion 0 / building / turret: isolated procedural assembly. */
'use strict';
(() => {
function fittings() {
  const out: number[]=[], bolt=geom.cylinder(6), dark=[.38,.43,.49];
  for(const side of [-1,1]) {
    ModelMesh.panel(out,{x:side*.58,y:1.24,z:-.05,w:.16,h:.48,d:.37,bevel:.035,tint:dark});
    for(const y of [1.09,1.39]) ModelMesh.bake(out,bolt,{
      x:side*.673,y,z:-.05,sx:.047,sy:.035,sz:.047,rz:Math.PI/2,tint:[1.28,1.22,1.13]});
  }
  return out;
}
registerEntityModel({
  id: 'faction-0/building/turret', meshes: { faction0TurretFittings: fittings },
  render({ entity: e, time, part: p, ring, metal, dark, team, accent, baseRotation, nightLight=0, pointLight }) {
    const glow=(base=0)=>base+(5-base)*nightLight;
    p('turretBase', 0, 0, 0, 1, 1, 1, metal);
    p('faction0TurretFittings', 0, 0, 0, 1, 1, 1, metal);
    // Keep the aiming head independent of the fixed foundation orientation.
    const aim = (e.rot || 0) - baseRotation,
      ac = Math.cos(aim),
      as = Math.sin(aim);
    pointLight(.9*as, 2.3, .9*ac, 7, team, 3);
    const head = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: number, glow = 0) =>
      p('box', x * ac + z * as, y, -x * as + z * ac, sx, sy, sz, c, aim, 0, 0, glow);
    p('turretHead', 0, 0, 0, 1, 1, 1, metal, aim);
    head(0, 2.3, 0.827, 0.35, 0.25, 0.025, team, glow(1.2));
    for (const side of [-1, 1]) {
      head(side * .985, 2.32, -.10, .025, .085, .48, team, glow(.35));
      head(side * .80, 2.568, -.1, .12, .025, .36, accent, glow());
    }
  }
});
})();
