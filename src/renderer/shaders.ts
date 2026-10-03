    /* WebGL shader sources. */
    'use strict';
    // Effect-only material; no texture or changes to the embedded material catalog.
    const CONTACT_SHADOW_MATERIAL = -1, PLACEMENT_GUIDE_MATERIAL = -9;
    // Dedicated procedural surfaces; the alloy pool makes deposits visibly illuminate the ground.
    const PORTAL_MATERIAL = -2, PORTAL_STILL_MATERIAL = -3, ALLOY_LIGHT_MATERIAL = -4,
      ALIEN_LIGHT_MATERIAL = -5, SNOWFLAKE_MATERIAL = -6, RAIN_STREAK_MATERIAL = -7, RAIN_SPLASH_MATERIAL = -8;
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
    // Identical displacement in scene and shadow passes; only cosmetic foliage moves.
    const ECOLOGY_WIND = `uniform vec2 u_wind;
vec4 ecologyPosition(mat4 model,vec3 position,float material){
 vec4 p=model*vec4(position,1.);
 if(material==${MAT.LEAF}.&&u_wind.x>0.){
  float phase=model[3].x*.13+model[3].z*.17+u_wind.y*1.4;
  float bend=clamp(position.y,0.,1.);
  p.x+=sin(phase+position.y)*u_wind.x*bend;
  p.z+=cos(phase*.83+position.y*.7)*u_wind.x*bend*.65;
 }return p;
}`;
    const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;layout(location=1) in vec3 a_normal;layout(location=8) in vec3 a_tint;
