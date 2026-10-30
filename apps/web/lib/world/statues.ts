import * as THREE from 'three';

/**
 * Sculpted devotional figures built from shaped primitives. Both face +Z with their feet at the
 * origin; the caller positions and turns them. Sizes are in metres at life scale.
 */

const smooth = (t: number) => {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

type Mats = Record<string, THREE.MeshStandardMaterial>;

const put = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};

/** Tapered limb between two points, with a rounded joint at each end. */
const limb = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, mat: THREE.Material, joints = true) => {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = put(parent, new THREE.CylinderGeometry(rb, ra, len, 18, 1, false), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  if (joints) {
    put(parent, new THREE.SphereGeometry(ra, 16, 12), mat, a.x, a.y, a.z);
    put(parent, new THREE.SphereGeometry(rb, 16, 12), mat, b.x, b.y, b.z);
  }
  return m;
};

/** Egg-shaped head narrowing toward the chin (front = +Z). */
const headGeometry = (r: number) => {
  const g = new THREE.SphereGeometry(r, 36, 28);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i += 1) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const lower = Math.max(0, -y / r);
    x *= 0.84 * (1 - 0.32 * Math.pow(lower, 1.6));
    z *= 0.96 * (1 - 0.16 * Math.pow(lower, 1.4));
    if (y < 0) y *= 1.16;
    z += lower * lower * r * 0.12;
    p.setXYZ(i, x, y * 1.05, z);
  }
  g.computeVertexNormals();
  return g;
};

/** Lathe whose surface ripples into vertical folds, stronger toward the hem. */
const foldedLathe = (profile: [number, number][], folds: number, depth: number, foldTop: number, seg = 64, phiStart = 0, phiLength = Math.PI * 2) => {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg, phiStart, phiLength);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const w = 1 - smooth(y / foldTop);
    const k = 1 + Math.sin(a * folds + y * 3.1) * depth * w + Math.sin(a * folds * 2.3 + 1.7) * depth * 0.35 * w;
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
};

const starShape = (r: number) => {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k += 1) {
    const rad = k % 2 === 0 ? r : r * 0.42;
    const a = Math.PI / 2 + (k * Math.PI) / 5;
    if (k === 0) s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  s.closePath();
  return s;
};

