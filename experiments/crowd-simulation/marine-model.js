'use strict';

// Y is up; the marine faces +Z. Geometry is built once, poses are sampled in seconds.
const MarineModel = (() => {
  const armor = [0.32, 0.43, 0.29];
  const dark = [0.10, 0.14, 0.15];
  const trim = [0.52, 0.60, 0.40];
  const parts = [];
  function part(name, parent, pivot, size, color, center = [0, 0, 0]) {
    parts.push({ name, parent, pivot, size, color, center });
  }
  part('hips', null, [0, 0.94, 0], [0.40, 0.20, 0.28], dark);
  part('chest', 'hips', [0, 0.26, 0], [0.58, 0.48, 0.34], armor);
  part('plate', 'chest', [0, 0.03, 0.19], [0.42, 0.28, 0.06], trim);
  part('pack', 'chest', [0, 0.04, -0.25], [0.36, 0.38, 0.18], dark);
  part('neck', 'chest', [0, 0.29, 0], [0.16, 0.12, 0.16], dark);
  part('helmet', 'neck', [0, 0.17, 0], [0.36, 0.32, 0.35], armor);
  part('visor', 'helmet', [0, 0.02, 0.18], [0.29, 0.10, 0.035], [0.20, 0.72, 0.83]);
  part('chin', 'helmet', [0, -0.12, 0.16], [0.25, 0.07, 0.10], dark);
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    part(`${side}Thigh`, 'hips', [sign * 0.14, -0.08, 0], [0.20, 0.38, 0.23], armor, [0, -0.19, 0]);
    part(`${side}Shin`, `${side}Thigh`, [0, -0.38, 0], [0.17, 0.36, 0.20], armor, [0, -0.18, 0]);
    part(`${side}Knee`, `${side}Shin`, [0, -0.015, 0.12], [0.20, 0.15, 0.08], trim);
    part(`${side}Boot`, `${side}Shin`, [0, -0.36, 0], [0.23, 0.18, 0.36], dark, [0, -0.03, 0.10]);
    part(`${side}Arm`, 'chest', [sign * 0.36, 0.15, 0], [0.20, 0.30, 0.22], armor, [0, -0.12, 0]);
    part(`${side}Shoulder`, `${side}Arm`, [0, 0.015, 0], [0.29, 0.18, 0.29], trim);
    part(`${side}Forearm`, `${side}Arm`, [0, -0.28, 0], [0.17, 0.27, 0.19], dark, [0, -0.135, 0]);
    part(`${side}Hand`, `${side}Forearm`, [0, -0.29, 0], [0.18, 0.15, 0.19], dark);
  }

  const runCycleDuration = 1 / 1.55;
  const stance = 0.38; // Short support phase leaves a flight phase between footfalls.
  const rigPart = name => parts.find(part => part.name === name);
  const thighLength = -rigPart('leftShin').pivot[1];
  const shinLength = -rigPart('leftBoot').pivot[1];
  const hipHeight = rigPart('hips').pivot[1] + rigPart('leftThigh').pivot[1];
  const boot = rigPart('leftBoot');
  const restAnkleHeight = hipHeight - thighLength - shinLength;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, weight) => a + (b - a) * weight;

  function footPath(cycle) {
    let z, lift, pitch;
    if (cycle < stance) {
      const t = cycle / stance;
      // A treadmill-style planted foot travels backwards, not forwards.
      z = mix(0.24, -0.25, t);
      lift = 0;
      pitch = mix(-0.10, 0.45, t * t * (3 - 2 * t));
    } else {
      const t = (cycle - stance) / (1 - stance);
      // Hermite tangents match stance velocity at toe-off and touchdown.
      const tangent = -0.49 / stance * (1 - stance);
      z = (2 * t ** 3 - 3 * t ** 2 + 1) * -0.25
        + (t ** 3 - 2 * t ** 2 + t) * tangent
        + (-2 * t ** 3 + 3 * t ** 2) * 0.24
        + (t ** 3 - t ** 2) * tangent;
      lift = 0.28 * Math.sin(Math.PI * t) ** 1.5;
      pitch = mix(0.45, -0.10, t * t * (3 - 2 * t)) - 0.15 * Math.sin(Math.PI * t) ** 2;
    }
    return { z, lift, pitch };
  }

  function samplePose(time, runWeight) {
    const run = clamp(runWeight, 0, 1);
    const cycle = ((time / runCycleDuration) % 1 + 1) % 1;
    const phase = cycle * Math.PI * 2;
    const breath = Math.sin(time * Math.PI * 2 * 0.65);
    const idleBob = breath * 0.008;
    const bob = mix(idleBob, -0.055 + 0.030 * Math.cos(2 * (phase - 0.44 * Math.PI * 2)), run);
    const pose = {
      hips: { offset: [0, bob, 0] },
      chest: { rotation: [run * 0.10, run * Math.sin(phase) * 0.055, (1 - run) * breath * 0.012 + run * Math.sin(phase) * 0.018] },
      helmet: { rotation: [Math.sin(time * 1.2) * 0.018 * (1 - run) - run * 0.07, 0, 0] },
    };
    for (const [side, sign, shift] of [['left', 1, 0], ['right', -1, 0.5]]) {
      const foot = footPath((cycle + shift) % 1);
      const pitch = run * foot.pitch;
      // Keep the lowest boot corner above the floor, including heel/toe roll.
      const flatSole = boot.size[1] / 2 - boot.center[1];
      const sole = Math.cos(pitch) * flatSole
        + Math.sin(pitch) * boot.center[2] + Math.abs(Math.sin(pitch)) * boot.size[2] / 2;
      const ankleY = mix(restAnkleHeight + idleBob, flatSole + 0.005 + foot.lift, run) + sole - flatSole;
      const y = ankleY - hipHeight - bob, z = run * foot.z;
      const distance = clamp(Math.hypot(y, z), 0.001, thighLength + shinLength);
      // The positive knee solution bends the heel back, never through the kneecap.
      const knee = Math.PI - Math.acos(clamp((thighLength ** 2 + shinLength ** 2 - distance ** 2) / (2 * thighLength * shinLength), -1, 1));
      const thigh = Math.atan2(-z, -y) - Math.acos(clamp((thighLength ** 2 + distance ** 2 - shinLength ** 2) / (2 * thighLength * distance), -1, 1));
      pose[`${side}Thigh`] = { rotation: [thigh, 0, 0] };
      pose[`${side}Shin`] = { rotation: [knee, 0, 0] };
      pose[`${side}Boot`] = { rotation: [pitch - thigh - knee, 0, 0] };
      pose[`${side}Arm`] = { rotation: [run * sign * Math.cos(phase) * 0.52, 0, -sign * 0.10] };
      pose[`${side}Forearm`] = { rotation: [-(0.12 + run * (0.85 - sign * Math.cos(phase) * 0.12)), 0, 0] };
    }
    return pose;
  }
  return { parts, samplePose, runCycleDuration };
})();