layout(location=2) in mat4 a_model;layout(location=6) in vec4 a_color;layout(location=7) in float a_glow;layout(location=9) in float a_material;
uniform mat4 u_vp;uniform mat4 u_light;uniform vec3 u_eye;
out vec3 v_pos;out vec3 v_n;out vec4 v_col;out float v_glow;out vec4 v_shadow;flat out float v_mat;
out vec3 v_modelPos;out vec3 v_modelN;out vec3 v_detail;
${ECOLOGY_WIND}
void main(){v_detail=a_tint;vec4 p=ecologyPosition(a_model,a_pos,a_material);v_pos=p.xyz;
// Scaled mesh-local coordinates keep detail density without world-space sliding.
vec3 textureScale=max(vec3(length(a_model[0].xyz),length(a_model[1].xyz),length(a_model[2].xyz)),vec3(.00001));
v_modelPos=a_pos*textureScale;
if(a_material==${RAIN_STREAK_MATERIAL}.){
 // Keep the long axis parallel to the flight, but turn the thin ribbon toward
 // the camera. A cylinder would have hard caps and a luminous, needle-like core.
 vec3 axis=a_model[2].xyz,side=cross(axis,u_eye-a_model[3].xyz);
 side/=max(length(side),.00001);
 p.xyz=a_model[3].xyz+side*a_pos.x*textureScale.x+axis*a_pos.z;
 v_pos=p.xyz;
}
if(a_material==${CONTACT_SHADOW_MATERIAL}.||a_material==${ALLOY_LIGHT_MATERIAL}.)v_modelPos=a_pos;
if(a_material==${SNOWFLAKE_MATERIAL}.||a_material==${RAIN_STREAK_MATERIAL}.||a_material==${RAIN_SPLASH_MATERIAL}.)v_modelPos=a_pos;
if(a_material==${PORTAL_MATERIAL}.||a_material==${PORTAL_STILL_MATERIAL}.)v_modelPos=a_pos;
v_modelN=a_normal/textureScale;
vec3 normal=a_normal;if(a_material>3.5)normal/=vec3(dot(a_model[0].xyz,a_model[0].xyz),dot(a_model[1].xyz,a_model[1].xyz),dot(a_model[2].xyz,a_model[2].xyz));v_n=normalize(mat3(a_model)*normal);v_col=vec4(a_color.rgb*a_tint,a_color.a);v_glow=a_glow;v_shadow=u_light*p;v_mat=a_material;gl_Position=u_vp*p;}`;
    const FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec3 v_pos;in vec3 v_n;in vec4 v_col;in float v_glow;in vec4 v_shadow;flat in float v_mat;
in vec3 v_modelPos;in vec3 v_modelN;in vec3 v_detail;
uniform sampler2D u_earthTex;uniform sampler2D u_barkTex;uniform sampler2D u_foliageTex;
uniform sampler2D u_shadow;uniform sampler2D u_fog;uniform sampler2D u_groundTex;uniform sampler2D u_rockClustersTex;uniform sampler2D u_desertShrubsTex;uniform sampler2D u_metalTex;uniform sampler2D u_bioTex;uniform vec3 u_eye;uniform vec3 u_haze;uniform float u_extent;uniform float u_shadowOn;uniform float u_fogOn;uniform float u_time;uniform highp uint u_decorSeed;uniform vec2 u_groundTile;uniform vec3 u_surfaceTint;uniform vec2 u_surfaceOffset;uniform vec4 u_surfaceRelief;uniform float u_reliefOn;uniform vec4 u_groundDecor;
uniform vec3 u_sun;uniform vec3 u_skyLight;uniform vec3 u_bounce;uniform float u_shadowBias;
uniform int u_pointLightCount;uniform vec4 u_pointLightPosition[8];uniform vec4 u_pointLightColor[8];
uniform sampler2D u_rockTex;uniform float u_rockScale;uniform float u_portalTime;uniform vec2 u_landscapeRelief;uniform float u_upland;
uniform float u_habitatOn;uniform vec4 u_ecology;uniform vec3 u_biomeDry;uniform vec3 u_biomeLush;uniform vec3 u_biomeSoil;uniform vec3 u_biomeStone;uniform float u_weatherTime;
out vec4 frag;
// Bounded shadowless diffuse lighting in the existing scene pass; no light textures/passes.
vec3 localLighting(vec3 position,vec3 normal){
 if(u_pointLightCount==0)return vec3(0.);
 vec3 result=vec3(0.);
 for(int i=0;i<8;i++){
  if(i>=u_pointLightCount)break;
  vec3 delta=u_pointLightPosition[i].xyz-position;
  float d2=dot(delta,delta),radius=u_pointLightPosition[i].w;
  if(d2>=radius*radius)continue;
  float edge=1.-d2/(radius*radius);
  float diffuse=max(dot(normal,delta*inversesqrt(max(d2,.0001))),0.);
  result+=u_pointLightColor[i].rgb*u_pointLightColor[i].a*diffuse*edge*edge/(1.+d2*.12);
 }
 // Do not brighten merely explored/unseen terrain across a sight boundary.
 if(u_fogOn>.5)result*=smoothstep(.75,1.,texture(u_fog,(position.xz+u_extent)/(u_extent*2.)).r);
 return result;
}
float shadow(){if(u_shadowOn<.5||v_glow>1.)return 1.;vec3 p=v_shadow.xyz/v_shadow.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;float bias=max(u_shadowBias*2.5*(1.-dot(normalize(v_n),normalize(vec3(-64.,110.,43.)))),u_shadowBias);float s=0.;vec2 texel=1./vec2(textureSize(u_shadow,0));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)s+=p.z-bias>texture(u_shadow,p.xy+vec2(x,y)*texel).r?.36:1.;return s/9.;}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 tri(sampler2D tex,vec3 p,vec3 n,float scale){vec3 an=pow(abs(n),vec3(4.));an/=max(an.x+an.y+an.z,.0001);vec3 tx=texture(tex,p.yz*scale).rgb;vec3 ty=texture(tex,p.xz*scale).rgb;vec3 tz=texture(tex,p.xy*scale).rgb;return tx*an.x+ty*an.y+tz*an.z;}
vec2 groundUV(vec2 world){return world/u_groundTile+u_surfaceOffset;}
vec3 groundBase(vec2 world){
 vec3 color=texture(u_groundTex,groundUV(world)).rgb;
 float region=sin(world.x*.047+u_surfaceOffset.x*6.28)*sin(world.y*.039+u_surfaceOffset.y*6.28);
 return color*u_surfaceTint*(1.+region*.08);
}
// Height occupies alpha only in baked opaque surfaces, never in foliage/decals.
float triHeight(sampler2D tex,vec3 p,vec3 n,float scale){
 vec3 w=pow(abs(n),vec3(4.));w/=max(w.x+w.y+w.z,.0001);
 return dot(vec3(texture(tex,p.yz*scale).a,texture(tex,p.xz*scale).a,texture(tex,p.xy*scale).a),w);
}
// Surface-gradient bump mapping needs no tangents, normal textures or new geometry.
// Derivatives refer to world position even when the height field uses model coordinates.
vec3 reliefNormal(vec3 n,float height){
 vec3 dx=dFdx(v_pos),dy=dFdy(v_pos),r1=cross(dy,n),r2=cross(n,dx);
 float det=dot(dx,r1);
 vec3 gradient=sign(det)*(dFdx(height)*r1+dFdy(height)*r2)/max(abs(det),.000001);
 // Bound grazing-angle gradients, including degenerate projected triangles.
 gradient/=max(1.,length(gradient)*2.);
 return normalize(n-gradient);
}
// Dedicated tileable rock albedo with regular world-space repetition.
// Both vertical projections keep sediment layers horizontal; the foot blends into local soil.
vec3 rockSurface(vec3 n){
 vec3 p=v_pos*u_rockScale;
 vec3 weights=pow(abs(n),vec3(4.));weights/=max(weights.x+weights.y+weights.z,.0001);
 vec3 stone=texture(u_rockTex,p.zy).rgb*weights.x+texture(u_rockTex,p.xz).rgb*weights.y+texture(u_rockTex,p.xy).rgb*weights.z;
 stone=mix(stone*u_surfaceTint,v_col.rgb,.18);
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
float habitat(vec2 p){
 float warp=sin(p.x*.017+p.y*.031+u_ecology.w)*9.;
 return clamp(.5+sin(p.x*.041+warp*.08+u_ecology.w)*.24+cos(p.y*.036-p.x*.015-u_ecology.w)*.23,0.,1.);
}
vec3 habitatGround(vec3 sampleColor,vec3 normal,float road){
 float zone=habitat(v_pos.xz),grain=veilNoise(v_pos.xz*.64),band=smoothstep(.27,.74,zone+(grain-.5)*.13);
 vec3 color=mix(u_biomeDry,u_biomeLush,band)*( .69+luma(sampleColor)*.95);
 // Deposited soil, exposed bedding and cold caps respond to geometry rather than another atlas.
 float exposed=1.-smoothstep(.63,.94,normal.y);
 color=mix(color,u_biomeStone*(.72+grain*.38),exposed*.8);
 color=mix(color,u_biomeSoil*(.86+grain*.28),smoothstep(.05,.9,road)*.84);
 if(u_ecology.x==3.){
  float frost=smoothstep(.6,.88,normal.y)*smoothstep(.45,.82,zone+v_pos.y*.012);
  color=mix(color,vec3(.78,.85,.88)*( .92+grain*.08),frost*.88);
 }
 if(u_ecology.x==4.){
  float veins=pow(1.-abs(sin(v_pos.x*.32+sin(v_pos.z*.21)*2.+zone*5.)),12.);
  color=mix(color,vec3(.41,.52,.57),veins*band*.20);
 }
 return color;
}
// Opt-in upland stone: bedding follows elevation; exposed faces bleach while
// upward shelves collect lichen. Pure shading, never GPU terrain displacement.
vec3 uplandStone(vec3 stone,vec3 n){
 float weather=veilNoise(v_pos.xz*.19),seam=sin(v_pos.y*1.1+weather*7.+v_pos.x*.06);
 float strata=smoothstep(-.75,.35,seam);
 stone=mix(stone*vec3(.92,.99,1.03),vec3(.59,.56,.43),.24);
 stone*=mix(.91,1.06,strata);
 float cap=smoothstep(.63,.94,n.y)*smoothstep(.28,.76,weather);
 return mix(stone,stone*vec3(.77,.91,.57),cap*.58);
}
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
 if(v_mat==${SNOWFLAKE_MATERIAL}.||v_mat==${RAIN_STREAK_MATERIAL}.||v_mat==${RAIN_SPLASH_MATERIAL}.){
  vec2 p=v_modelPos.xz*2.;float mask;
  if(v_mat==${RAIN_STREAK_MATERIAL}.){
   float tail=p.y*.5+.5;
   float width=mix(.68,.18,tail),aa=max(fwidth(p.x),.025);
   float core=1.-smoothstep(width-aa,width+aa,abs(p.x));
   mask=core*smoothstep(0.,.12,tail)*(1.-smoothstep(.15,1.,tail));
  }else if(v_mat==${RAIN_SPLASH_MATERIAL}.){
   float r=length(p),aa=max(fwidth(r),.035);
   float ring=1.-smoothstep(.055,.055+aa,abs(r-.66));
   // Broken, feathered impact arcs, not complete tactical selection rings.
   mask=ring*(.45+.55*smoothstep(-.35,.65,sin(p.x*17.+p.y*11.)));
  }else{
   // At game scale snow reads as small irregular tufts, not star-shaped icons.
   float turn=u_portalTime*.4+v_pos.x*.23+v_pos.z*.19;
   vec2 q=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p;
   float r=length(q*vec2(1.06,.92))+sin(q.x*8.+q.y*5.)*.035;
   mask=(1.-smoothstep(.12,.94,r))*(.78+.22*(1.-smoothstep(0.,.5,r)));
  }
  float sight=texture(u_fog,(v_pos.xz+u_extent)/(u_extent*2.)).r;
  float visible=mix(1.,smoothstep(.35,.8,sight),u_fogOn);
  float light=v_mat==${SNOWFLAKE_MATERIAL}.?.72+min(.28,dot(u_skyLight,vec3(.333))):.55+min(.35,dot(u_skyLight,vec3(.333)));
  frag=vec4(v_col.rgb*light,v_col.a*mask*visible);return;
 }
 if(v_mat==${PLACEMENT_GUIDE_MATERIAL}.){
  float sight=texture(u_fog,(v_pos.xz+u_extent)/(u_extent*2.)).r;
  // Fine world-anchored hologram lines; the interior contributes no color at all.
  vec2 cell=abs(fract(v_pos.xz/.75+.5)-.5)*.75;
  float pixel=max(fwidth(v_pos.x),fwidth(v_pos.z));
  float line=1.-smoothstep(.008,.018+min(pixel*.75,.04),min(cell.x,cell.y));
  frag=vec4(v_col.rgb,v_col.a*line*step(.75,sight)*clamp(max(v_col.r,max(v_col.g,v_col.b))*2.,0.,1.));return;
 }
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
 vec3 n=normalize(v_n);vec3 base=v_col.rgb;float surfaceAlpha=v_col.a;
float metal=float(v_mat>1.5&&v_mat<2.5),bio=float(v_mat>2.5&&v_mat<3.5),crystal=float(v_mat>4.5&&v_mat<5.5);
if(v_mat==${MAT.LANDSCAPE}.){
 vec2 uv=groundUV(v_pos.xz);
 vec2 warp=vec2(veilNoise(v_pos.xz*.12),veilNoise(v_pos.xz*.12+19.7))*.38;
 vec3 grass=mix(texture(u_groundTex,uv+warp).rgb,texture(u_groundTex,uv*1.371+3.76+warp).rgb,.42);
 grass*=u_surfaceTint*mix(.87,1.08,veilNoise(v_pos.xz*.075));
 vec3 stone=tri(u_rockTex,v_pos,n,u_rockScale);
 if(u_upland<.5){
 base=mix(grass,stone,clamp(v_detail.y+(1.-smoothstep(.60,.92,n.y))*.6,0.,1.));
 base=mix(base,texture(u_earthTex,v_pos.xz*.15).rgb,v_detail.x);
 float wet=clamp(-v_detail.z,0.,1.);
 float bankNoise=veilNoise(v_pos.xz*.63)+.35*veilNoise(v_pos.xz*2.7);
 float sediment=smoothstep(.02,.38,wet+(bankNoise-.6)*.38)*smoothstep(0.,.05,wet);
 vec3 earth=texture(u_earthTex,v_pos.xz*.23).rgb*vec3(.76,.78,.72);
 float gravel=smoothstep(.60,.78,veilNoise(v_pos.xz*5.7));
 vec3 bank=mix(earth,stone*.82,gravel*.55);
 base=mix(base,bank,sediment*.88);base*=1.-wet*.23;
 base=mix(base,vec3(.78,.82,.84),max(0.,v_detail.z));
 }else{
  float meadowMix=veilCloud(v_pos.xz*.042+u_surfaceOffset);
  grass*=mix(vec3(.63,.83,.70),vec3(1.08,.99,.63),smoothstep(.25,.78,meadowMix));
  float exposed=clamp((1.-smoothstep(.55,.94,n.y))*.92+v_detail.y*.22,0.,1.);
  base=mix(grass,uplandStone(stone,n),exposed);
  float edgeNoise=veilNoise(v_pos.xz*.8),trail=smoothstep(.05,.88,v_detail.x+(edgeNoise-.5)*.26);
  vec3 soil=texture(u_earthTex,v_pos.xz*.15).rgb*vec3(1.24,1.15,.91);
  base=mix(base,soil,trail*.87);
 }
 if(u_habitatOn>.5){
  vec3 habitatColor=habitatGround(grass,n,v_detail.x);
  // River-bed sediment is still controlled by the authored signed wetness weights.
  base=mix(habitatColor,base,clamp(-v_detail.z*2.,0.,1.));
 }
}else if(v_mat==${MAT.LEAF}.){
 base=v_col.rgb;n=gl_FrontFacing?n:-n;
}else if(v_mat==${MAT.MASONRY}.){
 base=tri(u_rockTex,v_pos,n,u_rockScale*2.)*v_col.rgb;
}else if(v_mat==${MAT.BARK}.){
 base=tri(u_barkTex,v_modelPos,normalize(v_modelN),.32);
 if(u_upland>.5)base=mix(base,vec3(.57,.55,.43),.55)*v_col.rgb;
}else if(v_mat==${MAT.FOLIAGE}.){
 vec4 leaf=texture(u_foliageTex,v_detail.xy);if(leaf.a<.3)discard;
 base=leaf.rgb*v_detail.z*1.18;n=gl_FrontFacing?n:-n;
 if(u_habitatOn>.5)base=mix(base,u_biomeLush*(.65+luma(base)),.42);
 if(u_ecology.x==3.)base=mix(base,vec3(.78,.85,.88),smoothstep(.15,.8,n.y)*.65);
}else if(v_mat==${MAT.WATER}.){
 float depth=max(0.,v_detail.x);
 vec2 flow=normalize(v_detail.yz+vec2(.0001)),q=v_pos.xz-flow*u_time*.48;
 float ripple=sin(dot(q,vec2(2.7,1.9))+sin(q.y*.71))*sin(dot(q,vec2(-1.3,3.1)));
 n=normalize(n+vec3(ripple*.032,0.,sin(q.x*3.7-q.y*2.3)*.026));
 float flecks=smoothstep(.66,.84,veilNoise(q*2.8));
 float shore=(1.-smoothstep(.08,.42,depth))*smoothstep(0.,.07,depth);
 float foam=flecks*(shore*.35+clamp((1.-v_n.y)*5.,0.,.55));
 base=mix(vec3(.20,.33,.26),vec3(.055,.19,.19),smoothstep(0.,2.1,depth));
 base=mix(base,vec3(.65,.73,.67),foam);
 surfaceAlpha=(.22+.54*(1.-exp(-depth*.9))+foam*.18)*smoothstep(0.,.16+veilNoise(v_pos.xz*.9)*.25,depth);
}else if(u_rockScale>0.&&((v_mat>3.5&&v_mat<4.5&&v_glow<.2&&v_col.a>.96)||(v_mat>5.5&&v_mat<6.5))){base=rockSurface(n);}else if(v_mat>6.5){vec3 t=tri(u_bioTex,v_pos,n,.014);float grain=luma(tri(u_bioTex,v_pos,n,.045));base=detail(base,t,.85)*(.85+grain*.3);base=mix(base,groundBase(v_pos.xz),1.-smoothstep(.0,.9,v_pos.y));}else if(v_mat>5.5){vec3 t=tri(u_groundTex,v_pos,n,.16);float grain=luma(tri(u_groundTex,v_pos,n,.73));base=detail(base,t,.8)*(.92+.16*grain);vec3 soil=tri(u_groundTex,v_pos,n,.012);base=mix(base,mix(detail(v_col.rgb,soil,.74),soil,.32),(1.-smoothstep(.0,1.8,v_pos.y))*.85);}else if(v_mat<4.5&&v_glow<.2&&v_col.a>.96){if(v_mat>3.5){vec3 t=tri(u_groundTex,v_pos,n,.28);float strata=sin(v_pos.y*4.+luma(t)*2.5+sin(v_pos.x*.6+v_pos.z*.4)*.7);base=detail(base,t,.9)*(.88+.12*smoothstep(-.45,.45,strata));}else if(v_mat>2.5){vec3 t=tri(u_bioTex,v_modelPos,normalize(v_modelN),.17);base=mix(detail(base,t,.76),mix(base,t,.18),.35);}else if(v_mat>1.5){vec3 t=tri(u_metalTex,v_modelPos,normalize(v_modelN),.33);base=detail(base,t,.72);}else if(v_mat>.5||(v_pos.y<.22&&n.y>.66)){vec3 t=groundBase(v_pos.xz);base=t;vec4 rocks=groundDecor(u_rockClustersTex,v_pos.xz,false);base=mix(base,rocks.rgb,rocks.a*u_groundDecor.z);vec4 shrubs=groundDecor(u_desertShrubsTex,v_pos.xz,true);base=mix(base,shrubs.rgb,shrubs.a*u_groundDecor.w);}}
if(u_upland>.5&&v_mat==${MAT.ROCK}.)base=uplandStone(base,n);
if(u_habitatOn>.5){
 if(v_mat==${MAT.GROUND}.)base=habitatGround(base,n,0.);
 if(v_mat==${MAT.ROCK}.||v_mat==${MAT.MASSIF}.||v_mat==${MAT.MASONRY}.){
  float strata=.83+.17*sin(v_pos.y*1.4+veilNoise(v_pos.xz*.17)*5.);
  base=mix(base,u_biomeStone*(.6+luma(base))*.86,.76)*strata;
  float growth=smoothstep(.65,.97,n.y)*smoothstep(.52,.8,habitat(v_pos.xz));
  base=mix(base,u_ecology.x==3.?vec3(.77,.83,.87):u_biomeLush,growth*.52);
 }
}
if(u_ecology.x>.5&&u_habitatOn<.5&&v_mat==${MAT.GROUND}.){
 float seam=max(pow(abs(sin(v_pos.x*.23)),24.),pow(abs(sin(v_pos.z*.31)),24.));
 float wear=veilNoise(v_pos.xz*.14+u_ecology.w);
 base=mix(base,u_biomeDry*(.65+luma(base)),.6)*(1.-seam*.2);
 base=mix(base,u_biomeLush,step(.91,wear)*.14);
 if(u_ecology.x==3.)base=mix(base,vec3(.74,.82,.86),smoothstep(.5,.86,wear)*.55);
}
// All surface detail remains cosmetic: never displace the CPU-authoritative ground.
// Performance omits the extra height sampling, retaining exactly the same albedo recipes.
if(u_reliefOn>.5&&v_glow<.2&&v_col.a>.96&&v_mat!=${MAT.FOLIAGE}.&&v_mat!=${MAT.WATER}.&&v_mat!=${MAT.LEAF}.){
 float h=0.;
 if(v_mat==${MAT.LANDSCAPE}.){
  float stone=u_upland>.5?clamp((1.-smoothstep(.55,.94,n.y))*.92+v_detail.y*.22,0.,1.):clamp(v_detail.y+(1.-smoothstep(.60,.92,n.y))*.6,0.,1.);
  vec2 uv=groundUV(v_pos.xz),warp=vec2(veilNoise(v_pos.xz*.12),veilNoise(v_pos.xz*.12+19.7))*.38;
  float grass=mix(texture(u_groundTex,uv+warp).a,texture(u_groundTex,uv*1.371+3.76+warp).a,.42);
  h=mix(grass*u_surfaceRelief.x,triHeight(u_rockTex,v_pos,n,u_rockScale)*u_surfaceRelief.y,stone);
  h=mix(h,texture(u_earthTex,v_pos.xz*.15).a*u_landscapeRelief.x,v_detail.x);
  h*=1.-clamp(v_detail.z,0.,1.);
 }else if(v_mat==${MAT.MASONRY}.)h=triHeight(u_rockTex,v_pos,n,u_rockScale*2.)*u_surfaceRelief.y;
 else if(v_mat==${MAT.BARK}.)h=triHeight(u_barkTex,v_modelPos,normalize(v_modelN),.32)*u_landscapeRelief.y;
 else if(v_mat==${MAT.ROCK}.||v_mat==${MAT.MASSIF}.){
  if(u_rockScale>0.){
   vec3 p=v_pos*u_rockScale,w=pow(abs(n),vec3(4.));w/=max(w.x+w.y+w.z,.0001);
   h=dot(vec3(texture(u_rockTex,p.zy).a,texture(u_rockTex,p.xz).a,texture(u_rockTex,p.xy).a),w)*u_surfaceRelief.y;
   h=mix(texture(u_groundTex,groundUV(v_pos.xz)).a*u_surfaceRelief.x,h,smoothstep(-.1,1.8,v_pos.y));
  }else h=triHeight(u_groundTex,v_pos,n,v_mat==${MAT.ROCK}.?.28:.16)*u_surfaceRelief.x;
 }
 else if(v_mat==${MAT.ALIEN}.)h=triHeight(u_bioTex,v_pos,n,.014)*u_surfaceRelief.w;
 else if(bio>.5)h=triHeight(u_bioTex,v_modelPos,normalize(v_modelN),.17)*u_surfaceRelief.w;
 else if(metal>.5)h=triHeight(u_metalTex,v_modelPos,normalize(v_modelN),.33)*u_surfaceRelief.z;
 else if(v_mat==${MAT.GROUND}.||(v_mat==${MAT.AUTO}.&&v_pos.y<.22&&n.y>.66))h=texture(u_groundTex,groundUV(v_pos.xz)).a*u_surfaceRelief.x;
 n=reliefNormal(n,h);
}
// Local-normal variation restores readable facets; a restrained static caustic suggests internal depth.
if(crystal>.5){
 vec3 localN=normalize(v_modelN);
 float facet=.58+.42*abs(dot(localN,normalize(vec3(.37,.81,.45))));
 float caustic=pow(.5+.5*sin(dot(v_modelPos,vec3(5.1,7.3,3.7))),10.);
 base=mix(base*facet,mix(base,vec3(.88,.95,1.),.48),caustic*.2);
}
vec3 light=normalize(vec3(-64.,110.,43.));float nd=max(dot(n,light),0.);float sh=shadow();
if(u_ecology.x>.5){
 float cloud=veilNoise(v_pos.xz*.025+vec2(u_weatherTime*.013,u_weatherTime*.009)+u_ecology.w);
 sh*=1.-smoothstep(1.-u_ecology.z,.94,cloud)*.22;
 // Wet surfaces catch light, but the effect never changes physics or unit statistics.
 if(u_ecology.y==2.&&v_glow<.2)base*=.88;
}
vec3 ambient=mix(u_bounce,u_skyLight,n.y*.5+.5);
vec3 lit=base*(ambient+u_sun*nd*sh),viewDir=normalize(u_eye-v_pos);
// Painted metal, soft organic gloss and crystals share the existing material IDs.
float exponent=8.+metal*36.+bio*6.+crystal*56.;
float strength=.008+metal*.37+bio*.15+crystal*.45;
if(u_ecology.x>.5&&u_ecology.y==2.){strength+=.12*max(n.y,0.);exponent+=26.;}
float spec=pow(max(dot(n,normalize(light+viewDir)),0.),exponent)*strength*sh;
vec3 specColor=mix(vec3(1.),mix(vec3(.85,.92,1.),base,.25),metal);
lit+=spec*u_sun*specColor;
if(v_mat==${MAT.LEAF}.)lit+=base*u_sun*(.12+.18*max(dot(-n,light),0.))*sh;
if(v_mat==${MAT.WATER}.){
 float reflection=.07+.55*pow(1.-max(dot(n,viewDir),0.),3.);
 lit=mix(lit,vec3(.43,.58,.64),reflection);
 lit+=u_sun*pow(max(dot(n,normalize(light+viewDir)),0.),180.)*.45*sh;
}
float edge=1.-max(dot(n,viewDir),0.),fresnel=edge*edge*edge*edge*edge;
vec3 environment=mix(u_bounce,u_skyLight,clamp(reflect(-viewDir,n).y*.5+.5,0.,1.));
lit+=environment*((.07+fresnel*.22)*metal+(.025+fresnel*.05)*bio+fresnel*.42*crystal);
// Crystal glow preserves directional shading instead of flattening every face to one color.
float glowMix=clamp(v_glow,0.,1.)*(1.-crystal*.58);
lit=mix(lit,base*1.35,glowMix);lit+=base*max(v_glow-1.,0.)*.38;
lit+=base*localLighting(v_pos,n)*(1.-clamp(v_glow,0.,1.));
lit+=crystal*vec3(.72,.88,1.)*fresnel*fresnel*.16;
lit=finishLighting(lit);
float field=texture(u_fog,(v_pos.xz+u_extent)/(u_extent*2.)).r;float fow=mix(1.,mix(.16,1.,field),u_fogOn);lit*=fow;float dist=length(u_eye-v_pos);float mist=1.-exp(-max(dist-75.,0.)*.0038);lit=mix(lit,u_haze,mist);if(v_pos.y<.0){float grain=fract(sin(dot(v_pos.xz,vec2(12.9898,78.233)))*43758.54);lit*=.965+grain*.055;}frag=vec4(lit,surfaceAlpha);}`;
    // A depth-inverted, unlit contour silhouette. Visibility is decided by the
    // caller per entity, never by the terrain fog under the occluding mountain.
    const OCCLUSIONV = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;layout(location=1) in vec3 a_normal;