const materials = (): Mats => ({
  wood: new THREE.MeshStandardMaterial({ color: '#3b2618', roughness: 0.62, metalness: 0.02 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d0a54f', roughness: 0.28, metalness: 0.85, emissive: '#3a2708', emissiveIntensity: 0.25 }),
  skin: new THREE.MeshStandardMaterial({ color: '#dcbd9f', roughness: 0.5, metalness: 0.0 }),
  skinShade: new THREE.MeshStandardMaterial({ color: '#c9a585', roughness: 0.55 }),
  hair: new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.7 }),
  linen: new THREE.MeshStandardMaterial({ color: '#efe6d3', roughness: 0.65, side: THREE.DoubleSide }),
  wound: new THREE.MeshStandardMaterial({ color: '#6e1a1a', roughness: 0.5 }),
  thorn: new THREE.MeshStandardMaterial({ color: '#4a3a24', roughness: 0.9 }),
  marble: new THREE.MeshStandardMaterial({ color: '#f5f1e8', roughness: 0.42, metalness: 0.0, side: THREE.DoubleSide }),
  marbleSkin: new THREE.MeshStandardMaterial({ color: '#f1dccb', roughness: 0.45 }),
  blue: new THREE.MeshStandardMaterial({ color: '#4d79ba', roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide }),
  rose: new THREE.MeshStandardMaterial({ color: '#d8a43a', roughness: 0.3, metalness: 0.7 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#6c7f3a', roughness: 0.6 }),
  ink: new THREE.MeshStandardMaterial({ color: '#4a3528', roughness: 0.6 }),
  plaque: new THREE.MeshStandardMaterial({ color: '#efe3c2', roughness: 0.6 }),
});

const plaqueTexture = () => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#efe3c2';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = '#a7843e';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 244, 84);
    ctx.fillStyle = '#5a2a1a';
    ctx.font = 'bold 54px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('I N R I', 128, 52);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/**
 * Monumental crucifix: dark wood cross with gilded trefoil ends, titulus, and a polychrome
 * corpus (head inclined to the right, crown of thorns, loincloth with a side knot, feet crossed).
 * Returns the group; the cross foot is at the origin. Overall height ≈ 4.4 m.
 */
export const createCrucifix = () => {
  const m = materials();
  const g = new THREE.Group();
  const beamW = 0.2, beamD = 0.13;
  put(g, new THREE.BoxGeometry(beamW, 4.3, beamD), m.wood, 0, 2.15, 0);
  put(g, new THREE.BoxGeometry(2.5, beamW, beamD), m.wood, 0, 3.12, 0);
  // Gilded edge mouldings and trefoil terminals.
  for (const [x, y, w, h] of [[0, 2.15, 0.035, 4.3], [0, 3.12, 2.5, 0.035]] as const) {
    put(g, new THREE.BoxGeometry(w === 0.035 ? 0.03 : w, h === 0.035 ? 0.03 : h, 0.02), m.gold, x, y, beamD / 2 + 0.01);
  }
  const trefoil = (x: number, y: number, rot: number) => {
    const t = new THREE.Group();
    t.position.set(x, y, 0);
    t.rotation.z = rot;
    g.add(t);
    for (const [dx, dy] of [[0, 0.13], [-0.11, 0.04], [0.11, 0.04]]) {
      const disc = put(t, new THREE.CylinderGeometry(0.1, 0.1, 0.1, 28), m.gold, dx, dy, 0);
      disc.rotation.x = Math.PI / 2;
    }
    put(t, new THREE.SphereGeometry(0.05, 14, 10), m.wood, 0, 0.07, 0.05);
  };
  trefoil(0, 4.32, 0);
  trefoil(-1.28, 3.12, Math.PI / 2);
  trefoil(1.28, 3.12, -Math.PI / 2);
  // Titulus "INRI".
  const tex = plaqueTexture();
  const plaque = put(g, new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), 0, 3.72, beamD / 2 + 0.012, false);
  plaque.userData.dispose = tex;
  // Suppedaneum (foot rest).
  put(g, new THREE.BoxGeometry(0.3, 0.06, 0.16), m.wood, 0, 1.12, 0.1);

  // Corpus, front at +Z, standing on the foot rest.
  const c = new THREE.Group();
  c.position.set(0, 1.15, 0.13);
  g.add(c);
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // Legs: knees slightly flexed and turned, right foot over left.
  limb(c, V(-0.075, 0.95, 0.0), V(-0.05, 0.52, 0.07), 0.07, 0.05, m.skin);
  limb(c, V(-0.05, 0.52, 0.07), V(-0.02, 0.08, 0.0), 0.05, 0.034, m.skin);
  limb(c, V(0.075, 0.95, 0.0), V(0.0, 0.52, 0.09), 0.07, 0.05, m.skin);
  limb(c, V(0.0, 0.52, 0.09), V(0.0, 0.1, 0.03), 0.05, 0.034, m.skin);
  for (const [x, z] of [[-0.02, 0.06], [0.0, 0.09]]) {
    const foot = put(c, new THREE.SphereGeometry(0.045, 16, 12), m.skin, x, 0.03, z);
    foot.scale.set(0.75, 0.55, 2.0);
  }
  put(c, new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), m.ink, -0.01, 0.06, 0.13).rotation.x = Math.PI / 2;
  // Loincloth with folds and a side knot.
  const cloth = put(c, foldedLathe([[0.135, 0.8], [0.155, 0.86], [0.16, 0.95], [0.15, 1.04], [0.142, 1.08]], 9, 0.08, 1.2), m.linen, 0, 0, 0);
  cloth.scale.z = 0.72;
  put(c, new THREE.TorusGeometry(0.148, 0.01, 6, 36), m.gold, 0, 1.075, 0).rotation.x = Math.PI / 2;
  const knot = put(c, new THREE.SphereGeometry(0.05, 14, 10), m.linen, 0.15, 1.0, 0.04);
  knot.scale.set(0.8, 1.2, 0.7);
  const tail = put(c, new THREE.PlaneGeometry(0.1, 0.32, 1, 6), m.linen, 0.18, 0.84, 0.05);
  tail.rotation.set(0, 0.4, 0.12);
  // Torso: abdomen, rib cage and chest; side wound.
  const torso = put(c, new THREE.LatheGeometry([[0.13, 1.06], [0.125, 1.15], [0.14, 1.27], [0.16, 1.38], [0.165, 1.46], [0.13, 1.52], [0.06, 1.55], [0.0, 1.555]].map(([r, y]) => new THREE.Vector2(r, y)), 36), m.skin);
  torso.scale.z = 0.62;
  for (let i = 0; i < 3; i += 1) {
    const rib = put(c, new THREE.TorusGeometry(0.15 - i * 0.004, 0.0035, 6, 24, Math.PI * 0.45), m.skinShade, 0, 1.3 + i * 0.045, 0.006, false);
    rib.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 0.225);
    rib.scale.set(1, 0.62, 1);
  }
  put(c, new THREE.SphereGeometry(0.014, 10, 8), m.wound, 0.11, 1.3, 0.075, false).scale.set(0.5, 1.4, 0.5);
  // Arms raised along the beam.
  const shoulderY = 1.5;
  for (const s of [-1, 1]) {
    const sh = V(0.15 * s, shoulderY, 0);
    const el = V(0.52 * s, 1.75, 0.0);
    const wr = V(0.86 * s, 1.95, -0.01);
    limb(c, sh, el, 0.058, 0.043, m.skin);
    limb(c, el, wr, 0.043, 0.032, m.skin);
    const palm = put(c, new THREE.BoxGeometry(0.11, 0.075, 0.025), m.skin, 0.93 * s, 1.99, -0.01);
    palm.rotation.z = s * 0.52;
    for (let f = 0; f < 4; f += 1) {
      const fing = put(c, new THREE.CapsuleGeometry(0.009, 0.05, 4, 8), m.skin, 0.99 * s + s * 0.015, 2.0 + (f - 1.5) * 0.018 + 0.04, -0.005);
      fing.rotation.z = s * (-Math.PI / 2 + 0.52 + 0.55) + (f - 1.5) * 0.04;
    }
    put(c, new THREE.CylinderGeometry(0.014, 0.014, 0.05, 8), m.ink, 0.93 * s, 1.99, 0.01).rotation.x = Math.PI / 2;
    put(c, new THREE.SphereGeometry(0.008, 8, 6), m.wound, 0.935 * s, 1.975, 0.017, false);
  }
  // Neck and head inclined toward the right shoulder, gaze down.
  limb(c, V(0, 1.52, 0), V(0.03, 1.62, 0.02), 0.045, 0.042, m.skin, false);
  const head = new THREE.Group();
  head.position.set(0.04, 1.63, 0.03);
  head.rotation.set(0.42, 0.1, -0.33);
  c.add(head);
  put(head, headGeometry(0.1), m.skin, 0, 0.1, 0);
  // Long hair falling behind and over the shoulders, beard and moustache.
  const hairCap = put(head, new THREE.SphereGeometry(0.106, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.42), m.hair, 0, 0.11, -0.02);
  hairCap.scale.set(0.9, 1.08, 1.02);
  for (const s of [-1, 1]) {
    const lock = put(head, new THREE.CapsuleGeometry(0.035, 0.22, 6, 12), m.hair, 0.07 * s, 0.0, -0.03);
    lock.rotation.z = s * 0.12;
    lock.rotation.x = 0.15;
  }
  const beard = put(head, new THREE.SphereGeometry(0.07, 24, 16, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42), m.hair, 0, 0.07, 0.018);
  beard.scale.set(0.92, 1.25, 1.0);
  const moustache = put(head, new THREE.TorusGeometry(0.022, 0.005, 6, 16, Math.PI), m.hair, 0, 0.066, 0.086, false);
  moustache.rotation.z = Math.PI;
  // Closed eyes, brows, nose.
  for (const s of [-1, 1]) {
    const lid = put(head, new THREE.TorusGeometry(0.012, 0.0025, 6, 12, Math.PI), m.skinShade, 0.03 * s, 0.11, 0.084, false);
    lid.rotation.z = Math.PI;
    const brow = put(head, new THREE.CapsuleGeometry(0.004, 0.026, 4, 8), m.hair, 0.032 * s, 0.13, 0.086, false);
    brow.rotation.z = Math.PI / 2 + s * 0.25;
  }
  const nose = put(head, new THREE.CapsuleGeometry(0.008, 0.032, 6, 8), m.skin, 0, 0.088, 0.094, false);
  nose.rotation.x = 0.3;
  // Crown of thorns: woven ring with spikes.
  const crown = new THREE.Group();
  crown.position.set(0, 0.155, -0.005);
  crown.rotation.x = -0.12;
  head.add(crown);
  for (let k = 0; k < 2; k += 1) {
    const ring = put(crown, new THREE.TorusGeometry(0.098, 0.009, 6, 40), m.thorn, 0, k * 0.012, 0, false);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.y = k * 0.2;
    ring.scale.set(1, 1.08, 1);
  }
  for (let k = 0; k < 22; k += 1) {
    const a = (k / 22) * Math.PI * 2;
    const spike = put(crown, new THREE.ConeGeometry(0.004, 0.03, 5), m.thorn, Math.cos(a) * 0.1, 0.005, Math.sin(a) * 0.108, false);
    spike.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
  }
  // Cruciform halo of gilded rays behind the head.
  const halo = new THREE.Group();
  halo.position.set(0.03, 1.75, -0.05);
  c.add(halo);
  put(halo, new THREE.TorusGeometry(0.18, 0.008, 8, 48), m.gold, 0, 0, 0, false);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const ray = put(halo, new THREE.BoxGeometry(0.03, 0.12, 0.008), m.gold, Math.sin(a) * 0.12, Math.cos(a) * 0.12, 0, false);
    ray.rotation.z = -a;
  }
  return g;
};

