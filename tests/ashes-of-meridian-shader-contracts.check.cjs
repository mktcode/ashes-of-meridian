// Source-level wiring only. These tests neither compile GLSL nor validate pixels.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { RENDERER_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
function shaders() {
  return vm.runInContext('({VERT, FRAG, DEPTHV, DEPTHF, FULLV, POSTF, BLOOMF, ECOLOGY_WIND, MAT, PLACEMENT_GUIDE_MATERIAL, sceneMaterialFragment})',
    loadScripts(RENDERER_SCRIPTS));
}
function declarations(source, kind) {
  return new Map([...source.matchAll(new RegExp(`\\b${kind}\\s+(?:(?:lowp|mediump|highp)\\s+)?(\\w+)\\s+(\\w+)\\s*;`, 'g'))]
    .map(([, type, name]) => [name, type]));
}
function checkInterface(vertex, fragment) {
  const outputs = declarations(vertex, 'out'), inputs = declarations(fragment, 'in');
  assert.ok(inputs.size > 0, 'fragment shader declares a stage interface');
  for (const [name, type] of inputs)
    assert.equal(outputs.get(name), type, `${name}: matching vertex/fragment interface`);
}

test('scene, depth and fullscreen shaders expose matching stage interfaces', () => {
  const s = shaders();
  for (const [vertex, fragment] of [[s.VERT, s.FRAG], [s.DEPTHV, s.DEPTHF], [s.FULLV, s.POSTF], [s.FULLV, s.BLOOMF]])
    checkInterface(vertex, fragment);
  const scene = declarations(s.FRAG, 'uniform');
  for (const name of ['u_groundTex', 'u_metalTex', 'u_bioTex', 'u_rockTex', 'u_fog', 'u_lightData', 'u_lightGrid'])
    assert.equal(scene.get(name), 'sampler2D', `${name}: scene sampler`);
  assert.equal(scene.get('u_pointLightCount'), 'int');
  assert.equal(scene.get('u_surfaceRelief'), 'vec4');
  assert.equal(scene.get('u_landscapeRelief'), 'vec2');
});

test('material variants reuse the scene fragment shader with only a material define', () => {
  const { FRAG, MAT, sceneMaterialFragment } = shaders();
  for (const material of [MAT.LANDSCAPE, MAT.LEAF, MAT.BRUSH]) {
    const shader = sceneMaterialFragment(material), define = `#define SCENE_MATERIAL ${material}.\n`;
    assert.ok(shader.startsWith('#version 300 es\n' + define));
    assert.equal(shader.replace(define, ''), FRAG);
  }
});

test('mesh materials use model coordinates and scene/shadow passes share wind displacement', () => {
  const { FRAG, VERT, DEPTHV, ECOLOGY_WIND } = shaders();
  for (const texture of ['u_metalTex', 'u_bioTex'])
    assert.match(FRAG, new RegExp(`tri\\(\\s*${texture}\\s*,\\s*v_modelPos\\s*,`));
  assert.equal(declarations(VERT, 'out').get('v_modelN'), 'vec3');
  for (const shader of [VERT, DEPTHV]) assert.ok(shader.includes(ECOLOGY_WIND));
});

test('local diffuse and specular lighting use the scenery fog gate', () => {
  const { FRAG } = shaders();
  const local = FRAG.slice(FRAG.indexOf('vec3 localLighting'), FRAG.indexOf('float shadow()'));
  assert.match(local, /if\s*\(\s*u_pointLightCount\s*==\s*0\s*\)\s*return\s+vec3\(\s*0\.\s*\)/);
  assert.match(local, /sceneryFog\(\s*position\.xz\s*\)/);
  for (const lobe of ['result', 'specular']) assert.match(local, new RegExp(`\\b${lobe}\\s*\\*=\\s*visible\\s*;`));
});

test('placement overlay uses gameplay fog and derivative-filtered lines', () => {
  const { FRAG, PLACEMENT_GUIDE_MATERIAL } = shaders();
  const branch = FRAG.match(new RegExp(`if\\s*\\(\\s*v_mat\\s*==\\s*${PLACEMENT_GUIDE_MATERIAL}\\.\\s*\\)\\s*\\{([\\s\\S]*?)return\\s*;`))?.[1];
  assert.ok(branch, 'placement material has a dedicated branch');
  assert.match(branch, /battlefieldFog\(/);
  assert.match(branch, /fwidth\(/);
  assert.match(branch, /u_placementGridDetail/);
  assert.doesNotMatch(branch, /texture\(|shadow\(/, 'overlay does not use surface shading');
});

test('post processing receives quality, resolution and a separate bloom texture', () => {
  const { POSTF, BLOOMF } = shaders(), post = declarations(POSTF, 'uniform');
  for (const name of ['u_tex', 'u_bloom']) assert.equal(post.get(name), 'sampler2D');
  assert.equal(post.get('u_size'), 'vec2');
  assert.equal(post.get('u_quality'), 'float');
  assert.equal(post.get('u_bloomOn'), 'float');
  assert.match(POSTF, /if\s*\(\s*u_quality\s*>\s*1\.5\s*\)\s*c\s*=\s*tiltShift\(/);
  const bloom = declarations(BLOOMF, 'uniform');
  assert.equal(bloom.get('u_tex'), 'sampler2D');
  assert.equal(bloom.get('u_step'), 'vec2');
  assert.equal(bloom.get('u_extract'), 'bool');
});