layout(location=2) in mat4 a_model;layout(location=6) in vec4 a_color;
uniform mat4 u_vp;uniform vec3 u_eye;
out vec3 v_normal;out vec3 v_view;out vec3 v_color;
void main(){
 vec4 p=a_model*vec4(a_pos,1.);
 vec3 scale2=vec3(dot(a_model[0].xyz,a_model[0].xyz),dot(a_model[1].xyz,a_model[1].xyz),dot(a_model[2].xyz,a_model[2].xyz));
 v_normal=mat3(a_model)*(a_normal/max(scale2,vec3(.000001)));
 v_view=u_eye-p.xyz;v_color=a_color.rgb;
 gl_Position=u_vp*p;
 // Equal-depth foundations are not occluded. Avoid contact precision shimmer.
 gl_Position.z-=.00002*gl_Position.w;
}`;
    const OCCLUSIONF = `#version 300 es
precision highp float;
in vec3 v_normal;in vec3 v_view;in vec3 v_color;out vec4 fragColor;
void main(){
 float rim=1.-abs(dot(normalize(v_normal),normalize(v_view)));
 // A restrained interior keeps faceted/small models recognizable; stronger rims
 // read as contours without full-bright x-ray models or material texture work.
 float alpha=.13+.55*smoothstep(.25,.85,rim);
 fragColor=vec4(v_color,alpha);
}`;
    const DEPTHV = `#version 300 es
