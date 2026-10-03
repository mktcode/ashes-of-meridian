/* Bloom queen: a pollen-fleeced, bumblebee-like sovereign cradled in FIVE broad petals.
 * Rounded head, no neck, six tucked legs and veined leaf wings; no mound or mantis stance.
 * All detailed surfaces are built once. Only the plump abdomen breathes and antennae sway. */
'use strict';
(() => {
  type Point = number[];
  const moss = [.68,.90,.62], pollen = [1.50,1.36,.72], shade = [.44,.66,.51];

  // Area-weighted, crease-aware normals are local to this model. Pollen color bands
  // stay crisp but their lighting is rounded; thin petal edges never smooth inside-out.
  function soften(mesh: number[]) {
    const shared = new Map<string,{area: Point; unit: Point}[]>(), keys: string[] = [], faces: Point[] = [];
    for (let i = 0; i < mesh.length; i += 27) {
      const a = mesh.slice(i,i+3), b = mesh.slice(i+9,i+12), c = mesh.slice(i+18,i+21),
        area = V.cross(V.sub(b,a),V.sub(c,a)), unit = V.norm(area);
      faces.push(unit);
      for (const j of [i,i+9,i+18]) {
        const key = mesh.slice(j,j+3).map(v => Math.round(v*1e6)).join(','), list = shared.get(key)||[];
        list.push({area,unit}); shared.set(key,list); keys[j/9] = key;
      }
    }
    for (let i = 0; i < mesh.length; i += 9) {
      const face = faces[Math.floor(i/27)], sum = [0,0,0];
      for (const other of shared.get(keys[i/9])!) if (V.dot(face,other.unit)>.15)
        for (let k = 0; k < 3; k++) sum[k] += other.area[k];
      const n = V.norm(sum);
      for (let k = 0; k < 3; k++) mesh[i+3+k] = n[k];
    }
    return mesh;
  }
  function loft(out: number[], rings: Point[][], tint: number[] | ((j: number) => number[])) {
    const color = (j: number) => typeof tint==='function'?tint(j):tint, n = rings[0].length;
    for (let j = 0; j < rings.length-1; j++) for (let i = 0; i < n; i++) {
      const k = (i+1)%n;
      geom.tri(out,rings[j][i],rings[j][k],rings[j+1][k],color(j));
      geom.tri(out,rings[j][i],rings[j+1][k],rings[j+1][i],color(j));
    }
    for (const j of [0,rings.length-1]) {
      const center = rings[j].reduce((sum,p) => sum.map((v,k) => v+p[k]/n),[0,0,0]);
      for (let i = 0; i < n; i++) {
        const k = (i+1)%n;
        geom.tri(out,center,rings[j][j===0?k:i],rings[j][j===0?i:k],color(j));
      }
    }
  }
  function tube(out: number[], path: Point[], tint: number[], sides = 6) {
    let across = [1,0,0];
    const rings = path.map((p,i) => {
      const a = path[Math.max(0,i-1)], b = path[Math.min(path.length-1,i+1)],
        tangent = V.norm(V.sub(b.slice(0,3),a.slice(0,3))), dot = V.dot(across,tangent);
      // Transport the frame instead of flipping axes at a bend.
      across = V.sub(across,tangent.map(v => v*dot));
      if (Math.hypot(...across)<.01) across = V.cross(tangent,[0,0,1]);
      across = V.norm(across);
      const up = V.cross(tangent,across);
      return Array.from({length:sides},(_,j) => {
        const angle = j*Math.PI*2/sides;
        return p.slice(0,3).map((v,k) => v+p[3]*(Math.cos(angle)*across[k]+Math.sin(angle)*up[k]));
      });
    });
    loft(out,rings,tint);
  }
  function egg(out: number[], center: Point, size: Point, tint: number[] | ((j: number) => number[]),
    segments = 24, rows = 12, yaw = 0) {
    const [sx,sy,sz] = size, cs = Math.cos(yaw), sn = Math.sin(yaw);
    const point = (i: number,j: number) => {
      const a = i%segments*Math.PI*2/segments, b = j*Math.PI/rows,
        r = j===0||j===rows?0:Math.sin(b), x = Math.cos(a)*r*sx, z = -Math.cos(b)*sz;
      return [center[0]+x*cs+z*sn,center[1]+Math.sin(a)*r*sy,center[2]-x*sn+z*cs];
    };
    for (let j = 0; j < rows; j++) for (let i = 0; i < segments; i++) {
      const a = point(i,j), b = point(i+1,j), c = point(i+1,j+1), d = point(i,j+1),
        color = typeof tint==='function'?tint(j):tint;
      if (j>0) geom.tri(out,a,b,c,color);
      if (j<rows-1) geom.tri(out,a,c,d,color);
    }
  }
  function tuft(out: number[], p: Point, normal: Point, length: number, tint: number[]) {
    // Bury the root of each tiny fleece tuft: no cactus spines or dark floating flecks.
    p = p.map((v,k) => v-normal[k]*.035);
    const across = V.norm(V.cross(normal,[0,0,1])), up = V.cross(normal,across),
      tip = p.map((v,k) => v+normal[k]*length+(k===2?-.025:0)),
      base = Array.from({length:3},(_,i) => p.map((v,k) => v+.035*(
        Math.cos(i*Math.PI*2/3)*across[k]+Math.sin(i*Math.PI*2/3)*up[k])));
    for (let i = 0; i < 3; i++) geom.tri(out,base[i],base[(i+1)%3],tip,tint);
    geom.tri(out,base[2],base[1],base[0],tint);
  }

  const petalProfile = [[.52,.12,.38],[1.12,.60,.30],[1.90,1.05,.20],[2.72,1.36,.20],
    [3.45,1.12,.34],[3.96,.59,.51],[4.20,.035,.61]];
  function petalPoint(angle: number, r: number, u: number, y: number) {
    return [Math.sin(angle)*r+Math.cos(angle)*u,y,Math.cos(angle)*r-Math.sin(angle)*u];
  }
  function flower() {
    const out: number[] = [], cross = [[1,0],[.7,.08],[0,.13],[-.7,.08],
      [-1,0],[-.65,-.07],[0,-.105],[.65,-.07]];
    // Two samples per span retain broad rounded tips and visible notches between FIVE lobes.
    const profile: Point[] = [];
    for (let j = 0; j < petalProfile.length-1; j++) {
      const a = petalProfile[Math.max(0,j-1)], b = petalProfile[j], c = petalProfile[j+1],
        d = petalProfile[Math.min(petalProfile.length-1,j+2)];
      profile.push(b,b.map((v,k) => (-a[k]+9*v+9*c[k]-d[k])/16));
    }
    profile.push(petalProfile[petalProfile.length-1]);
    for (let i = 0; i < 5; i++) {
      const angle = i*Math.PI*2/5;
      const rings = profile.map(([r,w,y]) => cross.map(([u,h]) =>
        petalPoint(angle,r,u*w,y+h*Math.min(1,w/.5))));
      loft(out,rings,j => {
        const t = j/(profile.length-1);
        return [.66+.50*t,.46+.61*t,.68+.47*t];
      });
      // Veins follow the actual petal surface, rather than floating above its curves.
      const surface = (r: number,u: number) => {
        let j = 0;
        while (j<profile.length-2 && profile[j+1][0]<r) j++;
        const t = (r-profile[j][0])/(profile[j+1][0]-profile[j][0]),
          w = profile[j][1]*(1-t)+profile[j+1][1]*t,
          y = profile[j][2]*(1-t)+profile[j+1][2]*t, a = Math.abs(u),
          top = (a<.7?.13-.05*a/.7:.08*(1-a)/.3)*Math.min(1,w/.5);
        return petalPoint(angle,r,u*w,y+top+.013);
      };
      tube(out,petalProfile.slice(1,-1).map(([r]) => [...surface(r,0),.016]),[.58,.43,.64],4);
      for (const j of [2,3,4]) for (const side of [-1,1]) {
        const r = petalProfile[j][0];
        tube(out,[[...surface(r-.28+side*.035,0),.013],[...surface(r,side*.43),.011],
          [...surface(r+.16,side*.78),.005]],[.72,.55,.77],4);
      }
    }
    return soften(out);
  }

  function hull() {
    const out: number[] = [];
    // A small living calyx joins the petals UNDER the bee. No soil, disc, or detached nest stakes.
    egg(out,[0,.55,-.12],[1.86,.44,1.66],moss,24,10);
    egg(out,[0,2.02,.42],[1.38,1.18,1.20],pollen,28,14);
    egg(out,[0,1.98,1.68],[1.00,.88,.84],[.82,1.03,.65],28,14);
    // Six short folded legs cradle the body, never reaching past its flower.
    for (const side of [-1,1]) for (const [z,x] of [[1.35,1.0],[.18,1.45],[-1.02,1.62]]) {
      tube(out,[[side*x,1.43,z,.19],[side*(x+.38),1.05,z+.10,.22],
        [side*(x+.34),.62,z+.37,.16],[side*(x+.12),.48,z+.55,.09]],shade,8);
      egg(out,[side*(x+.12),.49,z+.55],[.21,.13,.28],moss,12,6);
    }
    for (const side of [-1,1]) egg(out,[side*.18,1.55,2.40],[.20,.17,.17],pollen,16,8);
    // A low pollen coronet, not the old triangular mask and tall mantis crest.
    for (const [x,y] of [[-.30,2.68],[0,2.85],[.30,2.68]])
      egg(out,[x,y,1.83],[.18,.16,.14],pollen,12,6);
    // Short moss/pollen fleece catches light along the shoulders; no simulation RNG.
    for (let j = 0; j < 6; j++) for (let i = 0; i < 10; i++) {
      const a = (.09+i*.091)*Math.PI, b = (.23+j*.09)*Math.PI,
        x = Math.cos(a)*Math.sin(b), y = Math.sin(a)*Math.sin(b), z = -Math.cos(b),
        n = V.norm([x/1.38,y/1.18,z/1.20]);
      tuft(out,[x*1.39,2.02+y*1.19,.42+z*1.21],n,.045+.022*Math.sin(i*2+j)**2,pollen);
    }
    return soften(out);
  }
  function abdomen() {
    const out: number[] = [], bands = (j: number) => (j>=3&&j<=5)||(j>=9&&j<=11)?pollen:shade;
    egg(out,[0,1.42,0],[2.02,1.40,1.95],bands,32,16);
    for (let j = 2; j < 14; j++) for (let i = 0; i < 9; i++) {
      const a = (.06+i*.11)*Math.PI, b = (j+.35)*Math.PI/16,
        x = Math.cos(a)*Math.sin(b), y = Math.sin(a)*Math.sin(b), z = -Math.cos(b);
      tuft(out,[x*2.03,1.42+y*1.41,z*1.96],V.norm([x/2.02,y/1.40,z/1.95]),
        .04+.022*Math.sin(i+j*2)**2,bands(j));
    }
    return soften(out);
  }

  function wings() {
    const out: number[] = [];
    for (const side of [-1,1]) {
      const samples = Array.from({length:9},(_,j) => {
        const t = j/8, w = .025+.57*Math.sin(Math.PI*t)**.8;
        return {x:.78+1.36*t, y:2.64+.55*Math.sin(Math.PI*t)-.15*t, z:.50-2.37*t, w};
      });
      const point = (p: typeof samples[number], u: number, h: number) =>
        [side*(p.x+u*p.w*.86),p.y+h,p.z+u*p.w*.51];
      const rings = samples.map(p => Array.from({length:8},(_,i) => {
        const a = i*Math.PI/4;
        return point(p,Math.cos(a),Math.sin(a)*.055);
      }).reverse());
      if (side===-1) for (const r of rings) r.reverse();
      loft(out,rings,[.89,1.08,.87]);
      tube(out,samples.map(p => [...point(p,0,.065),.018]),[.47,.72,.49],4);
      for (const j of [2,4,6]) for (const dir of [-1,1])
        tube(out,[[...point(samples[j-1],0,.065),.013],
          [...point(samples[j],dir*.54,.047),.011],
          [...point(samples[j+1],dir*.78,.04),.005]],[.60,.84,.62],4);
    }
    return soften(out);
  }
  function eyes() {
    const out: number[] = [];
    for (const side of [-1,1]) egg(out,[side*.68,2.20,2.24],[.35,.43,.235],
      [.90,1,.92],24,12,side*.32);
    return soften(out);
  }
  function senses() {
    const out: number[] = [];
    for (const side of [-1,1]) {
      egg(out,[side*.57,2.39,2.434],[.07,.095,.042],[1.2,1.25,1.16],12,6);
      egg(out,[side*.82,2.09,2.438],[.035,.06,.025],[.69,1,.84],10,5);
    }
    return soften(out);
  }
  function antenna() {
    const out: number[] = [];
    tube(out,[[0,0,0,.065],[.08,.26,.035,.058],[.27,.48,.09,.049],[.36,.64,.12,.042]],shade,8);
    egg(out,[.36,.66,.12],[.135,.17,.13],pollen,16,8);
    return soften(out);
  }

  registerEntityModel({
    id:'faction-1/building/hq',
    meshes:{faction1HqFlower:flower,faction1HqHull:hull,faction1HqAbdomen:abdomen,
      faction1HqWings:wings,faction1HqEyes:eyes,faction1HqSenses:senses,faction1HqAntenna:antenna},
    render({entity:e,time,nightPart:p,metal,team,accent,surfaceColor,pointLight}) {
      const scale = (e.size||4.4)/4.4, phase = time*1.4+e.id*.61,
        breath = 1+Math.sin(phase)*.014;
      pointLight(0, 2.3, 2.6*scale, 12, team, 4);
      p('faction1HqFlower',0,0,0,scale,1,scale,surfaceColor(accent));
      p('faction1HqHull',0,0,0,scale,1,scale,metal);
      p('faction1HqAbdomen',0,.56,-1.02*scale,scale,breath,scale,metal);
      p('faction1HqWings',0,0,0,scale,1,scale,surfaceColor(team));
      p('faction1HqEyes',0,0,0,scale,1,scale,surfaceColor(0x193931));
      p('faction1HqSenses',0,0,0,scale,1,scale,surfaceColor(team),0,0,0,.35);
      for (const side of [-1,1]) p('faction1HqAntenna',side*.43*scale,2.70,1.86*scale,
        scale,1,scale,metal,side===1?0:Math.PI,Math.sin(phase*.43+side)*.035);
    }
  });
})();
