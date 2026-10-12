/* Natural landforms only. Sampling happens once; height queries allocate nothing
 * and never draw randomness. Economic shoulders continue the explicit morphology cursor. */
'use strict';
type BattlefieldHeightField = (x: number, z: number) => number;
interface BattlefieldMorphology {
  readonly extent: number;
  readonly form: WorldReliefForm;
  readonly amplitude: number;
  readonly cs: number;
  readonly sn: number;
  readonly phase: number;
  readonly hills: readonly Readonly<{ x: number; z: number; radius: number; height: number }>[];
  readonly valley: Readonly<{ offset: number; bend: number; width: number; depth: number; phase: number }>;
  readonly ridge: Readonly<{ offset: number; width: number; height: number }>;
  readonly plateaus: readonly Readonly<{ x: number; z: number; rx: number; rz: number; height: number; phase: number }>[];
  readonly canyon: boolean;
}
interface BattlefieldNaturalTerrain {
  readonly datum: BattlefieldHeightField;
  readonly height: (x: number, z: number, grade?: number) => number;
}
function battlefieldSmooth(t: number): number {
  t = clamp(t, 0, 1); return t * t * (3 - 2 * t);
}
function sampleBattlefieldMorphology(seed: number, extent: number, recipe: BattlefieldTerrainRecipe,
    morphology: () => number): BattlefieldMorphology {
  const random = seeded(seed ^ 0x54455252),
    amplitude = (14 + random() * 12) * recipe.heightScale, angle = random() * Math.PI, phase = random() * Math.PI * 2,
    form = recipe.relief, cs = Math.cos(angle), sn = Math.sin(angle),
    hills = Object.freeze(Array.from({ length: 12 }, () => Object.freeze({ x: (random() - .5) * extent * 1.9,
      z: (random() - .5) * extent * 1.9, radius: 42 + random() * 38, height: 9 + random() * 17 }))),
    valley = Object.freeze({ offset: (morphology() - .5) * extent * .7, bend: 14 + morphology() * 22,
      width: 12 + morphology() * 12, depth: 12 + morphology() * 12, phase: morphology() * Math.PI * 2 }),
    ridge = Object.freeze({ offset: (morphology() - .5) * extent, width: 28 + morphology() * 20, height: 12 + morphology() * 12 }),
    macroRandom = seeded(seed ^ 0x504c4154),
    plateaus = Object.freeze(Array.from({ length: 4 }, () => Object.freeze({
      x: (macroRandom() - .5) * extent * 1.45, z: (macroRandom() - .5) * extent * 1.45,
      rx: 34 + macroRandom() * 25, rz: 30 + macroRandom() * 24,
      height: 22 + macroRandom() * 12, phase: macroRandom() * Math.PI * 2
    }))),
    canyon = form === 'basin' || form === 'broken-crater' || morphology() < .5;
  return Object.freeze({ extent, form, amplitude, cs, sn, phase, hills, valley, ridge, plateaus, canyon });
}
function battlefieldNaturalTerrain(plan: BattlefieldMorphology): BattlefieldNaturalTerrain {
  const { amplitude, cs, sn, phase, extent, form, hills, valley, ridge, plateaus, canyon } = plan,
    smooth = battlefieldSmooth,
    datum: BattlefieldHeightField = (x, z) => {
      let h = 18 + amplitude * (.5 + .22 * Math.sin((x * cs + z * sn) / 160 + phase) +
        .18 * Math.cos((z * cs - x * sn) / 185 - phase));
      for (const hill of hills) {
        const d = Math.hypot(x - hill.x, z - hill.z) / (hill.radius * 2.5);
        h += hill.height * .2 * Math.exp(-d * d);
      }
      return h;
    },
    height = (x: number, z: number, grade = datum(x, z)) => {
      const u = x * cs + z * sn, v = z * cs - x * sn;
      let h = grade;
      if (form === 'dunes') h += 5 * Math.sin(u / 34 + .6 * Math.sin(v / 75));
      if (form === 'basin' || form === 'broken-crater') h += 12 * smooth((Math.hypot(x, z) / extent - .3) / .55);
      if (form === 'ridges' || form === 'folds') {
        const d = (v - ridge.offset - 12 * Math.sin(u / 85 + phase)) / ridge.width;
        h += ridge.height * Math.exp(-d * d);
      }
      if (form === 'terraces') {
        let macro = 0;
        for (const m of plateaus) {
          const dx = (x - m.x) / m.rx, dz = (z - m.z) / m.rz,
            theta = Math.atan2(dz, dx), d = Math.hypot(dx, dz) + .08 * Math.sin(theta * 3 + m.phase),
            relief = 1 - smooth((d - .72) / .38);
          macro = Math.max(macro, m.height * relief);
        }
        return grade + macro;
      }
      let hillRelief = 0;
      for (const hill of hills) {
        const d = Math.hypot(x - hill.x, z - hill.z) / hill.radius,
          relief = hill.height * Math.exp(-d * d);
        hillRelief += relief ** 6;
      }
      h += Math.pow(hillRelief, 1 / 6);
      if (canyon) {
        const d = Math.abs(v - valley.offset - valley.bend * Math.sin(u / 85 + valley.phase));
        h -= valley.depth * (1 - smooth((d - valley.width) / 26));
      }
      return h;
    };
  return Object.freeze({ datum, height });
}
