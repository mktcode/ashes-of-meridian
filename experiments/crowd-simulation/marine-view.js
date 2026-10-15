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
      layout(location=2) in mat4 instanceModel;
      layout(location=6) in vec3 instanceColor;
      uniform mat4 model;
      uniform bool instanced;
      uniform float depthRange;
      uniform vec3 center;
      uniform vec3 right, up, eye;
      uniform vec2 scale;
      out vec3 surfaceNormal;
      out vec3 worldPosition;
      out vec3 boxColor;
      void main() {
        mat4 transform = instanced ? instanceModel : model;
        vec3 p = (transform * vec4(position, 1.0)).xyz;
        vec3 relative = p - center;
        gl_Position = vec4(dot(relative, right) * scale.x, dot(relative, up) * scale.y, -dot(relative, eye) / depthRange, 1.0);
        surfaceNormal = transpose(inverse(mat3(transform))) * normal;
        worldPosition = p;
        boxColor = instanceColor;
      }`), shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      in vec3 surfaceNormal;
      in vec3 worldPosition;
      in vec3 boxColor;
      uniform bool terrain;
      out vec4 outputColor;
      void main() {
        vec3 n = normalize(surfaceNormal);
        float light = max(0.0, dot(n, normalize(vec3(-0.5, 0.9, 0.7))));
        vec3 tint = boxColor;
        if (terrain) {
          tint = mix(vec3(0.27, 0.36, 0.28), vec3(0.57, 0.58, 0.40), smoothstep(-0.4, 2.1, worldPosition.y));
          tint = mix(tint, vec3(0.38, 0.35, 0.33), 1.0 - smoothstep(0.70, 0.87, n.y));
          vec2 distanceToGrid = abs(fract(worldPosition.xz + 0.5) - 0.5);
          vec2 line = 1.0 - smoothstep(vec2(0.012), vec2(0.012) + fwidth(worldPosition.xz), distanceToGrid);
          tint *= 1.0 - 0.16 * max(line.x, line.y);
        }
        outputColor = vec4(tint * (0.42 + light * 0.65), 1.0);
      }`)];
    for (const handle of shaders) gl.attachShader(program, handle);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    for (const handle of shaders) gl.deleteShader(handle);
    const uniforms = Object.fromEntries(['model', 'right', 'up', 'eye', 'scale', 'terrain', 'instanced', 'depthRange', 'center'].map(name => [name, gl.getUniformLocation(program, name)]));

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
    const instanceBuffer = gl.createBuffer(), instances = MarineInstances.create();
    let instanceBytes = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    for (let i = 0; i < 4; i++) {
      gl.enableVertexAttribArray(2 + i);
      gl.vertexAttribPointer(2 + i, 4, gl.FLOAT, false, MarineInstances.stride * 4, i * 16);
      gl.vertexAttribDivisor(2 + i, 1);
    }
    gl.enableVertexAttribArray(6);
    gl.vertexAttribPointer(6, 3, gl.FLOAT, false, MarineInstances.stride * 4, 64);
    gl.vertexAttribDivisor(6, 1);
    const terrainVao = gl.createVertexArray();
    gl.bindVertexArray(terrainVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, CrowdTerrain.vertices, gl.STATIC_DRAW);
    for (let i = 0; i < 2; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 24, i * 12);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.067, 0.106, 0.141, 1);
    gl.useProgram(program);

    const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    function translate(p) {
      const m = identity();
      [m[12], m[13], m[14]] = p;
      return m;
    }
    const box = (transform, center, size, color) => instances.box(transform, center, size, color);

    const world = CrowdSimulation.createWorld();
    let yaw = 0.55, pitch = 0.90, zoom = 1, focus = null;
    let paused = false, previous = null;
    const speed = document.getElementById('speed');
    const pause = document.getElementById('pause');
    speed.addEventListener('input', () => { document.getElementById('speed-value').textContent = `${Number(speed.value).toFixed(2)}×`; });
    function spawnMarines(count) {
      world.notice = '';
      const added = CrowdSimulation.spawnMarines(world, count);
      if (added.length < count) world.notice = 'Kein freier Spawn- oder Standplatz mehr vorhanden.';
      document.getElementById('unit-count').textContent = String(world.marines.length);
    }
    document.getElementById('spawn').addEventListener('click', () => spawnMarines(1));
    document.getElementById('spawn-ten').addEventListener('click', () => spawnMarines(10));
    document.getElementById('spawn-hundred').addEventListener('click', () => spawnMarines(100));
    document.getElementById('spawn-thousand').addEventListener('click', () => spawnMarines(1000));
    pause.addEventListener('click', () => {
      paused = !paused;
      pause.textContent = paused ? 'Fortsetzen' : 'Pause';
      pause.setAttribute('aria-pressed', String(paused));
    });
    document.getElementById('reset').addEventListener('click', () => { yaw = 0.55; pitch = 0.90; zoom = 1; focus = null; });
    document.getElementById('focus').addEventListener('click', () => {
      const n = world.marines.length;
      if (!n) { focus = null; zoom = 1; return; }
      focus = { x: world.marines.reduce((sum, m) => sum + m.x, 0) / n, z: world.marines.reduce((sum, m) => sum + m.z, 0) / n };
      const camera = CrowdSimulation.cameraFrame(yaw, pitch, zoom, canvas.clientWidth, canvas.clientHeight, focus);
      let right = MarineInstances.radius, up = MarineInstances.radius;
      for (const m of world.marines) {
        const relative = [m.x - focus.x, m.y - camera.center[1], m.z - focus.z];
        right = Math.max(right, Math.abs(relative.reduce((sum, v, i) => sum + v * camera.right[i], 0)) + MarineInstances.radius);
        up = Math.max(up, Math.abs(relative.reduce((sum, v, i) => sum + v * camera.up[i], 0)) + MarineInstances.radius);
      }
      zoom = Math.max(0.7, Math.min(20, 0.85 * (CrowdTerrain.halfSize * 2 * Math.SQRT2 + 8) / (2 * Math.min(canvas.clientWidth, canvas.clientHeight))
        * Math.min(canvas.clientWidth / right, canvas.clientHeight / up)));
    });
    function commandAt(event) {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - canvas.clientLeft) / canvas.clientWidth * 2 - 1;
      const y = 1 - (event.clientY - rect.top - canvas.clientTop) / canvas.clientHeight * 2;
      if (Math.abs(x) > 1 || Math.abs(y) > 1) return;
      const camera = CrowdSimulation.cameraFrame(yaw, pitch, zoom, canvas.clientWidth, canvas.clientHeight, focus);
      const point = CrowdSimulation.groundPoint(x, y, camera);
      if (point) world.notice = CrowdSimulation.moveTo(world, point) ? '' : 'Dieses Ziel ist gesperrt, nicht erreichbar oder bietet zu wenig Platz.';
    }
    let drag = null;
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
      if (drag) { drag.cancelled = true; return; }
      if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
      drag = { id: event.pointerId, button: event.button, pan: event.button === 1 || event.shiftKey, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false, cancelled: false };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId || drag.cancelled) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= 6) return;
      drag.moved = true;
      if (drag.pan) {
        const camera = CrowdSimulation.cameraFrame(yaw, pitch, zoom, canvas.clientWidth, canvas.clientHeight, focus);
        const dx = -(event.clientX - drag.x) * 2 / (canvas.clientWidth * camera.scale[0]);
        const dy = (event.clientY - drag.y) * 2 / (canvas.clientHeight * camera.scale[1] * Math.sin(pitch) ** 2);
        focus = { x: Math.max(-CrowdTerrain.halfSize, Math.min(CrowdTerrain.halfSize, (focus?.x || 0) + camera.right[0] * dx + camera.up[0] * dy)),
          z: Math.max(-CrowdTerrain.halfSize, Math.min(CrowdTerrain.halfSize, (focus?.z || 0) + camera.right[2] * dx + camera.up[2] * dy)) };
      } else {
        yaw -= (event.clientX - drag.x) * 0.008;
        pitch = Math.max(0.35, Math.min(1.35, pitch + (event.clientY - drag.y) * 0.008));
      }
      drag.x = event.clientX; drag.y = event.clientY;
    });
    canvas.addEventListener('pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      if (!drag.moved && !drag.cancelled && !drag.pan && drag.button === 0
        && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= 6) commandAt(event);
      drag = null;
      canvas.releasePointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointercancel', () => { drag = null; });
    canvas.addEventListener('lostpointercapture', () => { drag = null; });
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      zoom = Math.max(0.7, Math.min(20, zoom * Math.exp(-event.deltaY * 0.001)));
    }, { passive: false });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      status.textContent = 'Grafikkontext verloren. Bitte die Seite neu laden.';
    });
    document.addEventListener('visibilitychange', () => { previous = null; });

    const metrics = document.getElementById('metrics');
    let lastView = '', lastSteps = -1, lastAccumulator = -1, lastUnits = null, lastCount = -1, lastDestination = null;
    let samples = 0, simulationMs = 0, renderingMs = 0, measuredAt = 0, visibleCount = 0;
    function frame(now) {
      if (gl.isContextLost()) return;
      const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const simulationStart = performance.now();
      if (!paused) CrowdSimulation.update(world, dt * Number(speed.value));
      simulationMs += performance.now() - simulationStart;
      const renderStart = performance.now();
      const moving = world.marines.some(marine => marine.moving);
      const message = world.notice || (paused ? 'Pausiert' : world.destination
        ? `${moving ? 'Marines folgen dem Flow Field' : 'Alle Marines am Ziel · Idle'} (${world.destination.x.toFixed(1)}, ${world.destination.z.toFixed(1)})`
        : 'Klick auf das Spielfeld setzt das gemeinsame Ziel.');
      if (status.textContent !== message) status.textContent = message;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const camera = CrowdSimulation.cameraFrame(yaw, pitch, zoom, w, h, focus);
      for (const name of ['right', 'up', 'eye']) gl.uniform3fv(uniforms[name], camera[name]);
      gl.uniform2fv(uniforms.scale, camera.scale);
      gl.uniform3fv(uniforms.center, camera.center);
      gl.uniform1f(uniforms.depthRange, camera.depth);
      gl.uniform1i(uniforms.instanced, 0);
      gl.bindVertexArray(terrainVao);
      gl.uniformMatrix4fv(uniforms.model, false, identity());
      gl.uniform1i(uniforms.terrain, 1);
      gl.drawArrays(gl.TRIANGLES, 0, CrowdTerrain.vertices.length / 6);
      gl.bindVertexArray(vao);
      gl.uniform1i(uniforms.terrain, 0);
      gl.uniform1i(uniforms.instanced, 1);
      const view = `${yaw}:${pitch}:${zoom}:${w}:${h}:${focus?.x}:${focus?.z}`;
      const dirty = world.stats.steps !== lastSteps || world.accumulator !== lastAccumulator || world.marines !== lastUnits
        || world.marines.length !== lastCount || world.destination !== lastDestination || view !== lastView;
      if (dirty) {
        instances.begin(world.marines.length * MarineModel.parts.length + CrowdNavigation.obstacles.length + (world.destination ? 2 : 0));
        for (const obstacle of CrowdNavigation.obstacles) {
          const root = translate([obstacle.x, obstacle.baseY, obstacle.z]);
          box(root, [0, obstacle.height / 2, 0], [obstacle.width, obstacle.height, obstacle.depth], [0.44, 0.40, 0.34]);
        }
        if (world.destination) {
          const { x, z } = world.destination;
          const color = moving ? [0.90, 0.68, 0.28] : [0.45, 0.76, 0.48];
          const marker = CrowdTerrain.transform(x, z, CrowdTerrain.heightAt(x, z) + 0.035, 0);
          box(marker, [0, 0, 0], [0.65, 0.02, 0.07], color);
          box(marker, [0, 0, 0], [0.07, 0.02, 0.65], color);
        }
        visibleCount = 0;
        for (const unit of world.marines) {
          const marine = CrowdSimulation.renderMarine(world, unit);
          if (MarineInstances.visible(marine, camera)) { instances.marine(marine); visibleCount++; }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
        if (instanceBytes !== instances.data.byteLength) {
          instanceBytes = instances.data.byteLength;
          gl.bufferData(gl.ARRAY_BUFFER, instanceBytes, gl.DYNAMIC_DRAW);
        }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances.data.subarray(0, instances.count * MarineInstances.stride));
        lastSteps = world.stats.steps; lastAccumulator = world.accumulator; lastUnits = world.marines;
        lastCount = world.marines.length; lastDestination = world.destination; lastView = view;
      }
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, instances.count);
      renderingMs += performance.now() - renderStart; samples++;
      if (now - measuredAt >= 500) {
        const pending = world.marines.filter(m => m.moving).length;
        const waiting = world.marines.filter(m => m.moving && m.stalledFor > 2).length;
        metrics.textContent = `CPU Ø: Simulation ${(simulationMs / samples).toFixed(2)} ms · Render-Submission ${(renderingMs / samples).toFixed(2)} ms (kein GPU-/FPS-Test) · 2 Draws · ${visibleCount} sichtbar · ${pending} unterwegs / ${waiting} warten · ${world.stats.recoveryAttempts} Umwegversuche / ${world.stats.retargets} Ausweichplätze`;
        measuredAt = now; simulationMs = renderingMs = samples = 0;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (error) {
    status.textContent = `Modell konnte nicht gestartet werden: ${error.message}`;
    console.error(error);
  }
})();
