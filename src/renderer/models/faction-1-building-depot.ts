/* Verdant Choir / Living canopy: a terraced honeycomb nest in a fleshy leaf husk.
 * Open cells have real recessed floors; two cells are sealed with living membranes.
 * Static geometry inside the size-2.3 footprint; only the shared light pulse animates. */
'use strict';
(() => {
  const cells = [
    { x:0, z:0, radius:.74, height:1.55, sealed:false },
    { x:-1.05, z:-.61, radius:.68, height:1.96, sealed:true },
    { x:0, z:-1.22, radius:.71, height:2.20, sealed:false },
    { x:1.05, z:-.61, radius:.65, height:1.73, sealed:false },
    { x:1.05, z:.61, radius:.68, height:1.02, sealed:true },
    { x:0, z:1.22, radius:.67, height:.90, sealed:false },
    { x:-1.05, z:.61, radius:.70, height:1.22, sealed:false }
  ];

  // Bevel each hexagon corner rather than using cylindrical pipes or razor-sharp tiles.
  function ring(cell: typeof cells[number], radius: number, height: number, ripple = 0) {
    const points: number[][] = [];
    for (let i = 0; i < 6; i++) {
      const a = i*Math.PI/3, b = (i+1)*Math.PI/3;
      for (const t of [.14,.86]) points.push([
        cell.x + ((1-t)*Math.cos(a)+t*Math.cos(b))*cell.radius*radius,
        height + Math.sin(i*1.7+cell.x)*ripple,
        cell.z + ((1-t)*Math.sin(a)+t*Math.sin(b))*cell.radius*radius
      ]);
    }
    return points;
  }

  function hull() {
    const out: number[] = [];
    for (const cell of cells) {
      const floor = Math.max(.34,cell.height-.67),
        rings = [ring(cell,.86,.25), ring(cell,1.06,cell.height*.55),
          ring(cell,1.02,cell.height-.14,.025), ring(cell,.90,cell.height,.035),
          ring(cell,.66,cell.height-.025,.025), ring(cell,.62,floor)],
        shades = [[.88,1,.78], [1.07,1.16,.86], [1.32,1.30,.96],
          [1.40,1.35,1.01], [.48,.62,.51]];
      for (let j = 0; j < rings.length-1; j++) for (let i = 0; i < 12; i++) {
        const k = (i+1)%12;
        geom.tri(out,rings[j][i],rings[j+1][i],rings[j+1][k],shades[j]);
        geom.tri(out,rings[j][i],rings[j+1][k],rings[j][k],shades[j]);
      }
      for (let i = 0; i < 12; i++) {
        const k = (i+1)%12;
        geom.tri(out,[cell.x,floor,cell.z],rings[5][k],rings[5][i],[.38,.48,.40]);
        geom.tri(out,[cell.x,.25,cell.z],rings[0][i],rings[0][k],[.63,.72,.55]);
      }
    }
    // Broad, overlapping sepals bind the wax cells into a plant nest, not seven metal tubes.
    const leaf: number[] = [];
    ModelMesh.lobedShell(leaf,{sx:.36,sy:.16,sz:.86,lobes:3,segments:12,rings:5,tint:[.73,1.04,.69]});
    for (const [x,y,z,yaw,lean] of [[-1.51,.48,0,-.22,.24], [1.47,.46,-.25,.32,-.20],
      [.38,.42,1.51,1.72,.17], [-.48,.48,-1.48,1.22,-.23]])
      ModelMesh.bake(out,leaf,{x,y,z,ry:yaw,rx:lean});
    return out;
  }

  function contents(sealed: boolean) {
    const out: number[] = [];
    for (const cell of cells.filter(c => c.sealed === sealed)) {
      const y = sealed ? cell.height-.015 : Math.max(.34,cell.height-.67)+.035,
        rim = ring(cell,sealed ? .68 : .40,y), top = y+(sealed ? .12 : .035);
      for (let i = 0; i < 12; i++) {
        const k = (i+1)%12;
        geom.tri(out,[cell.x,top,cell.z],rim[k],rim[i],[.86,1,.83]);
        geom.tri(out,[cell.x,y-.035,cell.z],rim[i],rim[k],[.65,.83,.70]);
      }
    }
    return out;
  }

  registerEntityModel({
    id:'faction-1/building/depot',
    meshes:{faction1DepotHull:hull, faction1DepotMembranes:() => contents(true),
      faction1DepotStores:() => contents(false)},
    render({entity:e,part:p,metal,team,accent}) {
      const scale = (e.size || 2.3)/2.3;
      p('faction1DepotHull',0,0,0,scale,1,scale,metal);
      p('faction1DepotMembranes',0,0,0,scale,1,scale,team,0,0,0,.32);
      p('faction1DepotStores',0,0,0,scale,1,scale,accent,0,0,0,.30);
    }
  });
})();
