'use strict';

(() => {
  const canvas = document.querySelector('#terrain');
  const status = document.querySelector('#status');
  const seedInput = document.querySelector('#seed');
  const reliefInput = document.querySelector('#relief');
  const roadsInput = document.querySelector('#roads');
  const contoursInput = document.querySelector('#contours');
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const WIDTH = 320, LENGTH = 420, NX = 192, NY = 252;
  const LOW = 4, HIGH = 108;

  // Continuous, domain-warped noise rather than a collection of stamped shapes.
  function makeNoise(seed) {
    function hash(x, y) {
      let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    }
    function noise(x, y) {
      const ix = Math.floor(x), iy = Math.floor(y);
      const u = x - ix, v = y - iy;
      const sx = u * u * u * (u * (u * 6 - 15) + 10);
      const sy = v * v * v * (v * (v * 6 - 15) + 10);
      return mix(mix(hash(ix, iy), hash(ix + 1, iy), sx),
        mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy) * 2 - 1;
    }
    function fbm(x, y, octaves = 5) {
      let value = 0, amplitude = 0.55;
      for (let i = 0; i < octaves; i++) {
        value += noise(x, y) * amplitude;
        // Rotate between octaves so the lattice does not become the landscape.
        [x, y] = [1.64 * x + 1.31 * y + 17.1, -1.31 * x + 1.64 * y + 9.2];
        amplitude *= 0.48;
      }
      return value;
    }
    return { noise, fbm };
  }

  function buildTerrain(seed, relief) {
    const { noise, fbm } = makeNoise(seed);
    const heights = new Float32Array((NX + 1) * (NY + 1));
    const routes = new Float32Array(heights.length);
    const phase = noise(41, 29) * Math.PI;
    const routeX = (t, branch) => {
      const bend = Math.sin(Math.PI * t);
      return branch * 77 + bend * (35 * Math.sin(t * 6.5 + phase + branch * 0.8)
        + 17 * Math.sin(t * 13 + phase * 0.6));
    };
    for (let j = 0; j <= NY; j++) {
      const t = j / NY, y = (t - 0.5) * LENGTH;
      for (let i = 0; i <= NX; i++) {
        const x = (i / NX - 0.5) * WIDTH;
        const u = x / 90, v = y / 110;
        const wx = u + 0.85 * fbm(u * 0.8 + 11, v * 0.8 - 9, 3);
        const wy = v + 0.85 * fbm(u * 0.8 - 7, v * 0.8 + 23, 3);
        // The flats are bands with irregular foothills, not isolated disks.
        const warpedT = t + 0.065 * fbm(u * 0.85 + 31, v * 0.65, 3);
        const envelope = smooth(0.13, 0.29, warpedT) * (1 - smooth(0.74, 0.89, warpedT));
        const rise = smooth(0.15, 0.87, warpedT);
        const broad = fbm(wx * 0.9, wy * 0.9);
        const ridge = 1 - Math.abs(fbm(wx * 1.5 + 4, wy * 1.3 + 19));
        // Incised, branching channels are level sets of another warped field.
        const channel = Math.abs(fbm(wx * 1.15 + 73, wy * 1.2 - 37, 4));
        const ravine = Math.exp(-channel * channel / 0.008);
        const detail = fbm(wx * 3.2 - 14, wy * 3.2 + 51, 4);
        const h = mix(LOW, HIGH, rise) + relief * envelope *
          (broad * 72 + (ridge * ridge - 0.55) * 58 - ravine * 43 + detail * 9);
        const k = j * (NX + 1) + i;
        heights[k] = h;
        let distance = Infinity;
        for (const branch of [-1, 0, 1]) {
          const center = routeX(t, branch);
          const derivative = (routeX(t + 0.001, branch) - routeX(t - 0.001, branch)) / (0.002 * LENGTH);
          distance = Math.min(distance, Math.abs(x - center) / Math.hypot(1, derivative));
        }
        const width = 2.1 + 0.4 * noise(u * 2 + 5, v * 2);
        routes[k] = 1 - smooth(width * 0.6, width + 1.3, distance);
      }
    }
    // Shared grid vertices keep the entire landscape one continuous surface.
    const vertices = new Float32Array(heights.length * 7);
    const dx = WIDTH / NX, dy = LENGTH / NY;
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const k = j * (NX + 1) + i;
      const l = Math.max(0, i - 1), r = Math.min(NX, i + 1);
      const b = Math.max(0, j - 1), f = Math.min(NY, j + 1);
      const sx = (heights[j * (NX + 1) + r] - heights[j * (NX + 1) + l]) / ((r - l) * dx);
      const sy = (heights[f * (NX + 1) + i] - heights[b * (NX + 1) + i]) / ((f - b) * dy);
      const length = Math.hypot(sx, sy, 1);
      vertices.set([(i / NX - 0.5) * WIDTH, (j / NY - 0.5) * LENGTH,
        heights[k], -sx / length, -sy / length, 1 / length, routes[k]], k * 7);
    }
    const indices = new Uint32Array(NX * NY * 6);
    let cursor = 0;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      indices.set([a, b, c, b, d, c], cursor);
      cursor += 6;
    }
    return { vertices, indices };
  }

  try {
    const gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) throw new Error('Diese Skizze benötigt WebGL 2.');
    function shader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const program = gl.createProgram();
    const shaders = [shader(gl.VERTEX_SHADER, `#version 300 es
      precision highp float;
      layout(location=0) in vec3 position;
      layout(location=1) in vec3 normal;
      layout(location=2) in float road;
      uniform vec3 target;
      uniform vec3 right;
      uniform vec3 up;
      uniform vec3 eye;
      uniform vec2 scale;
      out vec3 world;
      out vec3 surfaceNormal;
      out float route;
      void main() {
        vec3 p = position - target;
        gl_Position = vec4(dot(p, right) * scale.x, dot(p, up) * scale.y, -dot(p, eye) / 1000.0, 1.0);
        world = position;
        surfaceNormal = normal;
        route = road;
      }`), shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      in vec3 world;
      in vec3 surfaceNormal;
      in float route;
      uniform bool roads;
      uniform bool contours;
      out vec4 outputColor;
      void main() {
        vec3 n = normalize(surfaceNormal);
        vec3 light = normalize(vec3(-0.55, -0.45, 0.9));
        float altitude = smoothstep(-25.0, 135.0, world.z);
        vec3 color = mix(vec3(0.22, 0.31, 0.36), vec3(0.61, 0.65, 0.63), altitude);
        float steep = 1.0 - smoothstep(0.35, 0.92, n.z);
        color = mix(color, vec3(0.31, 0.35, 0.39), steep * 0.65);
        if (contours) {
          float level = world.z / 8.0;
          float footprint = fwidth(level);
          float distance = abs(fract(level + 0.5) - 0.5);
          float line = 1.0 - smoothstep(footprint * 0.5, max(footprint * 1.3, 0.0001), distance);
          color *= 1.0 - line * 0.2 * smoothstep(0.002, 0.025, footprint);
        }
        if (roads) color = mix(color, vec3(0.77, 0.65, 0.43), route * 0.8);
        float diffuse = max(dot(n, light), 0.0);
        color *= 0.43 + 0.68 * diffuse;
        // Restrained cool fill keeps the sketch readable inside deep gullies.
        color += vec3(0.035, 0.05, 0.065) * (1.0 - diffuse);
        outputColor = vec4(color, 1.0);
      }`)];
    for (const s of shaders) gl.attachShader(program, s);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    for (const s of shaders) gl.deleteShader(s);
    gl.useProgram(program);
    const uniforms = Object.fromEntries(['target', 'right', 'up', 'eye', 'scale', 'roads', 'contours']
      .map(name => [name, gl.getUniformLocation(program, name)]));
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vertexBuffer = gl.createBuffer(), indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    for (const [location, size, offset] of [[0, 3, 0], [1, 3, 12], [2, 1, 24]]) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 28, offset);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.078, 0.11, 0.145, 1);
    let count = 0, scheduled = false;
    let yaw, pitch, zoom, target;
    function resetCamera() {
      yaw = -0.55; pitch = 0.82; zoom = 1;
      target = [0, 0, 46];
      requestDraw();
    }
    function basis() {
      const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      return { right: [c, s, 0], up: [-s * sp, c * sp, cp], eye: [s * cp, -c * cp, sp] };
    }
    function draw() {
      scheduled = false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const frame = basis(), scale = 2 * zoom / 570;
      gl.uniform3fv(uniforms.target, target);
      for (const name of ['right', 'up', 'eye']) gl.uniform3fv(uniforms[name], frame[name]);
      gl.uniform2f(uniforms.scale, scale * Math.min(w, h) / w, scale * Math.min(w, h) / h);
      gl.uniform1i(uniforms.roads, roadsInput.checked ? 1 : 0);
      gl.uniform1i(uniforms.contours, contoursInput.checked ? 1 : 0);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    }
    function requestDraw() {
      if (!scheduled) { scheduled = true; requestAnimationFrame(draw); }
    }
    function generate() {
      const seed = Number(seedInput.value) >>> 0;
      seedInput.value = String(seed);
      const mesh = buildTerrain(seed, Number(reliefInput.value));
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      count = mesh.indices.length;
      status.textContent = `Seed ${seed} · durchgehendes Höhenfeld · untere Ebene ${LOW}, obere Ebene ${HIGH} · Relief ${Number(reliefInput.value).toFixed(2)} · keine Spielbarkeitsregeln`;
      requestDraw();
    }
    document.querySelector('#generate').addEventListener('submit', event => { event.preventDefault(); generate(); });
    document.querySelector('#random').addEventListener('click', () => {
      seedInput.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
      generate();
    });
    document.querySelector('#reset').addEventListener('click', resetCamera);
    reliefInput.addEventListener('input', generate);
    for (const input of [roadsInput, contoursInput]) input.addEventListener('change', requestDraw);

    function pan(dx, dy) {
      const { right, up } = basis();
      const factor = 570 / (Math.min(canvas.clientWidth, canvas.clientHeight) * zoom);
      for (let i = 0; i < 3; i++) target[i] += (-right[i] * dx + up[i] * dy) * factor;
    }
    const pointers = new Map();
    function gesture() {
      const [a, b] = [...pointers.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
        distance: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && ![0, 1, 2].includes(event.button)) return;
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, pan: event.button !== 0 || event.shiftKey });
      canvas.classList.add('dragging');
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', event => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const before = pointers.size === 2 ? gesture() : null;
      const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
      pointers.set(event.pointerId, { ...previous, x: event.clientX, y: event.clientY });
      if (before) {
        const after = gesture();
        pan(after.x - before.x, after.y - before.y);
        zoom = clamp(zoom * after.distance / Math.max(before.distance, 1), 0.45, 5);
        const angle = after.angle - before.angle;
        yaw += Math.atan2(Math.sin(angle), Math.cos(angle));
      } else if (pointers.size === 1) {
        if (previous.pan || event.shiftKey) pan(dx, dy);
        else { yaw -= dx * 0.007; pitch = clamp(pitch + dy * 0.005, 0.15, 1.5); }
      }
      requestDraw();
    });
    function release(event) {
      pointers.delete(event.pointerId);
      if (!pointers.size) canvas.classList.remove('dragging');
    }
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, release);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      zoom = clamp(zoom * Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.025 : 0.0015)), 0.45, 5);
      requestDraw();
    }, { passive: false });
    new ResizeObserver(requestDraw).observe(canvas);
    const querySeed = new URLSearchParams(location.search).get('seed');
    if (querySeed !== null && /^\d+$/.test(querySeed)) seedInput.value = String(Number(querySeed) >>> 0);
    resetCamera();
    generate();
  } catch (error) {
    status.textContent = error.message;
    console.error(error);
  }
})();
