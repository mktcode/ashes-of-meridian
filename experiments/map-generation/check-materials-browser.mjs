import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { withBrowser } from '../../scripts/browser/harness.mjs';

// One file:// lab startup, then tiny GPU probes of the actual material mask.
// No terrain sweep, game/build, screenshot archive or reference-image test.
const root = fileURLToPath(new URL('../../', import.meta.url));
await withBrowser(root, async browser => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${new URL('./index.html', import.meta.url)}?seed=2`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(() => preview.gpu?.uploaded === preview.mesh, null, { timeout: 45000 });
  const result = await page.evaluate(() => {
    const gpu = preview.gpu;
    window.materialCheck = { plan: preview.plan, mesh: preview.mesh, decoration: preview.decoration,
      grass: preview.grassDecoration, materialBuffer: gpu.materialDataBuffer };
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 1;
    const gl = canvas.getContext('webgl');
    if (!gl) throw Error('Material probe requires WebGL');
    const derivatives = !!gl.getExtension('OES_standard_derivatives'), results = [];
    const compile = (type, source) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    for (const antialias of derivatives ? [false, true] : [false]) {
      const vertex = compile(gl.VERTEX_SHADER, `
        attribute vec2 position; uniform bool heightSweep;
        varying vec3 worldPosition; varying vec3 groundNormal; varying float groundWet;
        void main(){
          groundNormal=vec3(0,1,0);groundWet=0.0;
          float t=position.x*.5+.5;
          worldPosition=heightSweep ? vec3(3.7,mix(30.0,60.0,t),11.3) : vec3(t*100.0,45.0,11.3);
          gl_Position=vec4(position,0,1);
        }`);
      const fragment = compile(gl.FRAGMENT_SHADER, `
        ${antialias ? '#extension GL_OES_standard_derivatives : enable' : ''}
        precision highp float;
        ${terrainMaterialGLSL(antialias)}
        uniform vec3 probeNormal;
        void main(){float coverage=rockCoverage(normalize(probeNormal));gl_FragColor=vec4(vec3(coverage),1);}`);
      const program = gl.createProgram();
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(program, 'surfaceOffset'), .31, .67);
      const sweep = gl.getUniformLocation(program, 'heightSweep'), normal = gl.getUniformLocation(program, 'probeNormal');
      const probe = (heightSweep, nx, ny) => {
        gl.uniform1i(sweep, heightSweep ? 1 : 0); gl.uniform3f(normal, nx, ny, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        const bytes = new Uint8Array(256 * 4); gl.readPixels(0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        return Array.from({ length: 256 }, (_, i) => bytes[i * 4]);
      };
      results.push({ antialias, ramp: probe(true, 0, 1), steep: probe(true, Math.sqrt(.75), .5),
        patches: probe(false, 0, 1), gl: gl.getError() });
      gl.deleteShader(vertex); gl.deleteShader(fragment); gl.deleteProgram(program);
    }
    gl.deleteBuffer(buffer);
    return { derivatives, probes: results,
      linked: gpu.gl.getProgramParameter(gpu.program, gpu.gl.LINK_STATUS), gl: gpu.gl.getError(),
      error: document.getElementById('renderError').textContent };
  });
  assert.ok(result.linked); assert.equal(result.gl, 0); assert.equal(result.error, '');
  for (const p of result.probes) {
    assert.equal(p.gl, 0);
    assert.ok(p.ramp.slice(0, 64).every(v => v === 0), 'Flat lowland stays meadow');
    assert.ok(p.ramp.slice(-64).every(v => v === 255), 'Flat highland reaches pure rock, not permanent grass mixing');
    const blended = p.ramp.filter(v => v > 0 && v < 255).length;
    assert.ok(blended > 0 && blended <= 10, `Narrow filtered height seam, got ${blended} samples in a 30-unit ramp`);
    const crossing = p.ramp.findIndex(v => v >= 128), height = 30 + (crossing + .5) * 30 / 256;
    assert.ok(height > 42 && height < 48, 'Absolute highland threshold with bounded noise displacement');
    assert.ok(p.steep.every(v => v === 255), 'Steep faces are rock even below the highland height');
    assert.ok(p.patches.some(v => v === 0) && p.patches.some(v => v === 255), 'Boundary has distinct grass/rock patches, not only gray blended terrain');
  }
  await page.selectOption('#terrainStyle', 'desert');
  await page.uncheck('#relief');
  await page.waitForFunction(() => preview.gpu.materials.style === 'desert', null, { timeout: 5000 });
  await page.selectOption('#terrainStyle', 'westmark');
  await page.check('#relief');
  await page.waitForFunction(() => preview.gpu.materials.style === 'westmark', null, { timeout: 5000 });
  assert.ok(await page.evaluate(() => materialCheck.plan === preview.plan && materialCheck.mesh === preview.mesh &&
    materialCheck.decoration === preview.decoration && materialCheck.grass === preview.grassDecoration &&
    materialCheck.materialBuffer === preview.gpu.materialDataBuffer && preview.gpu.materialMesh === preview.mesh &&
    preview.gpu.uploaded === preview.mesh && preview.gpu.gl.getError() === 0 && !document.getElementById('renderError').textContent));
  assert.deepEqual(errors, []);
  console.log('Material GPU mask: narrow absolute-height seams, pure grass/rock interiors, patchy edges and steep rock faces; file:// shader linking and unchanged plan/mesh/vegetation on style/relief changes OK.',
    { derivatives: result.derivatives, variants: result.probes.map(p => ({ antialias: p.antialias, blended: p.ramp.filter(v => v > 0 && v < 255).length })) });
  await page.close();
}, { timeoutMs: 60000 });
