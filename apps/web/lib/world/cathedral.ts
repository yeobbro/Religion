import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  beamTexture, carpetTexture, flameTexture, glowTexture, labelTexture, noiseTexture,
  seeded, starVaultTexture, stationTexture,
} from './textures';
import { image } from './credits';
import { createCrucifix, createMarianStatue, disposeGroup } from './statues';

/**
 * The visitable site in metres: a Gothic cathedral (nave, aisles, apse, side Marian altar,
 * votive candle stand, confessional, organ loft) whose west doors open onto a plaza, a garden
 * walk, a fountain and an outdoor Marian grotto under an evening sky.
 *
 * Static architecture is merged per material to keep draw calls low. Collision is a list of
 * axis-aligned rectangles on the ground plane, used by movement and path finding.
 */

/** `low` obstacles (pews, rails, fonts, hedges) block walking but not the camera's view. */
export type Blocker = { x: number; z: number; rx: number; rz: number; low?: boolean };
export type Spot = { x: number; z: number; yaw: number };
export type Seat = { x: number; z: number; aisleX: number };

export type CandleStand = {
  approach: Spot;
  slots: THREE.Vector3[];
  isLit: (i: number) => boolean;
  freeSlot: (near: THREE.Vector3) => number;
  light: (i: number) => void;
};

export type Confessional = {
  approach: Spot;
  inside: Spot;
  cameraEye: THREE.Vector3;
  cameraLook: THREE.Vector3;
  setCurtain: (closed: boolean) => void;
  release: () => void; // light rising from the booth after a confession
};

