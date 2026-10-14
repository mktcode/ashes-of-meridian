'use strict';

function createLandscapeView(canvas, labels) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) throw new Error('Dieses Experiment benötigt WebGL 2.');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function shader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function program(vertex, fragment, names) {
    const handle = gl.createProgram();
    const shaders = [shader(gl.VERTEX_SHADER, vertex), shader(gl.FRAGMENT_SHADER, fragment)];
    for (const shader of shaders) gl.attachShader(handle, shader);
    gl.linkProgram(handle);
    if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle));
    for (const shader of shaders) gl.deleteShader(shader);
    return { handle, uniforms: Object.fromEntries(names.map(name => [name, gl.getUniformLocation(handle, name)])) };
  }
  const lightSpace = `
    const vec3 lightDirection = normalize(vec3(-0.7, -0.45, 1.0));
    vec3 lightSpace(vec3 world) {
      vec3 p = world - vec3(0.0, 0.0, 90.0);
      vec3 right = normalize(vec3(0.45, -0.7, 0.0));
      vec3 up = cross(lightDirection, right);
      return vec3(dot(p, right) / 490.0, dot(p, up) / 520.0, -dot(p, lightDirection) / 650.0);
    }`;
  const cameraSpace = `
    uniform vec3 target;
    uniform vec3 right;
    uniform vec3 up;
    uniform vec3 eye;
    uniform vec2 scale;
    vec4 project(vec3 world) {
      vec3 p = world - target;
      return vec4(dot(p, right) * scale.x, dot(p, up) * scale.y, -dot(p, eye) / 1100.0, 1.0);
    }`;
  const cameraNames = ['target', 'right', 'up', 'eye', 'scale'];
  const shadowProgram = program(`#version 300 es
    precision highp float;
    layout(location=0) in vec3 position;
    ${lightSpace}
    void main() { gl_Position = vec4(lightSpace(position), 1.0); }`, `#version 300 es
    precision highp float;
    void main() { }`, []);
  const terrainProgram = program(`#version 300 es
    precision highp float;
    layout(location=0) in vec3 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in float ambient;
    ${cameraSpace}
    out vec3 world;
    out vec3 surfaceNormal;
    out float cavity;
    void main() {
      gl_Position = project(position);
      world = position;
      surfaceNormal = normal;
      cavity = ambient;
    }`, `#version 300 es
    precision highp float;
    precision highp sampler2DShadow;
    in vec3 world;
    in vec3 surfaceNormal;
    in float cavity;
    uniform sampler2DShadow shadowMap;
    uniform bool contours;
    out vec4 outputColor;
    ${lightSpace}
    void main() {
      vec3 normal = normalize(surfaceNormal);
      float diffuse = max(dot(normal, lightDirection), 0.0);
      vec3 shadow = lightSpace(world) * 0.5 + 0.5;
      float visibility = 1.0;
      if (all(greaterThan(shadow, vec3(0.0))) && all(lessThan(shadow, vec3(1.0)))) {
        float bias = 0.0007 + (1.0 - diffuse) * 0.0012;
        vec2 texel = 1.0 / vec2(textureSize(shadowMap, 0));
        visibility = 0.0;
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
          visibility += texture(shadowMap, vec3(shadow.xy + vec2(x, y) * texel, shadow.z - bias)) / 9.0;
        }
      }
      vec3 color = mix(vec3(0.34, 0.43, 0.46), vec3(0.69, 0.68, 0.62), smoothstep(0.0, 250.0, world.z));
      float rock = 1.0 - smoothstep(0.38, 0.88, normal.z);
      color = mix(color, vec3(0.49, 0.47, 0.44), rock * 0.65);
      if (contours) {
        float level = world.z / 12.0;
        float footprint = fwidth(level);
        float distance = abs(fract(level + 0.5) - 0.5);
        float line = 1.0 - smoothstep(footprint * 0.45, max(footprint * 1.2, 0.0001), distance);
        color *= 1.0 - 0.18 * line * smoothstep(0.002, 0.025, footprint);
      }
      color *= (0.48 + diffuse * visibility * 0.64) * cavity;
      color += vec3(0.025, 0.04, 0.055) * (1.0 - diffuse * visibility);
      outputColor = vec4(color, 1.0);
    }`, [...cameraNames, 'shadowMap', 'contours']);
  const overlayProgram = program(`#version 300 es
    precision highp float;
    layout(location=0) in vec3 position;
    layout(location=1) in vec3 color;
    ${cameraSpace}
    out vec3 tint;
    void main() {
      gl_Position = project(position);
      tint = color;
    }`, `#version 300 es
    precision highp float;
    in vec3 tint;
    out vec4 outputColor;
    void main() { outputColor = vec4(tint, 1.0); }`, cameraNames);
  const terrainVao = gl.createVertexArray();
  gl.bindVertexArray(terrainVao);
  const vertexBuffer = gl.createBuffer(), indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  for (const [location, size, offset] of [[0, 3, 0], [1, 3, 12], [2, 1, 24]]) {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 28, offset);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  const overlays = {};
  for (const name of ['ridges', 'valleys', 'routes']) {
    const vao = gl.createVertexArray(), buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    overlays[name] = { vao, buffer, count: 0 };
  }
  const SHADOW_SIZE = 2048;
  const shadowTexture = gl.createTexture(), shadowFramebuffer = gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTexture, 0);
  gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Die Schattenansicht konnte nicht angelegt werden.');
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.067, 0.106, 0.141, 1);

  let yaw = -0.55, pitch = 0.88, zoom = 1, target = [0, 0, 90];
  let count = 0, scheduled = false, places = [];
  let options = { structure: false, routes: true, places: true, contours: false };
  function basis() {
    const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return { right: [c, s, 0], up: [-s * sp, c * sp, cp], eye: [s * cp, -c * cp, sp] };
  }
  function useCamera(program, frame) {
    gl.useProgram(program.handle);
    gl.uniform3fv(program.uniforms.target, target);
    for (const name of ['right', 'up', 'eye']) gl.uniform3fv(program.uniforms[name], frame[name]);
    const scale = 2 * zoom / 760, size = Math.min(canvas.width, canvas.height);
    gl.uniform2f(program.uniforms.scale, scale * size / canvas.width, scale * size / canvas.height);
  }
  function draw() {
    scheduled = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const frame = basis();
    useCamera(terrainProgram, frame);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
    gl.uniform1i(terrainProgram.uniforms.shadowMap, 0);
    gl.uniform1i(terrainProgram.uniforms.contours, options.contours ? 1 : 0);
    gl.bindVertexArray(terrainVao);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    useCamera(overlayProgram, frame);
    for (const name of ['ridges', 'valleys', 'routes']) {
      if (!(name === 'routes' ? options.routes : options.structure)) continue;
      gl.bindVertexArray(overlays[name].vao);
      gl.drawArrays(gl.TRIANGLES, 0, overlays[name].count);
    }
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    const pixelsPerUnit = Math.min(cssW, cssH) * zoom / 760;
    for (const place of places) {
      const relative = place.position.map((v, i) => v - target[i]);
      const x = cssW / 2 + dot(relative, frame.right) * pixelsPerUnit;
      const y = cssH / 2 - dot(relative, frame.up) * pixelsPerUnit;
      place.element.hidden = !options.places || x < 0 || x > cssW || y < 0 || y > cssH;
      place.element.style.left = `${x}px`; place.element.style.top = `${y - 9}px`;
    }
  }
  function requestDraw() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(draw); }
  }
  function shadowPass() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shadowProgram.handle);
    gl.bindVertexArray(terrainVao);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function ribbons(curves, mesh, color, width) {
    const vertices = [];
    const inside = p => Math.abs(p.x) <= LandscapeCore.WIDTH / 2 && Math.abs(p.y) <= LandscapeCore.LENGTH / 2;
    for (const curve of curves) {
      const points = curve.points;
      const tint = curve.guaranteed ? [0.92, 0.79, 0.54] : color;
      const sides = points.map((p, i) => {
        const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
        const length = Math.max(0.001, Math.hypot(b.x - a.x, b.y - a.y));
        const nx = -(b.y - a.y) / length * width / 2, ny = (b.x - a.x) / length * width / 2;
        return [{ x: p.x + nx, y: p.y + ny }, { x: p.x - nx, y: p.y - ny }];
      });
      for (let i = 1; i < points.length; i++) {
        if (!inside(points[i - 1]) || !inside(points[i])) continue;
        const [a, b] = sides[i - 1], [c, d] = sides[i];
        for (const p of [a, b, c, b, d, c]) vertices.push(p.x, p.y, mesh.sampleHeight(p.x, p.y) + 2.2, ...tint);
      }
    }
    return new Float32Array(vertices);
  }
  function setScene(plan, mesh, stage) {
    gl.bindVertexArray(terrainVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    count = mesh.indices.length;
    const features = plan.features.filter(f => stage === 'landscape' || !f.secondary);
    for (const [name, curves, color, width] of [
      ['ridges', features.filter(f => f.kind === 'ridge'), [0.84, 0.49, 0.41], 1.8],
      ['valleys', features.filter(f => f.kind === 'valley'), [0.43, 0.73, 0.79], 1.8],
      ['routes', plan.routes, [0.70, 0.59, 0.43], 1.5],
    ]) {
      const data = ribbons(curves, mesh, color, width);
      gl.bindBuffer(gl.ARRAY_BUFFER, overlays[name].buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      overlays[name].count = data.length / 6;
    }
    labels.replaceChildren();
    places = plan.nodes.filter(node => node.label !== false).map(node => {
      const element = document.createElement('span');
      element.textContent = node.name;
      labels.append(element);
      return { element, position: [node.x, node.y, mesh.sampleHeight(node.x, node.y) + 8] };
    });
    shadowPass();
    requestDraw();
  }
  function pan(dx, dy) {
    const frame = basis(), factor = 760 / (Math.min(canvas.clientWidth, canvas.clientHeight) * zoom);
    for (let i = 0; i < 3; i++) target[i] += (-frame.right[i] * dx + frame.up[i] * dy) * factor;
    requestDraw();
  }
  new ResizeObserver(requestDraw).observe(canvas);
  return {
    setScene,
    setOptions(value) { options = { ...options, ...value }; requestDraw(); },
    resetCamera(top = false) {
      yaw = top ? 0 : -0.55; pitch = top ? Math.PI / 2 : 0.88; zoom = 1; target = [0, 0, 90];
      requestDraw();
    },
    orbit(dx, dy) { yaw -= dx * 0.007; pitch = clamp(pitch + dy * 0.005, 0.18, Math.PI / 2); requestDraw(); },
    pan,
    zoomBy(factor) { zoom = clamp(zoom * factor, 0.45, 5); requestDraw(); },
    gesture(dx, dy, angle, factor) {
      pan(dx, dy); yaw += angle; zoom = clamp(zoom * factor, 0.45, 5); requestDraw();
    },
  };
}
