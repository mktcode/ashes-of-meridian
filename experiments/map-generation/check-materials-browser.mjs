import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { withBrowser } from '../../scripts/browser/harness.mjs';

// One file:// lab startup, then tiny GPU probes of material coverage/color.
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
      grass: preview.grassDecoration, materialBuffer: gpu.materialDataBuffer,
      textures: new Map(gpu.materials.textures), sizes: Object.fromEntries(gpu.materials.sizes) };
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 1;
    const gl = canvas.getContext('webgl');
    if (!gl) throw Error('Material probe requires WebGL');
    const derivatives = !!gl.getExtension('OES_standard_derivatives'),
      gradients = derivatives && !!gl.getExtension('EXT_shader_texture_lod'), results = [];
    const variants = [[false,false],...(derivatives ? [[true,false]] : []),...(gradients ? [[true,true]] : [])];
    const compile = (type, source) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    // Neutral rock plus deliberately colored grass/earth isolates artificial
    // rock tinting from texture colors and accidental substrate mixing.
    const textures = [[200,24,200,128], [128,128,128,128], [200,80,24,128], [128,128,180,255]].map((rgba, i) => {
      const texture = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + (i === 3 ? 4 : i)); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return texture;
    });
    for (const [antialias,explicitGradients] of variants) {
      const vertex = compile(gl.VERTEX_SHADER, `
        attribute vec2 position; uniform bool heightSweep; uniform float patchHeight;
        varying vec3 worldPosition; varying vec3 groundNormal; varying float groundWet;
        void main(){
          groundNormal=vec3(0,1,0);groundWet=0.0;
          float t=position.x*.5+.5;
          worldPosition=heightSweep ? vec3(3.7,mix(30.0,60.0,t),11.3) : vec3(t*100.0,patchHeight,11.3);
          gl_Position=vec4(position,0,1);
        }`);
      const fragment = compile(gl.FRAGMENT_SHADER, `
        ${antialias ? '#extension GL_OES_standard_derivatives : enable' : ''}
        ${explicitGradients ? '#extension GL_EXT_shader_texture_lod : enable' : ''}
        precision highp float;
        ${terrainMaterialGLSL(antialias,explicitGradients)}
        uniform vec3 probeNormal; uniform int probeMode;
        void main(){
          vec3 n=normalize(probeNormal),value=vec3(rockCoverage(n));
          if(probeMode>0){
            value=landscapeSample(n).rgb;
            if(probeMode==2 || probeMode==5)value=vec3(mineralRoughness,mineralAO,mineralWeight);
            if(probeMode==3)value=ferrumReliefNormal(n)*.5+.5;
            if(probeMode==4)value=mineralLighting(ferrumReliefNormal(n),normalize(vec3(.4,.8,-.4)),vec3(.94),vec3(.4),1.0);
          }
          gl_FragColor=vec4(value,1);
        }`);
      const program = gl.createProgram();
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(program, 'surfaceOffset'), .31, .67);
      for (const [i, name] of ['groundTex','rockTex','earthTex'].entries()) gl.uniform1i(gl.getUniformLocation(program, name), i);
      gl.uniform2f(gl.getUniformLocation(program, 'groundTile'), 8, 8);
      gl.uniform3f(gl.getUniformLocation(program, 'surfaceTint'), 1, 1, 1);
      gl.uniform3f(gl.getUniformLocation(program, 'surfaceRelief'), .07, .12, .08);
      gl.uniform1i(gl.getUniformLocation(program, 'desert'), 0);
      const sweep = gl.getUniformLocation(program, 'heightSweep'), normal = gl.getUniformLocation(program, 'probeNormal'),
        mode = gl.getUniformLocation(program, 'probeMode'), height = gl.getUniformLocation(program, 'patchHeight');
      gl.uniform1i(gl.getUniformLocation(program, 'ferrumDetailTex'), 4);
      gl.uniform3f(gl.getUniformLocation(program, 'mineralView'), .3, .8, .5);
      const tuning=gl.getUniformLocation(program,'materialTuning'),exposure=gl.getUniformLocation(program,'mineralExposure');
      gl.uniform4f(tuning,1,1,0,1);gl.uniform1f(exposure,1.25);
      const setDetail = rgba => {
        gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, textures[3]);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
      };
      setDetail([128,128,180,255]);
      const probe = (heightSweep, nx, ny, probeMode = 0) => {
        gl.uniform1i(sweep, heightSweep ? 1 : 0); gl.uniform3f(normal, nx, ny, 0);
        gl.uniform1i(mode, probeMode); gl.uniform1f(height, probeMode === 5 ? 30 : probeMode ? 60 : 45);
        gl.uniform1i(gl.getUniformLocation(program, 'ferrum'), probeMode ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        const bytes = new Uint8Array(256 * 4); gl.readPixels(0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        return Array.from({ length: 256 }, (_, i) => probeMode ? Array.from(bytes.subarray(i * 4, i * 4 + 3)) : bytes[i * 4]);
      };
      const samples = { antialias, explicitGradients, dryMeadow: probe(false,0,1,5), ramp: probe(true, 0, 1), steep: probe(true, Math.sqrt(.75), .5),
        patches: probe(false, 0, 1), neutralStone: probe(false, 0, 1, 1),
        metadata: probe(false, 0, 1, 2), normals: probe(false, 0, 1, 3), lit: probe(false, 0, 1, 4) };
      setDetail([220,128,80,100]);
      samples.changedMetadata=probe(false,0,1,2);samples.changedNormals=probe(false,0,1,3);
      gl.uniform4f(tuning,0,1,0,1);samples.flatNormals=probe(false,0,1,3);
      gl.uniform4f(tuning,.4,1,0,1);samples.shallowNormals=probe(false,0,1,3);
      gl.uniform4f(tuning,1,2,0,1);samples.denseNormals=probe(false,0,1,3);
      gl.uniform4f(tuning,1,1,.15,0);samples.tunedMetadata=probe(false,0,1,2);
      gl.uniform1f(exposure,.6);samples.dim=probe(false,0,1,4);
      gl.uniform1f(exposure,2);samples.bright=probe(false,0,1,4);
      gl.uniform4f(tuning,1,1,0,1);gl.uniform1f(exposure,1.25);
      // A tiny current checker fixture proves UV frequency, not just normals,
      // changes with texture density. No reference-image or palette snapshot.
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[1]);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,2,2,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([
        28,28,28,128,240,240,240,128,240,240,240,128,28,28,28,128]));
      samples.density1=probe(false,0,1,1);
      gl.uniform4f(tuning,1,2,0,1);samples.density2=probe(false,0,1,1);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,128,128]));
      results.push({ ...samples, gl: gl.getError() });
      gl.deleteShader(vertex); gl.deleteShader(fragment); gl.deleteProgram(program);
    }
    for (const texture of textures) gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    return { derivatives, gradients, probes: results, sizes: materialCheck.sizes,
      textureLimit: 2 ** Math.floor(Math.log2(gpu.gl.getParameter(gpu.gl.MAX_TEXTURE_SIZE))),
      linked: gpu.gl.getProgramParameter(gpu.program, gpu.gl.LINK_STATUS), gl: gpu.gl.getError(),
      error: document.getElementById('renderError').textContent };
  });
  assert.ok(result.linked); assert.equal(result.gl, 0); assert.equal(result.error, '');
  const albedoSize=Math.min(2048,result.textureLimit),detailSize=Math.min(1024,result.textureLimit);
  assert.deepEqual(result.sizes.ferrum, [albedoSize,albedoSize]); assert.deepEqual(result.sizes.ferrumDetail, [detailSize,detailSize]);
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
    assert.ok(p.neutralStone.every(rgb => Math.max(...rgb) - Math.min(...rgb) <= 20),
      'Dry pure-rock highland stays mineral-neutral without green patches or grass/earth mixing');
    assert.ok(p.metadata.every(([rough,ao,weight]) => rough > 170 && ao === 255 && weight === 255));
    assert.ok(p.changedMetadata.every(([rough,ao,weight]) => rough < 100 && ao < 120 && weight === 255), 'Packed roughness/AO reach the actual material, independently of coverage');
    assert.ok(p.normals.every(([,y]) => y > 250) && p.changedNormals.every(([,y]) => y < 235), 'Packed OpenGL normal XY changes the surface normal');
    for (const rgb of [...p.normals,...p.changedNormals]) assert.ok(Math.abs(Math.hypot(...rgb.map(v => v / 255 * 2 - 1)) - 1) < .02, 'Reconstructed normals remain unit length');
    assert.ok(p.flatNormals.every(([,y])=>y>250) && p.shallowNormals.every(([,y],i)=>y>p.changedNormals[i][1]) &&
      p.denseNormals.every(([,y],i)=>y<p.changedNormals[i][1]), 'Relief zero flattens normals; depth and density scale their strength');
    assert.ok(p.tunedMetadata.every(([rough,ao])=>rough>p.changedMetadata[0][0] && ao===255), 'Roughness bias raises roughness and zero AO disables micro-occlusion');
    assert.ok(p.bright.every((rgb,i)=>rgb.every((v,c)=>v>p.dim[i][c])), 'Exposure changes the actual filmic lighting');
    assert.ok(p.density1.some((rgb,i)=>rgb[0]!==p.density2[i][0]), 'Texture density changes actual projected UV sampling');
    assert.ok(p.lit.every(rgb => Math.min(...rgb) > 0), 'Ferrum BRDF produces nonblack illumination with valid inputs');
    assert.ok(p.dryMeadow.every(([, ,weight]) => weight === 0), 'Dry lowland has no mineral contribution');
    if(p.explicitGradients)assert.ok(p.dryMeadow.every(([rough,ao]) => rough === 255 && ao === 255), 'Dry pure meadow leaves mineral data untouched, skipping Ferrum lookups');
  }
  // Actual UI events reach uniforms, without rebaking, recompiling, uploading
  // geometry or invalidating the shadow pass. Folding only resizes the view.
  await page.evaluate(()=>{
    const gl=preview.gpu.gl,counts={image:0,buffer:0,shadow:0,compile:0};
    materialCheck.counts=counts;materialCheck.originals={};
    for(const [name,count] of [['texImage2D','image'],['bufferData','buffer'],['shaderSource','compile'],['bindFramebuffer','shadow']]){
      const original=gl[name];materialCheck.originals[name]=original;
      gl[name]=function(...args){if(name!=='bindFramebuffer' || args[1]===preview.gpu.shadow.framebuffer)counts[count]++;return original.apply(this,args);};
    }
    materialCheck.camera={...camera};materialCheck.hour=document.getElementById('timeOfDay').value;
    for(const [id,value] of Object.entries({reliefDepth:1.5,textureDensity:1.7,roughnessBias:-.2,aoStrength:.4,materialExposure:1.65})){
      const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  await page.waitForFunction(()=>{
    const gl=preview.gpu.gl,u=preview.gpu.materials.uniforms,v=gl.getUniform(preview.gpu.program,u.materialTuning);
    return [1.5,1.7,-.2,.4].every((x,i)=>Math.abs(x-v[i])<.0001) && Math.abs(gl.getUniform(preview.gpu.program,u.mineralExposure)-1.65)<.0001;
  }, null, {timeout:5000});
  assert.ok(await page.evaluate(()=>Object.entries(materialSettings).every(([id,value])=>Math.abs(parseFloat(document.getElementById(id+'Value').textContent)-value)<.0001)));
  await page.locator('#reliefDepth').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>Math.abs(materialSettings.reliefDepth-.05)<.0001);
  for(const size of [{width:1000,height:800},{width:375,height:720},{width:667,height:375}]){
    await page.setViewportSize(size);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1 &&
      document.getElementById('settings').scrollWidth<=document.getElementById('settings').clientWidth+1 &&
      document.getElementById('height').getBoundingClientRect().height>=innerHeight*.3 &&
      document.querySelector('.minimap').getBoundingClientRect().top>=document.querySelector('.scene').getBoundingClientRect().top), 'Controls fit without horizontal overflow; canvas stays usable and minimap does not cover the header');
    const openHeight=await page.locator('#height').evaluate(e=>e.getBoundingClientRect().height);
    await page.locator('#settings > summary').click();
    assert.ok(await page.evaluate(()=>!document.getElementById('settings').open));
    assert.ok(await page.locator('#height').evaluate((e,h)=>e.getBoundingClientRect().height>h,openHeight), 'Folding gives space back to the canvas');
    await page.locator('#settings > summary').focus();await page.keyboard.press('Enter');
    assert.ok(await page.evaluate(()=>document.getElementById('settings').open));
  }
  await page.setViewportSize({width:1000,height:800});
  await page.uncheck('#relief');
  assert.ok(await page.locator('#reliefDepth').isDisabled());
  await page.locator('#materialReset').click();
  await page.waitForFunction(()=>Object.entries(MATERIAL_CONTROLS).every(([id,c])=>materialSettings[id]===c.value) &&
    preview.gpu.gl.getUniform(preview.gpu.program,preview.gpu.materials.uniforms.materialTuning)[0]===1);
  const controlReuse=await page.evaluate(()=>{
    const gl=preview.gpu.gl,counts=materialCheck.counts;
    for(const [name,original] of Object.entries(materialCheck.originals))gl[name]=original;
    return {counts,stable:materialCheck.plan===preview.plan && materialCheck.mesh===preview.mesh &&
      materialCheck.decoration===preview.decoration && materialCheck.grass===preview.grassDecoration &&
      materialCheck.materialBuffer===preview.gpu.materialDataBuffer &&
      Object.keys(camera).every(key=>camera[key]===materialCheck.camera[key]) &&
      document.getElementById('timeOfDay').value===materialCheck.hour && document.getElementById('relief').checked};
  });
  assert.deepEqual(controlReuse.counts,{image:0,buffer:0,shadow:0,compile:0});assert.ok(controlReuse.stable);
  await page.selectOption('#terrainStyle', 'desert');
  assert.ok(await page.locator('#roughnessBias').isDisabled());
  await page.uncheck('#relief');
  await page.waitForFunction(() => preview.gpu.materials.style === 'desert', null, { timeout: 5000 });
  await page.selectOption('#terrainStyle', 'westmark');
  await page.check('#relief');
  await page.waitForFunction(() => preview.gpu.materials.style === 'westmark', null, { timeout: 5000 });
  assert.ok(await page.evaluate(() => materialCheck.plan === preview.plan && materialCheck.mesh === preview.mesh &&
    materialCheck.decoration === preview.decoration && materialCheck.grass === preview.grassDecoration &&
    materialCheck.materialBuffer === preview.gpu.materialDataBuffer && preview.gpu.materialMesh === preview.mesh &&
    preview.gpu.uploaded === preview.mesh && preview.gpu.gl.getError() === 0 && !document.getElementById('renderError').textContent));
  assert.ok(await page.evaluate(() => [...materialCheck.textures].every(([name,texture]) => preview.gpu.materials.textures.get(name) === texture)), 'Material switching retains resident Ferrum texture objects');
  const reuse = await page.evaluate(() => {
    const gl=preview.gpu.gl, image=gl.texImage2D, buffer=gl.bufferData, uploads={image:0,buffer:0};
    gl.texImage2D=function(...args){uploads.image++;return image.apply(this,args);};
    gl.bufferData=function(...args){uploads.buffer++;return buffer.apply(this,args);};
    try {
      camera.yaw+=.1;draw3D();
      document.getElementById('relief').checked=false;draw3D();
      document.getElementById('relief').checked=true;draw3D();
      return { ...uploads, gl:gl.getError(), sizes:Object.fromEntries(preview.gpu.materials.sizes) };
    } finally { gl.texImage2D=image;gl.bufferData=buffer; }
  });
  assert.equal(reuse.image,0);assert.equal(reuse.buffer,0);assert.equal(reuse.gl,0);
  // Restore first into the non-Ferrum style: its unused detail sampler must not
  // require an upload. Returning to Ferrum reuses images and custom settings.
  await page.evaluate(()=>{
    for(const [id,value] of Object.entries({textureDensity:1.4,roughnessBias:-.12})){
      const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  await page.selectOption('#terrainStyle','desert');
  await page.waitForFunction(()=>preview.gpu.materials.style==='desert');
  const lifecycle=await page.evaluate(()=>{
    const extension=preview.gpu.gl.getExtension('WEBGL_lose_context');
    if(!extension)return false;
    materialCheck.lostGPU=preview.gpu;materialCheck.images={...FERRUM_IMAGES};
    window.materialContextExtension=extension;extension.loseContext();return true;
  });
  if(lifecycle){
    await page.waitForFunction(()=>preview.gpu.gl.isContextLost() && document.getElementById('renderError').textContent.length>0, null, {timeout:5000});
    await page.evaluate(()=>materialContextExtension.restoreContext());
    await page.waitForFunction(()=>preview.gpu && preview.gpu!==materialCheck.lostGPU && preview.gpu.uploaded===preview.mesh && !document.getElementById('renderError').textContent, null, {timeout:15000});
    assert.ok(await page.evaluate(()=>preview.gpu.gl.getError()===0 && preview.gpu.materials.style==='desert'));
    await page.selectOption('#terrainStyle','westmark');
    await page.waitForFunction(()=>preview.gpu.materials.style==='westmark');
    assert.ok(await page.evaluate(()=>materialCheck.plan===preview.plan && materialCheck.mesh===preview.mesh &&
      materialCheck.images.albedo===FERRUM_IMAGES.albedo && materialCheck.images.detail===FERRUM_IMAGES.detail &&
      preview.gpu.gl.getError()===0 && preview.gpu.gl.getProgramParameter(preview.gpu.program,preview.gpu.gl.LINK_STATUS) &&
      preview.gpu.materials.textures.get('ferrum')!==materialCheck.textures.get('ferrum') && !document.getElementById('renderError').textContent));
    assert.ok(await page.evaluate(()=>{
      const v=preview.gpu.gl.getUniform(preview.gpu.program,preview.gpu.materials.uniforms.materialTuning);
      return Math.abs(v[1]-1.4)<.0001 && Math.abs(v[2]+.12)<.0001 && !document.getElementById('roughnessBias').disabled;
    }), 'Custom tuning survives style switching and GPU context replacement');
  }
  assert.deepEqual(errors, []);
  console.log('Material GPU: sharp patchy coverage, packed Ferrum normal/roughness/AO, BRDF and neutral rock fixtures; file:// WebP decoding, shader linking and unchanged plan/mesh/vegetation; material sliders/keyboard/reset and responsive folding OK; zero texture/geometry uploads, shader recompiles or shadow redraws on tuning/folding; custom settings restored with context OK.',
    { derivatives: result.derivatives, gradients: result.gradients, contextRestored: lifecycle, variants: result.probes.map(p => ({ antialias: p.antialias, explicitGradients: p.explicitGradients, blended: p.ramp.filter(v => v > 0 && v < 255).length })) });
  await page.close();
}, { timeoutMs: 60000 });
