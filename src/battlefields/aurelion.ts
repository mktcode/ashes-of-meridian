/* The crown district: four buildable precincts above a non-playable city. */
'use strict';
const AURELION_BATTLEFIELD: BattlefieldDefinition = {
  name:'AURELION', multiplayer:false,
  size:{extent:170,cellSize:2}, layout:aurelionLayout(),startHeight:AURELION_SECTOR_HEIGHT,
  palette:{ground:0x899396,rock:0x52616b,accent:0x83ccec,flora:0x25333f},
  render:{groundTexture:'metal',skyTexture:'sky',groundPixelsPerMeter:30,scenery:'aurelion',
    rockDecor:{density:0,opacity:0},shrubDecor:{density:0,opacity:0},haze:[.025,.04,.075],
    lighting:{sun:[.42,.52,.72],sky:[.085,.12,.19],bounce:[.016,.025,.045]},terrainReceiverHeight:40},
  worldEvent:null,
  generate(builder) {
    const w=builder.world,surface=w.surface=new BattlefieldSurface(w.extent,w.cellSize,aurelionFloor,
      height=>height>=4?1:0);
    surface.buildBlocked=new Uint8Array(w.staticGrid.length);
    for (let i=0;i<w.staticGrid.length;i++) {
      const p=w.point(i),margin=w.cellSize/2;
      // Whole cells must lie inside the physical deck/road. These permanent barriers also
      // participate in terrainFree, so recovery paths cannot cross voids with a temporary grid.
      if ([-margin,0,margin].some(dx=>[-margin,0,margin].some(dz=>!aurelionWalkable(p.x+dx,p.z+dz))))
        surface.cliffs[i]=1;
      // Roads, landings and the contested plaza stay open; foundations belong to the precincts.
      if (aurelionDeckInset(Math.abs(p.x),Math.abs(p.z))<5) surface.buildBlocked[i]=1;
    }
    w.staticGrid.set(surface.cliffs);w.terrainFeatureGrid.set(surface.cliffs);
    builder.ground();
    // The shared city meshes already contain decks, bridge slabs and the deep city foundation.
    // Do not draw the generic solid terrain box over the chasms.
    w.renderData.placements=[];w.renderData.scenery='aurelion';
    for (let i=0;i<w.staticGrid.length;i++) {
      const p=w.point(i),color=aurelionFloor(p.x,p.z)<-1?[12,20,32]:w.staticGrid[i]?[45,61,72]:[114,139,151];
      w.terrainColors.set([...color,255],i*4);
    }
  }
};
