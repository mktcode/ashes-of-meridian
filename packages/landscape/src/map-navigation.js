// Geometry validation from STRATA; no generator or navigation solver.
export const MAX_SLOPE=35,MAX_HEIGHT_SCALE=1.8;
const CORRIDOR_PADDING=4,CORRIDOR_SHOULDER=24,WIDTH=520,LENGTH=640;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createCorridorIndex(routes,width) {
  const radius=width/2,core=radius+CORRIDOR_PADDING;
  const reach=core+CORRIDOR_SHOULDER,cell=32,cols=Math.ceil(WIDTH/cell),rows=Math.ceil(LENGTH/cell);
  const buckets=Array.from({length:cols*rows},()=>[]),segments=[];
  for(const route of routes)for(let i=1;i<route.points.length;i++) {
    const a=route.points[i-1],b=route.points[i],dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
    if(length2<1e-12)continue;
    const segment={x:a.x,y:a.y,dx,dy,length2};segments.push(segment);
    const x0=clamp(Math.floor((Math.min(a.x,b.x)-reach+WIDTH/2)/cell),0,cols-1);
    const x1=clamp(Math.floor((Math.max(a.x,b.x)+reach+WIDTH/2)/cell),0,cols-1);
    const y0=clamp(Math.floor((Math.min(a.y,b.y)-reach+LENGTH/2)/cell),0,rows-1);
    const y1=clamp(Math.floor((Math.max(a.y,b.y)+reach+LENGTH/2)/cell),0,rows-1);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)buckets[y*cols+x].push(segment);
  }
  if(!segments.length)throw Error('Wegenetz fehlt.');
  function distance(x,y) {
    const bx=clamp(Math.floor((x+WIDTH/2)/cell),0,cols-1),by=clamp(Math.floor((y+LENGTH/2)/cell),0,rows-1);
    let nearest=reach*reach;
    for(const s of buckets[by*cols+bx]) {
      const t=clamp(((x-s.x)*s.dx+(y-s.y)*s.dy)/s.length2,0,1);
      nearest=Math.min(nearest,(x-s.x-t*s.dx)**2+(y-s.y-t*s.dy)**2);
    }
    return Math.sqrt(nearest);
  }
  return {radius,core,reach,distance};
}
export function cellGrade(heights,nx,ny,i,j) {
  const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1,dx=WIDTH/nx,dy=LENGTH/ny;
  return Math.max(Math.hypot((heights[b]-heights[a])/dx,(heights[c]-heights[a])/dy),
    Math.hypot((heights[d]-heights[c])/dx,(heights[d]-heights[b])/dy));
}
