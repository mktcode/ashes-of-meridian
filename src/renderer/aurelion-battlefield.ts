/* GPU-only city adapter. No gameplay entities or simulation RNG are created here. */
'use strict';
function createAurelionBattlefieldMeshes() {
  const globe:number[]=[],halo:number[]=[];
  ModelMesh.lobedShell(globe,{sx:1,sy:1,sz:1,lobes:4,depth:0,segments:64,rings:32});
  geom.tri(halo,[-1,0,-1],[-1,0,1],[1,0,1]);geom.tri(halo,[-1,0,-1],[1,0,1],[1,0,-1]);
  return [
    ...createAurelionGeometry().map(mesh=>({...mesh,static:true,
      material:mesh.name==='aurelionScreens'?AURELION_SCREEN_MATERIAL:MAT.METAL})),
    {...createAurelionBackdrop(),glow:0,static:true,material:AURELION_BACKDROP_MATERIAL},
    ...createAurelionAircraft().map(mesh=>({...mesh,static:false,material:MAT.METAL})),
    {name:'aurelionHologram',data:new Float32Array(globe),glow:2,static:false,material:AURELION_HOLOGRAM_MATERIAL},
    {name:'aurelionHalo',data:new Float32Array(halo),glow:1,static:false,material:AURELION_HALO_MATERIAL}
  ];
}

// Named scenery collections are generated once per world, not once per constituent mesh.
const TerrainScenery = { aurelion: createAurelionBattlefieldMeshes };

// Combat models do not receive the city shader's local deck illumination. Give
// them cool plaza fill and a restrained warm deck bounce, not brighter emission.
// Keep the city's night exposure, light direction and shadow passes unchanged.
const AURELION_ENTITY_LIGHTING: BattlefieldLighting = {
  sun:[.62,.70,.84],sky:[.43,.52,.64],bounce:[.30,.255,.22]
};

class AurelionBattleRenderer extends AurelionAtmosphereRenderer {
  private cityPrograms: Pick<MeridianRenderer,'program'|'skyProg'|'postProg'>;
  private flights=createAurelionFlights();
  private scenePass=false;
  private sceneTime=0;
  private modelTime=0;
  private boundProgram: WebGLProgram | null=null;
  constructor(canvas: HTMLCanvasElement) {
    super(canvas,true);
    this.cityPrograms={program:this.program,skyProg:this.skyProg,postProg:this.postProg};
    this.hazeStart=100;
  }
  override bindSceneProgram(time:number,modelTime:number,program=this.program) {
    this.scenePass=true;this.sceneTime=time;this.modelTime=modelTime;
    super.bindSceneProgram(time,modelTime,program);this.boundProgram=program;
    if (this.battlefieldProfile.scenery==='aurelion' && program===this.standardPrograms!.program) {
      const g=this.gl,lighting=AURELION_ENTITY_LIGHTING;
      g.uniform3fv(this.uniform(program,'u_sun'),lighting.sun);
      g.uniform3fv(this.uniform(program,'u_skyLight'),lighting.sky);
      g.uniform3fv(this.uniform(program,'u_bounce'),lighting.bounce);
    }
  }
  override drawBatches(map:RenderBatches,matrix?:Float32Array,excluded?:string|readonly string[],included?:string) {
    if (!this.scenePass || this.battlefieldProfile.scenery!=='aurelion') {
      super.drawBatches(map,matrix,excluded,included);return;
    }
    // Static city, moving traffic and hologram use the city's shader. Combat models,
    // resources, selection rings and ability effects retain their normal materials/fog.
    const city:RenderBatches={},entities:RenderBatches={};
    for (const [key,bucket] of Object.entries(map))
      (bucket.source.startsWith('aurelion')?city:entities)[key]=bucket;
    for (const [batches,program] of [[city,this.cityPrograms.program],[entities,this.standardPrograms!.program]] as const) {
      if (!Object.values(batches).some(b=>b.n)) continue;
      if (this.boundProgram!==program) this.bindSceneProgram(this.sceneTime,this.modelTime,program);
      super.drawBatches(batches,matrix,excluded,included);
    }
  }
  override render(time:number,modelTime=time) {
    this.scenePass=false;this.boundProgram=null;
    const city=this.battlefieldProfile.scenery==='aurelion';
    Object.assign(this,city?this.cityPrograms:this.standardPrograms);
    if (!city) {MeridianRenderer.prototype.render.call(this,time,modelTime);return;}
    // Use the already paused/scaled presentation clock, not a second simulation timer.
    drawAurelionFlights(this,this.flights,modelTime);
    this.add('aurelionHalo',0,.42,0,24,1,24,0xffffff,0,0,0,1,.4,'effects',AURELION_HALO_MATERIAL);
    this.add('aurelionHologram',0,15,0,10.08,10.08,10.08,0xffffff,modelTime*.06,.18,.08,2,.7,'effects',AURELION_HOLOGRAM_MATERIAL);
    super.render(time,modelTime);
  }
  override renderBloom() {
    if (this.battlefieldProfile.scenery!=='aurelion') {MeridianRenderer.prototype.renderBloom.call(this);return;}
    if (this.quality===0) {
      MeridianRenderer.prototype.renderBloom.call(this);
      const g=this.gl;g.useProgram(this.postProg);
      g.uniform1f(this.uniform(this.postProg,'u_depthOn'),0);g.uniform1f(this.uniform(this.postProg,'u_amount'),0);
      return;
    }
    super.renderBloom();
  }
}
