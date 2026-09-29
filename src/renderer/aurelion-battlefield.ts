/* GPU-only city adapter. No gameplay entities or simulation RNG are created here. */
'use strict';
function createAurelionBattlefieldMeshes(heightScale = 1) {
  const meshes = [
    ...createAurelionGeometry().map(mesh=>({...mesh,static:true,
      material:mesh.name==='aurelionScreens'?AURELION_SCREEN_MATERIAL:MAT.METAL})),
    {...createAurelionBackdrop(),glow:0,static:true,material:AURELION_BACKDROP_MATERIAL},
    ...createAurelionAircraft().map(mesh=>({...mesh,static:false,material:MAT.METAL})),
    ...createAurelionRelic()
  ];
  // Scale authored world scenery only. Aircraft stay rigid and follow scaled flight paths.
  if(heightScale!==1)for(const mesh of meshes)if(!mesh.name.startsWith('aurelionAir')) {
    for(let i=0;i<mesh.data.length;i+=9) {
      mesh.data[i+1]*=heightScale;
      const normal=V.norm([mesh.data[i+3],mesh.data[i+4]/heightScale,mesh.data[i+5]]);
      mesh.data[i+3]=normal[0];mesh.data[i+4]=normal[1];mesh.data[i+5]=normal[2];
    }
  }
  return meshes;
}

// Named scenery collections are generated once per world, not once per constituent mesh.
const TerrainScenery = { aurelion: createAurelionBattlefieldMeshes };

// Combat models do not receive the city shader's local deck illumination. Give
// them cool plaza fill and a restrained warm deck bounce, not brighter emission.
// Keep the city's night exposure, light direction and shadow passes unchanged.
const AURELION_ENTITY_LIGHTING: BattlefieldLighting = {
  sun:[.62,.70,.84],sky:[.43,.52,.64],bounce:[.30,.255,.22]
};

function createAurelionEnvironment(renderer: MeridianRenderer): BattlefieldEnvironment {
  const flights=createAurelionFlights(),atmosphere=new AurelionAtmosphere(renderer);
  let boundProgram: WebGLProgram | null=null;
  return {
    skyProg:atmosphere.skyProg,postProg:atmosphere.postProg,
    beginFrame(modelTime) {
      boundProgram=null;
      // Use the paused/scaled presentation clock, not a second simulation timer.
      drawAurelionFlights(renderer,flights,modelTime,renderer.battlefieldProfile.variation?.heightScale ?? 1);
      atmosphere.beginFrame();
    },
    drawSceneBatches(time,modelTime,map,matrix,excluded,included) {
      // City and traffic use city lighting. Relic, combat models and effects retain
      // standard materials/fog. Shadow batches never enter this scene-only hook.
      const city:RenderBatches={},entities:RenderBatches={};
      for (const [key,bucket] of Object.entries(map))
        (bucket.source.startsWith('aurelion')?city:entities)[key]=bucket;
      for (const [batches,program] of [[city,atmosphere.program],[entities,renderer.program]] as const) {
        if (!Object.values(batches).some(b=>b.n)) continue;
        if (boundProgram!==program) {
          renderer.bindSceneProgram(time,modelTime,program,program===renderer.program&&!renderer.battlefieldProfile.atmosphere?AURELION_ENTITY_LIGHTING:undefined);
          boundProgram=program;
        }
        renderer.drawBatches(batches,matrix,excluded,included);
      }
    },
    preparePost:()=>atmosphere.preparePost(),
    endFrame:()=>atmosphere.endFrame(),
    frameReady:()=>atmosphere.frameReady(),
    resize:()=>atmosphere.resize(),
    dispose:()=>atmosphere.dispose()
  };
}
BattlefieldEnvironments.aurelion=createAurelionEnvironment;
