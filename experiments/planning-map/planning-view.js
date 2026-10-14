'use strict';
// Orthographic 3D view with yaw only; fixed pitch and world-unit scale.
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
function buildPlanningMesh(plan) {
  const triangles = [], lines = [];
  const vertex = (target, point, height, color) => target.push(point.x, point.y, height, ...color);
  function flat(points, height, color) {
    if (points.length < 3) return;
    const center = {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
    for (let i = 0; i < points.length; i++) {
      vertex(triangles, center, height, color);
      vertex(triangles, points[i], height, color);
      vertex(triangles, points[(i + 1) % points.length], height, color);
    }
  }
  for (const cell of plan.cells) {
    const height = CELL_DATUM + cell.offset;
    const topColor = cell.offset >= 0 ? [0.37, 0.44, 0.54] : [0.29, 0.35, 0.44];
    flat(cell.outline, height, topColor);
    for (let i = 0; i < cell.outline.length; i++) {
      const a = cell.outline[i], b = cell.outline[(i + 1) % cell.outline.length];
      const shade = 0.19 + 0.08 * Math.abs(b.x - a.x) / Math.max(0.001, distance(a, b));
      const color = [shade, shade + 0.035, shade + 0.07];
      for (const [point, z] of [[a, 0], [b, 0], [b, height], [a, 0], [b, height], [a, height]]) vertex(triangles, point, z, color);
      vertex(lines, a, height + 0.25, [0.7, 0.79, 0.9]);
      vertex(lines, b, height + 0.25, [0.7, 0.79, 0.9]);
    }
    function overlay(outline, lift, color, bounds = cell.points) {
      const source = outline.map((p) => p.source || p);
      const clipped = clipPolygon(clipPolygon(source, bounds), cell.points);
      flat(clipped.map((p) => warpPoint(plan, p)), height + lift, color);
    }
    for (const edge of plan.edges) overlay(edge.outline, 0.08, edge.loop ? [0.66, 0.47, 0.9] : [0.8, 0.85, 0.65]);
    for (const outline of plan.river.outlines) overlay(outline, 0.12, [0.16, 0.6, 0.88]);
    for (const bridge of plan.river.bridges) {
      const bounds = bridge.outline.map((p) => p.source);
      for (const outline of plan.river.bridgeOutlines) overlay(outline, 0.16, [0.85, 0.58, 0.3], bounds);
    }
    for (const region of plan.regions) overlay(region.outline, 0.2, [0.36, 0.8, 0.57]);
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
  const program = gl.createProgram();
  const vertexShader = shader(gl.VERTEX_SHADER, `#version 300 es
    precision highp float;
    layout(location=0) in vec3 position;
    layout(location=1) in vec3 color;
    uniform vec3 frame;
    uniform vec2 rotation;
    out vec3 tint;
    void main() {
      vec2 source = position.xy - vec2(150.0);
      vec2 p = vec2(rotation.x*source.x-rotation.y*source.y, rotation.y*source.x+rotation.x*source.y);
      vec2 projected = vec2((p.x-p.y)/sqrt(2.0), (p.x+p.y)/sqrt(6.0)-position.z*sqrt(2.0/3.0));
      vec2 screen = (projected-frame.xy)*frame.z;
      gl_Position = vec4(screen.x/450.0, -screen.y/300.0, -(p.x+p.y+position.z)/600.0, 1.0);
      tint = color;
    }`);
  const fragmentShader = shader(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    in vec3 tint;
    out vec4 outputColor;
    void main() { outputColor = vec4(tint, 1.0); }`);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  const batches = [
    { buffer: gl.createBuffer(), mode: gl.TRIANGLES, count: 0 },
    { buffer: gl.createBuffer(), mode: gl.LINES, count: 0 },
  ];
  const frameUniform = gl.getUniformLocation(program, 'frame');
  const rotationUniform = gl.getUniformLocation(program, 'rotation');
  let uploadedPlan, frame;
  return (plan, yaw = 0) => {
    if (uploadedPlan !== plan) {
      const mesh = buildPlanningMesh(plan);
      frame = fixedFrame(plan);
      for (const [index, vertices] of [mesh.triangles, mesh.lines].entries()) {
        gl.bindBuffer(gl.ARRAY_BUFFER, batches[index].buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        batches[index].count = vertices.length / 6;
      }
      uploadedPlan = plan;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.08, 0.1, 0.15, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(program);
    gl.uniform3f(frameUniform, frame.x, frame.y, frame.scale);
    gl.uniform2f(rotationUniform, Math.cos(yaw), Math.sin(yaw));
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    for (const batch of batches) {
      gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(batch.mode, 0, batch.count);
    }
    if (gl.getError() !== gl.NO_ERROR) throw Error('WebGL-Zeichnen fehlgeschlagen.');
    labels.replaceChildren();
    for (const cell of plan.cells) {
      // Offset labels sit near the cell rim, not on the green footprint.
      const anchor = warpPoint(plan, { x: cell.x, y: cell.y - 23 });
      const p = project3D(anchor, CELL_DATUM + cell.offset, yaw);
      const label = document.createElement('span');
      label.textContent = `W${cell.id} ${cell.offset >= 0 ? '+' : ''}${cell.offset.toFixed(1)}`;
      label.style.left = `${50 + (p.x - frame.x) * frame.scale / 9}%`;
      label.style.top = `${50 + (p.y - frame.y) * frame.scale / 6}%`;
      labels.append(label);
    }
  };
}
