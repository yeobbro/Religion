import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { flameTexture, knitTexture, labelTexture, laceTexture } from './textures';

/**
 * Visitor avatar in metres, facing -Z, feet at the origin (about 1.68 m tall).
 *
 * Arms are driven by two-bone inverse kinematics in chest space: every pose names where the
 * wrist goes, which way the fingers point and which way the palm faces. That is what lets the
 * sign of the cross touch the forehead, chest and both shoulders, and lets the palms meet flat
 * in prayer, instead of approximating with hand-tuned joint angles.
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const DOWN = V(0, -1, 0);
const smooth = (t: number) => {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

// Skeleton dimensions.
const PELVIS_Y = 0.93;
const SPINE_Y = 0.1;          // spine origin above the pelvis
const CHEST_Y = 0.3;          // chest origin above the spine
const SHOULDER = V(0.178, 0.052, 0); // chest space, right side (+x)
const UPPER = 0.285;
const FORE = 0.245;
const HEAD_PIVOT = V(0, 0.14, 0);   // neck + head pivot, chest space
const HEAD_SCALE = 1.3;               // big, friendly head
const HEAD_CENTER = V(0, 0.27, 0);  // chest space
const PALM_LEN = 0.088;
const FINGER_SPECS = [
  // [z position on the palm edge, segment lengths, radius]
  { z: -0.028, seg: [0.042, 0.026, 0.02], r: 0.0086 },  // index
  { z: -0.0095, seg: [0.046, 0.029, 0.021], r: 0.0088 }, // middle
  { z: 0.0095, seg: [0.043, 0.027, 0.02], r: 0.0084 },   // ring
  { z: 0.027, seg: [0.034, 0.021, 0.018], r: 0.0076 },   // little
];
/** Wrist to middle fingertip with the fingers straight. */
export const HAND_LEN = PALM_LEN + 0.046 + 0.029 + 0.021;

export type Side = 1 | -1; // +1 right, -1 left

export type ArmTarget = {
  wrist: THREE.Vector3; // chest space
  finger: THREE.Vector3; // direction the fingers point
  palm: THREE.Vector3; // direction the palm faces
  pole: THREE.Vector3; // where the elbow should bend toward
  curl: number; // 0 straight … 1.3 fist
  thumb: number; // 0 alongside the index … 1 opposed (grip)
  spread: number;
};

type ArmRig = {
  side: Side;
  shoulder: THREE.Group;
  elbow: THREE.Group;
  hand: THREE.Group;
  fingers: THREE.Group[][];
  thumb: THREE.Group[];
  state: ArmTarget;
};

type LegRig = { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group };

export type Posture = 'stand' | 'sit' | 'kneel';
export type HandsMode = 'rest' | 'prayer' | 'rosary' | 'orans' | 'book';
export type Gesture = 'cross' | 'dip' | 'bow' | 'greet' | 'veilOn' | 'veilOff' | 'light' | 'amen';

const GESTURE_LENGTH: Record<Gesture, number> = {
  cross: 3.9, dip: 1.9, bow: 1.8, greet: 2.0, veilOn: 2.5, veilOff: 2.3, light: 4.2, amen: 1.4,
};

const cloneTarget = (t: ArmTarget): ArmTarget => ({
  wrist: t.wrist.clone(), finger: t.finger.clone(), palm: t.palm.clone(), pole: t.pole.clone(),
  curl: t.curl, thumb: t.thumb, spread: t.spread,
});

/** Wrist position for a pose defined by where the middle fingertip touches. */
const fromTip = (tip: THREE.Vector3, finger: THREE.Vector3, curl = 0) =>
  tip.clone().sub(finger.clone().normalize().multiplyScalar(HAND_LEN * (1 - curl * 0.35)));

export type Outfit = 'casual' | 'dress' | 'nun' | 'monk' | 'priest' | 'server' | 'choir';
export const VISITOR_OUTFITS: { id: Outfit; label: string; hint: string }[] = [
  { id: 'casual', label: '평상복', hint: '니트와 바지' },
  { id: 'dress', label: '흰 미사복', hint: '흰 원피스와 미사보' },
  { id: 'nun', label: '수녀 수도복', hint: '검은 베일과 흰 두건' },
  { id: 'monk', label: '수사 수도복', hint: '갈색 수도복과 띠' },
];
export type AvatarOptions = {
  name: string;
  outfit?: Outfit;
  /** Fewer meshes and mitten hands, for background figures. */
  lite?: boolean;
  skin?: string;
  hair?: string;
  showName?: boolean;
  rosary?: boolean;
};
type Palette = { top: string; trim: string; bottom: string; shoes: string; hair: string; long: boolean; wideSleeves: boolean };
const PALETTES: Record<Outfit, Palette> = {
  casual: { top: '#ecdcc4', trim: '#c7ae8c', bottom: '#47546e', shoes: '#5b3b2b', hair: '#3a281e', long: false, wideSleeves: false },
  dress: { top: '#fbf8f2', trim: '#eadfc6', bottom: '#f8f4ec', shoes: '#e7ddcf', hair: '#4a3022', long: true, wideSleeves: false },
  nun: { top: '#1d1e26', trim: '#1d1e26', bottom: '#1d1e26', shoes: '#151515', hair: '#2b211b', long: true, wideSleeves: true },
  monk: { top: '#6b4a31', trim: '#5a3d28', bottom: '#6b4a31', shoes: '#3b2a1e', hair: '#4a3324', long: true, wideSleeves: true },
  priest: { top: '#f7f4ec', trim: '#e6dcc8', bottom: '#f7f4ec', shoes: '#151515', hair: '#575049', long: true, wideSleeves: false },
  server: { top: '#1b1b20', trim: '#1b1b20', bottom: '#1b1b20', shoes: '#151515', hair: '#2e2018', long: true, wideSleeves: true },
  choir: { top: '#6e1f2a', trim: '#5c1822', bottom: '#6e1f2a', shoes: '#151515', hair: '#3a281e', long: true, wideSleeves: true },
};

export class Avatar {
  readonly root = new THREE.Group();
  readonly pelvis = new THREE.Group();
  readonly spine = new THREE.Group();
  readonly chest = new THREE.Group();
  readonly neck = new THREE.Group();
  readonly head = new THREE.Group();
  readonly veil: THREE.Mesh;
  readonly rosary = new THREE.Group();
  readonly taper = new THREE.Group();
  readonly book = new THREE.Group();
  readonly outfit: Outfit;
  private robe: THREE.Mesh | null = null;
  private robeBase: Float32Array | null = null;
  private readonly taperFlame: THREE.Sprite;
  private readonly arms: Record<'left' | 'right', ArmRig>;
  private readonly legs: Record<'left' | 'right', LegRig>;
  private readonly eyelids: THREE.Mesh[] = [];
  private readonly label: THREE.Sprite;
  private readonly disposables: { dispose(): void }[] = [];

