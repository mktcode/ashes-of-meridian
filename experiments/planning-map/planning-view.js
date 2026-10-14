'use strict';
// Orthographic 3D view with yaw and zoom; fixed pitch and world-space light.
const CELL_DATUM = 24;
function project3D(point, height, yaw = 0) {
  const dx = point.x - SIZE / 2, dy = point.y - SIZE / 2;
  const x = Math.cos(yaw) * dx - Math.sin(yaw) * dy;
  const y = Math.sin(yaw) * dx + Math.cos(yaw) * dy;
  return {
    x: (x - y) / Math.sqrt(2),
    y: (x + y) / Math.sqrt(6) - height * Math.sqrt(2 / 3),
    depth: (x + y + height) / Math.sqrt(3),
  };
}
// Clip in the unwarped lattice, so all annotations share the cell boundary.
function clipPolygon(points, boundary) {
  let result = points;
  for (let i = 0; i < boundary.length && result.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length];
    const side = (p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const input = result;
    result = [];
    let previous = input[input.length - 1], previousSide = side(previous);
    for (const current of input) {
      const currentSide = side(current);
      if ((previousSide >= 0) !== (currentSide >= 0)) {
        const t = previousSide / (previousSide - currentSide);
        result.push({ x: previous.x + t * (current.x - previous.x), y: previous.y + t * (current.y - previous.y) });
      }
      if (currentSide >= 0) result.push(current);
      previous = current;
      previousSide = currentSide;
    }
  }
  return result;
}
function polygonArea(points) {
  return Math.abs(points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length];
    return sum + a.x * b.y - a.y * b.x;
  }, 0)) / 2;
}
function clipHalfPlane(points, a, b, inside) {
  const sign = inside ? 1 : -1;
  const side = (p) => sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
  const result = [];
  if (!points.length) return result;
  let previous = points[points.length - 1], previousSide = side(previous);
  for (const current of points) {
    const currentSide = side(current);
    if ((previousSide >= 0) !== (currentSide >= 0)) {
      const t = previousSide / (previousSide - currentSide);
      result.push({ x: previous.x + t * (current.x - previous.x), y: previous.y + t * (current.y - previous.y) });
    }
    if (currentSide >= 0) result.push(current);
    previous = current;
    previousSide = currentSide;
  }
  return result;
}
// Convex subtraction partitions the plateau without leaving a top face over a ramp.
function subtractPolygon(points, cut) {
  const outside = [];
  let remainder = points;
  for (let i = 0; i < cut.length && remainder.length; i++) {
    const a = cut[i], b = cut[(i + 1) % cut.length];
    const part = clipHalfPlane(remainder, a, b, false);
    if (polygonArea(part) > 1e-6) outside.push(part);
    remainder = clipHalfPlane(remainder, a, b, true);
  }
  return outside;
}
function buildRoadRamps(plan) {
  const ramps = [];
  for (const edge of plan.edges) {
    const a = plan.cells[edge.a], b = plan.cells[edge.b];
    if (a.offset === b.offset) continue;
    const high = a.offset > b.offset ? a : b, low = high === a ? b : a;
    const edgeIndex = high.points.findIndex((p, i) =>
      [p, high.points[(i + 1) % 6]].every((corner) => low.points.some((other) => distance(corner, other) < 1e-6)));
    if (edgeIndex < 0) throw Error('Road ramp requires neighboring cells.');
    const start = high.points[edgeIndex], end = high.points[(edgeIndex + 1) % 6];
    const length = distance(start, end);
    const tangent = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
    const normal = { x: -tangent.y, y: tangent.x };
    const roadLength = distance(low, high);
    const direction = { x: (high.x - low.x) / roadLength, y: (high.y - low.y) / roadLength };
    const gradeAxis = direction.x * normal.x + direction.y * normal.y;
    const crossing = { x: (low.x + high.x) / 2, y: (low.y + high.y) / 2 };
    // Halfway from the shared edge to the cell center leaves a connected plateau
    // and keeps cuts at neighboring edges disjoint.
    const run = distance(crossing, high) / 2, width = ROAD_RADIUS / gradeAxis;
    const left = { x: crossing.x - tangent.x * width, y: crossing.y - tangent.y * width };
    const right = { x: crossing.x + tangent.x * width, y: crossing.y + tangent.y * width };
    const points = [left, right, { x: right.x + direction.x * run, y: right.y + direction.y * run },
      { x: left.x + direction.x * run, y: left.y + direction.y * run }];
    ramps.push({ highCellId: high.id, lowCellId: low.id, edgeIndex, crossing, direction, normal,
      run, points, lowHeight: CELL_DATUM + low.offset, highHeight: CELL_DATUM + high.offset });
  }
  return ramps;
}
function rampHeight(ramp, point) {
  const span = ramp.run * (ramp.direction.x * ramp.normal.x + ramp.direction.y * ramp.normal.y);
  const t = ((point.x - ramp.crossing.x) * ramp.normal.x + (point.y - ramp.crossing.y) * ramp.normal.y) / span;
  return ramp.lowHeight + Math.max(0, Math.min(1, t)) * (ramp.highHeight - ramp.lowHeight);
}
function buildPlanningMesh(plan) {
  const triangles = [], lines = [], ramps = buildRoadRamps(plan);
  const vertex = (target, point, height, color) => target.push(point.x, point.y, height, ...color);
  function surface(points, heightAt, color) {
    if (polygonArea(points) < 1e-6) return;
    const center = {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
    const outline = curvePath(plan, points, true), warpedCenter = warpPoint(plan, center);
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      vertex(triangles, warpedCenter, heightAt(center), color);
      vertex(triangles, a, heightAt(a.source), color);
      vertex(triangles, b, heightAt(b.source), color);
    }
  }
  function wall(a, b, bottomAt, topAt, color, rim = false) {
    const points = curvePath(plan, [a, b]);
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1], q = points[i];
      const loP = bottomAt(p.source), loQ = bottomAt(q.source), hiP = topAt(p.source), hiQ = topAt(q.source);
      for (const [point, z] of [[p, loP], [q, loQ], [q, hiQ], [p, loP], [q, hiQ], [p, hiP]]) vertex(triangles, point, z, color);
      if (rim) {
        vertex(lines, p, hiP + 0.25, [0.7, 0.79, 0.9]);
        vertex(lines, q, hiQ + 0.25, [0.7, 0.79, 0.9]);
      }
    }
  }
  for (const cell of plan.cells) {
    const height = CELL_DATUM + cell.offset, flatHeight = () => height;
    const cellRamps = ramps.filter((ramp) => ramp.highCellId === cell.id);
    let plateaus = [cell.points];
    for (const ramp of cellRamps) plateaus = plateaus.flatMap((polygon) => subtractPolygon(polygon, ramp.points));
    const patches = [...plateaus.map((points) => ({ points, heightAt: flatHeight })),
      ...cellRamps.map((ramp) => ({ points: ramp.points, heightAt: (p) => rampHeight(ramp, p) }))];
    const topColor = cell.offset >= 0 ? [0.37, 0.44, 0.54] : [0.29, 0.35, 0.44];
    for (const patch of patches) surface(patch.points, patch.heightAt, topColor);
    for (let i = 0; i < cell.points.length; i++) {
      const a = cell.points[i], b = cell.points[(i + 1) % cell.points.length];
      const edgeRamp = cellRamps.find((ramp) => ramp.edgeIndex === i);
      const stops = edgeRamp ? [a, edgeRamp.points[0], edgeRamp.points[1], b] : [a, b];
      const shade = 0.19 + 0.08 * Math.abs(b.x - a.x) / distance(a, b);
      const color = [shade, shade + 0.035, shade + 0.07];
      for (let j = 1; j < stops.length; j++) {
        const topAt = edgeRamp && j === 2 ? () => edgeRamp.lowHeight : flatHeight;
        wall(stops[j - 1], stops[j], () => 0, topAt, color, true);
      }
    }
    // Vertical cheeks close the cut into the higher plateau; no hidden wall across the road.
    for (const ramp of cellRamps) for (const i of [1, 3]) {
      wall(ramp.points[i], ramp.points[(i + 1) % 4], (p) => rampHeight(ramp, p), flatHeight, [0.25, 0.285, 0.32]);
    }
  }
  return { triangles: new Float32Array(triangles), lines: new Float32Array(lines) };
}
function fixedFrame(plan) {
  // Rotation-invariant bounds prevent implicit zoom or recentering during drag.
  const radius = Math.max(...plan.cells.flatMap((cell) => cell.outline.map((p) => Math.hypot(p.x - SIZE / 2, p.y - SIZE / 2))));
  const height = Math.max(...plan.cells.map((cell) => CELL_DATUM + cell.offset)) + 0.25;
  return { x: 0, y: -height * Math.sqrt(2 / 3) / 2,
    scale: Math.min((PIXELS - 100) / (2 * radius), 500 / (2 * radius / Math.sqrt(3) + height * Math.sqrt(2 / 3))) };
}
function createPlanningRenderer(canvas, labels) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) throw Error('Diese 3D-Ansicht benötigt WebGL 2.');
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(result));
    return result;
  }
  function program(vertexSource, fragmentSource) {
    const result = gl.createProgram();
    const shaders = [shader(gl.VERTEX_SHADER, vertexSource), shader(gl.FRAGMENT_SHADER, fragmentSource)];
    for (const source of shaders) gl.attachShader(result, source);
    gl.linkProgram(result);
    for (const source of shaders) gl.deleteShader(source);
    if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(result));
    return result;
  }
  // Fixed orthographic light volume encloses all seeds, including the warp.
  const lightProjection = `
    const vec3 lightDirection = normalize(vec3(-0.6, -0.8, 1.4));
    vec3 lightSpace(vec3 world) {
      vec3 p = world - vec3(150.0, 150.0, 0.0);
      vec3 right = vec3(0.8, -0.6, 0.0);
      vec3 up = cross(lightDirection, right);
      return vec3(dot(p, right)/190.0, dot(p, up)/190.0, -dot(p, lightDirection)/240.0);
    }`;
  const shadowProgram = program(`#version 300 es
    precision highp float;
    layout(location=0) in vec3 position;
    ${lightProjection}
    void main() { gl_Position = vec4(lightSpace(position), 1.0); }`, `#version 300 es
    precision highp float;
    void main() { }`);
  const viewProgram = program(`#version 300 es
    precision highp float;
    layout(location=0) in vec3 position;
    layout(location=1) in vec3 color;
    uniform vec3 frame;
    uniform vec2 rotation;
    out vec3 tint;
    out vec3 world;
    void main() {
      vec2 source = position.xy - vec2(150.0);
      vec2 p = vec2(rotation.x*source.x-rotation.y*source.y, rotation.y*source.x+rotation.x*source.y);
      vec2 projected = vec2((p.x-p.y)/sqrt(2.0), (p.x+p.y)/sqrt(6.0)-position.z*sqrt(2.0/3.0));
      vec2 screen = (projected-frame.xy)*frame.z;
      gl_Position = vec4(screen.x/450.0, -screen.y/300.0, -(p.x+p.y+position.z)/600.0, 1.0);
      tint = color;
      world = position;
    }`, `#version 300 es
    precision highp float;
    precision highp sampler2DShadow;
    in vec3 tint;
    in vec3 world;
    uniform sampler2DShadow shadowMap;
    uniform vec3 viewDirection;
    uniform bool unlit;
    out vec4 outputColor;
    ${lightProjection}
    void main() {
      if (unlit) { outputColor = vec4(tint, 1.0); return; }
      vec3 normal = normalize(cross(dFdx(world), dFdy(world)));
      if (dot(normal, viewDirection) < 0.0) normal = -normal;
      float diffuse = max(dot(normal, lightDirection), 0.0);
      vec3 shadow = lightSpace(world)*0.5+0.5;
      float bias = 0.0008 + 0.0015*(1.0-diffuse);
      float visibility = 0.0;
      vec2 texel = 1.0/vec2(textureSize(shadowMap, 0));
      for (int x=-1; x<=1; x++) for (int y=-1; y<=1; y++) {
        visibility += texture(shadowMap, vec3(shadow.xy+vec2(x,y)*texel, shadow.z-bias))/9.0;
      }
      outputColor = vec4(tint*(0.48 + 0.7*diffuse*visibility), 1.0);
    }`);
  const shadowSize = 2048;
  const shadowTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, shadowSize, shadowSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  const shadowFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTexture, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Schattenpuffer konnte nicht erstellt werden.');
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const batches = [
    { buffer: gl.createBuffer(), mode: gl.TRIANGLES, count: 0 },
    { buffer: gl.createBuffer(), mode: gl.LINES, count: 0 },
  ];
  const frameUniform = gl.getUniformLocation(viewProgram, 'frame');
  const rotationUniform = gl.getUniformLocation(viewProgram, 'rotation');
  const viewUniform = gl.getUniformLocation(viewProgram, 'viewDirection');
  const unlitUniform = gl.getUniformLocation(viewProgram, 'unlit');
  const shadowUniform = gl.getUniformLocation(viewProgram, 'shadowMap');
  function bindBatch(batch) {
    gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  }
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.enable(gl.DEPTH_TEST);
  let uploadedPlan, frame;
  return (plan, yaw = 0, zoom = 1) => {
    if (uploadedPlan !== plan) {
      const mesh = buildPlanningMesh(plan);
      frame = fixedFrame(plan);
      for (const [index, vertices] of [mesh.triangles, mesh.lines].entries()) {
        gl.bindBuffer(gl.ARRAY_BUFFER, batches[index].buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        batches[index].count = vertices.length / 6;
      }
      // The light and geometry are stationary: cache shadows across camera changes.
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
      gl.viewport(0, 0, shadowSize, shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(shadowProgram);
      bindBatch(batches[0]);
      gl.drawArrays(gl.TRIANGLES, 0, batches[0].count);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      uploadedPlan = plan;
    }
    const scale = frame.scale * zoom;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.08, 0.1, 0.15, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(viewProgram);
    gl.uniform3f(frameUniform, frame.x, frame.y, scale);
    gl.uniform2f(rotationUniform, Math.cos(yaw), Math.sin(yaw));
    gl.uniform3f(viewUniform, Math.cos(yaw)+Math.sin(yaw), Math.cos(yaw)-Math.sin(yaw), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
    gl.uniform1i(shadowUniform, 0);
    for (const [index, batch] of batches.entries()) {
      bindBatch(batch);
      gl.uniform1i(unlitUniform, index === 1 ? 1 : 0);
      gl.drawArrays(batch.mode, 0, batch.count);
    }
    if (gl.getError() !== gl.NO_ERROR) throw Error('WebGL-Zeichnen fehlgeschlagen.');
    labels.replaceChildren();
    for (const cell of plan.cells) {
      // Keep offset labels near the cell rim, away from the central plateau.
      const anchor = warpPoint(plan, { x: cell.x, y: cell.y - 23 });
      const p = project3D(anchor, CELL_DATUM + cell.offset, yaw);
      const label = document.createElement('span');
      label.textContent = `W${cell.id} ${cell.offset >= 0 ? '+' : ''}${cell.offset.toFixed(1)}`;
      label.style.left = `${50 + (p.x - frame.x) * scale / 9}%`;
      label.style.top = `${50 + (p.y - frame.y) * scale / 6}%`;
      labels.append(label);
    }
  };
}
