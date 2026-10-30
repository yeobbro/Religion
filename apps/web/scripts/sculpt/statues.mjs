// Generates the sculpted corpus for the hanging crucifix and the Lourdes statue of Our Lady.
// Run: node scripts/sculpt/statues.mjs  (writes public/models/statues/*.raw.glb)
import { Sculpt, v, writeGlb } from './sdf.mjs';

const OUT = new URL('../../public/models/statues/', import.meta.url).pathname;
const res = Number(process.env.RES || 220);

/* ---------------------------------------------------------------- Corpus (Christ on the cross) */
// Local space: feet on the foot-rest at y=0, front +Z, figure ~1.78 m, arms along the beam.
{
  const body = new Sculpt();
  const K = 0.03;
  // Head inclined to the right shoulder and forward.
  const hc = v(0.055, 1.735, 0.06);
  const tilt = [0.38, 0.12, -0.34];
  body.ell(hc, v(0.08, 0.106, 0.094), tilt, K);
  body.ell(v(0.068, 1.675, 0.098), v(0.05, 0.05, 0.055), tilt, 0.03);           // jaw & chin
  body.ell(v(0.072, 1.72, 0.142), v(0.013, 0.034, 0.019), [0.6, 0.12, -0.34], 0.006); // nose
  body.ell(v(0.064, 1.762, 0.124), v(0.06, 0.016, 0.02), tilt, 0.015);            // brow ridge
  for (const s of [-1, 1]) {
    body.ell(v(0.055 + s * 0.072, 1.72, 0.05), v(0.014, 0.03, 0.02), tilt, 0.01);   // ears
    body.sub({ d: p => Math.hypot(p.x - (0.075 + s * 0.03), p.y - 1.738, p.z - 0.128) - 0.016, box: boxAround(v(0.075 + s * 0.03, 1.738, 0.128), 0.04), k: 0.012 }); // eye sockets
    body.ell(v(0.073 + s * 0.03, 1.735, 0.122), v(0.016, 0.009, 0.01), tilt, 0.006); // closed lids
  }
  // Neck with the strained tendons.
  body.cone(v(0, 1.5, 0), v(0.04, 1.665, 0.035), 0.058, 0.046, 0.04);
  for (const s of [-1, 1]) body.cone(v(0.03 * s, 1.52, 0.04), v(0.045 + s * 0.02, 1.65, 0.05), 0.012, 0.01, 0.02);
  // Thorax, pectorals, visible ribs, sunken abdomen.
  body.ell(v(0, 1.37, -0.005), v(0.16, 0.17, 0.105), [0.05, 0, 0], 0.05);
  for (const s of [-1, 1]) {
    body.ell(v(0.075 * s, 1.415, 0.06), v(0.085, 0.055, 0.04), [0, 0, s * 0.2], 0.03);
    for (let i = 0; i < 4; i += 1) {
      const y = 1.33 - i * 0.035;
      body.cone(v(0.05 * s, y + 0.015, 0.072), v(0.14 * s, y - 0.05, 0.02), 0.005, 0.004, 0.025);
    }
    body.ell(v(0.18 * s, 1.47, 0.0), v(0.065, 0.06, 0.06), [0, 0, 0], 0.035);      // deltoid
  }
  body.ell(v(0, 1.25, 0.005), v(0.14, 0.12, 0.09), [0, 0, 0], 0.07);
  body.ell(v(0, 1.13, 0.012), v(0.12, 0.11, 0.08), [0, 0, 0], 0.07);
  body.ell(v(0, 1.0, 0.0), v(0.145, 0.1, 0.095), [0, 0, 0], 0.05);                // pelvis
  // Arms raised along the beam, hands nailed, fingers curling.
  for (const s of [-1, 1]) {
    const sh = v(0.19 * s, 1.48, 0), el = v(0.52 * s, 1.74, -0.005), wr = v(0.85 * s, 1.95, -0.01);
    body.cone(sh, el, 0.052, 0.04, 0.035);
    body.ell(sh.clone().lerp(el, 0.45).add(v(0, 0.012, 0.012)), v(0.11, 0.04, 0.04), [0, 0, s * 0.63], 0.02); // biceps
    body.cone(el, wr, 0.041, 0.027, 0.025);
    body.ell(el.clone().lerp(wr, 0.25).add(v(0, 0.008, 0.008)), v(0.08, 0.034, 0.032), [0, 0, s * 0.56], 0.02); // forearm muscle
    const dir = wr.clone().sub(el).normalize();
    const palmC = wr.clone().add(dir.clone().multiplyScalar(0.05));
    body.ell(palmC, v(0.05, 0.042, 0.016), [0, 0, Math.atan2(dir.y, dir.x)], 0.015);
    for (let f = 0; f < 4; f += 1) {
      const base = palmC.clone().add(dir.clone().multiplyScalar(0.045)).add(v(0, (f - 1.5) * 0.017, 0.004));
      const mid = base.clone().add(dir.clone().multiplyScalar(0.032)).add(v(0, 0, 0.014));
      const tip = mid.clone().add(dir.clone().multiplyScalar(0.012)).add(v(0, -0.004, 0.026));
      body.cone(base, mid, 0.0085, 0.0075, 0.006);
      body.cone(mid, tip, 0.0075, 0.0062, 0.005);
    }
    body.cone(palmC.clone().add(v(0, 0.03, 0.005)), palmC.clone().add(dir.clone().multiplyScalar(0.035)).add(v(0, 0.045, 0.02)), 0.01, 0.008, 0.008); // thumb
  }
  // Legs: knees bent forward and turned, right foot over the left.
  const legs = [
    { hip: v(-0.085, 0.95, 0), knee: v(-0.055, 0.52, 0.075), ankle: v(-0.025, 0.1, 0.0), toe: v(-0.02, 0.02, 0.13) },
    { hip: v(0.085, 0.95, 0), knee: v(0.035, 0.52, 0.095), ankle: v(0.0, 0.12, 0.035), toe: v(-0.01, 0.06, 0.17) },
  ];
  for (const L of legs) {
    body.cone(L.hip, L.knee, 0.082, 0.052, 0.05);
    body.ell(L.hip.clone().lerp(L.knee, 0.4).add(v(0, 0, 0.03)), v(0.06, 0.15, 0.05), [0.1, 0, 0], 0.04); // quadriceps
    body.ell(L.knee.clone().add(v(0, 0, 0.03)), v(0.038, 0.04, 0.025), [0, 0, 0], 0.02);
    body.cone(L.knee, L.ankle, 0.05, 0.03, 0.03);
    body.ell(L.knee.clone().lerp(L.ankle, 0.3).add(v(0, 0, -0.03)), v(0.045, 0.1, 0.045), [0, 0, 0], 0.03); // calf
    body.cone(L.ankle, L.toe, 0.032, 0.022, 0.025);
    body.ell(L.ankle.clone().lerp(L.toe, 0.6), v(0.035, 0.018, 0.06), [0.4, 0, 0], 0.02);
  }
  const skin = body.mesh(v(0, 1.05, 0.0), 2.2, res);

  // Hair falling past the right shoulder, beard and moustache.
  const hair = new Sculpt();
  hair.ell(v(0.05, 1.765, 0.035), v(0.083, 0.083, 0.088), tilt, 0.02);
  hair.cone(v(-0.02, 1.72, 0.0), v(-0.035, 1.56, 0.0), 0.04, 0.03, 0.03);
  hair.cone(v(0.12, 1.7, 0.02), v(0.15, 1.52, 0.03), 0.045, 0.03, 0.03);
  hair.ell(v(0.07, 1.66, 0.105), v(0.05, 0.05, 0.035), tilt, 0.02);               // beard
  hair.ell(v(0.075, 1.698, 0.135), v(0.028, 0.008, 0.01), [0.4, 0.1, -0.34], 0.006); // moustache
  const strands = (p, d) => d + Math.sin(p.x * 160 + p.y * 30) * 0.0025;
  const hairM = hair.mesh(v(0.06, 1.64, 0.05), 0.42, Math.round(res * 0.6), strands);

  // Loincloth: folded linen around the hips with a knot on the right.
  const cloth = new Sculpt();
  cloth.ell(v(0, 0.95, 0.005), v(0.175, 0.14, 0.12), [0, 0, 0.05], 0.02, {
    disp: p => -Math.abs(Math.sin(Math.atan2(p.z, p.x) * 9 + p.y * 14)) * 0.012 * Math.max(0, 1.05 - p.y) * 3,
  });
  cloth.ell(v(0.165, 0.96, 0.05), v(0.045, 0.06, 0.04), [0, 0, 0.3], 0.02);
  cloth.cone(v(0.17, 0.92, 0.06), v(0.2, 0.74, 0.07), 0.035, 0.018, 0.02);
  const clothM = cloth.mesh(v(0.02, 0.92, 0.02), 0.5, Math.round(res * 0.6));

  writeGlb(`${OUT}corpus.raw.glb`, [
    { name: 'skin', material: 'skin', ...skin },
    { name: 'hair', material: 'hair', ...hairM },
    { name: 'cloth', material: 'cloth', ...clothM },
  ]);
  console.log('corpus', skin.position.length / 9, hairM.position.length / 9, clothM.position.length / 9);
}

