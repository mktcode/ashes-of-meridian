    /* WebGL shader sources. */
    'use strict';
    // Effect-only material; no texture or changes to the embedded material catalog.
    const CONTACT_SHADOW_MATERIAL = -1;
    // Dedicated procedural surfaces; the alloy pool makes deposits visibly illuminate the ground.
    const PORTAL_MATERIAL = -2, PORTAL_STILL_MATERIAL = -3, ALLOY_LIGHT_MATERIAL = -4,
      ALIEN_LIGHT_MATERIAL = -5;
    // Pixel rectangles (left, top, right, bottom) in the 1254² Desert WebP atlases.
    // Keep a transparent margin around each motif; the plant sheet is not a regular grid.
    const GROUND_DECOR_ATLAS = {
      rockClusters: [
        [63,88,264,264], [400,64,609,301], [702,112,874,233], [994,92,1181,271],
        [34,381,305,587], [381,396,587,571], [713,432,885,552], [986,365,1217,607],
        [73,713,263,877], [387,716,584,856], [653,678,935,909], [1014,719,1196,844],
        [51,953,294,1211], [380,1004,583,1170], [703,1020,887,1145], [1004,1002,1200,1170]
      ],
      desertShrubs: [
        [21,101,412,451], [433,87,841,444], [899,124,1224,429],
        [48,458,431,839], [450,491,786,825], [836,461,1221,838],
        [29,860,310,1183], [317,845,584,1166], [613,892,906,1175], [941,873,1237,1191]
      ]
    };
    const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;layout(location=1) in vec3 a_normal;layout(location=8) in vec3 a_tint;
