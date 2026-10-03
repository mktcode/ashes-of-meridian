    /* Procedural meshes used by the WebGL renderer and battlefield view. */
    'use strict';
    const geom = {
      tri(out: number[], a: number[], b: number[], c: number[], col = [1, 1, 1], normal: number[] | null = null) {
        let n = normal || V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
        for (let p of [a, b, c]) out.push(...p, ...n, ...col);
      },
      box() {
        let o: number[] = [];
        for (let [a, b, c, d] of [
          [
            [-0.5, 0.5, -0.5],
            [-0.5, 0.5, 0.5],
            [0.5, 0.5, 0.5],
            [0.5, 0.5, -0.5]
          ],
          [
            [-0.5, -0.5, 0.5],
            [-0.5, -0.5, -0.5],
            [0.5, -0.5, -0.5],
            [0.5, -0.5, 0.5]
          ],
          [
            [0.5, -0.5, -0.5],
            [0.5, 0.5, -0.5],
            [0.5, 0.5, 0.5],
            [0.5, -0.5, 0.5]
          ],
          [
            [-0.5, -0.5, 0.5],
            [-0.5, 0.5, 0.5],
            [-0.5, 0.5, -0.5],
            [-0.5, -0.5, -0.5]
          ],
          [
            [0.5, -0.5, 0.5],
            [0.5, 0.5, 0.5],
            [-0.5, 0.5, 0.5],
            [-0.5, -0.5, 0.5]
          ],
          [
            [-0.5, -0.5, -0.5],
            [-0.5, 0.5, -0.5],
            [0.5, 0.5, -0.5],
            [0.5, -0.5, -0.5]
          ]
        ]) {
          this.tri(o, a, b, c);
          this.tri(o, a, c, d);
        }
        return o;
      },
      cylinder(n = 10, top = 1) {
        let o: number[] = [];
        for (let i = 0; i < n; i++) {
          let a = (i / n) * Math.PI * 2,
            b = ((i + 1) / n) * Math.PI * 2,
            p = [Math.cos(a), -0.5, Math.sin(a)],
            q = [Math.cos(b), -0.5, Math.sin(b)],
            r = [Math.cos(b) * top, 0.5, Math.sin(b) * top],
            s = [Math.cos(a) * top, 0.5, Math.sin(a) * top];
          this.tri(o, p, r, q);
          if (top > 0) this.tri(o, p, s, r);
          this.tri(o, [0, -0.5, 0], p, q);
          if (top > 0) this.tri(o, [0, 0.5, 0], r, s);
        }
        return o;
      },
      // Shared Choir foundation: a low earth mound with an uneven, feathered edge.
      // Fixed contour, 40 triangles; no entity/world RNG and no vertical platform walls.
      choirMound() {
        const out: number[] = [], radii = [1.02,.87,1.07,.93,.99,.86,1.06,.90,1.03,.95],
          heights = [.26,.29,.24,.28,.23,.27,.25,.30,.24,.26],
          outer = radii.map((r, i) => {
            const a = i * Math.PI / 5;
            // Bury the rim just below the world's -.13 ground plane, avoiding a raised seam.
            return [Math.cos(a)*r, -.14, Math.sin(a)*r];
          }),
          shoulder = radii.map((r, i) => {
            const a = i * Math.PI / 5 + .06;
            return [Math.cos(a)*r*.64, heights[i], Math.sin(a)*r*.64];
          });
        for (let i = 0; i < 10; i++) {
          const k = (i+1)%10, shade = .88 + (i%3)*.045,
            tint = [shade, shade*.96, shade*.87];
          this.tri(out, [.04,.28,-.03], shoulder[k], shoulder[i], tint);
          this.tri(out, shoulder[i], shoulder[k], outer[k], tint);
          this.tri(out, shoulder[i], outer[k], outer[i], tint);
          this.tri(out, [0,-.18,0], outer[i], outer[k], tint);
        }
        return out;
      },
      octa() {
        let o: number[] = [],
          top = [0, 1, 0],
          bottom = [0, -1, 0],
          ring = [
            [1, 0, 0],
            [0, 0, 1],
            [-1, 0, 0],
            [0, 0, -1]
          ];
        for (let i = 0; i < 4; i++) {
          this.tri(o, top, ring[(i + 1) % 4], ring[i]);
          this.tri(o, bottom, ring[i], ring[(i + 1) % 4]);
        }
        return o;
      },
      sphere(n = 10, r = 6) {
        let o: number[] = [];
        for (let j = 0; j < r; j++)
          for (let i = 0; i < n; i++) {
            let p = (i: number, j: number) => {
              let a = (i / n) * Math.PI * 2,
                b = (j / r) * Math.PI;
              return [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)];
            };
            let a = p(i, j),
              b = p(i + 1, j),
              c = p(i + 1, j + 1),
              d = p(i, j + 1);
            this.tri(o, a, b, c);
            this.tri(o, a, c, d);
          }
        return o;
      },
      // A rooted six-sided prism with a beveled foot and an asymmetric faceted tip.
      crystal() {
        const o: number[] = [],
          n = 6,
          angles = [0, 1.02, 2.13, 3.18, 4.25, 5.26],
          shoulders = [0.7, 0.76, 0.65, 0.72, 0.79, 0.68];
        const rings = [
          angles.map(a => [Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7]),
          angles.map(a => [Math.cos(a), 0.18, Math.sin(a)]),
          angles.map((a, i) => [Math.cos(a) * 0.83, shoulders[i], Math.sin(a) * 0.83])
        ];
        const shades = [0.86, 1, 0.9, 0.78, 0.95, 0.83],
          tint = (i: number, gain: number) => [shades[i] * gain, shades[i] * gain * 0.98, shades[i] * gain * 0.92];
        for (let i = 0; i < n; i++) {
          let k = (i + 1) % n;
          for (let j = 0; j < 2; j++) {
            let a = rings[j][i],
              b = rings[j][k],
              c = rings[j + 1][k],
              d = rings[j + 1][i];
            this.tri(o, a, d, c, tint(i, j === 0 ? 0.7 : 1));
            this.tri(o, a, c, b, tint(i, j === 0 ? 0.7 : 1));
          }
          this.tri(o, [0.18, 1, -0.13], rings[2][k], rings[2][i], tint(i, 1.08));
          this.tri(o, [0, 0, 0], rings[0][i], rings[0][k], tint(i, 0.65));
        }
        return o;
      },
      // Faction 0 worker: one cached chassis with chamfered armor, capsule tracks and road wheels.
      // Tints are relative to its ochre paint; lamps, tool and carried ore remain separate.
      workerHull() {
        const out: number[] = [], box = this.box(), wheel = this.cylinder(10), hub = this.cylinder(6),
          paint = [1, 1, 1], dark = [.21, .33, .54], metal = [.54, .74, 1.08],
          tread = [.26, .31, .39];
        const part = (mesh: number[], x: number, y: number, z: number, w: number, h: number, d: number, col: number[], rx = 0, rz = 0) => {
          const cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
          for (let i = 0; i < mesh.length; i += 27) {
            const points = [];
            for (let j = i; j < i + 27; j += 9) {
              const px = mesh[j] * w, py = mesh[j + 1] * h, pz = mesh[j + 2] * d,
                yy = py * cx - pz * sx, zz = py * sx + pz * cx;
              points.push([x + px * cz - yy * sz, y + px * sz + yy * cz, z + zz]);
            }
            this.tri(out, points[0], points[1], points[2], col);
          }
        };
        const armor = (x: number, y: number, z: number, w: number, h: number, d: number, col: number[]) => {
          const rings = [[.83, -.5], [1, -.30], [1, .27], [.79, .5]].map(([s, t]) =>
            [[-.36,.5],[.36,.5],[.5,.36],[.5,-.36],[.36,-.5],[-.36,-.5],[-.5,-.36],[-.5,.36]]
              .map(([a,b]) => [x + a*w*s, y + t*h, z + b*d*s]));
          for (let i = 0; i < 8; i++) {
            const k = (i + 1) % 8;
            for (let j = 0; j < 3; j++) {
              const shade = col.map(v => v * (j === 2 ? 1.12 : j === 0 ? .7 : 1));
              this.tri(out, rings[j][i], rings[j][k], rings[j + 1][k], shade);
              this.tri(out, rings[j][i], rings[j + 1][k], rings[j + 1][i], shade);
            }
            this.tri(out, [x,y+h/2,z], rings[3][i], rings[3][k], col);
            this.tri(out, [x,y-h/2,z], rings[0][k], rings[0][i], dark);
          }
        };
        armor(0, .55, 0, 1.25, .65, 1.5, paint);
        armor(0, 1.04, -.12, .85, .4, .8, metal);
        armor(0, .93, -.61, .7, .24, .34, dark);
        // Equally spaced shoes follow the flat runs and rounded ends of each track.
        const contour = [], run = 1.18, arc = Math.PI * .24, length = 2 * (run + arc);
        for (let i = 0; i < 24; i++) {
          const t = i * length / 24;
          if (t < run) contour.push([.54, -.59 + t]);
          else if (t < run + arc) {
            const a = (t - run) / .24;
            contour.push([.3 + .24 * Math.cos(a), .59 + .24 * Math.sin(a)]);
          } else if (t < 2 * run + arc) contour.push([.06, .59 - (t - run - arc)]);
          else {
            const a = Math.PI + (t - 2 * run - arc) / .24;
            contour.push([.3 + .24 * Math.cos(a), -.59 + .24 * Math.sin(a)]);
          }
        }
        for (const side of [-1, 1]) {
          const x = side * .72, left = x - .155, right = x + .155;
          for (let i = 0; i < contour.length; i++) {
            const [y,z] = contour[i], [yy,zz] = contour[(i + 1) % contour.length],
              a = [left,y,z], b = [right,y,z], c = [right,yy,zz], d = [left,yy,zz];
            this.tri(out, b, a, d, tread); this.tri(out, b, d, c, tread);
            this.tri(out, [right,.3,0], b, c, dark);
            this.tri(out, [left,.3,0], d, a, dark);
            part(box, x, (y+yy)/2, (z+zz)/2, .33, .05, Math.hypot(yy-y,zz-z)*.72,
              tread, Math.atan2(y-yy, zz-z));
          }
          for (const z of [-.52, 0, .52]) {
            part(wheel, side * .856, .3, z, .185, .052, .185, metal, 0, Math.PI/2);
            part(hub, side * .881, .3, z, .075, .016, .075, paint, 0, Math.PI/2);
          }
          part(box, side * .61, .72, -.08, .14, .12, 1.18, metal);
          part(box, side * .43, .57, .685, .22, .17, .07, dark);
        }
        for (let i = -2; i <= 2; i++)
          part(box, i * .10, 1.057, -.61, .045, .025, .22, metal);
        return out;
      },
      // Fluted drill bit, along +Y like the existing cone; no per-frame mesh generation.
      workerDrill() {
        const out: number[] = [], rings = [], n = 12;
        for (let j = 0; j < 5; j++) {
          const y = -.5 + j * .19, radius = 1 - j * .18;
          rings.push(Array.from({length:n}, (_,i) => {
            const a = i / n * Math.PI * 2 + j * .18, r = radius * (i % 2 ? .69 : 1);
            return [Math.sin(a)*r, y, Math.cos(a)*r];
          }));
        }
        for (let i = 0; i < n; i++) {
          const k = (i + 1) % n, shade = i % 2 ? [.72,.77,.8] : [1,1,1];
          for (let j = 0; j < rings.length - 1; j++) {
            this.tri(out, rings[j][i], rings[j][k], rings[j+1][k], shade);
            this.tri(out, rings[j][i], rings[j+1][k], rings[j+1][i], shade);
          }
          this.tri(out, rings[4][i], rings[4][k], [0,.5,0], shade);
          this.tri(out, [0,-.5,0], rings[0][k], rings[0][i], [.6,.65,.7]);
        }
        return out;
      },
      // Faction 0 turret: fixed hexagonal pedestal and independently aimed twin-gun assembly.
      // Baked once; relative metal tints preserve team/ghost/construction rendering.
      turretAssembly() {
        const turretBase: number[] = [], turretHead: number[] = [], box = this.box(),
          metal = [1, 1, 1], dark = [.38, .43, .49], edge = [1.28, 1.22, 1.13];
        const part = (out: number[], x: number, y: number, z: number, w: number, h: number, d: number, col: number[], yaw = 0) => {
          const cs = Math.cos(yaw), sn = Math.sin(yaw);
          for (let i = 0; i < box.length; i += 27) {
            const points = [];
            for (let j = i; j < i + 27; j += 9) {
              const px = box[j]*w, pz = box[j+2]*d;
              points.push([x+px*cs+pz*sn, y+box[j+1]*h, z-px*sn+pz*cs]);
            }
            this.tri(out, points[0], points[1], points[2], col);
          }
        };
        const armor = (out: number[], x: number, y: number, z: number, w: number, h: number, d: number, col: number[]) => {
          const rings = [[.82,-.5],[1,-.3],[1,.28],[.82,.5]].map(([s,t]) =>
            [[-.36,.5],[.36,.5],[.5,.36],[.5,-.36],[.36,-.5],[-.36,-.5],[-.5,-.36],[-.5,.36]]
              .map(([a,b]) => [x+a*w*s, y+t*h, z+b*d*s]));
          for (let i = 0; i < 8; i++) {
            const k = (i+1)%8;
            for (let j = 0; j < 3; j++) {
              const tint = col.map(v => v*(j === 2 ? 1.1 : j === 0 ? .75 : 1));
              this.tri(out, rings[j][i], rings[j][k], rings[j+1][k], tint);
              this.tri(out, rings[j][i], rings[j+1][k], rings[j+1][i], tint);
            }
            this.tri(out, [x,y+h/2,z], rings[3][i], rings[3][k], col);
            this.tri(out, [x,y-h/2,z], rings[0][k], rings[0][i], dark);
          }
        };
        // Profile can turn inward at a muzzle: annular lip, inner bore and recessed end.
        const profile = (out: number[], n: number, levels: number[][], colors: number[][], x = 0, y = 0, z = 0, barrel = false) => {
          const point = (i: number, j: number) => {
            const a = i/n*Math.PI*2, [r,h] = levels[j], px = Math.sin(a)*r, pz = Math.cos(a)*r;
            return barrel ? [x+px,y-pz,z+h] : [x+px,y+h,z+pz];
          };
          for (let i = 0; i < n; i++) {
            for (let j = 0; j < levels.length-1; j++) {
              const a = point(i,j), b = point(i+1,j), c = point(i+1,j+1), d = point(i,j+1);
              this.tri(out, a,b,c,colors[j]); this.tri(out, a,c,d,colors[j]);
            }
            const last = levels.length-1,
              center = (j: number) => barrel ? [x,y,z+levels[j][1]] : [x,y+levels[j][1],z];
            this.tri(out, center(0),point(i+1,0),point(i,0),dark);
            this.tri(out, center(last),point(i,last),point(i+1,last),colors.at(-1));
          }
        };
        profile(turretBase, 6, [[1.22,.15],[1.35,.26],[1.35,.70],[1.16,.95]], [dark,metal,edge]);
        profile(turretBase, 12, [[.57,.78],[.62,.92],[.53,1.88],[.57,2.04]], [dark,metal,edge]);
        profile(turretBase, 24, [[.67,1.77],[.75,1.83],[.75,1.96],[.66,2.05]], [dark,dark,edge]);
        for (let i = 0; i < 6; i++) {
          const a = i/6*Math.PI*2, x = Math.sin(a), z = Math.cos(a);
          part(turretBase, x*.49,1.33,z*.49,.16,.93,.19,edge,a);
          profile(turretBase, 6, [[.09,1.015],[.09,1.06]], [edge],x*1.02,0,z*1.02);
          part(turretBase, x*.99,.97,z*.99,.30,.08,.30,dark,a);
        }
        armor(turretHead, 0,2.28,0,1.9,.9,1.5,metal);
        armor(turretHead, 0,2.65,-.2,1.5,.18,1.3,dark);
        for (const side of [-1,1]) {
          armor(turretHead, side*.80,2.26,-.10,.36,.60,1.05,edge);
          profile(turretHead, 12,
            [[.11,.35],[.16,.50],[.16,.85],[.115,.95],[.115,1.52],[.16,1.56],[.16,1.85],[.085,1.85],[.085,1.65]],
            [metal,metal,dark,dark,metal,metal,edge,dark,dark], side*.52,2.3,0,true);
          for (let j = 0; j < 3; j++) {
            part(turretHead, side*.52,2.3,.53+j*.11,.36,.36,.035,dark);
            profile(turretHead, 6, [[.045,2.741],[.045,2.77]], [edge],side*.51,0,-.62+j*.37);
          }
        }
        part(turretHead, 0,2.28,-.755,1.1,.37,.035,dark);
        for (let i = -3; i <= 3; i++)
          part(turretHead, i*.14,2.28,-.783,.035,.30,.025,edge);
        // Recessed sensor socket; cyan optics and identification marks remain separate.
        armor(turretHead, 0,2.3,.72,.52,.40,.20,dark);
        return { turretBase, turretHead };
      },
      // Unit-sized cargo shell with clipped corners and bevelled lid/foot edges.
      supplyCrateHull() {
        const out: number[] = [];
        const ring = (inset: number, y: number) => {
          const r = .5 - inset, c = .11;
          return [[-r+c,r],[r-c,r],[r,r-c],[r,-r+c],
            [r-c,-r],[-r+c,-r],[-r,-r+c],[-r,r-c]].map(([x,z]) => [x,y,z]);
        };
        const rings = [ring(.055,-.5),ring(0,-.42),ring(0,.42),ring(.055,.5)];
        for (let i = 0; i < 8; i++) {
          const k = (i + 1) % 8;
          for (let j = 0; j < 3; j++) {
            const shade = j === 1 ? [1,1,1] : [1.16,1.16,1.16];
            this.tri(out,rings[j][i],rings[j][k],rings[j+1][k],shade);
            this.tri(out,rings[j][i],rings[j+1][k],rings[j+1][i],shade);
          }
          this.tri(out,[0,.5,0],rings[3][i],rings[3][k],[1,1,1]);
          this.tri(out,[0,-.5,0],rings[0][k],rings[0][i],[.7,.7,.7]);
        }
        return out;
      },
      // Faction 0 HQ armor, baked at its existing world dimensions.
      // Vertex tints multiply the faction metal (also preserving preview/ghost tinting).
      commandHull() {
        const out: number[] = [], dark = [.4, .45, .5], metal = [1, 1, 1], roof = [1.42, 1.3, 1.17];
        const panel = (x: number, y: number, z: number, w: number, h: number, d: number, bevel: number, col: number[]) => {
          const ring = (inset: number, height: number) => {
            const a = w / 2 - inset, b = d / 2 - inset,
              c = Math.min(w, d) * .13;
            return [[-a+c,b], [a-c,b], [a,b-c], [a,-b+c],
              [a-c,-b], [-a+c,-b], [-a,-b+c], [-a,b-c]]
              .map(([px, pz]) => [x + px, height, z + pz]);
          };
          const rings = [ring(bevel, y-h/2), ring(0, y-h/2+bevel),
            ring(0, y+h/2-bevel), ring(bevel, y+h/2)];
          for (let i = 0; i < 8; i++) {
            const k = (i + 1) % 8;
            for (let j = 0; j < 3; j++) {
              const shade = col.map(v => v * (j === 0 ? .8 : j === 2 ? 1.12 : 1));
              this.tri(out, rings[j][i], rings[j][k], rings[j + 1][k], shade);
              this.tri(out, rings[j][i], rings[j + 1][k], rings[j + 1][i], shade);
            }
            this.tri(out, [x, y+h/2, z], rings[3][i], rings[3][k], col);
            this.tri(out, [x, y-h/2, z], rings[0][k], rings[0][i], dark);
          }
        };
        panel(0, .42, 0, 6.7, .38, 4.85, .1, dark);
        panel(0, 1.45, 0, 6.5, 2.6, 4.6, .22, metal);
        panel(0, 2.91, -.4, 5.65, .5, 4.2, .12, dark);
        panel(0, 3.25, -.5, 4.9, .35, 3.6, .10, metal);
        panel(0, 3.47, -.55, 4.25, .14, 2.9, .035, roof);
        for (const side of [-1, 1]) {
          panel(side * 3.4, 1.2, -.4, 1.15, 2.2, 3.7, .18, dark);
          for (let j = 0; j < 3; j++)
            panel(side * 3.43, 2.32, j * .95 - 1.35, 1.04, .24, .64, .06, metal);
          panel(side * 2.23, 1.36, 2.13, .72, 2.42, .96, .16, metal);
          panel(side * 2.23, 2.59, 2.12, .82, .22, 1.02, .06, roof);
        }
        panel(0, .22, 3.7, 2.45, .22, .55, .055, metal);
        return out;
      },
      // One reusable metal mesh: beveled deck, segmented apron and four retaining clamps.
      // Emissive rings and the animated crystal are drawn separately by renderEntity.
      aetherVent() {
        const out: number[] = [], box = this.box(), tau = Math.PI * 2,
          dark = [.16, .20, .24], metal = [.34, .40, .44], edge = [.48, .54, .55],
          deck = [.25, .30, .36];
        const point = (r: number, y: number, a: number) => [Math.sin(a) * r, y, Math.cos(a) * r * .9];
        const profile = (n: number, levels: number[][], colors: number[][]) => {
          for (let i = 0; i < n; i++) {
            const a = (i + .5) / n * tau, b = (i + 1.5) / n * tau;
            for (let j = 0; j < levels.length - 1; j++) {
              const [r, y] = levels[j], [s, h] = levels[j + 1],
                p = point(r, y, a), q = point(r, y, b),
                u = point(s, h, a), v = point(s, h, b), col = colors[j];
              this.tri(out, p, q, v, col);
              this.tri(out, p, v, u, col);
            }
            const [r, y] = levels.at(-1)!;
            this.tri(out, [0, y, 0], point(r, y, a), point(r, y, b), colors.at(-1));
            const [br, by] = levels[0];
            this.tri(out, [0, by, 0], point(br, by, b), point(br, by, a), dark);
          }
        };
        const part = (a: number, r: number, y: number, w: number, h: number, d: number, col: number[]) => {
          const cs = Math.cos(a), sn = Math.sin(a);
          for (let i = 0; i < box.length; i += 27) {
            const points = [];
            for (let k = 0; k < 27; k += 9) {
              const x = box[i + k] * w, z = box[i + k + 2] * d + r;
              points.push([x * cs + z * sn, box[i + k + 1] * h + y, (-x * sn + z * cs) * .9]);
            }
            this.tri(out, points[0], points[1], points[2], col);
          }
        };
        profile(16, [[1.83, -.04], [1.95, .08], [1.95, .18], [1.78, .30]], [dark, metal, edge, metal]);
        profile(32, [[1.65, .22], [1.73, .34], [1.73, .44], [1.55, .48]], [dark, dark, metal, dark]);
        profile(8, [[1.48, .38], [1.57, .53], [1.57, .65], [1.36, .84]], [dark, dark, edge, deck]);
        // Recessed central plate and raised crystal socket.
        profile(8, [[1.10, .842], [1.03, .88]], [dark, metal]);
        profile(8, [[.48, .88], [.48, .94], [.36, .98]], [dark, edge, dark]);
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * tau;
          part(a, 1.77, .26, .32, .13, .29, i % 2 ? metal : edge);
          part(a, 1.83, .332, .18, .014, .035, dark);
        }
        for (let i = 0; i < 4; i++) {
          const a = (i + .5) / 4 * tau;
          part(a, 1.66, .50, .29, .67, .28, dark);
          part(a, 1.72, .91, .20, .90, .20, metal);
          part(a, 1.69, 1.37, .24, .08, .24, edge);
          part(a, 1.49, .77, .32, .16, .40, edge);
          part(a, 1.18, .867, .08, .05, .08, edge);
        }
        return out;
      },
      // Reusable, irregular rock meshes; this RNG never advances the map-layout stream.
      rock(seed: number, kind: 'boulder' | 'crag' | 'ridge' | 'shelf') {
        const rand = seeded(seed),
          o: number[] = [],
          n = 9,
          profiles = {
            boulder: [
              [0, 0.7],
              [0.24, 1],
              [0.64, 0.87],
              [0.91, 0.4]
            ],
            crag: [
              [0, 0.8],
              [0.27, 1],
              [0.65, 0.57],
              [1.12, 0.13]
            ],
            ridge: [
              [0, 0.83],
              [0.18, 1],
              [0.57, 0.78],
              [0.83, 0.34]
            ],
            shelf: [
              [0, 0.8],
              [0.1, 1],
              [0.23, 0.83],
              [0.34, 0.94],
              [0.46, 0.52]
            ]
          },
          profile = profiles[kind],
          angles = Array.from({ length: n }, (_, i) => ((i + (rand() - 0.5) * 0.36) * Math.PI * 2) / n);
        const rings = profile.map(([height, radius], level) =>
          angles.map(angle => {
            let a = angle + level * 0.045,
              r = radius * (0.79 + rand() * 0.21);
            let x = Math.cos(a) * r + height * 0.1,
              z = Math.sin(a) * r * (kind === 'ridge' ? 0.57 : 1);
            const bound = Math.max(1, Math.hypot(x, z));
            return [x / bound, level === 0 ? 0 : height + (rand() - 0.5) * 0.12, z / bound];
          })
        );
        const tint = (level: number) => {
          let c = 0.88 + (level / profile.length) * 0.18 + (rand() - 0.5) * 0.1;
          return [c, c * 0.98, c * 0.95];
        };
        for (let j = 0; j < rings.length - 1; j++)
          for (let i = 0; i < n; i++) {
            let k = (i + 1) % n,
              a = rings[j][i],
              b = rings[j][k],
              c = rings[j + 1][k],
              d = rings[j + 1][i];
            this.tri(o, a, d, c, tint(j));
            this.tri(o, a, c, b, tint(j));
          }
        const top = rings.at(-1)!,
          crown = [0.08, profile.at(-1)![0] + 0.09, -0.04];
        for (let i = 0; i < n; i++) {
          let k = (i + 1) % n;
          this.tri(o, crown, top[k], top[i], tint(profile.length));
          this.tri(o, [0, 0, 0], rings[0][i], rings[0][k], tint(0));
        }
        return o;
      },
      ring(n = 48, width = 0.055) {
        let o: number[] = [];
        for (let i = 0; i < n; i++) {
          let a = (i / n) * Math.PI * 2,
            b = ((i + 1) / n) * Math.PI * 2,
            p = [Math.cos(a), 0, Math.sin(a)],
            q = [Math.cos(b), 0, Math.sin(b)],
            r = [Math.cos(b) * (1 - width), 0, Math.sin(b) * (1 - width)],
            s = [Math.cos(a) * (1 - width), 0, Math.sin(a) * (1 - width)];
          this.tri(o, p, r, q, [1, 1, 1], [0, 1, 0]);
          this.tri(o, p, s, r, [1, 1, 1], [0, 1, 0]);
        }
        return o;
      },
      plane() {
        let o: number[] = [];
        this.tri(o, [-0.5, 0, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [1, 1, 1], [0, 1, 0]);
        this.tri(o, [-0.5, 0, -0.5], [0.5, 0, 0.5], [0.5, 0, -0.5], [1, 1, 1], [0, 1, 0]);
        return o;
      }
    };