/* ---------------------------------------------------------------- Our Lady of Lourdes */
// One piece of white marble: gown falling in folds, veil, joined hands, face gazing upward.
{
  const s = new Sculpt();
  const gownFolds = p => {
    const a = Math.atan2(p.z, p.x);
    const w = Math.max(0, Math.min(1, (1.0 - p.y) / 1.0));
    return -(Math.abs(Math.sin(a * 6 + p.y * 1.5)) * 0.022 + Math.sin(a * 13 + 1.3) * 0.006) * w;
  };
  s.cone(v(0, 0.06, 0), v(0, 0.98, 0.0), 0.25, 0.135, 0.05, { disp: gownFolds });
  s.ell(v(0, 0.04, 0.02), v(0.27, 0.05, 0.22), [0, 0, 0], 0.05, { disp: gownFolds });  // hem spread
  s.ell(v(0, 1.17, 0.0), v(0.15, 0.17, 0.105), [0, 0, 0], 0.04);                      // torso
  for (const k of [-1, 1]) s.ell(v(0.055 * k, 1.21, 0.07), v(0.05, 0.045, 0.035), [0, 0, 0], 0.03);
  for (const k of [-1, 1]) s.ell(v(0.165 * k, 1.3, -0.01), v(0.06, 0.05, 0.06), [0, 0, 0], 0.04); // shoulders
  // Veil: a shell over head and back, open at the face.
  const veilShell = p => {
    const inner = Math.hypot(p.x / 0.2, (p.y - 1.0) / 0.66, (p.z + 0.045) / 0.165) - 1;
    const shell = Math.abs(inner) * 0.16 - 0.011;
    // Open at the front: behind the shoulders below the chin, framing the face above it.
    const t = Math.max(0, Math.min(1, (p.y - 1.3) / 0.16));
    const open = p.z - (-0.06 + 0.075 * t * t * (3 - 2 * t));
    const bottom = 0.2 - p.y;
    return Math.max(shell, open, bottom);
  };
  s.add({ d: veilShell, box: boxFrom(v(-0.25, 0.15, -0.25), v(0.25, 1.72, 0.15)), k: 0.015,
    disp: p => -Math.abs(Math.sin(Math.atan2(p.z, p.x) * 5 + p.y * 2)) * 0.01 * Math.max(0, 1.3 - p.y) });
  // Neck and head, gazing slightly upward.
  s.cone(v(0, 1.3, 0.0), v(0, 1.43, 0.02), 0.045, 0.04, 0.03);
  const htilt = [-0.2, 0, 0];
  const hc = v(0, 1.505, 0.04);
  s.ell(hc, v(0.072, 0.094, 0.082), htilt, 0.02);
  s.ell(v(0, 1.45, 0.07), v(0.045, 0.04, 0.045), htilt, 0.025);                      // chin
  s.ell(v(0, 1.5, 0.121), v(0.011, 0.03, 0.017), [-0.45, 0, 0], 0.006);              // nose
  s.ell(v(0, 1.54, 0.104), v(0.052, 0.012, 0.016), htilt, 0.008);                   // brow
  for (const k of [-1, 1]) s.ell(v(0.04 * k, 1.485, 0.095), v(0.022, 0.02, 0.018), htilt, 0.015); // cheeks
  s.ell(v(0, 1.466, 0.108), v(0.022, 0.0075, 0.009), htilt, 0.004);                  // lips
  for (const k of [-1, 1]) {
    s.sub({ d: p => Math.hypot((p.x - 0.029 * k) / 1.3, p.y - 1.522, p.z - 0.112) - 0.012, box: boxAround(v(0.029 * k, 1.522, 0.112), 0.03), k: 0.006 });
    s.ell(v(0.027 * k, 1.522, 0.1), v(0.013, 0.007, 0.008), htilt, 0.005);             // eyes looking up
  }
  // Arms in wide sleeves, hands joined in prayer at the chest.
  for (const k of [-1, 1]) {
    const sh = v(0.17 * k, 1.28, 0), el = v(0.15 * k, 1.07, 0.05), wr = v(0.03 * k, 1.17, 0.17);
    s.cone(sh, el, 0.055, 0.06, 0.04);
    s.cone(el, wr.clone().lerp(el, 0.35), 0.075, 0.06, 0.04);                       // sleeve
    s.cone(wr.clone().lerp(el, 0.4), wr, 0.03, 0.025, 0.02);
    s.ell(v(0.012 * k, 1.235, 0.185), v(0.012, 0.055, 0.035), [-0.35, 0, 0], 0.01); // palm
    for (let f = 0; f < 4; f += 1) s.cone(v(0.012 * k, 1.27, 0.2 - f * 0.012), v(0.01 * k, 1.315, 0.21 - f * 0.013), 0.0075, 0.006, 0.004);
  }
  // Feet beneath the hem.
  for (const k of [-1, 1]) s.ell(v(0.07 * k, 0.03, 0.2), v(0.035, 0.03, 0.065), [0, 0, 0], 0.02);
  const mary = s.mesh(v(0, 0.86, 0), 1.8, res);
  writeGlb(`${OUT}lourdes.raw.glb`, [{ name: 'marble', material: 'marble', ...mary }]);
  console.log('lourdes', mary.position.length / 9);
}

function boxAround(c, r) { return boxFrom(c.clone().subScalar(r), c.clone().addScalar(r)); }
function boxFrom(a, b) { return { containsPoint: p => p.x >= a.x && p.x <= b.x && p.y >= a.y && p.y <= b.y && p.z >= a.z && p.z <= b.z, min: a, max: b }; }
