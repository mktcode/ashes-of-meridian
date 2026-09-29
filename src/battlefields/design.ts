/* CPU-only design composition. Neither atmosphere nor pinned terrain consumes encounter RNG. */
'use strict';
function battlefieldDesign(recipe: BattlefieldDefinition, name: string, design: BattlefieldDesign): BattlefieldDefinition {
  const seed = (value: number | undefined) => {
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 0xffffffff))
      throw Error('Design seeds must be unsigned 32-bit integers');
  };
  seed(design.terrainSeed); seed(design.atmosphere?.materialSeed);
  const hour = design.atmosphere?.timeOfDay;
  if (hour !== undefined && hour !== 'seeded' && (!Number.isFinite(hour) || hour < 0 || hour >= 24))
    throw Error('Design timeOfDay must be in [0, 24) or seeded');
  return { ...recipe, name, design: Object.freeze({ ...design,
    ...(design.atmosphere ? { atmosphere: Object.freeze({ ...design.atmosphere }) } : {}) }) };
}

function battlefieldAtmosphere(profile: BattlefieldRenderProfile, setting: BattlefieldDesign['atmosphere'], seed: number): BattlefieldRenderProfile {
  if (!setting) return profile; // Existing authored looks remain exact defaults.
  const hour = setting.timeOfDay === 'seeded' ? seeded(seed ^ 0x54494d45)() * 24 : setting.timeOfDay;
  if (!Number.isFinite(hour) || hour < 0 || hour >= 24) throw Error('Invalid battlefield timeOfDay');
  type Color = readonly [number, number, number];
  const night = { horizon: [.028,.047,.08], zenith: [.006,.012,.029], sun: [.28,.34,.50], sky: [.21,.27,.39], bounce: [.08,.10,.16] } as const,
    twilight = { horizon: [.68,.34,.23], zenith: [.12,.20,.34], sun: [.95,.50,.28], sky: [.25,.30,.44], bounce: [.17,.12,.10] } as const,
    day = { horizon: [.60,.69,.71], zenith: [.22,.42,.58], sun: [1.10,1.03,.88], sky: [.37,.46,.53], bounce: [.20,.23,.15] } as const,
    keys = [[0,night],[5,night],[7,twilight],[12,day],[16,day],[19,twilight],[21,night],[24,night]] as const;
  const index = keys.findIndex(([time]) => time > hour), [a, from] = keys[index-1], [b, to] = keys[index],
    t = (hour-a)/(b-a), blend = t*t*(3-2*t),
    mix = (x: Color, y: Color): Color => [0,1,2].map(i => x[i]+(y[i]-x[i])*blend) as [number,number,number],
    horizon = mix(from.horizon,to.horizon), zenith = mix(from.zenith,to.zenith);
  return { ...profile, atmosphere: { timeOfDay: hour, horizon, zenith },
    haze: horizon.map(v => v*.7) as [number,number,number],
    lighting: { sun: mix(from.sun,to.sun), sky: mix(from.sky,to.sky), bounce: mix(from.bounce,to.bounce) } };
}
