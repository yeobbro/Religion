import * as THREE from 'three';
import { Avatar, type HandsMode, type Outfit, type Posture } from './avatar';
import type { Site } from './cathedral';
import { ADULT, CHILD } from './looks';
import { showBubble } from './presence';

/**
 * The parish, in one chibi style: Lily the guide at the door; the priest behind the altar with
 * two servers; the choir in their stalls; parishioners of every age in the pews; a sister at
 * Our Lady's altar; a volunteer walking the church; children playing round the fountain and two
 * elders chatting on the plaza.
 *
 * Mass is celebrated on the hour (minutes 0–14 by the visitor's clock): the volunteer takes a
 * pew, the priest leads, the choir sings; outside Mass everyone goes back to their routines.
 */

type Routine = { at: number; hands: HandsMode; gesture?: 'bow' | 'cross' | 'greet' }[];

type Npc = { avatar: Avatar; routine: Routine; period: number; offset: number; step: number; sway: number };

type Walker = {
  avatar: Avatar;
  loop: THREE.Vector3[];
  i: number;
  speed: number;
  wait: number;
  /** Mass: walk to the pew, sit, then come back. */
  seat?: { x: number; z: number; aisle: THREE.Vector3 };
  mode: 'loop' | 'toSeat' | 'seated' | 'fromSeat';
  route: THREE.Vector3[];
  follow?: Walker;
};

const SANCTUARY_Y = 0.45;
const Z_E = -22;
const ALTAR_Z = Z_E + 4.4;
const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);

const SKINS = ['#f6d6bf', '#f2c9ab', '#f8dcc8', '#e9c0a0', '#f3cdb2'];
const HAIRS = ['#2c1f17', '#3b2a1f', '#5a3a26', '#1d1714', '#4a3324'];

export const isMassTime = (d = new Date()) => d.getMinutes() < 15;

export type Npcs = {
  group: THREE.Group;
  update: (dt: number, time: number, visitor?: THREE.Vector3) => void;
  setSinging: (on: boolean) => void;
  dispose: () => void;
};

