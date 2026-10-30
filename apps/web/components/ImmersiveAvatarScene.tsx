'use client';

import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { Avatar } from '@/lib/world/avatar';
import { buildSite, type Blocker, type Site } from '@/lib/world/cathedral';
import { glowTexture } from '@/lib/world/textures';

type Props = { displayName: string };

type Action =
  | 'cross' | 'prayer' | 'rosary' | 'bow' | 'greet' | 'seat' | 'veil' | 'candle' | 'confess' | 'mary';

type Api = {
  act: (a: Action) => void;
  dip: () => void;
  lightCandle: (intention: string) => void;
  finishConfession: () => void;
  leaveConfession: () => void;
};

const INTENTIONS = ['사랑하는 사람을 위해', '아픈 이의 치유를 위해', '세상을 떠난 이를 위해', '감사의 마음으로'];
const AVATAR_RADIUS = 0.3;

const gridCache = new WeakMap<Blocker[], Uint8Array>();

/** Grid A* over the ground plane; returns waypoints (corners only), or [] if unreachable. */
const findPath = (blockers: Blocker[], bounds: Site['bounds'], sx: number, sz: number, gx: number, gz: number): THREE.Vector3[] => {
  const cell = 0.5;
  const cols = Math.ceil((bounds.maxX - bounds.minX) / cell) + 1;
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell) + 1;
  const total = cols * rows;
  let blocked = gridCache.get(blockers);
  if (!blocked) {
    blocked = new Uint8Array(total);
    for (const b of blockers) {
      const x0 = Math.max(0, Math.ceil((b.x - b.rx - AVATAR_RADIUS - bounds.minX) / cell));
      const x1 = Math.min(cols - 1, Math.floor((b.x + b.rx + AVATAR_RADIUS - bounds.minX) / cell));
      const z0 = Math.max(0, Math.ceil((b.z - b.rz - AVATAR_RADIUS - bounds.minZ) / cell));
      const z1 = Math.min(rows - 1, Math.floor((b.z + b.rz + AVATAR_RADIUS - bounds.minZ) / cell));
      for (let iz = z0; iz <= z1; iz += 1) for (let ix = x0; ix <= x1; ix += 1) blocked[iz * cols + ix] = 1;
    }
    gridCache.set(blockers, blocked);
  }
  const grid = blocked;
  const isBlocked = (ix: number, iz: number) => ix < 0 || iz < 0 || ix >= cols || iz >= rows || grid[iz * cols + ix] === 1;
  const nearestFree = (x: number, z: number) => {
    const cx = THREE.MathUtils.clamp(Math.round((x - bounds.minX) / cell), 0, cols - 1);
    const cz = THREE.MathUtils.clamp(Math.round((z - bounds.minZ) / cell), 0, rows - 1);
    if (!isBlocked(cx, cz)) return { ix: cx, iz: cz };
    for (let r = 1; r <= 12; r += 1) {
      for (let dz = -r; dz <= r; dz += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (!isBlocked(cx + dx, cz + dz)) return { ix: cx + dx, iz: cz + dz };
        }
      }
    }
    return null;
  };
  const start = nearestFree(sx, sz), goal = nearestFree(gx, gz);
  if (!start || !goal) return [];
  const si = start.iz * cols + start.ix, gi = goal.iz * cols + goal.ix;
  const point = (i: number) => new THREE.Vector3(bounds.minX + (i % cols) * cell, 0, bounds.minZ + Math.floor(i / cols) * cell);
  if (si === gi) return [new THREE.Vector3(gx, 0, gz)];
  const g = new Float64Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const heap: { i: number; f: number }[] = [];
  const push = (i: number, f: number) => {
    heap.push({ i, f });
    let k = heap.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (heap[p].f <= f) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l].f < heap[m].f) m = l;
        if (r < heap.length && heap[r].f < heap[m].f) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top.i;
  };
  const h = (ix: number, iz: number) => { const dx = Math.abs(ix - goal.ix), dz = Math.abs(iz - goal.iz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  g[si] = 0;
  push(si, h(start.ix, start.iz));
  let found = false;
  while (heap.length) {
    const cur = pop();
    if (closed[cur]) continue;
    if (cur === gi) { found = true; break; }
    closed[cur] = 1;
    const ix = cur % cols, iz = Math.floor(cur / cols);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dz) continue;
        const nx = ix + dx, nz = iz + dz;
        if (isBlocked(nx, nz)) continue;
        if (dx && dz && (isBlocked(ix + dx, iz) || isBlocked(ix, iz + dz))) continue;
        const ni = nz * cols + nx;
        const cost = g[cur] + (dx && dz ? Math.SQRT2 : 1);
        if (cost < g[ni]) { g[ni] = cost; parent[ni] = cur; push(ni, cost + h(nx, nz)); }
      }
    }
  }
  if (!found) return [];
  const cells: number[] = [];
  for (let c = gi; c !== si && c >= 0; c = parent[c]) cells.push(c);
  cells.reverse();
  const pts = cells.map(point);
  // String-pull: keep only points where direction changes.
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pts.length; i += 1) {
    const prev = i === 0 ? new THREE.Vector3(sx, 0, sz) : pts[i - 1];
    const next = pts[i + 1];
    if (!next) { out.push(pts[i]); break; }
    const d1 = pts[i].clone().sub(prev).normalize(), d2 = next.clone().sub(pts[i]).normalize();
    if (d1.dot(d2) < 0.999) out.push(pts[i]);
  }
  if (out.length) out[out.length - 1] = new THREE.Vector3(gx, 0, gz).distanceTo(out[out.length - 1]) < 0.8 ? new THREE.Vector3(gx, 0, gz) : out[out.length - 1];
  return out;
};

