/* View-owned build grid: equal-area annuli, bounded cold work, independent fades. */
'use strict';
const PLACEMENT_GUIDE_SAMPLE = 3;
interface PlacementGuideBounds { startX: number; startZ: number; endX: number; endZ: number }
interface PlacementGuideRing {
  tiles: number[];
  indices: number[];
  values: Float32Array;
  data: Float32Array;
  cursor: number;
  dirty: boolean;
  uploaded: boolean;
  revision: string;
  appearedAt: number;
}
class PlacementGuideRings {
  private readonly columns: number;
  private readonly samples: Float32Array;
  private readonly sampledAt: Uint32Array;
  private readonly heights: Float32Array;
  private readonly fineColumns: number;
  private readonly rings: PlacementGuideRing[];
  private readonly origin: Position;
  private frame = 0;
  private nextRing = 0;
  constructor(private renderer: MeridianRenderer, private world: Battlefield,
    readonly sampler: PlacementGuideSampler, private bounds: PlacementGuideBounds, center: Position) {
    const {startX,startZ,endX,endZ} = bounds, step = PLACEMENT_GUIDE_SAMPLE;
    this.columns = Math.round((endX-startX)/step)+1;
    const rows = Math.round((endZ-startZ)/step)+1;
    this.samples = new Float32Array(this.columns*rows);
    this.sampledAt = new Uint32Array(this.samples.length);
    this.fineColumns=(this.columns-1)*2+1;
    this.heights=new Float32Array(this.fineColumns*((rows-1)*2+1)).fill(NaN);
    this.origin = {x:(startX+endX)/2,z:(startZ+endZ)/2};
    // Equal increments of squared radius keep annulus area roughly constant:
    // a broad first disk, then progressively narrower rings. Cap GPU batches too.
    const radius2 = Math.max(...[startX,endX].flatMap(x => [startZ,endZ].map(z =>
      (x-center.x)**2+(z-center.z)**2))), areaStep = Math.max(1,radius2/12);
    const groups = Array.from({length:12}, () => [] as number[]);
    for (let j=0;j<rows-1;j++) for (let i=0;i<this.columns-1;i++) {
      const x=startX+i*step,z=startZ+j*step,
        farX=Math.max((x-center.x)**2,(x+step-center.x)**2),
        farZ=Math.max((z-center.z)**2,(z+step-center.z)**2);
      groups[Math.min(11,Math.floor((farX+farZ)/areaStep))].push(j*this.columns+i);
    }
    this.rings = groups.map(tiles => {
      const indices = [...new Set(tiles.flatMap(i => [i,i+1,i+this.columns,i+this.columns+1]))];
      return {tiles,indices,values:new Float32Array(indices.length).fill(NaN),
        data:new Float32Array(tiles.length*216),cursor:0,dirty:true,uploaded:false,revision:'',appearedAt:0};
    });
  }
  private read(index: number): boolean {
    if (this.sampledAt[index] === this.frame) return true;
    const step = PLACEMENT_GUIDE_SAMPLE,
      sample = this.sampler.sample({x:this.bounds.startX+(index%this.columns)*step,
        z:this.bounds.startZ+Math.floor(index/this.columns)*step});
    if (this.sampler.pending) return false; // Zero can also mean genuinely unseen terrain.
    this.samples[index] = sample;
    this.sampledAt[index] = this.frame;
    return true;
  }
  private tile(ring: PlacementGuideRing, tile: number, initialize: boolean) {
    const index=ring.tiles[tile], step=PLACEMENT_GUIDE_SAMPLE,
      column=index%this.columns,row=Math.floor(index/this.columns),
      x=this.bounds.startX+column*step,z=this.bounds.startZ+row*step,
      a=this.samples[index],b=this.samples[index+1],c=this.samples[index+this.columns],d=this.samples[index+this.columns+1];
    let offset=tile*216;
    const vertex=(i:number,j:number) => {
      const u=i/2,v=j/2,px=x+u*step,pz=z+v*step,
        visibility=(1-u)*(1-v)*Math.abs(a)+u*(1-v)*Math.abs(b)+(1-u)*v*Math.abs(c)+u*v*Math.abs(d),
        weight=visibility*Math.max(0,Math.min(1,(px-this.bounds.startX)/step,(this.bounds.endX-px)/step,
          (pz-this.bounds.startZ)/step,(this.bounds.endZ-pz)/step)),
        score=(1-u)*(1-v)*a+u*(1-v)*b+(1-u)*v*c+u*v*d,
        blend=visibility?Math.max(0,Math.min(1,(score/visibility+1)/2)):0;
      if (initialize) {
        const point=(row*2+j)*this.fineColumns+column*2+i;
        if (Number.isNaN(this.heights[point])) this.heights[point]=this.world.surface!.heightAt(px,pz)+.065;
        ring.data[offset]=px-this.origin.x;
        ring.data[offset+1]=this.heights[point];
        ring.data[offset+2]=pz-this.origin.z;
        ring.data[offset+4]=1;
      }
      ring.data[offset+6]=(.94-.52*blend)*weight;
      ring.data[offset+7]=(.38+.52*blend)*weight;
      ring.data[offset+8]=(.36+.49*blend)*weight;
      offset+=9;
    };
    for(let j=0;j<2;j++) for(let i=0;i<2;i++) {
      vertex(i,j);vertex(i,j+1);vertex(i+1,j+1);
      vertex(i,j);vertex(i+1,j+1);vertex(i+1,j);
    }
  }
  private validate(ring: PlacementGuideRing, revision: string, now: number, index: number) {
    // Re-read live rules before displaying a ring, including partially built rings
    // whose initial samples may span several simulation/fog revisions.
    for(let i=0;i<ring.indices.length;i++) {
      if (!this.read(ring.indices[i])) return;
      const value=this.samples[ring.indices[i]];
      if (ring.values[i] !== value) { ring.values[i]=value; ring.dirty=true; }
    }
    if (ring.dirty) {
      if (!ring.uploaded && ring.values.every(value=>value===0)) {
        ring.dirty=false;ring.revision=revision;
        return; // An entirely unseen ring needs no GPU allocation or draw.
      }
      for(let tile=0;tile<ring.tiles.length;tile++) this.tile(ring,tile,false);
      this.renderer.streamGeometry(`placementGuide:${index}`,ring.data);
      if (!ring.uploaded) ring.appearedAt=now;
      ring.uploaded=true;ring.dirty=false;
    }
    ring.revision=revision;
  }
  draw(revision: string, now: number, reducedMotion: boolean) {
    this.frame++;
    const needsWork=this.nextRing<this.rings.length || this.rings.some(r => r.tiles.length && r.revision!==revision);
    if (needsWork) {
      // The deadline limits new terrain queries and mesh construction, not the
      // authoritative build action. Live checks on already visible rings remain fresh.
      const deadline=performance.now()+3;
      this.sampler.refresh(64,deadline);
      for(let i=0;i<this.nextRing;i++) {
        const ring=this.rings[i];
        if (ring.tiles.length && ring.revision!==revision) this.validate(ring,revision,now,i);
      }
      while(this.nextRing<this.rings.length && !this.rings[this.nextRing].tiles.length) this.nextRing++;
      if(this.nextRing<this.rings.length) {
        const ring=this.rings[this.nextRing];let built=0;
        // One completed annulus per renderframe also gives warm-cache reveals
        // a center-out sequence. Larger annuli can take several bounded slices.
        while(ring.cursor<ring.tiles.length && built<32) {
          if(built && performance.now()>=deadline) break;
          const index=ring.tiles[ring.cursor];
          if (![index,index+1,index+this.columns,index+this.columns+1].every(i=>this.read(i))) break;
          this.tile(ring,ring.cursor++,true);built++;
        }
        if(ring.cursor===ring.tiles.length) {
          this.validate(ring,revision,now,this.nextRing);
          if(ring.revision===revision) this.nextRing++;
        }
      }
    }
    for(let i=0;i<this.nextRing;i++) {
      const ring=this.rings[i];
      if(!ring.uploaded || ring.revision!==revision) continue;
      const t=reducedMotion?1:Math.max(0,Math.min(1,(now-ring.appearedAt)/180)),fade=t*t*(3-2*t);
      if(fade>0) this.renderer.add(`placementGuide:${i}`,this.origin.x,0,this.origin.z,1,1,1,
        0xffffff,0,0,0,0,.65*fade,'effects',PLACEMENT_GUIDE_MATERIAL);
    }
  }
  dispose() {
    for(let i=0;i<this.rings.length;i++) if(this.rings[i].uploaded) this.renderer.releaseGeometry(`placementGuide:${i}`);
  }
}
