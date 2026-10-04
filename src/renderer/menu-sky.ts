/* Seed-owned home-screen backdrop. No world geometry, combat RNG or skybox state. */
'use strict';
interface MenuSkyBody {
  x: number; y: number; radius: number; distance: number;
  color: readonly number[]; kind: number;
}
interface MenuSkyRecipe {
  space: boolean; horizon: readonly number[]; zenith: readonly number[];
  salt: number; bodies: MenuSkyBody[];
}
function menuSkyRecipe(seed: number, family: string): MenuSkyRecipe {
  let salt = 0x534b594d;
  for (const c of family) salt = Math.imul(salt ^ c.charCodeAt(0), 16777619);
  const rng = seeded(seed ^ salt), space = rng() < .4,
    palettes = [
      [[.46,.27,.58],[.055,.025,.16]],
      [[.21,.59,.52],[.018,.12,.19]],
      [[.72,.37,.23],[.16,.055,.19]],
      [[.55,.28,.38],[.10,.025,.085]],
      [[.43,.57,.66],[.065,.15,.32]]
    ] as const, palette = palettes[Math.floor(rng()*palettes.length)],
    colors = [[.22,.52,.64],[.66,.34,.19],[.40,.53,.31],[.58,.38,.65],[.63,.65,.69]],
    count = rng() < .3 ? 3 : 2, bodies: MenuSkyBody[] = [];
  for (let i=0;i<count;i++) {
    const anchors = [[.55,.66],[-.24,.82],[.06,.48]],
      distance = 170 + i*70 + rng()*30;
    bodies.push({x:anchors[i][0]+(rng()-.5)*.13, y:anchors[i][1]+(rng()-.5)*.09,
      radius: i===0 ? .12+rng()*.09 : .035+rng()*.045, distance,
      color: colors[Math.floor(rng()*colors.length)], kind: rng()<.5 ? 0 : 1});
  }
  if (rng()<.45) bodies.push({x:-.79,y:.72,radius:.19+rng()*.08,distance:125,
    color:[1,.69,.30],kind:2});
  return {space,horizon:space?[.016,.022,.045]:palette[0],
    zenith:space?[.002,.003,.012]:palette[1],salt:rng()*2048,bodies};
}
const MENU_SKY_FRAGMENT = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;
uniform vec2 u_size;uniform vec3 u_horizon,u_zenith,u_sun;uniform float u_space,u_salt;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+u_salt)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
vec3 stars(vec2 pixel,float cell,float chance,float radius){
 vec2 tile=floor(pixel/cell),p=mod(pixel,cell);
 float h=hash(tile+cell),exists=step(1.-chance,h);
 vec2 center=(vec2(hash(tile+13.),hash(tile+71.))*.7+.15)*cell;
 float r=radius*(.45+.55*hash(tile+23.)),d=length(p-center);
 float glow=(1.-smoothstep(max(0.,r-.6),r+.65,d))*exists;
 return mix(vec3(.63,.78,1.),vec3(1.,.91,.73),hash(tile+89.))*glow*(.4+.6*h);
}
void main(){
 vec2 p=vec2(uv.x*u_size.x/u_size.y,uv.y)*vec2(3.8,5.);
 float cloud=noise(p)*.6+noise(p*2.03+7.1)*.28+noise(p*4.07)*.12;
 vec3 sky=mix(u_horizon,u_zenith,smoothstep(0.,1.,uv.y));
 if(u_space>.5){
  sky+=vec3(.018,.009,.025)*cloud;
  sky+=stars(uv*u_size,31.,.13,1.)+stars(uv*u_size,67.,.25,1.7)+stars(uv*u_size,137.,.3,2.5);
 }else{
  float mask=smoothstep(.55,.84,cloud);
  sky=mix(sky,mix(u_horizon,vec3(.82,.74,.86),.35)*(.65+cloud*.4),mask*.65);
 }
 if(u_sun.z>0.){
  vec2 delta=(uv*2.-1.-u_sun.xy)*vec2(u_size.x/u_size.y,1.);
  float halo=exp(-max(0.,length(delta)/u_sun.z-1.)*4.);
  sky+=vec3(1.,.55,.16)*halo*.24;
 }
 frag=vec4(sky,1.);
}`;
const MENU_BODY_VERTEX = `#version 300 es
precision highp float;layout(location=0) in vec3 a_position;out vec3 v_point;
uniform vec4 u_body;uniform float u_aspect;
void main(){
 float depth=u_body.w,tanFov=.388;
 vec3 center=vec3(u_body.x*u_aspect*depth*tanFov,u_body.y*depth*tanFov,-depth);
 vec3 p=center+a_position*u_body.z*depth*tanFov;
 gl_Position=vec4(p.x/(u_aspect*tanFov),p.y/tanFov,-p.z*1001./999.-2000./999.,-p.z);
 v_point=a_position;
}`;
const MENU_BODY_FRAGMENT = `#version 300 es
precision highp float;in vec3 v_point;out vec4 frag;uniform vec3 u_color;uniform float u_kind,u_salt;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7))+u_salt)*43758.5453);}
float noise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+1.),f.x),f.y),f.z);
}
void main(){
 vec3 n=normalize(v_point);
 float land=noise(n*4.2)*.6+noise(n*9.1+17.)*.28+noise(n*19.3)*.12;
 float bands=sin(n.y*39.+noise(n*7.)*4.);
 float texture=mix(smoothstep(.38,.62,land),bands*.5+.5,step(.5,u_kind));
 vec3 color=mix(u_color*.52,mix(u_color,vec3(.85,.79,.65),.38),texture);
 if(u_kind<.5)color=mix(color,vec3(.75,.81,.84),smoothstep(.78,.97,abs(n.y)+land*.07)*.65);
 float light=max(0.,dot(n,normalize(vec3(-.8,.45,1.))));
 color*=.09+.91*light;
 color+=u_color*pow(1.-abs(n.z),4.)*.19*light;
 if(u_kind>1.5)color=mix(u_color,vec3(1.,.96,.77),.55)*(.9+.1*noise(n*22.));
 frag=vec4(color,1.);
}`;
const MENU_SKY_COPY_FRAGMENT = `#version 300 es
precision highp float;out vec4 frag;uniform sampler2D u_cachedSky;
void main(){frag=texelFetch(u_cachedSky,ivec2(gl_FragCoord.xy),0);}`;
class MeridianMenuSky {
  private sky: WebGLProgram;
  private copy: WebGLProgram;
  private cacheTexture: WebGLTexture | null = null;
  private cacheFbo: WebGLFramebuffer | null = null;
  private targetKey = '';
  private cached = false;
  private body: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buffer: WebGLBuffer;
  private count: number;
  private seed: number | null = null;
  private family = '';
  private recipe!: MenuSkyRecipe;
  constructor(private renderer: MeridianRenderer) {
    const g=renderer.gl, ownedPrograms: WebGLProgram[]=[], ownedBuffers: WebGLBuffer[]=[],
      ownedVaos: WebGLVertexArrayObject[]=[];
    try {
      this.sky=renderer.programOf(FULLV,MENU_SKY_FRAGMENT);ownedPrograms.push(this.sky);
      this.body=renderer.programOf(MENU_BODY_VERTEX,MENU_BODY_FRAGMENT);ownedPrograms.push(this.body);
      this.copy=renderer.programOf(FULLV,MENU_SKY_COPY_FRAGMENT);ownedPrograms.push(this.copy);
      const vao=g.createVertexArray(),buffer=g.createBuffer();
      if(vao)ownedVaos.push(vao);if(buffer)ownedBuffers.push(buffer);
      if(!vao||!buffer)throw Error('Menu sky allocation failed');
      this.vao=vao;this.buffer=buffer;
      const vertices=new Float32Array(geom.sphere(48,24));this.count=vertices.length/9;
      g.bindVertexArray(vao);g.bindBuffer(g.ARRAY_BUFFER,buffer);
      g.bufferData(g.ARRAY_BUFFER,vertices,g.STATIC_DRAW);
      g.enableVertexAttribArray(0);g.vertexAttribPointer(0,3,g.FLOAT,false,36,0);
    }catch(error){
      for(const p of ownedPrograms)g.deleteProgram(p);
      for(const b of ownedBuffers)g.deleteBuffer(b);
      for(const v of ownedVaos)g.deleteVertexArray(v);
      throw error;
    }
  }
  private releaseTarget() {
    const g=this.renderer.gl;
    if(this.cacheTexture)g.deleteTexture(this.cacheTexture);
    if(this.cacheFbo)g.deleteFramebuffer(this.cacheFbo);
    this.cacheTexture=null;this.cacheFbo=null;this.cached=false;
  }
  private prepareTarget() {
    const r=this.renderer,g=r.gl,key=[r.width,r.height,r.quality,r.sceneSamples].join(':');
    if(key===this.targetKey)return;
    this.releaseTarget();this.targetKey=key;
    // One full-resolution RGBA8 image, no second depth/MSAA allocation. Remember
    // failed allocation until target configuration changes rather than retrying each frame.
    this.cacheTexture=g.createTexture();this.cacheFbo=g.createFramebuffer();
    try {
      if(!this.cacheTexture||!this.cacheFbo){this.releaseTarget();return;}
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D,this.cacheTexture);
      g.texImage2D(g.TEXTURE_2D,0,g.RGBA8,r.width,r.height,0,g.RGBA,g.UNSIGNED_BYTE,null);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
      g.bindFramebuffer(g.FRAMEBUFFER,this.cacheFbo);
      g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,this.cacheTexture,0);
      if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)this.releaseTarget();
    } finally {
      g.bindFramebuffer(g.FRAMEBUFFER,r.sceneMSAAFbo||r.sceneFbo);
    }
  }
  draw(seed: number, family: string) {
    const r=this.renderer,g=r.gl;
    if(seed!==this.seed||family!==this.family){
      this.recipe=menuSkyRecipe(seed,family);this.seed=seed;this.family=family;this.cached=false;
    }
    this.prepareTarget();
    if(this.cached){
      // A single-sample -> MSAA blit is not legal in WebGL 2. Draw an exact
      // texel copy instead; planet edges already contain the scene's MSAA resolve.
      g.useProgram(this.copy);g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D,this.cacheTexture);
      g.uniform1i(r.uniform(this.copy,'u_cachedSky'),0);
      g.bindVertexArray(r.fullVao);g.drawArrays(g.TRIANGLES,0,3);
      r.diagnostics?.draw(3);r.drawCalls++;
      return;
    }
    this.drawBackdrop();
    if(this.cacheFbo){
      // Capture before terrain, bloom and post. The scene target supplies the
      // original depth and sample count, so the cold frame follows the old path.
      g.bindFramebuffer(g.READ_FRAMEBUFFER,r.sceneMSAAFbo||r.sceneFbo);
      g.bindFramebuffer(g.DRAW_FRAMEBUFFER,this.cacheFbo);
      g.blitFramebuffer(0,0,r.width,r.height,0,0,r.width,r.height,g.COLOR_BUFFER_BIT,g.NEAREST);
      g.bindFramebuffer(g.FRAMEBUFFER,r.sceneMSAAFbo||r.sceneFbo);
      this.cached=true;
    }
  }
  private drawBackdrop() {
    const r=this.renderer,g=r.gl,recipe=this.recipe;
    g.useProgram(this.sky);
    g.uniform2f(r.uniform(this.sky,'u_size'),r.width,r.height);
    g.uniform3fv(r.uniform(this.sky,'u_horizon'),recipe.horizon);
    g.uniform3fv(r.uniform(this.sky,'u_zenith'),recipe.zenith);
    g.uniform1f(r.uniform(this.sky,'u_space'),recipe.space?1:0);
    g.uniform1f(r.uniform(this.sky,'u_salt'),recipe.salt);
    const sun=recipe.bodies.find(b=>b.kind===2);
    g.uniform3fv(r.uniform(this.sky,'u_sun'),sun?[sun.x,sun.y,sun.radius]:[0,0,0]);
    g.bindVertexArray(r.fullVao);g.drawArrays(g.TRIANGLES,0,3);r.diagnostics?.draw(3);r.drawCalls++;
    // Real shared sphere mesh, perspective-scaled distances; terrain draws over it.
    // Celestial depth is isolated from world depth and shadow/fog passes.
    g.enable(g.DEPTH_TEST);
    g.useProgram(this.body);g.bindVertexArray(this.vao);
    g.uniform1f(r.uniform(this.body,'u_aspect'),r.width/r.height);
    g.uniform1f(r.uniform(this.body,'u_salt'),recipe.salt);
    for(const b of recipe.bodies){
      g.uniform4f(r.uniform(this.body,'u_body'),b.x,b.y,b.radius,b.distance);
      g.uniform3fv(r.uniform(this.body,'u_color'),b.color);
      g.uniform1f(r.uniform(this.body,'u_kind'),b.kind);
      g.drawArrays(g.TRIANGLES,0,this.count);r.diagnostics?.draw(this.count);r.drawCalls++;
    }
    g.clear(g.DEPTH_BUFFER_BIT);g.disable(g.DEPTH_TEST);
  }
  dispose(){
    const r=this.renderer,g=r.gl;
    this.releaseTarget();
    g.deleteProgram(this.sky);g.deleteProgram(this.body);g.deleteProgram(this.copy);
    r.uniformCache.delete(this.sky);r.uniformCache.delete(this.body);r.uniformCache.delete(this.copy);
    g.deleteBuffer(this.buffer);g.deleteVertexArray(this.vao);
  }
}
