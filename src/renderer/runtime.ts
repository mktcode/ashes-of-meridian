    /* Dependency-free instanced WebGL2 renderer. */
    'use strict';
    const DEFAULT_LIGHTING: BattlefieldLighting = {
      sun: [1.10, .96, .82], sky: [.38, .47, .56], bounce: [.20, .23, .27]
    };
    const STATIC_CHUNK_SIZE = 32;
    const CINEMA_ORBIT_SPEED = .04;
    // Standalone model previews also render without a BattlefieldView.
    const DEFAULT_TERRAIN_RENDER_PROFILE: BattlefieldRenderProfile = {
      groundTexture: 'ground', skyTexture: 'sky', groundPixelsPerMeter: 14, haze: [0.055, 0.09, 0.13],
      rockDecor: { density: .8, opacity: .18 }, shrubDecor: { density: .1, opacity: .28 }
    };
    class MeridianRenderer {
      canvas: HTMLCanvasElement;
      gl: WebGL2RenderingContext;
      program: WebGLProgram;
      depthProg: WebGLProgram;
      skyProg: WebGLProgram;
      postProg: WebGLProgram;
      bloomProg: WebGLProgram;
      bloomTargets: { texture: WebGLTexture | null; fbo: WebGLFramebuffer | null }[] = [];
      bloomWidth = 1;
      bloomHeight = 1;
      meshes: Record<string, RenderMesh>;
      meshParts: Record<string, string[]>;
      static: RenderBatches;
      dynamic: RenderBatches;
      effects: RenderBatches;
      colors: Map<number | string, readonly number[] | Float32Array>;
      quality: number;
      extent: number;
      decorSeed: number;
      battlefieldProfile: BattlefieldRenderProfile;
      haze: readonly [number, number, number];
      eye: number[];
      vp: Float32Array;
      inverseVP: Float32Array;
      lightVP!: Float32Array;
      frame: number;
      fogOn: boolean;
      cinema: boolean;
      shadowSize: number;
      shadowBias = .00022;
      uniformCache: Map<WebGLProgram, Record<string, WebGLUniformLocation | null>>;
      fullVao: WebGLVertexArrayObject | null;
      fogSize: number;
      fogTex: WebGLTexture | null;
      groundTex: WebGLTexture | null;
      desertRockTex: WebGLTexture | null;
      rockClustersTex: WebGLTexture | null;
      desertShrubsTex: WebGLTexture | null;
      metalTex: WebGLTexture | null;
      bioTex: WebGLTexture | null;
      skyTex: WebGLTexture | null;
      textureResources: Record<ResidentTextureName, ResidentTexture>;
      textureLoads: Partial<Record<ResidentTextureName, Promise<boolean>>> = {};
      desiredTextures = new Set<ResidentTextureName>();
      textureGeneration = 0;
      shadowTex: WebGLTexture | null;
      shadowFbo: WebGLFramebuffer | null;
      sceneFbo: WebGLFramebuffer | null;
      sceneTex: WebGLTexture | null;
      sceneDepth: WebGLRenderbuffer | null;
      sceneMSAAFbo: WebGLFramebuffer | null;
      sceneMSAAColor: WebGLRenderbuffer | null;
      sceneMSAADepth: WebGLRenderbuffer | null;
      sceneSamples: number;
      // Initialized by resize() before the constructor returns.
      viewport!: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
      width!: number;
      height!: number;
      drawCalls: number;
      constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('webgl2', {
          alpha: false,
          antialias: false, // Geometry is multisampled in the scene target, not the final quad.
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false
        });
        if (!context)
          throw Error(
            'WebGL 2 is unavailable. Enable hardware acceleration in your browser and reopen the game.'
          );
        const gl = this.gl = context;
        this.program = this.programOf(VERT, FRAG);
        this.depthProg = this.programOf(DEPTHV, DEPTHF);
        this.skyProg = this.programOf(FULLV, SKYF);
        this.postProg = this.programOf(FULLV, POSTF);
        this.bloomProg = this.programOf(FULLV, BLOOMF);
        this.meshes = {};
        this.meshParts = {};
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
          choirMound: geom.choirMound(),
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
        this.desertRockTex = this.dataTexture([137, 99, 71]);
        this.rockClustersTex = this.dataTexture([0, 0, 0, 0]);
        this.desertShrubsTex = this.dataTexture([0, 0, 0, 0]);
        this.metalTex = this.dataTexture([128, 130, 136]);
        this.bioTex = this.dataTexture([77, 128, 119]);
        this.skyTex = this.dataTexture([5, 9, 16]);
        this.textureResources = {
          ground: { texture: this.groundTex, fallback: [146, 101, 75], repeat: true, resident: false },
          desertRock: { texture: this.desertRockTex, fallback: [137, 99, 71], repeat: true, resident: false },
          rockClusters: { texture: this.rockClustersTex, fallback: [0, 0, 0, 0], repeat: false, resident: false },
          desertShrubs: { texture: this.desertShrubsTex, fallback: [0, 0, 0, 0], repeat: false, resident: false },
          metal: { texture: this.metalTex, fallback: [128, 130, 136], repeat: true, resident: false },
          bio: { texture: this.bioTex, fallback: [77, 128, 119], repeat: true, resident: false },
          sky: { texture: this.skyTex, fallback: [5, 9, 16], repeat: false, resident: false }
        };
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
      programOf(v: string, f: string) {
        let gl = this.gl,
          p = gl.createProgram();
        if (!p) throw Error('Could not allocate WebGL program');
        for (let [s, t] of [
          [v, gl.VERTEX_SHADER],
          [f, gl.FRAGMENT_SHADER]
        ] as const) {
          let sh = gl.createShader(t);
          if (!sh) throw Error('Could not allocate WebGL shader');
          gl.shaderSource(sh, s);
          gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(sh) || 'Shader compilation failed');
          gl.attachShader(p, sh);
        }
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p) || 'Program linking failed');
        return p;
      }
      uniform(p: WebGLProgram, k: string) {
        let map = this.uniformCache.get(p);
        if (!map) {
          map = {};
          this.uniformCache.set(p, map);
        }
        if (!(k in map)) map[k] = this.gl.getUniformLocation(p, k);
        return map[k];
      }
      geometry(name: string, data: MeshData) {
        const partsByName = this.meshParts ||= {}, oldParts = partsByName[name] || (this.meshes[name] ? [name] : []);
        for (const part of oldParts) {
          this.gl.deleteBuffer(this.meshes[part]?.vbo);
          this.gl.deleteVertexArray(this.meshes[part]?.vao);
          delete this.meshes[part];
        }
        const chunkCounts = new Map<number, number>(), triangles = data.length / 27;
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < data.length; i += 9) {
          minX = Math.min(minX, data[i]); maxX = Math.max(maxX, data[i]);
          minZ = Math.min(minZ, data[i + 2]); maxZ = Math.max(maxZ, data[i + 2]);
        }
        if (triangles >= 64 && (maxX - minX > STATIC_CHUNK_SIZE * 1.5 || maxZ - minZ > STATIC_CHUNK_SIZE * 1.5)) {
          for (let i = 0; i < data.length; i += 27) {
            const x = (data[i] + data[i + 9] + data[i + 18]) / 3,
              z = (data[i + 2] + data[i + 11] + data[i + 20]) / 3,
              key = (Math.floor(x / STATIC_CHUNK_SIZE) + 32768) * 65536 + Math.floor(z / STATIC_CHUNK_SIZE) + 32768;
            chunkCounts.set(key, (chunkCounts.get(key) || 0) + 1);
          }
        }
        const parts: string[] = [];
        if (chunkCounts.size > 1) {
          const groups = new Map<number, { data: Float32Array; offset: number }>();
          for (const [key, count] of chunkCounts) groups.set(key, { data: new Float32Array(count * 27), offset: 0 });
          for (let i = 0; i < data.length; i += 27) {
            const x = (data[i] + data[i + 9] + data[i + 18]) / 3,
              z = (data[i + 2] + data[i + 11] + data[i + 20]) / 3,
              key = (Math.floor(x / STATIC_CHUNK_SIZE) + 32768) * 65536 + Math.floor(z / STATIC_CHUNK_SIZE) + 32768,
              group = groups.get(key)!;
            for (let j = 0; j < 27; j++) group.data[group.offset++] = data[i + j];
          }
          for (const [key, group] of groups) {
            const chunkX = Math.floor(key / 65536) - 32768, chunkZ = key % 65536 - 32768,
              part = `${name}@chunk:${chunkX},${chunkZ}`;
            this.createGeometry(part, group.data);
            parts.push(part);
          }
        } else {
          this.createGeometry(name, data);
          parts.push(name);
        }
        partsByName[name] = parts;
      }
      createGeometry(name: string, data: MeshData) {
        const gl = this.gl, storage = Array.isArray(data) ? new Float32Array(data) : data;
        let vao = gl.createVertexArray(), vbo = gl.createBuffer();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        // Large terrain factories already return their final typed storage; do not duplicate it before upload.
        gl.bufferData(gl.ARRAY_BUFFER, storage, gl.STATIC_DRAW);
        for (let [i, offset] of [[0, 0], [1, 12], [8, 24]]) {
          gl.enableVertexAttribArray(i);
          gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 36, offset);
        }
        gl.bindVertexArray(null);
        const bounds: [number, number, number, number, number, number] =
          [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
        for (let i = 0; i < storage.length; i += 9) {
          for (let axis = 0; axis < 3; axis++) {
            bounds[axis] = Math.min(bounds[axis], storage[i + axis]);
            bounds[axis + 3] = Math.max(bounds[axis + 3], storage[i + axis]);
          }
        }
        this.meshes[name] = { vao, vbo, count: storage.length / 9, bounds };
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
        this.resizeBloom();
        g.bindRenderbuffer(g.RENDERBUFFER, null);
        g.bindFramebuffer(g.FRAMEBUFFER, null);
      }
      releaseBloom() {
        for (const target of this.bloomTargets) {
          if (target.texture) this.gl.deleteTexture(target.texture);
          if (target.fbo) this.gl.deleteFramebuffer(target.fbo);
        }
        this.bloomTargets = [];
      }
      resizeBloom() {
        const g = this.gl;
        this.releaseBloom();
        if (this.quality === 0) return;
        this.bloomWidth = Math.max(1, Math.ceil(this.width / 4));
        this.bloomHeight = Math.max(1, Math.ceil(this.height / 4));
        for (let i = 0; i < 2; i++) {
          const target = { texture: g.createTexture(), fbo: g.createFramebuffer() };
          this.bloomTargets.push(target);
          if (!target.texture || !target.fbo) { this.releaseBloom(); return; }
          g.bindTexture(g.TEXTURE_2D, target.texture);
          g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, this.bloomWidth, this.bloomHeight, 0, g.RGBA, g.UNSIGNED_BYTE, null);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
          g.bindFramebuffer(g.FRAMEBUFFER, target.fbo);
          g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, target.texture, 0);
          if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) { this.releaseBloom(); return; }
        }
      }
      renderBloom() {
        if (this.quality === 0 || this.bloomTargets.length !== 2) return;
        const g = this.gl;
        g.disable(g.DEPTH_TEST);
        g.viewport(0, 0, this.bloomWidth, this.bloomHeight);
        g.useProgram(this.bloomProg);
        g.bindVertexArray(this.fullVao);
        g.activeTexture(g.TEXTURE0);
        g.uniform1i(this.uniform(this.bloomProg, 'u_tex'), 0);
        for (let pass = 0; pass < 3; pass++) {
          // Extract, horizontal blur, vertical blur. Never sample the attached target.
          g.bindFramebuffer(g.FRAMEBUFFER, this.bloomTargets[pass === 1 ? 1 : 0].fbo);
          g.bindTexture(g.TEXTURE_2D, pass === 0 ? this.sceneTex : this.bloomTargets[pass === 1 ? 0 : 1].texture);
          g.uniform1i(this.uniform(this.bloomProg, 'u_extract'), pass === 0 ? 1 : 0);
          g.uniform2f(this.uniform(this.bloomProg, 'u_step'),
            pass === 0 ? 1 / this.width : pass === 1 ? 1 / this.bloomWidth : 0,
            pass === 0 ? 1 / this.height : pass === 2 ? 1 / this.bloomHeight : 0);
          g.drawArrays(g.TRIANGLES, 0, 3);
        }
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
        const color = Array.from<number>(g.getInternalformatParameter(g.RENDERBUFFER, g.RGBA8, g.SAMPLES) || []),
          depth = Array.from<number>(g.getInternalformatParameter(g.RENDERBUFFER, g.DEPTH_COMPONENT24, g.SAMPLES) || []),
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
      color(c: RenderColor): readonly number[] | Float32Array {
        if (typeof c !== 'number' && typeof c !== 'string') return c;
        const cached = this.colors.get(c);
        if (cached) return cached;
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
      textureNames(profile: BattlefieldRenderProfile) {
        const names = new Set<ResidentTextureName>(['sky', 'metal', 'bio', profile.groundTexture]);
        if (profile.rockSurface) names.add(profile.rockSurface.texture);
        if (profile.rockDecor.density > 0) names.add('rockClusters');
        if (profile.shrubDecor.density > 0) names.add('desertShrubs');
        return names;
      }
      hasBattlefieldTextures(profile: BattlefieldRenderProfile) {
        for (const name of this.textureNames(profile)) if (!this.textureResources[name].resident) return false;
        return true;
      }
      async prepareBattlefieldTextures(profile: BattlefieldRenderProfile) {
        const generation = ++this.textureGeneration, required = this.textureNames(profile);
        this.desiredTextures = required;
        await Promise.all(Array.from(required, name => this.loadResidentTexture(name)));
        if (generation !== this.textureGeneration) return false;
        for (const name of Object.keys(this.textureResources) as ResidentTextureName[])
          if (!required.has(name) && this.textureResources[name].resident) this.releaseResidentTexture(name);
        return true;
      }
      loadResidentTexture(name: ResidentTextureName) {
        const resource = this.textureResources[name];
        if (resource.resident) return Promise.resolve(true);
        const active = this.textureLoads[name];
        if (active) return active;
        const load = new Promise<boolean>(resolve => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            if (this.desiredTextures.has(name)) {
              const g = this.gl;
              g.bindTexture(g.TEXTURE_2D, resource.texture);
              g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
              g.generateMipmap(g.TEXTURE_2D);
              g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
              g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
              g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, resource.repeat ? g.REPEAT : g.CLAMP_TO_EDGE);
              g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, resource.repeat ? g.REPEAT : g.CLAMP_TO_EDGE);
              resource.resident = true;
            }
            resolve(resource.resident);
          };
          img.onerror = () => {
            console.warn('Texture could not be loaded:', 'embedded texture');
            resolve(false);
          };
          img.src = MERIDIAN_TEXTURES[name];
        }).finally(() => delete this.textureLoads[name]);
        this.textureLoads[name] = load;
        return load;
      }
      releaseResidentTexture(name: ResidentTextureName) {
        const resource = this.textureResources[name];
        this.gl.deleteTexture(resource.texture);
        resource.texture = this.dataTexture(resource.fallback);
        resource.resident = false;
        (this as unknown as Record<string, WebGLTexture | null>)[`${name}Tex`] = resource.texture;
      }
      bucket(map: RenderBatches, key: string, mesh = key, source = mesh, capacity = 1024) {
        if (!map[key])
          map[key] = {
            data: new Float32Array(22 * capacity),
            n: 0,
            buffer: this.gl.createBuffer(),
            dirty: true,
            mesh,
            source
          };
        return map[key];
      }
      reserve(b: RenderBucket) {
        if ((b.n + 1) * 22 > b.data.length) {
          let d = new Float32Array(b.data.length * 2);
          d.set(b.data);
          b.data = d;
        }
        return b.n++ * 22;
      }
      add(
        name: string,
        x: number,
        y: number,
        z: number,
        sx: number,
        sy: number,
        sz: number,
        color: RenderColor,
        ry = 0,
        rx = 0,
        rz = 0,
        glow = 0,
        alpha = 1,
        layer: RenderLayer = 'dynamic',
        material = MAT.AUTO
      ) {
        const map = this[layer], parts = this.meshParts?.[name] || [name], c = this.color(color);
        const cy = Math.cos(ry), syy = Math.sin(ry), cx = Math.cos(rx), sxx = Math.sin(rx),
          cz = Math.cos(rz), szz = Math.sin(rz);
        for (const meshName of parts) {
          const key = layer === 'static'
            ? `${meshName}|${Math.floor(x / STATIC_CHUNK_SIZE)},${Math.floor(z / STATIC_CHUNK_SIZE)}` : meshName,
            b = this.bucket(map, key, meshName, name, layer === 'static' ? 32 : 1024), o = this.reserve(b), d = b.data;
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
          d[o + 16] = c[0];
          d[o + 17] = c[1];
          d[o + 18] = c[2];
          d[o + 19] = alpha;
          d[o + 20] = glow;
          d[o + 21] = material;
          if (layer === 'static') this.extendBounds(b, this.meshes[meshName], d, o);
          b.dirty = true;
        }
      }
      extendBounds(b: RenderBucket, mesh: RenderMesh | undefined, d: Float32Array, o: number) {
        if (!mesh) return;
        const a = mesh.bounds, center = [(a[0] + a[3]) / 2, (a[1] + a[4]) / 2, (a[2] + a[5]) / 2],
          half = [(a[3] - a[0]) / 2, (a[4] - a[1]) / 2, (a[5] - a[2]) / 2],
          world = [
            d[o] * center[0] + d[o + 4] * center[1] + d[o + 8] * center[2] + d[o + 12],
            d[o + 1] * center[0] + d[o + 5] * center[1] + d[o + 9] * center[2] + d[o + 13],
            d[o + 2] * center[0] + d[o + 6] * center[1] + d[o + 10] * center[2] + d[o + 14]
          ], extent = [
            Math.abs(d[o]) * half[0] + Math.abs(d[o + 4]) * half[1] + Math.abs(d[o + 8]) * half[2],
            Math.abs(d[o + 1]) * half[0] + Math.abs(d[o + 5]) * half[1] + Math.abs(d[o + 9]) * half[2],
            Math.abs(d[o + 2]) * half[0] + Math.abs(d[o + 6]) * half[1] + Math.abs(d[o + 10]) * half[2]
          ];
        if (!b.bounds) b.bounds = [world[0] - extent[0], world[1] - extent[1], world[2] - extent[2],
          world[0] + extent[0], world[1] + extent[1], world[2] + extent[2]];
        else for (let axis = 0; axis < 3; axis++) {
          b.bounds[axis] = Math.min(b.bounds[axis], world[axis] - extent[axis]);
          b.bounds[axis + 3] = Math.max(b.bounds[axis + 3], world[axis] + extent[axis]);
        }
      }
      beam(a: number[], b: number[], width: number, color: RenderColor, glow = 1, alpha = 1) {
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
            // Upload the transition to empty once, but leave persistently empty buckets alone.
            b.dirty = b.n > 0;
            b.n = 0;
          }
      }
      clearStatic() {
        for (let b of Object.values(this.static)) this.gl.deleteBuffer(b.buffer);
        this.static = {};
      }
      upload(map: RenderBatches) {
        let g = this.gl;
        for (let b of Object.values(map)) {
          if (b.dirty) {
            g.bindBuffer(g.ARRAY_BUFFER, b.buffer);
            g.bufferData(g.ARRAY_BUFFER, b.data.subarray(0, b.n * 22), g.DYNAMIC_DRAW);
            b.dirty = false;
          }
        }
      }
      bucketVisible(b: RenderBucket, matrix?: Float32Array) {
        if (!matrix || !b.bounds) return true;
        const a = b.bounds;
        let left = true, right = true, bottom = true, top = true, near = true, far = true;
        for (let corner = 0; corner < 8; corner++) {
          const x = a[corner & 1 ? 3 : 0], y = a[corner & 2 ? 4 : 1], z = a[corner & 4 ? 5 : 2],
            cx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
            cy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
            cz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
            cw = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
          if (cx >= -cw) left = false;
          if (cx <= cw) right = false;
          if (cy >= -cw) bottom = false;
          if (cy <= cw) top = false;
          if (cz >= -cw) near = false;
          if (cz <= cw) far = false;
        }
        return !(left || right || bottom || top || near || far);
      }
      drawBatches(map: RenderBatches, matrix?: Float32Array, excludedNames?: string | readonly string[], includedName?: string) {
        let g = this.gl;
        for (const b of Object.values(map)) {
          const excluded = typeof excludedNames === 'string' ? b.source === excludedNames : excludedNames?.includes(b.source);
          if (!b.n || excluded || (includedName !== undefined && b.source !== includedName) || !this.bucketVisible(b, matrix)) continue;
          let m = this.meshes[b.mesh];
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
      camera(x: number, z: number, zoom: number, cinema = false, t = 0) {
        this.cinema = cinema;
        let a = this.viewport.width / this.viewport.height;
        // Preserve the existing pixels-per-world-unit zoom while clipping HUD space.
        let viewHeight = zoom * this.viewport.height / innerHeight;
        let target = cinema ? [0, 7, -4] : [x, 0, z];
        this.eye = cinema
          ? [62 + Math.sin(t * CINEMA_ORBIT_SPEED) * 8, 24, 78 + Math.cos(t * CINEMA_ORBIT_SPEED) * 5]
          : [x, zoom * 1.1, z + zoom * 0.82];
        let view = M4.look(this.eye, target),
          proj = cinema
            ? M4.perspective(0.74, a, 0.5, 400)
            : M4.ortho((-viewHeight * a) / 2, (viewHeight * a) / 2, -viewHeight / 2, viewHeight / 2, 0.1, 350);
        this.vp = M4.mul(proj, view);
        this.inverseVP = M4.inverse(this.vp);
        if (this.quality === 0) this.lightVP = M4.identity();
        else if (cinema) {
          this.lightVP = M4.mul(M4.ortho(-78, 78, -78, 78, 1, 250), M4.look([-64, 110, 43], [0, 0, 0]));
          this.shadowBias = .00022;
        } else this.fitShadow();
      }
      fitShadow() {
        // Fit the visible ground and elevated receivers in a fixed light-space basis.
        // Taller terrain opts into a higher ceiling without changing other map profiles.
        // Padding keeps off-screen casters near the view edge; no extra shadow pass.
        const view = M4.look([-64, 110, 43], [0, 0, 0]), v = this.viewport;
        const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        for (const [x, y] of [[v.left, v.top], [v.right, v.top], [v.left, v.bottom], [v.right, v.bottom]]) {
          const sx = (x - v.left) / v.width * 2 - 1, sy = 1 - (y - v.top) / v.height * 2;
          const a = M4.point(this.inverseVP, sx, sy, -1), b = M4.point(this.inverseVP, sx, sy, 1);
          for (let i = 0; i < 3; i++) { a[i] /= a[3]; b[i] /= b[3]; }
          for (const height of [0, this.battlefieldProfile?.terrainReceiverHeight ?? 32]) {
            const t = (height - a[1]) / (b[1] - a[1]);
            const q = M4.point(view, a[0] + (b[0] - a[0]) * t, height, a[2] + (b[2] - a[2]) * t);
            for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); }
          }
        }
        // Quantized extents and texel-aligned centers prevent subpixel swimming when panning.
        const span = [0, 1].map(i => Math.ceil((hi[i] - lo[i] + 16) / 4 + .01) * 4);
        const center = span.map((width, i) => {
          const texel = width / this.shadowSize;
          return Math.round((lo[i] + hi[i]) * .5 / texel) * texel;
        });
        const near = -hi[2] - 64, far = -lo[2] + 64;
        this.shadowBias = Math.max(.03, Math.max(...span) / this.shadowSize * .4) / (far - near);
        this.lightVP = M4.mul(M4.ortho(center[0] - span[0] / 2, center[0] + span[0] / 2,
          center[1] - span[1] / 2, center[1] + span[1] / 2, near, far), view);
      }
      project(x: number, y: number, z: number) {
        let p = M4.point(this.vp, x, y, z);
        if (p[3] <= 0) return null;
        return {
          x: this.viewport.left + ((p[0] / p[3]) * 0.5 + 0.5) * this.viewport.width,
          y: this.viewport.top + (0.5 - (p[1] / p[3]) * 0.5) * this.viewport.height,
          depth: p[2] / p[3]
        };
      }
      containsPoint(sx: number, sy: number) {
        const v = this.viewport;
        return sx > v.left && sx < v.right && sy > v.top && sy < v.bottom;
      }
      ground(sx: number, sy: number) {
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
      fog(data: Uint8Array<ArrayBuffer>, size: number) {
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
      render(time: number, modelTime = time) {
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
          // The flat ground receives shadows in the scene pass but cannot cast a visible one itself.
          this.drawBatches(this.static, this.lightVP, ['terrain', 'alienLanternPool']);
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
        g.uniform3fv(this.uniform(this.program, 'u_haze'), this.haze as [number, number, number]);
        g.uniform1f(this.uniform(this.program, 'u_extent'), this.extent);
        g.uniform1ui(this.uniform(this.program, 'u_decorSeed'), this.decorSeed);
        const profile = this.battlefieldProfile, lighting = profile.lighting ?? DEFAULT_LIGHTING;
        g.uniform3fv(this.uniform(this.program, 'u_sun'), lighting.sun as [number, number, number]);
        g.uniform3fv(this.uniform(this.program, 'u_skyLight'), lighting.sky as [number, number, number]);
        g.uniform3fv(this.uniform(this.program, 'u_bounce'), lighting.bounce as [number, number, number]);
        g.uniform1f(this.uniform(this.program, 'u_shadowBias'), this.shadowBias);
        g.uniform1f(this.uniform(this.program, 'u_groundPixelsPerMeter'), profile.groundPixelsPerMeter);
        g.uniform1f(this.uniform(this.program, 'u_groundMirror'), profile.groundMirror ? 1 : 0);
        g.uniform1f(this.uniform(this.program, 'u_rockScale'), profile.rockSurface ? 1 / profile.rockSurface.metersPerTile : 0);
        g.uniform4f(this.uniform(this.program, 'u_groundDecor'), profile.rockDecor.density,
          profile.shrubDecor.density, profile.rockDecor.opacity, profile.shrubDecor.opacity);
        g.uniform1f(this.uniform(this.program, 'u_shadowOn'), this.quality > 0 ? 1 : 0);
        g.uniform1f(this.uniform(this.program, 'u_fogOn'), this.fogOn ? 1 : 0);
        g.uniform1f(this.uniform(this.program, 'u_time'), time);
        g.uniform1f(this.uniform(this.program, 'u_portalTime'), this.quality > 0 && !this.cinema ? modelTime : 0);
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
        g.activeTexture(g.TEXTURE7);
        g.bindTexture(g.TEXTURE_2D, this[`${profile.rockSurface?.texture ?? profile.groundTexture}Tex`]);
        g.uniform1i(this.uniform(this.program, 'u_rockTex'), 7);
        this.drawBatches(this.static, this.vp, 'alienLanternPool');
        this.drawBatches(this.dynamic);
        g.enable(g.BLEND);
        g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
        g.depthMask(false);
        // Persistent projected light is translucent static geometry: blend it without depth writes so
        // overlapping cyan/plum pools cannot fight over the same ground plane while the camera moves.
        this.drawBatches(this.static, this.vp, undefined, 'alienLanternPool');
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
        this.renderBloom();
        g.bindFramebuffer(g.FRAMEBUFFER, null);
        g.viewport(0, 0, this.width, this.height);
        g.disable(g.DEPTH_TEST);
        g.useProgram(this.postProg);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, this.sceneTex);
        g.uniform1i(this.uniform(this.postProg, 'u_tex'), 0);
        g.activeTexture(g.TEXTURE1);
        g.bindTexture(g.TEXTURE_2D, this.bloomTargets[0]?.texture || this.sceneTex);
        g.uniform1i(this.uniform(this.postProg, 'u_bloom'), 1);
        g.uniform1f(this.uniform(this.postProg, 'u_bloomOn'), this.quality > 0 && this.bloomTargets.length === 2 ? 1 : 0);
        g.uniform2f(this.uniform(this.postProg, 'u_size'), this.width, this.height);
        g.uniform1f(this.uniform(this.postProg, 'u_time'), time);
        g.uniform1f(this.uniform(this.postProg, 'u_quality'), this.quality);
        g.bindVertexArray(this.fullVao);
        g.drawArrays(g.TRIANGLES, 0, 3);
        g.bindVertexArray(null);
      }
    }
