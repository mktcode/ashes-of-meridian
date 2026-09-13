    /* Dependency-free instanced WebGL2 renderer. */
    'use strict';
    // Standalone model previews also render without a BattlefieldView.
    const DEFAULT_TERRAIN_RENDER_PROFILE = {
      groundTexture: 'ground', skyTexture: 'sky', groundPixelsPerMeter: 14,
      rockDecor: { density: .8, opacity: .18 }, shrubDecor: { density: .1, opacity: .28 }
    };
    class MeridianRenderer {
      constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
          alpha: false,
          antialias: false, // Geometry is multisampled in the scene target, not the final quad.
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false
        });
        if (!this.gl)
          throw Error(
            'WebGL 2 is unavailable. Enable hardware acceleration in your browser and reopen the game.'
          );
        const gl = this.gl;
        this.program = this.programOf(VERT, FRAG);
        this.depthProg = this.programOf(DEPTHV, DEPTHF);
        this.skyProg = this.programOf(FULLV, SKYF);
        this.postProg = this.programOf(FULLV, POSTF);
        this.meshes = {};
        this.static = {};
        this.dynamic = {};
        this.effects = {};
        this.colors = new Map();
        this.quality = 2;
        this.extent = 90;
        this.decorSeed = 0;
        this.battlefieldProfile = DEFAULT_TERRAIN_RENDER_PROFILE;
        this.haze = [0.055, 0.09, 0.13];
        this.eye = [0, 65, 50];
        this.vp = M4.identity();
        this.inverseVP = M4.identity();
        this.frame = 0;
        this.fogOn = false;
        this.cinema = true;
        this.shadowSize = 1536;
        this.uniformCache = new Map();
        this.fullVao = gl.createVertexArray();
        for (let [n, d] of Object.entries({
          box: geom.box(),
          cylinder: geom.cylinder(10),
          hex: geom.cylinder(6),
          cone: geom.cylinder(7, 0),
          octa: geom.octa(),
          sphere: geom.sphere(),
          ring: geom.ring(),
          plane: geom.plane(),
          triRing: geom.ring(3, 0.06),
          rockBoulder: geom.rock(173, 'boulder'),
          rockCrag: geom.rock(397, 'crag'),
          rockRidge: geom.rock(619, 'ridge'),
          rockShelf: geom.rock(853, 'shelf'),
          alloyShard: geom.crystal(),
          aetherVent: geom.aetherVent(),
          commandHull: geom.commandHull(),
          workerHull: geom.workerHull(),
          workerDrill: geom.workerDrill(),
          ...geom.turretAssembly()
        }))
          this.geometry(n, d);
        EntityModels.upload(this);
        // Model/menu previews only need an opaque texel; each world supplies its own raster.
        this.fogSize = 1;
        this.fogTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.fogTex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.R8,
          this.fogSize,
          this.fogSize,
          0,
          gl.RED,
          gl.UNSIGNED_BYTE,
          new Uint8Array([255])
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.groundTex = this.dataTexture([146, 101, 75]);
        this.rockClustersTex = this.dataTexture([0, 0, 0, 0]);
        this.desertShrubsTex = this.dataTexture([0, 0, 0, 0]);
        this.metalTex = this.dataTexture([128, 130, 136]);
        this.bioTex = this.dataTexture([77, 128, 119]);
        this.loadTexture(this.groundTex, MERIDIAN_TEXTURES.ground);
        this.loadTexture(this.rockClustersTex, MERIDIAN_TEXTURES.rockClusters, false);
        this.loadTexture(this.desertShrubsTex, MERIDIAN_TEXTURES.desertShrubs, false);
        this.loadTexture(this.metalTex, MERIDIAN_TEXTURES.metal);
        this.loadTexture(this.bioTex, MERIDIAN_TEXTURES.bio);
        this.skyTex = this.dataTexture([5, 9, 16]);
        this.loadTexture(this.skyTex, MERIDIAN_TEXTURES.sky, false);
        this.shadowTex = gl.createTexture();
        this.shadowFbo = gl.createFramebuffer();
        this.setupShadow();
        this.sceneFbo = gl.createFramebuffer();
        this.sceneTex = gl.createTexture();
        this.sceneDepth = gl.createRenderbuffer();
        this.sceneMSAAFbo = null;
        this.sceneMSAAColor = null;
        this.sceneMSAADepth = null;
        this.sceneSamples = 0;
        this.resize();
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        this.drawCalls = 0;
      }
      programOf(v, f) {
        let gl = this.gl,
          p = gl.createProgram();
        for (let [s, t] of [
          [v, gl.VERTEX_SHADER],
          [f, gl.FRAGMENT_SHADER]
        ]) {
          let sh = gl.createShader(t);
          gl.shaderSource(sh, s);
          gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(sh));
          gl.attachShader(p, sh);
        }
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
        return p;
      }
      uniform(p, k) {
        let map = this.uniformCache.get(p);
        if (!map) {
          map = {};
          this.uniformCache.set(p, map);
        }
        if (!(k in map)) map[k] = this.gl.getUniformLocation(p, k);
        return map[k];
      }
      geometry(name, data) {
        let gl = this.gl;
        if (this.meshes[name]) {
          gl.deleteBuffer(this.meshes[name].vbo);
          gl.deleteVertexArray(this.meshes[name].vao);
        }
        let vao = gl.createVertexArray(),
          vbo = gl.createBuffer();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        for (let [i, offset] of [
          [0, 0],
          [1, 12],
          [8, 24]
        ]) {
          gl.enableVertexAttribArray(i);
          gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 36, offset);
        }
        gl.bindVertexArray(null);
        this.meshes[name] = { vao, vbo, count: data.length / 9 };
      }
      setupShadow() {
        let g = this.gl;
        g.bindTexture(g.TEXTURE_2D, this.shadowTex);
        g.texImage2D(
          g.TEXTURE_2D,
          0,
          g.DEPTH_COMPONENT24,
          this.shadowSize,
          this.shadowSize,
          0,
          g.DEPTH_COMPONENT,
          g.UNSIGNED_INT,
          null
        );
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
        g.bindFramebuffer(g.FRAMEBUFFER, this.shadowFbo);
        g.framebufferTexture2D(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.TEXTURE_2D, this.shadowTex, 0);
        g.drawBuffers([g.NONE]);
        g.readBuffer(g.NONE);
        g.bindFramebuffer(g.FRAMEBUFFER, null);
      }
      resize() {
        let g = this.gl,
          scale =
            this.quality === 0 ? 0.75 : this.quality === 1 ? 1 : Math.min(devicePixelRatio || 1, 1.6);
        // Keep public projection/picking coordinates in CSS client space.
        const rect = this.canvas.getBoundingClientRect();
        this.viewport = { left: rect.left, top: rect.top, width: Math.max(1, rect.width), height: Math.max(1, rect.height),
          right: rect.left + Math.max(1, rect.width), bottom: rect.top + Math.max(1, rect.height) };
        this.width = Math.max(1, Math.round(this.viewport.width * scale));
        this.height = Math.max(1, Math.round(this.viewport.height * scale));
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        g.bindTexture(g.TEXTURE_2D, this.sceneTex);
        g.texImage2D(
          g.TEXTURE_2D,
          0,
          g.RGBA8,
          this.width,
          this.height,
          0,
          g.RGBA,
          g.UNSIGNED_BYTE,
          null
        );
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
        g.bindRenderbuffer(g.RENDERBUFFER, this.sceneDepth);
        g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_COMPONENT24, this.width, this.height);
        g.bindFramebuffer(g.FRAMEBUFFER, this.sceneFbo);
        g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, this.sceneTex, 0);
        g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, this.sceneDepth);
        this.resizeSceneMSAA();
        g.bindRenderbuffer(g.RENDERBUFFER, null);
        g.bindFramebuffer(g.FRAMEBUFFER, null);
      }
      releaseSceneMSAA() {
        const g = this.gl;
        if (this.sceneMSAAFbo) g.deleteFramebuffer(this.sceneMSAAFbo);
        if (this.sceneMSAAColor) g.deleteRenderbuffer(this.sceneMSAAColor);
        if (this.sceneMSAADepth) g.deleteRenderbuffer(this.sceneMSAADepth);
        this.sceneMSAAFbo = this.sceneMSAAColor = this.sceneMSAADepth = null;
        this.sceneSamples = 0;
      }
      resizeSceneMSAA() {
        const g = this.gl;
        this.releaseSceneMSAA();
        if (this.quality === 0) return;
        // Both attachments must support the same count. Never exceed 4x.
        const color = Array.from(g.getInternalformatParameter(g.RENDERBUFFER, g.RGBA8, g.SAMPLES) || []),
          depth = Array.from(g.getInternalformatParameter(g.RENDERBUFFER, g.DEPTH_COMPONENT24, g.SAMPLES) || []),
          counts = color.filter(n => n > 1 && n <= 4 && depth.includes(n)).sort((a, b) => b - a);
        for (const samples of counts) {
          this.sceneMSAAFbo = g.createFramebuffer();
          this.sceneMSAAColor = g.createRenderbuffer();
          this.sceneMSAADepth = g.createRenderbuffer();
          if (this.sceneMSAAFbo && this.sceneMSAAColor && this.sceneMSAADepth) {
            g.bindFramebuffer(g.FRAMEBUFFER, this.sceneMSAAFbo);
            g.bindRenderbuffer(g.RENDERBUFFER, this.sceneMSAAColor);
            g.renderbufferStorageMultisample(g.RENDERBUFFER, samples, g.RGBA8, this.width, this.height);
            g.framebufferRenderbuffer(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.RENDERBUFFER, this.sceneMSAAColor);
            g.bindRenderbuffer(g.RENDERBUFFER, this.sceneMSAADepth);
            g.renderbufferStorageMultisample(g.RENDERBUFFER, samples, g.DEPTH_COMPONENT24, this.width, this.height);
            g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, this.sceneMSAADepth);
            if (g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE) {
              this.sceneSamples = samples;
              break;
            }
          }
          // Unsupported/incomplete targets must not replace the single-sample fallback.
          this.releaseSceneMSAA();
        }
      }
      color(c) {
        if (Array.isArray(c) || c instanceof Float32Array) return c;
        if (this.colors.has(c)) return this.colors.get(c);
        if (typeof c === 'string') c = parseInt(c.replace('#', ''), 16);
        let a = [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
        this.colors.set(c, a);
        return a;
      }
      dataTexture(rgb = [128, 128, 128]) {
        let g = this.gl,
          t = g.createTexture();
        g.bindTexture(g.TEXTURE_2D, t);
        g.texImage2D(
          g.TEXTURE_2D,
          0,
          g.RGBA,
          1,
          1,
          0,
          g.RGBA,
          g.UNSIGNED_BYTE,
          new Uint8Array([rgb[0], rgb[1], rgb[2], rgb[3] ?? 255])
        );
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
        return t;
      }
      loadTexture(tex, src, repeat = true) {
        let g = this.gl,
          img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          g.bindTexture(g.TEXTURE_2D, tex);
          g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
          g.generateMipmap(g.TEXTURE_2D);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, repeat ? g.REPEAT : g.CLAMP_TO_EDGE);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, repeat ? g.REPEAT : g.CLAMP_TO_EDGE);
        };
        img.onerror = () =>
          console.warn(
            'Texture could not be loaded:',
            src.startsWith('data:') ? 'embedded texture' : src
          );
        img.src = src;
      }
      bucket(map, name) {
        if (!map[name])
          map[name] = {
            data: new Float32Array(22 * 1024),
            n: 0,
            buffer: this.gl.createBuffer(),
            dirty: true
          };
        return map[name];
      }
      reserve(b) {
        if ((b.n + 1) * 22 > b.data.length) {
          let d = new Float32Array(b.data.length * 2);
          d.set(b.data);
          b.data = d;
        }
        return b.n++ * 22;
      }
      add(
        name,
        x,
        y,
        z,
        sx,
        sy,
        sz,
        color,
        ry = 0,
        rx = 0,
        rz = 0,
        glow = 0,
        alpha = 1,
        layer = 'dynamic',
        material = MAT.AUTO
      ) {
        let map = this[layer],
          b = this.bucket(map, name),
          o = this.reserve(b),
          d = b.data;
        let cy = Math.cos(ry),
          syy = Math.sin(ry),
          cx = Math.cos(rx),
          sxx = Math.sin(rx),
          cz = Math.cos(rz),
          szz = Math.sin(rz);
        d[o] = (cy * cz + syy * sxx * szz) * sx;
        d[o + 1] = cx * szz * sx;
        d[o + 2] = (-syy * cz + cy * sxx * szz) * sx;
        d[o + 3] = 0;
        d[o + 4] = (-cy * szz + syy * sxx * cz) * sy;
        d[o + 5] = cx * cz * sy;
        d[o + 6] = (syy * szz + cy * sxx * cz) * sy;
        d[o + 7] = 0;
        d[o + 8] = syy * cx * sz;
        d[o + 9] = -sxx * sz;
        d[o + 10] = cy * cx * sz;
        d[o + 11] = 0;
        d[o + 12] = x;
        d[o + 13] = y;
        d[o + 14] = z;
        d[o + 15] = 1;
        let c = this.color(color);
        d[o + 16] = c[0];
        d[o + 17] = c[1];
        d[o + 18] = c[2];
        d[o + 19] = alpha;
        d[o + 20] = glow;
        d[o + 21] = material;
        b.dirty = true;
      }
      beam(a, b, width, color, glow = 1, alpha = 1) {
        let axis = V.sub(b, a),
          len = Math.hypot(...axis);
        if (len < 0.001) return;
        axis = axis.map(v => v / len);
        let x = V.norm(V.cross(axis, Math.abs(axis[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1])),
          z = V.cross(x, axis);
        let bucket = this.bucket(this.effects, 'hex'),
          o = this.reserve(bucket),
          d = bucket.data;
        for (let k = 0; k < 3; k++) {
          d[o + k] = x[k] * width;
          d[o + 4 + k] = axis[k] * len;
          d[o + 8 + k] = z[k] * width;
          d[o + 12 + k] = (a[k] + b[k]) / 2;
        }
        d[o + 3] = d[o + 7] = d[o + 11] = 0;
        d[o + 15] = 1;
        let c = this.color(color);
        d[o + 16] = c[0];
        d[o + 17] = c[1];
        d[o + 18] = c[2];
        d[o + 19] = alpha;
        d[o + 20] = glow;
        d[o + 21] = MAT.AUTO;
        bucket.dirty = true;
      }
      begin() {
        for (let map of [this.dynamic, this.effects])
          for (let b of Object.values(map)) {
            b.n = 0;
            b.dirty = true;
          }
      }
      clearStatic() {
        for (let b of Object.values(this.static)) this.gl.deleteBuffer(b.buffer);
        this.static = {};
      }
      upload(map) {
        let g = this.gl;
        for (let b of Object.values(map)) {
          if (b.dirty) {
            g.bindBuffer(g.ARRAY_BUFFER, b.buffer);
            g.bufferData(g.ARRAY_BUFFER, b.data.subarray(0, b.n * 22), g.DYNAMIC_DRAW);
            b.dirty = false;
          }
        }
      }
      drawBatches(map) {
        let g = this.gl;
        for (let [name, b] of Object.entries(map)) {
          if (!b.n) continue;
          let m = this.meshes[name];
          if (!m) continue;
          g.bindVertexArray(m.vao);
          g.bindBuffer(g.ARRAY_BUFFER, b.buffer);
          for (let i = 0; i < 4; i++) {
            g.enableVertexAttribArray(2 + i);
            g.vertexAttribPointer(2 + i, 4, g.FLOAT, false, 88, i * 16);
            g.vertexAttribDivisor(2 + i, 1);
          }
          g.enableVertexAttribArray(6);
          g.vertexAttribPointer(6, 4, g.FLOAT, false, 88, 64);
          g.vertexAttribDivisor(6, 1);
          g.enableVertexAttribArray(7);
          g.vertexAttribPointer(7, 1, g.FLOAT, false, 88, 80);
          g.vertexAttribDivisor(7, 1);
          g.enableVertexAttribArray(9);
          g.vertexAttribPointer(9, 1, g.FLOAT, false, 88, 84);
          g.vertexAttribDivisor(9, 1);
          g.drawArraysInstanced(g.TRIANGLES, 0, m.count, b.n);
          this.drawCalls++;
        }
      }
      camera(x, z, zoom, cinema = false, t = 0) {
        this.cinema = cinema;
        let a = this.viewport.width / this.viewport.height;
        // Preserve the existing pixels-per-world-unit zoom while clipping HUD space.
        let viewHeight = zoom * this.viewport.height / innerHeight;
        let target = cinema ? [0, 7, -4] : [x, 0, z];
        this.eye = cinema
          ? [62 + Math.sin(t * 0.025) * 8, 24, 78 + Math.cos(t * 0.025) * 5]
          : [x, zoom * 1.1, z + zoom * 0.82];
        let view = M4.look(this.eye, target),
          proj = cinema
            ? M4.perspective(0.74, a, 0.5, 400)
            : M4.ortho((-viewHeight * a) / 2, (viewHeight * a) / 2, -viewHeight / 2, viewHeight / 2, 0.1, 350);
        this.vp = M4.mul(proj, view);
        this.inverseVP = M4.inverse(this.vp);
        let st = cinema ? [0, 0, 0] : [x, 0, z];
        this.lightVP = M4.mul(
          M4.ortho(-78, 78, -78, 78, 1, 250),
          M4.look([st[0] - 64, 110, st[2] + 43], st)
        );
      }
      project(x, y, z) {
        let p = M4.point(this.vp, x, y, z);
        if (p[3] <= 0) return null;
        return {
          x: this.viewport.left + ((p[0] / p[3]) * 0.5 + 0.5) * this.viewport.width,
          y: this.viewport.top + (0.5 - (p[1] / p[3]) * 0.5) * this.viewport.height,
          depth: p[2] / p[3]
        };
      }
      containsPoint(sx, sy) {
        const v = this.viewport;
        return sx > v.left && sx < v.right && sy > v.top && sy < v.bottom;
      }
      ground(sx, sy) {
        let x = ((sx - this.viewport.left) / this.viewport.width) * 2 - 1,
          y = 1 - ((sy - this.viewport.top) / this.viewport.height) * 2;
        let a = M4.point(this.inverseVP, x, y, -1),
          b = M4.point(this.inverseVP, x, y, 1);
        for (let i = 0; i < 3; i++) {
          a[i] /= a[3];
          b[i] /= b[3];
        }
        let t = -a[1] / (b[1] - a[1]);
        return { x: a[0] + (b[0] - a[0]) * t, z: a[2] + (b[2] - a[2]) * t };
      }
      fog(data, size) {
        let g = this.gl;
        g.bindTexture(g.TEXTURE_2D, this.fogTex);
        g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
        if (this.fogSize !== size) {
          g.texImage2D(g.TEXTURE_2D, 0, g.R8, size, size, 0, g.RED, g.UNSIGNED_BYTE, data);
          this.fogSize = size;
        } else {
          g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, size, size, g.RED, g.UNSIGNED_BYTE, data);
        }
      }
      render(time) {
        let g = this.gl;
        this.frame++;
        this.drawCalls = 0;
        this.upload(this.static);
        this.upload(this.dynamic);
        this.upload(this.effects);
        g.enable(g.DEPTH_TEST);
        g.disable(g.BLEND);
        g.depthMask(true);
        if (this.quality > 0) {
          g.bindFramebuffer(g.FRAMEBUFFER, this.shadowFbo);
          g.viewport(0, 0, this.shadowSize, this.shadowSize);
          g.clear(g.DEPTH_BUFFER_BIT);
          g.useProgram(this.depthProg);
          g.uniformMatrix4fv(this.uniform(this.depthProg, 'u_vp'), false, this.lightVP);
          g.enable(g.POLYGON_OFFSET_FILL);
          g.polygonOffset(1.5, 2);
          this.drawBatches(this.static);
          this.drawBatches(this.dynamic);
          g.disable(g.POLYGON_OFFSET_FILL);
        }
        g.bindFramebuffer(g.FRAMEBUFFER, this.sceneMSAAFbo || this.sceneFbo);
        g.viewport(0, 0, this.width, this.height);
        g.clearColor(...this.haze, 1);
        g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
        g.disable(g.DEPTH_TEST);
        g.useProgram(this.skyProg);
        g.uniform2f(this.uniform(this.skyProg, 'u_size'), this.width, this.height);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, this[`${this.battlefieldProfile.skyTexture}Tex`]);
        g.uniform1i(this.uniform(this.skyProg, 'u_skyTex'), 0);
        g.bindVertexArray(this.fullVao);
        g.drawArrays(g.TRIANGLES, 0, 3);
        g.enable(g.DEPTH_TEST);
        g.useProgram(this.program);
        g.uniformMatrix4fv(this.uniform(this.program, 'u_vp'), false, this.vp);
        g.uniformMatrix4fv(this.uniform(this.program, 'u_light'), false, this.lightVP);
        g.uniform3fv(this.uniform(this.program, 'u_eye'), this.eye);
        g.uniform3fv(this.uniform(this.program, 'u_haze'), this.haze);
        g.uniform1f(this.uniform(this.program, 'u_extent'), this.extent);
        g.uniform1ui(this.uniform(this.program, 'u_decorSeed'), this.decorSeed);
        const profile = this.battlefieldProfile;
        g.uniform1f(this.uniform(this.program, 'u_groundPixelsPerMeter'), profile.groundPixelsPerMeter);
        g.uniform1f(this.uniform(this.program, 'u_groundMirror'), profile.groundMirror ? 1 : 0);
        g.uniform4f(this.uniform(this.program, 'u_groundDecor'), profile.rockDecor.density,
          profile.shrubDecor.density, profile.rockDecor.opacity, profile.shrubDecor.opacity);
        g.uniform1f(this.uniform(this.program, 'u_shadowOn'), this.quality > 0 ? 1 : 0);
        g.uniform1f(this.uniform(this.program, 'u_fogOn'), this.fogOn ? 1 : 0);
        g.uniform1f(this.uniform(this.program, 'u_time'), time);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, this.shadowTex);
        g.uniform1i(this.uniform(this.program, 'u_shadow'), 0);
        g.activeTexture(g.TEXTURE1);
        g.bindTexture(g.TEXTURE_2D, this.fogTex);
        g.uniform1i(this.uniform(this.program, 'u_fog'), 1);
        g.activeTexture(g.TEXTURE2);
        g.bindTexture(g.TEXTURE_2D, this[`${profile.groundTexture}Tex`]);
        g.uniform1i(this.uniform(this.program, 'u_groundTex'), 2);
        g.activeTexture(g.TEXTURE3);
        g.bindTexture(g.TEXTURE_2D, this.rockClustersTex);
        g.uniform1i(this.uniform(this.program, 'u_rockClustersTex'), 3);
        g.activeTexture(g.TEXTURE4);
        g.bindTexture(g.TEXTURE_2D, this.desertShrubsTex);
        g.uniform1i(this.uniform(this.program, 'u_desertShrubsTex'), 4);
        g.activeTexture(g.TEXTURE5);
        g.bindTexture(g.TEXTURE_2D, this.metalTex);
        g.uniform1i(this.uniform(this.program, 'u_metalTex'), 5);
        g.activeTexture(g.TEXTURE6);
        g.bindTexture(g.TEXTURE_2D, this.bioTex);
        g.uniform1i(this.uniform(this.program, 'u_bioTex'), 6);
        this.drawBatches(this.static);
        this.drawBatches(this.dynamic);
        g.enable(g.BLEND);
        g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
        g.depthMask(false);
        this.drawBatches(this.effects);
        g.depthMask(true);
        g.disable(g.BLEND);
        if (this.sceneSamples > 1) {
          // Resolve opaque geometry and blended effects before bloom/post-processing.
          g.bindFramebuffer(g.READ_FRAMEBUFFER, this.sceneMSAAFbo);
          g.bindFramebuffer(g.DRAW_FRAMEBUFFER, this.sceneFbo);
          g.blitFramebuffer(
            0, 0, this.width, this.height,
            0, 0, this.width, this.height,
            g.COLOR_BUFFER_BIT, g.NEAREST
          );
        }
        g.bindFramebuffer(g.FRAMEBUFFER, null);
        g.viewport(0, 0, this.width, this.height);
        g.disable(g.DEPTH_TEST);
        g.useProgram(this.postProg);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, this.sceneTex);
        g.uniform1i(this.uniform(this.postProg, 'u_tex'), 0);
        g.uniform2f(this.uniform(this.postProg, 'u_size'), this.width, this.height);
        g.uniform1f(this.uniform(this.postProg, 'u_time'), time);
        g.uniform1f(this.uniform(this.postProg, 'u_quality'), this.quality);
        g.bindVertexArray(this.fullVao);
        g.drawArrays(g.TRIANGLES, 0, 3);
        g.bindVertexArray(null);
      }
    }
