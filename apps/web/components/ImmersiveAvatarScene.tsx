'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';

type Props = { displayName: string };
type Blocker = { x: number; z: number; rx: number; rz: number };

export default function ImmersiveAvatarScene({ displayName }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<'idle' | 'dip' | 'cross' | 'prayer' | 'bow' | 'greet' | 'rosary' | 'sit' | 'stand' | 'kneel'>('idle');
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
    scene.background = new THREE.Color('#8f9b91');
    scene.fog = new THREE.Fog('#8f9b91', 42, 105);

    const camera = new THREE.PerspectiveCamera(64, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 220);
    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor('#8f9b91', 1);
    host.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight('#eee3cf', '#343b32', 1.55);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#f5e2c4', 2.15);
    sun.position.set(-12, 19, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -40;
    sun.shadow.bias = -0.0003;
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#c4d0c1', 0.58);
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


    // Photo-scanned PBR stone from Poly Haven (CC0) for the cathedral masonry.
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    const stoneColorMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/stone_brick_wall_001/stone_brick_wall_001_diff_2k.jpg');
    const stoneNormalMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/stone_brick_wall_001/stone_brick_wall_001_nor_gl_2k.jpg');
    const stoneRoughnessMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/stone_brick_wall_001/stone_brick_wall_001_rough_2k.jpg');
    const loadedTextures: THREE.Texture[] = [stoneColorMap, stoneNormalMap, stoneRoughnessMap];
    [stoneColorMap, stoneNormalMap, stoneRoughnessMap].forEach(texture => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(12, 7);
    });
    stoneColorMap.colorSpace = THREE.SRGBColorSpace;
    // Actual photographs licensed for reuse: nave (CC BY-SA 4.0), grotto (CC BY 4.0),
    // marble floor (CC0), vaulted ceiling (CC0), and cathedral facade (CC BY-SA 4.0).
    const cathedralInteriorPhoto = textureLoader.load('https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Interior_of_St._Vitus_Cathedral%2C_Nave%2C_Prague_20160809_1.jpg/1280px-Interior_of_St._Vitus_Cathedral%2C_Nave%2C_Prague_20160809_1.jpg');
    const maryShrinePhoto = textureLoader.load('https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/The_Lourdes_Grotto.jpg/1280px-The_Lourdes_Grotto.jpg');
    const marbleFloorPhoto = textureLoader.load('https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Milan_Cathedral%2C_floor.jpg/1280px-Milan_Cathedral%2C_floor.jpg');
    const vaultedCeilingPhoto = textureLoader.load('https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Gloucester_Cathedral_Vaulted_Ceiling.jpg/1356px-Gloucester_Cathedral_Vaulted_Ceiling.jpg');
    const exteriorFacadePhoto = textureLoader.load('https://commons.wikimedia.org/wiki/Special:FilePath/Notre_Dame_Cathedral_Facade.jpg?width=1600');
    for (const texture of [cathedralInteriorPhoto, maryShrinePhoto, marbleFloorPhoto, vaultedCeilingPhoto, exteriorFacadePhoto]) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    loadedTextures.push(cathedralInteriorPhoto, maryShrinePhoto, marbleFloorPhoto, vaultedCeilingPhoto, exteriorFacadePhoto);

    const woodColorMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/wooden_planks/wooden_planks_diff_2k.jpg');
    const woodNormalMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/wooden_planks/wooden_planks_nor_gl_2k.jpg');
    const woodRoughnessMap = textureLoader.load('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/wooden_planks/wooden_planks_rough_2k.jpg');
    loadedTextures.push(woodColorMap, woodNormalMap, woodRoughnessMap);
    [woodColorMap, woodNormalMap, woodRoughnessMap].forEach(texture => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2.5, 1.5);
    });
    woodColorMap.colorSpace = THREE.SRGBColorSpace;


    const plaster = makeMat('#d7d0c0', 0.94, 0, makeNoiseTexture('#d7d0c0', 2, 4, 3));
    const darkPlaster = makeMat('#938d80', 0.94, 0, makeNoiseTexture('#938d80', 4, 3, 2));
    const darkStone = makeMat('#53564e', 0.91, 0, makeNoiseTexture('#53564e', 18, 3, 2));
    const floorStone = makeMat('#ffffff', 0.88, 0, marbleFloorPhoto);
    marbleFloorPhoto.wrapS = marbleFloorPhoto.wrapT = THREE.ClampToEdgeWrapping;
    marbleFloorPhoto.center.set(0.5, 0.5);
    marbleFloorPhoto.rotation = Math.PI / 2;
    marbleFloorPhoto.repeat.set(1, 1);
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
    // One continuous high-resolution marble photograph replaces the repeated procedural floor tiles.
    addGroundPlane(world, 3.4, 40, aisleStone, 0, -0.045, -1);
    addGroundPlane(world, 5.4, 48, pathMat, 0, -0.035, 39);

    // CHURCH: long nave, side aisles, side walls and vaulted ceiling.
    addBox(world, 29.0, 0.65, 42, darkPlaster, 0, 22.15, -1);
    const ceilingPhotoMaterial = new THREE.MeshStandardMaterial({
      map: vaultedCeilingPhoto,
      roughness: 0.96,
      side: THREE.DoubleSide,
    });
    const ceilingPhotoPlane = addMesh(world, new THREE.PlaneGeometry(28.4, 41.2), ceilingPhotoMaterial, 0, 21.79, -1, false, false);
    ceilingPhotoPlane.rotation.x = Math.PI / 2;
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


    // Real cathedral facade photograph as the distant exterior vista beyond the garden.
    const exteriorFacadeMaterial = new THREE.MeshStandardMaterial({
      map: exteriorFacadePhoto,
      roughness: 0.94,
      side: THREE.DoubleSide,
    });
    const exteriorFacadeBackdrop = addMesh(world, new THREE.PlaneGeometry(46, 32), exteriorFacadeMaterial, 0, 16, 75, false, false);

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
    // Monumental crucifix with a sculpted corpus at the visual center of the sanctuary.
    addBox(world, 0.34, 8.4, 0.24, darkWood, 0, 8.5, -21.05);
    addBox(world, 3.25, 0.34, 0.26, darkWood, 0, 10.15, -21.05);
    const corpusSkin = makeMat('#c6a18b', 0.72, 0.02);
    const corpusHair = makeMat('#342a26', 0.9);
    const corpusBody = addMesh(world, new THREE.CapsuleGeometry(0.28, 1.02, 6, 14), corpusSkin, 0, 8.45, -20.72);
    corpusBody.scale.set(0.82, 1.0, 0.52);
    addMesh(world, new THREE.SphereGeometry(0.22, 18, 14), corpusSkin, 0, 9.45, -20.70);
    addMesh(world, new THREE.SphereGeometry(0.235, 18, 12), corpusHair, 0, 9.55, -20.76).scale.set(1, 0.55, 0.9);
    const corpusLeftArm = addMesh(world, new THREE.CapsuleGeometry(0.105, 0.88, 5, 10), corpusSkin, -0.78, 9.02, -20.72);
    corpusLeftArm.rotation.z = Math.PI / 2;
    const corpusRightArm = addMesh(world, new THREE.CapsuleGeometry(0.105, 0.88, 5, 10), corpusSkin, 0.78, 9.02, -20.72);
    corpusRightArm.rotation.z = -Math.PI / 2;
    const corpusLeftLeg = addMesh(world, new THREE.CapsuleGeometry(0.105, 0.62, 5, 10), corpusSkin, -0.13, 7.35, -20.71);
    corpusLeftLeg.rotation.z = -0.08;
    const corpusRightLeg = addMesh(world, new THREE.CapsuleGeometry(0.105, 0.62, 5, 10), corpusSkin, 0.13, 7.35, -20.71);
    corpusRightLeg.rotation.z = 0.08;
    addMesh(world, new THREE.TorusGeometry(0.28, 0.025, 8, 32), trim, 0, 9.55, -20.62).rotation.x = Math.PI / 2;
    addBlocker(0, -17.1, 6.1, 3.0);
    const sanctuaryLamp = new THREE.PointLight('#ff5b3d', 0.9, 5, 2);
    sanctuaryLamp.position.set(1.25, 3.4, -18.8);
    world.add(sanctuaryLamp);
    const sanctuaryGlow = new THREE.PointLight('#f4d9ad', 1.35, 19, 2);
    sanctuaryGlow.position.set(0, 8.2, -15.2);
    world.add(sanctuaryGlow);
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
        // The backrest blocks passage; the raised seat surface remains available for sitting.
        addBlocker(x, z + 0.42, 1.8, 0.12);
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
        if (!(side === 1 && z === 50)) {
          addBox(world, 0.65, 4.2, 0.65, stone, x, 2.1, z, true);
        }
        addBox(world, 4.5, 0.3, 0.6, trim, x - side * 1.8, 4.35, z);
      }
      // Leave a clear opening in the east cloister wall so the Marian grotto is visible.
      addBox(world, 0.6, 4.1, 22, plaster, side * 15.9, 2.05, 33, true);
      addBox(world, 0.6, 4.1, 8, plaster, side * 15.9, 2.05, 58, true);
    }

    // Garden beds, trees, flower borders, benches and lamps.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i += 1) {
        const x = side * (7.6 + (i % 2) * 2.4);
        const z = 25 + i * 6.1;
        addBox(world, 3.5, 0.35, 3.0, darkStone, x, 0.16, z);
        addBox(world, 3.3, 0.16, 2.8, greenery, x, 0.38, z);
        addBlocker(x, z, 1.75, 1.5);
        for (let k = 0; k < 14; k += 1) {
          const px = x + ((k % 4) - 1.5) * 0.6;
          const pz = z + (Math.floor(k / 4) - 1.5) * 0.55;
          const flowerColor = ['#e3c4b7', '#e9d59d', '#d1c4df', '#fff0de'][k % 4];
          addMesh(world, new THREE.SphereGeometry(0.14, 10, 8), makeMat(flowerColor, 0.8), px, 0.72, pz, false, false);
        }
        addCylinder(world, 0.22, 0.32, 3.6, makeMat('#67513a'), side * (10.8 + (i % 2) * 1.1), 1.8, z, 12, true);
        const treeX = side * (10.8 + (i % 2) * 1.1);
        addBlocker(treeX, z, 1.55, 1.55);
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
      new THREE.PlaneGeometry(2.2, 2.65),
      new THREE.MeshStandardMaterial({ map: maryShrinePhoto, roughness: 0.96, side: THREE.DoubleSide })
    );
    maryImage.position.set(0.35, 2.55, 0);
    maryImage.rotation.y = -Math.PI / 2;
    maryGrotto.add(maryImage);

    // Volumetric Marian sculpture: carved robe, blue mantle, veil, face and joined hands.
    const maryStatue = new THREE.Group();
    maryStatue.position.set(-0.82, 0, 0);
    maryStatue.rotation.y = Math.PI / 2;
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
    // A readable sign and warm beacon make the shrine easy to spot from the central path.
    const marySignCanvas = document.createElement('canvas');
    marySignCanvas.width = 512;
    marySignCanvas.height = 128;
    const marySignContext = marySignCanvas.getContext('2d');
    if (marySignContext) {
      marySignContext.fillStyle = 'rgba(27, 30, 26, 0.88)';
      marySignContext.beginPath();
      marySignContext.roundRect(8, 8, 496, 112, 22);
      marySignContext.fill();
      marySignContext.strokeStyle = '#d9bd83';
      marySignContext.lineWidth = 4;
      marySignContext.stroke();
      marySignContext.textAlign = 'center';
      marySignContext.textBaseline = 'middle';
      marySignContext.fillStyle = '#f3e7cf';
      marySignContext.font = 'bold 38px serif';
      marySignContext.fillText('성모 마리아 기도처', 256, 49);
      marySignContext.fillStyle = '#d9bd83';
      marySignContext.font = '22px sans-serif';
      marySignContext.fillText('MARY SHRINE', 256, 91);
    }
    const marySignTexture = new THREE.CanvasTexture(marySignCanvas);
    marySignTexture.colorSpace = THREE.SRGBColorSpace;
    const marySign = new THREE.Sprite(new THREE.SpriteMaterial({ map: marySignTexture, transparent: true, depthWrite: false }));
    marySign.scale.set(2.55, 0.64, 1);
    marySign.position.set(14.15, 5.05, 49.5);
    world.add(marySign);
    const maryBeacon = new THREE.PointLight('#f4d39b', 1.0, 7.5, 2);
    maryBeacon.position.set(14.15, 4.0, 49.5);
    world.add(maryBeacon);

    addBlocker(16.4, 49.5, 1.75, 1.2);
    addBlocker(14.35, 49.5, 0.2, 0.95);

    // A real cathedral photograph is presented as a framed architectural reference panel
    // mounted on the side-aisle wall, integrated into the surrounding 3D masonry.
    // Large real nave photograph on the sanctuary rear wall; 3D altar and crucifix remain in front.
    const cathedralPhotoPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(13.8, 10.6),
      new THREE.MeshStandardMaterial({ map: cathedralInteriorPhoto, roughness: 0.96, side: THREE.DoubleSide })
    );
    cathedralPhotoPanel.position.set(0, 9.2, -21.54);
    world.add(cathedralPhotoPanel);

    // Wooden benches and warm low garden lamps.
    for (const x of [-6.7, 7.1]) {
      addBox(world, 2.2, 0.18, 0.62, wood, x, 0.75, 33.2, true);
      addBox(world, 2.2, 0.82, 0.14, wood, x, 1.18, 33.5, true);
      const lantern = new THREE.Group();
      lantern.position.set(x, 0, 28.5);
      world.add(lantern);
      addBlocker(x, 28.5, 0.25, 0.25);
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
    addBlocker(-7.2, 45, 2.2, 3.2);

    // A small outdoor chapel is visible farther down the same continuous path.
    addBox(world, 6.8, 4.8, 4.8, plaster, 0, 2.4, 59, true);
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
    const torso = avatarPart(new THREE.CapsuleGeometry(0.31, 0.66, 5, 12), coat, 0, 1.34, 0);
    avatarPart(new THREE.CylinderGeometry(0.1, 0.11, 0.18, 12), skin, 0, 1.85, 0);
    const head = avatarPart(new THREE.SphereGeometry(0.235, 28, 20), skin, 0, 2.08, -0.02);
    head.scale.set(0.92, 1.08, 0.95);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58), hair);
    hairCap.position.set(0, 0.08, 0.03);
    hairCap.scale.set(1.02, 0.88, 1.03);
    head.add(hairCap);
    const facePart = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      head.add(mesh);
      return mesh;
    };
    const fringe = facePart(new THREE.SphereGeometry(0.16, 20, 12), hair, 0, 0.17, -0.095);
    fringe.scale.set(1.08, 0.38, 0.54);
    const faceWhite = makeMat('#f4eee5', 0.34);
    const iris = makeMat('#554036', 0.36);
    const pupil = makeMat('#191a18', 0.26);
    const lip = makeMat('#986d60', 0.68);
    for (const side of [-1, 1]) {
      const eye = facePart(new THREE.SphereGeometry(0.035, 16, 12), faceWhite, side * 0.083, 0.025, -0.198);
      eye.scale.set(1, 0.62, 0.38);
      const irisMesh = facePart(new THREE.SphereGeometry(0.018, 14, 10), iris, side * 0.083, 0.024, -0.212);
      irisMesh.scale.set(0.9, 1, 0.5);
      facePart(new THREE.SphereGeometry(0.009, 12, 8), pupil, side * 0.083, 0.024, -0.219);
      const brow = facePart(new THREE.CapsuleGeometry(0.012, 0.055, 3, 8), hair, side * 0.083, 0.078, -0.19);
      brow.rotation.z = side * -0.1;
      brow.rotation.x = Math.PI / 2;
      const ear = facePart(new THREE.SphereGeometry(0.065, 14, 10), skin, side * 0.218, -0.02, 0.015);
      ear.scale.set(0.38, 0.72, 0.62);
    }
    const nose = facePart(new THREE.SphereGeometry(0.038, 14, 10), skin, 0, -0.035, -0.225);
    nose.scale.set(0.72, 0.9, 0.62);
    const mouth = facePart(new THREE.SphereGeometry(0.035, 14, 10), lip, 0, -0.09, -0.199);
    mouth.scale.set(1.0, 0.24, 0.25);
    avatarPart(new THREE.BoxGeometry(0.42, 0.55, 0.17), bag, 0, 1.33, 0.275);


    const makeArm = (x: number, side: -1 | 1) => {
      const upper = new THREE.Group();
      upper.position.set(x, 1.64, 0);
      avatar.add(upper);
      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.22, 5, 10), coatShadow);
      upperArm.position.y = -0.16;
      upperArm.castShadow = true;
      upper.add(upperArm);
      const forearm = new THREE.Group();
      forearm.position.y = -0.31;
      upper.add(forearm);
      const lowerArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.25, 5, 10), coatShadow);
      lowerArm.position.y = -0.16;
      lowerArm.castShadow = true;
      forearm.add(lowerArm);
      const hand = new THREE.Group();
      hand.position.set(0, -0.32, -0.015);
      forearm.add(hand);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), skin);
      palm.scale.set(0.78, 0.62, 0.42);
      palm.position.y = -0.025;
      hand.add(palm);
      const fingers: THREE.Group[] = [];
      for (let finger = 0; finger < 4; finger += 1) {
        const width = (finger - 1.5) * 0.044;
        const length = [0.13, 0.16, 0.15, 0.12][finger];
        const joint = new THREE.Group();
        joint.position.set(width, -0.055, -0.005);
        hand.add(joint);
        const digit = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, length, 3, 8), skin);
        digit.position.y = -length * 0.43;
        digit.rotation.z = (finger - 1.5) * 0.055;
        digit.castShadow = true;
        joint.add(digit);
        fingers.push(joint);
      }
      const thumb = new THREE.Group();
      thumb.position.set(side * 0.105, -0.055, -0.012);
      hand.add(thumb);
      const thumbDigit = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.105, 3, 8), skin);
      thumbDigit.position.y = -0.055;
      thumbDigit.rotation.z = side * -0.72;
      thumbDigit.castShadow = true;
      thumb.add(thumbDigit);
      return { upper, forearm, hand, fingers, thumb };
    };
    const leftArmRig = makeArm(-0.39, -1);
    const rightArmRig = makeArm(0.39, 1);
    const leftArm = leftArmRig.upper;
    const rightArm = rightArmRig.upper;
    const leftForearm = leftArmRig.forearm;
    const rightForearm = rightArmRig.forearm;
    const leftHand = leftArmRig.hand;
    const rightHand = rightArmRig.hand;
    const leftFingers = leftArmRig.fingers;
    const rightFingers = rightArmRig.fingers;
    const leftThumb = leftArmRig.thumb;
    const rightThumb = rightArmRig.thumb;

    const makeLeg = (x: number) => {
      const hip = new THREE.Group();
      hip.position.set(x, 0.88, 0);
      avatar.add(hip);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.3, 5, 10), trousers);
      thigh.position.y = -0.19;
      thigh.castShadow = true;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -0.39;
      hip.add(knee);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.27, 5, 10), trousers);
      shin.position.y = -0.17;
      shin.castShadow = true;
      knee.add(shin);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.38), shoes);
      shoe.position.set(0, -0.34, -0.075);
      shoe.castShadow = true;
      knee.add(shoe);
      return { hip, knee };
    };
    const leftLegRig = makeLeg(-0.16);
    const rightLegRig = makeLeg(0.16);
    const leftLeg = leftLegRig.hip;
    const rightLeg = rightLegRig.hip;
    const leftKnee = leftLegRig.knee;
    const rightKnee = rightLegRig.knee;


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

    // Five-decade rosary: 50 small beads, five larger decade beads,
    // three introductory beads, a centerpiece medal and a crucifix.
    const rosary = new THREE.Group();
    rosary.position.set(0, 1.32, -0.44);
    rosary.visible = false;
    avatar.add(rosary);
    const rosaryBeadMaterial = new THREE.MeshStandardMaterial({
      color: '#e6d6bb', roughness: 0.3, metalness: 0.12, emissive: '#493c2a', emissiveIntensity: 0.06,
    });
    const rosaryLargeBeadMaterial = new THREE.MeshStandardMaterial({
      color: '#c8aa72', roughness: 0.28, metalness: 0.48,
    });
    const rosaryCordMaterial = makeMat('#6d5a42', 0.85, 0);
    const ringPoints: THREE.Vector3[] = [];
    const ringCount = 55; // 50 small Hail Mary beads + five larger decade beads
    for (let i = 0; i <= ringCount; i += 1) {
      const angle = (Math.PI * 2 * i) / ringCount;
      ringPoints.push(new THREE.Vector3(Math.cos(angle) * 0.235, Math.sin(angle) * 0.155 + 0.015, 0));
    }
    const ringCurve = new THREE.CatmullRomCurve3(ringPoints);
    rosary.add(new THREE.Mesh(new THREE.TubeGeometry(ringCurve, 120, 0.012, 6, false), rosaryCordMaterial));
    for (let i = 0; i < ringCount; i += 1) {
      const angle = (Math.PI * 2 * i) / ringCount;
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 10, 8),
        i % 11 === 0 ? rosaryLargeBeadMaterial : rosaryBeadMaterial,
      );
      bead.position.set(Math.cos(angle) * 0.235, Math.sin(angle) * 0.155 + 0.015, 0);
      bead.scale.setScalar(i % 11 === 0 ? 1.38 : 1);
      rosary.add(bead);
    }
    for (let i = 0; i < 3; i += 1) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.027, 10, 8), rosaryBeadMaterial);
      bead.position.set(0, -0.13 - i * 0.075, 0);
      rosary.add(bead);
    }
    const centerpiece = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 14, 10),
      new THREE.MeshStandardMaterial({ color: '#d6bd8d', roughness: 0.3, metalness: 0.32 }),
    );
    centerpiece.position.set(0, -0.39, 0);
    centerpiece.scale.set(0.78, 1.18, 0.5);
    rosary.add(centerpiece);
    const rosaryCross = new THREE.Group();
    rosaryCross.position.set(0, -0.54, 0);
    rosary.add(rosaryCross);
    addMesh(rosaryCross, new THREE.BoxGeometry(0.052, 0.27, 0.035), rosaryLargeBeadMaterial, 0, 0, 0, false, false);
    addMesh(rosaryCross, new THREE.BoxGeometry(0.18, 0.048, 0.035), rosaryLargeBeadMaterial, 0, 0.055, 0, false, false);



    // Available seats are reserved locally for the current visitor.
    const seatSpots: THREE.Vector3[] = [];
    for (const z of [-9.7, -6.2, -2.7, 0.8, 4.3, 7.8]) {
      for (const sideX of [-4.25, 4.25]) {
        for (const offset of [-0.7, 0, 0.7]) seatSpots.push(new THREE.Vector3(sideX + offset, 0, z - 0.12));
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
    let yaw = 0, pitch = 0.08, cameraDistance = 3.8;
    let pointerDown = false, pointerMoved = false, pointerTouch = false;
    let lastX = 0, lastY = 0, downX = 0, downY = 0;
    let pinchDistance = 0, joystickX = 0, joystickY = 0;
    let movementTarget: THREE.Vector3 | null = null;
    let movementPath: THREE.Vector3[] = [];
    let pendingSeat: number | null = null, currentSeat: number | null = null;
    let pendingAction: 'prayer' | 'kneel' | null = null;
    let pendingGesture: 'cross' | 'prayer' | 'bow' | 'greet' | 'rosary' | null = null;
    let isSitting = false, frame = 0;
    let lastNearFont = false, lastNearMary = false;
    const clock = new THREE.Clock();
    const cameraTarget = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const walkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const worldBounds = { minX: -19.5, maxX: 19.5, minZ: -22.5, maxZ: 66 };

    // Grid A* navigation keeps click-to-move and action destinations out of solid scenery.
    const findPath = (startX: number, startZ: number, goalX: number, goalZ: number): THREE.Vector3[] => {
      const cell = 0.75;
      const minX = worldBounds.minX, minZ = worldBounds.minZ;
      const cols = Math.ceil((worldBounds.maxX - minX) / cell) + 1;
      const rows = Math.ceil((worldBounds.maxZ - minZ) / cell) + 1;
      const total = cols * rows;
      const toIndex = (ix: number, iz: number) => iz * cols + ix;
      const coords = (index: number) => ({ ix: index % cols, iz: Math.floor(index / cols) });
      const pointAt = (ix: number, iz: number) => ({ x: minX + ix * cell, z: minZ + iz * cell });
      const isBlocked = (ix: number, iz: number) => {
        if (ix < 0 || iz < 0 || ix >= cols || iz >= rows) return true;
        const point = pointAt(ix, iz);
        return collides(point.x, point.z);
      };
      const nearestFree = (x: number, z: number) => {
        const cx = THREE.MathUtils.clamp(Math.round((x - minX) / cell), 0, cols - 1);
        const cz = THREE.MathUtils.clamp(Math.round((z - minZ) / cell), 0, rows - 1);
        if (!isBlocked(cx, cz)) return { ix: cx, iz: cz };
        for (let radius = 1; radius <= 10; radius += 1) {
          for (let dz = -radius; dz <= radius; dz += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
              if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
              if (!isBlocked(cx + dx, cz + dz)) return { ix: cx + dx, iz: cz + dz };
            }
          }
        }
        return null;
      };
      const start = nearestFree(startX, startZ);
      const goal = nearestFree(goalX, goalZ);
      if (!start || !goal) return [];
      const startIndex = toIndex(start.ix, start.iz);
      const goalIndex = toIndex(goal.ix, goal.iz);
      if (startIndex === goalIndex) {
        const goalPoint = pointAt(goal.ix, goal.iz);
        return [new THREE.Vector3(goalPoint.x, 0, goalPoint.z)];
      }
      const gScore = new Float64Array(total);
      gScore.fill(Number.POSITIVE_INFINITY);
      const parent = new Int32Array(total);
      parent.fill(-1);
      const closed = new Uint8Array(total);
      const heap: Array<{ index: number; score: number }> = [];
      const pushHeap = (index: number, score: number) => {
        let at = heap.length;
        heap.push({ index, score });
        while (at > 0) {
          const parentAt = Math.floor((at - 1) / 2);
          if (heap[parentAt].score <= score) break;
          heap[at] = heap[parentAt];
          at = parentAt;
        }
        heap[at] = { index, score };
      };
      const popHeap = () => {
        const first = heap[0];
        const last = heap.pop();
        if (heap.length && last) {
          let at = 0;
          while (true) {
            const left = at * 2 + 1, right = left + 1;
            if (left >= heap.length) break;
            const child = right < heap.length && heap[right].score < heap[left].score ? right : left;
            if (heap[child].score >= last.score) break;
            heap[at] = heap[child];
            at = child;
          }
          heap[at] = last;
        }
        return first?.index ?? -1;
      };
      const heuristic = (ix: number, iz: number) => {
        const dx = Math.abs(ix - goal.ix), dz = Math.abs(iz - goal.iz);
        return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
      };
      gScore[startIndex] = 0;
      pushHeap(startIndex, heuristic(start.ix, start.iz));
      let found = false;
      let iterations = 0;
      while (heap.length && iterations < total * 2) {
        iterations += 1;
        const current = popHeap();
        if (current < 0 || closed[current]) continue;
        if (current === goalIndex) { found = true; break; }
        closed[current] = 1;
        const { ix, iz } = coords(current);
        for (let dz = -1; dz <= 1; dz += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dz === 0) continue;
            const nx = ix + dx, nz = iz + dz;
            if (isBlocked(nx, nz)) continue;
            if (dx !== 0 && dz !== 0 && (isBlocked(ix + dx, iz) || isBlocked(ix, iz + dz))) continue;
            const next = toIndex(nx, nz);
            if (closed[next]) continue;
            const tentative = gScore[current] + (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1);
            if (tentative >= gScore[next]) continue;
            gScore[next] = tentative;
            parent[next] = current;
            pushHeap(next, tentative + heuristic(nx, nz));
          }
        }
      }
      if (!found) return [];
      const indices: number[] = [];
      let cursor = goalIndex;
      while (cursor !== startIndex && cursor >= 0) {
        indices.push(cursor);
        cursor = parent[cursor];
      }
      indices.reverse();
      const pathPoints = indices.map(index => {
        const { ix, iz } = coords(index);
        const point = pointAt(ix, iz);
        return new THREE.Vector3(point.x, 0, point.z);
      });
      if (pathPoints.length <= 2) return pathPoints;
      const turns: THREE.Vector3[] = [];
      let previousDx = Math.sign(pathPoints[0].x - startX);
      let previousDz = Math.sign(pathPoints[0].z - startZ);
      for (let i = 1; i < pathPoints.length; i += 1) {
        const dx = Math.sign(pathPoints[i].x - pathPoints[i - 1].x);
        const dz = Math.sign(pathPoints[i].z - pathPoints[i - 1].z);
        if (dx !== previousDx || dz !== previousDz) turns.push(pathPoints[i - 1]);
        previousDx = dx;
        previousDz = dz;
      }
      turns.push(pathPoints[pathPoints.length - 1]);
      return turns;
    };

    const setRoute = (goalX: number, goalZ: number) => {
      const route = findPath(avatar.position.x, avatar.position.z, goalX, goalZ);
      movementTarget = route[0] ?? null;
      movementPath = route.slice(1);
      return route.length > 0;
    };

    const standUp = () => {
      if (currentSeat !== null) occupiedSeats.delete(currentSeat);
      currentSeat = null;
      isSitting = false;
      gesture.current = 'stand';
      gestureAt.current = performance.now();
      rosary.visible = false;
    };
    const setWalkTarget = (clientX: number, clientY: number) => {
      const wasSitting = isSitting;
      if (wasSitting) standUp();
      const rect = host.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      const point = raycaster.ray.intersectPlane(walkPlane, new THREE.Vector3());
      if (!point) return;
      const goalX = THREE.MathUtils.clamp(point.x, worldBounds.minX, worldBounds.maxX);
      const goalZ = THREE.MathUtils.clamp(point.z, worldBounds.minZ, worldBounds.maxZ);
      setRoute(goalX, goalZ);
      pendingSeat = null;
      pendingAction = null;
      pendingGesture = null;
      if (!wasSitting) gesture.current = 'idle';
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
      try { host.setPointerCapture(event.pointerId); } catch { /* Pointer capture can be unavailable on older browsers. */ }
      downX = lastX = event.clientX;
      downY = lastY = event.clientY;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown) return;
      const dx = event.clientX - lastX, dy = event.clientY - lastY;
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 7) pointerMoved = true;
      if (pointerMoved) {
        yaw += dx * (pointerTouch ? 0.009 : 0.0075);
        // Dragging downward raises the avatar's view toward the vault; the camera never dips below the floor.
        pitch = THREE.MathUtils.clamp(pitch + dy * (pointerTouch ? 0.0065 : 0.0058), -0.34, 1.22);
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
        movementTarget = null; movementPath = []; pendingSeat = null; pendingAction = null; pendingGesture = null;
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
        pendingGesture = null;
        const routed = setRoute(free[0].position.x, free[0].position.z);
        if (!routed) { pendingSeat = null; setActionNotice('자리까지 이동할 수 있는 통로를 찾지 못했습니다.'); return; }
        gesture.current = 'idle'; rosary.visible = false;
        setActionNotice('가장 가까운 빈자리를 찾아 이동합니다.');
        return;
      }
      if (action === 'mary') {
        const wasSitting = isSitting;
        if (wasSitting) standUp();
        pendingSeat = null; pendingGesture = null; pendingAction = 'kneel';
        const routed = setRoute(13.15, 49.5);
        if (!routed) {
          pendingAction = null;
          setActionNotice('성모상까지 이어지는 통로를 찾지 못했습니다.');
          return;
        }
        if (!wasSitting) gesture.current = 'idle';
        rosary.visible = false;
        setActionNotice('정원에 있는 성모 마리아 기도처로 이동합니다.');
        return;
      }
      if (action === 'rosary') {
        if (gesture.current === 'rosary') {
          pendingGesture = null;
          gesture.current = 'idle'; rosary.visible = false;
          setActionNotice('묵주기도를 마쳤습니다.');
        } else {
          if (isSitting) {
            standUp();
            pendingGesture = 'rosary';
            setActionNotice('천천히 일어난 뒤 묵주기도를 시작합니다.');
            return;
          }
          if (gesture.current === 'kneel') {
            avatar.position.y = 0;
            leftLeg.rotation.x = 0; rightLeg.rotation.x = 0;
            leftKnee.rotation.x = 0; rightKnee.rotation.x = 0;
          }
          movementTarget = null; movementPath = []; pendingSeat = null; pendingAction = null; pendingGesture = null;
          gesture.current = 'rosary'; gestureAt.current = performance.now();
          rosary.visible = true;
          setActionNotice('50개의 작은 묵주알과 다섯 개의 큰 묵주알을 따라 기도합니다. 다시 누르면 마칩니다.');
        }
        return;
      }
      if (action === 'prayer' && gesture.current === 'prayer') {
        gesture.current = 'idle';
        setActionNotice('기도를 마쳤습니다.');
        return;
      }
      if (isSitting) {
        standUp();
        pendingGesture = ['cross','prayer','bow','greet'].includes(action)
          ? action as 'cross' | 'prayer' | 'bow' | 'greet'
          : null;
        setActionNotice('먼저 자리에서 천천히 일어납니다.');
        return;
      }
      if (gesture.current === 'kneel') {
        avatar.position.y = 0;
        leftLeg.rotation.x = 0; rightLeg.rotation.x = 0;
        leftKnee.rotation.x = 0; rightKnee.rotation.x = 0;
      }
      movementTarget = null; movementPath = []; pendingSeat = null; pendingAction = null; pendingGesture = null;
      rosary.visible = false;
      if (['cross','prayer','bow','greet'].includes(action)) {
        gesture.current = action as 'cross'|'prayer'|'bow'|'greet';
        gestureAt.current = performance.now();
        const messages: Record<string,string> = {
          cross:'이마 → 가슴 → 왼쪽 어깨 → 오른쪽 어깨 순서로 성호경을 긋습니다.', prayer:'두 손을 모아 기도합니다.',
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
        if (pinchDistance > 0) cameraDistance = THREE.MathUtils.clamp(cameraDistance + (pinchDistance - next) * 0.018, 2.2, 15.0);
        pinchDistance = next;
      }
    };
    const onTouchEnd = () => { pinchDistance = 0; };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.008, 2.2, 15.0);
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
        movementTarget = null; movementPath = []; pendingSeat = null; pendingAction = null; pendingGesture = null;
        if (isSitting) {
          standUp();
        } else if (gesture.current !== 'idle' && gesture.current !== 'stand') {
          gesture.current = 'idle';
          avatar.position.y = 0;
          torso.rotation.x = 0;
          leftLeg.rotation.x = 0; rightLeg.rotation.x = 0;
          leftKnee.rotation.x = 0; rightKnee.rotation.x = 0;
          rosary.visible = false;
        }
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
          if (movementPath.length > 0) {
            movementTarget = movementPath.shift() ?? null;
          } else if (pendingSeat !== null) {
            const index = pendingSeat, seat = seatSpots[index];
            occupiedSeats.add(index); currentSeat = index; pendingSeat = null;
            avatar.position.set(seat.x,0,seat.z);
            avatar.rotation.y = 0; yaw = 0; isSitting = true;
            gesture.current = 'sit'; gestureAt.current = performance.now();
            setActionNotice('가까운 빈자리에 앉았습니다. 이동하면 천천히 일어납니다.');
          } else if (pendingAction) {
            const completedAction = pendingAction;
            pendingAction = null;
            avatar.rotation.y = Math.PI / 2;
            yaw = Math.PI / 2;
            gesture.current = completedAction;
            gestureAt.current = performance.now();
            setActionNotice(completedAction === 'kneel'
              ? '성모님 앞에 무릎을 꿇고 기도합니다.'
              : '성모님 앞에서 두 손을 모아 기도합니다.');
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
      if (gesture.current !== 'sit' && gesture.current !== 'kneel') {
        leftLeg.rotation.x = gait;
        rightLeg.rotation.x = -gait;
        leftKnee.rotation.x = Math.max(0, gait) * 0.34;
        rightKnee.rotation.x = Math.max(0, -gait) * 0.34;
      }
      leftArm.rotation.x = -gait*0.42; rightArm.rotation.x = gait*0.42;
      leftArm.rotation.z = 0; rightArm.rotation.z = 0;
      leftForearm.rotation.set(0,0,0); rightForearm.rotation.set(0,0,0);
      leftHand.rotation.set(0,0,0); rightHand.rotation.set(0,0,0);
      leftFingers.forEach(finger => finger.rotation.set(0,0,0));
      rightFingers.forEach(finger => finger.rotation.set(0,0,0));
      leftThumb.rotation.set(0,0,0); rightThumb.rotation.set(0,0,0);
      leftKnee.rotation.x = 0; rightKnee.rotation.x = 0;
      head.rotation.x = 0; torso.rotation.x = 0;


      if (gesture.current === 'sit') {
        const sitProgress = Math.min(1, (performance.now() - gestureAt.current) / 860);
        const sitEase = sitProgress * sitProgress * (3 - 2 * sitProgress);
        avatar.position.y = 0.28 * sitEase;
        torso.rotation.x = -0.045 * sitEase;
        leftLeg.rotation.x = 1.18 * sitEase;
        rightLeg.rotation.x = 1.18 * sitEase;
        leftKnee.rotation.x = -1.12 * sitEase;
        rightKnee.rotation.x = -1.12 * sitEase;
        leftArm.rotation.x = -0.08 * sitEase;
        rightArm.rotation.x = -0.08 * sitEase;
        leftForearm.rotation.x = -0.22 * sitEase;
        rightForearm.rotation.x = -0.22 * sitEase;
        leftFingers.forEach(finger => { finger.rotation.z = 0.035; });
        rightFingers.forEach(finger => { finger.rotation.z = -0.035; });
        head.rotation.x = 0.07 * sitEase;
      } else if (gesture.current === 'dip') {
        const t = Math.min(1, (performance.now() - gestureAt.current) / 980);
        const reach = Math.sin(t * Math.PI);
        rightArm.rotation.x = 0.9 * reach;
        rightArm.rotation.z = -0.68 * reach;
        rightForearm.rotation.x = 0.55 * reach;
        rightHand.rotation.z = -0.18 * reach;
        head.rotation.x = 0.12 * reach;
        if (t >= 1) gesture.current = 'idle';
      } else if (gesture.current === 'stand') {
        const t = Math.min(1, (performance.now() - gestureAt.current) / 640);
        const ease = t * t * (3 - 2 * t);
        const remain = 1 - ease;
        avatar.position.y = 0.28 * remain;
        torso.rotation.x = -0.045 * remain;
        leftLeg.rotation.x = 1.18 * remain;
        rightLeg.rotation.x = 1.18 * remain;
        leftKnee.rotation.x = -1.12 * remain;
        rightKnee.rotation.x = -1.12 * remain;
        leftArm.rotation.x = -0.08 * remain;
        rightArm.rotation.x = -0.08 * remain;
        leftForearm.rotation.x = -0.22 * remain;
        rightForearm.rotation.x = -0.22 * remain;
        if (t >= 1) {
          if (pendingGesture) {
            const nextGesture = pendingGesture;
            pendingGesture = null;
            gesture.current = nextGesture;
            gestureAt.current = performance.now();
            rosary.visible = nextGesture === 'rosary';
          } else {
            gesture.current = 'idle';
          }
        }
      } else if (gesture.current === 'kneel') {
        const t = Math.min(1, (performance.now() - gestureAt.current) / 780);
        const ease = t * t * (3 - 2 * t);
        avatar.position.y = -0.22 * ease;
        torso.rotation.x = -0.035 * ease + Math.sin(clock.elapsedTime * 1.15) * 0.012;
        leftLeg.rotation.x = 0.08 * ease;
        rightLeg.rotation.x = 0.08 * ease;
        leftKnee.rotation.x = -1.5 * ease;
        rightKnee.rotation.x = -1.5 * ease;
        leftArm.rotation.x = 0.78 * ease;
        rightArm.rotation.x = 0.78 * ease;
        leftArm.rotation.z = 0.6 * ease;
        rightArm.rotation.z = -0.6 * ease;
        leftForearm.rotation.x = 1.22 * ease;
        rightForearm.rotation.x = 1.22 * ease;
        leftForearm.rotation.z = -0.13 * ease;
        rightForearm.rotation.z = 0.13 * ease;
        leftHand.rotation.z = -0.12 * ease;
        rightHand.rotation.z = 0.12 * ease;
        leftFingers.forEach(finger => { finger.rotation.z = 0.07 * ease; });
        rightFingers.forEach(finger => { finger.rotation.z = -0.07 * ease; });
        leftThumb.rotation.z = 0.2 * ease;
        rightThumb.rotation.z = -0.2 * ease;
        head.rotation.x = 0.18 * ease + Math.sin(clock.elapsedTime * 1.15) * 0.012;
      } else if (gesture.current === 'rosary') {
        const t = THREE.MathUtils.clamp((performance.now() - gestureAt.current) / 620, 0, 1);
        const blend = t * t * (3 - 2 * t);
        leftArm.rotation.x = 0.82 * blend; rightArm.rotation.x = 0.82 * blend;
        leftArm.rotation.z = 0.58 * blend; rightArm.rotation.z = -0.58 * blend;
        leftForearm.rotation.x = 1.18 * blend; rightForearm.rotation.x = 1.18 * blend;
        leftForearm.rotation.z = -0.13 * blend; rightForearm.rotation.z = 0.13 * blend;
        leftHand.rotation.z = -0.12 * blend; rightHand.rotation.z = 0.12 * blend;
        leftFingers.forEach((finger, index) => { finger.rotation.z = (0.10 + (index - 1.5) * 0.035) * blend; });
        rightFingers.forEach((finger, index) => { finger.rotation.z = (-0.10 + (index - 1.5) * 0.035) * blend; });
        leftThumb.rotation.z = 0.25 * blend;
        rightThumb.rotation.z = -0.25 * blend;
        head.rotation.x = 0.13 * blend;
        rosary.visible = true;
        rosary.rotation.z = Math.sin(clock.elapsedTime * 1.15) * 0.018;
        rosary.rotation.y = Math.sin(clock.elapsedTime * 0.8) * 0.025;
        rosaryBeadMaterial.emissiveIntensity = 0.07 + Math.sin(clock.elapsedTime * 2.0) * 0.025;
      } else if (gesture.current === 'cross') {
        // Western Catholic gesture order: forehead -> chest -> left shoulder -> right shoulder.
        const t = Math.min(1, (performance.now() - gestureAt.current) / 2350);
        const keyframes = [
          { t: 0.00, x: 0.12, z: -0.02, elbow: 0.0 },
          { t: 0.15, x: 0.46, z: -0.80, elbow: 0.18 },
          { t: 0.37, x: 0.96, z: -0.34, elbow: 0.72 },
          { t: 0.63, x: 0.78, z: -1.02, elbow: 0.34 },
          { t: 0.85, x: 0.78, z: 0.02, elbow: 0.34 },
          { t: 1.00, x: 0.00, z: 0.00, elbow: 0.00 },
        ];
        let a = keyframes[0], b = keyframes[keyframes.length - 1];
        for (let i = 0; i < keyframes.length - 1; i += 1) {
          if (t >= keyframes[i].t && t <= keyframes[i + 1].t) {
            a = keyframes[i]; b = keyframes[i + 1]; break;
          }
        }
        const u = THREE.MathUtils.clamp((t - a.t) / Math.max(0.001, b.t - a.t), 0, 1);
        const eased = u * u * (3 - 2 * u);
        rightArm.rotation.x = THREE.MathUtils.lerp(a.x, b.x, eased);
        rightArm.rotation.z = THREE.MathUtils.lerp(a.z, b.z, eased);
        rightForearm.rotation.x = THREE.MathUtils.lerp(a.elbow, b.elbow, eased);
        rightHand.rotation.x = -0.08;
        leftArm.rotation.x = 0.04;
        leftForearm.rotation.x = 0.04;
        head.rotation.x = t < 0.98 ? 0.035 : 0;
        if (t >= 1) gesture.current = 'idle';
      } else if (gesture.current === 'prayer') {
        const t = THREE.MathUtils.clamp((performance.now() - gestureAt.current) / 520, 0, 1);
        const blend = t * t * (3 - 2 * t);
        const breath = Math.sin(clock.elapsedTime * 1.35) * 0.018;
        leftArm.rotation.x = (0.78 + breath) * blend;
        rightArm.rotation.x = (0.78 + breath) * blend;
        leftArm.rotation.z = 0.6 * blend;
        rightArm.rotation.z = -0.6 * blend;
        leftForearm.rotation.x = 1.22 * blend;
        rightForearm.rotation.x = 1.22 * blend;
        leftForearm.rotation.z = -0.13 * blend;
        rightForearm.rotation.z = 0.13 * blend;
        leftHand.rotation.z = -0.12 * blend;
        rightHand.rotation.z = 0.12 * blend;
        leftFingers.forEach(finger => { finger.rotation.z = 0.07 * blend; });
        rightFingers.forEach(finger => { finger.rotation.z = -0.07 * blend; });
        leftThumb.rotation.z = 0.2 * blend;
        rightThumb.rotation.z = -0.2 * blend;
        head.rotation.x = (0.18 + breath * 0.45) * blend;
        torso.rotation.x = (-0.025 + breath * 0.5) * blend;
      } else if (gesture.current === 'bow') {
        const t = Math.min(1, (performance.now() - gestureAt.current) / 1500);
        const pulse = Math.sin(t * Math.PI);
        head.rotation.x = 0.38 * pulse;
        torso.rotation.x = 0.16 * pulse;
        avatar.position.y = -0.025 * pulse;
        leftArm.rotation.x = -0.08 * pulse;
        rightArm.rotation.x = -0.08 * pulse;
        if (t >= 1) gesture.current = 'idle';
      } else if (gesture.current === 'greet') {
        const t = Math.min(1, (performance.now() - gestureAt.current) / 1850);
        const raise = Math.min(1, t / 0.24);
        const lower = t > 0.82 ? (t - 0.82) / 0.18 : 0;
        const amplitude = Math.min(1, raise) * (1 - lower);
        rightArm.rotation.z = 0.92 * amplitude;
        rightArm.rotation.x = 0.28 * amplitude;
        rightForearm.rotation.x = 0.82 * amplitude;
        rightHand.rotation.z = Math.sin(clock.elapsedTime * 9) * 0.22 * amplitude;
        if (t >= 1) gesture.current = 'idle';
      } else if (gesture.current === 'idle' && !isSitting) {
        avatar.position.y = 0;
        rosary.visible = false;
      }


      const eyeHeight = isSitting ? 1.55 : 1.72;
      // Shoulder-height follow camera: pitch changes only the viewing direction, never the camera's world height.
      cameraTarget.set(
        avatar.position.x - Math.sin(yaw) * cameraDistance,
        eyeHeight,
        avatar.position.z + Math.cos(yaw) * cameraDistance,
      );
      camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 10));
      const lookDistance = 14;
      const viewHorizontal = Math.cos(pitch) * lookDistance;
      lookTarget.set(
        avatar.position.x + Math.sin(yaw) * viewHorizontal,
        eyeHeight + Math.sin(pitch) * lookDistance,
        avatar.position.z - Math.cos(yaw) * viewHorizontal,
      );
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
      marySignTexture.dispose();
      ceilingPhotoMaterial.dispose();
      exteriorFacadeMaterial.dispose();
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
        <button type="button" onClick={() => dispatchWorldAction('cross')}>✝ 성호 긋기</button>
        <button type="button" onClick={() => dispatchWorldAction('prayer')}>🙏 기도하기</button>
        <button type="button" onClick={() => dispatchWorldAction('bow')}>목례</button>
        <button type="button" onClick={() => dispatchWorldAction('greet')}>인사하기</button>
        <button type="button" onClick={() => dispatchWorldAction('seat')}>🪑 착석하기</button>
        <button type="button" onClick={() => dispatchWorldAction('rosary')}>📿 묵주기도</button>
        <button type="button" onClick={() => dispatchWorldAction('mary')}>🌹 {nearMary ? '성모님께 기도' : '성모상 찾아가기'}</button>
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
        실제 성당 사진 자료 ·
        <a href="https://commons.wikimedia.org/wiki/File:Notre_Dame_Cathedral_Facade.jpg" target="_blank" rel="noreferrer">정면 Marlaazriel · CC BY-SA 4.0</a> ·
        <a href="https://commons.wikimedia.org/wiki/File:Interior_of_St._Vitus_Cathedral,_Nave,_Prague_20160809_1.jpg" target="_blank" rel="noreferrer">내부 DXR · CC BY-SA 4.0</a> ·
        <a href="https://commons.wikimedia.org/wiki/File:Gloucester_Cathedral_Vaulted_Ceiling.jpg" target="_blank" rel="noreferrer">천장 Zhurakovskyi · CC0</a> ·
        <a href="https://commons.wikimedia.org/wiki/File:Milan_Cathedral,_floor.jpg" target="_blank" rel="noreferrer">바닥 Gerda Arendt · CC0</a> ·
        <a href="https://commons.wikimedia.org/wiki/File:The_Lourdes_Grotto.jpg" target="_blank" rel="noreferrer">성모 기도처 ELeibiger · CC BY 4.0</a>
      </div>
    </div>
  );
}
