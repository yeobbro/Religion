'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Props = { onCandleChange?: (count: number) => void };

export default function Chapel3DScene({ onCandleChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState('마우스로 둘러보고 촛불을 눌러보세요');
  const [litCount, setLitCount] = useState(7);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#171a18');
    scene.fog = new THREE.FogExp2('#171a18', 0.035);

    const camera = new THREE.PerspectiveCamera(52, host.clientWidth / host.clientHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight('#d9d1bd', '#252821', 1.6);
    scene.add(ambient);
    const altarLight = new THREE.PointLight('#f4d49a', 34, 18, 2);
    altarLight.position.set(0, 3.3, -6.1);
    altarLight.castShadow = true;
    scene.add(altarLight);
    const warmLight = new THREE.PointLight('#d9a96a', 14, 10, 2);
    warmLight.position.set(0, 2.2, 1);
    scene.add(warmLight);

    const mat = (color: string, roughness = 0.85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const stone = mat('#77756a');
    const darkStone = mat('#383b35');
    const wood = mat('#4b3829');
    const gold = mat('#b59a67', 0.42, 0.35);
    const ivory = mat('#e4d8bd');
    const floorMat = mat('#56564e', 0.92);

    const addBox = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    addBox(22, 0.35, 28, floorMat, 0, -0.2, -3);
    addBox(22, 0.5, 28, darkStone, 0, 7.7, -3);
    addBox(0.5, 8, 28, stone, -10.8, 3.8, -3);
    addBox(0.5, 8, 28, stone, 10.8, 3.8, -3);
    addBox(22, 8, 0.5, stone, 0, 3.8, 10.8);
    addBox(22, 8, 0.5, darkStone, 0, 3.8, -16.8);

    // Nave columns and understated arches.
    for (const x of [-8.2, -5.4, 5.4, 8.2]) {
      for (const z of [-13, -7, -1, 5]) {
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 7.1, 12), ivory);
        column.position.set(x, 3.45, z);
        column.castShadow = true;
        column.receiveShadow = true;
        scene.add(column);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.28, 12), gold);
        cap.position.set(x, 7.05, z);
        scene.add(cap);
      }
    }

    // Altar, tabernacle and cross.
    addBox(5.8, 0.45, 2.1, gold, 0, 1.2, -10.2);
    addBox(5.1, 1.1, 1.7, ivory, 0, 0.45, -10.2);
    addBox(2.2, 2.1, 1.3, wood, 0, 2.45, -13.2);
    addBox(0.22, 2.6, 0.18, gold, 0, 5.2, -13.8);
    addBox(1.55, 0.2, 0.18, gold, 0, 5.65, -13.8);

    // Stained-glass-inspired side windows.
    for (const x of [-10.48, 10.48]) {
      for (const z of [-12, -6, 0, 6]) {
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.2), new THREE.MeshBasicMaterial({ color: '#8c8067', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
        glass.position.set(x, 4.5, z);
        glass.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
        scene.add(glass);
        const frame = mat('#373a35');
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 3.35, 0.09), frame);
        bar.position.set(x * 1.002, 4.5, z);
        scene.add(bar);
      }
    }

    // Candle stands with individual flames and point lights.
    const candleMeshes: THREE.Object3D[] = [];
    const candleLights: THREE.PointLight[] = [];
    const candleFlames: THREE.Mesh[] = [];
    const candlePositions: [number, number, number][] = [
      [-2.5, 0, -8.4], [-1.7, 0, -8.4], [-0.9, 0, -8.4], [0, 0, -8.4],
      [0.9, 0, -8.4], [1.7, 0, -8.4], [2.5, 0, -8.4]
    ];
    candlePositions.forEach(([x, y, z], index) => {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.72, 12), gold);
      stand.position.set(x, y + 0.36, z);
      stand.castShadow = true;
      scene.add(stand);
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.65, 12), ivory);
      candle.position.set(x, y + 1.02, z);
      candle.userData.candleIndex = index;
      candle.castShadow = true;
      scene.add(candle);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffc66e' }));
      flame.position.set(x, y + 1.43, z);
      flame.userData.candleIndex = index;
      scene.add(flame);
      const light = new THREE.PointLight('#ffbf69', 3.2, 4.5, 2);
      light.position.set(x, y + 1.55, z);
      scene.add(light);
      candleMeshes.push(candle);
      candleFlames.push(flame);
      candleLights.push(light);
    });

    // A small aisle runner and pews.
    addBox(2.4, 0.025, 16, mat('#78684d'), 0, 0.0, -1.8);
    for (const z of [-5, -1.5, 2, 5.5]) {
      for (const x of [-4.1, 4.1]) {
        addBox(3.1, 0.22, 0.5, wood, x, 0.85, z);
        addBox(3.1, 1.0, 0.2, wood, x, 1.35, z + 0.45);
        for (const dx of [-1.25, 1.25]) addBox(0.16, 0.82, 0.18, gold, x + dx, 0.42, z);
      }
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false;
    let previousX = 0;
    let previousY = 0;
    let yaw = 0;
    let pitch = -0.08;
    let distance = 10.5;
    let cameraX = 0;
    let cameraZ = 0;
    const keys = new Set<string>();
    const onKeyDown = (event: KeyboardEvent) => {
      if (['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) {
        keys.add(event.key.toLowerCase());
        if (event.key.startsWith('Arrow')) event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const onPointerDown = (event: PointerEvent) => {
      dragging = true; previousX = event.clientX; previousY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      yaw -= (event.clientX - previousX) * 0.004;
      pitch = THREE.MathUtils.clamp(pitch + (event.clientY - previousY) * 0.003, -0.55, 0.32);
      previousX = event.clientX; previousY = event.clientY;
    };
    const onPointerUp = () => { dragging = false; };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      distance = THREE.MathUtils.clamp(distance + event.deltaY * 0.012, 4.5, 18);
    };
    const onClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(candleMeshes, false)[0];
      if (!hit) return;
      const index = hit.object.userData.candleIndex as number;
      const isLit = candleLights[index].intensity > 0;
      candleLights[index].intensity = isLit ? 0 : 3.2;
      candleFlames[index].visible = !isLit;
      setLitCount(count => count + (isLit ? -1 : 1));
      setHint(isLit ? '촛불을 잠시 껐습니다.' : '작은 촛불 하나가 밝혀졌습니다.');
    };
    const onResize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.04);
      const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const sideways = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      cameraX += sideways * delta * 3 * Math.cos(yaw) + forward * delta * 3 * Math.sin(yaw);
      cameraZ += sideways * delta * 3 * Math.sin(yaw) - forward * delta * 3 * Math.cos(yaw);
      cameraX = THREE.MathUtils.clamp(cameraX, -7.2, 7.2);
      cameraZ = THREE.MathUtils.clamp(cameraZ, -14, 8);
      const targetX = cameraX + Math.sin(yaw) * distance;
      const targetZ = cameraZ + Math.cos(yaw) * distance;
      camera.position.set(targetX, 2.25 + pitch * 4, targetZ);
      camera.lookAt(cameraX, 2.0, cameraZ - 3.2);
      candleLights.forEach((light, i) => {
        if (light.intensity > 0) light.intensity = 2.8 + Math.sin(clock.elapsedTime * 5 + i) * 0.35;
      });
      renderer.render(scene, camera);
    };
    animate();
    onCandleChange?.(7);

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [onCandleChange]);

  return (
    <div className="scene3d-wrap">
      <div className="scene3d-canvas" ref={hostRef} aria-label="마우스와 키보드로 둘러볼 수 있는 3D 성당 내부" />
      <div className="scene3d-overlay"><span className="scene3d-live"><i /> INTERACTIVE CHAPEL</span><span className="scene3d-hint">{hint}</span></div>
      <div className="scene3d-bottom"><span>🕯 {litCount}개의 촛불이 밝혀져 있습니다</span><span>WASD 이동 · 드래그 회전 · 휠 확대</span></div>
    </div>
  );
}
