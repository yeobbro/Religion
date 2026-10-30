import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Avatar, type AvatarOptions } from './avatar';

/**
 * Realistic people (Microsoft Rocketbox avatars, MIT licence) driven by the procedural Avatar.
 *
 * The procedural avatar still does all the thinking: walking, sitting, kneeling, the sign of
 * the cross, joined hands, rosary, veil and candle lighting are solved on its simple rig.
 * Each frame those joint rotations are copied onto the human skeleton. Once, at load, both
 * rigs are put in the same pose (the human's bind pose) and the rotation that turns each
 * driver joint into the matching human bone is stored (C = D⁻¹·H); after that a bone is
 * simply H = D·C, whatever the bone axis conventions of the original rig.
 */

export type Gender = 'female' | 'male';
export type HumanLook = {
  id: string;
  gender: Gender;
  label: string;
  hint: string;
  model: string;
  /** Optional texture overrides (e.g. a robe recoloured for a religious habit). */
  textures?: Record<string, string>;
  /** Material names to hide (e.g. a head scarf). */
  hide?: string[];
  /** Add the lace chapel veil (미사보) prop. */
  veil?: boolean;
};

const M = (id: string) => `/models/people/${id}.glb`;

// Clothes suited to Mass: modest, formal, nothing revealing.
export const LOOKS: HumanLook[] = [
  { id: 'f-dress', gender: 'female', label: '원피스 · 미사보', hint: '브라운 원피스에 흰 미사보', model: M('female-adult-11'), veil: true },
  { id: 'f-suit', gender: 'female', label: '베이지 정장', hint: '재킷과 스커트', model: M('business-female-03') },
  { id: 'f-black', gender: 'female', label: '검은 정장', hint: '차분한 검은 투피스', model: M('business-female-01') },
  { id: 'f-wine', gender: 'female', label: '와인 재킷', hint: '와인색 재킷과 검은 바지', model: M('business-female-02') },
  { id: 'f-casual', gender: 'female', label: '분홍 재킷', hint: '재킷과 청바지', model: M('female-adult-05') },
  { id: 'm-navy', gender: 'male', label: '네이비 양복', hint: '넥타이를 맨 정장', model: M('business-male-02') },
  { id: 'm-black', gender: 'male', label: '검은 양복', hint: '격식 있는 검은 정장', model: M('business-male-01') },
  { id: 'm-grey', gender: 'male', label: '짙은 양복', hint: '녹색 넥타이 정장', model: M('business-male-03') },
  { id: 'm-sweater', gender: 'male', label: '니트 · 바지', hint: '단정한 브이넥 니트', model: M('male-adult-02') },
  { id: 'm-shirt', gender: 'male', label: '셔츠 · 바지', hint: '하늘색 셔츠', model: M('male-adult-08') },
];
export const lookById = (id: string) => LOOKS.find(l => l.id === id) ?? LOOKS[0];

const cache = new Map<string, Promise<THREE.Object3D>>();
const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const loadModel = (url: string) => {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then(g => g.scene);
    cache.set(url, p);
  }
  return p;
};

type Map1 = { d: THREE.Object3D; h: THREE.Bone; c: THREE.Quaternion };

const FINGER_NAMES = ['1', '2', '3', '4']; // index, middle, ring, little
const SEG = ['', '1', '2'];

export class HumanAvatar extends Avatar {
  readonly look: HumanLook;
  private human: THREE.Object3D | null = null;
  private maps: Map1[] = [];
  private hPelvis: THREE.Bone | null = null;
  private hHead: THREE.Bone | null = null;
  private pelvisBind = new THREE.Vector3();
  private driverPelvisBind = new THREE.Vector3();
  private k = 1;
  private headAnchor = new THREE.Group();
  private ownTextures: THREE.Texture[] = [];
  private ownMaterials: THREE.Material[] = [];
  private disposed = false;
  /** Resolves once the human model is in place. */
  readonly ready: Promise<void>;

  constructor(opts: AvatarOptions & { look: HumanLook }) {
    super({ ...opts, outfit: opts.look.veil ? 'dress' : 'casual', headScale: 1, headCenterY: 0.225 });
    this.look = opts.look;
    this.ready = this.load();
  }

