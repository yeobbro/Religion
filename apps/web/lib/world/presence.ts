import * as THREE from 'three';
import { Avatar, type Gesture, type HandsMode, type Outfit, type Posture } from './avatar';

/**
 * Shared presence: visitors on the same "server" (a named room) see each other walk, sit,
 * pray and light candles, like a small online RPG channel.
 *
 * There is no game server to run or pay for. Browsers find each other through public Nostr
 * relays and then talk directly over WebRTC data channels (Trystero). Only what is needed
 * to draw the other avatars is sent: name, outfit, position, posture and gestures. Nothing
 * written in the confessional or the rosary panel ever leaves the device.
 */

export const SERVERS = [1, 2, 3, 4] as const;
export const SERVER_CAPACITY = 30;
const APP_ID = 'krewx-religion-catholic-v1';
const RELAYS = ['wss://nos.lol', 'wss://relay.primal.net', 'wss://nostr.mom', 'wss://relay.nostr.net'];

export type Profile = { name: string; outfit: Outfit };
type Wire =
  | { t: 'hi'; name: string; outfit: Outfit }
  | { t: 's'; x: number; z: number; y: number; p: Posture; h: HandsMode; v: 0 | 1 }
  | { t: 'g'; g: Gesture }
  | { t: 'c'; slot: number }
  | { t: 'say'; text: string };

type Peer = {
  id: string;
  avatar: Avatar | null;
  profile: Profile | null;
  target: THREE.Vector3;
  yaw: number;
  posture: Posture;
  hands: HandsMode;
  veil: boolean;
  lastSeen: number;
  bubble: THREE.Sprite | null;
  bubbleT: number;
};

export type SelfState = { x: number; z: number; yaw: number; posture: Posture; hands: HandsMode; veil: boolean };

export type Presence = {
  server: number;
  /** Real people here, including you. */
  count: () => number;
  sendState: (s: SelfState) => void;
  sendGesture: (g: Gesture) => void;
  sendCandle: (slot: number) => void;
  sendSay: (text: string) => void;
  setProfile: (p: Profile) => void;
  update: (dt: number) => void;
  leave: () => void;
};

/** Short phrases visitors can say to each other (no free text, so nothing to moderate). */
export const PHRASES = ['평화를 빕니다', '아멘', '함께 기도해요', '감사합니다', '주님의 은총이 함께하시길'];

const bubbleTexture = (text: string) => {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = '600 30px "Noto Sans KR", system-ui, sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 44;
  c.width = w; c.height = 64;
  ctx.font = '600 30px "Noto Sans KR", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,250,238,0.94)';
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, 52, 24);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w / 2 - 8, 53); ctx.lineTo(w / 2, 62); ctx.lineTo(w / 2 + 8, 53); ctx.fill();
  ctx.fillStyle = '#3a2c1c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 29);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: w / 64 };
};

/** Speech bubble above an avatar; also used for your own avatar. */
export const showBubble = (root: THREE.Object3D, text: string, old: THREE.Sprite | null) => {
  if (old) { root.remove(old); (old.material as THREE.SpriteMaterial).map?.dispose(); old.material.dispose(); }
  const { t, aspect } = bubbleTexture(text);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(0.16 * aspect, 0.16, 1);
  s.position.set(0, 2.32, 0);
  s.renderOrder = 10;
  root.add(s);
  return s;
};