export type Site = {
  group: THREE.Group;
  blockers: Blocker[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  seats: Seat[];
  fonts: { x: number; z: number }[];
  candleStand: CandleStand;
  confessional: Confessional;
  maryInside: Spot;
  grotto: Spot;
  start: Spot;
  /** 1 inside the church, 0 in the open air, blended across the doorway. */
  indoorAt: (x: number, z: number) => number;
  update: (time: number, dt: number, indoor: number) => void;
  dispose: () => void;
};

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const buildSite = (renderer: THREE.WebGLRenderer): Site => {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: { dispose(): void }[] = [];
  const block = (x: number, z: number, rx: number, rz: number, low = false) => blockers.push({ x, z, rx, rz, low });
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = <T extends THREE.Texture>(t: T) => { t.anisotropy = maxAniso; disposables.push(t); return t; };
  const mat = <T extends THREE.Material>(m: T) => { disposables.push(m); return m; };
  const loader = new THREE.TextureLoader();

  // ---------- Materials ----------
  const marblePhoto = tex(loader.load('/textures/marble-floor.jpg'));
  marblePhoto.colorSpace = THREE.SRGBColorSpace;
  marblePhoto.wrapS = marblePhoto.wrapT = THREE.RepeatWrapping;
  marblePhoto.repeat.set(5, 7);
  /** Photo-scanned CC0 surfaces from Poly Haven (colour + normal), tiled in world units by `bake`. */
  const pbr = (id: string) => {
    const map = tex(loader.load(`/textures/pbr/${id}_diff.jpg`));
    map.colorSpace = THREE.SRGBColorSpace;
    const normalMap = tex(loader.load(`/textures/pbr/${id}_nor_gl.jpg`));
    for (const t of [map, normalMap]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return { map, normalMap };
  };
  const plaster = pbr('plastered_stone_wall');
  const brick = pbr('castle_brick_07');
  const planks = pbr('dark_wooden_planks');
  const grassP = pbr('aerial_grass_rock');
  const cobble = pbr('cobblestone_floor_08');
  const rockP = pbr('rock_wall_08');
  const ns = new THREE.Vector2(0.6, 0.6);
  const M = {
    floor: mat(new THREE.MeshStandardMaterial({ map: marblePhoto, roughness: 0.32, metalness: 0.05 })),
    stone: mat(new THREE.MeshStandardMaterial({ color: '#e6dccb', ...plaster, normalScale: ns, roughness: 0.92 })),
    stoneIn: mat(new THREE.MeshStandardMaterial({ color: '#e6dccb', ...plaster, normalScale: ns, roughness: 0.92, side: THREE.DoubleSide })),
    stoneDark: mat(new THREE.MeshStandardMaterial({ color: '#b3a68f', ...plaster, normalScale: ns, roughness: 0.94 })),
    exterior: mat(new THREE.MeshStandardMaterial({ color: '#efe4cf', ...brick, roughness: 0.95 })),
    gold: mat(new THREE.MeshStandardMaterial({ color: '#c9a04a', roughness: 0.3, metalness: 0.85, emissive: '#2a1b05', emissiveIntensity: 0.4 })),
    wood: mat(new THREE.MeshStandardMaterial({ color: '#c79a73', ...planks, roughness: 0.55 })),
    woodDark: mat(new THREE.MeshStandardMaterial({ color: '#8a6347', ...planks, roughness: 0.6 })),
    iron: mat(new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.5, metalness: 0.7 })),
    vault: mat(new THREE.MeshStandardMaterial({ map: tex(starVaultTexture()), roughness: 0.85, side: THREE.DoubleSide })),
    carpet: mat(new THREE.MeshStandardMaterial({ map: tex(carpetTexture()), roughness: 0.95 })),
    linen: mat(new THREE.MeshStandardMaterial({ color: '#f3eee2', roughness: 0.75 })),
    velvet: mat(new THREE.MeshStandardMaterial({ color: '#5e1420', roughness: 0.92, side: THREE.DoubleSide })),
    wax: mat(new THREE.MeshStandardMaterial({ color: '#f2e9d6', roughness: 0.55, emissive: '#3a2a14', emissiveIntensity: 0.15 })),
    redGlass: mat(new THREE.MeshStandardMaterial({ color: '#b3222d', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.78, emissive: '#5a0a10', emissiveIntensity: 0.6 })),
    slate: mat(new THREE.MeshStandardMaterial({ color: '#4c5560', roughness: 0.8 })),
    grass: mat(new THREE.MeshStandardMaterial({ color: '#cfd8bf', ...grassP, roughness: 1 })),
    path: mat(new THREE.MeshStandardMaterial({ color: '#efe6d6', ...cobble, roughness: 0.95 })),
    leaf: mat(new THREE.MeshStandardMaterial({ color: '#4e6b3c', roughness: 0.95 })),
    leafDark: mat(new THREE.MeshStandardMaterial({ color: '#2f4a2c', roughness: 0.95 })),
    bark: mat(new THREE.MeshStandardMaterial({ color: '#5b4632', roughness: 1 })),
    rock: mat(new THREE.MeshStandardMaterial({ color: '#d9d3c6', ...rockP, roughness: 1 })),
    water: mat(new THREE.MeshStandardMaterial({ color: '#7fb0b6', roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.85 })),
    hill: mat(new THREE.MeshStandardMaterial({ color: '#7b8c76', roughness: 1 })),
    blueNiche: mat(new THREE.MeshStandardMaterial({ map: tex(starVaultTexture()), roughness: 0.8 })),
  };
  (M.blueNiche.map as THREE.Texture).repeat.set(1, 1.5);

  // ---------- Static batching ----------
  type Key = keyof typeof M;
  const TILE: Partial<Record<Key, number>> = { stone: 3, stoneIn: 3, stoneDark: 3, exterior: 2.2, wood: 1.4, woodDark: 1.4, rock: 2.2, path: 2.5, grass: 6 };
  const batches = new Map<Key, { geos: THREE.BufferGeometry[]; cast: boolean }>();
  const tmp = new THREE.Object3D();
  const bake = (key: Key, geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, cast = true) => {
    tmp.position.set(x, y, z);
    tmp.rotation.set(rx, ry, rz);
    tmp.scale.set(sx, sy, sz);
    tmp.updateMatrix();
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(tmp.matrix);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const tile = TILE[key];
    if (tile) {
      // Box mapping in world metres so photo textures keep their real scale on every wall.
      const pos = g.attributes.position as THREE.BufferAttribute;
      const nor = g.attributes.normal as THREE.BufferAttribute;
      const uvA = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i += 1) {
        const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (ny >= nx && ny >= nz) uvA.setXY(i, x / tile, z / tile);
        else if (nx >= nz) uvA.setXY(i, z / tile, y / tile);
        else uvA.setXY(i, x / tile, y / tile);
      }
    }
    geo.dispose();
    const b = batches.get(key) ?? { geos: [], cast: false };
    b.geos.push(g);
    b.cast = b.cast || cast;
    batches.set(key, b);
  };
  const box = (key: Key, w: number, h: number, d: number, x: number, y: number, z: number, blocker = false, ry = 0) => {
    bake(key, new THREE.BoxGeometry(w, h, d), x, y, z, 0, ry, 0);
    if (blocker) block(x, z, ry ? d / 2 : w / 2, ry ? w / 2 : d / 2);
  };
  const cyl = (key: Key, rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 20, blocker = false) => {
    bake(key, new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z);
    if (blocker) block(x, z, Math.max(rt, rb), Math.max(rt, rb));
  };
  const add = (obj: THREE.Object3D) => { group.add(obj); return obj; };
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, cast = false) => {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.castShadow = cast;
    me.receiveShadow = true;
    group.add(me);
    return me;
  };
  /** Pointed (Gothic) arch curve in a vertical plane. */
  const archCurve = (span: number, spring: number, rise: number, alongX: boolean, cx: number, cz: number) => {
    const pts: THREE.Vector3[] = [];
    const r = span; // equilateral arch: radius = span
    for (let i = 0; i <= 24; i += 1) {
      const u = i / 24;
      let a: number, b: number;
      if (u <= 0.5) {
        const ang = Math.PI - (u / 0.5) * (Math.PI / 3);
        a = span / 2 + r * Math.cos(ang);
        b = r * Math.sin(ang);
      } else {
        const ang = ((u - 0.5) / 0.5) * (Math.PI / 3);
        a = -span / 2 + r * Math.cos(Math.PI / 3 - ang);
        b = r * Math.sin(Math.PI / 3 - ang);
      }
      const y = spring + (b / (r * Math.sin(Math.PI / 3))) * rise;
      pts.push(alongX ? V(cx - a, y, cz) : V(cx, y, cz - a));
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  /** Barrel-like pointed vault surface between x0..x1 springing at `spring`, apex at `apex`, from z0 to z1. */
  const vaultSurface = (x0: number, x1: number, spring: number, apex: number, z0: number, z1: number, key: Key) => {
    const geo = new THREE.BufferGeometry();
    const nu = 24, nv = 2;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= nv; j += 1) {
      for (let i = 0; i <= nu; i += 1) {
        const u = i / nu;
        const x = x0 + (x1 - x0) * u;
        const t = Math.abs(u - 0.5) * 2; // 0 apex, 1 springing
        const y = spring + (apex - spring) * Math.sqrt(Math.max(0, 1 - t * t * 0.98)) * (1 - 0.18 * (1 - t));
        pos.push(x, y, z0 + ((z1 - z0) * j) / nv);
        uv.push(u * 2, (j / nv) * Math.abs(z1 - z0) / 6);
      }
    }
    for (let j = 0; j < nv; j += 1) {
      for (let i = 0; i < nu; i += 1) {
        const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    bake(key, geo, 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
  };

  // ---------- Dimensions ----------
  const W = 14.4;          // interior half-width (outer aisle walls)
  const NAVE = 7.6;        // pier line / upper nave walls
  const Z_E = -22;         // sanctuary end (apse chord)
  const Z_W = 19.5;        // west wall
  const APSE_R = 6.5;
  const PIERS = [-17, -11, -5, 1, 7, 13];

  // ---------- Ground ----------
  bake('grass', new THREE.PlaneGeometry(260, 260, 1, 1), 0, -0.02, 40, -Math.PI / 2, 0, 0, 1, 1, 1, false);
  const floor = mesh(new THREE.PlaneGeometry(W * 2, Z_W - Z_E), M.floor, 0, 0.001, (Z_W + Z_E) / 2);
  floor.rotation.x = -Math.PI / 2;
  const apseFloor = mesh(new THREE.CircleGeometry(APSE_R, 32, 0, Math.PI), M.floor, 0, 0.002, Z_E);
  apseFloor.rotation.x = -Math.PI / 2;
  const carpet = mesh(new THREE.PlaneGeometry(1.7, 32.5), M.carpet, 0, 0.012, 2.9);
  carpet.rotation.x = -Math.PI / 2;

  // ---------- Walls and vaults ----------
  // Outer aisle walls (thick), west wall with the portal opening, east wall beside the apse.
  box('stone', 0.8, 11, Z_W - Z_E + 0.8, -W - 0.4, 5.5, (Z_W + Z_E) / 2, true);
  box('stone', 0.8, 11, Z_W - Z_E + 0.8, W + 0.4, 5.5, (Z_W + Z_E) / 2, true);
  box('stone', W - 2.9, 24, 0.8, -(W + 2.9) / 2, 12, Z_W + 0.4, true);
  box('stone', W - 2.9, 24, 0.8, (W + 2.9) / 2, 12, Z_W + 0.4, true);
  box('stone', 5.8, 24 - 9.6, 0.8, 0, 9.6 + (24 - 9.6) / 2, Z_W + 0.4);
  box('stone', W - APSE_R, 24, 0.8, -(W + APSE_R) / 2, 12, Z_E - 0.4, true);
  box('stone', W - APSE_R, 24, 0.8, (W + APSE_R) / 2, 12, Z_E - 0.4, true);
  // Upper nave walls above the arcade, carrying the clerestory.
  box('stone', 0.7, 13, Z_W - Z_E, -NAVE - 0.35, 17, (Z_W + Z_E) / 2);
  box('stone', 0.7, 13, Z_W - Z_E, NAVE + 0.35, 17, (Z_W + Z_E) / 2);
  // Aisle ceilings and the high nave vault (starry blue between gilded ribs).
  vaultSurface(-W, -NAVE - 0.7, 8.6, 10.6, Z_E, Z_W, 'vault');
  vaultSurface(NAVE + 0.7, W, 8.6, 10.6, Z_E, Z_W, 'vault');
  vaultSurface(-NAVE, NAVE, 18, 24.2, Z_E, Z_W, 'vault');
  // Apse: curved wall and half dome.
  {
    const wall = new THREE.CylinderGeometry(APSE_R + 0.4, APSE_R + 0.4, 24, 40, 1, true, Math.PI / 2, Math.PI);
    bake('stoneIn', wall, 0, 12, Z_E);
    const dome = new THREE.SphereGeometry(APSE_R + 0.2, 40, 16, Math.PI, Math.PI, 0, Math.PI / 2);
    bake('vault', dome, 0, 18, Z_E, 0, 0, 0, 1, 1.0, 1, false);
    for (let k = 0; k <= 12; k += 1) {
      const a = Math.PI / 2 + (k / 12) * Math.PI;
      block(Math.sin(a) * (APSE_R + 0.2), Z_E + Math.cos(a) * (APSE_R + 0.2), 0.6, 0.6);
    }
  }
  // Transverse and diagonal ribs on the main vault.
  for (const z of [...PIERS, Z_E + 0.2, Z_W - 0.3]) {
    bake('gold', new THREE.TubeGeometry(archCurve(NAVE * 2, 18, 6.0, true, 0, z), 60, 0.13, 8, false), 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
  }
  bake('gold', new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 24.0, Z_E), V(0, 24.0, Z_W)]), 8, 0.11, 8, false), 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
  for (let i = 0; i < PIERS.length - 1; i += 1) {
    const z0 = PIERS[i], z1 = PIERS[i + 1];
    for (const s of [-1, 1]) {
      bake('gold', new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(s * NAVE, 18, z0), V(s * NAVE * 0.55, 22.4, (z0 + z1) / 2 - (z1 - z0) * 0.22), V(0, 24.0, (z0 + z1) / 2)]), 20, 0.07, 6, false), 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
      bake('gold', new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(s * NAVE, 18, z1), V(s * NAVE * 0.55, 22.4, (z0 + z1) / 2 + (z1 - z0) * 0.22), V(0, 24.0, (z0 + z1) / 2)]), 20, 0.07, 6, false), 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
    }
  }

  // ---------- Piers and arcades ----------
  for (const s of [-1, 1]) {
    for (const z of PIERS) {
      const x = s * NAVE;
      // Compound pier: core with four attached shafts, moulded base and foliate capital.
      cyl('stone', 0.55, 0.55, 8.6, x, 4.3, z, 24, true);
      for (const [dx, dz] of [[0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55]]) cyl('stone', 0.17, 0.17, 8.6, x + dx, 4.3, z + dz, 12);
      cyl('stoneDark', 0.9, 0.95, 0.5, x, 0.25, z, 24);
      cyl('gold', 0.8, 0.62, 0.55, x, 8.85, z, 24);
      // Vaulting shaft rising on the nave face to the high vault springing.
      cyl('stone', 0.16, 0.16, 9.4, x - s * 0.58, 13.3, z, 10);
      cyl('gold', 0.26, 0.2, 0.3, x - s * 0.58, 18.0, z, 12);
    }
    // Pointed arcade arches between piers.
    for (let i = 0; i < PIERS.length - 1; i += 1) {
      const zc = (PIERS[i] + PIERS[i + 1]) / 2;
      const span = PIERS[i + 1] - PIERS[i] - 1.1;
      bake('stone', new THREE.TubeGeometry(archCurve(span, 9.1, 2.9, false, s * NAVE, zc), 40, 0.32, 10, false), 0, 0, 0);
      bake('gold', new THREE.TubeGeometry(archCurve(span - 0.5, 9.1, 2.6, false, s * (NAVE - 0.36), zc), 40, 0.06, 6, false), 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
      // Triforium: a band of small arches above the arcade.
      for (let k = 0; k < 4; k += 1) {
        const zz = PIERS[i] + 1.0 + (k + 0.5) * ((span - 0.4) / 4);
        bake('stoneDark', new THREE.TubeGeometry(archCurve(1.0, 12.6, 0.7, false, s * (NAVE - 0.38), zz), 16, 0.05, 6, false), 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
        cyl('stoneDark', 0.05, 0.05, 1.3, s * (NAVE - 0.38), 11.95, zz - 0.5, 8);
      }
    }
    // Aisle wall shafts and transverse aisle ribs.
    for (const z of PIERS) {
      cyl('stone', 0.2, 0.2, 8.6, s * (W - 0.15), 4.3, z, 12);
      bake('gold', new THREE.TubeGeometry(archCurve(W - NAVE - 0.8, 8.6, 2.0, true, s * (W + NAVE + 0.7) / 2, z), 30, 0.08, 6, false), 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
    }
  }
  // Pier blockers along the arcade line.
  for (const s of [-1, 1]) for (const z of PIERS) block(s * NAVE, z, 0.85, 0.85);

  // ---------- Stained glass ----------
  type Glow = { m: THREE.MeshBasicMaterial; base: number };
  const glows: Glow[] = [];
  const glassMats: THREE.MeshBasicMaterial[] = [];
  const glassMaterial = (texture: THREE.Texture, strength = 1) => {
    const m = mat(new THREE.MeshBasicMaterial({ map: tex(texture), color: new THREE.Color(strength, strength, strength), side: THREE.DoubleSide, toneMapped: false }));
    glassMats.push(m);
    return m;
  };
  const lancetGeometry = (w: number, h: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(-w / 2, h - w * 0.75);
    shape.quadraticCurveTo(-w / 2, h - w * 0.15, 0, h);
    shape.quadraticCurveTo(w / 2, h - w * 0.15, w / 2, h - w * 0.75);
    shape.lineTo(w / 2, 0);
    shape.closePath();
    const g = new THREE.ShapeGeometry(shape, 12);
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i += 1) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h);
    return g;
  };
  // Real stained glass: rectified photographs of Chartres Cathedral windows (public domain).
  const glassImages = new Map<string, THREE.Texture>();
  const glassPools: { id: string; x: number; z: number; w: number; l: number }[] = [];
  const glassFor = (id: string, w: number, h: number, offset = 0.5) => {
    let base = glassImages.get(id);
    if (!base) {
      base = tex(loader.load(image(id).src));
      base.colorSpace = THREE.SRGBColorSpace;
      glassImages.set(id, base);
    }
    const t = tex(base.clone());
    const [iw, ih] = image(id).size;
    const A = ih / iw, a = h / w;
    if (A > a) { t.repeat.set(1, a / A); t.offset.set(0, (1 - a / A) * offset); }
    else { t.repeat.set(A / a, 1); t.offset.set((1 - A / a) / 2, 0); }
    t.needsUpdate = true;
    return glassMaterial(t, 1.08);
  };
  // Lower aisle windows and clerestory: the illustrated windows supplied for this project
  // (figures of Christ, Our Lady, the apostles and Gospel scenes); the apse keeps Chartres glass.
  const ref = (n: number) => `ref-w${String(n).padStart(2, '0')}`;
  const AISLE_GLASS = [16, 17, 20, 24, 25, 18, 22, 23, 19, 26, 21].map(ref);
  const HIGH_GLASS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(ref);
  const APSE_GLASS = ['glass-chartres-103', 'glass-chartres-104', 'glass-chartres-000', 'glass-chartres-105', 'glass-chartres-106'];
  const window3D = (x: number, y: number, z: number, w: number, h: number, facing: number, glass: THREE.Material) => {
    const g = lancetGeometry(w, h);
    const m = new THREE.Mesh(g, glass);
    m.position.set(x, y, z);
    m.rotation.y = facing;
    group.add(m);
    // Moulded frame.
    const frame = new THREE.Mesh(new THREE.TorusGeometry(w / 2 + 0.06, 0.07, 6, 16, Math.PI), M.stoneDark);
    frame.position.set(x, y + h - w / 2, z);
    frame.rotation.y = facing;
    group.add(frame);
    return m;
  };
  // Aisle windows.
  for (const s of [-1, 1]) {
    for (let i = 0; i < PIERS.length - 1; i += 1) {
      const z = (PIERS[i] + PIERS[i + 1]) / 2;
      window3D(s * (W - 0.02), 2.4, z, 1.9, 5.4, s < 0 ? Math.PI / 2 : -Math.PI / 2, glassFor(AISLE_GLASS[(i + (s > 0 ? 5 : 0)) % AISLE_GLASS.length], 1.9, 5.4, 0.35));
      // Sun from the south throws the window's colours across the aisle floor.
      if (s < 0) glassPools.push({ id: AISLE_GLASS[i % AISLE_GLASS.length], x: -W + 2.3, z, w: 1.5, l: 3.8 });
    }
  }
  // Clerestory: paired lancets in every bay.
  for (const s of [-1, 1]) {
    for (let i = 0; i < PIERS.length - 1; i += 1) {
      const z = (PIERS[i] + PIERS[i + 1]) / 2;
      for (const dz of [-1.0, 1.0]) window3D(s * (NAVE + 0.01), 13.4, z + dz, 1.3, 4.6, s < 0 ? Math.PI / 2 : -Math.PI / 2, glassFor(HIGH_GLASS[(i * 2 + (dz > 0 ? 1 : 0) + (s > 0 ? 2 : 0)) % HIGH_GLASS.length], 1.3, 4.6, dz > 0 ? 0.2 : 0.7));
    }
  }
  // Apse: five tall lancets around the sanctuary.
  for (let k = 0; k < 5; k += 1) {
    const a = ((k - 2) / 2) * (Math.PI / 3);
    const x = Math.sin(a) * (APSE_R + 0.15), z = Z_E - Math.cos(a) * (APSE_R + 0.15);
    window3D(x, 6.0, z, 1.5, 10.5, -a, glassFor(APSE_GLASS[k], 1.5, 10.5, 0.5));
  }
  // West rose window (seen from the nave, and from the plaza outside).
  // North rose of Notre-Dame de Paris (photograph, CC BY-SA 4.0 Krzysztof Mizera).
  const roseTex = tex(loader.load(image('rose-notre-dame').src));
  roseTex.colorSpace = THREE.SRGBColorSpace;
  const roseInTex = tex(loader.load(image('ref-rose').src));
  roseInTex.colorSpace = THREE.SRGBColorSpace;
  const rose = mesh(new THREE.CircleGeometry(3.3, 64), mat(new THREE.MeshBasicMaterial({ map: roseInTex, side: THREE.DoubleSide, toneMapped: false })), 0, 15.2, Z_W - 0.02);
  rose.rotation.y = Math.PI;
  const roseOut = mesh(new THREE.CircleGeometry(3.3, 64), mat(new THREE.MeshBasicMaterial({ map: roseTex, color: '#8c7f74', toneMapped: false })), 0, 15.2, Z_W + 0.82);
  roseOut.rotation.y = 0;
  bake('stoneDark', new THREE.TorusGeometry(3.4, 0.22, 10, 64), 0, 15.2, Z_W - 0.05);
  bake('stoneDark', new THREE.TorusGeometry(3.45, 0.28, 10, 64), 0, 15.2, Z_W + 0.85);

  // ---------- Light: shafts, coloured pools, dust ----------
  const beamTex = tex(beamTexture());
  const poolTex0 = tex(glowTexture('rgba(255,255,255,1)', 'rgba(160,160,160,0.6)'));
  const beams: THREE.Mesh[] = [];
  const BEAM_TINTS = ['#ffdca6', '#ffc9b5', '#d6dcff', '#ffe7b8', '#f6c8e6'];
  const beamMats = BEAM_TINTS.map(c => mat(new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, color: c, opacity: 0.3 })));
  for (let i = 0; i < PIERS.length - 1; i += 1) {
    const beamMat = beamMats[i % beamMats.length];
    const z = (PIERS[i] + PIERS[i + 1]) / 2;
    // Sunlight enters through the south clerestory (x = -NAVE) and falls across the nave.
    const top = V(-NAVE, 15.5, z), bottom = V(-1.0 + (i % 2) * 1.5, 0.05, z + 1.2);
    const len = top.distanceTo(bottom);
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.6, len), beamMat);
    beam.position.copy(top).add(bottom).multiplyScalar(0.5);
    beam.lookAt(bottom);
    beam.rotateX(Math.PI / 2);
    beam.rotation.y += 0;
    group.add(beam);
    beams.push(beam);
    const beam2 = beam.clone();
    beam2.rotateY(Math.PI / 2);
    group.add(beam2);
    beams.push(beam2);
    glassPools.push({ id: HIGH_GLASS[(i * 2) % HIGH_GLASS.length], x: bottom.x, z: bottom.z, w: 1.3, l: 3.4 });
  }
  // Coloured light on the floor: the window's own picture, stretched along the sun's direction.
  const poolMats: THREE.MeshBasicMaterial[] = [];
  for (const g of glassPools) {
    const t = tex(new THREE.TextureLoader().load(image(g.id).src));
    t.colorSpace = THREE.SRGBColorSpace;
    const m = mat(new THREE.MeshBasicMaterial({ map: t, alphaMap: poolTex0, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    poolMats.push(m);
    const p = mesh(new THREE.PlaneGeometry(g.w, g.l), m, g.x, 0.016, g.z);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = Math.PI / 2 + 0.25; // long side runs east–west, skewed with the sun
    p.receiveShadow = false;
  }
  const dustCount = 700;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = seeded(7);
  for (let i = 0; i < dustCount; i += 1) {
    dustPos[i * 3] = -NAVE + dustSeed() * NAVE * 2;
    dustPos[i * 3 + 1] = 0.5 + dustSeed() * 16;
    dustPos[i * 3 + 2] = Z_E + dustSeed() * (Z_W - Z_E);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, mat(new THREE.PointsMaterial({ size: 0.06, map: tex(glowTexture()), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe9c0' })));
  group.add(dust);

  // ---------- Flames (shared sprites) ----------
  const flameTex = tex(flameTexture());
  const haloTex = tex(glowTexture('rgba(255,225,160,0.85)', 'rgba(255,160,60,0.22)'));
  const flameMat = mat(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const haloMat = mat(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  const flames: { s: THREE.Sprite; h: THREE.Sprite | null; w: number; ht: number; phase: number }[] = [];
  const addFlame = (x: number, y: number, z: number, size = 1, halo = true) => {
    const s = new THREE.Sprite(flameMat);
    s.position.set(x, y + 0.03 * size, z);
    s.scale.set(0.035 * size, 0.07 * size, 1);
    group.add(s);
    let h: THREE.Sprite | null = null;
    if (halo) {
      h = new THREE.Sprite(haloMat);
      h.position.set(x, y + 0.03 * size, z);
      h.scale.set(0.35 * size, 0.35 * size, 1);
      group.add(h);
    }
    flames.push({ s, h, w: 0.035 * size, ht: 0.07 * size, phase: Math.random() * 10 });
    return s;
  };
  const candle = (x: number, y: number, z: number, h = 0.3, r = 0.025, lit = true) => {
    cyl('wax', r, r, h, x, y + h / 2, z, 12);
    if (lit) addFlame(x, y + h + 0.01, z, 1);
  };

  // Standing candelabra on the nave piers, like the ones lit for Sunday Mass.
  const candleLights: THREE.PointLight[] = [];
  PIERS.forEach((pz, i) => {
    for (const s of [-1, 1]) {
      const x = s * (NAVE - 1.05), z = pz;
      cyl('gold', 0.2, 0.26, 0.08, x, 0.04, z, 16);
      cyl('iron', 0.03, 0.045, 1.55, x, 0.85, z, 10);
      cyl('gold', 0.06, 0.06, 0.06, x, 1.0, z, 12);
      // Five branches on a curved arm, candles at slightly different heights.
      for (let k = -2; k <= 2; k += 1) {
        const bx = x, bz = z + k * 0.17;
        const h = 1.72 - Math.abs(k) * 0.07;
        if (k !== 0) bake('gold', new THREE.CylinderGeometry(0.012, 0.012, Math.abs(k) * 0.17 + 0.02, 6), bx, h - 0.02, z + k * 0.085, Math.PI / 2, 0, 0, 1, 1, 1, false);
        cyl('gold', 0.035, 0.02, 0.05, bx, h, bz, 10);
        candle(bx, h + 0.025, bz, 0.24, 0.018);
      }
      block(x, z, 0.28, 0.45, true);
      if ((i === 1 && s < 0) || (i === 3 && s > 0)) {
        const l = new THREE.PointLight('#ffb763', 5.5, 7.5, 1.8);
        l.position.set(x, 2.1, z);
        l.userData.base = 5.5;
        group.add(l);
        candleLights.push(l);
      }
    }
  });

  // ---------- Sanctuary ----------
  // Raised floor with three steps and a communion rail; the sanctuary itself is not walked into.
  box('stoneDark', NAVE * 2, 0.45, 8.0, 0, 0.225, Z_E + 4.0);
  for (let k = 0; k < 3; k += 1) box('stone', NAVE * 2 - 1, 0.15, 0.35, 0, 0.075 + k * 0.15, Z_E + 8.0 + 0.35 * (2 - k) + 0.17);
  bake('floor', new THREE.CircleGeometry(APSE_R, 32, 0, Math.PI), 0, 0.452, Z_E, -Math.PI / 2, 0, 0, 1, 1, 1, false);
  box('floor', NAVE * 2 - 0.2, 0.01, 7.9, 0, 0.452, Z_E + 4.0);
  block(0, Z_E + 3.5, NAVE, 5.6, true);
  // Communion rail with balusters, open in the middle.
  for (const s of [-1, 1]) {
    box('wood', 5.6, 0.1, 0.25, s * 3.9, 1.0, Z_E + 9.3);
    for (let k = 0; k < 14; k += 1) cyl('gold', 0.025, 0.035, 0.85, s * (1.25 + k * 0.38), 0.5, Z_E + 9.3, 8);
    block(s * 3.9, Z_E + 9.3, 2.8, 0.2, true);
  }
  // Altar: stone table, white cloth, gold frontal, six tall candles and a cross.
  const altarZ = Z_E + 4.4;
  box('stone', 2.8, 1.0, 1.05, 0, 0.45 + 0.5, altarZ);
  box('linen', 3.0, 0.03, 1.15, 0, 1.465, altarZ);
  box('linen', 3.0, 0.42, 0.02, 0, 1.25, altarZ + 0.585);
  box('gold', 1.0, 0.5, 0.03, 0, 0.95, altarZ + 0.535);
  box('gold', 2.6, 0.06, 0.04, 0, 1.06, altarZ + 0.545);
  for (const x of [-1.25, -0.8, -0.35, 0.35, 0.8, 1.25]) {
    cyl('gold', 0.06, 0.09, 0.08, x, 1.52, altarZ - 0.3, 14);
    cyl('gold', 0.018, 0.025, 0.3, x, 1.68, altarZ - 0.3, 10);
    candle(x, 1.83, altarZ - 0.3, 0.36, 0.022);
  }
  box('gold', 0.04, 0.45, 0.03, 0, 1.75, altarZ - 0.3);
  box('gold', 0.22, 0.04, 0.03, 0, 1.85, altarZ - 0.3);
  // Tabernacle on a pedestal behind the altar, with the red sanctuary lamp.
  const tabZ = Z_E + 1.2;
  box('stone', 1.4, 1.3, 0.9, 0, 0.45 + 0.65, tabZ);
  box('gold', 0.95, 0.85, 0.7, 0, 2.18, tabZ);
  box('gold', 0.75, 0.6, 0.02, 0, 2.15, tabZ + 0.36);
  bake('gold', new THREE.ConeGeometry(0.55, 0.45, 4), 0, 2.84, tabZ, 0, Math.PI / 4, 0);
  box('gold', 0.05, 0.3, 0.04, 0, 3.2, tabZ);
  box('gold', 0.18, 0.05, 0.04, 0, 3.22, tabZ);
  bake('iron', new THREE.CylinderGeometry(0.008, 0.008, 6, 4), 1.5, 6.2, tabZ + 1.2);
  const lampGlass = mesh(new THREE.SphereGeometry(0.09, 16, 12), M.redGlass, 1.5, 3.1, tabZ + 1.2);
  lampGlass.scale.y = 1.3;
  addFlame(1.5, 3.08, tabZ + 1.2, 0.8);
  // Ambo and presider's chair.
  box('wood', 0.9, 1.15, 0.75, -4.4, 0.45 + 0.575, Z_E + 6.4);
  box('gold', 0.95, 0.06, 0.8, -4.4, 1.64, Z_E + 6.4);
  box('linen', 0.6, 0.03, 0.45, -4.4, 1.69, Z_E + 6.35);
  box('woodDark', 0.9, 1.6, 0.75, 4.3, 0.45 + 0.8, Z_E + 5.5);
  box('velvet', 0.7, 0.08, 0.6, 4.3, 0.95, Z_E + 5.4);
  // Flower arrangements flanking the altar.
  for (const s of [-1, 1]) {
    cyl('stoneDark', 0.25, 0.18, 0.7, s * 2.4, 0.8, Z_E + 7.2, 16);
    const fl = seeded(s > 0 ? 3 : 4);
    for (let k = 0; k < 18; k += 1) {
      const col = ['#f4f1ea', '#e8c3cf', '#f2e4b0'][k % 3];
      const m = mat(new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }));
      mesh(new THREE.SphereGeometry(0.07, 8, 6), m, s * 2.4 + (fl() - 0.5) * 0.55, 1.25 + fl() * 0.45, Z_E + 7.2 + (fl() - 0.5) * 0.4);
    }
    for (let k = 0; k < 10; k += 1) mesh(new THREE.SphereGeometry(0.09, 6, 5), M.leaf, s * 2.4 + (fl() - 0.5) * 0.6, 1.15 + fl() * 0.3, Z_E + 7.2 + (fl() - 0.5) * 0.45);
  }

  // Hanging crucifix above the altar, lit by its own spotlight.
  const crucifix = createCrucifix();
  crucifix.position.set(0, 5.2, Z_E + 3.2);
  crucifix.scale.setScalar(1.05);
  group.add(crucifix);
  for (const x of [-1.0, 1.0]) bake('iron', new THREE.CylinderGeometry(0.012, 0.012, 14, 4), x, 16.5, Z_E + 3.2, 0, 0, 0, 1, 1, 1, false);
  const crossSpot = new THREE.SpotLight('#ffe4bf', 160, 22, 0.32, 0.55, 1.6);
  crossSpot.position.set(0, 14, Z_E + 10);
  crossSpot.target.position.set(0, 7.2, Z_E + 3.2);
  group.add(crossSpot, crossSpot.target);
  const altarLight = new THREE.PointLight('#ffcf96', 14, 12, 1.8);
  altarLight.position.set(0, 3.0, altarZ + 0.8);
  group.add(altarLight);

  // ---------- Pews ----------
  const seats: Seat[] = [];
  const rows = Array.from({ length: 12 }, (_, i) => -11.0 + i * 1.5);
  for (const z of rows) {
    for (const s of [-1, 1]) {
      const cx = s * 4.25;
      box('wood', 4.9, 0.06, 0.44, cx, 0.45, z);                // seat
      box('wood', 4.9, 0.5, 0.05, cx, 0.72, z + 0.24);           // backrest
      box('woodDark', 4.9, 0.06, 0.09, cx, 0.98, z + 0.24);      // top rail
      box('woodDark', 4.9, 0.08, 0.18, cx, 0.13, z - 0.5);       // kneeler
      for (const ex of [-2.45, 2.45]) {
        box('woodDark', 0.07, 1.0, 0.62, cx + ex, 0.5, z + 0.04);   // pew ends
        bake('woodDark', new THREE.CylinderGeometry(0.12, 0.12, 0.07, 16, 1, false, 0, Math.PI), cx + ex, 1.0, z + 0.04, 0, 0, Math.PI / 2);
      }
      block(cx, z + 0.02, 2.5, 0.28, true);
      for (const off of [-1.9, -0.95, 0, 0.95, 1.9]) seats.push({ x: cx + off, z: z - 0.02, aisleX: s * 1.3 });
    }
  }

  // ---------- Chandeliers ----------
  const chandLights: THREE.PointLight[] = [];
  for (const z of [-8, 0, 8]) {
    const y = 9.2;
    bake('gold', new THREE.TorusGeometry(1.15, 0.045, 8, 48), 0, y, z, Math.PI / 2, 0, 0, 1, 1, 1, false);
    bake('gold', new THREE.TorusGeometry(0.7, 0.035, 8, 40), 0, y + 0.55, z, Math.PI / 2, 0, 0, 1, 1, 1, false);
    bake('iron', new THREE.CylinderGeometry(0.015, 0.015, 24.0 - y, 4), 0, (24 + y) / 2, z, 0, 0, 0, 1, 1, 1, false);
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      bake('iron', new THREE.CylinderGeometry(0.008, 0.008, 1.9, 4), Math.cos(a) * 0.58, y + 0.95, z + Math.sin(a) * 0.58, Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55, 1, 1, 1, false);
    }
    for (let k = 0; k < 14; k += 1) {
      const a = (k / 14) * Math.PI * 2;
      const cx = Math.cos(a) * 1.15, cz = z + Math.sin(a) * 1.15;
      cyl('wax', 0.018, 0.018, 0.2, cx, y + 0.12, cz, 8);
      addFlame(cx, y + 0.24, cz, 0.9, k % 2 === 0);
    }
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2;
      cyl('wax', 0.016, 0.016, 0.18, Math.cos(a) * 0.7, y + 0.66, z + Math.sin(a) * 0.7, 8);
      addFlame(Math.cos(a) * 0.7, y + 0.77, z + Math.sin(a) * 0.7, 0.8, false);
    }
    const l = new THREE.PointLight('#ffc98a', 22, 18, 1.6);
    l.position.set(0, y - 0.4, z);
    group.add(l);
    chandLights.push(l);
  }

  // ---------- Stations of the Cross ----------
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i += 1) {
      const z = -15.5 + i * 5.2;
      const n = s < 0 ? i : 13 - i;
      box('woodDark', 0.08, 1.05, 0.85, s * (W - 0.04), 2.0, z);
      // Carved relief photographs (supplied reference), cycling through three panels.
      const relief = tex(loader.load(image(`ref-station-${(n % 3) + 1}`).src));
      relief.colorSpace = THREE.SRGBColorSpace;
      const panel = mesh(new THREE.PlaneGeometry(0.5, 0.8), mat(new THREE.MeshStandardMaterial({ map: relief, roughness: 0.75, emissive: '#ffffff', emissiveMap: relief, emissiveIntensity: 0.12 })), s * (W - 0.09), 2.0, z);
      panel.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      box('gold', 0.04, 0.18, 0.04, s * (W - 0.09), 2.65, z);
      box('gold', 0.04, 0.04, 0.12, s * (W - 0.09), 2.69, z);
    }
  }

  // ---------- Holy water fonts at the entrance ----------
  const fonts = [{ x: -2.4, z: 16.6 }, { x: 2.4, z: 16.6 }];
  const fontWater: THREE.Mesh[] = [];
  for (const f of fonts) {
    cyl('stoneDark', 0.2, 0.28, 0.9, f.x, 0.45, f.z, 16, true);
    bake('stone', new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), f.x, 1.25, f.z);
    bake('gold', new THREE.TorusGeometry(0.42, 0.03, 8, 32), f.x, 1.25, f.z, Math.PI / 2, 0, 0);
    const w = mesh(new THREE.CircleGeometry(0.38, 28), M.water, f.x, 1.2, f.z);
    w.rotation.x = -Math.PI / 2;
    fontWater.push(w);
    block(f.x, f.z, 0.5, 0.5, true);
  }

  // ---------- Organ loft over the west door ----------
  const loftZ = Z_W - 1.6;
  box('woodDark', NAVE * 2 - 0.2, 0.35, 3.2, 0, 6.3, loftZ);
  for (let x = -NAVE + 0.6; x <= NAVE - 0.6; x += 0.55) cyl('gold', 0.03, 0.04, 0.85, x, 6.9, loftZ - 1.5, 8);
  box('woodDark', NAVE * 2 - 0.2, 0.12, 0.2, 0, 7.35, loftZ - 1.5);
  for (const x of [-5.5, 5.5]) {
    cyl('stone', 0.3, 0.3, 6.1, x, 3.05, loftZ - 1.2, 16, true);
  }
  box('woodDark', 7.5, 4.5, 0.9, 0, 8.75, Z_W - 0.6);
  for (let k = 0; k < 23; k += 1) {
    const x = -3.3 + k * 0.3;
    const h = 2.0 + Math.sin((k / 22) * Math.PI) * 2.2;
    cyl('gold', 0.09, 0.09, h, x, 7.0 + h / 2, Z_W - 1.1, 12);
    bake('iron', new THREE.ConeGeometry(0.09, 0.2, 12), x, 7.0 - 0.1, Z_W - 1.1, Math.PI, 0, 0);
  }

  // ---------- Marian side altar (north aisle, east end) ----------
  const maryX = -11.0, maryZ = Z_E + 1.6;
  box('stoneDark', 3.4, 0.25, 2.4, maryX, 0.125, maryZ - 0.2);
  box('stone', 1.2, 1.15, 0.9, maryX, 0.25 + 0.575, maryZ - 0.3);
  box('gold', 1.3, 0.08, 1.0, maryX, 1.42, maryZ - 0.3);
  // Niche: starry blue backing under a gilded pointed arch.
  const niche = mesh(lancetGeometry(2.0, 4.6), M.blueNiche, maryX, 1.45, Z_E + 0.06);
  niche.rotation.y = 0;
  bake('gold', new THREE.TubeGeometry(archCurve(2.0, 4.6, 1.45, true, maryX, Z_E + 0.1), 40, 0.06, 8, false), 0, 1.45, 0);
  for (const s of [-1, 1]) cyl('gold', 0.06, 0.06, 4.6, maryX + s * 1.0, 1.45 + 2.3, Z_E + 0.1, 10);
  const mary = createMarianStatue();
  mary.position.set(maryX, 1.46, maryZ - 0.3);
  group.add(mary);
  const marySpot = new THREE.SpotLight('#fff0d6', 60, 10, 0.45, 0.6, 1.5);
  marySpot.position.set(maryX + 1.5, 5.5, maryZ + 3);
  marySpot.target.position.set(maryX, 2.3, maryZ - 0.3);
  group.add(marySpot, marySpot.target);
  for (const s of [-1, 1]) {
    cyl('stoneDark', 0.2, 0.15, 0.55, maryX + s * 0.95, 0.25 + 0.275, maryZ + 0.45, 14);
    const fl = seeded(s > 0 ? 13 : 17);
    for (let k = 0; k < 12; k += 1) mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(new THREE.MeshStandardMaterial({ color: ['#ffffff', '#f2c1cc', '#c9d8f5'][k % 3], roughness: 0.7 })), maryX + s * 0.95 + (fl() - 0.5) * 0.4, 0.95 + fl() * 0.35, maryZ + 0.45 + (fl() - 0.5) * 0.35);
  }
  // Prie-dieu facing Our Lady.
  const maryKneel = { x: maryX, z: maryZ + 2.0, yaw: 0 };
  box('woodDark', 1.0, 0.1, 0.32, maryX, 0.12, maryKneel.z - 0.05);
  box('woodDark', 1.0, 0.08, 0.28, maryX, 0.9, maryKneel.z - 0.45);
  box('woodDark', 0.06, 0.9, 0.06, maryX - 0.45, 0.45, maryKneel.z - 0.45);
  box('woodDark', 0.06, 0.9, 0.06, maryX + 0.45, 0.45, maryKneel.z - 0.45);
  block(maryX, maryZ - 0.2, 1.8, 1.4);
  const maryLabel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(labelTexture('성모 제대', 'OUR LADY')), transparent: true, depthWrite: false })));
  maryLabel.scale.set(1.6, 0.4, 1);
  maryLabel.position.set(maryX, 6.6, maryZ + 0.4);
  group.add(maryLabel);

  // ---------- Paintings (public-domain masterpieces) ----------
  const painting = (id: string, x: number, y: number, z: number, h: number, ry: number) => {
    const [iw, ih] = image(id).size;
    const w = h * (iw / ih);
    const t = tex(loader.load(image(id).src));
    t.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    group.add(g);
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.18 })));
    canvas.position.z = 0.06;
    g.add(canvas);
    const fw = 0.16;
    for (const [fx, fy, fwid, fh] of [[0, h / 2 + fw / 2, w + fw * 2, fw], [0, -h / 2 - fw / 2, w + fw * 2, fw], [-w / 2 - fw / 2, 0, fw, h], [w / 2 + fw / 2, 0, fw, h]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(fwid, fh, 0.12), M.gold);
      bar.position.set(fx, fy, 0.06);
      g.add(bar);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, h + 0.4, 0.05), M.woodDark);
    g.add(back);
    return g;
  };
  // Titian's Assumption above a side altar at the east end of the south aisle.
  const tX = 11.0;
  painting('painting-titian', tX, 4.15, Z_E + 0.08, 4.6, 0);
  box('stone', 2.4, 1.0, 0.85, tX, 0.5, Z_E + 0.9, true);
  box('linen', 2.5, 0.03, 0.95, tX, 1.015, Z_E + 0.9);
  box('gold', 0.8, 0.4, 0.03, tX, 0.6, Z_E + 1.33);
  for (const dx of [-0.8, -0.4, 0.4, 0.8]) { cyl('gold', 0.04, 0.06, 0.06, tX + dx, 1.06, Z_E + 0.75, 10); candle(tX + dx, 1.09, Z_E + 0.75, 0.32, 0.02); }
  const titianSpot = new THREE.SpotLight('#fff0d8', 45, 12, 0.5, 0.6, 1.5);
  titianSpot.position.set(tX - 1.0, 7.5, Z_E + 5.5);
  titianSpot.target.position.set(tX, 4.0, Z_E);
  group.add(titianSpot, titianSpot.target);
  // St Joseph and a praying angel on the west wall either side of the doors, each with candles.
  const shrineLights: THREE.PointLight[] = [];
  for (const [id, sx] of [['ref-joseph', -4.6], ['ref-angel', 4.6]] as const) {
    painting(id, sx, 2.55, Z_W - 0.05, 2.7, Math.PI);
    box('stone', 1.5, 0.95, 0.55, sx, 0.475, Z_W - 0.45, true);
    box('linen', 1.55, 0.03, 0.6, sx, 0.965, Z_W - 0.45);
    for (let k = 0; k < 7; k += 1) {
      const cx = sx - 0.6 + k * 0.2, cz = Z_W - 0.45 + (k % 2 ? -0.12 : 0.1);
      cyl('redGlass', 0.035, 0.035, 0.08, cx, 1.02, cz, 10);
      addFlame(cx, 1.07, cz, 0.7);
    }
    const l = new THREE.PointLight('#ffb35c', 6, 6, 1.6);
    l.position.set(sx, 1.6, Z_W - 1.1);
    l.userData.base = 6;
    group.add(l);
    shrineLights.push(l);
  }
  // Raphael and Murillo on the west wall of the aisles, facing the altar.
  painting('painting-raphael', -10.9, 4.9, Z_W - 0.05, 3.6, Math.PI);
  painting('painting-murillo', 10.9, 4.9, Z_W - 0.05, 3.6, Math.PI);
  for (const px of [-10.9, 10.9]) {
    const l = new THREE.SpotLight('#ffeedd', 22, 9, 0.6, 0.7, 1.5);
    l.position.set(px, 8.2, Z_W - 4);
    l.target.position.set(px, 4.9, Z_W);
    group.add(l, l.target);
  }

  // ---------- Votive candle stand (in front of Our Lady) ----------
  const standX = -8.85, standZ = maryZ + 1.3;
  const slots: THREE.Vector3[] = [];
  const slotLit: boolean[] = [];
  const slotFlames: (THREE.Sprite | null)[] = [];
  box('iron', 2.0, 0.05, 0.75, standX, 0.85, standZ);
  for (const [dx, dz] of [[-0.95, -0.33], [0.95, -0.33], [-0.95, 0.33], [0.95, 0.33]]) cyl('iron', 0.02, 0.02, 0.85, standX + dx, 0.425, standZ + dz, 6);
  const tiers = [{ y: 0.88, z: 0.22 }, { y: 1.02, z: 0.0 }, { y: 1.16, z: -0.22 }];
  tiers.forEach((t, ti) => {
    box('iron', 1.95, 0.03, 0.2, standX, t.y, standZ + t.z);
    for (let k = 0; k < 10; k += 1) {
      const x = standX - 0.86 + k * 0.19;
      const z = standZ + t.z;
      mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.085, 14, 1, true), M.redGlass, x, t.y + 0.058, z);
      cyl('wax', 0.03, 0.03, 0.035, x, t.y + 0.033, z, 10);
      slots.push(V(x, t.y + 0.055, z));
      slotLit.push(false);
      slotFlames.push(null);
      void ti;
    }
  });
  box('woodDark', 0.28, 0.3, 0.2, standX + 1.25, 0.15 + 0.85, standZ + 0.1);
  const standLight = new THREE.PointLight('#ffb866', 4, 6, 2);
  standLight.position.set(standX, 1.6, standZ + 0.3);
  group.add(standLight);
  block(standX, standZ, 1.05, 0.42, true);
  const lightSlot = (i: number) => {
    if (slotLit[i]) return;
    slotLit[i] = true;
    slotFlames[i] = addFlame(slots[i].x, slots[i].y + 0.01, slots[i].z, 0.85);
  };
  // Candles already burning from earlier visitors.
  [1, 4, 6, 8, 11, 13, 17, 20, 22, 25, 27].forEach(lightSlot);
  const candleStand: CandleStand = {
    approach: { x: standX, z: standZ + 0.95, yaw: 0 },
    slots,
    isLit: i => slotLit[i],
    freeSlot: near => {
      let best = -1, bd = Infinity;
      slots.forEach((p, i) => {
        if (slotLit[i]) return;
        const d = p.distanceTo(near) + (p.y - 0.88) * 0.8;
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    },
    light: lightSlot,
  };

  // ---------- Confessional (south aisle) ----------
  const cfX = W - 0.75, cfZ = -1.0;
  const cfW = 1.4; // depth along x
  // Three bays along z: penitent | priest | penitent.
  box('woodDark', cfW, 2.5, 0.1, cfX, 1.25, cfZ - 1.85);
  box('woodDark', cfW, 2.5, 0.1, cfX, 1.25, cfZ + 1.85);
  box('woodDark', 0.1, 2.5, 3.8, cfX + cfW / 2, 1.25, cfZ);
  box('woodDark', cfW, 0.1, 3.8, cfX, 2.55, cfZ);
  box('wood', cfW + 0.2, 0.18, 4.0, cfX, 2.68, cfZ);
  box('woodDark', cfW + 0.3, 0.1, 4.1, cfX, 2.82, cfZ);
  // Pediment with a gilded cross.
  bake('woodDark', new THREE.CylinderGeometry(0.7, 0.7, 0.12, 3, 1, false), cfX - cfW / 2 + 0.06, 3.1, cfZ, 0, 0, Math.PI / 2, 1, 0.55, 1);
  box('gold', 0.04, 0.42, 0.06, cfX - cfW / 2 - 0.02, 3.45, cfZ);
  box('gold', 0.04, 0.06, 0.24, cfX - cfW / 2 - 0.02, 3.52, cfZ);
  // Priest's door (centre) with a carved panel, and the two grille partitions.
  for (const dz of [-0.62, 0.62]) {
    box('woodDark', cfW, 2.5, 0.08, cfX, 1.25, cfZ + dz);
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), mat(new THREE.MeshStandardMaterial({ color: '#c9a04a', metalness: 0.7, roughness: 0.4, map: tex(noiseTexture('#806030', 51, 4, 4, 2)) })));
    grille.position.set(cfX + 0.1, 1.45, cfZ + dz + (dz < 0 ? -0.05 : 0.05));
    grille.rotation.y = dz < 0 ? Math.PI : 0;
    group.add(grille);
  }
  box('wood', 0.06, 2.2, 1.1, cfX - cfW / 2, 1.15, cfZ);
  box('gold', 0.03, 0.05, 0.5, cfX - cfW / 2 - 0.03, 1.15, cfZ + 0.35);
  // Kneelers inside the penitent bays.
  for (const dz of [-1.25, 1.25]) box('woodDark', 0.7, 0.1, 0.25, cfX + 0.15, 0.1, cfZ + dz + (dz < 0 ? 0.42 : -0.42));
  // Velvet curtains on the penitent bays (animated open/closed).
  const curtains: THREE.Mesh[] = [];
  for (const dz of [-1.25, 1.25]) {
    const geo = new THREE.PlaneGeometry(1.1, 2.2, 14, 1);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i += 1) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.025);
    geo.computeVertexNormals();
    const c = new THREE.Mesh(geo, M.velvet);
    c.position.set(cfX - cfW / 2 - 0.02, 1.15, cfZ + dz);
    c.rotation.y = -Math.PI / 2;
    c.castShadow = true;
    group.add(c);
    curtains.push(c);
    box('gold', 0.04, 0.04, 1.2, cfX - cfW / 2 - 0.02, 2.3, cfZ + dz);
  }
  block(cfX, cfZ, cfW / 2 + 0.05, 1.95);
  const boothLight = new THREE.PointLight('#ffd9a8', 2.2, 2.6, 2);
  boothLight.position.set(cfX + 0.05, 2.25, cfZ - 1.25);
  group.add(boothLight);
  const cfLight = new THREE.PointLight('#ffcf9a', 3.5, 4.5, 2);
  cfLight.position.set(cfX - 1.2, 2.2, cfZ);
  group.add(cfLight);
  const cfLabel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(labelTexture('고해소', 'CONFESSIONAL')), transparent: true, depthWrite: false })));
  cfLabel.scale.set(1.4, 0.35, 1);
  cfLabel.position.set(cfX - 0.6, 3.9, cfZ);
  group.add(cfLabel);
  let curtainTarget = 0;
  let curtainT = 0;
  // Rising motes released after a confession.
  const relCount = 160;
  const relPos = new Float32Array(relCount * 3);
  const relVel = new Float32Array(relCount * 3);
  const relGeo = new THREE.BufferGeometry();
  relGeo.setAttribute('position', new THREE.BufferAttribute(relPos, 3));
  const relMat = mat(new THREE.PointsMaterial({ size: 0.09, map: tex(glowTexture('rgba(255,250,235,1)', 'rgba(255,220,150,0.4)')), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: '#fff3d6' }));
  const release = new THREE.Points(relGeo, relMat);
  group.add(release);
  let releaseT = -1;
  const penitent = { x: cfX + 0.15, z: cfZ - 1.25 };
  const confessional: Confessional = {
    approach: { x: cfX - cfW / 2 - 0.85, z: cfZ - 1.25, yaw: -Math.PI / 2 }, // facing +X (the booth)
    inside: { x: penitent.x, z: penitent.z - 0.05, yaw: Math.PI },
    cameraEye: V(penitent.x - 0.42, 1.72, penitent.z - 0.48),
    cameraLook: V(cfX + 0.1, 1.25, cfZ - 0.62),
    setCurtain: closed => { curtainTarget = closed ? 1 : 0; },
    release: () => {
      releaseT = 0;
      for (let i = 0; i < relCount; i += 1) {
        relPos[i * 3] = penitent.x - 0.3 + Math.random() * 0.5;
        relPos[i * 3 + 1] = 0.8 + Math.random() * 0.8;
        relPos[i * 3 + 2] = penitent.z - 0.4 + Math.random() * 0.8;
        relVel[i * 3] = (Math.random() - 0.5) * 0.25 - 0.35;
        relVel[i * 3 + 1] = 0.6 + Math.random() * 0.9;
        relVel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      }
      relGeo.attributes.position.needsUpdate = true;
    },
  };

  // ---------- Exterior: facade, towers, roofs, buttresses ----------
  const FZ = Z_W + 0.8; // outer face of the west front
  // Recessed portal: stepped jambs and archivolts around the doorway, tympanum above.
  for (let k = 0; k < 4; k += 1) {
    const w = 2.9 + 0.35 * (k + 1);
    for (const s of [-1, 1]) cyl('exterior', 0.16, 0.16, 7.6, s * w, 3.8, FZ + 0.05 + k * 0.28, 10);
    bake('exterior', new THREE.TubeGeometry(archCurve(w * 2, 7.6, 3.6 + k * 0.25, true, 0, FZ + 0.05 + k * 0.28), 40, 0.17, 8, false), 0, 0, 0);
  }
  for (const s of [-1, 1]) block(s * 3.9, FZ + 0.6, 0.85, 0.7);
  const tympanum = mesh(new THREE.CircleGeometry(2.9, 32, 0, Math.PI), mat(new THREE.MeshStandardMaterial({ map: tex(stationTexture(13)), color: '#e8dcc0', roughness: 0.85 })), 0, 9.6, FZ + 0.02);
  tympanum.scale.y = 0.85;
  // Gallery of niches with statues across the west front.
  for (let k = 0; k < 9; k += 1) {
    const x = -6 + k * 1.5;
    box('stoneDark', 1.1, 2.0, 0.25, x, 12.0, FZ + 0.12);
    const st = mesh(new THREE.CapsuleGeometry(0.22, 1.0, 6, 12), M.exterior, x, 12.0, FZ + 0.3);
    st.castShadow = true;
    mesh(new THREE.SphereGeometry(0.17, 12, 10), M.exterior, x, 12.85, FZ + 0.3);
  }
  box('exterior', 15.6, 0.4, 0.6, 0, 13.3, FZ + 0.25);
  // Gable above the rose.
  bake('exterior', new THREE.CylinderGeometry(8.3, 8.3, 0.8, 3, 1), 0, 25.2, Z_W + 0.4, Math.PI / 2, 0, 0, 1, 1, 0.55);
  bake('gold', new THREE.BoxGeometry(0.2, 1.6, 0.2), 0, 31.0, Z_W + 0.4);
  bake('gold', new THREE.BoxGeometry(0.9, 0.2, 0.2), 0, 31.3, Z_W + 0.4);
  // Twin towers with lancet openings, pinnacles and spires.
  for (const s of [-1, 1]) {
    const tx = s * 11.0, tz = Z_W + 2.6;
    box('exterior', 6.2, 30, 5.8, tx, 15, tz, true);
    for (const [dx, dz] of [[-3.1, -2.9], [3.1, -2.9], [-3.1, 2.9], [3.1, 2.9]]) {
      box('exterior', 0.8, 32, 0.8, tx + dx, 16, tz + dz);
      bake('exterior', new THREE.ConeGeometry(0.5, 3.2, 6), tx + dx, 33.6, tz + dz);
    }
    for (const y of [17.5, 24.5]) {
      for (const dx of [-1.3, 1.3]) {
        const l = mesh(lancetGeometry(1.0, 4.4), mat(new THREE.MeshStandardMaterial({ color: '#1a1712', roughness: 1 })), tx + dx, y, tz + 2.92);
        l.rotation.y = 0;
      }
    }
    bake('slate', new THREE.ConeGeometry(3.6, 14, 8), tx, 37.0, tz);
    bake('gold', new THREE.BoxGeometry(0.15, 1.8, 0.15), tx, 44.9, tz);
    bake('gold', new THREE.BoxGeometry(0.8, 0.15, 0.15), tx, 45.2, tz);
  }
  // Nave roof (steep slate gable) and aisle roofs.
  {
    const len = Z_W - Z_E + 1.0;
    const roof = new THREE.CylinderGeometry(NAVE + 1.4, NAVE + 1.4, len, 3, 1, false);
    bake('slate', roof, 0, 26.4, (Z_W + Z_E) / 2, Math.PI / 2, 0, 0, 1, 1, 0.62);
    for (const s of [-1, 1]) {
      const r = new THREE.BoxGeometry(W - NAVE + 1.6, 0.35, len);
      bake('slate', r, s * (W + NAVE) / 2, 12.0, (Z_W + Z_E) / 2, 0, 0, s * -0.27);
    }
    bake('slate', new THREE.SphereGeometry(APSE_R + 1.2, 32, 12, Math.PI, Math.PI, 0, Math.PI / 2), 0, 24.0, Z_E, 0, 0, 0, 1, 0.75, 1);
  }
  // Flying buttresses along the outside of the aisles.
  for (const s of [-1, 1]) {
    for (const z of PIERS) {
      box('exterior', 1.2, 13, 1.6, s * (W + 3.2), 6.5, z, true);
      bake('exterior', new THREE.ConeGeometry(0.6, 2.6, 4), s * (W + 3.2), 14.3, z, 0, Math.PI / 4, 0);
      const fly = new THREE.BoxGeometry(0.5, 7.4, 0.8);
      bake('exterior', fly, s * (W + NAVE + 3.0) / 2 + s * 1.0, 16.2, z, 0, 0, s * 1.05);
      box('exterior', 0.7, 3.0, 1.0, s * (W + 0.7), 1.5, z);
    }
  }

  // ---------- Exterior: plaza, garden, fountain, grotto ----------
  // Plaza paving in front of the west front, then a long path to the garden.
  bake('path', new THREE.PlaneGeometry(30, 15), 0, 0.004, FZ + 7.5, -Math.PI / 2, 0, 0, 1, 1, 1, false);
  bake('path', new THREE.PlaneGeometry(4.0, 44), 0, 0.005, FZ + 15 + 22, -Math.PI / 2, 0, 0, 1, 1, 1, false);
  bake('path', new THREE.PlaneGeometry(26, 3.2), 7, 0.006, 49.5, -Math.PI / 2, 0, 0, 1, 1, 1, false);
  // Steps up to the portal (decorative edge stones on the plaza).
  for (let k = 0; k < 3; k += 1) box('stoneDark', 9 - k * 0.8, 0.06, 0.4, 0, 0.03, FZ + 0.9 + k * 0.4);
  // Hedges lining the walk and plaza.
  const hedge = (x: number, z: number, w: number, d: number) => {
    bake('leafDark', new THREE.BoxGeometry(w, 0.9, d, 1, 1, 1), x, 0.45, z);
    bake('leaf', new THREE.SphereGeometry(0.5, 10, 6), x, 0.85, z, 0, 0, 0, w, 0.3, d);
    block(x, z, w / 2, d / 2, true);
  };
  for (const s of [-1, 1]) {
    hedge(s * 3.0, FZ + 21, 0.8, 9);
    hedge(s * 3.0, FZ + 36.5, 0.8, 9);
    hedge(s * 14.5, FZ + 7.5, 0.8, 12);
  }
  // Cypress avenue and broad trees.
  const cypress = (x: number, z: number, h = 7) => {
    cyl('bark', 0.12, 0.18, 1.0, x, 0.5, z, 6);
    bake('leafDark', new THREE.ConeGeometry(0.85, h, 10), x, 0.9 + h / 2, z, 0, 0, 0, 1, 1, 1);
    bake('leafDark', new THREE.SphereGeometry(0.85, 10, 8), x, 1.2, z, 0, 0, 0, 1, 0.6, 1);
    block(x, z, 0.6, 0.6);
  };
  for (let k = 0; k < 6; k += 1) for (const s of [-1, 1]) cypress(s * 4.6, FZ + 15 + k * 5.2, 6.5 + (k % 2) * 1.2);
  const tree = (x: number, z: number, r = 2.2) => {
    cyl('bark', 0.2, 0.3, 2.6, x, 1.3, z, 8);
    const t = seeded(Math.floor(x * 13 + z * 7));
    for (let k = 0; k < 5; k += 1) bake(k % 2 ? 'leaf' : 'leafDark', new THREE.IcosahedronGeometry(r * (0.6 + t() * 0.3), 1), x + (t() - 0.5) * r, 3.4 + t() * 1.2, z + (t() - 0.5) * r);
    block(x, z, 0.5, 0.5);
  };
  for (const [x, z] of [[-10, 30], [-14, 40], [-9, 46], [11, 30], [16, 38], [-16, 56], [10, 60], [-6, 62], [20, 56]]) tree(x, z, 2.0 + (Math.abs(x) % 3) * 0.3);
  // Flower beds.
  const flowerColors = ['#f4f1ea', '#e7b8c4', '#f2d779', '#c7b6e6', '#ef8b8b'];
  for (const [bx, bz] of [[-9, 36], [9, 36], [-9, 42], [9, 42]]) {
    box('stoneDark', 4.2, 0.3, 2.4, bx, 0.15, bz);
    block(bx, bz, 2.1, 1.2, true);
    box('leaf', 4.0, 0.12, 2.2, bx, 0.36, bz);
    const f = seeded(bx * 3 + bz);
    for (let k = 0; k < 40; k += 1) {
      const m = mat(new THREE.MeshStandardMaterial({ color: flowerColors[k % flowerColors.length], roughness: 0.7 }));
      mesh(new THREE.SphereGeometry(0.07, 6, 5), m, bx + (f() - 0.5) * 3.8, 0.5 + f() * 0.08, bz + (f() - 0.5) * 2.0);
    }
  }
  // Benches and lamp posts.
  const lampGlows: THREE.Sprite[] = [];
  const lampMat = mat(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  const lamp = (x: number, z: number) => {
    cyl('iron', 0.06, 0.09, 3.2, x, 1.6, z, 8);
    cyl('iron', 0.18, 0.12, 0.08, x, 3.25, z, 8);
    const g = mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(new THREE.MeshBasicMaterial({ color: '#ffe2a6' })), x, 3.45, z);
    g.scale.y = 1.2;
    const h = new THREE.Sprite(lampMat);
    h.position.set(x, 3.45, z);
    h.scale.set(1.6, 1.6, 1);
    group.add(h);
    lampGlows.push(h);
    block(x, z, 0.2, 0.2, true);
  };
  for (const z of [FZ + 12, FZ + 24, FZ + 35]) for (const s of [-1, 1]) lamp(s * 2.4, z);
  const bench = (x: number, z: number, ry: number) => {
    box('wood', 2.0, 0.07, 0.5, x, 0.46, z, false, ry);
    box('wood', 2.0, 0.45, 0.06, x + (ry ? 0.24 * Math.sign(Math.sin(ry)) : 0), 0.75, z + (ry ? 0 : 0.24), false, ry);
    block(x, z, ry ? 0.3 : 1.0, ry ? 1.0 : 0.3, true);
  };
  bench(-7.5, FZ + 10, 0);
  bench(7.5, FZ + 10, 0);
  // Fountain.
  const fX = 0, fZ = 49.5;
  cyl('stone', 2.2, 2.4, 0.55, fX, 0.275, fZ, 40, true);
  const pool = mesh(new THREE.CircleGeometry(2.0, 40), M.water, fX, 0.5, fZ);
  pool.rotation.x = -Math.PI / 2;
  cyl('stone', 0.28, 0.4, 1.6, fX, 1.3, fZ, 16);
  cyl('stone', 0.9, 0.5, 0.25, fX, 2.1, fZ, 24);
  const jetGeo = new THREE.BufferGeometry();
  const jetN = 220;
  const jetPos = new Float32Array(jetN * 3);
  const jetSeed = new Float32Array(jetN);
  for (let i = 0; i < jetN; i += 1) jetSeed[i] = Math.random();
  jetGeo.setAttribute('position', new THREE.BufferAttribute(jetPos, 3));
  const jets = new THREE.Points(jetGeo, mat(new THREE.PointsMaterial({ size: 0.05, color: '#dff4ff', transparent: true, opacity: 0.8, depthWrite: false })));
  group.add(jets);
  // Marian grotto at the east end of the cross walk.
  const gX = 18.5, gZ = 49.5;
  const rocks = seeded(5);
  // Rock arch (a ring of stones in the YZ plane) opening toward the path, and a rough back wall.
  for (let k = 0; k < 44; k += 1) {
    const a = (k / 43) * Math.PI;
    const r = 2.3 + rocks() * 0.5;
    const geo = new THREE.DodecahedronGeometry(0.45 + rocks() * 0.4, 0);
    bake('rock', geo, gX + 0.4 + rocks() * 0.9, 0.3 + Math.sin(a) * 3.3 + rocks() * 0.3, gZ - Math.cos(a) * r, rocks() * 3, rocks() * 3, 0, 1 + rocks() * 0.4, 0.8 + rocks() * 0.3, 1);
  }
  for (let k = 0; k < 30; k += 1) {
    bake('rock', new THREE.DodecahedronGeometry(0.55 + rocks() * 0.45, 0), gX + 2.0 + rocks() * 0.5, 0.3 + rocks() * 3.4, gZ - 2.2 + rocks() * 4.4, rocks() * 3, rocks() * 3, 0);
  }
  // Ledge for the statue inside the niche.
  bake('rock', new THREE.DodecahedronGeometry(0.75, 1), gX + 1.2, 0.55, gZ, 0, 0, 0, 1, 0.7, 1.2);
  box('stoneDark', 0.8, 0.25, 0.8, gX + 1.2, 1.0, gZ);
  const outdoorMary = createMarianStatue();
  outdoorMary.position.set(gX + 1.2, 1.12, gZ);
  outdoorMary.rotation.y = -Math.PI / 2;
  outdoorMary.scale.setScalar(1.08);
  group.add(outdoorMary);
  const grottoLight = new THREE.SpotLight('#fff1d8', 40, 12, 0.5, 0.6, 1.5);
  grottoLight.position.set(gX - 4, 5, gZ + 1.5);
  grottoLight.target.position.set(gX + 1.2, 2.0, gZ);
  group.add(grottoLight, grottoLight.target);
  for (let k = 0; k < 9; k += 1) {
    const z = gZ - 1.6 + k * 0.4;
    candle(gX - 0.9, 0.6, z, 0.18 + (k % 3) * 0.05, 0.03, true);
  }
  box('stoneDark', 0.6, 0.6, 3.6, gX - 0.9, 0.3, gZ);
  block(gX + 1.0, gZ, 2.2, 3.0);
  box('woodDark', 0.32, 0.1, 1.2, gX - 2.4, 0.12, gZ);
  box('woodDark', 0.28, 0.08, 1.2, gX - 1.95, 0.9, gZ);
  const grottoLabel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(labelTexture('성모 동굴', 'MARIAN GROTTO')), transparent: true, depthWrite: false })));
  grottoLabel.scale.set(1.8, 0.45, 1);
  grottoLabel.position.set(gX - 1.0, 5.4, gZ);
  group.add(grottoLabel);

  // Sky dome with a low sun glow, and a ring of distant hills.
  // Photographed sky (Poly Haven HDRI, tonemapped, CC0) on an equirectangular dome.
  const skyTex = tex(loader.load('/textures/sky/kloofendal_puresky_4k.jpg'));
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), mat(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })));
  sky.position.set(0, -20, 30);
  sky.renderOrder = -10;
  group.add(sky);
  const hills = seeded(12);
  for (let k = 0; k < 28; k += 1) {
    const a = (k / 28) * Math.PI * 2;
    const r = 120 + hills() * 30;
    const h = 10 + hills() * 16;
    const w = 26 + hills() * 22;
    bake('hill', new THREE.SphereGeometry(1, 12, 8), Math.cos(a) * r, -3, 30 + Math.sin(a) * r, 0, hills() * 3, 0, w, h, w * 0.7, false);
  }

  // ---------- Merge batches ----------
  for (const [key, b] of batches) {
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach(g => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, M[key]);
    m.castShadow = b.cast && key !== 'vault';
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------- Behaviour ----------
  const indoorAt = (x: number, z: number) => {
    if (Math.abs(x) > W + 0.4 || z < Z_E - APSE_R - 1) return 0;
    return 1 - THREE.MathUtils.smoothstep(z, Z_W - 1.0, Z_W + 3.0);
  };
  const update = (time: number, dt: number, indoor: number) => {
    for (const f of flames) {
      const k = 1 + Math.sin(time * 13 + f.phase) * 0.08 + Math.sin(time * 29 + f.phase * 2) * 0.05;
      f.s.scale.set(f.w * (2 - k), f.ht * k, 1);
      if (f.h) f.h.material.opacity = 0.5;
    }
    haloMat.opacity = 0.45 + Math.sin(time * 7) * 0.05;
    standLight.intensity = 4 + Math.sin(time * 11) * 0.5 + slotLit.filter(Boolean).length * 0.12;
    beamMats.forEach((m, i) => { m.opacity = 0.2 + 0.13 * indoor + Math.sin(time * 0.4 + i * 1.3) * 0.05; });
    poolMats.forEach((m, i) => { m.opacity = (0.42 + Math.sin(time * 0.4 + i * 1.3) * 0.08) * indoor; });
    shrineLights.forEach((l, i) => { l.intensity = l.userData.base * (1 + Math.sin(time * 8 + i * 3) * 0.08 + Math.sin(time * 19 + i) * 0.05); });
    candleLights.forEach((l, i) => { l.intensity = l.userData.base * (1 + Math.sin(time * 9 + i * 2.1) * 0.07 + Math.sin(time * 23 + i) * 0.05); });
    // Dust drifts upward slowly and wraps.
    const p = dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dustCount; i += 1) {
      let y = p.getY(i) + dt * 0.05;
      if (y > 17) y = 0.5;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(time * 0.3 + i) * dt * 0.02);
    }
    p.needsUpdate = true;
    for (const w of fontWater) w.rotation.z = Math.sin(time * 0.8) * 0.02;
    // Fountain jets: particles on parabolic arcs.
    for (let i = 0; i < jetN; i += 1) {
      const t = (time * 0.6 + jetSeed[i]) % 1;
      const a = jetSeed[i] * Math.PI * 2;
      const r = t * 1.6;
      jetPos[i * 3] = fX + Math.cos(a) * r * 0.55;
      jetPos[i * 3 + 1] = 2.3 + t * 2.2 - t * t * 3.4;
      jetPos[i * 3 + 2] = fZ + Math.sin(a) * r * 0.55;
    }
    jetGeo.attributes.position.needsUpdate = true;
    // Confessional curtains slide closed (bunching toward the edge).
    curtainT += (curtainTarget - curtainT) * Math.min(1, dt * 3.5);
    curtains.forEach(c => {
      c.scale.x = 0.25 + 0.75 * curtainT;
      c.position.z = (c.position.z < cfZ ? cfZ - 1.25 : cfZ + 1.25) + (c.position.z < cfZ ? -0.42 : 0.42) * (1 - curtainT);
    });
    if (releaseT >= 0) {
      releaseT += dt;
      for (let i = 0; i < relCount; i += 1) {
        relPos[i * 3] += relVel[i * 3] * dt;
        relPos[i * 3 + 1] += relVel[i * 3 + 1] * dt;
        relPos[i * 3 + 2] += relVel[i * 3 + 2] * dt + Math.sin(time * 2 + i) * dt * 0.1;
      }
      relGeo.attributes.position.needsUpdate = true;
      relMat.opacity = Math.max(0, Math.min(1, releaseT * 2) * (1 - releaseT / 6));
      if (releaseT > 6) releaseT = -1;
    }
    lampGlows.forEach(l => { (l.material as THREE.SpriteMaterial).opacity = 0.5 + 0.4 * (1 - indoor); });
    chandLights.forEach((l, i) => { l.intensity = 22 + Math.sin(time * 5 + i) * 1.2; });
  };

  return {
    group,
    blockers,
    bounds: { minX: -26, maxX: 26, minZ: Z_E - APSE_R + 0.5, maxZ: 68 },
    seats,
    fonts,
    candleStand,
    confessional,
    maryInside: maryKneel,
    grotto: { x: gX - 2.3, z: gZ, yaw: -Math.PI / 2 }, // facing +X (the statue)
    start: { x: 0, z: 14.5, yaw: 0 },
    indoorAt,
    update,
    dispose: () => {
      disposeGroup(crucifix);
      disposeGroup(mary);
      disposeGroup(outdoorMary);
      group.traverse(o => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose();
      });
      disposables.forEach(d => d.dispose());
    },
  };
};
