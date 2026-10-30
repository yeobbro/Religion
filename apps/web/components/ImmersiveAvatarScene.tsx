'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Space = 'chapel' | 'garden';
type Props = { space: Space };

export default function ImmersiveAvatarScene({ space }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<'idle' | 'dip' | 'cross'>('idle');
  const gestureAt = useRef(0);
  const [nearFont, setNearFont] = useState(false);
  const [step, setStep] = useState<'water' | 'cross' | 'done'>('water');

  useEffect(() => {
    setStep('water');
    setNearFont(false);
    gesture.current = 'idle';
  }, [space]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 0.1, 80);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight('#f5e8d5', '#34362e', 2.1));
    const sun = new THREE.DirectionalLight('#fff0d8', 2.6);
    sun.position.set(-4, 9, 6);
    sun.castShadow = true;
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#d8c6a5', 1.1);
    fill.position.set(4, 5, -5);
    scene.add(fill);

    const mat = (color: string, roughness = .8, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const avatar = new THREE.Group();
    avatar.position.set(0, 0, 4.8);
    scene.add(avatar);
    const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      avatar.add(mesh);
      return mesh;
    };

    const coat = mat('#d2c6b2');
    const skin = mat('#d4a17d');
    const hair = mat('#292321');
    const pants = mat('#343a3c');
    const shoeMat = mat('#202527');
    const bag = mat('#554c40');
    add(new THREE.CapsuleGeometry(.31, .66, 5, 12), coat, 0, 1.34, 0);
    add(new THREE.CylinderGeometry(.1, .11, .18, 12), skin, 0, 1.85, 0);
    const face = add(new THREE.SphereGeometry(.23, 18, 14), skin, 0, 2.08, -.02);
    face.scale.set(.92, 1.08, .95);
    const hairCap = add(new THREE.SphereGeometry(.24, 18, 12, 0, Math.PI * 2, 0, Math.PI * .58), hair, 0, 2.16, .01);
    hairCap.scale.set(1.02, .88, 1.03);
    add(new THREE.BoxGeometry(.51, .68, .2), bag, 0, 1.34, .29);
    add(new THREE.BoxGeometry(.35, .12, .22), mat('#766b57'), 0, 1.08, .4);

    const limb = (x: number, y: number, material: THREE.Material, length: number, radius: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      avatar.add(pivot);
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 10), material);
      mesh.position.y = -length * .46;
      mesh.castShadow = true;
      pivot.add(mesh);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), skin);
      hand.position.y = -length;
      pivot.add(hand);
      return pivot;
    };
    const leftArm = limb(-.39, 1.64, coat, .62, .105);
    const rightArm = limb(.39, 1.64, coat, .62, .105);
    const leg = (x: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, .88, 0);
      avatar.add(pivot);
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(.125, .56, 4, 10), pants);
      mesh.position.y = -.34;
      mesh.castShadow = true;
      pivot.add(mesh);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(.22, .13, .38), shoeMat);
      shoe.position.set(0, -.72, -.09);
      shoe.castShadow = true;
      pivot.add(shoe);
      return pivot;
    };
    const leftLeg = leg(-.16);
    const rightLeg = leg(.16);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.58, 32), new THREE.MeshBasicMaterial({ color: '#090b09', transparent: true, opacity: .3 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .02;
    avatar.add(shadow);

    const font = new THREE.Group();
    font.position.set(-1.48, 0, 3.55);
    scene.add(font);
    const stone = mat('#aaa18e');
    const brass = mat('#a58a5a', .35, .55);
    const water = new THREE.MeshStandardMaterial({ color: '#91bbb6', roughness: .18, metalness: .25, emissive: '#244947', emissiveIntensity: .25 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.42, .48, .16, 24), brass);
    base.position.y = .08;
    font.add(base);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.18, .25, .72, 18), stone);
    pedestal.position.y = .49;
    font.add(pedestal);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.4, .24, .24, 28, 1, true), stone);
    bowl.position.y = .97;
    font.add(bowl);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.39, .045, 10, 28), brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.1;
    font.add(rim);
    const waterTop = new THREE.Mesh(new THREE.CircleGeometry(.33, 28), water);
    waterTop.rotation.x = -Math.PI / 2;
    waterTop.position.y = 1.075;
    font.add(waterTop);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(.68, .018, 8, 36), new THREE.MeshBasicMaterial({ color: '#ead8ad', transparent: true, opacity: .48 }));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = .035;
    font.add(halo);
    const glow = new THREE.PointLight('#c7e4d8', 1.8, 4.2, 2);
    glow.position.y = 1.7;
    font.add(glow);

    const keys = new Set<string>();
    let yaw = 0;
    let pitch = .05;
    let drag = false;
    let lastX = 0;
    let lastY = 0;
    let frame = 0;
    let lastNear = false;
    const clock = new THREE.Clock();
    const target = new THREE.Vector3();
    const look = new THREE.Vector3();
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {
        keys.add(key);
        if (key.startsWith('arrow')) e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();
    const down = (e: PointerEvent) => { drag = true; lastX = e.clientX; lastY = e.clientY; };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      yaw = THREE.MathUtils.clamp(yaw - (e.clientX - lastX) * .004, -1.15, 1.15);
      pitch = THREE.MathUtils.clamp(pitch + (e.clientY - lastY) * .002, -.16, .28);
      lastX = e.clientX; lastY = e.clientY;
    };
    const up = () => { drag = false; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); pitch = THREE.MathUtils.clamp(pitch + e.deltaY * .00035, -.16, .28); };
    const resize = () => {
      camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerup', up);
    window.addEventListener('resize', resize);
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('wheel', wheel, { passive: false });

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), .04);
      const fwd = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const side = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const moving = Math.abs(fwd) + Math.abs(side) > 0;
      if (moving) {
        const len = Math.hypot(fwd, side) || 1;
        const dx = Math.sin(yaw) * fwd / len + Math.cos(yaw) * side / len;
        const dz = -Math.cos(yaw) * fwd / len + Math.sin(yaw) * side / len;
        avatar.position.x = THREE.MathUtils.clamp(avatar.position.x + dx * delta * 3.3, -5.8, 5.8);
        avatar.position.z = THREE.MathUtils.clamp(avatar.position.z + dz * delta * 3.3, -8.5, 6.2);
        avatar.rotation.y = Math.atan2(dx, -dz);
      }
      const gait = moving ? Math.sin(clock.elapsedTime * 10.5) * .52 : 0;
      leftLeg.rotation.x = gait;
      rightLeg.rotation.x = -gait;
      leftArm.rotation.x = -gait * .4;
      rightArm.rotation.x = gait * .4;
      if (gesture.current !== 'idle') {
        const duration = gesture.current === 'dip' ? 950 : 1250;
        const progress = Math.min(1, (performance.now() - gestureAt.current) / duration);
        if (gesture.current === 'dip') {
          leftArm.rotation.x = -1.2 * Math.sin(progress * Math.PI);
          leftArm.rotation.z = .58 * Math.sin(progress * Math.PI);
        } else {
          const phase = progress * 3;
          leftArm.rotation.x = phase < 1 ? -1.3 : phase < 2 ? -.42 : -1.02;
          leftArm.rotation.z = phase < 1 ? .05 : phase < 2 ? .92 : -.22;
        }
        if (progress >= 1) gesture.current = 'idle';
      } else {
        leftArm.rotation.z = 0;
        rightArm.rotation.z = 0;
      }
      target.set(avatar.position.x + Math.sin(yaw) * 4.35, 2.85 + pitch * 4, avatar.position.z + Math.cos(yaw) * 4.35);
      camera.position.lerp(target, 1 - Math.exp(-delta * 5.5));
      look.set(avatar.position.x, 1.18, avatar.position.z - .75);
      camera.lookAt(look);
      const near = space === 'chapel' && Math.hypot(avatar.position.x - font.position.x, avatar.position.z - font.position.z) < 2.15;
      if (near !== lastNear) { lastNear = near; setNearFont(near); }
      (halo.material as THREE.MeshBasicMaterial).opacity = near ? .92 : .48;
      glow.intensity = near ? 3 : 1.8;
      waterTop.rotation.z = Math.sin(clock.elapsedTime * .9) * .015;
      renderer.render(scene, camera);
    };
    resize();
    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('resize', resize);
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('wheel', wheel);
      scene.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const materials = Array.isArray(o.material) ? o.material : [o.material];
          materials.forEach(m => m.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [space]);

  const dip = () => {
    gesture.current = 'dip';
    gestureAt.current = performance.now();
    setStep('cross');
  };
  const sign = () => {
    gesture.current = 'cross';
    gestureAt.current = performance.now();
    setStep('done');
  };

  return (
    <div className="immersive-avatar-stage">
      <div ref={hostRef} className="immersive-avatar-canvas" aria-label="Movable 3D avatar in the virtual space" />
      {nearFont && step !== 'done' ? (
        <div className="holy-water-actions" role="group" aria-label="Holy water actions">
          <span aria-hidden="true">{step === 'water' ? '✧' : '✝'}</span>
          {step === 'water'
            ? <button type="button" className="holy-water-primary" onClick={dip}>💧 성수 찍기</button>
            : <button type="button" className="holy-water-primary" onClick={sign}>성호 긋기</button>}
          <button type="button" className="holy-water-skip" onClick={() => setStep('done')}>건너뛰기</button>
        </div>
      ) : null}
      <div className="touch-pad avatar-touch-pad" aria-label="Avatar movement">
        <button type="button" aria-label="앞으로" onPointerDown={e => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown',{key:'w'})); }} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'w'}))} onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'w'}))} onPointerCancel={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'w'}))}>▲</button>
        <div>
          <button type="button" aria-label="왼쪽" onPointerDown={e => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown',{key:'a'})); }} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'a'}))} onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'a'}))} onPointerCancel={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'a'}))}>◀</button>
          <button type="button" aria-label="뒤로" onPointerDown={e => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown',{key:'s'})); }} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'s'}))} onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'s'}))} onPointerCancel={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'s'}))}>▼</button>
          <button type="button" aria-label="오른쪽" onPointerDown={e => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown',{key:'d'})); }} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}))} onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}))} onPointerCancel={() => window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}))}>▶</button>
        </div>
      </div>
    </div>
  );
}
