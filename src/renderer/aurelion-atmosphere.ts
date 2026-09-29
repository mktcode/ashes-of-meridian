/* City-owned programs and depth resolve; the gameplay adapter retains the normal entity shaders. */
'use strict';
const AURELION_SCREEN_MATERIAL = -20, AURELION_BACKDROP_MATERIAL = -23;
function createAurelionNoiseVolume() {
  const random = seeded(0x434c4f55), data = new Uint8Array(32*32*32);
  for (let i=0;i<data.length;i++) data[i]=Math.floor(random()*256);
  return data;
}
const AURELION_SURFACE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_pos;in vec3 v_n;in vec4 v_col;in float v_glow;in vec4 v_shadow;flat in float v_mat;
uniform vec3 u_eye;uniform vec3 u_sun;uniform vec3 u_skyLight;uniform vec3 u_bounce;
uniform sampler2D u_shadow;uniform sampler2D u_metalTex;uniform sampler2D u_advertising;
uniform float u_shadowBias;uniform float u_time;uniform float u_worldHeightScale;
uniform vec4 u_ecology;uniform vec3 u_biomeDry;uniform vec3 u_biomeLush;
uniform float u_atmosphereOn;uniform vec3 u_atmosphereHorizon;uniform vec3 u_atmosphereZenith;
out vec4 frag;
const vec3 sunDirection=normalize(vec3(-64.,110.,43.));
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 film(vec3 c){return pow(1.-exp(-max(c,vec3(0.))*.90),vec3(.88));}
float shadow(vec3 n){
 vec3 p=v_shadow.xyz/v_shadow.w*.5+.5;
 if(any(lessThan(p,vec3(0.)))||any(greaterThan(p,vec3(1.))))return 1.;
 float bias=max(u_shadowBias*2.5*(1.-dot(n,sunDirection)),u_shadowBias),s=0.;
 vec2 texel=1./vec2(textureSize(u_shadow,0));
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)s+=p.z-bias>texture(u_shadow,p.xy+vec2(x,y)*texel).r?.16:1.;
 return s/9.;
}
const int adCount=${AURELION_BILLBOARDS.length};
const vec4 adRect[adCount]=vec4[adCount](AURELION_AD_RECTS);
const vec2 adDepth[adCount]=vec2[adCount](AURELION_AD_DEPTHS);
const int deckEdges=${AURELION_DECK_OUTLINE.length},walkCount=${AURELION_WALKWAYS.length};
const vec2 deckOutline[deckEdges]=vec2[deckEdges](AURELION_DECK_OUTLINE);
const vec4 walkPaths[walkCount]=vec4[walkCount](AURELION_WALK_PATHS);
const vec3 walkLevels[walkCount]=vec3[walkCount](AURELION_WALK_LEVELS);
const vec2 crownFloor=vec2(AURELION_CROWN_FLOOR);
const float deckHeight=float(${AURELION_SECTOR_HEIGHT});
float floorMask(float height){return 1.-smoothstep(.18,.38,abs(v_pos.y-height*u_worldHeightScale));}
// Local area-light approximation plus flush light strips. No exposure/sky/fog change,
// extra geometry, shadow passes or illumination of the facades below the decks.
vec3 deckLighting(vec3 base,float aa){
 vec2 q=abs(v_pos.xz);float edge=1e5,perimeter=0.;
 for(int i=0;i<deckEdges;i++){
  vec2 a=deckOutline[i],e=deckOutline[(i+1)%deckEdges]-a;
  float len=length(e),d=(e.x*(q.y-a.y)-e.y*(q.x-a.x))/len;
  if(d<edge){edge=d;perimeter=dot(q-a,e)/len;}
 }
 float platform=smoothstep(-.1,.1,edge)*floorMask(deckHeight),road=0.,roadWash=0.,roadStrip=0.;
 for(int i=0;i<walkCount;i++){
  vec2 a=walkPaths[i].xy,e=walkPaths[i].zw-a;float len=length(e),along=dot(q-a,e)/len;
  float t=clamp(along/len,0.,1.),side=abs(e.x*(q.y-a.y)-e.y*(q.x-a.x))/len;
  float rim=walkLevels[i].x*.5-side;
  float mask=smoothstep(-.1,.1,rim)*floorMask(mix(walkLevels[i].y,walkLevels[i].z,t));
  mask*=smoothstep(-5.,-3.,along)*(1.-smoothstep(len+3.,len+5.,along));
  road=max(road,mask);
  float falloff=(rim-1.5)/5.;
  roadWash=max(roadWash,mask*exp(-falloff*falloff));
  float ends=smoothstep(1.,4.,along)*(1.-smoothstep(len-4.,len-1.,along));
  float dash=1.-smoothstep(3.,3.+aa,abs(mod(along+6.,12.)-6.));
  roadStrip=max(roadStrip,mask*ends*dash*(1.-smoothstep(.12,.12+aa,abs(rim-1.5))));
 }
 float plaza=(1.-smoothstep(crownFloor.x-.2,crownFloor.x+.2,length(q)))*floorMask(crownFloor.y);
 float border=platform*exp(-max(edge,0.)/13.);
 vec2 warmA=(q-vec2(133.,65.))/vec2(27.,23.),warmB=(q-vec2(85.,124.))/vec2(32.,22.);
 float pools=platform*(exp(-dot(warmA,warmA))+.7*exp(-dot(warmB,warmB)));
 float dash=1.-smoothstep(2.5,2.5+aa,abs(mod(perimeter+8.,16.)-8.));
 float strip=platform*(1.-road)*dash*(1.-smoothstep(.12,.12+aa,abs(edge-1.5)));
 vec3 fill=base*vec3(.58,.72,.85)*max(platform,max(road,plaza*.65));
 fill+=base*vec3(.55,.34,.15)*(border*.7+pools*.65+roadWash*.5);
 return fill+vec3(2.2,1.45,.60)*strip+vec3(.50,1.5,1.9)*roadStrip;
}
void main(){
 vec3 n=normalize(v_n),view=normalize(u_eye-v_pos),base=v_col.rgb;
 float alpha=v_col.a;vec3 authored=vec3(v_pos.x,v_pos.y/u_worldHeightScale,v_pos.z);
 if(v_mat==${AURELION_SCREEN_MATERIAL}.){
  int board=0;float best=1e9;
  for(int i=0;i<adCount;i++){float d=distance(authored,vec3(adRect[i].x,adRect[i].y,adDepth[i].x));if(d<best){best=d;board=i;}}
  vec2 p=clamp((authored.xy-adRect[board].xy)/adRect[board].zw+.5,vec2(.004),vec2(.996));
  vec3 art=texture(u_advertising,vec2((adDepth[board].y+p.x)/4.,1.-p.y)).rgb;
  float scan=.96+.04*sin(p.y*700.+u_time*.6);
  vec3 lit=art*(2.7+.12*sin(u_time*.33+float(board)))*scan;
  frag=vec4(film(lit),1.);return;
 }
 if(v_glow>.5){
  bool warm=base.r>base.b;
  vec3 emission=pow(base,vec3(1.5))*(warm?vec3(1.18,.99,.70):vec3(.84,1.12,1.35));
  float central=1.-smoothstep(10.5,13.,distance(authored,vec3(0.,15.,0.)));
  frag=vec4(film(emission*(3.1+central*.7)),alpha);return;
 }
 vec2 p=abs(n.y)>.7?v_pos.xz:abs(n.x)>.7?v_pos.zy:v_pos.xy;
 float grain=dot(texture(u_metalTex,p*.075).rgb,vec3(.333));
 base*=.87+grain*.25;
 if(u_ecology.x>.5){
  base=mix(base,u_biomeDry*(.5+dot(base,vec3(.333))),.2);
  if(u_ecology.y==2.)base*=.88;
 }
 bool paving=n.y>.9&&authored.y>-.2&&authored.y<9.&&max(base.r,base.g)>.32;
 if(paving){
  vec2 tile=floor(v_pos.xz/6.),q=abs(fract(v_pos.xz/6.)-.5)*6.;
  float seam=smoothstep(2.93,2.99,max(q.x,q.y));
  base*=(.91+hash(tile)*.15)*(1.-seam*.25);
 }
 float glass=smoothstep(.09,.17,base.b-base.r)*(1.-smoothstep(.28,.4,base.r));
 float sh=shadow(n),nd=max(dot(n,sunDirection),0.);
 vec3 ambient=mix(u_bounce,u_skyLight,n.y*.5+.5),lit=base*(ambient+u_sun*nd*sh);
 float brightTrim=smoothstep(.60,.73,max(max(v_col.r,v_col.g),v_col.b));
 lit+=u_sun*brightTrim*(.12+max(n.y,0.)*.28)*sh;
 if(abs(n.y)<.15&&v_mat==${AURELION_BACKDROP_MATERIAL}.){
  vec2 facade=p/vec2(2.1,3.6),cell=fract(facade),aa=max(fwidth(facade),vec2(.015));
  vec2 windowMask=smoothstep(vec2(.20)-aa,vec2(.20)+aa,cell)*(1.-smoothstep(vec2(.68)-aa,vec2(.68)+aa,cell));
  float on=step(.30,hash(floor(facade)))*windowMask.x*windowMask.y;
  lit+=vec3(2.8,2.2,1.1)*on;
 }
 float fresnel=pow(1.-max(dot(n,view),0.),4.);
 float spec=pow(max(dot(n,normalize(sunDirection+view)),0.),mix(48.,100.,glass));
 lit+=u_sun*spec*sh*(mix(.45,.9,glass)+(u_ecology.y==2.?max(n.y,0.)*.25:0.));
 vec3 reflected=reflect(-view,n);
 vec3 env=u_atmosphereOn>.5?mix(u_atmosphereHorizon,u_atmosphereZenith,smoothstep(-.3,.8,reflected.y)):
  mix(vec3(.012,.027,.05),vec3(.12,.20,.32),smoothstep(-.3,.8,reflected.y));
 lit+=env*(.035+fresnel*.28+glass*.18);
 float deckAA=max(length(fwidth(v_pos.xz))*.65,.06);
 if(v_mat>=0.&&n.y>.85&&authored.y>-.3&&authored.y<deckHeight+.4)
  lit+=deckLighting(base,deckAA)*smoothstep(.85,.95,n.y);
 // Local emissive spill is an artistic light approximation, not extra shadow-casting lights.
 float crown=exp(-dot(v_pos.xz,v_pos.xz)/580.)*exp(-abs(authored.y-5.)*.10);
 lit+=vec3(.025,.42,.7)*crown*(.35+max(n.y,0.));
 for(int i=0;i<adCount;i++){
  vec3 delta=vec3(adRect[i].x,adRect[i].y*u_worldHeightScale,adDepth[i].x+4.)-v_pos;
  float spill=max(dot(n,normalize(delta)),0.)/(1.+dot(delta,delta)*.015);
  lit+=mix(vec3(.12,.28,.8),vec3(.5,.16,.65),mod(float(i),2.))*spill*.75;
 }
 frag=vec4(film(lit),alpha);
}`;
const AURELION_SKY_FRAGMENT = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;
uniform float u_atmosphereOn;uniform vec3 u_atmosphereHorizon;uniform vec3 u_atmosphereZenith;
void main(){vec3 horizon=u_atmosphereOn>.5?u_atmosphereHorizon:vec3(.028,.047,.08),zenith=u_atmosphereOn>.5?u_atmosphereZenith:vec3(.006,.012,.029);
frag=vec4(mix(horizon,zenith,smoothstep(0.,1.,uv.y)),1.);}`;
const AURELION_POST_FRAGMENT = `#version 300 es
precision highp float;precision highp sampler3D;
in vec2 uv;out vec4 frag;
uniform sampler2D u_tex;uniform sampler2D u_bloom;uniform sampler2D u_cityDepth;uniform sampler2D u_sunDepth;
uniform sampler3D u_cloudNoise;uniform mat4 u_inverseVP;uniform mat4 u_light;
uniform vec2 u_cloudStyle;
uniform float u_atmosphereOn;uniform vec3 u_atmosphereHorizon;uniform vec3 u_atmosphereZenith;
uniform vec3 u_eye;uniform vec2 u_size;uniform float u_time;uniform float u_bloomOn;uniform float u_depthOn;uniform float u_amount;uniform float u_hazeStart;
vec3 world(vec2 p,float depth){vec4 v=u_inverseVP*vec4(p*2.-1.,depth*2.-1.,1.);return v.xyz/v.w;}
float noise(vec3 p){return texture(u_cloudNoise,p).r;}
float cloud(vec3 p){
 vec3 wind=vec3(u_time*.00035,0.,u_time*.00012)+vec3(u_cloudStyle.y*.07,0.,0.);
 float f=noise(p*.0019+wind)*.62+noise(p*.0046+wind*1.7+4.1)*.26+noise(p*.012+wind*2.1)*.12;
 float top=-35.+(noise(vec3(p.x*.0012,.27,p.z*.0012)+wind)-.5)*50.;
 float layer=1.-smoothstep(top-65.,top,p.y);
 return smoothstep(.28,.70,f+layer*.28)*layer*(.024+u_cloudStyle.x*.024);
}
float sunlight(vec3 p){
 vec4 v=u_light*vec4(p,1.);vec3 q=v.xyz/v.w*.5+.5;
 if(any(lessThan(q,vec3(0.)))||any(greaterThan(q,vec3(1.))))return 1.;
 return q.z-.0007>texture(u_sunDepth,q.xy).r?.3:1.;
}
float occlusion(vec3 p,vec3 n,float pixelWorld){
 float radius=clamp(4./max(pixelWorld,.01),2.,22.),ao=0.;
 for(int i=0;i<8;i++){
  float a=float(i)*2.399963,r=radius*(.4+float(i%3)*.3);
  vec2 q=uv+vec2(cos(a),sin(a))*r/u_size;
  if(any(lessThan(q,vec2(0.)))||any(greaterThan(q,vec2(1.))))continue;
  vec3 d=world(q,texture(u_cityDepth,q).r)-p;
  float lengthD=length(d);
  ao+=max(0.,dot(n,d/max(lengthD,.001))-.12)*(1.-smoothstep(.3,7.,lengthD));
 }
 return 1.-min(.48,ao*.19);
}
void main(){
 vec3 c=texture(u_tex,uv).rgb,bloom=texture(u_bloom,uv).rgb*u_bloomOn;
 if(u_depthOn>.5&&u_amount>.01){
  float depth=texture(u_cityDepth,uv).r;
  vec3 p=world(uv,depth),near=world(uv,0.),n=cross(dFdx(p),dFdy(p));
  n=normalize(n+vec3(.000001));if(dot(n,near-p)<0.)n=-n;
  float luminous=smoothstep(.80,.96,max(max(c.r,c.g),c.b));
  float pixelWorld=max(length(dFdx(p)),length(dFdy(p)));
  if(depth<.99999)c*=mix(occlusion(p,n,pixelWorld),1.,luminous);
  // Height-limited, front-to-back integration along the actual camera ray, including orthographic views.
  vec3 delta=p-near;float distanceP=length(delta);vec3 ray=delta/max(distanceP,.001);
  float transmittance=1.;vec3 scattered=vec3(0.);
  if(ray.y<-.01){
   float enter=max(0.,(-8.-near.y)/ray.y),exit=min(distanceP,(-158.-near.y)/ray.y);
   if(exit>enter){
    float stepSize=(exit-enter)/24.;
    float jitter=fract(sin(dot(uv*u_size,vec2(12.9898,78.233)))*43758.5453)*.35+.325;
    for(int i=0;i<24;i++){
     vec3 q=near+ray*(enter+(float(i)+jitter)*stepSize);
     float density=cloud(q),a=1.-exp(-density*stepSize);
     float sky=smoothstep(-145.,-45.,q.y),direct=sunlight(q);
     float edge=clamp((cloud(q)-cloud(q+vec3(-5.,9.,3.)))*15.+.55,0.,1.);
     // Low blue night scatter keeps the canyons dark rather than filling them with white daylight.
     vec3 low=u_atmosphereOn>.5?u_atmosphereZenith*.25:vec3(.01,.018,.035),
       high=u_atmosphereOn>.5?u_atmosphereHorizon*.4:vec3(.075,.12,.20);
     vec3 light=mix(low,high,.20+sky*.26+direct*edge*.48);
     scattered+=transmittance*a*light;transmittance*=1.-a;
     if(transmittance<.015)break;
    }
   }
  }
  float haze=(1.-exp(-max(length(p.xz-u_eye.xz)-u_hazeStart,0.)*.0014))*(.65+.35*(1.-smoothstep(-70.,80.,p.y)));
  c=mix(c,u_atmosphereOn>.5?u_atmosphereHorizon*.7:vec3(.025,.04,.075),haze*.70);
  c=c*transmittance+scattered;bloom*=transmittance;
 }
 vec3 streak=vec3(0.);
 for(int i=1;i<=3;i++){
  vec2 offset=vec2(float(i)*14./u_size.x,0.);
  streak+=(texture(u_bloom,uv+offset).rgb+texture(u_bloom,uv-offset).rgb)*(.045/float(i));
 }
 c+=(bloom*.95+streak*u_bloomOn)*u_amount*(1.-c*.45);
 c=pow(max(vec3(0.),(c-.4)*1.055+.4),vec3(1.16));
 float vignette=1.-smoothstep(.30,.88,length((uv-.5)*vec2(1.,.8)))*.22;
 float grain=(fract(sin(dot(uv*u_size,vec2(12.9898,78.233)))*43758.5453)-.5)/420.;
 frag=vec4(clamp(c*vignette+grain,0.,1.),1.);
}`;
// Owns only the city's GPU programs, textures, depth target and submission fence.
// Common render passes and entity resources stay with MeridianRenderer.
class AurelionAtmosphere {
  program!: WebGLProgram;
  skyProg!: WebGLProgram;
  postProg!: WebGLProgram;
  private programs: WebGLProgram[] = [];
  depthAvailable = false;
  private cityDepth: WebGLTexture | null = null;
  private cityDepthFbo: WebGLFramebuffer | null = null;
  private depthSize = '';
  private depthVerified = false;
  private cloudNoise: WebGLTexture | null = null;
  private advertising: WebGLTexture | null = null;
  private frameFence: WebGLSync | null = null;
  constructor(private readonly renderer: MeridianRenderer) {
    const g=renderer.gl;
    const create = (vertex:string, fragment:string) => {
      const program=renderer.programOf(vertex,fragment);
      this.programs.push(program);
      return program;
    };
    const number = (n:number) => Number.isInteger(n)?`${n}.`:String(n);
    let surface=AURELION_SURFACE_FRAGMENT
      .replace('AURELION_AD_RECTS',AURELION_BILLBOARDS.map(b=>`vec4(${[b.x,b.y,b.w,b.h].map(number).join(',')})`).join(','))
      .replace('AURELION_AD_DEPTHS',AURELION_BILLBOARDS.map(b=>`vec2(${number(b.z)},${number(b.design)})`).join(','))
      .replace('AURELION_DECK_OUTLINE',AURELION_DECK_OUTLINE.map(p=>`vec2(${p.map(number).join(',')})`).join(','))
      .replace('AURELION_WALK_PATHS',AURELION_WALKWAYS.map(p=>`vec4(${p.slice(0,4).map(number).join(',')})`).join(','))
      .replace('AURELION_WALK_LEVELS',AURELION_WALKWAYS.map(p=>`vec3(${p.slice(4).map(number).join(',')})`).join(','))
      .replace('AURELION_CROWN_FLOOR',[AURELION_CROWN_FLOOR.radius,AURELION_CROWN_FLOOR.height].map(number).join(','));
    surface=surface.replace('void main(){','void cityMain(){')
      .replace('float shadow(vec3 n){','uniform float u_shadowOn;\nfloat shadow(vec3 n){\n if(u_shadowOn<.5)return 1.;')+
      `\nuniform sampler2D u_fog;uniform float u_fogOn;uniform float u_extent;
      void main(){cityMain();float sight=texture(u_fog,clamp((v_pos.xz+u_extent)/(2.*u_extent),0.,1.)).r;
      frag.rgb*=mix(1.,mix(.16,1.,sight),u_fogOn);}`;
    try {
      this.program=create(VERT,surface);this.skyProg=create(FULLV,AURELION_SKY_FRAGMENT);this.postProg=create(FULLV,AURELION_POST_FRAGMENT);
      const noise=this.cloudNoise=g.createTexture(),advertising=this.advertising=g.createTexture();
      if (!noise||!advertising) throw Error('Could not allocate Aurelion textures');
      g.activeTexture(g.TEXTURE12);g.bindTexture(g.TEXTURE_3D,noise);
      g.texImage3D(g.TEXTURE_3D,0,g.R8,32,32,32,0,g.RED,g.UNSIGNED_BYTE,createAurelionNoiseVolume());
      for (const axis of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T,g.TEXTURE_WRAP_R]) g.texParameteri(g.TEXTURE_3D,axis,g.REPEAT);
      g.texParameteri(g.TEXTURE_3D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_3D,g.TEXTURE_MAG_FILTER,g.LINEAR);
      g.activeTexture(g.TEXTURE13);g.bindTexture(g.TEXTURE_2D,advertising);
      g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,createAurelionAdvertisingAtlas());
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
      g.generateMipmap(g.TEXTURE_2D);
    } catch (error) {
      this.dispose();
      throw error;
    } finally { g.activeTexture(g.TEXTURE0); }
  }
  resize() {
    const g=this.renderer.gl;
    g.deleteTexture(this.cityDepth);g.deleteFramebuffer(this.cityDepthFbo);
    this.cityDepth=null;this.cityDepthFbo=null;this.depthAvailable=false;this.depthVerified=false;this.depthSize='';
  }
  private prepareDepth() {
    const {gl:g,width,height}=this.renderer,size=`${width}x${height}`;
    if (size===this.depthSize) return;
    this.resize();this.depthSize=size;
    const texture=g.createTexture(),fbo=g.createFramebuffer();
    if (texture&&fbo) {
      g.activeTexture(g.TEXTURE11);g.bindTexture(g.TEXTURE_2D,texture);
      g.texImage2D(g.TEXTURE_2D,0,g.DEPTH_COMPONENT24,width,height,0,g.DEPTH_COMPONENT,g.UNSIGNED_INT,null);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
      g.bindFramebuffer(g.FRAMEBUFFER,fbo);
      g.framebufferTexture2D(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.TEXTURE_2D,texture,0);
      g.drawBuffers([g.NONE]);g.readBuffer(g.NONE);
      if (g.checkFramebufferStatus(g.FRAMEBUFFER)===g.FRAMEBUFFER_COMPLETE) {
        this.cityDepth=texture;this.cityDepthFbo=fbo;this.depthAvailable=true;return;
      }
    }
    g.deleteTexture(texture);g.deleteFramebuffer(fbo);
    console.warn('Aurelion: depth effects unavailable; using lighting and bloom only.');
  }
  frameReady() {
    if (!this.frameFence) return true;
    const g=this.renderer.gl,status=g.clientWaitSync(this.frameFence,0,0);
    if (status===g.TIMEOUT_EXPIRED) return false;
    g.deleteSync(this.frameFence);this.frameFence=null;
    if (status===g.WAIT_FAILED) throw Error('Aurelion GPU frame synchronization failed');
    return true;
  }
  beginFrame() {
    const g=this.renderer.gl;
    if (this.frameFence) {g.deleteSync(this.frameFence);this.frameFence=null;}
    g.activeTexture(g.TEXTURE12);g.bindTexture(g.TEXTURE_3D,this.cloudNoise);
    g.activeTexture(g.TEXTURE13);g.bindTexture(g.TEXTURE_2D,this.advertising);
    g.useProgram(this.program);
    g.uniform1i(this.renderer.uniform(this.program,'u_advertising'),13);
  }
  endFrame() {
    const g=this.renderer.gl;
    // Only one scene may be in flight. Poll with zero timeout in rAF, never block with finish/wait.
    this.frameFence=g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE,0);
    if (!this.frameFence) throw Error('Could not synchronize the Aurelion GPU frame');
    g.flush();
  }
  preparePost() {
    const r=this.renderer,g=r.gl;
    if (r.quality>0) this.prepareDepth();
    else this.resize();
    if (this.depthAvailable) {
      // Same dimensions and DEPTH_COMPONENT24 on both sides, with NEAREST multisample resolve.
      g.bindFramebuffer(g.READ_FRAMEBUFFER,r.sceneMSAAFbo||r.sceneFbo);
      g.bindFramebuffer(g.DRAW_FRAMEBUFFER,this.cityDepthFbo);
      g.blitFramebuffer(0,0,r.width,r.height,0,0,r.width,r.height,g.DEPTH_BUFFER_BIT,g.NEAREST);
      if (!this.depthVerified) {
        const error=g.getError();this.depthVerified=true;
        if (error!==g.NO_ERROR) {
          this.depthAvailable=false;
          g.deleteTexture(this.cityDepth);g.deleteFramebuffer(this.cityDepthFbo);
          this.cityDepth=null;this.cityDepthFbo=null;
          console.warn(`Aurelion: depth resolve unavailable (${error}); using lighting and bloom only.`);
        }
      }
    }
    g.activeTexture(g.TEXTURE11);g.bindTexture(g.TEXTURE_2D,this.depthAvailable?this.cityDepth:r.fogTex);
    g.activeTexture(g.TEXTURE14);g.bindTexture(g.TEXTURE_2D,r.shadowTex);
    g.useProgram(this.postProg);
    // Also initialize samplers on the first Performance frame: 2D and 3D samplers
    // cannot alias the default unit zero, even when their effect branch is disabled.
    g.uniform1i(r.uniform(this.postProg,'u_cityDepth'),11);g.uniform1i(r.uniform(this.postProg,'u_cloudNoise'),12);
    g.uniform1i(r.uniform(this.postProg,'u_sunDepth'),14);
    g.uniformMatrix4fv(r.uniform(this.postProg,'u_inverseVP'),false,r.inverseVP);
    g.uniformMatrix4fv(r.uniform(this.postProg,'u_light'),false,r.lightVP);
    g.uniform3fv(r.uniform(this.postProg,'u_eye'),r.eye);
    g.uniform1f(r.uniform(this.postProg,'u_depthOn'),this.depthAvailable?1:0);
    g.uniform1f(r.uniform(this.postProg,'u_amount'),r.quality>0?1:0);
    g.uniform1f(r.uniform(this.postProg,'u_hazeStart'),100);
    g.uniform2f(r.uniform(this.postProg,'u_cloudStyle'),r.battlefieldProfile.ecology?.cover??.5,r.battlefieldProfile.ecology?.phase??0);
  }
  dispose() {
    const r=this.renderer,g=r.gl;
    if (this.frameFence) {g.deleteSync(this.frameFence);this.frameFence=null;}
    this.resize();
    g.deleteTexture(this.cloudNoise);g.deleteTexture(this.advertising);
    this.cloudNoise=null;this.advertising=null;
    for (const program of this.programs) {g.deleteProgram(program);r.uniformCache.delete(program);}
    this.programs=[];
  }
}
