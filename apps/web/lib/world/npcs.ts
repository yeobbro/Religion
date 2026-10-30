import * as THREE from 'three';
import { Avatar, type HandsMode, type Outfit, type Posture } from './avatar';
import type { Site } from './cathedral';

/**
 * People who make the church feel lived in, placed the way a Sunday Mass is arranged:
 * the priest behind the altar facing the people, two altar servers beside him, the choir
 * in stalls on either side of the sanctuary, a few parishioners in the pews, and a sister
 * praying at the Lady altar. They are background figures (lite avatars) with gentle,
 * slow routines; none of them can be walked through.
 */

type Routine = { at: number; hands: HandsMode; gesture?: 'bow' | 'cross' }[];

type Npc = {
  avatar: Avatar;
  routine: Routine;
  period: number;
  offset: number;
  step: number;
  sway: number;
};

const SANCTUARY_Y = 0.45;
const Z_E = -22;
const ALTAR_Z = Z_E + 4.4;

const SKINS = ['#f2c9ab', '#e9bc98', '#f6d3b8', '#dcae8a', '#f0c3a0'];
const HAIRS = ['#2c1f17', '#3b2a1f', '#5a4030', '#1d1714', '#6b6159', '#4a3324'];

export type Npcs = {
  group: THREE.Group;
  update: (dt: number, time: number) => void;
  /** Visible choir members sing (book open, heads up) while a choral track plays. */
  setSinging: (on: boolean) => void;
  dispose: () => void;
};