layout(location=2) in mat4 a_model;layout(location=6) in vec4 a_color;layout(location=7) in float a_glow;layout(location=9) in float a_material;
uniform mat4 u_vp;uniform mat4 u_light;
out vec3 v_pos;out vec3 v_n;out vec4 v_col;out float v_glow;out vec4 v_shadow;flat out float v_mat;
out vec3 v_modelPos;out vec3 v_modelN;
void main(){vec4 p=a_model*vec4(a_pos,1.);v_pos=p.xyz;
// Scaled mesh-local coordinates keep detail density without world-space sliding.
vec3 textureScale=max(vec3(length(a_model[0].xyz),length(a_model[1].xyz),length(a_model[2].xyz)),vec3(.00001));
v_modelPos=a_pos*textureScale;
if(a_material==${CONTACT_SHADOW_MATERIAL}.||a_material==${ALLOY_LIGHT_MATERIAL}.)v_modelPos=a_pos;
if(a_material==${PORTAL_MATERIAL}.||a_material==${PORTAL_STILL_MATERIAL}.)v_modelPos=a_pos;
v_modelN=a_normal/textureScale;
vec3 normal=a_normal;if(a_material>3.5)normal/=vec3(dot(a_model[0].xyz,a_model[0].xyz),dot(a_model[1].xyz,a_model[1].xyz),dot(a_model[2].xyz,a_model[2].xyz));v_n=normalize(mat3(a_model)*normal);v_col=vec4(a_color.rgb*a_tint,a_color.a);v_glow=a_glow;v_shadow=u_light*p;v_mat=a_material;gl_Position=u_vp*p;}`;
    const FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec3 v_pos;in vec3 v_n;in vec4 v_col;in float v_glow;in vec4 v_shadow;flat in float v_mat;
in vec3 v_modelPos;in vec3 v_modelN;
uniform sampler2D u_shadow;uniform sampler2D u_fog;uniform sampler2D u_groundTex;uniform sampler2D u_rockClustersTex;uniform sampler2D u_desertShrubsTex;uniform sampler2D u_metalTex;uniform sampler2D u_bioTex;uniform vec3 u_eye;uniform vec3 u_haze;uniform float u_extent;uniform float u_shadowOn;uniform float u_fogOn;uniform float u_time;uniform highp uint u_decorSeed;uniform float u_groundPixelsPerMeter;uniform float u_groundMirror;uniform vec4 u_groundDecor;
uniform vec3 u_sun;uniform vec3 u_skyLight;uniform vec3 u_bounce;uniform float u_shadowBias;
uniform sampler2D u_rockTex;uniform float u_rockScale;uniform float u_portalTime;
out vec4 frag;
float shadow(){if(u_shadowOn<.5||v_glow>1.)return 1.;vec3 p=v_shadow.xyz/v_shadow.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;float bias=max(u_shadowBias*2.5*(1.-dot(normalize(v_n),normalize(vec3(-64.,110.,43.)))),u_shadowBias);float s=0.;vec2 texel=1./vec2(textureSize(u_shadow,0));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)s+=p.z-bias>texture(u_shadow,p.xy+vec2(x,y)*texel).r?.36:1.;return s/9.;}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 tri(sampler2D tex,vec3 p,vec3 n,float scale){vec3 an=pow(abs(n),vec3(4.));an/=max(an.x+an.y+an.z,.0001);vec3 tx=texture(tex,p.yz*scale).rgb;vec3 ty=texture(tex,p.xz*scale).rgb;vec3 tz=texture(tex,p.xy*scale).rgb;return tx*an.x+ty*an.y+tz*an.z;}
vec3 groundBase(vec2 world){vec2 pixels=vec2(textureSize(u_groundTex,0));if(u_groundMirror>.5){vec2 uv=world*u_groundPixelsPerMeter/pixels;return texture(u_groundTex,1.-abs(mod(uv,2.)-1.)).rgb;}return texture(u_groundTex,world*u_groundPixelsPerMeter/pixels).rgb;}
// Dedicated tileable rock albedo with regular world-space repetition.
// Both vertical projections keep sediment layers horizontal; the foot blends into local soil.
vec3 rockSurface(vec3 n){
 vec3 p=v_pos*u_rockScale;
 vec3 weights=pow(abs(n),vec3(4.));weights/=max(weights.x+weights.y+weights.z,.0001);
 vec3 stone=texture(u_rockTex,p.zy).rgb*weights.x+texture(u_rockTex,p.xz).rgb*weights.y+texture(u_rockTex,p.xy).rgb*weights.z;
 stone=mix(stone,v_col.rgb,.18);
 return mix(groundBase(v_pos.xz),stone,smoothstep(-.1,1.8,v_pos.y));
}
${Object.entries(GROUND_DECOR_ATLAS).map(([name, rects]) =>
  `const vec4 ${name}Rects[${rects.length}]=vec4[${rects.length}](${rects.map(r => `vec4(${r.map(v => v + '.').join(',')})`).join(',')});`
).join('\n')}
// Integer world-cell hash: stable through camera motion, independent of simulation RNG/time.
vec4 decorRandom(vec2 cell,uint salt){
 uvec2 c=uvec2(ivec2(cell));
 uvec4 h=uvec4(c.x*1597334677u^c.y*3812015801u^u_decorSeed^salt)
           ^uvec4(0u,2246822519u,3266489917u,668265263u);
 h^=h>>16u;h*=2246822519u;h^=h>>13u;h*=3266489917u;h^=h>>16u;
 return vec4(h>>8u)/16777216.;
}
vec4 groundDecor(sampler2D tex,vec2 world,bool shrubs){
 float spacing=shrubs?4.5:3.8;
 vec2 p=world/spacing,cell=floor(p);
 vec4 r=decorRandom(cell,shrubs?7919u:104729u);
 vec4 rect=shrubs?desertShrubsRects[int(r.z*${GROUND_DECOR_ATLAS.desertShrubs.length}.)]:rockClustersRects[int(r.z*${GROUND_DECOR_ATLAS.rockClusters.length}.)];
 vec2 pixels=rect.zw-rect.xy;
 vec2 span=pixels/max(pixels.x,pixels.y)*mix(.32,.46,r.w);
 vec2 local=(fract(p)-(.5+(r.xy-.5)*.46))/span+.5;
 // Derivatives come from continuous world coordinates, never from atlas/cell jumps.
 vec2 dx=dFdx(p)/span*pixels,dy=dFdy(p)/span*pixels;
 float lod=clamp(log2(max(max(length(dx),length(dy)),1.)),0.,1.);
 if(any(lessThan(local,vec2(0.)))||any(greaterThan(local,vec2(1.)))
    ||decorRandom(cell,shrubs?7927u:104743u).x>(shrubs?u_groundDecor.y:u_groundDecor.x))return vec4(0.);
 // Explicit crop + limited mip level prevent neighbouring variants bleeding into a stamp.
 vec2 uv=(rect.xy+clamp(local*pixels,vec2(.5),pixels-.5))/1254.;
 return textureLod(tex,uv,lod);
}
vec3 detail(vec3 base,vec3 tex,float amount){float d=luma(tex);vec3 toned=base*(.68+d*.78);return mix(base,toned*.92+tex*.08,amount);}
// Hue-preserving highlight shoulder before RGBA8 storage, not a new HDR/post pass.
vec3 finishLighting(vec3 color){
 float peak=max(max(color.r,color.g),color.b),over=max(peak-.65,0.);
 color*=(peak-over+over/(1.+over/.35))/max(peak,.0001);
 return mix(color,color*color*(3.-2.*color),.10);
}
// Smooth value noise and domain warping, evaluated only on the gate membrane.
// Fixed octave budget, no texture reads, particles, CPU geometry or simulation RNG.
float veilHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float veilNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(veilHash(i),veilHash(i+vec2(1,0)),f.x),mix(veilHash(i+vec2(0,1)),veilHash(i+vec2(1,1)),f.x),f.y);
}
float veilCloud(vec2 p){return veilNoise(p)*.57+veilNoise(p*2.03+7.1)*.29+veilNoise(p*4.07-3.4)*.14;}
vec3 veilSurface(vec2 p,float time){
 vec2 drift=vec2(time*.12,-time*.24);
 vec2 warp=vec2(veilCloud(p*1.35+drift),veilCloud(p*1.35-drift+9.7));
 float cloud=veilCloud(p*2.1+warp*2.8+drift);
 float fold=sin(p.y*6.5+p.x*2.4+warp.x*9.+cloud*7.-time*1.8);
 float threads=pow(.5+.5*fold,12.)*smoothstep(.3,.75,cloud);
 float edge=pow(clamp(abs(p.x)/1.12,0.,1.),5.);
 vec3 hue=v_col.rgb;
 return mix(hue*.16,hue*1.18,smoothstep(.16,.86,cloud))
       +mix(hue,vec3(.85,.66,1.),.45)*(threads*.95+edge*.22);
}
void main(){
 if(v_mat==${CONTACT_SHADOW_MATERIAL}.){
  float mask=1.-smoothstep(.05,1.,length(v_modelPos.xz*2.));
  float sight=texture(u_fog,(v_pos.xz+u_extent)/(u_extent*2.)).r;
  frag=vec4(.025,.035,.045,v_col.a*mask*mix(1.,smoothstep(.35,.8,sight),u_fogOn));return;
 }
 if(v_mat==${ALLOY_LIGHT_MATERIAL}.){
  float mask=1.-smoothstep(.02,.5,length(v_modelPos.xz));
  float sight=texture(u_fog,(v_pos.xz+u_extent)/(u_extent*2.)).r;
  float visible=mix(1.,smoothstep(.2,.8,sight),u_fogOn);
  frag=vec4(v_col.rgb*(1.08+mask*.38),v_col.a*mask*.16*visible);return;
 }
 if(v_mat==${ALIEN_LIGHT_MATERIAL}.){
  vec3 base=groundBase(v_pos.xz),n=vec3(0.,1.,0.),light=normalize(vec3(-64.,110.,43.));
  vec3 ambient=mix(u_bounce,u_skyLight,1.);float sh=shadow();
  vec3 lit=base*(ambient+u_sun*max(dot(n,light),0.)*sh)+v_col.rgb*(.32+v_glow*.2);
  lit=finishLighting(lit);
  float sight=texture(u_fog,(v_pos.xz+u_extent)/(u_extent*2.)).r;
  lit*=mix(1.,mix(.16,1.,sight),u_fogOn);
  float mist=1.-exp(-max(length(u_eye-v_pos)-75.,0.)*.0038);
  lit=mix(lit,u_haze,mist);
  float grain=fract(sin(dot(v_pos.xz,vec2(12.9898,78.233)))*43758.54);lit*=.965+grain*.055;
  frag=vec4(lit,v_col.a);return;
 }
 if(v_mat==${PORTAL_MATERIAL}.||v_mat==${PORTAL_STILL_MATERIAL}.){
  // Vertical gates use XY; horizontal flight wells use XZ without changing gate motion.
  vec2 veilUv=abs(v_modelN.y)>.7?v_modelPos.xz:v_modelPos.xy;
  vec3 lit=finishLighting(veilSurface(veilUv,v_mat==${PORTAL_MATERIAL}.?u_portalTime:0.));
  float sight=texture(u_fog,(v_pos.xz+u_extent)/(u_extent*2.)).r;
  lit*=mix(1.,mix(.16,1.,sight),u_fogOn);
  float mist=1.-exp(-max(length(u_eye-v_pos)-75.,0.)*.0038);
  frag=vec4(mix(lit,u_haze,mist),v_col.a);return;
 }
 vec3 n=normalize(v_n);vec3 base=v_col.rgb;
float metal=float(v_mat>1.5&&v_mat<2.5),bio=float(v_mat>2.5&&v_mat<3.5),crystal=float(v_mat>4.5&&v_mat<5.5);
if(u_rockScale>0.&&((v_mat>3.5&&v_mat<4.5&&v_glow<.2&&v_col.a>.96)||(v_mat>5.5&&v_mat<6.5))){base=rockSurface(n);}else if(v_mat>6.5){vec3 t=tri(u_bioTex,v_pos,n,.014);float grain=luma(tri(u_bioTex,v_pos,n,.045));base=detail(base,t,.85)*(.85+grain*.3);base=mix(base,groundBase(v_pos.xz),1.-smoothstep(.0,.9,v_pos.y));}else if(v_mat>5.5){vec3 t=tri(u_groundTex,v_pos,n,.16);float grain=luma(tri(u_groundTex,v_pos,n,.73));base=detail(base,t,.8)*(.92+.16*grain);vec3 soil=tri(u_groundTex,v_pos,n,.012);base=mix(base,mix(detail(v_col.rgb,soil,.74),soil,.32),(1.-smoothstep(.0,1.8,v_pos.y))*.85);}else if(v_mat<4.5&&v_glow<.2&&v_col.a>.96){if(v_mat>3.5){vec3 t=tri(u_groundTex,v_pos,n,.28);float strata=sin(v_pos.y*4.+luma(t)*2.5+sin(v_pos.x*.6+v_pos.z*.4)*.7);base=detail(base,t,.9)*(.88+.12*smoothstep(-.45,.45,strata));}else if(v_mat>2.5){vec3 t=tri(u_bioTex,v_modelPos,normalize(v_modelN),.17);base=mix(detail(base,t,.76),mix(base,t,.18),.35);}else if(v_mat>1.5){vec3 t=tri(u_metalTex,v_modelPos,normalize(v_modelN),.33);base=detail(base,t,.72);}else if(v_mat>.5||(v_pos.y<.22&&n.y>.66)){vec3 t=groundBase(v_pos.xz);base=t;vec4 rocks=groundDecor(u_rockClustersTex,v_pos.xz,false);base=mix(base,rocks.rgb,rocks.a*u_groundDecor.z);vec4 shrubs=groundDecor(u_desertShrubsTex,v_pos.xz,true);base=mix(base,shrubs.rgb,shrubs.a*u_groundDecor.w);}}
// Local-normal variation restores readable facets; a restrained static caustic suggests internal depth.
if(crystal>.5){
 vec3 localN=normalize(v_modelN);
 float facet=.58+.42*abs(dot(localN,normalize(vec3(.37,.81,.45))));
 float caustic=pow(.5+.5*sin(dot(v_modelPos,vec3(5.1,7.3,3.7))),10.);
 base=mix(base*facet,mix(base,vec3(.88,.95,1.),.48),caustic*.2);
}
vec3 light=normalize(vec3(-64.,110.,43.));float nd=max(dot(n,light),0.);float sh=shadow();
vec3 ambient=mix(u_bounce,u_skyLight,n.y*.5+.5);
vec3 lit=base*(ambient+u_sun*nd*sh),viewDir=normalize(u_eye-v_pos);
// Painted metal, soft organic gloss and crystals share the existing material IDs.
float exponent=8.+metal*36.+bio*6.+crystal*56.;
float strength=.008+metal*.37+bio*.15+crystal*.45;
float spec=pow(max(dot(n,normalize(light+viewDir)),0.),exponent)*strength*sh;
vec3 specColor=mix(vec3(1.),mix(vec3(.85,.92,1.),base,.25),metal);
lit+=spec*u_sun*specColor;
float edge=1.-max(dot(n,viewDir),0.),fresnel=edge*edge*edge*edge*edge;
vec3 environment=mix(u_bounce,u_skyLight,clamp(reflect(-viewDir,n).y*.5+.5,0.,1.));
lit+=environment*((.07+fresnel*.22)*metal+(.025+fresnel*.05)*bio+fresnel*.42*crystal);
// Crystal glow preserves directional shading instead of flattening every face to one color.
float glowMix=clamp(v_glow,0.,1.)*(1.-crystal*.58);
lit=mix(lit,base*1.35,glowMix);lit+=base*max(v_glow-1.,0.)*.38;
lit+=crystal*vec3(.72,.88,1.)*fresnel*fresnel*.16;
lit=finishLighting(lit);
float field=texture(u_fog,(v_pos.xz+u_extent)/(u_extent*2.)).r;float fow=mix(1.,mix(.16,1.,field),u_fogOn);lit*=fow;float dist=length(u_eye-v_pos);float mist=1.-exp(-max(dist-75.,0.)*.0038);lit=mix(lit,u_haze,mist);if(v_pos.y<.0){float grain=fract(sin(dot(v_pos.xz,vec2(12.9898,78.233)))*43758.54);lit*=.965+grain*.055;}frag=vec4(lit,v_col.a);}`;
    const DEPTHV = `#version 300 es
precision highp float;layout(location=0)in vec3 a_pos;layout(location=2)in mat4 a_model;uniform mat4 u_vp;void main(){gl_Position=u_vp*a_model*vec4(a_pos,1.);}`;
    const DEPTHF = `#version 300 es
precision highp float;void main(){}`;
    const FULLV = `#version 300 es
out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
    const SKYF = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;uniform vec2 u_size;uniform sampler2D u_skyTex;
void main(){
 // Cover the viewport without stretching; image uploads have their origin at the top.
 vec2 imageSize=vec2(textureSize(u_skyTex,0));
 float imageAspect=imageSize.x/imageSize.y,screenAspect=u_size.x/u_size.y;
 vec2 scale=vec2(min(1.,screenAspect/imageAspect),min(1.,imageAspect/screenAspect));
 vec2 skyUV=(vec2(uv.x,1.-uv.y)-.5)*scale+.5;
 frag=vec4(texture(u_skyTex,skyUV).rgb,1.);
}`;
    const BLOOMF = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;uniform sampler2D u_tex;uniform vec2 u_step;uniform bool u_extract;