export function createNpcs(site: Site): Npcs {
  let predellaMat: THREE.Material | null = null;
  const stallWoodP = () => (predellaMat ??= new THREE.MeshStandardMaterial({ color: '#4b2f1e', roughness: 0.6 }));
  const group = new THREE.Group();
  const npcs: Npc[] = [];
  const walkers: Walker[] = [];
  const all: Avatar[] = [];
  const disposables: { dispose(): void }[] = [];
  let pick = 0;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
    const g = new THREE.BoxGeometry(w, h, d);
    disposables.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const make = (o: { outfit: Outfit; age?: 'child' | 'adult' | 'elder'; lite?: boolean; hair?: string; longHair?: boolean; glasses?: boolean; halo?: boolean; iris?: string; name?: string; showName?: boolean }) => {
    pick += 1;
    const age = o.age ?? 'adult';
    const avatar = new Avatar({
      name: o.name ?? '',
      showName: o.showName ?? false,
      outfit: o.outfit,
      lite: o.lite ?? true,
      chibi: true,
      scale: age === 'child' ? CHILD : ADULT,
      skin: SKINS[pick % SKINS.length],
      hair: o.hair ?? (age === 'elder' ? (pick % 2 ? '#c9c6c0' : '#a9a49c') : o.outfit === 'priest' ? '#3a2a20' : HAIRS[(pick * 7) % HAIRS.length]),
      longHair: o.longHair,
      glasses: o.glasses ?? age === 'elder',
      halo: o.halo,
      iris: o.iris,
    });
    avatar.root.traverse(m => { if (m instanceof THREE.Mesh) { m.castShadow = false; m.receiveShadow = false; } });
    group.add(avatar.root);
    all.push(avatar);
    return avatar;
  };

  const place = (o: Parameters<typeof make>[0] & { x: number; z: number; y?: number; yaw: number; posture?: Posture; seat?: number; routine: Routine; period: number }) => {
    const avatar = make(o);
    avatar.root.position.set(o.x, o.y ?? 0, o.z);
    avatar.root.rotation.y = o.yaw;
    if (o.posture) avatar.setPosture(o.posture, o.seat ?? 0.48);
    avatar.setHands(o.routine[0].hands);
    // Settle the pose before the first frame so nobody visibly stands up from a T-pose.
    for (let i = 0; i < 90; i += 1) avatar.update(1 / 30, false);
    npcs.push({ avatar, routine: o.routine, period: o.period, offset: Math.random() * o.period, step: -1, sway: Math.random() * 6 });
    return avatar;
  };

  // Priest behind the altar, facing the people: hands raised (orans), joined, a blessing.
  place({
    outfit: 'priest', x: 0, z: ALTAR_Z - 0.95, y: SANCTUARY_Y + 0.3, yaw: Math.PI, period: 26, lite: false,
    routine: [{ at: 0, hands: 'orans' }, { at: 11, hands: 'prayer' }, { at: 16, hands: 'rest', gesture: 'cross' }, { at: 21, hands: 'orans' }],
  });
  // A low predella so the (chibi-sized) priest stands clear of the altar.
  box(1.6, 0.3, 0.9, 0, SANCTUARY_Y + 0.15, ALTAR_Z - 0.95, stallWoodP());
  // Two altar servers either side of the altar, turned toward it.
  for (const s of [-1, 1]) {
    place({
      outfit: 'server', age: 'child', x: s * 2.25, z: ALTAR_Z - 0.4, y: SANCTUARY_Y, yaw: s < 0 ? -Math.PI / 2 + 0.5 : Math.PI / 2 - 0.5, period: 26,
      routine: [{ at: 0, hands: 'prayer' }, { at: 18, hands: 'prayer', gesture: 'bow' }],
    });
  }

  // Choir stalls on both sides of the sanctuary, facing across.
  const stallWood = new THREE.MeshStandardMaterial({ color: '#4b2f1e', roughness: 0.6 });
  const stallTop = new THREE.MeshStandardMaterial({ color: '#2f1d12', roughness: 0.5 });
  disposables.push(stallWood, stallTop);

  for (const s of [-1, 1]) {
    const x = s * 6.15;
    box(0.6, 1.5, 3.6, s * 6.85, SANCTUARY_Y + 0.75, -19.7, stallWood);
    box(0.7, 0.08, 3.7, s * 6.85, SANCTUARY_Y + 1.52, -19.7, stallTop);
    // Book desk lowered to the choir's height.
    box(0.25, 0.75, 3.6, s * 5.55, SANCTUARY_Y + 0.375, -19.7, stallWood);
    box(0.42, 0.05, 3.7, s * 5.6, SANCTUARY_Y + 0.78, -19.7, stallTop);
    for (let i = 0; i < 3; i += 1) {
      place({
        outfit: 'choir', longHair: (i + (s > 0 ? 1 : 0)) % 2 === 0, x, z: -20.9 + i * 1.2, y: SANCTUARY_Y, yaw: s < 0 ? -Math.PI / 2 : Math.PI / 2, period: 30,
        routine: [{ at: 0, hands: 'book' }, { at: 22, hands: 'prayer' }],
      });
    }
  }

  // Parishioners of every age in the pews.
  const wanted: { row: number; side: -1 | 1; off: number; outfit: Outfit; age?: 'child' | 'adult' | 'elder'; longHair?: boolean; hands: HandsMode }[] = [
    { row: 1, side: -1, off: 1, outfit: 'suit', hands: 'prayer' },
    { row: 1, side: -1, off: 2, outfit: 'skirt', hands: 'prayer' },
    { row: 1, side: -1, off: 3, outfit: 'kid', age: 'child', hands: 'prayer' },
    { row: 2, side: 1, off: 3, outfit: 'elder', age: 'elder', longHair: true, hands: 'rosary' },
    { row: 4, side: -1, off: 3, outfit: 'casual', hands: 'rest' },
    { row: 5, side: 1, off: 1, outfit: 'elder', age: 'elder', hands: 'prayer' },
    { row: 5, side: 1, off: 2, outfit: 'dress', longHair: true, hands: 'prayer' },
    { row: 7, side: -1, off: 2, outfit: 'skirt', longHair: true, hands: 'book' },
    { row: 8, side: 1, off: 2, outfit: 'kid', age: 'child', longHair: true, hands: 'rest' },
  ];
  const taken = new Set<number>();
  for (const w of wanted) {
    const idx = w.row * 10 + (w.side < 0 ? 0 : 5) + w.off;
    const seat = site.seats[idx];
    if (!seat) continue;
    taken.add(idx);
    place({
      outfit: w.outfit, age: w.age, longHair: w.longHair, x: seat.x, z: seat.z, yaw: 0, posture: 'sit', seat: 0.47, period: 40,
      routine: w.hands === 'rest' ? [{ at: 0, hands: 'rest' }, { at: 25, hands: 'prayer' }] : [{ at: 0, hands: w.hands }],
    });
  }
  // The volunteer's pew for Mass.
  const volIdx = 3 * 10 + 5 + 4;
  const volSeat = site.seats[volIdx];
  taken.add(volIdx);
  const free = site.seats.filter((_, i) => !taken.has(i));
  site.seats.splice(0, site.seats.length, ...free);

  // A sister kneeling in prayer beside the Lady altar.
  const mary = site.maryInside;
  const nunX = mary.x - 1.15;
  place({ outfit: 'nun', x: nunX, z: mary.z + 0.15, yaw: mary.yaw, posture: 'kneel', period: 50, routine: [{ at: 0, hands: 'prayer' }] });
  site.blockers.push({ x: nunX, z: mary.z + 0.15, rx: 0.3, rz: 0.4, low: true });

  // Lily, the parish guide, waits just inside the west doors.
  const lily = place({
    outfit: 'lily', longHair: true, halo: true, iris: '#3f6fc0', lite: false, name: '릴리', showName: true,
    x: -2.7, z: 13.4, yaw: Math.PI, period: 20, routine: [{ at: 0, hands: 'rest' }, { at: 14, hands: 'prayer' }],
  });
  site.blockers.push({ x: -2.7, z: 13.4, rx: 0.3, rz: 0.3, low: true });
  let lilyBubble: THREE.Sprite | null = null, lilyBubbleT = 0, lilyCool = 0, lilyLine = 0, lilyNear = false;
  const LILY_LINES = [
    '어서 오세요! 평화를 빌어요 ♡',
    '성수를 찍고 성호를 그어 보세요',
    '정시마다 15분 동안 미사가 있어요',
    '스페이스바를 누르면 빈자리에 앉아요',
    '성모님께 초를 봉헌해 보세요',
    '고해소에서 마음을 내려놓을 수 있어요',
  ];
  const say = (a: Avatar, text: string, old: THREE.Sprite | null) => showBubble(a.root, text, old);

  // Walkers.
  const walker = (avatar: Avatar, loop: THREE.Vector3[], speed: number, start = 0): Walker => {
    avatar.root.position.copy(loop[start]);
    const w: Walker = { avatar, loop, i: (start + 1) % loop.length, speed, wait: 0, mode: 'loop', route: [] };
    walkers.push(w);
    return w;
  };
  // Volunteer: down the central aisle, across the front, up the south aisle, back by the doors.
  const vol = walker(make({ outfit: 'volunteer' }), [V(0, 14), V(0, -12.7), V(10.4, -12.7), V(10.4, 10.5), V(0.4, 14.2)], 1.0);
  if (volSeat) vol.seat = { x: volSeat.x, z: volSeat.z, aisle: V(volSeat.aisleX, volSeat.z - 0.72) };
  // Two children walking round the fountain, the younger following.
  const ring = Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2; return V(Math.sin(a) * 3.7, 49.5 + Math.cos(a) * 3.7); });
  const kidA = walker(make({ outfit: 'kid', age: 'child' }), ring, 1.15, 0);
  const kidB = walker(make({ outfit: 'kid', age: 'child', longHair: true }), ring, 1.15, 8);
  kidB.follow = kidA;
  // Two elders chatting on the plaza.
  const chat = [
    place({ outfit: 'elder', age: 'elder', x: -5.6, z: 27.2, yaw: -Math.PI / 2, period: 14, routine: [{ at: 0, hands: 'rest' }, { at: 6, hands: 'rest', gesture: 'greet' }] }),
    place({ outfit: 'elder', age: 'elder', longHair: true, x: -4.6, z: 27.2, yaw: Math.PI / 2, period: 14, routine: [{ at: 0, hands: 'rest' }, { at: 10, hands: 'rest', gesture: 'bow' }] }),
  ];
  site.blockers.push({ x: -5.1, z: 27.2, rx: 0.9, rz: 0.4, low: true });
  const CHAT = ['오늘 강론 참 좋았지요?', '네, 마음이 따뜻해졌어요', '손주 첫영성체가 다음 주예요', '축하드려요! 함께 기도할게요'];
  let chatBubble: (THREE.Sprite | null)[] = [null, null], chatT = 0, chatLine = 0;

  const stepWalker = (w: Walker, dt: number, mass: boolean) => {
    const a = w.avatar;
    const pos = a.root.position;
    // Mass: the volunteer heads for a pew.
    if (w.seat) {
      if (mass && w.mode === 'loop') {
        w.mode = 'toSeat';
        w.route = [V(0, Math.min(14, Math.max(-12.7, pos.z))), w.seat.aisle.clone(), V(w.seat.x, w.seat.aisle.z), V(w.seat.x, w.seat.z)];
      } else if (!mass && w.mode === 'seated') {
        w.mode = 'fromSeat';
        a.setPosture('stand');
        a.setHands('rest');
        w.route = [V(w.seat.x, w.seat.aisle.z), w.seat.aisle.clone(), V(0, w.seat.aisle.z)];
        w.i = 1;
      }
    }
    if (w.mode === 'seated') { a.update(dt, false); return; }
    if (w.wait > 0) { w.wait -= dt; a.update(dt, false); return; }
    let target: THREE.Vector3;
    if (w.mode === 'toSeat' || w.mode === 'fromSeat') {
      if (!w.route.length) {
        if (w.mode === 'toSeat') { w.mode = 'seated'; a.root.rotation.y = 0; a.setPosture('sit', 0.47); a.setHands('prayer'); }
        else w.mode = 'loop';
        a.update(dt, false);
        return;
      }
      target = w.route[0];
    } else if (w.follow) {
      // Stay a step behind the leader.
      const lead = w.follow.avatar.root.position;
      target = lead.clone().add(pos.clone().sub(lead).setLength(0.9));
    } else target = w.loop[w.i];
    const dx = target.x - pos.x, dz = target.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.08) {
      if (w.mode === 'toSeat' || w.mode === 'fromSeat') w.route.shift();
      else if (!w.follow) { w.i = (w.i + 1) % w.loop.length; if (w.i === 0) w.wait = 3; }
      a.update(dt, false);
      return;
    }
    const step = Math.min(d, w.speed * dt * (w.mode === 'loop' ? 1 : 0.8));
    pos.x += (dx / d) * step;
    pos.z += (dz / d) * step;
    let dy = Math.atan2(-dx, -dz) - a.root.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    a.root.rotation.y += dy * Math.min(1, dt * 8);
    a.update(dt, true, 0.75);
  };

  let singing = true;
  return {
    group,
    setSinging: on => { singing = on; },
    update: (dt, time, visitor) => {
      const mass = isMassTime();
      for (const n of npcs) {
        const t = (time + n.offset) % n.period;
        let step = 0;
        for (let i = 0; i < n.routine.length; i += 1) if (t >= n.routine[i].at) step = i;
        if (step !== n.step) {
          n.step = step;
          const r = n.routine[step];
          const choir = n.avatar.outfit === 'choir';
          n.avatar.setHands(choir && (singing || mass) && r.hands === 'prayer' ? 'book' : r.hands);
          if (r.gesture && !n.avatar.busy) n.avatar.play(r.gesture);
        }
        if (n.avatar.hands === 'rosary' && Math.floor(time / 3.5 + n.sway) !== Math.floor((time - dt) / 3.5 + n.sway)) n.avatar.nextBead();
        n.avatar.root.rotation.z = Math.sin(time * 0.7 + n.sway) * 0.006;
        n.avatar.update(dt, false);
      }
      for (const w of walkers) stepWalker(w, dt, mass);

      // Lily turns to greet a visitor who comes near, and offers a tip.
      if (visitor) {
        const d = Math.hypot(visitor.x - lily.root.position.x, visitor.z - lily.root.position.z);
        lilyCool -= dt;
        if (d < 3.6) {
          let dy = Math.atan2(-(visitor.x - lily.root.position.x), -(visitor.z - lily.root.position.z)) - lily.root.rotation.y;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          lily.root.rotation.y += dy * Math.min(1, dt * 4);
          if (!lilyNear || lilyCool <= 0) {
            const line = mass ? '지금은 미사 시간이에요. 함께 앉아요 ♡' : LILY_LINES[lilyLine++ % LILY_LINES.length];
            lilyBubble = say(lily, line, lilyBubble);
            lilyBubbleT = 4.5;
            lilyCool = 9;
            if (!lily.busy && !lilyNear) lily.play('greet');
          }
          lilyNear = true;
        } else {
          lilyNear = false;
          let dy = Math.PI - lily.root.rotation.y;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          lily.root.rotation.y += dy * Math.min(1, dt * 2);
        }
      }
      if (lilyBubble) {
        lilyBubbleT -= dt;
        (lilyBubble.material as THREE.SpriteMaterial).opacity = Math.min(1, lilyBubbleT * 2);
        if (lilyBubbleT <= 0) { lily.root.remove(lilyBubble); (lilyBubble.material as THREE.SpriteMaterial).map?.dispose(); lilyBubble.material.dispose(); lilyBubble = null; }
      }
      // The elders take turns speaking.
      chatT -= dt;
      if (chatT <= 0) {
        const who = chatLine % 2;
        chatBubble.forEach((b, i) => { if (b) { chat[i].root.remove(b); (b.material as THREE.SpriteMaterial).map?.dispose(); b.material.dispose(); chatBubble[i] = null; } });
        chatBubble[who] = say(chat[who], CHAT[chatLine % CHAT.length], null);
        chatLine += 1;
        chatT = 4;
      }
    },
    dispose: () => {
      all.forEach(a => a.dispose());
      predellaMat?.dispose();
      disposables.forEach(d => d.dispose());
    },
  };
}
