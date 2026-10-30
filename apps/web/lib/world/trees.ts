import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Broad-leaved garden trees: a branching skeleton of tapered bark tubes and leaf-cluster cards
 * textured from photographed leaves (Poly Haven, CC0). A few variants are built once and shared.
 */

const rand = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
};

/** Tube along a curve whose radius tapers from r0 to r1, with bark UVs (u around, v along). */
const taperedTube = (curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, segs: number, radial: number, vScale: number) => {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const len = curve.getLength();
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    curve.getPointAt(t, p);
    const r = THREE.MathUtils.lerp(r0, r1, t);
    for (let j = 0; j <= radial; j += 1) {
      const a = (j / radial) * Math.PI * 2;
      n.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a)).normalize();
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nor.push(n.x, n.y, n.z);
      uv.push((j / radial) * Math.max(1, Math.round(r0 * 12)), t * len * vScale);
    }
  }
  for (let i = 0; i < segs; i += 1) for (let j = 0; j < radial; j += 1) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
};

/** One leaf-cluster card: a quad hanging from `at`, pointing roughly along `dir`, using atlas cell 0..3. */
const card = (at: THREE.Vector3, dir: THREE.Vector3, size: number, cell: number, roll: number) => {
  const g = new THREE.PlaneGeometry(size, size);
  g.translate(0, size * 0.42, 0); // twig base near the branch
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const cu = (cell % 2) * 0.5, cv = cell < 2 ? 0.5 : 0;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, cu + uv.getX(i) * 0.5, cv + uv.getY(i) * 0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const r = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll);
  g.applyQuaternion(r.premultiply(q));
  // Bend normals outward from the crown centre later; keep plane normals for now.
  g.translate(at.x, at.y, at.z);
  return g;
};

export type TreeVariant = { bark: THREE.BufferGeometry; leaves: THREE.BufferGeometry };

export const buildTreeVariant = (seed: number, height = 7, spread = 3.4): TreeVariant => {
  const r = rand(seed * 7919 + 13);
  const barks: THREE.BufferGeometry[] = [];
  const cards: THREE.BufferGeometry[] = [];
  const crownC = new THREE.Vector3(0, height * 0.68, 0);

  const branch = (start: THREE.Vector3, dir: THREE.Vector3, length: number, radius: number, depth: number) => {
    const pts = [start.clone()];
    const d = dir.clone().normalize();
    let p = start.clone();
    const steps = 4;
    for (let i = 1; i <= steps; i += 1) {
      d.add(new THREE.Vector3((r() - 0.5) * 0.35, (r() - 0.35) * 0.25, (r() - 0.5) * 0.35)).normalize();
      if (depth > 0) d.y += 0.04;
      p = p.clone().addScaledVector(d, length / steps);
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const end = radius * (depth >= 3 ? 0.35 : 0.55);
    barks.push(taperedTube(curve, radius, end, depth === 0 ? 10 : 6, depth === 0 ? 12 : depth === 1 ? 8 : 5, 0.8));
    if (depth >= 3 || radius < 0.03) {
      // Leaf clusters around the end of thin branches, bending outward from the crown.
      const n = 4 + Math.floor(r() * 4);
      for (let k = 0; k < n; k += 1) {
        const t = 0.35 + r() * 0.65;
        const at = curve.getPointAt(t);
        const out = at.clone().sub(crownC).normalize().add(new THREE.Vector3((r() - 0.5) * 0.9, 0.5 + r() * 0.5, (r() - 0.5) * 0.9)).normalize();
        cards.push(card(at, out, 1.05 + r() * 0.75, Math.floor(r() * 4), r() * Math.PI));
      }
      return;
    }
    const kids = depth === 0 ? 5 : 3;
    for (let k = 0; k < kids; k += 1) {
      const t = depth === 0 ? 0.55 + (k / kids) * 0.42 : 0.4 + r() * 0.6;
      const at = curve.getPointAt(Math.min(1, t));
      const around = (k / kids) * Math.PI * 2 + r() * 1.2;
      const nd = new THREE.Vector3(Math.cos(around), depth === 0 ? 0.55 + r() * 0.5 : 0.3 + r() * 0.5, Math.sin(around)).normalize();
      branch(at, nd, length * (depth === 0 ? 0.62 : 0.6) * (0.8 + r() * 0.4), radius * (depth === 0 ? 0.45 : 0.55), depth + 1);
    }
    if (depth > 0) branch(p, d, length * 0.55, radius * 0.6, depth + 1);
  };
  branch(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3((r() - 0.5) * 0.15, 1, (r() - 0.5) * 0.15), height * 0.62, 0.24, 0);
  // Root flare.
  for (let k = 0; k < 5; k += 1) {
    const a = (k / 5) * Math.PI * 2 + r();
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.55, 0), new THREE.Vector3(Math.cos(a) * 0.25, 0.08, Math.sin(a) * 0.25), new THREE.Vector3(Math.cos(a) * 0.6, -0.05, Math.sin(a) * 0.6));
    barks.push(taperedTube(c, 0.13, 0.04, 6, 6, 0.8));
  }
  void spread;
  const bark = mergeGeometries(barks)!;
  const leaves = mergeGeometries(cards)!;
  // Leaf normals point away from the crown centre so the canopy shades like a volume.
  const lp = leaves.attributes.position as THREE.BufferAttribute;
  const ln = leaves.attributes.normal as THREE.BufferAttribute;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < lp.count; i += 1) {
    tmp.set(lp.getX(i), lp.getY(i), lp.getZ(i)).sub(crownC).normalize();
    tmp.y += 0.35;
    tmp.normalize();
    ln.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  barks.forEach(g => g.dispose());
  cards.forEach(g => g.dispose());
  return { bark, leaves };
};

export const treeMaterials = (loader: THREE.TextureLoader, aniso: number) => {
  const barkMap = loader.load('/textures/trees/bark_diff.jpg');
  const barkNor = loader.load('/textures/trees/bark_nor.jpg');
  for (const t of [barkMap, barkNor]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; }
  barkMap.colorSpace = THREE.SRGBColorSpace;
  const leafMap = loader.load('/textures/trees/leaf-clusters.png');
  leafMap.colorSpace = THREE.SRGBColorSpace;
  leafMap.anisotropy = aniso;
  return {
    bark: new THREE.MeshStandardMaterial({ map: barkMap, normalMap: barkNor, roughness: 0.95, color: '#c9b8a4' }),
    leaves: new THREE.MeshStandardMaterial({ map: leafMap, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: '#d2e6b0' }),
    textures: [barkMap, barkNor, leafMap],
  };
};