vec3 bright(vec2 p){
 vec3 c=texture(u_tex,p).rgb;
 float peak=max(max(c.r,c.g),c.b),lum=dot(c,vec3(.2126,.7152,.0722));
 return c*smoothstep(.76,.90,peak)*smoothstep(.48,.74,lum);
}
void main(){
 vec3 c;
 if(u_extract){
  // Threshold before averaging: small lamps survive the quarter-size reduction.
  c=(bright(uv+u_step)+bright(uv-u_step)+bright(uv+vec2(u_step.x,-u_step.y))+bright(uv+vec2(-u_step.x,u_step.y)))*.25;
 }else{
  c=texture(u_tex,uv).rgb*.227027;
  c+=(texture(u_tex,uv+u_step*1.384615).rgb+texture(u_tex,uv-u_step*1.384615).rgb)*.316216;
  c+=(texture(u_tex,uv+u_step*3.230769).rgb+texture(u_tex,uv-u_step*3.230769).rgb)*.070270;
 }
 frag=vec4(c,1.);
}`;
    const POSTF = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;uniform sampler2D u_tex;uniform vec2 u_size;uniform float u_time;uniform float u_quality;uniform sampler2D u_bloom;uniform float u_bloomOn;
// Screen-space tilt-shift approximation: wide sharp band, at most eight extra taps.
// Radius follows the shorter render dimension, keeping the look stable across DPR.
vec3 tiltShift(vec3 sharp,vec2 px){
 float amount=smoothstep(.20,.48,abs(uv.y-.5));
 if(amount<=0.)return sharp;
 vec2 d=px*(min(u_size.x,u_size.y)*.006*amount);
 vec3 blurred=sharp*4.;
 blurred+=(texture(u_tex,uv+vec2(d.x,0.)).rgb+texture(u_tex,uv-vec2(d.x,0.)).rgb
          +texture(u_tex,uv+vec2(0.,d.y)).rgb+texture(u_tex,uv-vec2(0.,d.y)).rgb)*2.;
 blurred+=texture(u_tex,uv+d).rgb+texture(u_tex,uv-d).rgb
         +texture(u_tex,uv+vec2(d.x,-d.y)).rgb+texture(u_tex,uv+vec2(-d.x,d.y)).rgb;
 return blurred/16.;
}
void main(){vec2 px=1./u_size;vec3 c=texture(u_tex,uv).rgb;if(u_quality>1.5)c=tiltShift(c,px);if(u_bloomOn>.5)c+=texture(u_bloom,uv).rgb*.65*(1.-c);float vignette=1.-smoothstep(.25,.85,length((uv-.5)*vec2(1.,.8)))*.20;float grain=(fract(sin(dot(uv*u_size+u_time,vec2(12.9898,78.233)))*43758.5453)-.5)/260.;c=pow(max(c*vignette+grain,0.),vec3(.96));frag=vec4(c,1.);}`;
