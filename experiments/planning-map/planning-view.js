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
    const highRegion = plan.regions[high === a ? edge.a : edge.b];
    const lowRegion = plan.regions[low === a ? edge.a : edge.b];
    const edgeIndex = high.points.findIndex((p, i) =>
      [p, high.points[(i + 1) % 6]].every((corner) => low.points.some((other) => distance(corner, other) < 1e-6)));
    if (edgeIndex < 0) throw Error('Road ramp requires neighboring cells.');
    const start = high.points[edgeIndex], end = high.points[(edgeIndex + 1) % 6];
    const length = distance(start, end);
    const tangent = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
    const normal = { x: -tangent.y, y: tangent.x };
    const roadLength = distance(lowRegion, highRegion);
    const direction = { x: (highRegion.x - lowRegion.x) / roadLength, y: (highRegion.y - lowRegion.y) / roadLength };
    const dot = (p) => p.x * normal.x + p.y * normal.y;
    const gradeAxis = dot(direction);
    const t = -dot({ x: lowRegion.x - start.x, y: lowRegion.y - start.y }) / gradeAxis;
    const crossing = { x: lowRegion.x + direction.x * t, y: lowRegion.y + direction.y * t };
    // First green-footprint intersection along the road: ramp ends halfway there.
    let greenDistance = Infinity;
    for (let i = 0; i < highRegion.points.length; i++) {
      const p = highRegion.points[i], q = highRegion.points[(i + 1) % highRegion.points.length];
      const sx = q.x - p.x, sy = q.y - p.y;
      const denominator = direction.x * sy - direction.y * sx;
      if (Math.abs(denominator) < 1e-8) continue;
      const px = p.x - crossing.x, py = p.y - crossing.y;
      const along = (px * sy - py * sx) / denominator;
      const segment = (px * direction.y - py * direction.x) / denominator;
      if (along > 0 && segment >= 0 && segment <= 1) greenDistance = Math.min(greenDistance, along);
    }
    if (!Number.isFinite(greenDistance)) throw Error('Road misses green footprint.');
    const run = greenDistance / 2, width = ROAD_RADIUS / gradeAxis;
    const left = { x: crossing.x - tangent.x * width, y: crossing.y - tangent.y * width };
    const right = { x: crossing.x + tangent.x * width, y: crossing.y + tangent.y * width };
    const points = [left, right, { x: right.x + direction.x * run, y: right.y + direction.y * run },
      { x: left.x + direction.x * run, y: left.y + direction.y * run }];
    ramps.push({ highCellId: high.id, lowCellId: low.id, edgeIndex, crossing, direction, normal,
      run, greenDistance, points, lowHeight: CELL_DATUM + low.offset, highHeight: CELL_DATUM + high.offset });
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
  function surface(points, heightAt, color, lift = 0) {
    if (polygonArea(points) < 1e-6) return;
    const center = {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
    const outline = curvePath(plan, points, true), warpedCenter = warpPoint(plan, center);
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      vertex(triangles, warpedCenter, heightAt(center) + lift, color);
      vertex(triangles, a, heightAt(a.source) + lift, color);
      vertex(triangles, b, heightAt(b.source) + lift, color);
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
    function overlay(outline, lift, color, bounds = cell.points) {
      const source = outline.map((p) => p.source || p);
      const clipped = clipPolygon(clipPolygon(source, bounds), cell.points);
      for (const patch of patches) surface(clipPolygon(clipped, patch.points), patch.heightAt, color, lift);
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