export async function joinServer(
  server: number,
  profile: Profile,
  scene: THREE.Scene,
  hooks: { onCount: (n: number) => void; onCandle: (slot: number) => void; onError?: (msg: string) => void },
): Promise<Presence> {
  const { joinRoom, getRelaySockets } = await import('trystero');
  if (process.env.NODE_ENV !== 'production') (window as unknown as { __socks?: () => unknown }).__socks = () => Object.fromEntries(Object.entries(getRelaySockets() as Record<string, WebSocket>).map(([k, v]) => [k, v.readyState]));
  // Large, well-run public relays only, so every visitor meets on the same few relays.
  const room = joinRoom({ appId: APP_ID, relayConfig: { urls: RELAYS, redundancy: RELAYS.length } }, `catholic-${server}`, {
    onJoinError: d => hooks.onError?.(String((d as { error?: string }).error ?? 'join error')),
  });
  const chan = room.makeAction<Wire>('w');
  const peers = new Map<string, Peer>();
  let me = profile;
  let last: SelfState | null = null;
  let lastSent = 0;
  let alive = true;

  const count = () => 1 + [...peers.values()].filter(p => p.profile).length;
  const emitCount = () => hooks.onCount(count());

  const peer = (id: string) => {
    let p = peers.get(id);
    if (!p) {
      p = { id, avatar: null, profile: null, target: new THREE.Vector3(0, 0, 14), yaw: 0, posture: 'stand', hands: 'rest', veil: false, lastSeen: performance.now(), bubble: null, bubbleT: 0 };
      peers.set(id, p);
    }
    return p;
  };
  const drop = (id: string) => {
    const p = peers.get(id);
    if (!p) return;
    if (p.avatar) { scene.remove(p.avatar.root); p.avatar.dispose(); }
    peers.delete(id);
    emitCount();
  };
  const build = (p: Peer) => {
    if (!p.profile) return;
    const pos = p.avatar?.root.position.clone() ?? p.target.clone();
    if (p.avatar) { scene.remove(p.avatar.root); p.avatar.dispose(); }
    const a = new Avatar({ name: p.profile.name, outfit: p.profile.outfit, lite: true, rosary: true });
    a.root.position.copy(pos);
    a.root.rotation.y = p.yaw;
    a.root.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = false; });
    a.setPosture(p.posture, 0.48);
    a.setHands(p.hands);
    a.veilOn = p.veil;
    for (let i = 0; i < 40; i += 1) a.update(1 / 30, false);
    scene.add(a.root);
    p.avatar = a;
  };

  const sendHi = (target?: string) => chan.send({ t: 'hi', name: me.name, outfit: me.outfit }, target ? { target } : undefined).catch(() => undefined);

  const dbg = (m: string) => { if (process.env.NODE_ENV !== 'production') ((window as unknown as { __pres?: string[] }).__pres ??= []).push(m); };
  room.onPeerJoin = id => {
    dbg('join ' + id);
    peer(id);
    void sendHi(id);
    if (last) void chan.send(stateMsg(last), { target: id }).catch(() => undefined);
  };
  room.onPeerLeave = id => drop(id);

  chan.onMessage = (m, { peerId }) => {
    if (!alive || !m || typeof m !== 'object') return;
    dbg('msg ' + m.t + ' ' + peerId);
    const p = peer(peerId);
    p.lastSeen = performance.now();
    if (m.t === 'hi') {
      const name = String(m.name ?? '').slice(0, 16) || '순례자';
      const changed = !p.profile || p.profile.name !== name || p.profile.outfit !== m.outfit;
      p.profile = { name, outfit: m.outfit };
      if (changed) { build(p); emitCount(); }
    } else if (m.t === 's') {
      const first = !p.avatar;
      p.target.set(Number(m.x) || 0, 0, Number(m.z) || 0);
      p.yaw = Number(m.y) || 0;
      p.posture = m.p; p.hands = m.h; p.veil = !!m.v;
      if (first && p.profile) build(p);
      if (first && p.avatar) p.avatar.root.position.copy(p.target);
      if (p.avatar) {
        if (p.avatar.posture !== p.posture) p.avatar.setPosture(p.posture, 0.48);
        if (p.avatar.hands !== p.hands) p.avatar.setHands(p.hands);
        if (!p.avatar.busy) p.avatar.veilOn = p.veil;
      }
    } else if (m.t === 'g') {
      if (p.avatar && m.g !== 'light') p.avatar.play(m.g);
    } else if (m.t === 'c') {
      if (Number.isInteger(m.slot)) hooks.onCandle(m.slot);
    } else if (m.t === 'say') {
      if (p.avatar && PHRASES.includes(m.text)) { p.bubble = showBubble(p.avatar.root, m.text, p.bubble); p.bubbleT = 4; }
    }
  };

  const stateMsg = (s: SelfState): Wire => ({ t: 's', x: +s.x.toFixed(2), z: +s.z.toFixed(2), y: +s.yaw.toFixed(2), p: s.posture, h: s.hands, v: s.veil ? 1 : 0 });

  emitCount();
  return {
    server,
    count,
    setProfile: p => { me = p; void sendHi(); },
    sendState: s => {
      const now = performance.now();
      const moved = !last || Math.abs(s.x - last.x) > 0.02 || Math.abs(s.z - last.z) > 0.02 || Math.abs(s.yaw - last.yaw) > 0.05
        || s.posture !== last.posture || s.hands !== last.hands || s.veil !== last.veil;
      if ((moved && now - lastSent > 110) || now - lastSent > 2000) {
        last = { ...s };
        lastSent = now;
        void chan.send(stateMsg(s)).catch(() => undefined);
      }
    },
    sendGesture: g => { void chan.send({ t: 'g', g }).catch(() => undefined); },
    sendCandle: slot => { void chan.send({ t: 'c', slot }).catch(() => undefined); },
    sendSay: text => { void chan.send({ t: 'say', text }).catch(() => undefined); },
    update: dt => {
      const now = performance.now();
      for (const p of peers.values()) {
        if (now - p.lastSeen > 20000) { drop(p.id); continue; }
        const a = p.avatar;
        if (!a) continue;
        const pos = a.root.position;
        const d = Math.hypot(p.target.x - pos.x, p.target.z - pos.z);
        if (d > 6) pos.copy(p.target); // teleport after a long gap
        const k = 1 - Math.exp(-dt * 7);
        pos.x += (p.target.x - pos.x) * k;
        pos.z += (p.target.z - pos.z) * k;
        let dy = p.yaw - a.root.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        a.root.rotation.y += dy * Math.min(1, dt * 9);
        const moving = d > 0.05 && p.posture === 'stand';
        a.update(dt, moving, Math.min(1, d * 3));
        if (p.bubble) {
          p.bubbleT -= dt;
          (p.bubble.material as THREE.SpriteMaterial).opacity = Math.min(1, p.bubbleT * 2);
          if (p.bubbleT <= 0) { a.root.remove(p.bubble); (p.bubble.material as THREE.SpriteMaterial).map?.dispose(); p.bubble.material.dispose(); p.bubble = null; }
        }
      }
    },
    leave: () => {
      alive = false;
      for (const id of [...peers.keys()]) drop(id);
      void room.leave();
    },
  };
}