/**
 * Our Lady (Lourdes type): white gown falling in folds, blue sash with ribbons, long veil,
 * hands joined in prayer with a rosary over the arm, golden roses at the feet and a crown of
 * twelve stars. Height ≈ 1.65 m; the caller adds a plinth.
 */
export const createMarianStatue = () => {
  const m = materials();
  const g = new THREE.Group();
  // Gown from the hem to the shoulders.
  const gown = put(g, foldedLathe([
    [0.0, 0.0], [0.27, 0.0], [0.26, 0.12], [0.235, 0.4], [0.2, 0.72], [0.165, 0.94], [0.158, 1.04], [0.168, 1.16], [0.172, 1.26], [0.16, 1.33], [0.12, 1.37], [0.06, 1.4], [0.0, 1.405],
  ], 11, 0.07, 1.0), m.marble);
  gown.scale.z = 0.78;
  // Blue sash and two ribbons hanging in front.
  const sash = put(g, new THREE.TorusGeometry(0.16, 0.014, 8, 40), m.blue, 0, 0.98, 0);
  sash.rotation.x = Math.PI / 2;
  sash.scale.set(1, 0.78, 1);
  for (const s of [-1, 1]) {
    const ribbon = put(g, new THREE.BoxGeometry(0.045, 0.6, 0.008), m.blue, 0.03 * s, 0.67, 0.135 + 0.02 * (s + 1));
    ribbon.rotation.set(-0.08, 0, s * 0.05);
  }
  // Long veil: covers the head and falls behind to the hem.
  // Long veil over the head, falling behind to the hem; open at the front (lathe phi 0 = +Z).
  const veil = put(g, foldedLathe([[0.12, 0.04], [0.2, 0.1], [0.215, 0.5], [0.205, 0.95], [0.195, 1.2], [0.17, 1.38], [0.13, 1.55], [0.11, 1.62], [0.06, 1.66], [0.0, 1.67]], 7, 0.05, 1.2, 64, 0.95, Math.PI * 2 - 1.9), m.marble);
  veil.scale.set(1.04, 1, 0.82);
  veil.position.z = -0.045;
  // Face, gazing slightly upward.
  const head = new THREE.Group();
  head.position.set(0, 1.42, 0.02);
  head.rotation.x = -0.18;
  g.add(head);
  put(head, headGeometry(0.088), m.marbleSkin, 0, 0.09, 0);
  for (const s of [-1, 1]) {
    const lid = put(head, new THREE.TorusGeometry(0.011, 0.0022, 6, 12, Math.PI), m.skinShade, 0.028 * s, 0.098, 0.074, false);
    lid.rotation.z = Math.PI;
    const brow = put(head, new THREE.CapsuleGeometry(0.0028, 0.022, 4, 8), m.hair, 0.029 * s, 0.116, 0.077, false);
    brow.rotation.z = Math.PI / 2 - s * 0.12;
  }
  put(head, new THREE.CapsuleGeometry(0.006, 0.026, 6, 8), m.marbleSkin, 0, 0.078, 0.083, false).rotation.x = 0.3;
  const lips = put(head, new THREE.CapsuleGeometry(0.0045, 0.016, 4, 8), new THREE.MeshStandardMaterial({ color: '#c98f86', roughness: 0.5 }), 0, 0.045, 0.078, false);
  lips.rotation.z = Math.PI / 2;
  // Veil edge framing the face.
  const hood = put(head, new THREE.SphereGeometry(0.104, 32, 20, Math.PI * 0.5 + 0.82, Math.PI * 2 - 1.64, 0, Math.PI * 0.64), m.marble, 0, 0.1, -0.005);
  hood.scale.set(0.95, 1.1, 1.05);
  // Arms in wide sleeves, hands joined at the chest.
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (const s of [-1, 1]) {
    limb(g, V(0.165 * s, 1.3, 0.0), V(0.15 * s, 1.06, 0.06), 0.055, 0.06, m.marble);
    const sleeve = put(g, new THREE.CylinderGeometry(0.045, 0.07, 0.16, 20, 1, true), m.marble);
    sleeve.position.set(0.085 * s, 1.12, 0.12);
    sleeve.rotation.set(-1.05, 0, s * -0.9);
    limb(g, V(0.12 * s, 1.08, 0.08), V(0.022 * s, 1.17, 0.17), 0.032, 0.026, m.marble, false);
    const hand = put(g, new THREE.BoxGeometry(0.018, 0.1, 0.06), m.marbleSkin, 0.01 * s, 1.24, 0.18);
    hand.rotation.set(-0.35, 0, 0);
    for (let f = 0; f < 4; f += 1) {
      const finger = put(g, new THREE.CapsuleGeometry(0.0065, 0.04, 4, 6), m.marbleSkin, 0.0095 * s, 1.31 + Math.cos(f) * 0.002, 0.2 - f * 0.014 + 0.02);
      finger.rotation.x = -0.35;
    }
  }
  // Rosary over the right forearm.
  for (let i = 0; i < 26; i += 1) {
    const a = (i / 25) * Math.PI;
    put(g, new THREE.SphereGeometry(0.008, 8, 6), m.rose, 0.12 + Math.cos(a) * 0.03, 1.05 - Math.sin(a) * 0.22, 0.12 + Math.sin(a) * 0.04, false);
  }
  put(g, new THREE.BoxGeometry(0.008, 0.05, 0.004), m.rose, 0.12, 0.8, 0.15, false);
  // Bare feet with golden roses.
  for (const s of [-1, 1]) {
    const foot = put(g, new THREE.SphereGeometry(0.035, 14, 10), m.marbleSkin, 0.075 * s, 0.035, 0.22);
    foot.scale.set(0.8, 0.55, 1.5);
    const rose = put(g, new THREE.DodecahedronGeometry(0.03, 1), m.rose, 0.075 * s, 0.07, 0.26);
    rose.scale.set(1, 0.75, 1);
    const leaf = put(g, new THREE.SphereGeometry(0.025, 8, 6), m.leaf, 0.075 * s + s * 0.03, 0.05, 0.25);
    leaf.scale.set(1.4, 0.3, 0.7);
  }
  // Crown of twelve stars.
  const crown = new THREE.Group();
  crown.position.set(0, 1.53, -0.1);
  crown.rotation.x = -0.18;
  g.add(crown);
  const star = new THREE.ExtrudeGeometry(starShape(0.024), { depth: 0.006, bevelEnabled: false });
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * Math.PI * 2;
    const st = put(crown, star, m.gold, Math.cos(a) * 0.165, Math.sin(a) * 0.165, 0, false);
    st.rotation.z = a - Math.PI / 2;
  }
  put(crown, new THREE.TorusGeometry(0.17, 0.004, 6, 60), m.gold, 0, 0, -0.003, false);
  return g;
};

/** Frees geometries, materials and textures of a statue group. */
export const disposeGroup = (g: THREE.Object3D) => {
  const mats = new Set<THREE.Material>();
  g.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(x => mats.add(x));
      const t = o.userData.dispose as THREE.Texture | undefined;
      t?.dispose();
    }
  });
  mats.forEach(x => {
    const mm = x as THREE.MeshStandardMaterial;
    mm.map?.dispose();
    x.dispose();
  });
};