  private async load() {
    const src = await loadModel(this.look.model);
    if (this.disposed) return;
    const human = SkeletonUtils.clone(src);
    const wrap = new THREE.Group();
    wrap.rotation.y = Math.PI; // the models face +Z; the driver faces -Z
    wrap.add(human);

    // Materials: soft, non-metallic cloth and skin; hair and lashes cut out cleanly.
    const overrides = this.look.textures ?? {};
    human.traverse(o => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      const old = m.material as THREE.MeshStandardMaterial;
      const mat = old.clone();
      mat.metalness = 0;
      mat.roughness = 0.82;
      if (/opacity/i.test(old.name)) { mat.transparent = false; mat.alphaTest = 0.45; mat.side = THREE.DoubleSide; }
      // Faces: a soft, clear complexion (gentle self-lit warmth lifts the shadowed texture).
      if (/head/i.test(old.name) && mat.map) { mat.roughness = 0.6; mat.emissive = new THREE.Color('#3a2620'); mat.emissiveMap = mat.map; mat.emissiveIntensity = 0.55; }
      // Hair cards: deeper, glossier black-brown.
      if (/opacity/i.test(old.name)) { mat.color = new THREE.Color('#6a5a52'); mat.roughness = 0.55; }
      const url = overrides[old.name];
      if (url) {
        const t = texLoader.load(url);
        t.colorSpace = THREE.SRGBColorSpace;
        t.flipY = false;
        mat.map = t;
        this.ownTextures.push(t);
      }
      if (this.look.hide?.includes(old.name)) m.visible = false;
      m.material = mat;
      m.userData.human = true;
      this.ownMaterials.push(mat);
    });

    const bone = (n: string) => {
      let b: THREE.Bone | null = null;
      human.traverse(o => { if (!b && o.name === n) b = o as THREE.Bone; });
      return b as THREE.Bone | null;
    };
    const rig = this.rig();
    // Measure the human in its bind pose, in the driver's root space.
    this.root.add(wrap);
    this.root.updateMatrixWorld(true);
    const wpos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

    // Pose the driver like the human's bind pose: upright, legs straight, arms as in the model.
    const saved = { py: rig.pelvis.position.y, pz: rig.pelvis.position.z };
    rig.pelvis.position.set(0, 0.93, 0);
    for (const g of [rig.spine, rig.chest, rig.neck, rig.head]) g.rotation.set(0, 0, 0);
    for (const leg of Object.values(rig.legs)) { leg.hip.rotation.set(0, 0, 0); leg.knee.rotation.set(0, 0, 0); leg.ankle.rotation.set(0, 0, 0); }
    this.root.updateMatrixWorld(true);
    const chestInv = rig.chest.getWorldQuaternion(new THREE.Quaternion()).invert();
    const toChest = (v: THREE.Vector3) => v.clone().applyQuaternion(chestInv);
    for (const [side, s, L] of [['left', -1, 'L'], ['right', 1, 'R']] as const) {
      const up = bone(`Bip01_${L}_UpperArm`), fo = bone(`Bip01_${L}_Forearm`), ha = bone(`Bip01_${L}_Hand`);
      const f1 = bone(`Bip01_${L}_Finger1`), f2 = bone(`Bip01_${L}_Finger2`), f4 = bone(`Bip01_${L}_Finger4`);
      if (!up || !fo || !ha || !f1 || !f2 || !f4) continue;
      const uDir = toChest(wpos(fo).sub(wpos(up)).normalize());
      const fDir = toChest(wpos(ha).sub(wpos(fo)).normalize());
      const finger = toChest(wpos(f2).sub(wpos(ha)).normalize());
      const across = toChest(wpos(f1).sub(wpos(f4)).normalize());
      let palm = new THREE.Vector3().crossVectors(across, finger).normalize().multiplyScalar(s);
      if (palm.y > 0) palm.negate();
      const shoulder = new THREE.Vector3(0.178 * s, 0.052, 0);
      const wrist = shoulder.clone().add(uDir.clone().multiplyScalar(0.285)).add(fDir.clone().multiplyScalar(0.245));
      this.poseArmNow(side, { wrist, finger, palm, pole: new THREE.Vector3(0.3 * s, -0.2, 1), curl: 0, thumb: 0, spread: 0 });
    }
    this.root.updateMatrixWorld(true);

