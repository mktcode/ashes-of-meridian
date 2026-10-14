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
    part(`${side}Boot`, `${side}Shin`, [0, -0.36, 0.07], [0.23, 0.18, 0.36], dark, [0, -0.03, 0.03]);
    part(`${side}Arm`, 'chest', [sign * 0.36, 0.15, 0], [0.20, 0.30, 0.22], armor, [0, -0.12, 0]);
    part(`${side}Shoulder`, `${side}Arm`, [0, 0.015, 0], [0.29, 0.18, 0.29], trim);
    part(`${side}Forearm`, `${side}Arm`, [0, -0.28, 0], [0.17, 0.27, 0.19], dark, [0, -0.135, 0]);
    part(`${side}Hand`, `${side}Forearm`, [0, -0.29, 0], [0.18, 0.15, 0.19], dark);
  }

  function samplePose(time, runWeight) {
    const run = Math.max(0, Math.min(1, runWeight));
    const phase = time * Math.PI * 2 * 1.65;
    const breath = Math.sin(time * Math.PI * 2 * 0.65);
    const pose = {
      hips: { offset: [0, (1 - run) * breath * 0.008 + run * (0.025 + 0.035 * Math.cos(2 * phase)), 0], rotation: [0, 0, run * Math.sin(phase) * 0.035] },
      chest: { rotation: [run * 0.10, run * Math.sin(phase) * 0.08, (1 - run) * breath * 0.012] },
      helmet: { rotation: [Math.sin(time * 1.2) * 0.018 * (1 - run), 0, 0] },
    };
    for (const [side, sign] of [['left', 1], ['right', -1]]) {
      const swing = Math.sin(phase) * sign;
      pose[`${side}Thigh`] = { rotation: [run * swing * 0.72, 0, 0] };
      pose[`${side}Shin`] = { rotation: [-run * (0.18 + Math.max(0, swing) * 0.95), 0, 0] };
      pose[`${side}Boot`] = { rotation: [run * (0.12 - swing * 0.16), 0, 0] };
      pose[`${side}Arm`] = { rotation: [-run * swing * 0.60, 0, -sign * 0.10] };
      pose[`${side}Forearm`] = { rotation: [-(0.12 + run * 0.85), 0, 0] };
    }
    return pose;
  }
  return { parts, samplePose };
})();
