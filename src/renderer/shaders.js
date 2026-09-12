    /* WebGL shader sources. */
    'use strict';
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
v_modelN=a_normal/textureScale;
vec3 normal=a_normal;if(a_material>3.5)normal/=vec3(dot(a_model[0].xyz,a_model[0].xyz),dot(a_model[1].xyz,a_model[1].xyz),dot(a_model[2].xyz,a_model[2].xyz));v_n=normalize(mat3(a_model)*normal);v_col=vec4(a_color.rgb*a_tint,a_color.a);v_glow=a_glow;v_shadow=u_light*p;v_mat=a_material;gl_Position=u_vp*p;}`;
    const FRAG = `#version 300 es
precision highp float;
in vec3 v_pos;in vec3 v_n;in vec4 v_col;in float v_glow;in vec4 v_shadow;flat in float v_mat;
in vec3 v_modelPos;in vec3 v_modelN;
uniform sampler2D u_shadow;uniform sampler2D u_fog;uniform sampler2D u_groundTex;uniform sampler2D u_terrainOverlayTex;uniform sampler2D u_rockClustersTex;uniform sampler2D u_desertShrubsTex;uniform sampler2D u_metalTex;uniform sampler2D u_bioTex;uniform vec3 u_eye;uniform vec3 u_haze;uniform float u_extent;uniform float u_shadowOn;uniform float u_fogOn;uniform float u_time;
out vec4 frag;
float shadow(){if(u_shadowOn<.5||v_glow>1.)return 1.;vec3 p=v_shadow.xyz/v_shadow.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;float bias=max(.00055*(1.-dot(normalize(v_n),normalize(vec3(-.55,.85,.35)))),.00022);float s=0.;vec2 texel=1./vec2(textureSize(u_shadow,0));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)s+=p.z-bias>texture(u_shadow,p.xy+vec2(x,y)*texel).r?.36:1.;return s/9.;}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 tri(sampler2D tex,vec3 p,vec3 n,float scale){vec3 an=pow(abs(n),vec3(4.));an/=max(an.x+an.y+an.z,.0001);vec3 tx=texture(tex,p.yz*scale).rgb;vec3 ty=texture(tex,p.xz*scale).rgb;vec3 tz=texture(tex,p.xy*scale).rgb;return tx*an.x+ty*an.y+tz*an.z;}
vec4 triAlpha(sampler2D tex,vec3 p,vec3 n,float scale){vec3 an=pow(abs(n),vec3(4.));an/=max(an.x+an.y+an.z,.0001);vec4 tx=texture(tex,p.yz*scale);vec4 ty=texture(tex,p.xz*scale);vec4 tz=texture(tex,p.xy*scale);return tx*an.x+ty*an.y+tz*an.z;}
vec3 detail(vec3 base,vec3 tex,float amount){float d=luma(tex);vec3 toned=base*(.68+d*.78);return mix(base,toned*.92+tex*.08,amount);}
void main(){vec3 n=normalize(v_n);vec3 base=v_col.rgb;if(v_mat<4.5&&v_glow<.2&&v_col.a>.96){if(v_mat>3.5){vec3 t=tri(u_groundTex,v_pos,n,.28);float strata=sin(v_pos.y*4.+luma(t)*2.5+sin(v_pos.x*.6+v_pos.z*.4)*.7);base=detail(base,t,.9)*(.88+.12*smoothstep(-.45,.45,strata));}else if(v_mat>2.5){vec3 t=tri(u_bioTex,v_modelPos,normalize(v_modelN),.17);base=mix(detail(base,t,.76),mix(base,t,.18),.35);}else if(v_mat>1.5){vec3 t=tri(u_metalTex,v_modelPos,normalize(v_modelN),.33);base=detail(base,t,.72);}else if(v_mat>.5||(v_pos.y<.22&&n.y>.66)){vec3 t=tri(u_groundTex,v_pos,n,.055);base=mix(detail(base,t,.74),t,.32);vec4 terrain=triAlpha(u_terrainOverlayTex,v_pos,n,.1);base=mix(base,detail(base,terrain.rgb,.78),terrain.a*.12);vec4 rocks=triAlpha(u_rockClustersTex,v_pos,n,.12);base=mix(base,rocks.rgb,rocks.a*.18);vec4 shrubs=triAlpha(u_desertShrubsTex,v_pos,n,.09);base=mix(base,shrubs.rgb,shrubs.a*.28);}}
vec3 light=normalize(vec3(-.55,.85,.35));float nd=max(dot(n,light),0.);float sh=shadow();vec3 ambient=mix(vec3(.17,.24,.28),vec3(.40,.52,.59),n.y*.5+.5);vec3 lit=base*(ambient+vec3(1.02,.82,.62)*nd*sh*.9);vec3 viewDir=normalize(u_eye-v_pos);float spec=pow(max(dot(n,normalize(light+viewDir)),0.),38.)*.10*sh;lit+=spec*vec3(.7,.9,1.);float rim=pow(1.-max(dot(n,viewDir),0.),3.)*.08;lit+=rim*vec3(.3,.55,.62);lit=mix(lit,base*1.35,clamp(v_glow,0.,1.));lit+=base*max(v_glow-1.,0.)*.38;float field=texture(u_fog,(v_pos.xz+u_extent)/(u_extent*2.)).r;float fow=mix(1.,mix(.16,1.,field),u_fogOn);lit*=fow;float dist=length(u_eye-v_pos);float mist=1.-exp(-max(dist-75.,0.)*.0038);lit=mix(lit,u_haze,mist);if(v_pos.y<.0){float grain=fract(sin(dot(v_pos.xz,vec2(12.9898,78.233)))*43758.54);lit*=.965+grain*.055;}frag=vec4(lit,v_col.a);}`;
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
    const POSTF = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;uniform sampler2D u_tex;uniform vec2 u_size;uniform float u_time;uniform float u_quality;
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
void main(){vec2 px=1./u_size;vec3 c=texture(u_tex,uv).rgb;if(u_quality>1.5)c=tiltShift(c,px);vec3 bloom=vec3(0.);if(u_quality>.5){for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 o=vec2(cos(a),sin(a))*px*5.;bloom+=max(texture(u_tex,uv+o).rgb-.68,0.);bloom+=max(texture(u_tex,uv+o*2.4).rgb-.72,0.)*.5;}c+=bloom*.055;}float vignette=1.-smoothstep(.25,.85,length((uv-.5)*vec2(1.,.8)))*.20;float grain=(fract(sin(dot(uv*u_size+u_time,vec2(12.9898,78.233)))*43758.5453)-.5)/260.;c=pow(max(c*vignette+grain,0.),vec3(.96));frag=vec4(c,1.);}`;