export function createNpcs(site: Site): Npcs {
  const group = new THREE.Group();
  const npcs: Npc[] = [];
  const disposables: { dispose(): void }[] = [];
  let pick = 0;

  const place = (opts: {
    outfit: Outfit; x: number; z: number; y?: number; yaw: number; posture?: Posture; seat?: number;
    routine: Routine; period: number; name?: string;
  }) => {
    pick += 1;
    const avatar = new Avatar({
      name: opts.name ?? '',
      outfit: opts.outfit,
      lite: true,
      showName: false,
      skin: SKINS[pick % SKINS.length],
      hair: opts.outfit === 'priest' ? '#5d564f' : HAIRS[(pick * 7) % HAIRS.length],
    });
    avatar.root.position.set(opts.x, opts.y ?? 0, opts.z);
    avatar.root.rotation.y = opts.yaw;
    avatar.root.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = false; o.receiveShadow = false; } });
    if (opts.posture) avatar.setPosture(opts.posture, opts.seat ?? 0.48);
    avatar.setHands(opts.routine[0].hands);
    // Settle the pose before the first frame so nobody visibly stands up from a T-pose.
    for (let i = 0; i < 90; i += 1) avatar.update(1 / 30, false);
    group.add(avatar.root);
    npcs.push({ avatar, routine: opts.routine, period: opts.period, offset: Math.random() * opts.period, step: -1, sway: Math.random() * 6 });
    return avatar;
  };

  // Priest behind the altar, facing the people: hands raised in prayer (orans), then joined.
  place({
    outfit: 'priest', x: 0, z: ALTAR_Z - 0.95, y: SANCTUARY_Y, yaw: Math.PI, period: 26,
    routine: [{ at: 0, hands: 'orans' }, { at: 11, hands: 'prayer' }, { at: 18, hands: 'prayer', gesture: 'bow' }, { at: 21, hands: 'orans' }],
  });
  // Two altar servers standing either side of the altar, turned toward it.
  for (const s of [-1, 1]) {
    place({
      outfit: 'server', x: s * 2.25, z: ALTAR_Z - 0.4, y: SANCTUARY_Y, yaw: s < 0 ? -Math.PI / 2 + 0.5 : Math.PI / 2 - 0.5, period: 26,
      routine: [{ at: 0, hands: 'prayer' }, { at: 18, hands: 'prayer', gesture: 'bow' }],
    });
  }

  // Choir stalls on both sides of the sanctuary, facing across (collegiate seating).
  const stallWood = new THREE.MeshStandardMaterial({ color: '#4b2f1e', roughness: 0.6 });
  const stallTop = new THREE.MeshStandardMaterial({ color: '#2f1d12', roughness: 0.5 });
  disposables.push(stallWood, stallTop);
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
    const g = new THREE.BoxGeometry(w, h, d);
    disposables.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  for (const s of [-1, 1]) {
    const x = s * 6.15;
    box(0.6, 1.5, 3.6, s * 6.85, SANCTUARY_Y + 0.75, -19.7, stallWood);      // panelled back
    box(0.7, 0.08, 3.7, s * 6.85, SANCTUARY_Y + 1.52, -19.7, stallTop);
    box(0.25, 0.95, 3.6, s * 5.55, SANCTUARY_Y + 0.475, -19.7, stallWood);    // book desk
    box(0.42, 0.05, 3.7, s * 5.6, SANCTUARY_Y + 0.98, -19.7, stallTop);
    const names = ['a', 'b', 'c'];
    names.forEach((_, i) => {
      place({
        outfit: 'choir', x, z: -20.9 + i * 1.2, y: SANCTUARY_Y, yaw: s < 0 ? -Math.PI / 2 : Math.PI / 2, period: 30,
        routine: [{ at: 0, hands: 'book' }, { at: 22, hands: 'prayer' }],
      });
    });
  }

  // Parishioners scattered through the pews, some praying, one with a rosary.
  const wanted: { row: number; side: -1 | 1; off: number; outfit: Outfit; hands: HandsMode; posture: Posture }[] = [
    { row: 1, side: -1, off: 1, outfit: 'casual', hands: 'prayer', posture: 'sit' },
    { row: 2, side: 1, off: 3, outfit: 'dress', hands: 'rosary', posture: 'sit' },
    { row: 4, side: -1, off: 3, outfit: 'casual', hands: 'rest', posture: 'sit' },
    { row: 5, side: 1, off: 1, outfit: 'monk', hands: 'prayer', posture: 'sit' },
    { row: 7, side: -1, off: 2, outfit: 'dress', hands: 'prayer', posture: 'sit' },
    { row: 8, side: 1, off: 2, outfit: 'casual', hands: 'rest', posture: 'sit' },
  ];
  const taken = new Set<number>();
  for (const w of wanted) {
    // Seats are listed row by row, left pew then right pew, five places each.
    const idx = w.row * 10 + (w.side < 0 ? 0 : 5) + w.off;
    const seat = site.seats[idx];
    if (!seat) continue;
    taken.add(idx);
    place({
      outfit: w.outfit, x: seat.x, z: seat.z, yaw: 0, posture: w.posture, seat: 0.48, period: 40,
      routine: w.hands === 'rest' ? [{ at: 0, hands: 'rest' }, { at: 25, hands: 'prayer' }] : [{ at: 0, hands: w.hands }],
    });
  }
  // Remove occupied places so the visitor is never sent to sit on someone.
  const free = site.seats.filter((_, i) => !taken.has(i));
  site.seats.splice(0, site.seats.length, ...free);

  // A sister kneeling in prayer beside the Lady altar.
  const mary = site.maryInside;
  const nunX = mary.x - 1.15;
  place({ outfit: 'nun', x: nunX, z: mary.z + 0.15, yaw: mary.yaw, posture: 'kneel', period: 50, routine: [{ at: 0, hands: 'prayer' }] });
  site.blockers.push({ x: nunX, z: mary.z + 0.15, rx: 0.3, rz: 0.4, low: true });

  let singing = true;
  return {
    group,
    setSinging: on => { singing = on; },
    update: (dt, time) => {
      for (const n of npcs) {
        const t = (time + n.offset) % n.period;
        let step = 0;
        for (let i = 0; i < n.routine.length; i += 1) if (t >= n.routine[i].at) step = i;
        if (step !== n.step) {
          n.step = step;
          const r = n.routine[step];
          const choir = n.avatar.outfit === 'choir';
          n.avatar.setHands(choir && singing && r.hands === 'prayer' ? 'book' : r.hands);
          if (r.gesture && !n.avatar.busy) n.avatar.play(r.gesture);
          if (n.avatar.hands === 'rosary') n.avatar.nextBead();
        }
        if (n.avatar.hands === 'rosary' && Math.floor(time / 3.5 + n.sway) !== Math.floor((time - dt) / 3.5 + n.sway)) n.avatar.nextBead();
        // Small breathing sway so still figures never look frozen.
        n.avatar.root.rotation.z = Math.sin(time * 0.7 + n.sway) * 0.006;
        n.avatar.update(dt, false);
      }
    },
    dispose: () => {
      npcs.forEach(n => n.avatar.dispose());
      disposables.forEach(d => d.dispose());
    },
  };
}
