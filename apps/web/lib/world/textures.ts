import * as THREE from 'three';

/** Deterministic pseudo-random generator so procedural art is identical on every visit. */
export const seeded = (seed: number) => {
  let n = seed >>> 0;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
};

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { c, ctx };
};

const toTexture = (c: HTMLCanvasElement, repeatX = 1, repeatY = 1, color = true) => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

/** Speckled surface noise for plaster, stone and fabric. */
export const noiseTexture = (base: string, seed: number, repeatX = 1, repeatY = 1, strength = 1) => {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const r = seeded(seed);
  for (let i = 0; i < 5200; i += 1) {
    const a = (0.02 + r() * 0.08) * strength;
    ctx.fillStyle = r() > 0.5 ? `rgba(255,246,228,${a})` : `rgba(18,16,14,${a})`;
    const s = 1 + r() * 3;
    ctx.fillRect(r() * 256, r() * 256, s, s);
  }
  return toTexture(c, repeatX, repeatY);
};

/** Fine knit ribbing for the visitor's sweater. */
export const knitTexture = (base: string) => {
  const { c, ctx } = canvas(128, 128);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 8) {
    for (let y = 0; y < 128; y += 6) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 3, 1.6, 2.8, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 6, y + 3, 1.6, 2.8, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(x + 3.6, y, 0.8, 6);
    }
  }
  return toTexture(c, 4, 6);
};

