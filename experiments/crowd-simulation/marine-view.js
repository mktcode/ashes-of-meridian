'use strict';

(() => {
  const canvas = document.getElementById('scene');
  const status = document.getElementById('status');
  try {
    const gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) throw new Error('Dieses Experiment benötigt WebGL 2.');
    function shader(type, source) {
      const handle = gl.createShader(type);
      gl.shaderSource(handle, source);
      gl.compileShader(handle);
      if (!gl.getShaderParameter(handle, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(handle));
      return handle;
    }
    const program = gl.createProgram();
    const shaders = [shader(gl.VERTEX_SHADER, `#version 300 es
      precision highp float;
      layout(location=0) in vec3 position;
      layout(location=1) in vec3 normal;
      uniform mat4 model;
      uniform vec3 right, up, eye;
      uniform vec2 scale;
      out vec3 surfaceNormal;
      void main() {
        vec3 p = (model * vec4(position, 1.0)).xyz;
        gl_Position = vec4(dot(p, right) * scale.x, dot(p, up) * scale.y, -dot(p, eye) / 80.0, 1.0);
        surfaceNormal = transpose(inverse(mat3(model))) * normal;
      }`), shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      in vec3 surfaceNormal;
      uniform vec3 color;
      out vec4 outputColor;
      void main() {
        vec3 n = normalize(surfaceNormal);
        float light = max(0.0, dot(n, normalize(vec3(-0.5, 0.9, 0.7))));
        outputColor = vec4(color * (0.42 + light * 0.65), 1.0);
      }`)];
    for (const handle of shaders) gl.attachShader(program, handle);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    for (const handle of shaders) gl.deleteShader(handle);
    const uniforms = Object.fromEntries(['model', 'right', 'up', 'eye', 'scale', 'color'].map(name => [name, gl.getUniformLocation(program, name)]));

    // One shared unit cube; joints transform it without rebuilding geometry.
    const vertices = [];
    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [-1, 1]) {
        const a = (axis + 1) % 3, b = (axis + 2) % 3;
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (const index of [0, 1, 2, 0, 2, 3]) {
          const p = [0, 0, 0], n = [0, 0, 0];
          p[axis] = sign * 0.5;
          p[a] = corners[index][0] * 0.5;
          p[b] = corners[index][1] * 0.5;
          n[axis] = sign;
          vertices.push(...p, ...n);
        }
      }
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    for (let i = 0; i < 2; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 24, i * 12);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.067, 0.106, 0.141, 1);
    gl.useProgram(program);

    const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    function multiply(a, b) {
      const out = new Array(16).fill(0);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
      return out;
    }
    function translate(p) {
      const m = identity();
      [m[12], m[13], m[14]] = p;
      return m;
    }
    function rotate([x, y, z]) {
      const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
      return multiply(multiply([cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]), [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]);
    }
    function box(transform, center, size, color) {
      const scale = identity();
      [scale[0], scale[5], scale[10]] = size;
      gl.uniformMatrix4fv(uniforms.model, false, multiply(multiply(transform, translate(center)), scale));
      gl.uniform3fv(uniforms.color, color);
      gl.drawArrays(gl.TRIANGLES, 0, 36);
    }

    const world = CrowdSimulation.createWorld();
    let yaw = 0.55, pitch = 0.90, zoom = 1;
    let paused = false, previous = null;
    const speed = document.getElementById('speed');
    const pause = document.getElementById('pause');
    speed.addEventListener('input', () => { document.getElementById('speed-value').textContent = `${Number(speed.value).toFixed(2)}×`; });
    pause.addEventListener('click', () => {
      paused = !paused;
      pause.textContent = paused ? 'Fortsetzen' : 'Pause';
      pause.setAttribute('aria-pressed', String(paused));
    });
    document.getElementById('reset').addEventListener('click', () => { yaw = 0.55; pitch = 0.90; zoom = 1; });
    function commandAt(event) {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - canvas.clientLeft) / canvas.clientWidth * 2 - 1;
      const y = 1 - (event.clientY - rect.top - canvas.clientTop) / canvas.clientHeight * 2;
      if (Math.abs(x) > 1 || Math.abs(y) > 1) return;
      const camera = CrowdSimulation.cameraFrame(yaw, pitch, zoom, canvas.clientWidth, canvas.clientHeight);
      const point = CrowdSimulation.groundPoint(x, y, camera);
      if (point) CrowdSimulation.moveTo(world, point);
    }
    let drag = null;
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
      if (drag) { drag.cancelled = true; return; }
      if (event.button !== 0 && event.button !== 2) return;
      drag = { id: event.pointerId, button: event.button, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false, cancelled: false };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId || drag.cancelled) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= 6) return;
      drag.moved = true;
      yaw -= (event.clientX - drag.x) * 0.008;
      pitch = Math.max(0.35, Math.min(1.35, pitch + (event.clientY - drag.y) * 0.008));
      drag.x = event.clientX; drag.y = event.clientY;
    });
    canvas.addEventListener('pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      if (!drag.moved && !drag.cancelled && drag.button === 0
        && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= 6) commandAt(event);
      drag = null;
      canvas.releasePointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointercancel', () => { drag = null; });
    canvas.addEventListener('lostpointercapture', () => { drag = null; });
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      zoom = Math.max(0.7, Math.min(3, zoom * Math.exp(-event.deltaY * 0.001)));
    }, { passive: false });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      status.textContent = 'Grafikkontext verloren. Bitte die Seite neu laden.';
    });
    document.addEventListener('visibilitychange', () => { previous = null; });

    function frame(now) {
      if (gl.isContextLost()) return;
      const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (!paused) CrowdSimulation.update(world, dt * Number(speed.value));
      const moving = world.marines.some(marine => marine.moving);
      const message = paused ? 'Pausiert' : world.destination
        ? `${moving ? 'Alle Marines laufen zum Ziel' : 'Alle Marines am Ziel · Idle'} (${world.destination.x.toFixed(1)}, ${world.destination.z.toFixed(1)})`
        : 'Klick auf das Spielfeld setzt das gemeinsame Ziel.';
      if (status.textContent !== message) status.textContent = message;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const camera = CrowdSimulation.cameraFrame(yaw, pitch, zoom, w, h);
      for (const name of ['right', 'up', 'eye']) gl.uniform3fv(uniforms[name], camera[name]);
      gl.uniform2fv(uniforms.scale, camera.scale);
      const half = CrowdSimulation.halfSize, size = half * 2;
      box(identity(), [0, -0.045, 0], [size, 0.08, size], [0.18, 0.23, 0.26]);
      for (let i = -half; i <= half; i++) {
        box(identity(), [i, -0.003, 0], [0.015, 0.004, size], [0.27, 0.33, 0.35]);
        box(identity(), [0, -0.003, i], [size, 0.004, 0.015], [0.27, 0.33, 0.35]);
      }
      if (world.destination) {
        const { x, z } = world.destination;
        const color = moving ? [0.90, 0.68, 0.28] : [0.45, 0.76, 0.48];
        box(identity(), [x, 0.015, z], [0.65, 0.02, 0.07], color);
        box(identity(), [x, 0.015, z], [0.07, 0.02, 0.65], color);
      }
      for (const marine of world.marines) {
        const root = multiply(translate([marine.x, 0, marine.z]), rotate([0, marine.yaw, 0]));
        const pose = MarineModel.samplePose(marine.time, marine.runWeight), joints = {};
        for (const part of MarineModel.parts) {
          const animation = pose[part.name] || {};
          const offset = animation.offset || [0, 0, 0];
          const local = multiply(translate(part.pivot.map((v, i) => v + offset[i])), rotate(animation.rotation || [0, 0, 0]));
          const joint = multiply(part.parent ? joints[part.parent] : root, local);
          joints[part.name] = joint;
          box(joint, part.center, part.size, part.color);
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (error) {
    status.textContent = `Modell konnte nicht gestartet werden: ${error.message}`;
    console.error(error);
  }
})();
