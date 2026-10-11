export function classifyGraphics(graphics) {
  const name = graphics.renderer;
  if (
    /swiftshader|llvmpipe|softpipe|lavapipe|swrast|software|basic render|\bwarp\b/i.test(
      name ?? graphics.maskedRenderer ?? '',
    )
  )
    return 'software';
  if (!name || /^(webkit webgl|webgl|angle)$/i.test(name)) return 'unknown';
  return 'hardware-reported';
}

export function validateMeasurement(measurement, report, expectedPaused) {
  const { range, startState: start, endState: end } = measurement,
    recording = report.recording;
  if (recording.stopped || report.gpu.status === 'context-lost')
    throw Error('Recording stopped unexpectedly');
  if (
    recording.frames.length !== range.throughFrameId - range.afterFrameId ||
    recording.interactions.events.length !== range.throughInteractionId - range.afterInteractionId
  )
    throw Error('Incomplete diagnostic window: ring overflow or interrupted callbacks');
  if (recording.summary.rendered < 2) throw Error('Not enough rendered frames in measurement');
  if (
    recording.interactions.events.some((e) => e.failed || e.hidden) ||
    report.samples?.some((s) => s.hidden)
  )
    throw Error('Failed or hidden input measurement');
  if (
    start.paused !== expectedPaused ||
    end.paused !== expectedPaused ||
    (expectedPaused ? end.time !== start.time : end.time <= start.time)
  )
    throw Error('Unexpected simulation progress/pause state');
  for (const key of ['width', 'height', 'quality', 'speed', 'armyCount'])
    if (start[key] !== end[key]) throw Error(`Measurement context changed: ${key}`);
  if (JSON.stringify(start.camera) !== JSON.stringify(end.camera))
    throw Error('Camera changed during measurement');
}
