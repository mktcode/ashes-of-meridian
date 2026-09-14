/* Verdant Choir / Bloom queen: a rooted sovereign, not a mobile unit or a tower.
 * Four grasping limbs surround a heavy segmented abdomen; +Z stays open for workers.
 * Only the abdomen breathes and the two leaf-feelers sway. Nest, head and feet stay fixed. */
'use strict';
(() => {
  const bark = [.64,.79,.60], leaf = [1.05,1.27,.87], armor = [.82,1.05,.83];

  // Closed tapered sweeps for bent limbs, roots and fleshy leaves. The elliptical
  // cross-section is local to the path: no negative scales or double-sided surfaces.
  function growth(out: number[], path: number[][], tint: number[], flat = 1, sides = 8) {
    const rings = path.map((p,i) => {
      const prev = path[Math.max(0,i-1)], next = path[Math.min(path.length-1,i+1)],
        tangent = V.norm(V.sub(next.slice(0,3),prev.slice(0,3))),
        across = V.norm(V.cross(tangent,Math.abs(tangent[1]) > .9 ? [1,0,0] : [0,1,0])),
        normal = V.cross(tangent,across);
      return Array.from({length:sides},(_,j) => {
        const a = j*Math.PI*2/sides;
        return p.slice(0,3).map((v,k) => v+p[3]*(Math.cos(a)*across[k]+Math.sin(a)*normal[k]*flat));
      });
    });
    for (let i = 0; i < rings.length-1; i++) for (let j = 0; j < sides; j++) {
      const k = (j+1)%sides;
      geom.tri(out,rings[i][j],rings[i][k],rings[i+1][k],tint);
      geom.tri(out,rings[i][j],rings[i+1][k],rings[i+1][j],tint);
    }
    for (const i of [0,path.length-1]) for (let j = 0; j < sides; j++) {
      const k = (j+1)%sides;
      geom.tri(out,path[i].slice(0,3),rings[i][i===0?k:j],rings[i][i===0?j:k],tint);
    }
  }
  function shell(out: number[], x: number, y: number, z: number,
    sx: number, sy: number, sz: number, tint: number[]) {
    ModelMesh.lobedShell(out,{x,y,z,sx,sy,sz,lobes:3,segments:12,rings:5,tint});
  }

  function nest() {
    const out: number[] = [];
    // An incomplete wreath, not another pedestal. The front apron stays low and open.
    for (let i = 0; i < 9; i++) {
      const a = .68+i*(Math.PI*2-1.36)/8, sn = Math.sin(a), cs = Math.cos(a);
      growth(out,[[sn*2.4,.28,cs*2.4,.22],[sn*3.2,.48,cs*3.2,.28],
        [sn*3.65,.28,cs*3.65,.17],[sn*3.95,.11,cs*3.95,.025]],bark,1,6);
    }
    for (const a of [.90,1.65,2.45,3.25,4.1,4.85,5.42]) {
      const sn = Math.sin(a), cs = Math.cos(a);
      growth(out,[[sn*3.65,.23,cs*3.65,.09],[sn*3.35,.55,cs*3.35,.49],
        [sn*3.05,1.04,cs*3.05,.55],[sn*2.68,1.48,cs*2.68,.32],
        [sn*2.46,1.64,cs*2.46,.025]],leaf,.22);
    }
    return out;
  }

  function hull() {
    const out: number[] = [];
    // Narrow upright thorax and a distinct head above the low, broad abdomen.
    ModelMesh.lobedShell(out,{x:0,y:2.62,z:.62,sx:.82,sy:1.30,sz:.73,
      lobes:4,segments:16,rings:7,tint:armor});
    shell(out,0,4.02,1.20,.68,.60,.59,armor);
    growth(out,[[0,3.68,1.65,.04],[0,4.06,1.77,.42],[0,4.40,1.53,.62],
      [0,4.62,1.05,.37],[0,4.59,.79,.025]],leaf,.24);
    for (const side of [-1,1]) {
      // Two pairs of jointed, weight-bearing limbs; no walking/aiming mode.
      growth(out,[[side*.64,3.12,.80,.27],[side*1.52,2.80,1.15,.24],
        [side*2.43,1.85,1.48,.18],[side*2.65,.54,2.36,.08]],armor);
      growth(out,[[side*1.22,2.04,-.70,.28],[side*2.36,2.05,-.85,.25],
        [side*3.10,1.26,-1.55,.17],[side*3.13,.47,-2.30,.075]],armor);
      for (const [x,y,z] of [[1.52,2.80,1.15],[2.43,1.85,1.48],[2.36,2.05,-.85]])
        shell(out,side*x,y,z,.24,.28,.25,leaf);
      for (const offset of [-.15,.15]) {
        growth(out,[[side*2.65,.56,2.36,.095],[side*(2.83+offset),.40,2.61,.07],
          [side*(2.93+offset),.27,2.72,.018]],bark,1,6);
      }
      growth(out,[[side*.28,3.90,1.66,.12],[side*.37,3.64,1.92,.11],
        [side*.16,3.58,2.01,.02]],leaf,1,6);
      // Folded shoulder bracts reinforce the plant silhouette without enclosing the neck.
      growth(out,[[side*.52,2.20,.57,.08],[side*.96,2.69,.71,.39],
        [side*.93,3.26,.57,.31],[side*.62,3.58,.52,.02]],leaf,.22);
    }
    // Three attached crown leaves; the lateral feelers are separate moving parts.
    for (const side of [-1,0,1]) growth(out,[[side*.30,4.35,.91,.05],
      [side*.48,4.77,.74,.25],[side*.58,5.12,.55,.23],
      [side*.64,side===0?5.56:5.27,.38,.02]],leaf,.22);
    return out;
  }

  function abdomen() {
    const out: number[] = [], profile = [[-2.10,.07],[-1.88,.48],[-1.52,.78],[-1.08,.94],
      [-.56,1],[0,.96],[.48,.84],[.91,.63],[1.25,.30],[1.39,.06]], segments = 20;
    const rings = profile.map(([z,r],j) => Array.from({length:segments},(_,i) => {
      const a = i*Math.PI*2/segments, seam = j%2===0?.96:1;
      return [Math.cos(a)*2.08*r*seam,1.06+Math.sin(a)*1.02*r*seam,z];
    }));
    for (let j = 0; j < rings.length-1; j++) for (let i = 0; i < segments; i++) {
      const k = (i+1)%segments, tint = j%2===0 ? [.79,1.08,.76] : [1.12,1.26,.90];
      geom.tri(out,rings[j][i],rings[j][k],rings[j+1][k],tint);
      geom.tri(out,rings[j][i],rings[j+1][k],rings[j+1][i],tint);
    }
    for (const j of [0,profile.length-1]) for (let i = 0; i < segments; i++) {
      const k = (i+1)%segments;
      geom.tri(out,[0,1.06,profile[j][0]],rings[j][j===0?k:i],rings[j][j===0?i:k],armor);
    }
    return out;
  }

  function chambers() {
    const out: number[] = [];
    for (const side of [-1,1]) for (const [z,x] of [[-1.06,1.88],[-.53,2.01],[.03,1.88]])
      shell(out,side*x,1.18,z,.16,.32,.23,[.87,1,.86]);
    return out;
  }
  function senses() {
    const out: number[] = [];
    for (const side of [-1,1]) shell(out,side*.39,4.16,1.83,.22,.10,.11,[.90,1,.90]);
    shell(out,0,2.97,1.33,.20,.32,.105,[.80,1,.85]);
    return out;
  }
  function feeler() {
    const out: number[] = [];
    growth(out,[[0,0,0,.055],[.34,.25,-.02,.08],[.62,.57,-.13,.075],
      [.76,.90,-.22,.025]],bark,1,6);
    growth(out,[[.26,.22,-.02,.04],[.58,.52,-.12,.27],[.80,.88,-.24,.22],
      [.75,1.08,-.35,.015]],leaf,.18);
    return out;
  }

  registerEntityModel({
    id:'faction-1/building/hq',
    meshes:{faction1HqNest:nest, faction1HqHull:hull, faction1HqAbdomen:abdomen,
      faction1HqChambers:chambers, faction1HqSenses:senses, faction1HqFeeler:feeler},
    render({entity:e,time,part:p,metal,team,accent}) {
      const scale = (e.size || 4.4)/4.4, phase = time*1.4+e.id*.61,
        breath = 1+Math.sin(phase)*.018;
      p('faction1HqNest',0,0,0,scale,1,scale,metal);
      p('faction1HqHull',0,0,0,scale,1,scale,metal);
      // Breathing is anchored below the sac, not a whole-creature bob or a collision change.
      p('faction1HqAbdomen',0,.68,-1.10*scale,scale,breath,scale,metal);
      p('faction1HqChambers',0,.68,-1.10*scale,scale,breath,scale,accent,0,0,0,.32);
      p('faction1HqSenses',0,0,0,scale,1,scale,team,0,0,0,.40);
      for (const side of [-1,1]) p('faction1HqFeeler',side*.48*scale,4.38,1.12*scale,
        scale,1,scale,metal,side===1?0:Math.PI,Math.sin(phase*.43+side)*.035);
    }
  });
})();