    // Store the per-joint rotation offsets.
    const wq = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
    const add = (d: THREE.Object3D, name: string) => {
      const h = bone(name);
      if (!h) return;
      this.maps.push({ d, h, c: wq(d).invert().multiply(wq(h)) });
    };
    add(rig.pelvis, 'Bip01_Pelvis');
    add(rig.spine, 'Bip01_Spine');
    add(rig.spine, 'Bip01_Spine1');
    add(rig.chest, 'Bip01_Spine2');
    add(rig.neck, 'Bip01_Neck');
    add(rig.head, 'Bip01_Head');
    for (const [side, L] of [['left', 'L'], ['right', 'R']] as const) {
      const arm = rig.arms[side];
      add(arm.shoulder, `Bip01_${L}_UpperArm`);
      add(arm.elbow, `Bip01_${L}_Forearm`);
      add(arm.hand, `Bip01_${L}_Hand`);
      arm.fingers.forEach((chain, i) => chain.forEach((j, k) => add(j, `Bip01_${L}_Finger${FINGER_NAMES[i]}${SEG[k]}`)));
      arm.thumb.forEach((j, k) => add(j, `Bip01_${L}_Finger0${SEG[k]}`));
      const leg = rig.legs[side];
      add(leg.hip, `Bip01_${L}_Thigh`);
      add(leg.knee, `Bip01_${L}_Calf`);
      add(leg.ankle, `Bip01_${L}_Foot`);
    }
    // Parents before children, so each bone sees its parent's new rotation.
    const depth = (o: THREE.Object3D) => { let n = 0; for (let p = o.parent; p; p = p.parent) n += 1; return n; };
    this.maps.sort((a, b) => depth(a.h) - depth(b.h));

    this.hPelvis = bone('Bip01_Pelvis');
    this.hHead = bone('Bip01_Head');
    const rootInv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    if (this.hPelvis) this.pelvisBind.copy(wpos(this.hPelvis).applyMatrix4(rootInv));
    this.driverPelvisBind.copy(wpos(rig.pelvis).applyMatrix4(rootInv));
    this.k = this.pelvisBind.y / Math.max(0.1, this.driverPelvisBind.y);

    // The veil follows the human head rather than the hidden driver head.
    const veil = this.veil;
    if (this.hHead) {
      this.root.add(this.headAnchor);
      this.headAnchor.add(veil);
      this.headAnchor.scale.setScalar(1.0); // a real head is a little larger than the driver's
    }
    rig.label.position.y = this.pelvisBind.y + 1.0 + 0.2;

    rig.pelvis.position.set(0, saved.py, saved.pz);
    this.setGhost(true);
    this.human = wrap;
  }

  update(dt: number, moving: boolean, speed = 1) {
    super.update(dt, moving, speed);
    if (!this.human) return;
    this.root.updateMatrixWorld(true);
    const rig = this.rig();
    // Hips follow the driver (scaled to the human's leg length).
    if (this.hPelvis?.parent) {
      const rootM = this.root.matrixWorld;
      const d = rig.pelvis.getWorldPosition(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(rootM).invert());
      const p = this.pelvisBind.clone().add(d.sub(this.driverPelvisBind).multiplyScalar(this.k)).applyMatrix4(rootM);
      this.hPelvis.parent.updateWorldMatrix(true, false);
      this.hPelvis.position.copy(this.hPelvis.parent.worldToLocal(p));
    }
    const q = new THREE.Quaternion(), pq = new THREE.Quaternion();
    for (const m of this.maps) {
      m.d.getWorldQuaternion(q).multiply(m.c);
      (m.h.parent as THREE.Object3D).getWorldQuaternion(pq);
      m.h.quaternion.copy(pq.invert().multiply(q));
      m.h.updateMatrixWorld(true);
    }
    if (this.hHead) {
      // Head anchor: at the human head, turned like the driver head (which the veil was made for).
      this.hHead.getWorldPosition(this.headAnchor.position);
      this.root.worldToLocal(this.headAnchor.position);
      rig.head.getWorldQuaternion(q);
      this.root.getWorldQuaternion(pq);
      this.headAnchor.quaternion.copy(pq.invert().multiply(q));
      this.headAnchor.position.y -= 0.035;
    }
  }

  dispose() {
    this.disposed = true;
    this.ownTextures.forEach(t => t.dispose());
    this.ownMaterials.forEach(m => m.dispose());
    super.dispose();
  }
}
