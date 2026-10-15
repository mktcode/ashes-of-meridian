import { createTerrainMesh } from '../src/index.ts';

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) throw Error('Diese Demo benötigt WebGL 2.');
  const buffers = new Set(), vaos = new Set(), shaders = new Set();
  let program = null, texture = null, terrain = null, disposed = false;
  let bytes = 0, lastMask = null, uploads = 0, draws = 0;
  const buffer = () => { const b = gl.createBuffer(); if (!b) throw Error('GPU-Puffer fehlt.'); buffers.add(b); return b; };
  const vao = () => { const v = gl.createVertexArray(); if (!v) throw Error('GPU-VAO fehlt.'); vaos.add(v); return v; };
  const drop = geometry => {
    if (!geometry) return;
    gl.deleteVertexArray(geometry.vao); vaos.delete(geometry.vao);
    for (const b of [geometry.vertices, geometry.indices]) { gl.deleteBuffer(b); buffers.delete(b); }
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const v of vaos) gl.deleteVertexArray(v);
    for (const b of buffers) gl.deleteBuffer(b);
    for (const s of shaders) gl.deleteShader(s);
    gl.deleteTexture(texture); gl.deleteProgram(program);
    vaos.clear(); buffers.clear(); shaders.clear(); terrain = null; lastMask = null;
  }
  try {
    function shader(type, source) {
      const s = gl.createShader(type); if (!s) throw Error('Shader fehlt.'); shaders.add(s);
      gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
      return s;
    }
    program = gl.createProgram();
    for (const s of [shader(gl.VERTEX_SHADER, `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in mat4 instanceModel;
layout(location=6) in vec3 instanceColor;
uniform vec3 right, up, eye, center;
uniform vec2 scale;
uniform float depthRange;
uniform bool instanced;
out vec3 surfaceNormal, worldPosition, boxColor;
void main() {
  mat4 transform = instanced ? instanceModel : mat4(1.0);
  vec3 p = (transform * vec4(position, 1.0)).xyz;
  vec3 relative = p - center;
  gl_Position = vec4(dot(relative,right)*scale.x, dot(relative,up)*scale.y, -dot(relative,eye)/depthRange, 1.0);
  surfaceNormal = transpose(inverse(mat3(transform))) * normal;
  worldPosition = p; boxColor = instanceColor;
}`), shader(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
in vec3 surfaceNormal, worldPosition, boxColor;
uniform bool ground, overlay;
uniform sampler2D clearance;
out vec4 outputColor;
void main() {
  vec3 n = normalize(surfaceNormal);
  vec3 tint = boxColor;
  if (ground) {
    tint = mix(vec3(.24,.36,.25),vec3(.56,.52,.39),clamp(worldPosition.y/230.0,0.0,1.0));
    tint = mix(vec3(.33,.32,.31),tint,smoothstep(.65,.88,n.y));
    if (overlay) {
      ivec2 cell = clamp(ivec2(floor((vec2(worldPosition.x,-worldPosition.z)+vec2(260.0,320.0))/2.0)),ivec2(0),ivec2(259,319));
      float free = texelFetch(clearance,cell,0).r;
      tint = mix(tint,mix(vec3(.64,.15,.13),vec3(.15,.58,.29),free),.78);
    }
  }
  float light = max(0.0,dot(n,normalize(vec3(-.5,.9,.7))));
  outputColor = vec4(tint*(.42+light*.65),1.0);
}`)]) gl.attachShader(program, s);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    for (const s of shaders) gl.deleteShader(s); shaders.clear();
    const uniforms = Object.fromEntries(['right','up','eye','center','scale','depthRange','instanced','ground','overlay','clearance']
      .map(k => [k, gl.getUniformLocation(program, k)]));
    const cube = [];
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const a = (axis + 1) % 3, b = (axis + 2) % 3, corners = [[-1,-1],[1,-1],[1,1],[-1,1]];
      for (const i of [0,1,2,0,2,3]) {
        const p = [0,0,0], n = [0,0,0]; p[axis] = sign * .5; n[axis] = sign;
        p[a] = corners[i][0] * .5; p[b] = corners[i][1] * .5; cube.push(...p,...n);
      }
    }
    const cubeVao = vao(), cubeBuffer = buffer(), instanceBuffer = buffer();
    gl.bindVertexArray(cubeVao); gl.bindBuffer(gl.ARRAY_BUFFER,cubeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cube),gl.STATIC_DRAW);
    function attributes() {
      for (let i = 0; i < 2; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i,3,gl.FLOAT,false,24,i*12); }
    }
    attributes(); gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);
    for (let i = 0; i < 4; i++) {
      gl.enableVertexAttribArray(2+i); gl.vertexAttribPointer(2+i,4,gl.FLOAT,false,76,i*16); gl.vertexAttribDivisor(2+i,1);
    }
    gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6,3,gl.FLOAT,false,76,64); gl.vertexAttribDivisor(6,1);
    texture = gl.createTexture();
    if (!texture) throw Error('GPU-Maske fehlt.');
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,1,1,0,gl.RED,gl.UNSIGNED_BYTE,new Uint8Array([0]));
    const instances = MarineInstances.create();
    let lastState = '';
    function install(map) {
      if (disposed || gl.isContextLost()) throw Error('Grafikkontext nicht verfügbar.');
      const mesh = createTerrainMesh(map), next = { vao: null, vertices: null, indices: null, count: mesh.indices.length };
      try {
        next.vao = vao(); next.vertices = buffer(); next.indices = buffer();
        gl.bindVertexArray(next.vao); gl.bindBuffer(gl.ARRAY_BUFFER,next.vertices);
        gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW); attributes();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,next.indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
        if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) throw Error('Terrain konnte nicht auf die GPU geladen werden.');
      } catch (error) { drop(next); throw error; }
      drop(terrain); terrain = next; lastState = ''; lastMask = null;
    }
    function draw(session, camera, mask, dirtyKey) {
      if (disposed || !terrain || gl.isContextLost()) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(1,Math.round(canvas.clientWidth*dpr)), h = Math.max(1,Math.round(canvas.clientHeight*dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width=w; canvas.height=h; }
      gl.viewport(0,0,w,h); gl.enable(gl.DEPTH_TEST); gl.clearColor(.067,.106,.141,1);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); gl.useProgram(program);
      for (const name of ['right','up','eye','center']) gl.uniform3fv(uniforms[name],camera[name]);
      gl.uniform2fv(uniforms.scale,camera.scale); gl.uniform1f(uniforms.depthRange,camera.depth);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texture);
      if (mask && mask !== lastMask) {
        gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,260,320,0,gl.RED,gl.UNSIGNED_BYTE,Uint8Array.from(mask,v => v*255));
        lastMask = mask;
      }
      gl.uniform1i(uniforms.clearance,0); gl.uniform1i(uniforms.overlay,Boolean(mask));
      gl.uniform1i(uniforms.instanced,0); gl.uniform1i(uniforms.ground,1);
      gl.bindVertexArray(terrain.vao); gl.drawElements(gl.TRIANGLES,terrain.count,gl.UNSIGNED_INT,0);
      const { crowd, frame } = session, groups = crowd.getGroups();
      if (dirtyKey !== lastState) {
        instances.begin(frame.count*Math.max(MarineModel.parts.length,TankModel.parts.length)+8);
        const cross = (p,color,size) => {
          const m = [1,0,0,0,0,1,0,0,0,0,1,0,p.x,session.terrain.heightAt(p.x,p.z)+.08,p.z,1];
          instances.box(m,[0,0,0],[size,.04,.16],color); instances.box(m,[0,0,0],[.16,.04,size],color);
        };
        cross(session.portals.south,[.3,.8,1],3); cross(session.portals.north,[1,.85,.2],3);
        for (const group of groups) if (group.destination) cross(group.destination,group.id===0?[.3,.8,.3]:[1,.4,.2],1.3);
        for (let i=0;i<frame.count;i++) {
          const unit = { x:frame.positions[i*3], y:frame.positions[i*3+1], z:frame.positions[i*3+2],
            yaw:frame.yaw[i], time:frame.age[i], movementBlend:frame.movementBlend[i] };
          const tank = groups[frame.groups[i]].profile === 'tank';
          if (!MarineInstances.visible(unit,camera,tank?TankModel.cullingRadius:MarineInstances.radius)) continue;
          if (tank) instances.tank(unit,[.65,.28,.18]); else instances.marine(unit);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);
        if (instances.data.byteLength>bytes) { bytes=instances.data.byteLength; gl.bufferData(gl.ARRAY_BUFFER,bytes,gl.DYNAMIC_DRAW); }
        gl.bufferSubData(gl.ARRAY_BUFFER,0,instances.data.subarray(0,instances.count*MarineInstances.stride));
        uploads++; lastState=dirtyKey;
      }
      gl.uniform1i(uniforms.instanced,1); gl.uniform1i(uniforms.ground,0);
      gl.bindVertexArray(cubeVao); gl.drawArraysInstanced(gl.TRIANGLES,0,36,instances.count); draws++;
    }
    return { install, draw, dispose, gl, get uploads() { return uploads; }, get draws() { return draws; } };
  } catch (error) { dispose(); throw error; }
}