  posture: Posture = 'stand';
  hands: HandsMode = 'rest';
  veilOn = false;
  private sitT = 0;
  private kneelT = 0;
  private veilT = 0;
  private seatHeight = 0.45;
  private gesture: Gesture | null = null;
  private gestureTime = 0;
  private gestureTarget = new THREE.Vector3();
  private gestureDone: (() => void) | null = null;
  private gestureCue: (() => void) | null = null;
  private cueFired = false;
  private time = 0;
  private gait = 0;
  private blinkAt = 2;
  private beadPulse = 0;

  constructor(opts: AvatarOptions) {
    const outfit = opts.outfit ?? 'casual';
    const lite = opts.lite ?? false;
    this.outfit = outfit;
    const seg = lite ? 12 : 20;
    const P = PALETTES[outfit];
    const skin = this.mat(new THREE.MeshStandardMaterial({ color: opts.skin ?? '#f0c6a8', roughness: 0.55, metalness: 0 }));
    const skinShade = this.mat(new THREE.MeshStandardMaterial({ color: '#e3ad8c', roughness: 0.6 }));
    const hair = this.mat(new THREE.MeshStandardMaterial({ color: opts.hair ?? P.hair, roughness: 0.5, metalness: 0.05 }));
    let topMap: THREE.Texture | undefined;
    if (outfit === 'casual' && !lite) { topMap = knitTexture('#ffffff'); this.disposables.push(topMap); }
    const top = this.mat(new THREE.MeshStandardMaterial({ color: P.top, map: topMap, roughness: 0.9 }));
    const trim = this.mat(new THREE.MeshStandardMaterial({ color: P.trim, roughness: 0.85 }));
    const bottom = this.mat(new THREE.MeshStandardMaterial({ color: P.bottom, roughness: 0.86, side: THREE.DoubleSide }));
    const shoeMat = this.mat(new THREE.MeshStandardMaterial({ color: P.shoes, roughness: 0.45, metalness: 0.05 }));
    const white = this.mat(new THREE.MeshStandardMaterial({ color: '#fbf8f3', roughness: 0.25 }));
    const iris = this.mat(new THREE.MeshStandardMaterial({ color: '#3b2418', roughness: 0.25 }));
    const pupil = this.mat(new THREE.MeshStandardMaterial({ color: '#0b0a0a', roughness: 0.2 }));
    const lip = this.mat(new THREE.MeshStandardMaterial({ color: '#d0807a', roughness: 0.45 }));
    const brow = this.mat(new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.8 }));
    const blush = this.mat(new THREE.MeshBasicMaterial({ color: '#ff9e9e', transparent: true, opacity: 0.32, depthWrite: false }));
    const gold = this.mat(new THREE.MeshStandardMaterial({ color: '#d4ad5a', roughness: 0.3, metalness: 0.8 }));

    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = !lite;
      parent.add(m);
      return m;
    };
    const lathe = (pts: [number, number][], n = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), lite ? 14 : n);

    // Hierarchy.
    this.root.add(this.pelvis);
    this.pelvis.position.y = PELVIS_Y;
    this.pelvis.add(this.spine);
    this.spine.position.y = SPINE_Y;
    this.spine.add(this.chest);
    this.chest.position.y = CHEST_Y;
    this.chest.add(this.neck);
    this.neck.position.y = 0.09;
    this.neck.add(this.head);
    this.head.position.y = HEAD_PIVOT.y - 0.09;
    this.head.scale.setScalar(HEAD_SCALE);

    // Hips, torso, collar, neck.
    const hips = add(this.pelvis, lathe([[0, -0.1], [0.12, -0.098], [0.14, -0.06], [0.143, 0.0], [0.139, 0.07], [0.136, 0.11]]), P.long ? top : bottom);
    hips.scale.z = 0.72;
    const torso = add(this.spine, lathe([[0.0, -0.035], [0.139, -0.035], [0.141, 0.0], [0.147, 0.09], [0.158, 0.18], [0.168, 0.26], [0.178, 0.31], [0.176, 0.345], [0.15, 0.385], [0.1, 0.41], [0.058, 0.425], [0.0, 0.43]], 32), top);
    torso.scale.z = 0.7;
    add(this.neck, new THREE.CylinderGeometry(0.04, 0.045, 0.1, seg), skin, 0, 0.02, 0.006);
    if (outfit === 'casual' || outfit === 'dress') {
      const collar = add(this.chest, new THREE.TorusGeometry(0.058, 0.013, 8, 28), trim, 0, 0.115, 0.004);
      collar.rotation.x = Math.PI / 2;
      collar.scale.y = 0.82;
    }

    // Long garments: a skirt hanging from the waist that follows the legs when sitting or kneeling.
    if (P.long) {
      const rows = 10, cols = lite ? 18 : 36;
      const pos: number[] = [], idx: number[] = [];
      for (let r = 0; r <= rows; r += 1) {
        const t = r / rows;
        const rad = 0.142 + t * t * 0.1 + t * 0.03;
        for (let c = 0; c <= cols; c += 1) {
          const a = (c / cols) * Math.PI * 2;
          const fold = 1 + Math.sin(a * 9) * 0.035 * t;
          pos.push(Math.sin(a) * rad * fold, -0.04 - t * (PELVIS_Y - 0.1), Math.cos(a) * rad * 0.82 * fold);
        }
      }
      for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
        const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      this.robeBase = Float32Array.from(pos);
      this.robe = add(this.pelvis, g, bottom);
      this.robe.frustumCulled = false;
    }

    // Garment extras by outfit.
    if (outfit === 'nun') {
      // White guimpe over the chest and a crucifix on a cord.
      const bib = add(this.chest, new THREE.SphereGeometry(0.13, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), white, 0, 0.04, 0.0);
      bib.scale.set(1.18, 0.8, 0.86);
      add(this.chest, new THREE.BoxGeometry(0.012, 0.06, 0.006), gold, 0, -0.07, -0.128, false);
      add(this.chest, new THREE.BoxGeometry(0.036, 0.011, 0.006), gold, 0, -0.058, -0.128, false);
    }
    if (outfit === 'monk') {
      // Hood resting on the shoulders, and a white cord with three knots.
      const hood = add(this.chest, new THREE.SphereGeometry(0.12, 20, 12, Math.PI * 0.15, Math.PI * 0.7 * 2, Math.PI * 0.25, Math.PI * 0.5), top, 0, 0.1, 0.07);
      hood.rotation.y = Math.PI;
      hood.scale.set(1.25, 0.8, 1.0);
      const cord = add(this.spine, new THREE.TorusGeometry(0.146, 0.008, 6, 36), white, 0, 0.0, 0);
      cord.rotation.x = Math.PI / 2;
      cord.scale.y = 0.75;
      for (let k = 0; k < 3; k += 1) add(this.spine, new THREE.SphereGeometry(0.012, 8, 6), white, 0.07, -0.08 - k * 0.12, -0.11, false);
      add(this.spine, new THREE.CylinderGeometry(0.005, 0.005, 0.38, 6), white, 0.07, -0.2, -0.11, false);
    }
    if (outfit === 'priest') {
      // Green chasuble over the white alb: front and back panels with a gold cross and orphrey.
      const chas = this.mat(new THREE.MeshStandardMaterial({ color: '#2f6a46', roughness: 0.7, side: THREE.DoubleSide }));
      for (const z of [-1, 1]) {
        const panel = add(this.spine, new THREE.CylinderGeometry(0.215, 0.32, 0.78, 20, 1, true, z < 0 ? Math.PI * 0.62 : -Math.PI * 0.38, Math.PI * 0.76), chas, 0, 0.04, 0);
        panel.scale.z = 0.68;
      }
      const goldSide = this.mat(new THREE.MeshStandardMaterial({ color: '#d4ad5a', roughness: 0.35, metalness: 0.75, side: THREE.DoubleSide }));
      const orphrey = add(this.spine, new THREE.CylinderGeometry(0.219, 0.324, 0.78, 3, 1, true, Math.PI - 0.13, 0.26), goldSide, 0, 0.04, 0, false);
      orphrey.scale.z = 0.69;
    }
    if (outfit === 'server') {
      // White surplice over the black cassock.
      const surplice = this.mat(new THREE.MeshStandardMaterial({ color: '#f7f4ec', roughness: 0.8, side: THREE.DoubleSide }));
      const sp = add(this.spine, new THREE.CylinderGeometry(0.19, 0.28, 0.6, 24, 1, true), surplice, 0, 0.06, 0);
      sp.scale.z = 0.75;
    }
    if (outfit === 'choir') {
      const ruff = add(this.chest, new THREE.TorusGeometry(0.06, 0.024, 8, 24), white, 0, 0.11, 0.0);
      ruff.rotation.x = Math.PI / 2;
    }

    // Head (scaled up for a gentle, friendly look): rounded face, big eyes, small nose and mouth.
    const headGeo = new THREE.SphereGeometry(0.1, lite ? 20 : 44, lite ? 16 : 32);
    const hp = headGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < hp.count; i += 1) {
      let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
      const lower = Math.max(0, -y / 0.1);
      x *= 0.9 * (1 - 0.22 * Math.pow(lower, 1.8));
      z *= 0.95 * (1 - 0.1 * Math.pow(lower, 1.5));
      if (z < 0) z *= 0.94;
      if (y < 0) y *= 1.02;
      hp.setXYZ(i, x, y, z);
    }
    headGeo.computeVertexNormals();
    add(this.head, headGeo, skin, 0, 0.1, 0.004);
    for (const s of [-1, 1]) {
      const ear = add(this.head, new THREE.SphereGeometry(0.02, 12, 10), skinShade, s * 0.088, 0.1, 0.012);
      ear.scale.set(0.42, 1.0, 0.72);
      const eyeY = 0.098, eyeZ = -0.083, eyeX = s * 0.036;
      const eye = add(this.head, new THREE.SphereGeometry(0.019, lite ? 10 : 18, lite ? 8 : 14), white, eyeX, eyeY, eyeZ, false);
      eye.scale.set(0.95, 1.12, 0.6);
      const irisM = add(this.head, new THREE.CircleGeometry(0.0128, 24), iris, eyeX, eyeY - 0.001, eyeZ - 0.0118, false);
      irisM.rotation.y = Math.PI;
      irisM.scale.y = 1.12;
      const pupilM = add(this.head, new THREE.CircleGeometry(0.0064, 18), pupil, eyeX, eyeY - 0.001, eyeZ - 0.0122, false);
      pupilM.rotation.y = Math.PI;
      if (!lite) {
        const glint = add(this.head, new THREE.CircleGeometry(0.0034, 10), white, eyeX + 0.004, eyeY + 0.006, eyeZ - 0.0126, false);
        glint.rotation.y = Math.PI;
        const glint2 = add(this.head, new THREE.CircleGeometry(0.0017, 8), white, eyeX - 0.004, eyeY - 0.005, eyeZ - 0.0126, false);
        glint2.rotation.y = Math.PI;
        const lash = add(this.head, new THREE.TorusGeometry(0.0172, 0.0021, 4, 18, Math.PI), brow, eyeX, eyeY + 0.003, eyeZ - 0.004, false);
        lash.scale.set(1.05, 1.12, 1);
        const cheek = add(this.head, new THREE.CircleGeometry(0.014, 16), blush, s * 0.054, 0.068, -0.067, false);
        cheek.rotation.y = Math.PI + s * 0.62;
        cheek.scale.y = 0.6;
      }
      const lid = add(this.head, new THREE.SphereGeometry(0.0205, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin, eyeX, eyeY + 0.001, eyeZ + 0.0005, false);
      lid.scale.set(1.0, 1.15, 0.66);
      this.eyelids.push(lid);
      const browM = add(this.head, new THREE.CapsuleGeometry(0.0022, 0.02, 4, 8), brow, s * 0.036, 0.132, -0.084, false);
      browM.rotation.z = Math.PI / 2 - s * 0.14;
    }
    const noseTip = add(this.head, new THREE.SphereGeometry(0.0075, 12, 8), skinShade, 0, 0.07, -0.092, false);
    noseTip.scale.set(1.2, 0.8, 0.9);
    const smile = add(this.head, new THREE.TorusGeometry(0.012, 0.0032, 6, 16, Math.PI), lip, 0, 0.052, -0.08, false);
    smile.rotation.z = Math.PI;
    smile.rotation.x = -0.2;

    // Hair or head covering.
    const longHair = outfit === 'casual' || outfit === 'dress';
    if (outfit === 'nun') {
      // White coif framing the face and a long black veil.
      const linen = this.mat(new THREE.MeshStandardMaterial({ color: '#fbf8f3', roughness: 0.7, emissive: '#3a3833', side: THREE.DoubleSide }));
      const coif = add(this.head, new THREE.SphereGeometry(0.108, 32, 20, Math.PI * 1.5 + 0.62, Math.PI * 2 - 1.24, 0, Math.PI * 0.8), linen, 0, 0.1, 0.006);
      coif.scale.set(0.95, 1.02, 1.0);
      // White band across the forehead under the veil.
      const band = add(this.head, new THREE.SphereGeometry(0.1075, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.34), linen, 0, 0.1, 0.003);
      band.scale.set(0.95, 1.03, 1.0);
      const veilGeo = new THREE.SphereGeometry(0.122, 32, 20, Math.PI * 1.5 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.9);
      const vp = veilGeo.attributes.position as THREE.BufferAttribute;
      const vuv = veilGeo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < vp.count; i += 1) {
        const v = 1 - vuv.getY(i);
        const o = 1 + smooth((v - 0.45) / 0.55) * 0.35;
        vp.setXYZ(i, vp.getX(i) * o, vp.getY(i) - smooth((v - 0.4) / 0.6) * 0.32, vp.getZ(i) * o + (v > 0.5 ? (v - 0.5) * 0.12 : 0));
      }
      veilGeo.computeVertexNormals();
      add(this.head, veilGeo, this.mat(new THREE.MeshStandardMaterial({ color: '#16171d', roughness: 0.8, side: THREE.DoubleSide })), 0, 0.108, 0.01);
    } else if (longHair) {
      const frontGap = 1.2;
      const shell = add(this.head, new THREE.SphereGeometry(0.11, 36, 24, Math.PI * 1.5 + frontGap / 2, Math.PI * 2 - frontGap, 0, Math.PI * 0.78), hair, 0, 0.1, 0.01);
      shell.scale.set(0.97, 1.06, 1.05);
      const fringe = add(this.head, new THREE.SphereGeometry(0.108, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.3), hair, 0, 0.104, -0.002);
      fringe.scale.set(0.95, 1.05, 1.02);
      for (const s of [-1, 1]) {
        const side = add(this.head, new THREE.CapsuleGeometry(0.03, 0.08, 6, 10), hair, s * 0.083, 0.05, -0.02);
        side.rotation.z = s * 0.12;
        side.scale.z = 0.7;
      }
      add(this.head, new THREE.SphereGeometry(0.045, 18, 14), hair, 0, 0.09, 0.105).scale.set(1.1, 0.95, 0.9);
    } else {
      const cap = add(this.head, new THREE.SphereGeometry(0.106, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.104, 0.008);
      cap.scale.set(0.95, 1.04, 1.04);
      const back = add(this.head, new THREE.SphereGeometry(0.104, 24, 12, Math.PI * 0.2 - Math.PI / 2, Math.PI * 1.0, Math.PI * 0.45, Math.PI * 0.3), hair, 0, 0.1, 0.01);
      back.rotation.y = Math.PI;
    }

    // Lace chapel veil (미사보): open at the face, draping to the shoulders.
    const lace = laceTexture();
    lace.repeat.set(3.2, 1);
    this.disposables.push(lace);
    const veilGeo = new THREE.SphereGeometry(0.124, 48, 26, Math.PI * 1.5 + 0.98, Math.PI * 2 - 1.96, 0, Math.PI * 0.86);
    const pos = veilGeo.attributes.position as THREE.BufferAttribute;
    const uv = veilGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) {
      const v = 1 - uv.getY(i);
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const out = 1 + smooth((v - 0.5) / 0.5) * 0.3;
      const drop = smooth((v - 0.45) / 0.55) * 0.2;
      pos.setXYZ(i, x * out * 0.95, y - drop, z * out + (v > 0.55 ? (v - 0.55) * 0.05 : 0));
      uv.setY(i, 1 - v * 0.98);
    }
    veilGeo.computeVertexNormals();
    this.veil = new THREE.Mesh(veilGeo, this.mat(new THREE.MeshStandardMaterial({
      color: '#fbf7ef', map: lace, alphaMap: lace, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, roughness: 0.8, opacity: 0,
    })));
    this.veil.position.set(0, 0.104, 0.006);
    this.veil.scale.set(0.98, 1.05, 1.04);
    this.veil.visible = false;
    this.veil.castShadow = false;
    this.head.add(this.veil);
    if (outfit === 'dress') this.veilOn = true;

    // Arms and hands.
    const makeArm = (s: Side): ArmRig => {
      const shoulder = new THREE.Group();
      shoulder.position.set(SHOULDER.x * s, SHOULDER.y, SHOULDER.z);
      this.chest.add(shoulder);
      const sleeve = outfit === 'priest' || outfit === 'server' ? this.mat(new THREE.MeshStandardMaterial({ color: '#f7f4ec', roughness: 0.8 })) : top;
      add(shoulder, new THREE.SphereGeometry(0.044, seg, 14), sleeve);
      add(shoulder, new THREE.CylinderGeometry(0.046, 0.039, UPPER, seg), sleeve, 0, -UPPER / 2, 0);
      const elbow = new THREE.Group();
      elbow.position.y = -UPPER;
      shoulder.add(elbow);
      add(elbow, new THREE.SphereGeometry(0.039, seg, 12), sleeve);
      const wide = P.wideSleeves ? 0.062 : 0.033;
      add(elbow, new THREE.CylinderGeometry(0.039, wide, FORE - 0.035, seg, 1, P.wideSleeves), P.wideSleeves ? this.mat(new THREE.MeshStandardMaterial({ color: (sleeve as THREE.MeshStandardMaterial).color, roughness: 0.85, side: THREE.DoubleSide })) : sleeve, 0, -(FORE - 0.035) / 2, 0);
      if (!P.wideSleeves) {
        const cuff = add(elbow, new THREE.TorusGeometry(0.031, 0.0045, 6, 22), trim, 0, -FORE + 0.037, 0);
        cuff.rotation.x = Math.PI / 2;
      }
      add(elbow, new THREE.CylinderGeometry(0.024, 0.027, 0.06, 14), skin, 0, -FORE + 0.025, 0);
      add(elbow, new THREE.SphereGeometry(0.025, 14, 10), skin, 0, -FORE, 0);
      const hand = new THREE.Group();
      hand.position.y = -FORE;
      elbow.add(hand);
      add(hand, new RoundedBoxGeometry(0.027, PALM_LEN, 0.078, lite ? 1 : 3, 0.011), skin, 0, -PALM_LEN / 2 - 0.002, 0);
      const fingers: THREE.Group[][] = [];
      const fingerSpecs = lite ? [{ z: -0.0, seg: [0.05, 0.035, 0.0], r: 0.028 }] : FINGER_SPECS;
      for (const spec of fingerSpecs) {
        const chain: THREE.Group[] = [];
        let parent: THREE.Object3D = hand;
        let y = -PALM_LEN;
        spec.seg.forEach((len, k) => {
          const j = new THREE.Group();
          j.position.set(k === 0 ? -s * 0.0055 : 0, y, k === 0 ? spec.z : 0);
          parent.add(j);
          if (len > 0) {
            const r = spec.r * (1 - k * 0.08);
            const m = add(j, lite ? new THREE.BoxGeometry(0.02, len, 0.072) : new THREE.CapsuleGeometry(r, Math.max(0.001, len - r), 4, 10), skin, 0, -len / 2, 0);
            if (!lite && k === 2) {
              const nail = add(j, new THREE.SphereGeometry(r * 0.85, 10, 6), white, s * r * 0.55, -len * 0.62, 0, false);
              nail.scale.set(0.35, 1.1, 0.85);
            }
            void m;
          }
          chain.push(j);
          parent = j;
          y = -len;
        });
        fingers.push(chain);
      }
      const thumb: THREE.Group[] = [];
      let parent: THREE.Object3D = hand;
      [0.036, 0.03, 0.025].forEach((len, k) => {
        const j = new THREE.Group();
        if (k === 0) j.position.set(-s * 0.006, -0.018, -0.034);
        else j.position.y = -[0.036, 0.03][k - 1];
        parent.add(j);
        const r = 0.0108 * (1 - k * 0.08);
        if (!lite || k < 2) add(j, new THREE.CapsuleGeometry(r, len - r, 4, lite ? 6 : 10), skin, 0, -len / 2, 0);
        thumb.push(j);
        parent = j;
      });
      return {
        side: s, shoulder, elbow, hand, fingers, thumb,
        state: { wrist: V(0.21 * s, -0.47, 0.0), finger: DOWN.clone(), palm: V(-s, 0, 0), pole: V(0.3 * s, -0.2, 1), curl: 0.3, thumb: 0.15, spread: 0.04 },
      };
    };
    this.arms = { left: makeArm(-1), right: makeArm(1) };

    // Legs.
    const makeLeg = (s: Side): LegRig => {
      const hip = new THREE.Group();
      hip.position.set(0.092 * s, -0.03, 0);
      this.pelvis.add(hip);
      add(hip, new THREE.SphereGeometry(0.076, seg, 14), bottom);
      add(hip, new THREE.CylinderGeometry(0.072, 0.053, 0.43, seg), bottom, 0, -0.215, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.43;
      hip.add(knee);
      add(knee, new THREE.SphereGeometry(0.054, seg, 12), bottom);
      add(knee, new THREE.CylinderGeometry(0.052, 0.042, 0.4, seg), P.long ? this.mat(new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 0.9 })) : bottom, 0, -0.2, 0);
      const ankle = new THREE.Group();
      ankle.position.y = -0.41;
      knee.add(ankle);
      add(ankle, new RoundedBoxGeometry(0.088, 0.064, 0.245, lite ? 1 : 3, 0.028), shoeMat, 0, -0.03, -0.058);
      return { hip, knee, ankle };
    };
    this.legs = { left: makeLeg(-1), right: makeLeg(1) };

    // Rosary held between the hands (decades of ten small beads, five large beads, medal, crucifix).
    if (!lite || opts.rosary) {
      const bead = this.mat(new THREE.MeshStandardMaterial({ color: '#e8dccb', roughness: 0.25, metalness: 0.1 }));
      const loop = 55;
      for (let i = 0; i < loop; i += 1) {
        const a = Math.PI / 2 + (i / loop) * Math.PI * 2;
        const large = i % 11 === 0;
        add(this.rosary, new THREE.SphereGeometry(large ? 0.0085 : 0.006, 8, 6), large ? gold : bead, Math.cos(a) * 0.05, Math.sin(a) * 0.085 - 0.085, 0, false);
      }
      for (let i = 0; i < 4; i += 1) add(this.rosary, new THREE.SphereGeometry(i === 0 ? 0.0085 : 0.006, 8, 6), i === 0 ? gold : bead, 0, -0.18 - i * 0.017, 0, false);
      add(this.rosary, new THREE.BoxGeometry(0.007, 0.05, 0.004), gold, 0, -0.27, 0, false);
      add(this.rosary, new THREE.BoxGeometry(0.03, 0.007, 0.004), gold, 0, -0.259, 0, false);
    }
    this.rosary.position.set(0, -0.2, -0.235);
    this.rosary.visible = false;
    this.chest.add(this.rosary);

    // Hymn book for choir members and readers.
    const bookMat = this.mat(new THREE.MeshStandardMaterial({ color: '#5a1a22', roughness: 0.7 }));
    add(this.book, new THREE.BoxGeometry(0.2, 0.026, 0.15), bookMat, 0, 0, 0, false);
    add(this.book, new THREE.BoxGeometry(0.19, 0.02, 0.14), white, 0, 0.014, 0, false);
    this.book.position.set(0, -0.08, -0.3);
    this.book.rotation.x = -0.9;
    this.book.visible = false;
    this.chest.add(this.book);

    // Taper for lighting votive candles; it lives in the right fist.
    add(this.taper, new THREE.CylinderGeometry(0.0055, 0.0055, 0.34, 10), this.mat(new THREE.MeshStandardMaterial({ color: '#f1e6cc', roughness: 0.5 })), 0, 0, 0, false).rotation.x = Math.PI / 2;
    const flameTex = flameTexture();
    this.disposables.push(flameTex);
    this.taperFlame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.taperFlame.scale.set(0.025, 0.05, 1);
    this.taperFlame.position.set(0, 0.02, -0.175);
    this.taper.add(this.taperFlame);
    this.taper.position.set(-0.0, -0.05, -0.1);
    this.taper.visible = false;
    this.arms.right.hand.add(this.taper);

    // Name plate.
    const tex = labelTexture(opts.name.trim().slice(0, 18) || '순례자');
    this.disposables.push(tex);
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    this.label.scale.set(0.5, 0.095, 1);
    this.label.position.set(0, 2.08, 0);
    this.label.visible = opts.showName ?? true;
    this.root.add(this.label);
  }

  private mat<T extends THREE.Material>(m: T): T {
    this.disposables.push(m);
    return m;
  }

  /** World position of a chest-space point (e.g. to aim the camera at the face). */
  headWorld(out = new THREE.Vector3()) {
    return this.head.localToWorld(out.set(0, 0.1, 0));
  }

  get busy() {
    return this.gesture !== null;
  }

  get currentGesture() {
    return this.gesture;
  }

  setPosture(p: Posture, seatHeight = 0.45) {
    this.posture = p;
    this.seatHeight = seatHeight;
  }

  setHands(h: HandsMode) {
    this.hands = h;
    this.rosary.visible = h === 'rosary';
    this.book.visible = h === 'book';
  }

  /** Begin a timed gesture. `cue` fires at the gesture's key moment (touch, ignition, veil drop). */
  play(g: Gesture, opts: { target?: THREE.Vector3; onDone?: () => void; onCue?: () => void } = {}) {
    if (this.gesture && this.gestureDone) this.gestureDone();
    this.gesture = g;
    this.gestureTime = 0;
    this.cueFired = false;
    this.gestureDone = opts.onDone ?? null;
    this.gestureCue = opts.onCue ?? null;
    if (opts.target) this.gestureTarget.copy(opts.target);
    if (g === 'veilOn') this.veil.visible = true;
  }

  cancelGesture() {
    this.gesture = null;
    this.gestureDone = null;
    this.gestureCue = null;
    this.taper.visible = false;
  }

  /** Bead advance pulse for the rosary (thumb slides to the next bead). */
  nextBead() {
    this.beadPulse = 1;
  }

  update(dt: number, moving: boolean, speed = 1) {
    this.time += dt;
    const k = (rate: number) => 1 - Math.exp(-dt * rate);

    // Posture blend (sit / kneel) and walking phase.
    this.sitT += ((this.posture === 'sit' ? 1 : 0) - this.sitT) * k(4.2);
    this.kneelT += ((this.posture === 'kneel' ? 1 : 0) - this.kneelT) * k(3.6);
    if (moving) this.gait += dt * 7.4 * speed;
    const walk = moving ? 1 : 0;
    const swing = Math.sin(this.gait) * walk;

    const sitPelvis = this.seatHeight + 0.075;
    const kneelPelvis = 0.525;
    this.pelvis.position.y = PELVIS_Y - this.sitT * (PELVIS_Y - sitPelvis) - this.kneelT * (PELVIS_Y - kneelPelvis)
      + (moving ? Math.abs(Math.cos(this.gait)) * 0.018 - 0.01 : 0);
    this.pelvis.position.z = this.sitT * 0.06;
    for (const [name, s] of [['left', -1], ['right', 1]] as const) {
      const leg = this.legs[name];
      const phase = s > 0 ? swing : -swing;
      leg.hip.rotation.x = this.sitT * (Math.PI / 2) + this.kneelT * 0.04 + phase * 0.42;
      leg.knee.rotation.x = -this.sitT * (Math.PI / 2) - this.kneelT * (Math.PI / 2) - Math.max(0, -Math.sin(this.gait + (s > 0 ? 0 : Math.PI))) * 0.55 * walk;
      leg.ankle.rotation.x = -this.kneelT * (Math.PI / 2) + (moving ? Math.max(0, phase) * 0.2 : 0);
      leg.hip.rotation.z = s * 0.02;
    }

    // Spine, neck and head base attitude.
    let spineBend = -0.02 * this.kneelT - 0.04 * this.sitT;
    let headPitch = 0;
    let headTurn = 0;
    if (this.hands === 'prayer') { headPitch -= 0.22; spineBend -= 0.03; }
    if (this.hands === 'rosary') headPitch -= 0.3;
    if (this.hands === 'book') headPitch -= 0.25;
    if (this.hands === 'orans') headPitch += 0.05;

    // Arm targets for the base hand mode.
    const breath = Math.sin(this.time * 1.3) * 0.006;
    const rest = (s: Side): ArmTarget => {
      if (this.sitT > 0.5 && this.hands === 'rest') {
        return { wrist: V(0.13 * s, -0.31, -0.21), finger: V(-0.08 * s, -0.25, -1), palm: V(0, -1, 0), pole: V(0.6 * s, -0.4, 0.6), curl: 0.35, thumb: 0.15, spread: 0.03 };
      }
      return {
        wrist: V(0.205 * s, -0.465 + this.kneelT * 0.02, 0.0 - swing * s * -0.13 * 1),
        finger: V(0.02 * s, -1, -swing * s * 0.25),
        palm: V(-s, 0, 0.05),
        pole: V(0.25 * s, -0.1, 1),
        curl: 0.32, thumb: 0.15, spread: 0.04,
      };
    };
    const prayerHands = (s: Side, lift = 0): ArmTarget => {
      const f = V(0, 0.93, -0.36).normalize();
      const centre = V(0.0138 * s, -0.035 + lift + breath, -0.255);
      return { wrist: centre.clone().sub(f.clone().multiplyScalar(PALM_LEN * 0.5)), finger: f, palm: V(-s, 0, 0), pole: V(0.65 * s, -1, 0.25), curl: 0.02, thumb: 0.05, spread: 0.0 };
    };
    const rosaryHands = (s: Side): ArmTarget => ({
      wrist: V(0.045 * s, -0.2, -0.2),
      finger: V(-0.55 * s, 0.25, -0.8),
      palm: V(-0.4 * s, 0.85, 0.1),
      pole: V(0.7 * s, -1, 0.2),
      curl: 0.75,
      thumb: 0.55 + (s > 0 ? this.beadPulse * 0.3 : 0),
      spread: 0.02,
    });
    const orans = (s: Side): ArmTarget => ({
      wrist: V(0.33 * s, 0.02 + breath, -0.2), finger: V(0.28 * s, 1, -0.15), palm: V(0.1 * s, 0.15, -1),
      pole: V(1 * s, -1, 0.3), curl: 0.12, thumb: 0.1, spread: 0.06,
    });
    const bookHands = (s: Side): ArmTarget => ({
      wrist: V(0.1 * s, -0.17 + breath, -0.24), finger: V(-0.25 * s, 0.35, -1), palm: V(0, 1, 0.3),
      pole: V(0.8 * s, -1, 0.3), curl: 0.35, thumb: 0.2, spread: 0.02,
    });
    const base = (s: Side) => {
      switch (this.hands) {
        case 'prayer': return prayerHands(s);
        case 'rosary': return rosaryHands(s);
        case 'orans': return orans(s);
        case 'book': return bookHands(s);
        default: return rest(s);
      }
    };
    let left = base(-1);
    let right = base(1);
    this.beadPulse = Math.max(0, this.beadPulse - dt * 2.5);

    // Timed gestures override the base targets.
    let follow = 9;
    if (this.gesture) {
      this.gestureTime += dt;
      const t = this.gestureTime;
      const len = GESTURE_LENGTH[this.gesture];
      const out = this.evalGesture(this.gesture, t, rest(-1), rest(1));
      if (out.left) left = out.left;
      if (out.right) right = out.right;
      spineBend += out.spine ?? 0;
      headPitch += out.head ?? 0;
      headTurn += out.turn ?? 0;
      follow = out.follow ?? 14;
      if (out.cue && !this.cueFired) {
        this.cueFired = true;
        this.gestureCue?.();
      }
      if (t >= len) {
        const done = this.gestureDone;
        const g = this.gesture;
        this.gesture = null;
        this.gestureDone = null;
        this.gestureCue = null;
        this.taper.visible = false;
        if (g === 'veilOff') this.veil.visible = false;
        done?.();
      }
    }
    this.veilT += ((this.veilOn ? 1 : 0) - this.veilT) * (this.gesture === 'veilOn' || this.gesture === 'veilOff' ? 0 : k(6));
    this.applyVeil();

    this.spine.rotation.x += (spineBend - this.spine.rotation.x) * k(8);
    this.neck.rotation.x += (headPitch * 0.35 - this.neck.rotation.x) * k(8);
    this.head.rotation.x += (headPitch * 0.65 - this.head.rotation.x) * k(8);
    this.head.rotation.y += (headTurn - this.head.rotation.y) * k(6);
    this.chest.rotation.y = moving ? swing * 0.04 : 0;

    // Arms toward their targets, then solve.
    this.blendArm(this.arms.left, left, k(follow));
    this.blendArm(this.arms.right, right, k(follow));
    this.chest.updateMatrixWorld(true);
    this.solveArm(this.arms.left);
    this.solveArm(this.arms.right);

    this.deformRobe();

    // Blink every few seconds.
    this.blinkAt -= dt;
    // Lid is the upper half of a sphere over the eye; swinging it forward closes the eye.
    let close = 0;
    if (this.blinkAt < 0.12) close = 1 - Math.abs(this.blinkAt - 0.06) / 0.06;
    if (this.blinkAt < 0) this.blinkAt = 2.5 + Math.random() * 3;
    if (this.hands === 'prayer' || this.gesture === 'amen' || this.hands === 'rosary') close = 0.88; // eyes lowered in prayer
    const lidAngle = 0.62 - close * 1.95; // tilted back = open, forward = closed
    this.eyelids.forEach(e => { e.rotation.x += (lidAngle - e.rotation.x) * Math.min(1, dt * 25); });
    this.taperFlame.scale.set(0.022 + Math.sin(this.time * 23) * 0.002, 0.048 + Math.sin(this.time * 17) * 0.004, 1);
  }

  /** Bends the long robe along the average leg so it drapes over the lap when seated or kneeling. */
  private deformRobe() {
    if (!this.robe || !this.robeBase) return;
    const L = this.legs.left, R = this.legs.right;
    const a = (L.hip.rotation.x + R.hip.rotation.x) / 2;
    const b = a + (L.knee.rotation.x + R.knee.rotation.x) / 2;
    const thigh = 0.43;
    const pos = this.robe.geometry.attributes.position as THREE.BufferAttribute;
    const base = this.robeBase;
    for (let i = 0; i < pos.count; i += 1) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      const h = Math.max(0, -y - 0.03);
      let cy: number, cz: number;
      if (h <= thigh) { cy = -0.03 - Math.cos(a) * h; cz = -Math.sin(a) * h; }
      else {
        const r = h - thigh;
        cy = -0.03 - Math.cos(a) * thigh - Math.cos(b) * r;
        cz = -Math.sin(a) * thigh - Math.sin(b) * r;
      }
      // The cross-section turns with the leg so the cloth wraps the thighs instead of flattening.
      const th = THREE.MathUtils.lerp(a, b, smooth((h - thigh + 0.08) / 0.16));
      const oy = -z * Math.sin(th), oz = z * Math.cos(th);
      // Hem never sinks through the floor (pelvis height above ground).
      const floor = -this.pelvis.position.y + 0.02;
      pos.setXYZ(i, x, Math.max(floor, cy + oy), cz + oz);
    }
    pos.needsUpdate = true;
    this.robe.geometry.computeVertexNormals();
  }

  private applyVeil() {
    const t = this.veilT;
    const m = this.veil.material as THREE.MeshStandardMaterial;
    m.opacity = Math.min(1, t * 1.6);
    this.veil.position.y = 0.104 + (1 - t) * 0.11;
    this.veil.scale.set(0.95 - (1 - t) * 0.12, 0.6 + 0.45 * t, 1.02 - (1 - t) * 0.12);
    this.veil.visible = t > 0.01 || this.gesture === 'veilOn';
  }

  /** Converts a world point into chest space (for reaching toward scenery). */
  private toChest(world: THREE.Vector3) {
    this.chest.updateMatrixWorld(true);
    return this.chest.worldToLocal(world.clone());
  }

  private evalGesture(g: Gesture, t: number, restL: ArmTarget, restR: ArmTarget): {
    left?: ArmTarget; right?: ArmTarget; spine?: number; head?: number; turn?: number; cue?: boolean; follow?: number;
  } {
    const flat = (wrist: THREE.Vector3, finger: THREE.Vector3, palm: THREE.Vector3, pole: THREE.Vector3, curl = 0.02): ArmTarget =>
      ({ wrist, finger: finger.clone().normalize(), palm: palm.clone().normalize(), pole, curl, thumb: 0.08, spread: 0 });

    if (g === 'cross') {
      // Forehead → chest → left shoulder → right shoulder, with a short pause on each.
      const towardBody = V(0, 0, 1);
      const pole = V(1, -0.9, 0.25);
      const key = (tip: THREE.Vector3, f: THREE.Vector3) => {
        const fn = f.clone().normalize();
        return flat(fromTip(tip, fn), fn, towardBody, pole);
      };
      const forehead = key(V(0.0, HEAD_CENTER.y + 0.05, -0.136), V(-0.22, 0.8, 0.5));
      const chest = key(V(0.0, -0.01, -0.128), V(-0.3, 0.55, 0.78));
      const lShoulder = key(V(-0.168, 0.045, -0.045), V(-0.6, 0.52, 0.6));
      const rShoulder = key(V(0.168, 0.045, -0.045), V(0.05, 0.72, 0.69));
      const restPose = cloneTarget(restR);
      const frames: [number, ArmTarget][] = [
        [0.0, restPose], [0.55, forehead], [0.9, forehead], [1.45, chest], [1.75, chest],
        [2.3, lShoulder], [2.6, lShoulder], [3.1, rShoulder], [3.4, rShoulder], [3.9, cloneTarget(restR)],
      ];
      const right = this.keyframes(frames, t, 0.05);
      const touching = [[0.55, 0.9], [1.45, 1.75], [2.3, 2.6], [3.1, 3.4]].some(([a, b]) => t >= a && t <= b);
      return { right, left: restL, head: -0.06 - (t > 0.4 && t < 1.0 ? 0.06 : 0), cue: t > 3.1, follow: touching ? 30 : 22 };
    }
    if (g === 'amen') {
      const f = V(0, 0.93, -0.36).normalize();
      const at = (s: Side) => flat(V(0.0138 * s, -0.03, -0.255).sub(f.clone().multiplyScalar(PALM_LEN * 0.5)), f, V(-s, 0, 0), V(0.65 * s, -1, 0.25));
      const on = t < 1.0;
      return on ? { left: at(-1), right: at(1), head: -0.25, follow: 12 } : { follow: 9, head: -0.1 };
    }
    if (g === 'dip') {
      const reach = flat(V(0.08, -0.33, -0.42), V(0, -0.65, -0.75), V(0, -0.2, 1), V(1, -0.5, 0.3), 0.15);
      const frames: [number, ArmTarget][] = [[0, cloneTarget(restR)], [0.6, reach], [1.1, reach], [1.9, cloneTarget(restR)]];
      return { right: this.keyframes(frames, t, 0), left: restL, spine: -0.12 * Math.sin(Math.min(1, t / 1.9) * Math.PI), head: -0.15, cue: t > 0.8 };
    }
    if (g === 'bow') {
      const p = Math.sin(Math.min(1, t / 1.8) * Math.PI);
      const join = (s: Side) => flat(V(0.04 * s, -0.42, -0.12), V(-0.2 * s, -0.9, -0.2), V(-s, 0, 0.3), V(0.6 * s, -0.5, 0.5), 0.35);
      return { left: join(-1), right: join(1), spine: -0.42 * p, head: -0.32 * p, follow: 10 };
    }
    if (g === 'greet') {
      const up = smooth(t / 0.4) * (1 - smooth((t - 1.6) / 0.4));
      const wave = Math.sin(t * 9) * 0.35;
      const raised = flat(V(0.3, 0.2, -0.12), V(0.15 + wave * 0.6, 1, 0.1), V(0, 0, -1), V(1, -0.6, 0.2), 0.05);
      return { right: this.mix(restR, raised, up), left: restL, follow: 16 };
    }
    if (g === 'veilOn' || g === 'veilOff') {
      // Both hands lift the veil above the head and lower it onto the hair (or the reverse).
      const above = (s: Side) => flat(fromTip(V(0.11 * s, HEAD_CENTER.y + 0.2, -0.02), V(0.15 * s, 1, 0.1)), V(0.15 * s, 1, 0.1), V(-s, 0, 0), V(1 * s, -0.5, 0.3), 0.55);
      const temple = (s: Side) => flat(fromTip(V(0.135 * s, HEAD_CENTER.y + 0.02, -0.0), V(0.1 * s, 1, 0.15)), V(0.1 * s, 1, 0.15), V(-s, 0, 0), V(1 * s, -0.6, 0.3), 0.5);
      const on = g === 'veilOn';
      const seq = (s: Side): [number, ArmTarget][] => on
        ? [[0, cloneTarget(s > 0 ? restR : restL)], [0.7, above(s)], [1.0, above(s)], [1.7, temple(s)], [1.9, temple(s)], [2.5, cloneTarget(s > 0 ? restR : restL)]]
        : [[0, cloneTarget(s > 0 ? restR : restL)], [0.6, temple(s)], [0.8, temple(s)], [1.5, above(s)], [1.6, above(s)], [2.3, cloneTarget(s > 0 ? restR : restL)]];
      // Veil follows the hands: from above the head down to the hair, or back up.
      if (on) this.veilT = t < 1.0 ? smooth(t / 1.0) * 0.08 : 0.08 + smooth((t - 1.0) / 0.75) * 0.92;
      else this.veilT = t < 0.8 ? 1 : 1 - smooth((t - 0.8) / 0.8);
      if (on && t > 1.75) this.veilOn = true;
      if (!on && t > 0.8) this.veilOn = false;
      return { left: this.keyframes(seq(-1), t, 0), right: this.keyframes(seq(1), t, 0), head: -0.05, cue: on ? t > 1.7 : t > 1.5, follow: 18 };
    }
    if (g === 'light') {
      // Take a taper, reach to the candle, hold until it catches, step back.
      this.taper.visible = t > 0.25 && t < 3.9;
      this.taperFlame.visible = true;
      const target = this.toChest(this.gestureTarget);
      const D = target.clone().sub(V(SHOULDER.x, SHOULDER.y, 0)).normalize().add(V(0, -0.35, 0)).normalize(); // taper direction
      const n = V(-1, 0, 0);
      const R = this.handBasis(this.fingerFromThumbDir(D, n, 1), n, 1);
      const tipLocal = V(0, -0.05, -0.27);
      const wrist = target.clone().sub(tipLocal.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(R)));
      const holdPose: ArmTarget = { wrist, finger: this.fingerFromThumbDir(D, n, 1), palm: n, pole: V(1, -1, 0.4), curl: 1.15, thumb: 0.9, spread: 0 };
      const grab: ArmTarget = { ...cloneTarget(restR), curl: 1.15, thumb: 0.9 };
      const frames: [number, ArmTarget][] = [[0, cloneTarget(restR)], [0.4, grab], [1.4, holdPose], [2.6, holdPose], [3.5, grab], [4.2, cloneTarget(restR)]];
      return { right: this.keyframes(frames, t, 0), left: restL, head: -0.12, cue: t > 2.0, follow: 14 };
    }
    return {};
  }

  private keyframes(frames: [number, ArmTarget][], t: number, arc: number): ArmTarget {
    if (t <= frames[0][0]) return cloneTarget(frames[0][1]);
    for (let i = 0; i < frames.length - 1; i += 1) {
      const [ta, a] = frames[i];
      const [tb, b] = frames[i + 1];
      if (t >= ta && t <= tb) {
        const u = smooth((t - ta) / Math.max(0.001, tb - ta));
        const m = this.mix(a, b, u);
        if (arc > 0 && !a.wrist.equals(b.wrist)) m.wrist.z -= Math.sin(u * Math.PI) * arc; // lift away from the body between touches
        return m;
      }
    }
    return cloneTarget(frames[frames.length - 1][1]);
  }

  private mix(a: ArmTarget, b: ArmTarget, u: number): ArmTarget {
    return {
      wrist: a.wrist.clone().lerp(b.wrist, u),
      finger: a.finger.clone().lerp(b.finger, u).normalize(),
      palm: a.palm.clone().lerp(b.palm, u).normalize(),
      pole: a.pole.clone().lerp(b.pole, u),
      curl: THREE.MathUtils.lerp(a.curl, b.curl, u),
      thumb: THREE.MathUtils.lerp(a.thumb, b.thumb, u),
      spread: THREE.MathUtils.lerp(a.spread, b.spread, u),
    };
  }

  private blendArm(arm: ArmRig, target: ArmTarget, a: number) {
    const s = arm.state;
    s.wrist.lerp(target.wrist, a);
    s.finger.lerp(target.finger, a).normalize();
    s.palm.lerp(target.palm, a).normalize();
    s.pole.lerp(target.pole, a);
    s.curl += (target.curl - s.curl) * a;
    s.thumb += (target.thumb - s.thumb) * a;
    s.spread += (target.spread - s.spread) * a;
  }

  /** Hand rotation whose local -Y points along the fingers and whose palm faces `palm`. */
  private handBasis(finger: THREE.Vector3, palm: THREE.Vector3, side: Side) {
    const f = finger.clone().normalize();
    const n = palm.clone().sub(f.clone().multiplyScalar(palm.dot(f)));
    if (n.lengthSq() < 1e-6) n.set(-side, 0, 0);
    n.normalize();
    const ex = n.clone().multiplyScalar(-side);
    const ey = f.clone().negate();
    const ez = new THREE.Vector3().crossVectors(ex, ey);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
  }

  /** Finger direction that makes the thumb side (local -Z) point along `thumbDir`. */
  private fingerFromThumbDir(thumbDir: THREE.Vector3, palm: THREE.Vector3, side: Side) {
    const ex = palm.clone().normalize().multiplyScalar(-side);
    const ez = thumbDir.clone().normalize().negate();
    const ey = new THREE.Vector3().crossVectors(ez, ex);
    return ey.negate().normalize();
  }

  private solveArm(arm: ArmRig) {
    const s = arm.state;
    const S = arm.shoulder.position;
    const toT = s.wrist.clone().sub(S);
    const len = Math.max(0.001, toT.length());
    const d = THREE.MathUtils.clamp(len, 0.06, UPPER + FORE - 0.002);
    const dir = toT.divideScalar(len);
    const cosA = THREE.MathUtils.clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const pole = s.pole.clone().sub(dir.clone().multiplyScalar(s.pole.dot(dir)));
    if (pole.lengthSq() < 1e-6) pole.set(arm.side, -1, 0.5).sub(dir.clone().multiplyScalar(dir.y));
    pole.normalize();
    const elbowPos = S.clone().add(dir.clone().multiplyScalar(UPPER * cosA)).add(pole.multiplyScalar(UPPER * sinA));
    const wristPos = S.clone().add(dir.clone().multiplyScalar(d));
    const qU = new THREE.Quaternion().setFromUnitVectors(DOWN, elbowPos.clone().sub(S).normalize());
    const qF = new THREE.Quaternion().setFromUnitVectors(DOWN, wristPos.clone().sub(elbowPos).normalize());
    arm.shoulder.quaternion.copy(qU);
    arm.elbow.quaternion.copy(qU.clone().invert().multiply(qF));
    const qH = this.handBasis(s.finger, s.palm, arm.side);
    arm.hand.quaternion.copy(qF.clone().invert().multiply(qH));

    // Fingers curl toward the palm (rotation about local Z), the little finger a bit more.
    arm.fingers.forEach((chain, i) => {
      const c = s.curl * (1 + i * 0.06);
      const spread = (i - 1.5) * s.spread;
      chain[0].rotation.set(spread * -0.6, 0, -arm.side * c * 0.85);
      chain[1].rotation.set(0, 0, -arm.side * c * 1.05);
      chain[2].rotation.set(0, 0, -arm.side * c * 0.75);
    });
    // Thumb: alongside the index when flat, swung across the palm when gripping.
    arm.thumb[0].rotation.set(0.16 + s.thumb * 0.6, 0, -arm.side * (0.06 + s.thumb * 0.55));
    arm.thumb[1].rotation.set(0, 0, -arm.side * s.thumb * 0.45);
    arm.thumb[2].rotation.set(0, 0, -arm.side * s.thumb * 0.35);
  }

  dispose() {
    this.root.traverse(o => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.disposables.forEach(d => d.dispose());
  }
}
