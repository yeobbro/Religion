'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';

type Props = { displayName: string };
type Blocker = { x: number; z: number; rx: number; rz: number };

export default function ImmersiveAvatarScene({ displayName }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<'idle' | 'dip' | 'cross' | 'prayer' | 'bow' | 'greet' | 'rosary' | 'sit'>('idle');
  const gestureAt = useRef(0);
  const [nearFont, setNearFont] = useState(false);
  const [step, setStep] = useState<'water' | 'cross' | 'done'>('water');
  const [nearMary, setNearMary] = useState(false);
  const [actionNotice, setActionNotice] = useState('클릭한 바닥으로 이동하거나 하단 동작을 선택하세요.');
  const [joystickOffset, setJoystickOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setStep('water');
    setNearFont(false);
    gesture.current = 'idle';
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#aebbb4');
    scene.fog = new THREE.Fog('#aebbb4', 42, 105);

    const camera = new THREE.PerspectiveCamera(64, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 220);
    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor('#aebbb4', 1);
    host.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight('#eee7d8', '#404a3b', 2.0);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff0d4', 2.65);
    sun.position.set(-12, 19, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -40;
    sun.shadow.bias = -0.0003;
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#d5e1d6', 0.9);
    fill.position.set(12, 9, -18);
    scene.add(fill);

    const blockers: Blocker[] = [];
    const addBlocker = (x: number, z: number, rx: number, rz: number) => blockers.push({ x, z, rx, rz });
    const collides = (x: number, z: number) => blockers.some(b =>
      Math.abs(x - b.x) < b.rx + 0.36 && Math.abs(z - b.z) < b.rz + 0.36
    );

    const makeNoiseTexture = (base: string, seed: number, repeatX = 1, repeatY = 1) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, 256, 256);
        let n = seed >>> 0;
        const rand = () => {
          n = (n * 1664525 + 1013904223) >>> 0;
          return n / 4294967296;
        };
        for (let i = 0; i < 4600; i += 1) {
          const alpha = 0.025 + rand() * 0.095;
          ctx.fillStyle = rand() > 0.52
            ? `rgba(255,245,224,${alpha})`
            : `rgba(20,24,18,${alpha})`;
          const size = 1 + rand() * 3;
          ctx.fillRect(rand() * 256, rand() * 256, size, size);
        }
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeatX, repeatY);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const makeMat = (color: string, roughness = 0.82, metalness = 0, map?: THREE.Texture) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness, map });

    const woodColorMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/wooden_planks/wooden_planks_diff_2k.jpg');
    const woodNormalMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/wooden_planks/wooden_planks_nor_gl_2k.jpg');
    const woodRoughnessMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/wooden_planks/wooden_planks_rough_2k.jpg');
    loadedTextures.push(woodColorMap, woodNormalMap, woodRoughnessMap);
    [woodColorMap, woodNormalMap, woodRoughnessMap].forEach(texture => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2.5, 1.5);
    });
    woodColorMap.colorSpace = THREE.SRGBColorSpace;


    // Photo-scanned PBR stone from Poly Haven (CC0) for the cathedral masonry.
    const textureLoader = new THREE.TextureLoader();
    const stoneColorMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/stone_brick_wall_001/stone_brick_wall_001_diff_2k.jpg');
    const stoneNormalMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/stone_brick_wall_001/stone_brick_wall_001_nor_gl_2k.jpg');
    const stoneRoughnessMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/stone_brick_wall_001/stone_brick_wall_001_rough_2k.jpg');
    const loadedTextures: THREE.Texture[] = [stoneColorMap, stoneNormalMap, stoneRoughnessMap];
    [stoneColorMap, stoneNormalMap, stoneRoughnessMap].forEach(texture => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(12, 7);
    });
    stoneColorMap.colorSpace = THREE.SRGBColorSpace;
    const cathedralInteriorPhoto = textureLoader.load('https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Cathedral_Interior_with_Stained_Glass_and_Altar_%2855260745408%29.jpg/768px-Cathedral_Interior_with_Stained_Glass_and_Altar_%2855260745408%29.jpg');
    const maryShrinePhoto = textureLoader.load('https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/EstatuaGrutadeLourdes-MDP.jpg/768px-EstatuaGrutadeLourdes-MDP.jpg');
    cathedralInteriorPhoto.colorSpace = THREE.SRGBColorSpace;
    maryShrinePhoto.colorSpace = THREE.SRGBColorSpace;
    loadedTextures.push(cathedralInteriorPhoto, maryShrinePhoto);

    const plaster = makeMat('#d7d0c0', 0.94, 0, makeNoiseTexture('#d7d0c0', 2, 4, 3));
    const darkPlaster = makeMat('#938d80', 0.94, 0, makeNoiseTexture('#938d80', 4, 3, 2));
    const darkStone = makeMat('#53564e', 0.91, 0, makeNoiseTexture('#53564e', 18, 3, 2));
    const floorStone = makeMat('#827e72', 0.88, 0, makeNoiseTexture('#827e72', 6, 8, 14));
    const aisleStone = makeMat('#a28a67', 0.78, 0, makeNoiseTexture('#a28a67', 8, 2, 12));
    const trim = makeMat('#b49a6b', 0.42, 0.42);
    const wood = makeMat('#523d2b', 0.7, 0, makeNoiseTexture('#523d2b', 10, 3, 2));
    const darkWood = makeMat('#33271f', 0.78, 0);
    for (const material of [wood, darkWood]) {
      material.map = woodColorMap;
      material.normalMap = woodNormalMap;
      material.roughnessMap = woodRoughnessMap;
      material.needsUpdate = true;
    }
    const ivory = makeMat('#e5dac3', 0.78, 0);
    const stone = makeMat('#aaa28f', 0.86, 0);
    for (const material of [plaster, darkPlaster, darkStone, stone]) {
      material.map = stoneColorMap;
      material.normalMap = stoneNormalMap;
      material.roughnessMap = stoneRoughnessMap;
      material.needsUpdate = true;
    }
    const greenery = makeMat('#58724c', 0.96, 0, makeNoiseTexture('#58724c', 12, 2, 2));
    const grassMat = makeMat('#687e58', 0.98, 0, makeNoiseTexture('#687e58', 14, 20, 20));
    const pathMat = makeMat('#b9af99', 0.92, 0, makeNoiseTexture('#b9af99', 16, 6, 20));
    const skin = makeMat('#d3a17f', 0.72, 0);
    const coat = makeMat('#c8bdab', 0.88, 0);
    const coatShadow = makeMat('#a99d89', 0.86, 0);
    const hair = makeMat('#292321', 0.9, 0);
    const trousers = makeMat('#373d3e', 0.86, 0);
    const shoes = makeMat('#202527', 0.8, 0);
    const bag = makeMat('#554c40', 0.9, 0);

    const addMesh = (
      parent: THREE.Object3D,
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
      castShadow = true,
      receiveShadow = true,
    ) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      parent.add(mesh);
      return mesh;
    };
    const addBox = (parent: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, blocker = false) => {
      const mesh = addMesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
      if (blocker) addBlocker(x, z, w / 2, d / 2);
      return mesh;
    };
    const addCylinder = (parent: THREE.Object3D, rt: number, rb: number, h: number, material: THREE.Material, x: number, y: number, z: number, segments = 18, blocker = false) => {
      const mesh = addMesh(parent, new THREE.CylinderGeometry(rt, rb, h, segments), material, x, y, z);
      if (blocker) addBlocker(x, z, Math.max(rt, rb), Math.max(rt, rb));
      return mesh;
    };
    const addGroundPlane = (parent: THREE.Object3D, width: number, depth: number, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = addMesh(parent, new THREE.PlaneGeometry(width, depth), material, x, y, z, false, true);
      mesh.rotation.x = -Math.PI / 2;
      return mesh;
    };

    // One continuous site: nave, entrance threshold, courtyard, and garden.
    const world = new THREE.Group();
    scene.add(world);

    // Outside ground begins before the threshold and continues well into the garden.
    addGroundPlane(world, 60, 100, grassMat, 0, -0.24, 38);
    addGroundPlane(world, 29.0, 42, floorStone, 0, -0.1, -1);
    for (let x = -14; x <= 14; x += 2) {
      for (let z = -20; z <= 18; z += 2) {
        addMesh(world, new THREE.BoxGeometry(1.94, 0.035, 1.94), floorStone, x, -0.075, z, false, true);
      }
    }
    addGroundPlane(world, 3.4, 40, aisleStone, 0, -0.045, -1);
    addGroundPlane(world, 5.4, 48, pathMat, 0, -0.035, 39);

    // CHURCH: long nave, side aisles, side walls and vaulted ceiling.
    addBox(world, 29.0, 0.65, 42, darkPlaster, 0, 22.15, -1);
    addBox(world, 0.8, 21.6, 42, plaster, -14.4, 10.8, -1, true);
    addBox(world, 0.8, 21.6, 42, plaster, 14.4, 10.8, -1, true);
    addBox(world, 29.0, 21.6, 0.8, plaster, 0, 10.8, -22, true);
    // The front wall has a real open doorway; there is no invisible wall across the threshold.
    addBox(world, 11.5, 21.6, 0.8, plaster, -8.65, 10.8, 19.5, true);
    addBox(world, 11.5, 21.6, 0.8, plaster, 8.65, 10.8, 19.5, true);
    addBox(world, 6.5, 3.0, 0.8, plaster, 0, 20.2, 19.5);
    for (const x of [-2.9, 2.9]) {
      addCylinder(world, 0.58, 0.64, 20.8, ivory, x, 10.4, 19.15, 24, true);
      addBox(world, 1.35, 0.42, 1.25, trim, x, 21.0, 19.15);
    }


    // Monumental west facade: rose window and twin towers inspired by the great French Gothic cathedrals.
    const roseWindow = new THREE.Group();
    roseWindow.position.set(0, 14.7, 19.04);
    world.add(roseWindow);
    const roseGlass = new THREE.Mesh(
      new THREE.CircleGeometry(3.05, 64),
      new THREE.MeshStandardMaterial({
        color: '#8c9ec0',
        emissive: '#455879',
        emissiveIntensity: 0.42,
        roughness: 0.24,
        metalness: 0.08,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide,
      })
    );
    roseWindow.add(roseGlass);
    for (const radius of [1.15, 2.05, 2.9]) {
      const traceryRing = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.085, 10, 64), trim);
      roseWindow.add(traceryRing);
    }
    for (let i = 0; i < 12; i += 1) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.075, 5.75, 0.09), trim);
      spoke.rotation.z = (Math.PI * 2 * i) / 12;
      roseWindow.add(spoke);
    }
    const roseBoss = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), trim);
    roseBoss.position.z = 0.08;
    roseWindow.add(roseBoss);

    for (const side of [-1, 1]) {
      const towerX = side * 11.35;
      addBox(world, 5.65, 22.0, 5.4, darkStone, towerX, 11.0, 22.5);
      addBox(world, 5.95, 0.55, 5.7, trim, towerX, 22.0, 22.5);
      for (const offset of [-2.45, 2.45]) {
        addBox(world, 0.28, 22.5, 0.28, trim, towerX + offset, 11.25, 22.5);
      }
      const towerLouver = addMesh(
        world,
        new THREE.PlaneGeometry(1.85, 5.0),
        new THREE.MeshStandardMaterial({
          color: '#59758a',
          emissive: '#38536b',
          emissiveIntensity: 0.34,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
        }),
        towerX,
        15.6,
        19.76,
        false,
        false
      );
      towerLouver.rotation.y = Math.PI;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(3.35, 12.0, 8), darkWood);
      spire.position.set(towerX, 29.0, 22.5);
      spire.castShadow = true;
      world.add(spire);
      addBox(world, 0.2, 2.8, 0.2, trim, towerX, 36.2, 22.5);
      addBox(world, 1.45, 0.18, 0.18, trim, towerX, 36.8, 22.5);
      addBlocker(towerX, 22.5, 2.95, 2.85);
    }

    // Flying buttresses give the outer nave the stepped silhouette of a monumental Gothic basilica.
    for (const side of [-1, 1]) {
      for (const z of [-14, -5, 4, 13]) {
        addBox(world, 0.85, 18.2, 1.1, stone, side * 18.0, 9.1, z, true);
        const diagonal = addBox(world, 0.72, 12.0, 1.0, ivory, side * 16.2, 12.3, z);
        diagonal.rotation.z = -side * 0.26;
        addBox(world, 2.1, 0.45, 1.65, trim, side * 18.0, 18.5, z);
      }
    }

    // Open wooden entrance doors on their hinges, so the garden reads as the next space.
    const leftDoor = new THREE.Group();
    leftDoor.position.set(-2.9, 0, 19.5);
    leftDoor.rotation.y = -0.92;
    world.add(leftDoor);
    addBox(leftDoor, 2.75, 8.8, 0.22, wood, -1.34, 4.4, 0);
    for (const y of [1.4, 4.4, 7.4]) addBox(leftDoor, 2.55, 0.1, 0.28, trim, -1.34, y, 0);
    const rightDoor = new THREE.Group();
    rightDoor.position.set(2.9, 0, 19.5);
    rightDoor.rotation.y = 0.92;
    world.add(rightDoor);
    addBox(rightDoor, 2.75, 8.8, 0.22, wood, 1.34, 4.4, 0);
    for (const y of [1.4, 4.4, 7.4]) addBox(rightDoor, 2.55, 0.1, 0.28, trim, 1.34, y, 0);

    // A high stone vault, rib arches and heavy piers.
    for (const x of [-11.2, -7.5, 7.5, 11.2]) {
      for (const z of [-17, -11, -5, 1, 7, 13]) {
        addCylinder(world, 0.38, 0.48, 20.6, ivory, x, 10.3, z, 22, true);
        addCylinder(world, 0.68, 0.68, 0.42, trim, x, 20.85, z, 22);
        addBox(world, 1.15, 0.24, 1.15, trim, x, 21.15, z);
      }
    }
    for (const z of [-17, -11, -5, 1, 7, 13]) {
      const pointedArch = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-6.2, 7.2, z),
        new THREE.Vector3(-5.5, 13.4, z),
        new THREE.Vector3(-3.7, 18.7, z),
        new THREE.Vector3(0, 21.45, z),
        new THREE.Vector3(3.7, 18.7, z),
        new THREE.Vector3(5.5, 13.4, z),
        new THREE.Vector3(6.2, 7.2, z),
      ]);
      const rib = new THREE.Mesh(new THREE.TubeGeometry(pointedArch, 88, 0.2, 12, false), trim);
      rib.castShadow = true;
      world.add(rib);
    }
    // Longitudinal ribs join the pointed arches into a high Gothic vault.
    for (const x of [-5.8, 0, 5.8]) {
      const vaultRib = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, x === 0 ? 21.45 : 12.0, -19),
          new THREE.Vector3(x, x === 0 ? 21.45 : 18.0, -10),
          new THREE.Vector3(x, x === 0 ? 21.45 : 21.0, 0),
          new THREE.Vector3(x, x === 0 ? 21.45 : 18.0, 10),
          new THREE.Vector3(x, x === 0 ? 21.45 : 12.0, 17),
        ]), 80, 0.16, 10, false), trim
      );
      world.add(vaultRib);
    }

    // Stained glass panels: jewel tones with lead divisions.
    const glassColors = ['#547d8e', '#bd805f', '#d5b76f', '#6e927e', '#947f9f', '#d1c18b'];
    for (const side of [-1, 1]) {
      for (const z of [-15, -8, -1, 6, 13]) {
        const x = side * 14.02;
        const glassMat = new THREE.MeshStandardMaterial({
          color: glassColors[(Math.abs(z) + (side > 0 ? 2 : 0)) % glassColors.length],
          roughness: 0.24,
          metalness: 0.08,
          emissive: glassColors[(Math.abs(z) + (side > 0 ? 2 : 0)) % glassColors.length],
          emissiveIntensity: 0.24,
          transparent: true,
          opacity: 0.86,
          side: THREE.DoubleSide,
        });
        const panel = addMesh(world, new THREE.PlaneGeometry(2.2, 4.6), glassMat, x, 5.7, z, false, false);
        panel.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        for (const dz of [-1, 0, 1]) addBox(world, 0.11, 4.7, 0.1, trim, x - side * 0.08, 5.7, z + dz * 0.9);
        addBox(world, 0.12, 4.0, 2.1, darkWood, x - side * 0.11, 5.7, z);
      }
    }


    // Clerestory: a second, much higher band of stained glass pours colored light into the nave.
    for (const side of [-1, 1]) {
      for (const z of [-15, -8, -1, 6, 13]) {
        const x = side * 14.02;
        const color = glassColors[(Math.abs(z) + (side > 0 ? 3 : 1)) % glassColors.length];
        const highGlass = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.3,
          roughness: 0.2,
          metalness: 0.06,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        });
        const clerestory = addMesh(world, new THREE.PlaneGeometry(2.15, 6.4), highGlass, x, 15.0, z, false, false);
        clerestory.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        for (const offset of [-1.05, 1.05]) {
          addBox(world, 0.12, 6.55, 0.12, trim, x - side * 0.08, 15.0, z + offset);
        }
        addBox(world, 0.12, 0.12, 2.2, trim, x - side * 0.08, 15.0, z);
      }
    }

    // Fourteen Stations of the Cross: seven framed relief panels on each side.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i += 1) {
        const z = -16 + i * 4.8;
        const x = side * 13.55;
        addBox(world, 0.12, 1.55, 1.18, darkWood, x, 3.05, z);
        addBox(world, 0.08, 1.3, 0.92, trim, x - side * 0.08, 3.05, z);
        addBox(world, 0.06, 1.05, 0.68, stone, x - side * 0.14, 3.05, z);
        addBox(world, 0.08, 0.62, 0.075, trim, x - side * 0.2, 3.28, z);
        addBox(world, 0.08, 0.08, 0.38, trim, x - side * 0.2, 3.36, z);
        addMesh(world, new THREE.SphereGeometry(0.18, 12, 10), darkWood, x - side * 0.2, 2.9, z, false, false);
      }
    }

    // SANCTUARY: raised chancel, altar, crucifix, tabernacle, ambo and presider's chair.
    addBox(world, 12.2, 0.35, 6.0, trim, 0, 0.18, -17.1);
    addBox(world, 11.7, 0.22, 5.55, ivory, 0, 0.42, -17.1);
    addBox(world, 5.2, 0.48, 1.85, trim, 0, 1.1, -15.8);
    addBox(world, 4.9, 0.96, 1.62, ivory, 0, 0.58, -15.8);
    addBox(world, 2.1, 1.85, 1.25, wood, 0, 2.45, -18.7);
    // Tabernacle set behind the altar, beneath the sanctuary cross.
    addBox(world, 1.45, 1.25, 0.82, trim, 0, 3.95, -19.8);
    addBox(world, 1.12, 0.82, 0.62, ivory, 0, 3.95, -19.25);
    addMesh(world, new THREE.SphereGeometry(0.48, 20, 14), trim, 0, 4.72, -19.25);
    addBox(world, 0.2, 6.8, 0.18, trim, 0, 9.0, -21.35);
    addBox(world, 2.2, 0.22, 0.18, trim, 0, 12.2, -21.35);
    const sanctuaryLamp = new THREE.PointLight('#ff5b3d', 0.9, 5, 2);
    sanctuaryLamp.position.set(1.25, 3.4, -18.8);
    world.add(sanctuaryLamp);
    // Ambo / pulpit with a book.
    addBox(world, 0.95, 1.25, 0.78, wood, -3.4, 0.82, -14.6, true);
    addBox(world, 1.08, 0.12, 0.88, trim, -3.4, 1.5, -14.6);
    const lectern = addBox(world, 0.76, 0.08, 0.52, ivory, -3.4, 1.62, -14.55);
    lectern.rotation.x = -0.18;
    // Priest's chair and two minister seats.
    addBox(world, 0.95, 1.65, 0.8, wood, 3.35, 1.0, -15.0, true);
    addBox(world, 1.15, 0.18, 0.92, trim, 3.35, 1.92, -15.0);
    for (const x of [2.1, 4.6]) addBox(world, 0.72, 0.82, 0.62, wood, x, 0.55, -13.9, true);

    // Congregation seating and central aisle.
    for (const z of [-9.7, -6.2, -2.7, 0.8, 4.3, 7.8]) {
      for (const x of [-4.25, 4.25]) {
        addBox(world, 3.55, 0.22, 0.58, wood, x, 0.82, z);
        addBox(world, 3.55, 0.9, 0.2, wood, x, 1.22, z + 0.42);
        for (const dx of [-1.5, 1.5]) addBox(world, 0.16, 0.8, 0.22, trim, x + dx, 0.4, z);
      }
    }

    // Baptismal font close to the main entrance.
    const holyFont = new THREE.Group();
    holyFont.name = 'holy-water-font';
    holyFont.position.set(-2.2, 0, 12.0);
    world.add(holyFont);
    addCylinder(holyFont, 0.5, 0.58, 0.2, trim, 0, 0.1, 0, 28);
    addCylinder(holyFont, 0.2, 0.29, 0.95, stone, 0, 0.65, 0, 20);
    addCylinder(holyFont, 0.55, 0.34, 0.3, ivory, 0, 1.25, 0, 32);
    const fontRim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.055, 12, 36), trim);
    fontRim.rotation.x = Math.PI / 2;
    fontRim.position.y = 1.42;
    holyFont.add(fontRim);
    const waterSurface = addMesh(holyFont, new THREE.CircleGeometry(0.43, 32), new THREE.MeshStandardMaterial({ color: '#8dbbb7', roughness: 0.16, metalness: 0.28, emissive: '#315d59', emissiveIntensity: 0.25 }), 0, 1.405, 0, false, false);
    waterSurface.rotation.x = -Math.PI / 2;
    const fontHalo = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.025, 8, 40), new THREE.MeshBasicMaterial({ color: '#eed6a4', transparent: true, opacity: 0.38 }));
    fontHalo.rotation.x = Math.PI / 2;
    fontHalo.position.y = 0.035;
    holyFont.add(fontHalo);
    const fontLight = new THREE.PointLight('#c8e8dc', 1.3, 4.5, 2);
    fontLight.position.set(0, 1.7, 0);
    holyFont.add(fontLight);
    addBlocker(-2.2, 12, 0.8, 0.8);

    // Side confessionals, kneelers and small prayer alcoves.
    for (const side of [-1, 1]) {
      const x = side * 12.4;
      addBox(world, 2.3, 2.8, 1.45, darkWood, x, 1.4, 7.4, true);
      addBox(world, 1.1, 1.7, 0.08, wood, x, 1.65, 6.65);
      addBox(world, 0.72, 1.0, 0.05, trim, x, 1.65, 6.58);
      addBox(world, 0.95, 0.08, 0.08, trim, x, 2.2, 6.54);
      addBox(world, 1.6, 0.18, 0.52, wood, x, 0.72, 4.6, true);
      const alcoveLight = new THREE.PointLight('#edc98c', 0.5, 4);
      alcoveLight.position.set(x, 2.3, 5.4);
      world.add(alcoveLight);
    }

    // Choir stalls and organ loft near the entrance end of the nave.
    addBox(world, 8.0, 0.35, 2.0, darkWood, 0, 6.0, 15.0);
    addBox(world, 8.2, 0.16, 0.35, trim, 0, 6.25, 14.1);
    for (let x = -3.1; x <= 3.1; x += 1.05) {
      addBox(world, 0.16, 1.55, 0.18, darkWood, x, 6.95, 14.2);
    }
    addBox(world, 2.6, 2.1, 0.5, wood, 0, 4.8, 15.7);
    for (let x = -0.9; x <= 0.9; x += 0.3) addCylinder(world, 0.055, 0.055, 1.45, trim, x, 5.25, 15.35, 10);

    // COURTYARD: a real exterior zone directly beyond the open church doors.
    // Paving stones continue from the nave into the courtyard; no menu or teleport is used.
    for (let z = 20; z <= 54; z += 2.3) {
      for (let x = -2; x <= 2; x += 1.25) {
        addMesh(world, new THREE.BoxGeometry(1.18, 0.05, 2.15), pathMat, x, -0.005, z, false, true);
      }
    }
    // Low cloister arcades frame the garden on both sides of the path.
    for (const side of [-1, 1]) {
      const x = side * 13.5;
      for (let z = 25; z <= 50; z += 5) {
        addBox(world, 0.65, 4.2, 0.65, stone, x, 2.1, z, true);
        addBox(world, 4.5, 0.3, 0.6, trim, x - side * 1.8, 4.35, z);
      }
      addBox(world, 0.6, 4.1, 32, plaster, side * 15.9, 2.05, 38, true);
    }

    // Garden beds, trees, flower borders, benches and lamps.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i += 1) {
        const x = side * (7.6 + (i % 2) * 2.4);
        const z = 25 + i * 6.1;
        addBox(world, 3.5, 0.35, 3.0, darkStone, x, 0.16, z);
        addBox(world, 3.3, 0.16, 2.8, greenery, x, 0.38, z);
        for (let k = 0; k < 14; k += 1) {
          const px = x + ((k % 4) - 1.5) * 0.6;
          const pz = z + (Math.floor(k / 4) - 1.5) * 0.55;
          const flowerColor = ['#e3c4b7', '#e9d59d', '#d1c4df', '#fff0de'][k % 4];
          addMesh(world, new THREE.SphereGeometry(0.14, 10, 8), makeMat(flowerColor, 0.8), px, 0.72, pz, false, false);
        }
        addCylinder(world, 0.22, 0.32, 3.6, makeMat('#67513a'), side * (10.8 + (i % 2) * 1.1), 1.8, z, 12, true);
        const treeX = side * (10.8 + (i % 2) * 1.1);
        for (let layer = 0; layer < 3; layer += 1) {
          const crown = addMesh(world, new THREE.IcosahedronGeometry(1.65 - layer * 0.12, 1), makeMat(layer === 1 ? '#58774f' : '#6d895f', 0.98), treeX + (layer % 2 ? 0.22 : -0.12), 3.0 + layer * 0.72, z, true, true);
          crown.scale.set(1.1, 0.95, 1.05);
        }
      }
    }
    // Garden fountain; its basin is visible from the main threshold.
    const fountain = new THREE.Group();
    fountain.position.set(3.8, 0, 39.5);
    world.add(fountain);
    addCylinder(fountain, 2.05, 2.3, 0.55, stone, 0, 0.28, 0, 40);
    addCylinder(fountain, 1.78, 1.78, 0.08, makeMat('#7ca7a2', 0.18, 0.2), 0, 0.59, 0, 40);
    addCylinder(fountain, 0.24, 0.34, 1.38, trim, 0, 1.25, 0, 20);
    const fountainWater = addMesh(fountain, new THREE.SphereGeometry(0.3, 18, 14), makeMat('#a6cfca', 0.18, 0.15), 0, 2.05, 0, false, false);
    const fountainLight = new THREE.PointLight('#b9dfd5', 1.5, 7, 2);
    fountainLight.position.set(0, 2.4, 0);
    fountain.add(fountainLight);
    addBlocker(3.8, 39.5, 2.25, 2.25);

    // Marian grotto: a continuous path leads to a dedicated 3D prayer alcove.
    for (let x = 4; x <= 16; x += 2) {
      addMesh(world, new THREE.BoxGeometry(1.85, 0.055, 2.05), pathMat, x, 0.015, 49.5, false, true);
    }

    const maryGrotto = new THREE.Group();
    maryGrotto.position.set(16.4, 0, 49.5);
    world.add(maryGrotto);
    // Open-front rocky alcove facing the path: back, side returns, roof and stone plinth.
    addBox(maryGrotto, 0.7, 4.2, 3.65, darkStone, 0.85, 2.1, 0);
    addBox(maryGrotto, 2.45, 4.2, 0.55, darkStone, -0.08, 2.1, -1.55);
    addBox(maryGrotto, 2.45, 4.2, 0.55, darkStone, -0.08, 2.1, 1.55);
    addBox(maryGrotto, 2.45, 0.48, 3.65, darkStone, -0.08, 4.0, 0);
    addBox(maryGrotto, 2.45, 0.3, 3.65, darkStone, -0.08, 0.15, 0);
    addBox(maryGrotto, 2.7, 0.22, 3.85, trim, -0.1, 4.25, 0);

    // Real Lourdes statue photograph is recessed behind a dimensional statue and arch.
    const maryImage = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 2.25),
      new THREE.MeshStandardMaterial({ map: maryShrinePhoto, roughness: 0.92, side: THREE.DoubleSide })
    );
    maryImage.position.set(0.38, 2.55, 0);
    maryImage.rotation.y = -Math.PI / 2;
    maryGrotto.add(maryImage);

    // Volumetric Marian sculpture: carved robe, blue mantle, veil, face and joined hands.
    const maryStatue = new THREE.Group();
    maryStatue.position.set(-0.82, 0, 0);
    maryGrotto.add(maryStatue);
    const statueIvory = makeMat('#eee9de', 0.74, 0.02);
    const statueBlue = makeMat('#526f9d', 0.78, 0.02);
    const statueSkin = makeMat('#d7b99e', 0.8);
    const robeProfile = [
      new THREE.Vector2(0.16, 0), new THREE.Vector2(0.22, 0.12),
      new THREE.Vector2(0.34, 0.52), new THREE.Vector2(0.42, 1.05),
      new THREE.Vector2(0.34, 1.55), new THREE.Vector2(0.25, 1.92),
      new THREE.Vector2(0.18, 2.08),
    ];
    addMesh(maryStatue, new THREE.LatheGeometry(robeProfile, 28), statueIvory, 0, 0.45, 0);
    const mantle = addMesh(maryStatue, new THREE.SphereGeometry(0.43, 22, 16), statueBlue, 0, 2.15, 0.02);
    mantle.scale.set(1.05, 1.12, 0.76);
    const veil = addMesh(maryStatue, new THREE.SphereGeometry(0.32, 22, 16), statueIvory, 0, 2.83, 0.02);
    veil.scale.set(1.0, 1.3, 0.92);
    const face = addMesh(maryStatue, new THREE.SphereGeometry(0.2, 20, 16), statueSkin, 0, 2.91, -0.02);
    face.scale.set(0.88, 1.15, 0.78);
    const sash = addMesh(maryStatue, new THREE.BoxGeometry(0.12, 1.25, 0.08), makeMat('#9db4ce', 0.55), 0.18, 1.78, -0.24);
    sash.rotation.z = -0.16;
    const maryLeftArm = addMesh(maryStatue, new THREE.CapsuleGeometry(0.075, 0.58, 4, 10), statueBlue, -0.32, 2.15, -0.02);
    maryLeftArm.rotation.z = -0.58;
    const maryRightArm = addMesh(maryStatue, new THREE.CapsuleGeometry(0.075, 0.58, 4, 10), statueBlue, 0.32, 2.15, -0.02);
    maryRightArm.rotation.z = 0.58;
    addMesh(maryStatue, new THREE.SphereGeometry(0.085, 14, 12), statueSkin, -0.06, 1.94, -0.3);
    addMesh(maryStatue, new THREE.SphereGeometry(0.085, 14, 12), statueSkin, 0.06, 1.94, -0.3);
    addMesh(maryStatue, new THREE.ConeGeometry(0.07, 0.32, 10), trim, 0, 3.22, 0.02);

    // Carved stone frame around the image and statue, open to the west.
    addBox(maryGrotto, 0.15, 2.6, 0.16, trim, -1.28, 2.5, -1.0);
    addBox(maryGrotto, 0.15, 2.6, 0.16, trim, -1.28, 2.5, 1.0);
    const maryArchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.28, 3.72, -1.08),
      new THREE.Vector3(-1.28, 4.05, -0.9),
      new THREE.Vector3(-1.28, 4.28, -0.48),
      new THREE.Vector3(-1.28, 4.36, 0),
      new THREE.Vector3(-1.28, 4.28, 0.48),
      new THREE.Vector3(-1.28, 4.05, 0.9),
      new THREE.Vector3(-1.28, 3.72, 1.08),
    ]);
    maryGrotto.add(new THREE.Mesh(new THREE.TubeGeometry(maryArchCurve, 48, 0.12, 10, false), trim));
    for (const z of [-1.2, 1.2]) {
      addCylinder(maryGrotto, 0.12, 0.2, 1.2, darkWood, -1.05, 0.62, z, 12);
      addCylinder(maryGrotto, 0.12, 0.12, 0.38, ivory, -1.05, 1.42, z, 16);
      addMesh(maryGrotto, new THREE.ConeGeometry(0.075, 0.22, 10), makeMat('#f4ce82', 0.35, 0.05), -1.05, 1.72, z, false, false);
      const candleGlow = new THREE.PointLight('#ffcf88', 0.5, 2.8, 2);
      candleGlow.position.set(-1.05, 1.9, z);
      maryGrotto.add(candleGlow);
    }
    // Kneeler faces the statue, leaving clear space between the path and the grotto.
    addBox(maryGrotto, 0.62, 0.18, 1.55, wood, -2.05, 0.62, 0);
    addBox(maryGrotto, 0.16, 0.72, 1.55, wood, -2.28, 0.98, 0);
    addBlocker(16.4, 49.5, 1.75, 1.2);
    addBlocker(14.35, 49.5, 0.2, 0.95);

    // A real cathedral photograph is presented as a framed architectural reference panel
    // mounted on the side-aisle wall, integrated into the surrounding 3D masonry.
    const cathedralPhotoPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.55, 3.8),
      new THREE.MeshStandardMaterial({ map: cathedralInteriorPhoto, roughness: 0.88, side: THREE.DoubleSide })
    );
    cathedralPhotoPanel.position.set(-13.92, 10.5, -7.8);
    cathedralPhotoPanel.rotation.y = Math.PI / 2;
    world.add(cathedralPhotoPanel);
    addBox(world, 0.18, 4.0, 2.75, trim, -13.88, 10.5, -7.8);
    addBox(world, 0.16, 0.15, 2.85, darkWood, -13.78, 12.55, -7.8);
    addBox(world, 0.16, 0.15, 2.85, darkWood, -13.78, 8.45, -7.8);

    // Wooden benches and warm low garden lamps.
    for (const x of [-6.7, 7.1]) {
      addBox(world, 2.2, 0.18, 0.62, wood, x, 0.75, 33.2, true);
      addBox(world, 2.2, 0.82, 0.14, wood, x, 1.18, 33.5, true);
      const lantern = new THREE.Group();
      lantern.position.set(x, 0, 28.5);
      world.add(lantern);
      addCylinder(lantern, 0.15, 0.2, 1.55, darkWood, 0, 0.78, 0, 12);
      const lampGlass = addMesh(lantern, new THREE.SphereGeometry(0.19, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffdf9d' }), 0, 1.65, 0, false, false);
      lampGlass.scale.y = 1.3;
      const lamp = new THREE.PointLight('#ffcf88', 0.8, 5, 2);
      lamp.position.set(0, 1.8, 0);
      lantern.add(lamp);
      addBlocker(x, 33.2, 1.25, 0.8);
    }

    // Low grass and flower island define the open walking space without boxing it in.
    const island = addMesh(world, new THREE.SphereGeometry(1, 20, 12), greenery, -7.2, 0.32, 45, false, true);
    island.scale.set(2.2, 0.36, 3.2);

    // A small outdoor chapel is visible farther down the same continuous path.
    addBox(world, 6.8, 4.8, 4.8, plaster, 0, 2.4, 59);
    const gardenRoof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 3.0, 4), darkWood);
    gardenRoof.position.set(0, 6.3, 59);
    gardenRoof.rotation.y = Math.PI / 4;
    gardenRoof.castShadow = true;
    world.add(gardenRoof);
    addBox(world, 0.14, 1.3, 0.12, trim, 0, 8.4, 59);
    addBox(world, 0.85, 0.14, 0.12, trim, 0, 8.65, 59);

    // Movable 3D avatar, scaled to natural human proportions.
    const avatar = new THREE.Group();
    avatar.position.set(0, 0, 8.8);
    avatar.scale.setScalar(0.72);
    scene.add(avatar);
    const avatarPart = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) =>
      addMesh(avatar, geometry, material, x, y, z);
    avatarPart(new THREE.CapsuleGeometry(0.31, 0.66, 5, 12), coat, 0, 1.34, 0);
    avatarPart(new THREE.CylinderGeometry(0.1, 0.11, 0.18, 12), skin, 0, 1.85, 0);
    const head = avatarPart(new THREE.SphereGeometry(0.235, 18, 14), skin, 0, 2.08, -0.02);
    head.scale.set(0.92, 1.08, 0.95);
    const hairCap = avatarPart(new THREE.SphereGeometry(0.24, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, 0, 2.16, 0.01);
    hairCap.scale.set(1.02, 0.88, 1.03);
    avatarPart(new THREE.BoxGeometry(0.51, 0.68, 0.2), bag, 0, 1.34, 0.29);

    const makeLimb = (x: number, y: number, mat: THREE.Material, length: number, radius: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      avatar.add(pivot);
      const limb = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 10), mat);
      limb.position.y = -length * 0.46;
      limb.castShadow = true;
      pivot.add(limb);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), skin);
      hand.position.y = -length;
      pivot.add(hand);
      return pivot;
    };
    const leftArm = makeLimb(-0.39, 1.64, coatShadow, 0.62, 0.105);
    const rightArm = makeLimb(0.39, 1.64, coatShadow, 0.62, 0.105);
    const makeLeg = (x: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.88, 0);
      avatar.add(pivot);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.56, 4, 10), trousers);
      body.position.y = -0.34;
      body.castShadow = true;
      pivot.add(body);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.38), shoes);
      shoe.position.set(0, -0.72, -0.09);
      shoe.castShadow = true;
      pivot.add(shoe);
      return pivot;
    };
    const leftLeg = makeLeg(-0.16);
    const rightLeg = makeLeg(0.16);

    // Small, unobtrusive baptismal-name plaque above the avatar.
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 96;
    const labelCtx = labelCanvas.getContext('2d');
    if (labelCtx) {
      labelCtx.fillStyle = 'rgba(20, 23, 20, 0.62)';
      labelCtx.beginPath();
      labelCtx.roundRect(8, 8, 496, 80, 38);
      labelCtx.fill();
      labelCtx.font = '600 38px -apple-system, BlinkMacSystemFont, sans-serif';
      labelCtx.textAlign = 'center';
      labelCtx.textBaseline = 'middle';
      labelCtx.fillStyle = '#f6efdf';
      labelCtx.fillText(displayName.trim().slice(0, 18) || '순례자', 256, 48, 460);
    }
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    const nameLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false }));
    nameLabel.scale.set(0.78, 0.15, 1);
    nameLabel.position.set(0, 2.72, 0);
    avatar.add(nameLabel);
    // A small 3D rosary: ten visible beads and a cross held between the visitor's hands.
    const rosary = new THREE.Group();
    rosary.position.set(0, 1.18, -0.22);
    rosary.visible = false;
    avatar.add(rosary);
    const rosaryBeadMaterial = new THREE.MeshStandardMaterial({
      color: '#e6d6bb', roughness: 0.35, metalness: 0.15, emissive: '#493c2a', emissiveIntensity: 0.08,
    });
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), rosaryBeadMaterial);
      bead.position.set(Math.cos(angle) * 0.23, Math.sin(angle) * 0.16, 0);
      rosary.add(bead);
    }
    const rosaryCross = new THREE.Group();
    rosaryCross.position.set(0, -0.33, 0);
    rosary.add(rosaryCross);
    const rosaryGold = makeMat('#c8aa72', 0.3, 0.6);
    addMesh(rosaryCross, new THREE.BoxGeometry(0.055, 0.27, 0.045), rosaryGold, 0, 0, 0, false, false);
    addMesh(rosaryCross, new THREE.BoxGeometry(0.19, 0.05, 0.045), rosaryGold, 0, 0.045, 0, false, false);


    // Available seats are reserved locally for the current visitor.
    const seatSpots: THREE.Vector3[] = [];
    for (const z of [-9.7, -6.2, -2.7, 0.8, 4.3, 7.8]) {
      for (const sideX of [-4.25, 4.25]) {
        for (const offset of [-1.0, 0, 1.0]) seatSpots.push(new THREE.Vector3(sideX + offset, 0, z - 0.55));
      }
    }
    const occupiedSeats = new Set<number>();

    // Collision-aware movement around the architecture and garden furniture.
    addBlocker(-14.4, -1, 0.4, 21);
    addBlocker(14.4, -1, 0.4, 21);
    addBlocker(0, -22, 14.5, 0.4);
    addBlocker(-8.65, 19.5, 5.8, 0.4);
    addBlocker(8.65, 19.5, 5.8, 0.4);
    for (const z of [-17, -11, -5, 1, 7, 13]) {
      for (const x of [-8.7, -5.8, 5.8, 8.7]) addBlocker(x, z, 0.35, 0.35);
    }


    const keys = new Set<string>();
    let yaw = 0, pitch = 0.12, cameraDistance = 6.8;
    let pointerDown = false, pointerMoved = false, pointerTouch = false;
    let lastX = 0, lastY = 0, downX = 0, downY = 0;
    let pinchDistance = 0, joystickX = 0, joystickY = 0;
    let movementTarget: THREE.Vector3 | null = null;
    let pendingSeat: number | null = null, currentSeat: number | null = null;
    let pendingAction: 'prayer' | null = null;
    let isSitting = false, frame = 0;
    let lastNearFont = false, lastNearMary = false;
    const clock = new THREE.Clock();
    const cameraTarget = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const walkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const worldBounds = { minX: -19.5, maxX: 19.5, minZ: -22.5, maxZ: 66 };

    const standUp = () => {
      if (currentSeat !== null) occupiedSeats.delete(currentSeat);
      currentSeat = null;
      isSitting = false;
      avatar.position.y = 0;
      if (gesture.current === 'sit') gesture.current = 'idle';
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      rosary.visible = false;
    };
    const setWalkTarget = (clientX: number, clientY: number) => {
      if (isSitting) standUp();
      const rect = host.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      const point = raycaster.ray.intersectPlane(walkPlane, new THREE.Vector3());
      if (!point) return;
      movementTarget = new THREE.Vector3(
        THREE.MathUtils.clamp(point.x, worldBounds.minX, worldBounds.maxX), 0,
        THREE.MathUtils.clamp(point.z, worldBounds.minZ, worldBounds.maxZ));
      pendingSeat = null;
      pendingAction = null;
      gesture.current = 'idle';
      rosary.visible = false;
      setActionNotice('목표 지점으로 이동합니다.');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {
        keys.add(key);
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const onBlur = () => { keys.clear(); joystickX = 0; joystickY = 0; };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && event.button !== 0) return;
      pointerDown = true;
      pointerMoved = false;
      pointerTouch = event.pointerType === 'touch';
      downX = lastX = event.clientX;
      downY = lastY = event.clientY;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown) return;
      const dx = event.clientX - lastX, dy = event.clientY - lastY;
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 7) pointerMoved = true;
      if (pointerMoved) {
        yaw += dx * (pointerTouch ? 0.006 : 0.004);
        pitch = THREE.MathUtils.clamp(pitch - dy * (pointerTouch ? 0.0045 : 0.003), -0.28, 0.58);
      }
      lastX = event.clientX; lastY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown) return;
      if (!pointerMoved) setWalkTarget(event.clientX, event.clientY);
      pointerDown = false; pointerMoved = false; pointerTouch = false;
    };
    const onJoystick = (event: Event) => {
      const detail = (event as CustomEvent<{x:number;y:number}>).detail;
      joystickX = THREE.MathUtils.clamp(detail?.x ?? 0, -1, 1);
      joystickY = THREE.MathUtils.clamp(detail?.y ?? 0, -1, 1);
      if (Math.abs(joystickX) + Math.abs(joystickY) > 0.08) {
        if (isSitting) standUp();
        movementTarget = null; pendingSeat = null; pendingAction = null;
      }
    };
    const onWorldAction = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === 'seat') {
        if (isSitting) { standUp(); setActionNotice('자리에서 일어났습니다.'); return; }
        const free = seatSpots.map((position,index)=>({position,index,distance:Math.hypot(avatar.position.x-position.x,avatar.position.z-position.z)}))
          .filter(item=>!occupiedSeats.has(item.index) && !collides(item.position.x,item.position.z)).sort((a,b)=>a.distance-b.distance);
        if (!free.length) { setActionNotice('비어 있는 자리가 없습니다.'); return; }
        pendingSeat = free[0].index;
        pendingAction = null;
        movementTarget = free[0].position.clone();
        gesture.current = 'idle'; rosary.visible = false;
        setActionNotice('가장 가까운 빈자리를 찾아 이동합니다.');
        return;
      }
      if (action === 'mary') {
        if (isSitting) standUp();
        pendingSeat = null; pendingAction = 'prayer';
        movementTarget = new THREE.Vector3(13.15,0,49.5);
        gesture.current = 'idle'; rosary.visible = false;
        setActionNotice('정원에 있는 성모 마리아 기도처로 이동합니다.');
        return;
      }
      if (action === 'rosary') {
        if (gesture.current === 'rosary') {
          gesture.current = 'idle'; rosary.visible = false;
          setActionNotice('묵주기도를 마쳤습니다.');
        } else {
          if (isSitting) standUp();
          movementTarget = null; pendingSeat = null; pendingAction = null;
          gesture.current = 'rosary'; gestureAt.current = performance.now();
          rosary.visible = true;
          setActionNotice('묵주를 손에 들고 기도합니다. 다시 누르면 마칩니다.');
        }
        return;
      }
      if (isSitting) standUp();
      movementTarget = null; pendingSeat = null; pendingAction = null;
      rosary.visible = false;
      if (['cross','prayer','bow','greet'].includes(action)) {
        gesture.current = action as 'cross'|'prayer'|'bow'|'greet';
        gestureAt.current = performance.now();
        const messages: Record<string,string> = {
          cross:'성호경을 긋습니다.', prayer:'두 손을 모아 기도합니다.',
          bow:'정중하게 목례합니다.', greet:'손을 들어 인사합니다.'
        };
        setActionNotice(messages[action]);
      }
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        pinchDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY,
        );
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        event.preventDefault();
        const next = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY,
        );
        if (pinchDistance > 0) cameraDistance = THREE.MathUtils.clamp(cameraDistance + (pinchDistance - next) * 0.018, 4.0, 17.0);
        pinchDistance = next;
      }
    };
    const onTouchEnd = () => { pinchDistance = 0; };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.008, 3.8, 18.0);
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
    window.addEventListener('religion:action', onWorldAction as EventListener);
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('touchstart', onTouchStart, { passive: true });
    host.addEventListener('touchmove', onTouchMove, { passive: false });
    host.addEventListener('touchend', onTouchEnd);
    host.addEventListener('wheel', onWheel, { passive: false });

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.04);

      const keyboardForward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const keyboardSideways = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const forward = keyboardForward - joystickY;
      const sideways = keyboardSideways + joystickX;
      const manualMoving = Math.abs(forward) + Math.abs(sideways) > 0.08;
      const oldX = avatar.position.x, oldZ = avatar.position.z;
      let moveX = 0, moveZ = 0, moving = false;
      if (manualMoving) {
        movementTarget = null; pendingSeat = null; pendingAction = null;
        if (isSitting) standUp();
        const length = Math.hypot(forward, sideways) || 1;
        const f = forward / length, side = sideways / length;
        moveX = Math.sin(yaw) * f + Math.cos(yaw) * side;
        moveZ = -Math.cos(yaw) * f + Math.sin(yaw) * side;
        moving = true;
      } else if (movementTarget && !isSitting) {
        const diffX = movementTarget.x - oldX, diffZ = movementTarget.z - oldZ;
        const distance = Math.hypot(diffX,diffZ);
        if (distance > 0.34) {
          moveX = diffX / distance; moveZ = diffZ / distance; moving = true;
        } else {
          movementTarget = null;
          if (pendingSeat !== null) {
            const index = pendingSeat, seat = seatSpots[index];
            occupiedSeats.add(index); currentSeat = index; pendingSeat = null;
            avatar.position.set(seat.x,0.2,seat.z+0.2);
            avatar.rotation.y = 0; isSitting = true;
            gesture.current = 'sit'; gestureAt.current = performance.now();
            setActionNotice('비어 있던 자리에 앉았습니다. 이동하면 다시 일어납니다.');
          } else if (pendingAction === 'prayer') {
            pendingAction = null; avatar.rotation.y = -Math.PI/2;
            gesture.current = 'prayer'; gestureAt.current = performance.now();
            setActionNotice('성모님 앞에서 두 손을 모아 기도합니다.');
          }
        }
      }
      if (moving) {
        const nx = THREE.MathUtils.clamp(oldX + moveX*delta*4.3,worldBounds.minX,worldBounds.maxX);
        const nz = THREE.MathUtils.clamp(oldZ + moveZ*delta*4.3,worldBounds.minZ,worldBounds.maxZ);
        if (!collides(nx,oldZ)) avatar.position.x = nx;
        if (!collides(avatar.position.x,nz)) avatar.position.z = nz;
        avatar.rotation.y = Math.atan2(moveX,-moveZ);
      }

      const gait = moving ? Math.sin(clock.elapsedTime*11.5)*0.5 : 0;
      if (gesture.current !== 'sit') {
        leftLeg.rotation.x = gait; rightLeg.rotation.x = -gait;
      }
      leftArm.rotation.x = -gait*0.42; rightArm.rotation.x = gait*0.42;
      leftArm.rotation.z = 0; rightArm.rotation.z = 0; head.rotation.x = 0;

      if (gesture.current === 'sit') {
        avatar.position.y = 0.2;
        leftLeg.rotation.x = -0.95; rightLeg.rotation.x = -0.95;
        leftArm.rotation.x = -0.18; rightArm.rotation.x = -0.18;
        head.rotation.x = 0.08;
      } else if (gesture.current === 'rosary') {
        leftArm.rotation.x = -0.92; rightArm.rotation.x = -0.92;
        leftArm.rotation.z = 0.18; rightArm.rotation.z = -0.18;
        head.rotation.x = 0.12; rosary.visible = true;
        rosary.rotation.z = Math.sin(clock.elapsedTime*1.4)*0.035;
        rosaryBeadMaterial.emissiveIntensity = 0.12 + Math.sin(clock.elapsedTime*2.2)*0.05;
      } else if (gesture.current !== 'idle') {
        const duration = gesture.current === 'dip' ? 950 : gesture.current === 'cross' ? 1350 :
          gesture.current === 'prayer' ? 2300 : gesture.current === 'bow' ? 1100 : 1550;
        const progress = Math.min(1,(performance.now()-gestureAt.current)/duration);
        const pulse = Math.sin(progress*Math.PI);
        if (gesture.current === 'dip') {
          leftArm.rotation.x = -1.2*pulse; leftArm.rotation.z = 0.58*pulse;
          head.rotation.x = 0.08*pulse;
        } else if (gesture.current === 'cross') {
          leftArm.rotation.x = -0.95*pulse-0.18; rightArm.rotation.x = -0.95*pulse-0.18;
          leftArm.rotation.z = 0.38*pulse; rightArm.rotation.z = -0.38*pulse;
        } else if (gesture.current === 'prayer') {
          leftArm.rotation.x = -0.86*pulse-0.22; rightArm.rotation.x = -0.86*pulse-0.22;
          leftArm.rotation.z = 0.2*pulse; rightArm.rotation.z = -0.2*pulse;
          head.rotation.x = 0.22*pulse;
        } else if (gesture.current === 'bow') {
          head.rotation.x = 0.42*pulse; avatar.position.y = -0.035*pulse;
          leftArm.rotation.x = -0.12*pulse; rightArm.rotation.x = -0.12*pulse;
        } else if (gesture.current === 'greet') {
          rightArm.rotation.x = -1.0*pulse;
          rightArm.rotation.z = -0.4*pulse + Math.sin(progress*Math.PI*8)*0.15*pulse;
          leftArm.rotation.x = -0.08*pulse;
        }
        if (progress >= 1) {
          gesture.current = 'idle'; avatar.position.y = 0; rosary.visible = false;
        }
      } else if (!isSitting) {
        avatar.position.y = 0; rosary.visible = false;
      }

      const followHeight = 2.15 + pitch * 2.6;
      cameraTarget.set(
        avatar.position.x - Math.sin(yaw) * cameraDistance,
        followHeight + Math.max(0, cameraDistance - 5.8) * 0.16,
        avatar.position.z + Math.cos(yaw) * cameraDistance,
      );
      camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 8));
      lookTarget.set(avatar.position.x, 1.25 + pitch * 0.55, avatar.position.z - 0.25);
      camera.lookAt(lookTarget);

      const fontDistance = Math.hypot(avatar.position.x + 2.2, avatar.position.z - 12);
      const near = fontDistance < 2.2;
      if (near !== lastNearFont) {
        lastNearFont = near;
        setNearFont(near);
      }
      const maryDistance = Math.hypot(avatar.position.x - 13.15, avatar.position.z - 49.5);
      const nearShrine = maryDistance < 4.2;
      if (nearShrine !== lastNearMary) {
        lastNearMary = nearShrine;
        setNearMary(nearShrine);
      }
      (fontHalo.material as THREE.MeshBasicMaterial).opacity = near ? 0.9 : 0.38;
      fontLight.intensity = near ? 2.5 : 1.3;
      waterSurface.rotation.z = Math.sin(clock.elapsedTime * 0.9) * 0.018;
      fountainWater.position.y = 2.05 + Math.sin(clock.elapsedTime * 1.6) * 0.035;
      renderer.render(scene, camera);
    };
    onResize();
    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('religion:joystick', onJoystick as EventListener);
      window.removeEventListener('religion:action', onWorldAction as EventListener);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('touchstart', onTouchStart);
      host.removeEventListener('touchmove', onTouchMove);
      host.removeEventListener('touchend', onTouchEnd);
      host.removeEventListener('wheel', onWheel);
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      loadedTextures.forEach(texture => texture.dispose());
      labelTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [displayName]);

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
  const dispatchWorldAction = (action: string) =>
    window.dispatchEvent(new CustomEvent('religion:action', { detail: action }));
  const dispatchJoystick = (x: number, y: number) =>
    window.dispatchEvent(new CustomEvent('religion:joystick', { detail: { x, y } }));
  const updateJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width * 0.33;
    let x = (event.clientX - (rect.left + rect.width/2)) / radius;
    let y = (event.clientY - (rect.top + rect.height/2)) / radius;
    const length = Math.hypot(x,y);
    if (length > 1) { x /= length; y /= length; }
    setJoystickOffset({ x:x*radius, y:y*radius });
    dispatchJoystick(x,y);
  };
  const stopJoystick = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event) event.preventDefault();
    setJoystickOffset({x:0,y:0});
    dispatchJoystick(0,0);
  };

  return (
    <div className="immersive-avatar-stage">
      <div ref={hostRef} className="immersive-avatar-canvas" aria-label="하나로 이어진 3D 성당과 정원. WASD 또는 방향키로 이동하고, 클릭이나 터치로 목적지를 지정하세요." />
      {nearFont && step !== 'done' ? (
        <div className="holy-water-actions" role="group" aria-label="성수대 액션">
          <span aria-hidden="true">{step === 'water' ? '✧' : '✝'}</span>
          {step === 'water'
            ? <button type="button" className="holy-water-primary" onClick={dip}>💧 성수 찍기</button>
            : <button type="button" className="holy-water-primary" onClick={sign}>성호 긋기</button>}
          <button type="button" className="holy-water-skip" onClick={() => setStep('done')}>건너뛰기</button>
        </div>
      ) : null}

      <div className="world-action-notice" role="status">
        {actionNotice}{nearMary ? ' · 성모님 기도처 근처' : ''}
      </div>
      <div className="world-action-bar" role="group" aria-label="주요 행동">
        <button type="button" onClick={() => dispatchWorldAction('cross')}>✝ 성호경</button>
        <button type="button" onClick={() => dispatchWorldAction('prayer')}>🙏 기도</button>
        <button type="button" onClick={() => dispatchWorldAction('bow')}>목례</button>
        <button type="button" onClick={() => dispatchWorldAction('greet')}>인사</button>
        <button type="button" onClick={() => dispatchWorldAction('seat')}>자리 앉기</button>
        <button type="button" onClick={() => dispatchWorldAction('rosary')}>📿 묵주기도</button>
        <button type="button" onClick={() => dispatchWorldAction('mary')}>{nearMary ? '성모님께 기도' : '성모님 기도처'}</button>
      </div>
      <div className="mobile-joystick" role="application" aria-label="모바일 이동 조이스틱"
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); updateJoystick(event); }}
        onPointerMove={event => { if (event.buttons > 0 || event.pressure > 0) updateJoystick(event); }}
        onPointerUp={stopJoystick} onPointerCancel={stopJoystick} onLostPointerCapture={stopJoystick}>
        <span className="mobile-joystick-direction mobile-joystick-up">▲</span>
        <span className="mobile-joystick-direction mobile-joystick-down">▼</span>
        <span className="mobile-joystick-direction mobile-joystick-left">◀</span>
        <span className="mobile-joystick-direction mobile-joystick-right">▶</span>
        <span className="mobile-joystick-knob" style={{transform:`translate(${joystickOffset.x}px, ${joystickOffset.y}px)`}} />
      </div>
      <div className="camera-touch-hint" aria-hidden="true">화면 드래그로 시점 변경 · 두 손가락 줌</div>
      <div className="world-asset-credit">
        석재·목재 PBR: Poly Haven CC0 ·
        <a href="https://commons.wikimedia.org/wiki/File:Cathedral_Interior_with_Stained_Glass_and_Altar_(55260745408).jpg" target="_blank" rel="noreferrer">성당 사진 Michael Gaylard · CC BY 4.0</a> ·
        <a href="https://commons.wikimedia.org/wiki/File:EstatuaGrutadeLourdes-MDP.jpg" target="_blank" rel="noreferrer">마리아상 사진 Ezarate · CC BY-SA 4.0</a>
      </div>
    </div>
  );
}
