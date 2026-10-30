// Tiny signed-distance sculpting kit: primitives are blended with a smooth minimum on a grid
// and turned into a mesh with marching cubes. Used offline to make the devotional statues.
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import fs from 'node:fs';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
export { v };

/** Round cone (capsule with different end radii), from Inigo Quilez. */
const roundCone = (p, a, b, r1, r2) => {
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = p.x - a.x, pay = p.y - a.y, paz = p.z - a.z;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
};

/** Ellipsoid (approximate distance), optionally rotated by a quaternion. */
const ellipsoid = (p, r) => {
  const k0 = Math.hypot(p.x / r.x, p.y / r.y, p.z / r.z);
  const k1 = Math.hypot(p.x / (r.x * r.x), p.y / (r.y * r.y), p.z / (r.z * r.z));
  return k0 < 1e-6 ? -Math.min(r.x, r.y, r.z) : (k0 * (k0 - 1)) / k1;
};

export const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smax = (a, b, k) => -smin(-a, -b, k);

/**
 * A sculpt is a list of parts. Each part: { d(p) -> distance, box: Box3, k (blend), op: 'add'|'sub'|'cut' }.
 */
export class Sculpt {
  constructor() { this.parts = []; }
  add(part) { this.parts.push({ op: 'add', k: 0.02, ...part }); return this; }

  cone(a, b, r1, r2, k = 0.02, extra = {}) {
    const box = new THREE.Box3().setFromPoints([a, b]).expandByScalar(Math.max(r1, r2) + 0.02);
    return this.add({ d: p => roundCone(p, a, b, r1, r2), box, k, ...extra });
  }

  ell(c, r, rot = [0, 0, 0], k = 0.02, extra = {}) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)).invert();
    const t = new THREE.Vector3();
    const m = Math.max(r.x, r.y, r.z) + 0.02;
    const box = new THREE.Box3(c.clone().subScalar(m), c.clone().addScalar(m));
    return this.add({ d: p => ellipsoid(t.copy(p).sub(c).applyQuaternion(q), r), box, k, ...extra });
  }

  /** Remove material smoothly (e.g. eye sockets). */
  sub(part) { this.parts.push({ op: 'sub', k: 0.01, ...part }); return this; }

  eval(p) {
    let d = 1e3;
    for (const part of this.parts) {
      if (!part.box.containsPoint(p)) {
        if (part.op === 'add') continue;
        continue;
      }
      const e = part.d(p) + (part.disp ? part.disp(p) : 0);
      if (part.op === 'add') d = smin(d, e, part.k);
      else d = smax(d, -e, part.k);
    }
    return d;
  }

  /** Mesh the sculpt inside a cubic region. Returns { position, normal } Float32Arrays. */
  mesh(center, size, res, post) {
    const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 2_500_000);
    mc.isolation = 0;
    const f = mc.field;
    const p = new THREE.Vector3();
    const half = size / 2;
    // Field: positive inside. Evaluate only near the parts to save time.
    f.fill(-1);
    const toIdx = (w, c) => Math.max(0, Math.min(res - 1, Math.round(((w - c) / size + 0.5) * res)));
    const touched = new Uint8Array(res * res * res);
    for (const part of this.parts) {
      if (part.op !== 'add') continue;
      const b = part.box;
      const x0 = toIdx(b.min.x - 0.03, center.x), x1 = toIdx(b.max.x + 0.03, center.x);
      const y0 = toIdx(b.min.y - 0.03, center.y), y1 = toIdx(b.max.y + 0.03, center.y);
      const z0 = toIdx(b.min.z - 0.03, center.z), z1 = toIdx(b.max.z + 0.03, center.z);
      for (let z = z0; z <= z1; z += 1) for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
        const i = x + y * res + z * res * res;
        if (touched[i]) continue;
        touched[i] = 1;
        p.set(center.x + (x / res - 0.5) * size, center.y + (y / res - 0.5) * size, center.z + (z / res - 0.5) * size);
        let d = this.eval(p);
        if (post) d = post(p, d);
        f[i] = -d * 100;
      }
    }
    mc.update();
    const n = mc.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    const sp = mc.positionArray, sn = mc.normalArray;
    for (let i = 0; i < n; i += 1) {
      pos[i * 3] = center.x + sp[i * 3] * half;
      pos[i * 3 + 1] = center.y + sp[i * 3 + 1] * half;
      pos[i * 3 + 2] = center.z + sp[i * 3 + 2] * half;
      const nx = sn[i * 3], ny = sn[i * 3 + 1], nz = sn[i * 3 + 2];
      const l = Math.hypot(nx, ny, nz) || 1;
      nor[i * 3] = nx / l; nor[i * 3 + 1] = ny / l; nor[i * 3 + 2] = nz / l;
    }
    return { position: pos, normal: nor };
  }
}

/** Writes a minimal GLB holding several named meshes (positions + normals, one material each). */
export const writeGlb = (file, meshes) => {
  const chunks = [];
  let offset = 0;
  const views = [], accessors = [], gMeshes = [], nodes = [], materials = [];
  meshes.forEach((m, i) => {
    const count = m.position.length / 3;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let j = 0; j < count; j += 1) for (let c = 0; c < 3; c += 1) {
      const val = m.position[j * 3 + c];
      if (val < min[c]) min[c] = val;
      if (val > max[c]) max[c] = val;
    }
    for (const [arr, extra] of [[m.position, { min, max }], [m.normal, {}]]) {
      const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
      chunks.push(buf);
      views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target: 34962 });
      accessors.push({ bufferView: views.length - 1, componentType: 5126, count, type: 'VEC3', ...extra });
      offset += buf.length;
    }
    materials.push({ name: m.material, pbrMetallicRoughness: { baseColorFactor: m.color ?? [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.5 } });
    gMeshes.push({ name: m.name, primitives: [{ attributes: { POSITION: accessors.length - 2, NORMAL: accessors.length - 1 }, material: i }] });
    nodes.push({ name: m.name, mesh: i });
  });
  const bin = Buffer.concat(chunks);
  const json = {
    asset: { version: '2.0', generator: 'religion-sculpt' },
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes: gMeshes, materials,
    accessors, bufferViews: views, buffers: [{ byteLength: bin.length }],
  };
  let js = Buffer.from(JSON.stringify(json));
  if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - (js.length % 4), 0x20)]);
  let bb = bin;
  if (bb.length % 4) bb = Buffer.concat([bb, Buffer.alloc(4 - (bb.length % 4))]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + js.length + 8 + bb.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bb.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(file, Buffer.concat([header, jh, js, bh, bb]));
};