precision highp float;layout(location=0)in vec3 a_pos;layout(location=2)in mat4 a_model;
layout(location=8)in vec3 a_tint;layout(location=9)in float a_material;
out vec2 v_uv;flat out float v_mat;uniform mat4 u_vp;
${ECOLOGY_WIND}
void main(){v_uv=a_tint.xy;v_mat=a_material;gl_Position=u_vp*ecologyPosition(a_model,a_pos,a_material);}`;
    const DEPTHF = `#version 300 es
precision highp float;in vec2 v_uv;flat in float v_mat;uniform sampler2D u_foliageTex;
void main(){if(v_mat==${MAT.WATER}.)discard;if(v_mat==${MAT.FOLIAGE}.&&texture(u_foliageTex,v_uv).a<.3)discard;}`;
    const FULLV = `#version 300 es
out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
    const SKYF = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;uniform vec2 u_size;uniform sampler2D u_skyTex;uniform float u_daylight;
uniform float u_atmosphereOn;uniform vec3 u_atmosphereHorizon;uniform vec3 u_atmosphereZenith;
uniform vec4 u_ecology;uniform float u_weatherTime;uniform vec3 u_haze;
float skyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float skyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(skyHash(i),skyHash(i+vec2(1,0)),f.x),mix(skyHash(i+vec2(0,1)),skyHash(i+vec2(1,1)),f.x),f.y);}
void main(){
 if(u_ecology.x>.5){
  vec3 horizon=u_atmosphereOn>.5?u_atmosphereHorizon:mix(u_haze,vec3(.62,.63,.59),u_ecology.x==4.?.12:.58),
       zenith=u_atmosphereOn>.5?u_atmosphereZenith:(u_ecology.x==4.?vec3(.035,.045,.13):vec3(.23,.39,.50));
  vec2 p=vec2(uv.x*u_size.x/u_size.y,uv.y)*vec2(3.8,5.)+vec2(u_weatherTime*.006,0.)+u_ecology.w;
  float cloud=skyNoise(p)*.6+skyNoise(p*2.03+7.1)*.28+skyNoise(p*4.07)*.12;
  float mask=smoothstep(.78-u_ecology.z*.47,.92-u_ecology.z*.27,cloud);
  vec3 sky=mix(horizon,zenith,smoothstep(0.,1.,uv.y));
  sky=mix(sky,mix(horizon,vec3(.73,.77,.79),.26)*(.62+cloud*.46),mask*.82);
  frag=vec4(sky,1.);return;
 }
 if(u_atmosphereOn>.5){frag=vec4(mix(u_atmosphereHorizon,u_atmosphereZenith,smoothstep(0.,1.,uv.y)),1.);return;}
 if(u_daylight>.5){frag=vec4(mix(vec3(.60,.69,.71),vec3(.22,.42,.58),smoothstep(0.,1.,uv.y)),1.);return;}
 // Cover the viewport without stretching; image uploads have their origin at the top.
 vec2 imageSize=vec2(textureSize(u_skyTex,0));
 float imageAspect=imageSize.x/imageSize.y,screenAspect=u_size.x/u_size.y;
 vec2 scale=vec2(min(1.,screenAspect/imageAspect),min(1.,imageAspect/screenAspect));
 vec2 skyUV=(vec2(uv.x,1.-uv.y)-.5)*scale+.5;
 frag=vec4(texture(u_skyTex,skyUV).rgb,1.);
}`;
    const BLOOMF = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;uniform sampler2D u_tex;uniform vec2 u_step;uniform bool u_extract;uniform float u_lampPrefilter;
vec3 bright(vec2 p){
 vec3 c=texture(u_tex,p).rgb;
 float peak=max(max(c.r,c.g),c.b),lum=dot(c,vec3(.2126,.7152,.0722));
 return c*smoothstep(.76,.90,peak)*smoothstep(.48,.74,lum);
}
void main(){
 vec3 c;
 if(u_extract){
  // Threshold before averaging: small lamps survive the quarter-size reduction.
  if(u_lampPrefilter>.5){
   // Local lamps: cover every texel of the 4x4 footprint instead of missing thin trim
   // between four diagonal taps. A bounded peak floor preserves subpixel lamps.
   vec3 sum=vec3(0.),peak=vec3(0.);
   for(int y=0;y<4;y++)for(int x=0;x<4;x++){
    vec3 sampleColor=bright(uv+(vec2(float(x),float(y))-1.5)*u_step);
    sum+=sampleColor;peak=max(peak,sampleColor);
   }
   c=max(sum/16.,peak*.28);
  }else c=(bright(uv+u_step)+bright(uv-u_step)+bright(uv+vec2(u_step.x,-u_step.y))+bright(uv+vec2(-u_step.x,u_step.y)))*.25;
 }else{
  c=texture(u_tex,uv).rgb*.227027;
  c+=(texture(u_tex,uv+u_step*1.384615).rgb+texture(u_tex,uv-u_step*1.384615).rgb)*.316216;
  c+=(texture(u_tex,uv+u_step*3.230769).rgb+texture(u_tex,uv-u_step*3.230769).rgb)*.070270;
 }
 frag=vec4(c,1.);
}`;
    const POSTF = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;uniform sampler2D u_tex;uniform vec2 u_size;uniform float u_time;uniform float u_quality;uniform sampler2D u_bloom;uniform float u_bloomOn;uniform float u_bloomStrength;
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
void main(){vec2 px=1./u_size;vec3 c=texture(u_tex,uv).rgb;if(u_quality>1.5)c=tiltShift(c,px);if(u_bloomOn>.5)c+=texture(u_bloom,uv).rgb*u_bloomStrength*(1.-c);float vignette=1.-smoothstep(.25,.85,length((uv-.5)*vec2(1.,.8)))*.20;float grain=(fract(sin(dot(uv*u_size+u_time,vec2(12.9898,78.233)))*43758.5453)-.5)/260.;c=pow(max(c*vignette+grain,0.),vec3(.96));frag=vec4(c,1.);}`;