/** Deep blue vault sown with gilded stars, after Sainte-Chapelle. */
export const starVaultTexture = () => {
  const { c, ctx } = canvas(512, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#16224a');
  g.addColorStop(1, '#1c2b5c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const r = seeded(77);
  for (let i = 0; i < 2200; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.04})`;
    ctx.fillRect(r() * 512, r() * 512, 2, 2);
  }
  const star = (x: number, y: number, s: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#e7c46c';
    ctx.beginPath();
    for (let k = 0; k < 16; k += 1) {
      const rad = k % 2 === 0 ? s : s * 0.38;
      const a = (Math.PI * k) / 8;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 64) star(x + ((y / 64) % 2) * 32 + 16, y + 16, 9);
  }
  return toTexture(c, 6, 10);
};

type GlassStyle = 'medallion' | 'figure' | 'grisaille';

/**
 * Lancet stained-glass panel: lead came grid, jewel-toned quarries and a central medallion or
 * a standing figure silhouette. Rendered once per style/seed and used as an emissive map.
 */
export const stainedGlassTexture = (seed: number, style: GlassStyle = 'medallion') => {
  const W = 256, H = 640;
  const { c, ctx } = canvas(W, H);
  const r = seeded(seed);
  const palettes = [
    ['#1d3f9c', '#a3192c', '#d5a425', '#2f7a4c', '#5b2d86', '#e8dcb5'],
    ['#22489e', '#c03a2b', '#e0b13a', '#1e6a6a', '#7a2d6c', '#f1e6c8'],
    ['#163a8a', '#8e1b2d', '#cf9d31', '#3a7d55', '#4a2a7c', '#e4d7b0'],
  ];
  const pal = palettes[seed % palettes.length];
  ctx.fillStyle = '#0d0d12';
  ctx.fillRect(0, 0, W, H);
  // Quarries in a diamond lattice.
  const q = 32;
  for (let y = -q; y < H + q; y += q) {
    for (let x = -q; x < W + q; x += q) {
      const off = ((y / q) % 2) * (q / 2);
      const col = style === 'grisaille' ? (r() > 0.5 ? '#c9c4ad' : '#b3ad95') : pal[Math.floor(r() * 2)];
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.75 + r() * 0.25;
      ctx.beginPath();
      ctx.moveTo(x + off, y);
      ctx.lineTo(x + off + q / 2, y + q / 2);
      ctx.lineTo(x + off, y + q);
      ctx.lineTo(x + off - q / 2, y + q / 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Border band.
  ctx.lineWidth = 16;
  ctx.strokeStyle = pal[2];
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.lineWidth = 6;
  ctx.strokeStyle = pal[1];
  ctx.strokeRect(22, 22, W - 44, H - 44);
  const medallion = (cy: number, rad: number) => {
    ctx.fillStyle = pal[1];
    ctx.beginPath();
    ctx.arc(W / 2, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal[0];
    ctx.beginPath();
    ctx.arc(W / 2, cy, rad * 0.8, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 8; k += 1) {
      ctx.fillStyle = k % 2 ? pal[3] : pal[4];
      ctx.beginPath();
      ctx.moveTo(W / 2, cy);
      ctx.arc(W / 2, cy, rad * 0.62, (k * Math.PI) / 4, ((k + 1) * Math.PI) / 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = pal[5];
    ctx.beginPath();
    ctx.arc(W / 2, cy, rad * 0.22, 0, Math.PI * 2);
    ctx.fill();
  };
  if (style === 'figure') {
    // Haloed standing saint: halo, head, mantle and robe.
    ctx.fillStyle = pal[2];
    ctx.beginPath();
    ctx.arc(W / 2, 170, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e9cdb0';
    ctx.beginPath();
    ctx.ellipse(W / 2, 176, 24, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal[1];
    ctx.beginPath();
    ctx.moveTo(W / 2 - 30, 206);
    ctx.quadraticCurveTo(W / 2 - 78, 380, W / 2 - 64, 560);
    ctx.lineTo(W / 2 + 64, 560);
    ctx.quadraticCurveTo(W / 2 + 78, 380, W / 2 + 30, 206);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal[0];
    ctx.beginPath();
    ctx.moveTo(W / 2 - 22, 214);
    ctx.lineTo(W / 2 - 44, 560);
    ctx.lineTo(W / 2 + 6, 560);
    ctx.lineTo(W / 2 + 6, 214);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal[5];
    ctx.fillRect(W / 2 - 8, 300, 16, 90);
  } else if (style === 'medallion') {
    medallion(170, 70);
    medallion(390, 60);
    medallion(560, 44);
  }
  // Lead lines.
  ctx.strokeStyle = 'rgba(8,8,10,0.92)';
  ctx.lineWidth = 3;
  for (let y = 0; y < H; y += q / 2) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y + q);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += q / 2) {
    ctx.beginPath();
    ctx.moveTo(W, y);
    ctx.lineTo(0, y + q);
    ctx.stroke();
  }
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#08080a';
  for (const y of [120, 260, 470]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  return toTexture(c, 1, 1);
};

/** Rose window: twelve petals and rings of colored glass. */
export const roseWindowTexture = () => {
  const S = 512;
  const { c, ctx } = canvas(S, S);
  const pal = ['#1d3f9c', '#a3192c', '#d5a425', '#2f7a4c', '#5b2d86', '#efe3c0'];
  ctx.fillStyle = '#0b0b10';
  ctx.fillRect(0, 0, S, S);
  const cx = S / 2;
  for (let ring = 5; ring >= 0; ring -= 1) {
    const rad = 40 + ring * 40;
    for (let k = 0; k < 24; k += 1) {
      ctx.fillStyle = pal[(k + ring) % 5];
      ctx.beginPath();
      ctx.moveTo(cx, cx);
      ctx.arc(cx, cx, rad, (k * Math.PI) / 12, ((k + 1) * Math.PI) / 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#08080a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cx, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let k = 0; k < 12; k += 1) {
    const a = (k * Math.PI) / 6;
    ctx.strokeStyle = '#08080a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.lineTo(cx + Math.cos(a) * 250, cx + Math.sin(a) * 250);
    ctx.stroke();
    ctx.fillStyle = pal[5];
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 175, cx + Math.sin(a) * 175, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = pal[2];
  ctx.beginPath();
  ctx.arc(cx, cx, 30, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c);
};

/** Long red aisle runner with a gold border. */
export const carpetTexture = () => {
  const { c, ctx } = canvas(128, 512);
  ctx.fillStyle = '#7a1420';
  ctx.fillRect(0, 0, 128, 512);
  const r = seeded(5);
  for (let i = 0; i < 3000; i += 1) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,190,170,0.05)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(r() * 128, r() * 512, 1.5, 1.5);
  }
  ctx.fillStyle = '#c9a24a';
  ctx.fillRect(6, 0, 6, 512);
  ctx.fillRect(116, 0, 6, 512);
  ctx.fillStyle = '#5d0f19';
  ctx.fillRect(14, 0, 3, 512);
  ctx.fillRect(111, 0, 3, 512);
  return toTexture(c, 1, 12);
};

/** Lace mantilla: scalloped edge and floral openwork, used as color + alpha map. */
export const laceTexture = () => {
  const { c, ctx } = canvas(512, 256);
  ctx.clearRect(0, 0, 512, 256);
  ctx.fillStyle = '#ffffff';
  // Net ground.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  for (let x = -256; x < 512; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 256, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 256, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  // Floral motifs.
  const r = seeded(31);
  for (let i = 0; i < 46; i += 1) {
    const x = r() * 512, y = 30 + r() * 170, s = 7 + r() * 9;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let p = 0; p < 6; p += 1) {
      const a = (p * Math.PI) / 3;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.55, s * 0.32, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  // Scalloped border along the bottom (the hem of the veil).
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.fillRect(0, 214, 512, 10);
  for (let x = 0; x < 512; x += 24) {
    ctx.beginPath();
    ctx.arc(x + 12, 226, 12, 0, Math.PI);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Soft radial glow for flames, halos and light pools (use with additive blending). */
export const glowTexture = (inner = 'rgba(255,236,190,1)', mid = 'rgba(255,170,70,0.45)') => {
  const { c, ctx } = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.28, mid);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Teardrop candle flame: white core, golden body, transparent edges. */
export const flameTexture = () => {
  const { c, ctx } = canvas(64, 128);
  const g = ctx.createRadialGradient(32, 92, 2, 32, 80, 40);
  g.addColorStop(0, 'rgba(255,255,245,1)');
  g.addColorStop(0.3, 'rgba(255,214,120,0.95)');
  g.addColorStop(0.65, 'rgba(255,140,40,0.45)');
  g.addColorStop(1, 'rgba(255,90,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.bezierCurveTo(52, 50, 58, 92, 32, 124);
  ctx.bezierCurveTo(6, 92, 12, 50, 32, 4);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Vertical shaft of light: bright at the window, fading toward the floor and the edges. */
export const beamTexture = () => {
  const { c, ctx } = canvas(64, 256);
  const v = ctx.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(255,240,205,0.55)');
  v.addColorStop(0.7, 'rgba(255,232,190,0.16)');
  v.addColorStop(1, 'rgba(255,232,190,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 64, 256);
  ctx.globalCompositeOperation = 'destination-in';
  const h = ctx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.5, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Dusky sky dome gradient (top → horizon) with a warm band near the horizon. */
export const skyTexture = () => {
  const { c, ctx } = canvas(16, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#3d5a8a');
  g.addColorStop(0.42, '#9db3cf');
  g.addColorStop(0.5, '#f1cfa0');
  g.addColorStop(0.53, '#e9b98a');
  g.addColorStop(1, '#6f7b6a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** A carved relief panel for the Stations of the Cross (numbered). */
export const stationTexture = (n: number) => {
  const { c, ctx } = canvas(128, 160);
  ctx.fillStyle = '#d8ccb2';
  ctx.fillRect(0, 0, 128, 160);
  ctx.fillStyle = 'rgba(80,60,40,0.35)';
  ctx.beginPath();
  ctx.ellipse(54, 70, 16, 40, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(84, 78, 12, 34, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(20, 30, 6, 90);
  ctx.fillRect(8, 48, 30, 6);
  ctx.fillStyle = '#6b5131';
  ctx.font = 'bold 22px serif';
  ctx.textAlign = 'center';
  const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV'][n] ?? '';
  ctx.fillText(roman, 64, 148);
  return toTexture(c);
};

/** Small canvas label sprite texture (name plates, shrine signs). */
export const labelTexture = (text: string, sub?: string) => {
  const { c, ctx } = canvas(512, sub ? 128 : 96);
  ctx.fillStyle = 'rgba(20, 22, 20, 0.66)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, c.height - 16, 36);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f6efdf';
  ctx.font = '600 38px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(text, 256, sub ? 50 : 48, 460);
  if (sub) {
    ctx.fillStyle = '#d9bd83';
    ctx.font = '22px sans-serif';
    ctx.fillText(sub, 256, 94);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
