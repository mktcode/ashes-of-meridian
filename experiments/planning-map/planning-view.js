'use strict';
// Read-only 2D presentation of the planning recipe.
function polygonPath(ctx, points) {
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
}
function linePath(ctx, points) {
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  });
}
function drawNetwork(ctx, plan, filled, showDual) {
  const scale = PIXELS / SIZE;
  ctx.save();
  ctx.scale(scale, scale);
  polygonPath(ctx, plan.border);
  ctx.fillStyle = '#303548';
  ctx.fill();
  ctx.strokeStyle = '#99afc4';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();
  // Potential connections are diagnostic only, not a permanent grid overlay.
  if (showDual) {
    ctx.strokeStyle = '#475064';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < plan.regions.length; i++)
      for (let j = i + 1; j < plan.regions.length; j++) {
        const a = plan.regions[i],
          b = plan.regions[j];
        if (!latticeNeighbor(a, b)) continue;
        linePath(ctx, curvePath(plan, [a, b]));
        ctx.stroke();
      }
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const e of plan.edges) {
    ctx.fillStyle = ctx.strokeStyle = e.loop ? '#bc99ff' : '#dce7ba';
    if (filled) {
      polygonPath(ctx, e.outline);
      ctx.fill();
    } else {
      ctx.lineWidth = 1.5;
      linePath(ctx, e.points);
      ctx.stroke();
    }
  }
  if (showDual) {
    ctx.strokeStyle = '#618299';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([2, 2]);
    for (const e of plan.river.dual.links) {
      linePath(ctx, e.points);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.fillStyle = '#39adf0';
  for (const outline of plan.river.outlines) {
    polygonPath(ctx, outline);
    ctx.fill();
  }
  ctx.strokeStyle = '#d4f2ff';
  ctx.lineWidth = 0.7;
  for (const points of plan.river.curves)
    for (let i = 12; i < points.length; i += 26) {
      const a = points[i - 1],
        b = points[i],
        length = distance(a, b),
        ux = (b.x - a.x) / length,
        uy = (b.y - a.y) / length;
      ctx.beginPath();
      ctx.moveTo(b.x - ux * 3 - uy * 2, b.y - uy * 3 + ux * 2);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x - ux * 3 + uy * 2, b.y - uy * 3 - ux * 2);
      ctx.stroke();
    }
  for (const b of plan.river.bridges) {
    ctx.save();
    polygonPath(ctx, b.outline);
    ctx.clip();
    ctx.fillStyle = '#d99b58';
    for (const outline of plan.river.bridgeOutlines) {
      polygonPath(ctx, outline);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const [i, r] of plan.regions.entries()) {
    polygonPath(ctx, r.outline);
    if (filled) {
      ctx.fillStyle = '#77ddb0';
      ctx.fill();
    } else {
      ctx.strokeStyle = '#77ddb0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = filled ? '#13281f' : '#ffffff';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const center = warpPoint(plan, r);
    ctx.fillText(String(i + 1), center.x, center.y - 4);
    ctx.font = '7px system-ui';
    ctx.fillText(`${r.offset >= 0 ? '+' : ''}${r.offset.toFixed(1)}`, center.x, center.y + 6);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px system-ui';
  const source = warpPoint(plan, plan.river.source);
  ctx.fillText('S', source.x, source.y);
  for (const exit of plan.river.exits) {
    const p = warpPoint(plan, exit);
    ctx.fillText('A', p.x, p.y);
  }
  ctx.restore();
}