export default function ImmersiveAvatarScene({ displayName }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const [notice, setNotice] = useState('바닥을 클릭하거나 WASD·조이스틱으로 이동하고, 아래 동작을 선택하세요.');
  const [nearFont, setNearFont] = useState(false);
  const [fontStep, setFontStep] = useState<'water' | 'cross' | 'done'>('water');
  const [joystick, setJoystick] = useState({ x: 0, y: 0 });
  const [state, setState] = useState({ veil: false, sitting: false, praying: false, rosary: false });
  const [candlePicker, setCandlePicker] = useState(false);
  const [confession, setConfession] = useState<'off' | 'writing' | 'released'>('off');
  const [confessionText, setConfessionText] = useState('');
  const [releasedText, setReleasedText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const indoorFog = new THREE.Color('#1f1914');
    const outdoorFog = new THREE.Color('#cdbda0');
    scene.fog = new THREE.Fog(indoorFog.clone(), 30, 110);
    const camera = new THREE.PerspectiveCamera(62, host.clientWidth / Math.max(1, host.clientHeight), 0.05, 420);

    const hemi = new THREE.HemisphereLight('#f3e3c6', '#3b3026', 0.6);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffdcaa', 2.4);
    sun.position.set(-40, 45, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 60, bottom: -60, near: 1, far: 220 });
    sun.shadow.bias = -0.0004;
    sun.target.position.set(0, 0, 20);
    scene.add(sun, sun.target);

    const site = buildSite(renderer);
    scene.add(site.group);
    const avatar = new Avatar({ name: displayName });
    avatar.root.position.set(site.start.x, 0, site.start.z);
    avatar.root.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    scene.add(avatar.root);

    // Sparkle burst used when a candle catches.
    const sparkN = 40;
    const sparkPos = new Float32Array(sparkN * 3);
    const sparkVel = new Float32Array(sparkN * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkTex = glowTexture('rgba(255,250,220,1)', 'rgba(255,190,90,0.5)');
    const sparkMat = new THREE.PointsMaterial({ size: 0.05, map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    scene.add(new THREE.Points(sparkGeo, sparkMat));
    let sparkT = -1;
    const sparkle = (p: THREE.Vector3) => {
      sparkT = 0;
      for (let i = 0; i < sparkN; i += 1) {
        sparkPos.set([p.x, p.y + 0.05, p.z], i * 3);
        sparkVel.set([(Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4], i * 3);
      }
    };

    // ----- Movement state -----
    const collides = (x: number, z: number) => site.blockers.some(b => Math.abs(x - b.x) < b.rx + AVATAR_RADIUS && Math.abs(z - b.z) < b.rz + AVATAR_RADIUS);
    let route: THREE.Vector3[] = [];
    let onArrive: (() => void) | null = null;
    type Glide = { to: THREE.Vector3; yaw?: number; dur: number; t: number; from: THREE.Vector3 };
    let glides: Glide[] = [];
    let onGlidesDone: (() => void) | null = null;
    let seated: { index: number; aisle: THREE.Vector3 } | null = null;
    let confessing = false;
    let rosaryCount = 0;
    let rosaryTimer = 0;
    let lastNearFont = false;

    const say = (s: string) => setNotice(s);
    const sync = () => setState({ veil: avatar.veilOn, sitting: avatar.posture === 'sit', praying: avatar.hands === 'prayer', rosary: avatar.hands === 'rosary' });
    const faceYaw = (yaw: number) => { targetYaw = yaw; };
    let targetYaw = site.start.yaw;
    avatar.root.rotation.y = targetYaw;

    const goTo = (x: number, z: number, arrive: (() => void) | null, label?: string) => {
      const path = findPath(site.blockers, site.bounds, avatar.root.position.x, avatar.root.position.z, x, z);
      if (!path.length) { say('그곳으로 가는 길을 찾지 못했어요. 조금 이동한 뒤 다시 시도해 주세요.'); return false; }
      route = path;
      onArrive = arrive;
      if (label) say(label);
      return true;
    };
    const glide = (steps: { x: number; z: number; yaw?: number; dur: number }[], done: (() => void) | null) => {
      glides = steps.map(s => ({ to: new THREE.Vector3(s.x, 0, s.z), yaw: s.yaw, dur: s.dur, t: 0, from: new THREE.Vector3() }));
      if (glides[0]) glides[0].from.copy(avatar.root.position);
      onGlidesDone = done;
    };
    /** Leave a pew, prie-dieu or kneel before starting something else; then run `next`. */
    const getUp = (next?: () => void) => {
      if (seated) {
        const aisle = seated.aisle;
        seated = null;
        avatar.setPosture('stand');
        glide([{ x: avatar.root.position.x, z: aisle.z, dur: 0.6 }, { x: aisle.x, z: aisle.z, dur: 0.9 }], () => { sync(); next?.(); });
        return true;
      }
      if (avatar.posture !== 'stand') {
        avatar.setPosture('stand');
        avatar.setHands('rest');
        sync();
        window.setTimeout(() => next?.(), 600);
        return true;
      }
      return false;
    };
    const cancelRoutes = () => { route = []; onArrive = null; };

    // ----- Actions -----
    const act = (a: Action) => {
      if (confessing && a !== 'cross' && a !== 'prayer') { say('고해소 안에 있습니다. 마친 뒤 이용해 주세요.'); return; }
      if (a === 'cross') {
        avatar.play('cross', { onDone: () => say('성부와 성자와 성령의 이름으로. 아멘.') });
        say('이마 → 가슴 → 왼쪽 어깨 → 오른쪽 어깨 순서로 성호를 긋습니다.');
        return;
      }
      if (a === 'prayer') {
        const on = avatar.hands !== 'prayer';
        avatar.setHands(on ? 'prayer' : 'rest');
        rosaryCount = 0;
        say(on ? '두 손을 모으고 조용히 기도합니다. 다시 누르면 손을 내립니다.' : '기도를 마쳤습니다.');
        sync();
        return;
      }
      if (a === 'rosary') {
        const on = avatar.hands !== 'rosary';
        avatar.setHands(on ? 'rosary' : 'rest');
        rosaryCount = 0;
        rosaryTimer = 0;
        say(on ? '묵주기도를 시작합니다. 한 알씩 넘기며 기도해요.' : '묵주기도를 마쳤습니다.');
        sync();
        return;
      }
      if (a === 'bow') { avatar.play('bow'); say('정중하게 고개 숙여 절합니다.'); return; }
      if (a === 'greet') { avatar.play('greet'); say('손을 들어 인사합니다.'); return; }
      if (a === 'veil') {
        const putOn = !avatar.veilOn;
        avatar.play(putOn ? 'veilOn' : 'veilOff', { onDone: () => { sync(); say(putOn ? '미사보를 썼습니다.' : '미사보를 벗었습니다.'); } });
        say(putOn ? '두 손으로 미사보를 펼쳐 머리에 씁니다.' : '미사보를 조심스럽게 벗습니다.');
        return;
      }
      if (a === 'seat') {
        if (seated) { getUp(() => say('자리에서 일어났습니다.')); say('자리에서 일어납니다.'); return; }
        const used = new Set<number>();
        const pos = avatar.root.position;
        const best = site.seats
          .map((s, i) => ({ s, i, d: Math.hypot(s.x - pos.x, s.z - pos.z) }))
          .filter(o => !used.has(o.i))
          .sort((p, q) => p.d - q.d)[0];
        if (!best) return;
        const aisle = new THREE.Vector3(best.s.aisleX, 0, best.s.z - 0.72);
        getUp();
        avatar.setHands('rest');
        goTo(aisle.x, aisle.z, () => {
          glide([
            { x: best.s.x, z: aisle.z, yaw: 0, dur: 0.4 + Math.abs(best.s.x - aisle.x) * 0.45 },
            { x: best.s.x, z: best.s.z, yaw: 0, dur: 0.7 },
          ], () => {
            seated = { index: best.i, aisle };
            avatar.setPosture('sit', 0.48);
            say('신자석에 앉았습니다. 기도하기·묵주기도·미사보도 앉은 채로 할 수 있어요.');
            sync();
          });
        }, '가까운 신자석으로 갑니다.');
        return;
      }
      if (a === 'mary') {
        const pos = avatar.root.position;
        const inside = site.indoorAt(pos.x, pos.z) > 0.5;
        const spot = inside ? site.maryInside : site.grotto;
        const start = () => goTo(spot.x, spot.z, () => {
          faceYaw(spot.yaw);
          avatar.setPosture('kneel');
          avatar.setHands('prayer');
          say(inside ? '성모님 앞 기도대에 무릎을 꿇고 기도합니다.' : '성모 동굴 앞에 무릎을 꿇고 기도합니다.');
          sync();
        }, inside ? '성당 안 성모 제대로 갑니다.' : '정원의 성모 동굴로 갑니다.');
        if (!getUp(start)) start();
        return;
      }
      if (a === 'candle') {
        const go = () => goTo(site.candleStand.approach.x, site.candleStand.approach.z, () => {
          faceYaw(site.candleStand.approach.yaw);
          setCandlePicker(true);
          say('어떤 마음으로 초를 봉헌할까요?');
        }, '성모 제대 앞 봉헌초대로 갑니다.');
        avatar.setHands('rest');
        if (!getUp(go)) go();
        return;
      }
      if (a === 'confess') {
        const cf = site.confessional;
        const go = () => goTo(cf.approach.x, cf.approach.z, () => {
          faceYaw(cf.approach.yaw);
          confessing = true;
          glide([{ x: cf.inside.x, z: cf.approach.z, yaw: Math.PI / 2, dur: 1.1 }, { x: cf.inside.x, z: cf.inside.z, yaw: cf.inside.yaw, dur: 0.6 }], () => {
            cf.setCurtain(true);
            avatar.setPosture('kneel');
            avatar.setHands('prayer');
            setConfession('writing');
            say('고해소 안입니다. 마음에 있는 것을 적고 내려놓으세요.');
            sync();
          });
        }, '고해소로 갑니다.');
        avatar.setHands('rest');
        if (!getUp(go)) go();
      }
    };
    const lightCandle = (intention: string) => {
      setCandlePicker(false);
      const slot = site.candleStand.freeSlot(avatar.root.position.clone().add(new THREE.Vector3(0, 1, -0.8)));
      if (slot < 0) { say('모든 자리에 초가 밝혀져 있어요. 잠시 기도하며 머물러 주세요.'); return; }
      const wick = site.candleStand.slots[slot].clone().add(new THREE.Vector3(0, 0.03, 0));
      avatar.play('light', {
        target: wick,
        onCue: () => { site.candleStand.light(slot); sparkle(wick); say(`초가 밝혀졌습니다 · ${intention}`); },
        onDone: () => { avatar.play('amen', { onDone: () => say(`${intention} 봉헌한 초가 성모님 앞에서 타오르고 있습니다.`) }); },
      });
      say('불붙이개로 초에 불을 옮깁니다…');
    };
    const finishConfession = () => {
      site.confessional.release();
      setConfession('released');
      say('적은 마음이 빛이 되어 올라갑니다. 이 글은 기기 밖으로 보내지거나 저장되지 않습니다.');
    };
    const leaveConfession = () => {
      const cf = site.confessional;
      setConfession('off');
      avatar.setPosture('stand');
      avatar.setHands('rest');
      cf.setCurtain(false);
      window.setTimeout(() => {
        glide([{ x: cf.inside.x, z: cf.approach.z, yaw: -Math.PI / 2, dur: 0.6 }, { x: cf.approach.x, z: cf.approach.z, yaw: -Math.PI / 2, dur: 1.0 }], () => {
          confessing = false;
          sync();
          say('평화를 빕니다. 실제 고해성사는 사제와 함께 드립니다.');
        });
      }, 700);
    };
    const dip = () => {
      avatar.play('dip', { onDone: () => say('성수를 찍었습니다. 이어서 성호를 그어 보세요.') });
    };
    apiRef.current = { act, dip, lightCandle, finishConfession, leaveConfession };
    // Development-only hook for automated visual checks (teleport and camera placement).
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __religion?: unknown }).__religion = {
        act, lightCandle, finishConfession, leaveConfession, dip,
        teleport: (x: number, z: number, y = 0) => { avatar.root.position.set(x, 0, z); targetYaw = y; avatar.root.rotation.y = y; route = []; },
        view: (vy: number, vp: number, vd: number) => { yaw = vy; pitch = vp; dist = vd; },
        avatar,
        site,
        advance: (sec: number) => { for (let t = 0; t < sec; t += 1 / 60) { avatar.update(1 / 60, false); site.update(t, 1 / 60, 1); } },
      };
    }

    // ----- Input -----
    const keys = new Set<string>();
    let yaw = site.start.yaw, pitch = 0.05, dist = 2.7;
    let joyX = 0, joyY = 0;
    let down = false, moved = false, touch = false, lastX = 0, lastY = 0, downX = 0, downY = 0, pinch = 0;
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const clickMove = (cx: number, cy: number) => {
      if (confessing) return;
      const r = host.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1)), camera);
      const p = raycaster.ray.intersectPlane(ground, new THREE.Vector3());
      if (!p) return;
      avatar.setHands('rest');
      const go = () => goTo(p.x, p.z, null, '목표 지점으로 이동합니다.');
      if (!getUp(go)) go();
      sync();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); e.preventDefault(); }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => { keys.clear(); joyX = joyY = 0; };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' && e.button !== 0) return;
      down = true; moved = false; touch = e.pointerType === 'touch';
      try { host.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
      downX = lastX = e.clientX; downY = lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!down) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 7) moved = true;
      if (moved) {
        yaw += (e.clientX - lastX) * (touch ? 0.009 : 0.0072);
        pitch = THREE.MathUtils.clamp(pitch + (e.clientY - lastY) * (touch ? 0.006 : 0.0055), -0.45, 1.25);
      }
      lastX = e.clientX; lastY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!down) return;
      if (!moved) clickMove(e.clientX, e.clientY);
      down = false;
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.004, 1.2, 9); };
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const n = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (pinch) dist = THREE.MathUtils.clamp(dist + (pinch - n) * 0.012, 1.2, 9);
      pinch = n;
    };
    const onTouchEnd = () => { pinch = 0; };
    const onJoystick = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number }>).detail;
      joyX = THREE.MathUtils.clamp(d?.x ?? 0, -1, 1);
      joyY = THREE.MathUtils.clamp(d?.y ?? 0, -1, 1);
    };
    const onResize = () => {
      camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);
    window.addEventListener('religion:joystick', onJoystick as EventListener);
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('wheel', onWheel, { passive: false });
    host.addEventListener('touchstart', onTouchStart, { passive: true });
    host.addEventListener('touchmove', onTouchMove, { passive: false });
    host.addEventListener('touchend', onTouchEnd);

    // ----- Frame loop -----
    const clock = new THREE.Clock();
    const camPos = new THREE.Vector3(site.start.x, 1.7, site.start.z + 3);
    const camLook = new THREE.Vector3();
    const tmpV = new THREE.Vector3();
    let indoor = 1;
    let frame = 0;
    let firstFrame = true;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      const pos = avatar.root.position;

      const fwd = ((keys.has('w') || keys.has('arrowup')) ? 1 : 0) - ((keys.has('s') || keys.has('arrowdown')) ? 1 : 0) - joyY;
      const side = ((keys.has('d') || keys.has('arrowright')) ? 1 : 0) - ((keys.has('a') || keys.has('arrowleft')) ? 1 : 0) + joyX;
      const manual = Math.abs(fwd) + Math.abs(side) > 0.08 && !confessing;
      let mx = 0, mz = 0, moving = false, speed = 1;
      if (manual && !glides.length) {
        if (avatar.posture !== 'stand' || seated) {
          if (!seated) { avatar.setPosture('stand'); sync(); }
          else getUp();
        } else {
          cancelRoutes();
          if (avatar.hands !== 'rest') { avatar.setHands('rest'); sync(); }
          if (avatar.currentGesture === 'light') avatar.cancelGesture();
          const l = Math.hypot(fwd, side) || 1;
          const f = fwd / l, s = side / l;
          mx = Math.sin(yaw) * f + Math.cos(yaw) * s;
          mz = -Math.cos(yaw) * f + Math.sin(yaw) * s;
          moving = true;
          speed = Math.min(1, Math.hypot(fwd, side));
        }
      } else if (glides.length) {
        const gl = glides[0];
        gl.t += dt;
        const u = Math.min(1, gl.t / gl.dur);
        const e = u * u * (3 - 2 * u);
        pos.lerpVectors(gl.from, gl.to, e);
        if (gl.yaw !== undefined) targetYaw = gl.yaw;
        else if (gl.to.distanceTo(gl.from) > 0.05) targetYaw = Math.atan2(gl.to.x - gl.from.x, -(gl.to.z - gl.from.z));
        moving = u < 1 && avatar.posture === 'stand';
        speed = 0.6;
        if (u >= 1) {
          glides.shift();
          if (glides[0]) glides[0].from.copy(pos);
          else { const d = onGlidesDone; onGlidesDone = null; d?.(); }
        }
      } else if (route.length && avatar.posture === 'stand') {
        const tgt = route[0];
        const dx = tgt.x - pos.x, dz = tgt.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.12) {
          route.shift();
          if (!route.length) { const a = onArrive; onArrive = null; a?.(); }
        } else {
          mx = dx / d; mz = dz / d; moving = true;
          speed = Math.min(1, d / 0.5 + 0.4);
        }
      }
      if (moving && (mx || mz)) {
        const step = 2.6 * speed * dt;
        const nx = pos.x + mx * step, nz = pos.z + mz * step;
        if (!collides(nx, pos.z) || route.length) pos.x = THREE.MathUtils.clamp(nx, site.bounds.minX, site.bounds.maxX);
        if (!collides(pos.x, nz) || route.length) pos.z = THREE.MathUtils.clamp(nz, site.bounds.minZ, site.bounds.maxZ);
        targetYaw = Math.atan2(mx, -mz);
      }
      // Turn smoothly toward the target heading.
      let dy = targetYaw - avatar.root.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      avatar.root.rotation.y += dy * Math.min(1, dt * 9);

      // Rosary: slide to the next bead every few seconds and count decades.
      if (avatar.hands === 'rosary') {
        rosaryTimer += dt;
        if (rosaryTimer > 3.2) {
          rosaryTimer = 0;
          rosaryCount += 1;
          avatar.nextBead();
          const decade = Math.min(5, Math.floor((rosaryCount - 1) / 10) + 1);
          const bead = ((rosaryCount - 1) % 10) + 1;
          say(rosaryCount > 50 ? '다섯 단을 모두 바쳤습니다. 영광송으로 마칩니다.' : `묵주기도 ${decade}단 · 성모송 ${bead}/10`);
          if (rosaryCount > 50) { avatar.setHands('rest'); sync(); }
        }
      }

      avatar.update(dt, moving, speed);

      // Holy water fonts.
      const nearF = site.fonts.some(f => Math.hypot(f.x - pos.x, f.z - pos.z) < 1.35);
      if (nearF !== lastNearFont) { lastNearFont = nearF; setNearFont(nearF); }

      // Indoor / outdoor light blend.
      indoor += (site.indoorAt(pos.x, pos.z) - indoor) * Math.min(1, dt * 2);
      (scene.fog as THREE.Fog).color.copy(outdoorFog).lerp(indoorFog, indoor);
      (scene.fog as THREE.Fog).near = THREE.MathUtils.lerp(60, 26, indoor);
      (scene.fog as THREE.Fog).far = THREE.MathUtils.lerp(260, 95, indoor);
      hemi.intensity = THREE.MathUtils.lerp(1.35, 0.6, indoor);
      sun.intensity = THREE.MathUtils.lerp(2.6, 1.6, indoor);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0.95, 1.12, indoor);
      site.update(time, dt, indoor);

      // Sparkles.
      if (sparkT >= 0) {
        sparkT += dt;
        for (let i = 0; i < sparkN; i += 1) {
          sparkPos[i * 3] += sparkVel[i * 3] * dt;
          sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
          sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
          sparkVel[i * 3 + 1] -= dt * 0.4;
        }
        sparkGeo.attributes.position.needsUpdate = true;
        sparkMat.opacity = Math.max(0, 1 - sparkT / 1.4);
        if (sparkT > 1.4) sparkT = -1;
      }

      // Camera: over the shoulder; inside the confessional it sits behind the penitent.
      const eye = 1.62 + (avatar.pelvis.position.y - 0.93) * 0.9;
      if (confessing && confession_ref.current !== 'off') {
        camPos.lerp(site.confessional.cameraEye, 1 - Math.exp(-dt * 3));
        camLook.lerp(site.confessional.cameraLook, 1 - Math.exp(-dt * 3));
      } else {
        const back = tmpV.set(pos.x - Math.sin(yaw) * dist * Math.cos(pitch * 0.5), eye + 0.18 + Math.max(0, pitch) * dist * 0.25, pos.z + Math.cos(yaw) * dist * Math.cos(pitch * 0.5));
        // Pull the camera in front of pillars and walls between it and the avatar.
        const hx = pos.x, hz = pos.z;
        const cdx = back.x - hx, cdz = back.z - hz;
        const clen = Math.hypot(cdx, cdz);
        for (let k = 1; k <= 24; k += 1) {
          const u = k / 24;
          const px = hx + cdx * u, pz = hz + cdz * u;
          if (site.blockers.some(bk => !bk.low && Math.abs(px - bk.x) < bk.rx + 0.12 && Math.abs(pz - bk.z) < bk.rz + 0.12)) {
            const keep = Math.max(0.35, clen * (k - 1) / 24 - 0.1) / Math.max(0.001, clen);
            back.x = hx + cdx * keep;
            back.z = hz + cdz * keep;
            break;
          }
        }
        // Keep the camera inside the church walls while indoors.
        if (indoor > 0.6) {
          back.x = THREE.MathUtils.clamp(back.x, -14.0, 14.0);
          back.z = THREE.MathUtils.clamp(back.z, -27, 19.2);
        }
        camPos.lerp(back, firstFrame ? 1 : 1 - Math.exp(-dt * 8));
        const look = tmpV.set(pos.x + Math.sin(yaw) * 10 * Math.cos(pitch), eye + Math.sin(pitch) * 10, pos.z - Math.cos(yaw) * 10 * Math.cos(pitch));
        camLook.lerp(look, firstFrame ? 1 : 1 - Math.exp(-dt * 10));
      }
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      sun.position.set(pos.x - 40, 45, pos.z + 70);
      sun.target.position.set(pos.x, 0, pos.z);

      renderer.render(scene, camera);
      if (firstFrame) { firstFrame = false; setLoading(false); }
    };
    const confession_ref = { current: 'off' as 'off' | 'writing' | 'released' };
    const watchConfession = (e: Event) => { confession_ref.current = (e as CustomEvent<'off' | 'writing' | 'released'>).detail; };
    window.addEventListener('religion:confession', watchConfession as EventListener);
    onResize();
    animate();

    return () => {
      cancelAnimationFrame(frame);
      apiRef.current = null;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('religion:joystick', onJoystick as EventListener);
      window.removeEventListener('religion:confession', watchConfession as EventListener);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('touchstart', onTouchStart);
      host.removeEventListener('touchmove', onTouchMove);
      host.removeEventListener('touchend', onTouchEnd);
      site.dispose();
      avatar.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      sparkTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [displayName]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('religion:confession', { detail: confession }));
  }, [confession]);

  const act = (a: Action) => apiRef.current?.act(a);
  const joystickTo = (x: number, y: number) => window.dispatchEvent(new CustomEvent('religion:joystick', { detail: { x, y } }));
  const moveJoystick = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rad = r.width * 0.33;
    let x = (e.clientX - (r.left + r.width / 2)) / rad;
    let y = (e.clientY - (r.top + r.height / 2)) / rad;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    setJoystick({ x: x * rad, y: y * rad });
    joystickTo(x, y);
  };
  const stopJoystick = () => { setJoystick({ x: 0, y: 0 }); joystickTo(0, 0); };
  const submitConfession = (e: FormEvent) => {
    e.preventDefault();
    if (!confessionText.trim()) return;
    setReleasedText(confessionText);
    setConfessionText('');
    apiRef.current?.finishConfession();
  };

  return (
    <div className="immersive-avatar-stage">
      <div ref={hostRef} className="immersive-avatar-canvas" aria-label="성당과 정원이 이어진 3D 공간. WASD 또는 방향키로 이동하고, 바닥을 클릭하면 그곳으로 걸어갑니다." />
      {loading ? <div className="world-loading" role="status">성당 문을 여는 중…</div> : null}

      {nearFont && fontStep !== 'done' && confession === 'off' ? (
        <div className="holy-water-actions" role="group" aria-label="성수대">
          <span aria-hidden="true">{fontStep === 'water' ? '✧' : '✝'}</span>
          {fontStep === 'water'
            ? <button type="button" className="holy-water-primary" onClick={() => { apiRef.current?.dip(); setFontStep('cross'); }}>성수 찍기</button>
            : <button type="button" className="holy-water-primary" onClick={() => { act('cross'); setFontStep('done'); }}>성호 긋기</button>}
          <button type="button" className="holy-water-skip" onClick={() => setFontStep('done')}>건너뛰기</button>
        </div>
      ) : null}

      {candlePicker ? (
        <div className="candle-picker" role="dialog" aria-label="초 봉헌 지향 선택">
          <p>어떤 마음으로 초를 밝힐까요?</p>
          <div>
            {INTENTIONS.map(i => <button type="button" key={i} onClick={() => apiRef.current?.lightCandle(i)}>{i}</button>)}
          </div>
          <button type="button" className="candle-picker-close" onClick={() => setCandlePicker(false)}>닫기</button>
        </div>
      ) : null}

      {confession !== 'off' ? (
        <div className={`confession-panel ${confession}`} role="dialog" aria-label="고해소">
          {confession === 'writing' ? (
            <form onSubmit={submitConfession}>
              <h2>마음을 내려놓는 자리</h2>
              <p>적은 글은 이 기기 화면에서 빛으로 바뀌어 사라지며, 어디에도 보내거나 저장하지 않습니다. 실제 고해성사는 사제와 함께 드립니다.</p>
              <textarea value={confessionText} onChange={e => setConfessionText(e.target.value)} maxLength={600} placeholder="주님, 제 마음을 봐 주세요…" autoFocus />
              <div className="confession-buttons">
                <button type="button" className="ghost" onClick={() => { setConfession('off'); apiRef.current?.leaveConfession(); }}>나가기</button>
                <button type="submit" disabled={!confessionText.trim()}>빛으로 내려놓기</button>
              </div>
            </form>
          ) : (
            <div className="confession-release">
              <p className="released-text" aria-hidden="true">{releasedText.split('').map((ch, i) => <span key={i} style={{ animationDelay: `${(i % 40) * 0.035}s` }}>{ch}</span>)}</p>
              <p className="confession-peace">“평화가 너희와 함께.”</p>
              <button type="button" onClick={() => apiRef.current?.leaveConfession()}>고해소에서 나오기</button>
            </div>
          )}
        </div>
      ) : null}

      <div className="world-action-notice" role="status">{notice}</div>
      <div className="world-action-bar" role="group" aria-label="동작" hidden={confession !== 'off'}>
        <button type="button" onClick={() => act('cross')}>✝ 성호 긋기</button>
        <button type="button" aria-pressed={state.praying} onClick={() => act('prayer')}>🙏 {state.praying ? '기도 마치기' : '기도하기'}</button>
        <button type="button" aria-pressed={state.rosary} onClick={() => act('rosary')}>📿 {state.rosary ? '묵주 내려놓기' : '묵주기도'}</button>
        <button type="button" aria-pressed={state.veil} onClick={() => act('veil')}>{state.veil ? '미사보 벗기' : '미사보 쓰기'}</button>
        <button type="button" onClick={() => act('bow')}>목례</button>
        <button type="button" onClick={() => act('greet')}>인사</button>
        <button type="button" aria-pressed={state.sitting} onClick={() => act('seat')}>🪑 {state.sitting ? '일어나기' : '앉기'}</button>
        <button type="button" onClick={() => act('candle')}>🕯 초 봉헌</button>
        <button type="button" onClick={() => act('confess')}>고해소</button>
        <button type="button" onClick={() => act('mary')}>🌹 성모님께</button>
      </div>
      <div className="mobile-joystick" role="application" aria-label="이동 조이스틱"
        onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); moveJoystick(e); }}
        onPointerMove={e => { if (e.buttons > 0 || e.pressure > 0) moveJoystick(e); }}
        onPointerUp={stopJoystick} onPointerCancel={stopJoystick} onLostPointerCapture={stopJoystick}>
        <span className="mobile-joystick-knob" style={{ transform: `translate(${joystick.x}px, ${joystick.y}px)` }} />
      </div>
      <div className="camera-touch-hint" aria-hidden="true">드래그로 둘러보기 · 휠/두 손가락으로 거리 조절</div>
      <div className="world-asset-credit">
        바닥 대리석 사진 <a href="https://commons.wikimedia.org/wiki/File:Milan_Cathedral,_floor.jpg" target="_blank" rel="noreferrer">Gerda Arendt · CC0</a> · 건축·조각·스테인드글라스는 코드로 만든 창작물입니다.
      </div>
    </div>
  );
}
