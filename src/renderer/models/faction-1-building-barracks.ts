/* Verdant Choir / Bloom nursery: three rooted seed pods, with an open brood mouth facing +Z.
 * Static, low silhouette inside the existing size-3 footprint. Only the adapter's tissue glow pulses.
 * Leaves and roots are baked at upload; no shared material, collision or production changes. */
'use strict';
(() => {
  const pods = [
    { x: -.98, z: -.82, scale: 1, yaw: -.18 },
    { x: 1.22, z: -.55, scale: .69, yaw: .4 },
    { x: .12, z: .85, scale: .85, yaw: 0 }
  ];
  const leafTint = [1.02, 1.18, .86], rootTint = [.64, .76, .61];

  // A thick curved blade, not a flattened sphere. Closed cross-sections keep both the
  // underside of an opened bract and its raised midrib visible without double-sided rendering.
  function leaf(out: number[], x: number, z: number, angle: number, scale: number, opened = false) {
    const path = opened
      ? [[.16,.25,.12], [.60,.48,.43], [.94,.85,.58], [1.05,1.35,.48], [.96,1.85,.25], [1.08,2.12,.025]]
      : [[.12,.22,.12], [.65,.48,.43], [.92,1.14,.58], [.74,1.92,.48], [.32,2.48,.24], [.04,2.76,.025]];
    const cross = [[-1,0], [-.5,.075], [0,.15], [.5,.075], [1,0], [.5,-.045], [0,-.075], [-.5,-.045]],
      sn = Math.sin(angle), cs = Math.cos(angle);
    // One midpoint per span rounds the fleshy contour without adding a frame-time spline.
    const contour: number[][] = [];
    for (let j = 0; j < path.length - 1; j++) {
      const a = path[Math.max(0,j-1)], b = path[j], c = path[j+1], d = path[Math.min(path.length-1,j+2)];
      contour.push(b, b.map((v,k) => (-a[k] + 9*v + 9*c[k] - d[k]) / 16));
    }
    contour.push(path[path.length-1]);
    const rings = contour.map(([r,y,w], j) => cross.map(([side, ridge]) => {
      const radial = r + ridge * (j === 0 || j === contour.length - 1 ? .2 : 1);
      return [x + (sn * radial + cs * side * w) * scale,
        .08 + y * scale, z + (cs * radial - sn * side * w) * scale];
    }));
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < 8; i++) {
      const k = (i + 1) % 8, tint = leafTint.map(v => v * (i < 4 ? 1 : .72) * (1 + j * .0125));
      geom.tri(out, rings[j][i], rings[j][k], rings[j + 1][k], tint);
      geom.tri(out, rings[j][i], rings[j + 1][k], rings[j + 1][i], tint);
    }
    // Caps use interior points rather than repeated zero-width tips.
    for (const j of [0, rings.length - 1]) {
      const center = rings[j].reduce((sum, p) => sum.map((v, k) => v + p[k] / 8), [0,0,0]);
      for (let i = 0; i < 8; i++) {
        const k = (i + 1) % 8;
        geom.tri(out, center, rings[j][j === 0 ? k : i], rings[j][j === 0 ? i : k], leafTint);
      }
    }
  }

  function hull() {
    const out: number[] = [], root = geom.cylinder(6, .76);
    // A shallow living mat connects the separate capsules; no central tower or crystal.
    ModelMesh.lobedShell(out, { x:0, y:.28, z:0, sx:2.30, sy:.16, sz:2.22,
      lobes:5, segments:20, rings:4, depth:.10, tint:rootTint });
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + .12, sn = Math.sin(angle), cs = Math.cos(angle);
      // Sit on the shared foundation's top, otherwise most of the root network is buried.
      const points = [[.48,.47], [1.12,.53], [1.90,.45], [2.62,.34]];
      for (let j = 0; j < points.length - 1; j++) {
        const [r,y] = points[j], [q,v] = points[j + 1], bend = Math.sin(i * 2 + j) * .13,
          a = [sn*r + cs*bend, y, cs*r - sn*bend],
          b = [sn*q + cs*bend*.4, v, cs*q - sn*bend*.4],
          dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2], width = .18-j*.045;
        ModelMesh.bake(out, root, { x:(a[0]+b[0])/2, y:(a[1]+b[1])/2, z:(a[2]+b[2])/2,
          sx:width, sy:Math.hypot(dx,dy,dz)+.10, sz:width,
          ry:Math.atan2(dx,dz), rx:Math.atan2(Math.hypot(dx,dz),dy), tint:rootTint });
      }
    }
    for (const pod of pods.slice(0, 2)) for (let i = 0; i < 5; i++)
      leaf(out, pod.x, pod.z, pod.yaw + i * Math.PI * 2 / 5, pod.scale);
    const brood = pods[2];
    // Three peeled-back bracts enclose the rear and sides, leaving a real gap at +Z.
    for (const angle of [Math.PI / 2, Math.PI, Math.PI * 1.5])
      leaf(out, brood.x, brood.z, angle, brood.scale, true);
    const lip: number[] = [];
    ModelMesh.lobedShell(lip, { sx:.83, sy:.13, sz:.97, lobes:3, segments:12, rings:4, tint:leafTint });
    ModelMesh.bake(out, lip, { x:brood.x, y:.32, z:1.30, rx:.10 });
    return out;
  }

  function tissue() {
    const out: number[] = [];
    // Membranes show between the overlapping leaves, rather than sitting above them as lamps.
    for (const pod of pods.slice(0, 2)) ModelMesh.lobedShell(out, {
      x:pod.x, y:.08+1.29*pod.scale, z:pod.z, sx:.72*pod.scale, sy:1.13*pod.scale,
      sz:.72*pod.scale, lobes:5, segments:20, rings:6, tint:[.85,1,.88] });
    ModelMesh.lobedShell(out, { x:.12, y:.47, z:.98, sx:.66, sy:.11, sz:.79,
      lobes:3, segments:12, rings:4, tint:[.70,.92,.75] });
    return out;
  }

  function seeds() {
    const out: number[] = [];
    // Small attached embryos make the open capsule read as a nursery, not a portal.
    for (const [x,z,s] of [[-.20,.65,.18], [.34,.65,.23], [.10,1.10,.16]])
      ModelMesh.lobedShell(out, { x, y:.55+s*.5, z, sx:s, sy:s*1.35, sz:s*.8,
        lobes:3, segments:12, rings:5 });
    return out;
  }

  registerEntityModel({
    id:'faction-1/building/barracks',
    meshes:{ faction1BarracksHull:hull, faction1BarracksTissue:tissue, faction1BarracksSeeds:seeds },
    render({entity:e,nightPart:p,metal,team,accent,pointLight}) {
      const scale = (e.size || 3) / 3;
      pointLight(0, 2.2, 2.5*scale, 10, accent, 4);
      p('faction1BarracksHull',0,0,0,scale,1,scale,metal);
      p('faction1BarracksTissue',0,0,0,scale,1,scale,team,0,0,0,.32);
      p('faction1BarracksSeeds',0,0,0,scale,1,scale,accent,0,0,0,.35);
    }
  });
})();
