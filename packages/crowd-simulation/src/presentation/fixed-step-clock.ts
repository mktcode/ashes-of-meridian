import { fixedDelta } from '../constants.js';
export { fixedDelta };

export function createFixedStepClock(maxCatchUp = 0.25) {
  if (!Number.isFinite(maxCatchUp) || maxCatchUp < fixedDelta)
    throw new RangeError('Invalid catch-up limit');
  let accumulator = 0;
  return Object.freeze({
    get alpha() {
      return Math.max(0, Math.min(1, accumulator / fixedDelta));
    },
    advance(simulationSeconds: number, step: () => void): number {
      if (!(simulationSeconds > 0) || !Number.isFinite(simulationSeconds)) return 0;
      accumulator += Math.min(simulationSeconds, maxCatchUp);
      let ticks = 0;
      while (accumulator >= fixedDelta - 1e-10) {
        step();
        accumulator -= fixedDelta;
        ticks++;
      }
      return ticks;
    },
  });
}
