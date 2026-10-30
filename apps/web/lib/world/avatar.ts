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
const HEAD_CENTER = V(0, 0.235, 0); // chest space
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
export type HandsMode = 'rest' | 'prayer' | 'rosary';
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

export type AvatarOptions = { name: string };

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
    const skin = this.mat(new THREE.MeshStandardMaterial({ color: '#e2b598', roughness: 0.58, metalness: 0 }));
    const skinShade = this.mat(new THREE.MeshStandardMaterial({ color: '#d4a283', roughness: 0.62 }));
    const hair = this.mat(new THREE.MeshStandardMaterial({ color: '#2a1d17', roughness: 0.55, metalness: 0.05 }));
    const knit = knitTexture('#d9cdb8');
    this.disposables.push(knit);
    const sweater = this.mat(new THREE.MeshStandardMaterial({ color: '#ffffff', map: knit, roughness: 0.92 }));
    const cuffMat = this.mat(new THREE.MeshStandardMaterial({ color: '#c7b99f', roughness: 0.9 }));
    const trousers = this.mat(new THREE.MeshStandardMaterial({ color: '#32363c', roughness: 0.86 }));
    const shoeMat = this.mat(new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.45, metalness: 0.05 }));
    const white = this.mat(new THREE.MeshStandardMaterial({ color: '#f6f2ec', roughness: 0.25 }));
    const iris = this.mat(new THREE.MeshStandardMaterial({ color: '#4b3326', roughness: 0.3 }));
    const pupil = this.mat(new THREE.MeshStandardMaterial({ color: '#0c0b0b', roughness: 0.2 }));
    const lip = this.mat(new THREE.MeshStandardMaterial({ color: '#b56f68', roughness: 0.48 }));
    const brow = this.mat(new THREE.MeshStandardMaterial({ color: '#2a1d17', roughness: 0.8 }));

    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const lathe = (pts: [number, number][], seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

    // Hierarchy.
    this.root.add(this.pelvis);
    this.pelvis.position.y = PELVIS_Y;
    this.pelvis.add(this.spine);
    this.spine.position.y = SPINE_Y;
    this.spine.add(this.chest);
    this.chest.position.y = CHEST_Y;
    this.chest.add(this.neck);
    this.neck.position.y = 0.1;
    this.neck.add(this.head);
    this.head.position.y = HEAD_PIVOT.y - 0.1;

    // Hips and seat, in trousers.
    const hips = add(this.pelvis, lathe([[0, -0.1], [0.12, -0.098], [0.14, -0.06], [0.143, 0.0], [0.139, 0.07], [0.136, 0.11]]), trousers);
    hips.scale.z = 0.72;
    // Sweater torso from the waist to the shoulders.
    const torso = add(this.spine, lathe([[0.0, -0.035], [0.139, -0.035], [0.141, 0.0], [0.147, 0.09], [0.16, 0.18], [0.174, 0.26], [0.186, 0.31], [0.183, 0.345], [0.155, 0.385], [0.1, 0.41], [0.058, 0.425], [0.0, 0.43]], 32), sweater);
    torso.scale.z = 0.7;
    const collar = add(this.chest, new THREE.TorusGeometry(0.058, 0.014, 8, 28), cuffMat, 0, 0.115, 0.004);
    collar.rotation.x = Math.PI / 2;
    collar.scale.y = 0.82;
    add(this.neck, new THREE.CylinderGeometry(0.043, 0.047, 0.12, 18), skin, 0, 0.02, 0.006);

    // Head: cranium, jaw, face, ears and hair.
    // One sculpted surface: egg-shaped cranium narrowing to the jaw and a soft chin.
    const headGeo = new THREE.SphereGeometry(0.1, 48, 36);
    const hp = headGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < hp.count; i += 1) {
      let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
      const lower = Math.max(0, -y / 0.1); // 0 at the eyes, 1 at the chin
      x *= 0.84 * (1 - 0.34 * Math.pow(lower, 1.6));
      z *= 0.96 * (1 - 0.18 * Math.pow(lower, 1.4));
      if (z < 0) z *= 0.92 + 0.08 * (1 - lower); // flatter face plane
      if (y < 0) y *= 1.18;
      z -= lower * lower * 0.012; // chin forward
      hp.setXYZ(i, x, y * 1.05, z);
    }
    headGeo.computeVertexNormals();
    add(this.head, headGeo, skin, 0, 0.1, 0.004);
    for (const s of [-1, 1]) {
      const ear = add(this.head, new THREE.SphereGeometry(0.021, 14, 10), skinShade, s * 0.083, 0.094, 0.012);
      ear.scale.set(0.42, 1.0, 0.72);
      // Eye: white, iris, pupil, catch light and a blinking lid.
      const eyeY = 0.108, eyeZ = -0.082, eyeX = s * 0.031;
      const eye = add(this.head, new THREE.SphereGeometry(0.0128, 18, 14), white, eyeX, eyeY, eyeZ, false);
      eye.scale.set(1.1, 0.78, 0.7);
      const irisM = add(this.head, new THREE.CircleGeometry(0.0074, 20), iris, eyeX, eyeY, eyeZ - 0.0092, false);
      irisM.rotation.y = Math.PI;
      const pupilM = add(this.head, new THREE.CircleGeometry(0.0036, 16), pupil, eyeX, eyeY, eyeZ - 0.0095, false);
      pupilM.rotation.y = Math.PI;
      const glint = add(this.head, new THREE.CircleGeometry(0.0016, 8), white, eyeX + 0.0025, eyeY + 0.0028, eyeZ - 0.0098, false);
      glint.rotation.y = Math.PI;
      const lid = add(this.head, new THREE.SphereGeometry(0.0142, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin, eyeX, eyeY + 0.0005, eyeZ + 0.0005, false);
      lid.scale.set(1.12, 1.0, 0.8);
      this.eyelids.push(lid);
      const lash = add(this.head, new THREE.TorusGeometry(0.0118, 0.0013, 4, 16, Math.PI), brow, eyeX, eyeY + 0.0012, eyeZ - 0.003, false);
      lash.scale.set(1.1, 0.7, 1);
      const browM = add(this.head, new THREE.CapsuleGeometry(0.0024, 0.024, 4, 8), brow, s * 0.033, 0.129, -0.086, false);
      browM.rotation.z = Math.PI / 2 - s * 0.1;
    }
    const noseBridge = add(this.head, new THREE.CapsuleGeometry(0.0062, 0.028, 6, 10), skin, 0, 0.09, -0.091, false);
    noseBridge.rotation.x = -0.32;
    const noseTip = add(this.head, new THREE.SphereGeometry(0.0095, 14, 10), skin, 0, 0.075, -0.098, false);
    noseTip.scale.set(1.1, 0.85, 0.95);
    for (const s of [-1, 1]) add(this.head, new THREE.SphereGeometry(0.0058, 10, 8), skinShade, s * 0.0085, 0.072, -0.093, false);
    const upperLip = add(this.head, new THREE.CapsuleGeometry(0.0052, 0.019, 4, 10), lip, 0, 0.051, -0.087, false);
    upperLip.rotation.z = Math.PI / 2;
    upperLip.scale.set(1, 1, 0.8);
    const lowerLip = add(this.head, new THREE.CapsuleGeometry(0.0056, 0.016, 4, 10), lip, 0, 0.0425, -0.0845, false);
    lowerLip.rotation.z = Math.PI / 2;
    lowerLip.scale.set(1, 1, 0.85);
    // Hair: a shell open at the face, a fringe cap and a low bun.
    const frontGap = 1.15;
    const shell = add(this.head, new THREE.SphereGeometry(0.113, 36, 24, Math.PI * 1.5 + frontGap / 2, Math.PI * 2 - frontGap, 0, Math.PI * 0.74), hair, 0, 0.098, 0.008);
    shell.scale.set(0.9, 1.08, 1.03);
    const fringe = add(this.head, new THREE.SphereGeometry(0.111, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.27), hair, 0, 0.1, 0.0);
    fringe.scale.set(0.89, 1.07, 1.0);
    add(this.head, new THREE.SphereGeometry(0.042, 18, 14), hair, 0, 0.072, 0.105).scale.set(1.1, 0.9, 0.9);

    // Lace mantilla (chapel veil): open at the face, draping to the shoulders.
    const lace = laceTexture();
    lace.repeat.set(3.2, 1);
    this.disposables.push(lace);
    const veilGeo = new THREE.SphereGeometry(0.124, 48, 26, Math.PI * 1.5 + 0.98, Math.PI * 2 - 1.96, 0, Math.PI * 0.86);
    const pos = veilGeo.attributes.position as THREE.BufferAttribute;
    const uv = veilGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) {
      const v = 1 - uv.getY(i); // 0 at the crown, 1 at the hem
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
    this.veil.scale.set(0.95, 1.05, 1.02);
    this.veil.visible = false;
    this.veil.castShadow = false;
    this.head.add(this.veil);

    // Arms and hands.
    const makeArm = (s: Side): ArmRig => {
      const shoulder = new THREE.Group();
      shoulder.position.set(SHOULDER.x * s, SHOULDER.y, SHOULDER.z);
      this.chest.add(shoulder);
      add(shoulder, new THREE.SphereGeometry(0.044, 20, 16), sweater);
      add(shoulder, new THREE.CylinderGeometry(0.046, 0.039, UPPER, 18), sweater, 0, -UPPER / 2, 0);
      const elbow = new THREE.Group();
      elbow.position.y = -UPPER;
      shoulder.add(elbow);
      add(elbow, new THREE.SphereGeometry(0.039, 18, 14), sweater);
      add(elbow, new THREE.CylinderGeometry(0.039, 0.033, FORE - 0.035, 18), sweater, 0, -(FORE - 0.035) / 2, 0);
      const cuff = add(elbow, new THREE.TorusGeometry(0.031, 0.0045, 6, 22), cuffMat, 0, -FORE + 0.037, 0);
      cuff.rotation.x = Math.PI / 2;
      add(elbow, new THREE.CylinderGeometry(0.025, 0.028, 0.04, 16), skin, 0, -FORE + 0.02, 0);
      add(elbow, new THREE.SphereGeometry(0.026, 16, 12), skin, 0, -FORE, 0);
      const hand = new THREE.Group();
      hand.position.y = -FORE;
      elbow.add(hand);
      // Palm: flat on the palm side so two hands can meet without a gap.
      add(hand, new RoundedBoxGeometry(0.027, PALM_LEN, 0.078, 3, 0.011), skin, 0, -PALM_LEN / 2 - 0.002, 0);
      const knuckles = add(hand, new THREE.CapsuleGeometry(0.009, 0.06, 4, 10), skinShade, s * 0.004, -PALM_LEN + 0.004, 0);
      knuckles.rotation.x = Math.PI / 2;
      knuckles.visible = true;
      const fingers: THREE.Group[][] = [];
      for (const spec of FINGER_SPECS) {
        const chain: THREE.Group[] = [];
        let parent: THREE.Object3D = hand;
        let y = -PALM_LEN;
        spec.seg.forEach((len, k) => {
          const j = new THREE.Group();
          j.position.set(k === 0 ? -s * 0.0055 : 0, y, k === 0 ? spec.z : 0);
          parent.add(j);
          const r = spec.r * (1 - k * 0.08);
          add(j, new THREE.CapsuleGeometry(r, Math.max(0.001, len - r), 4, 10), k === 2 ? skin : skin, 0, -len / 2, 0);
          if (k === 2) {
            const nail = add(j, new THREE.SphereGeometry(r * 0.85, 10, 6), white, s * r * 0.55, -len * 0.62, 0, false);
            nail.scale.set(0.35, 1.1, 0.85);
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
        add(j, new THREE.CapsuleGeometry(r, len - r, 4, 10), skin, 0, -len / 2, 0);
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
      add(hip, new THREE.SphereGeometry(0.076, 20, 16), trousers);
      add(hip, new THREE.CylinderGeometry(0.072, 0.053, 0.43, 20), trousers, 0, -0.215, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.43;
      hip.add(knee);
      add(knee, new THREE.SphereGeometry(0.054, 18, 14), trousers);
      add(knee, new THREE.CylinderGeometry(0.052, 0.042, 0.4, 18), trousers, 0, -0.2, 0);
      const ankle = new THREE.Group();
      ankle.position.y = -0.41;
      knee.add(ankle);
      add(ankle, new RoundedBoxGeometry(0.088, 0.064, 0.245, 3, 0.028), shoeMat, 0, -0.03, -0.058);
      add(ankle, new THREE.BoxGeometry(0.09, 0.012, 0.25), this.mat(new THREE.MeshStandardMaterial({ color: '#211812', roughness: 0.7 })), 0, -0.059, -0.058);
      return { hip, knee, ankle };
    };
    this.legs = { left: makeLeg(-1), right: makeLeg(1) };

    // Rosary held between the hands (decades of ten small beads, five large beads, medal, crucifix).
    const bead = this.mat(new THREE.MeshStandardMaterial({ color: '#e8dccb', roughness: 0.25, metalness: 0.1 }));
    const gold = this.mat(new THREE.MeshStandardMaterial({ color: '#c8a35a', roughness: 0.3, metalness: 0.75 }));
    const loop = 55;
    for (let i = 0; i < loop; i += 1) {
      const a = Math.PI / 2 + (i / loop) * Math.PI * 2;
      const large = i % 11 === 0;
      add(this.rosary, new THREE.SphereGeometry(large ? 0.0085 : 0.006, 10, 8), large ? gold : bead, Math.cos(a) * 0.05, Math.sin(a) * 0.085 - 0.085, 0, false);
    }
    for (let i = 0; i < 4; i += 1) add(this.rosary, new THREE.SphereGeometry(i === 0 ? 0.0085 : 0.006, 10, 8), i === 0 ? gold : bead, 0, -0.18 - i * 0.017, 0, false);
    add(this.rosary, new THREE.SphereGeometry(0.011, 12, 8), gold, 0, -0.17, 0, false).scale.set(0.8, 1.1, 0.4);
    add(this.rosary, new THREE.BoxGeometry(0.007, 0.05, 0.004), gold, 0, -0.27, 0, false);
    add(this.rosary, new THREE.BoxGeometry(0.03, 0.007, 0.004), gold, 0, -0.259, 0, false);
    this.rosary.position.set(0, -0.2, -0.235);
    this.rosary.visible = false;
    this.chest.add(this.rosary);

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
    this.label.position.set(0, 1.98, 0);
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
    let left = this.hands === 'prayer' ? prayerHands(-1) : this.hands === 'rosary' ? rosaryHands(-1) : rest(-1);
    let right = this.hands === 'prayer' ? prayerHands(1) : this.hands === 'rosary' ? rosaryHands(1) : rest(1);
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
      const forehead = key(V(0.0, HEAD_CENTER.y + 0.045, -0.118), V(-0.22, 0.8, 0.5));
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
      const above = (s: Side) => flat(fromTip(V(0.095 * s, HEAD_CENTER.y + 0.17, -0.02), V(0.15 * s, 1, 0.1)), V(0.15 * s, 1, 0.1), V(-s, 0, 0), V(1 * s, -0.5, 0.3), 0.55);
      const temple = (s: Side) => flat(fromTip(V(0.1 * s, HEAD_CENTER.y + 0.02, -0.0), V(0.1 * s, 1, 0.15)), V(0.1 * s, 1, 0.15), V(-s, 0, 0), V(1 * s, -0.6, 0.3), 0.5);
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
