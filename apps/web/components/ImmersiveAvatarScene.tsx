'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Props = { displayName: string };
type Blocker = { x: number; z: number; rx: number; rz: number };

export default function ImmersiveAvatarScene({ displayName }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<'idle' | 'dip' | 'cross'>('idle');
  const gestureAt = useRef(0);
  const [nearFont, setNearFont] = useState(false);
  const [step, setStep] = useState<'water' | 'cross' | 'done'>('water');
  const [pointerLocked, setPointerLocked] = useState(false);

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

    const camera = new THREE.PerspectiveCamera(58, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 180);
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
    const plaster = makeMat('#d7d0c0', 0.94, 0, makeNoiseTexture('#d7d0c0', 2, 4, 3));
    const darkPlaster = makeMat('#938d80', 0.94, 0, makeNoiseTexture('#938d80', 4, 3, 2));
    const darkStone = makeMat('#53564e', 0.91, 0, makeNoiseTexture('#53564e', 18, 3, 2));
    const floorStone = makeMat('#827e72', 0.88, 0, makeNoiseTexture('#827e72', 6, 8, 14));
    const aisleStone = makeMat('#a28a67', 0.78, 0, makeNoiseTexture('#a28a67', 8, 2, 12));
    const trim = makeMat('#b49a6b', 0.42, 0.42);
    const wood = makeMat('#523d2b', 0.7, 0, makeNoiseTexture('#523d2b', 10, 3, 2));
    const darkWood = makeMat('#33271f', 0.78, 0);
    const ivory = makeMat('#e5dac3', 0.78, 0);
    const stone = makeMat('#aaa28f', 0.86, 0);
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
    addGroundPlane(world, 22.2, 42, floorStone, 0, -0.1, -1);
    for (let x = -10; x <= 10; x += 2) {
      for (let z = -20; z <= 18; z += 2) {
        addMesh(world, new THREE.BoxGeometry(1.94, 0.035, 1.94), floorStone, x, -0.075, z, false, true);
      }
    }
    addGroundPlane(world, 3.4, 40, aisleStone, 0, -0.045, -1);
    addGroundPlane(world, 5.4, 48, pathMat, 0, -0.035, 39);

    // CHURCH: long nave, side aisles, side walls and vaulted ceiling.
    addBox(world, 22.8, 0.5, 42, darkPlaster, 0, 8.35, -1);
    addBox(world, 0.6, 8.2, 42, plaster, -11.35, 3.85, -1, true);
    addBox(world, 0.6, 8.2, 42, plaster, 11.35, 3.85, -1, true);
    addBox(world, 22.8, 8.2, 0.6, plaster, 0, 3.85, -22, true);
    // The front wall has a real open doorway; there is no invisible wall across the threshold.
    addBox(world, 8.1, 8.2, 0.6, plaster, -7.3, 3.85, 19.5, true);
    addBox(world, 8.1, 8.2, 0.6, plaster, 7.3, 3.85, 19.5, true);
    addBox(world, 6.5, 1.9, 0.6, plaster, 0, 7.15, 19.5);
    for (const x of [-2.9, 2.9]) {
      addCylinder(world, 0.42, 0.48, 7.9, ivory, x, 3.9, 19.15, 20, true);
      addBox(world, 1.05, 0.34, 1.0, trim, x, 7.95, 19.15);
    }

    // Open wooden entrance doors on their hinges, so the garden reads as the next space.
    const leftDoor = new THREE.Group();
    leftDoor.position.set(-2.9, 0, 19.5);
    leftDoor.rotation.y = -0.92;
    world.add(leftDoor);
    addBox(leftDoor, 2.75, 5.6, 0.22, wood, -1.34, 2.8, 0);
    for (const y of [0.9, 2.8, 4.7]) addBox(leftDoor, 2.55, 0.08, 0.28, trim, -1.34, y, 0);
    const rightDoor = new THREE.Group();
    rightDoor.position.set(2.9, 0, 19.5);
    rightDoor.rotation.y = 0.92;
    world.add(rightDoor);
    addBox(rightDoor, 2.75, 5.6, 0.22, wood, 1.34, 2.8, 0);
    for (const y of [0.9, 2.8, 4.7]) addBox(rightDoor, 2.55, 0.08, 0.28, trim, 1.34, y, 0);

    // A high stone vault, rib arches and heavy piers.
    for (const x of [-8.7, -5.8, 5.8, 8.7]) {
      for (const z of [-17, -11, -5, 1, 7, 13]) {
        addCylinder(world, 0.31, 0.4, 7.65, ivory, x, 3.8, z, 18, true);
        addCylinder(world, 0.55, 0.55, 0.26, trim, x, 7.78, z, 18);
        addBox(world, 0.9, 0.18, 0.9, trim, x, 7.98, z);
      }
    }
    for (const z of [-17, -11, -5, 1, 7, 13]) {
      for (const x of [-4.3, 0, 4.3]) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.14, 10, 48, Math.PI), ivory);
        rib.position.set(x, 6.15, z);
        rib.rotation.z = Math.PI;
        rib.castShadow = true;
        world.add(rib);
      }
    }

    // Stained glass panels: jewel tones with lead divisions.
    const glassColors = ['#547d8e', '#bd805f', '#d5b76f', '#6e927e', '#947f9f', '#d1c18b'];
    for (const side of [-1, 1]) {
      for (const z of [-15, -8, -1, 6, 13]) {
        const x = side * 10.98;
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
        const panel = addMesh(world, new THREE.PlaneGeometry(1.95, 3.85), glassMat, x, 4.65, z, false, false);
        panel.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        for (const dz of [-1, 0, 1]) addBox(world, 0.11, 3.95, 0.1, trim, x - side * 0.08, 4.65, z + dz * 0.9);
        addBox(world, 0.12, 4.0, 2.1, darkWood, x - side * 0.11, 4.65, z);
      }
    }

    // Fourteen Stations of the Cross: seven framed relief panels on each side.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i += 1) {
        const z = -16 + i * 4.8;
        const x = side * 10.72;
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
    addBox(world, 0.15, 2.45, 0.16, trim, 0, 6.5, -21.35);
    addBox(world, 1.42, 0.18, 0.16, trim, 0, 6.9, -21.35);
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
        addBox(world, 3.55, 0.22, 0.58, wood, x, 0.82, z, true);
        addBox(world, 3.55, 0.9, 0.2, wood, x, 1.22, z + 0.42, true);
        for (const dx of [-1.5, 1.5]) addBox(world, 0.16, 0.8, 0.22, trim, x + dx, 0.4, z, true);
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
      const x = side * 8.9;
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

    // Marian prayer grotto at the garden edge.
    addBox(world, 2.8, 3.2, 1.25, stone, 10.8, 1.6, 43.5);
    const grottoArch = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 12, 40, Math.PI), ivory);
    grottoArch.position.set(10.8, 2.9, 42.8);
    grottoArch.rotation.z = Math.PI;
    world.add(grottoArch);
    addMesh(world, new THREE.SphereGeometry(0.35, 16, 12), ivory, 10.8, 3.8, 43.2);
    addMesh(world, new THREE.ConeGeometry(0.62, 1.55, 8), makeMat('#d8d4c7'), 10.8, 2.35, 43.2);
    addCylinder(world, 0.18, 0.24, 0.7, trim, 10.8, 0.35, 43.2, 12, true);

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

    // Collision-aware movement around the architecture and garden furniture.
    addBlocker(-11.35, -1, 0.35, 21);
    addBlocker(11.35, -1, 0.35, 21);
    addBlocker(0, -22, 11.4, 0.3);
    addBlocker(-7.3, 19.5, 4.05, 0.3);
    addBlocker(7.3, 19.5, 4.05, 0.3);
    for (const z of [-17, -11, -5, 1, 7, 13]) {
      for (const x of [-8.7, -5.8, 5.8, 8.7]) addBlocker(x, z, 0.35, 0.35);
    }

    const keys = new Set<string>();
    let yaw = 0;
    let pitch = 0.12;
    let cameraDistance = 5.8;
    let dragging = false;
    let mobileLooking = false;
    let lastX = 0;
    let lastY = 0;
    let pinchDistance = 0;
    let frame = 0;
    let lastNearFont = false;
    const clock = new THREE.Clock();
    const cameraTarget = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keys.add(key);
        if (key.startsWith('arrow')) event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const onBlur = () => keys.clear();

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === host) {
        yaw += event.movementX * 0.0023;
        pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0018, -0.28, 0.48);
      } else if (dragging) {
        yaw += (event.clientX - lastX) * 0.004;
        pitch = THREE.MathUtils.clamp(pitch - (event.clientY - lastY) * 0.003, -0.28, 0.48);
        lastX = event.clientX;
        lastY = event.clientY;
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        const bounds = host.getBoundingClientRect();
        mobileLooking = event.clientX > bounds.left + bounds.width * 0.42;
        lastX = event.clientX;
        lastY = event.clientY;
      } else if (event.button === 0) {
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!mobileLooking || event.pointerType !== 'touch') return;
      yaw += (event.clientX - lastX) * 0.006;
      pitch = THREE.MathUtils.clamp(pitch - (event.clientY - lastY) * 0.004, -0.28, 0.48);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = () => {
      dragging = false;
      mobileLooking = false;
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
    const onHostClick = () => {
      if (window.matchMedia('(pointer: fine)').matches && document.pointerLockElement !== host) {
        void host.requestPointerLock?.();
      }
    };
    const onPointerLockChange = () => setPointerLocked(document.pointerLockElement === host);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('click', onHostClick);
    host.addEventListener('touchstart', onTouchStart, { passive: true });
    host.addEventListener('touchmove', onTouchMove, { passive: false });
    host.addEventListener('touchend', onTouchEnd);
    host.addEventListener('wheel', onWheel, { passive: false });

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.04);
      const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const sideways = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const moving = Math.abs(forward) + Math.abs(sideways) > 0;
      const oldX = avatar.position.x;
      const oldZ = avatar.position.z;
      if (moving) {
        const length = Math.hypot(forward, sideways) || 1;
        const f = forward / length;
        const s = sideways / length;
        const dx = Math.sin(yaw) * f + Math.cos(yaw) * s;
        const dz = -Math.cos(yaw) * f + Math.sin(yaw) * s;
        const nextX = THREE.MathUtils.clamp(oldX + dx * delta * 4.3, -19.5, 19.5);
        const nextZ = THREE.MathUtils.clamp(oldZ + dz * delta * 4.3, -22.5, 66);
        if (!collides(nextX, oldZ)) avatar.position.x = nextX;
        if (!collides(avatar.position.x, nextZ)) avatar.position.z = nextZ;
        avatar.rotation.y = Math.atan2(dx, -dz);
      }
      const gait = moving ? Math.sin(clock.elapsedTime * 11.5) * 0.5 : 0;
      leftLeg.rotation.x = gait;
      rightLeg.rotation.x = -gait;
      leftArm.rotation.x = -gait * 0.42;
      rightArm.rotation.x = gait * 0.42;

      if (gesture.current !== 'idle') {
        const duration = gesture.current === 'dip' ? 950 : 1250;
        const progress = Math.min(1, (performance.now() - gestureAt.current) / duration);
        if (gesture.current === 'dip') {
          leftArm.rotation.x = -1.2 * Math.sin(progress * Math.PI);
          leftArm.rotation.z = 0.58 * Math.sin(progress * Math.PI);
        } else {
          const phase = progress * 3;
          leftArm.rotation.x = phase < 1 ? -1.3 : phase < 2 ? -0.42 : -1.02;
          leftArm.rotation.z = phase < 1 ? 0.05 : phase < 2 ? 0.92 : -0.22;
        }
        if (progress >= 1) {
          gesture.current = 'idle';
          leftArm.rotation.z = 0;
        }
      } else {
        leftArm.rotation.z = 0;
        rightArm.rotation.z = 0;
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
      if (document.pointerLockElement === host) document.exitPointerLock();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('click', onHostClick);
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
      scene.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.material.map) {
          object.material.map.dispose();
        }
      });
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
  const dispatchKey = (key: string, type: 'keydown' | 'keyup') =>
    window.dispatchEvent(new KeyboardEvent(type, { key }));

  return (
    <div className="immersive-avatar-stage">
      <div ref={hostRef} className="immersive-avatar-canvas" aria-label="하나로 이어진 3D 성당과 정원. 클릭 후 WASD로 이동하고 마우스로 시점을 조작하세요." />
      {nearFont && step !== 'done' ? (
        <div className="holy-water-actions" role="group" aria-label="성수대 액션">
          <span aria-hidden="true">{step === 'water' ? '✧' : '✝'}</span>
          {step === 'water'
            ? <button type="button" className="holy-water-primary" onClick={dip}>💧 성수 찍기</button>
            : <button type="button" className="holy-water-primary" onClick={sign}>성호 긋기</button>}
          <button type="button" className="holy-water-skip" onClick={() => setStep('done')}>건너뛰기</button>
        </div>
      ) : null}
      {!pointerLocked ? <div className="fps-control-hint">클릭 후 WASD · 마우스 시점 · 휠 줌</div> : null}
      <div className="touch-pad avatar-touch-pad" aria-label="이동 조작">
        <button type="button" aria-label="앞으로" onPointerDown={event => { event.preventDefault(); dispatchKey('w', 'keydown'); }} onPointerUp={() => dispatchKey('w', 'keyup')} onPointerLeave={() => dispatchKey('w', 'keyup')} onPointerCancel={() => dispatchKey('w', 'keyup')}>▲</button>
        <div>
          <button type="button" aria-label="왼쪽" onPointerDown={event => { event.preventDefault(); dispatchKey('a', 'keydown'); }} onPointerUp={() => dispatchKey('a', 'keyup')} onPointerLeave={() => dispatchKey('a', 'keyup')} onPointerCancel={() => dispatchKey('a', 'keyup')}>◀</button>
          <button type="button" aria-label="뒤로" onPointerDown={event => { event.preventDefault(); dispatchKey('s', 'keydown'); }} onPointerUp={() => dispatchKey('s', 'keyup')} onPointerLeave={() => dispatchKey('s', 'keyup')} onPointerCancel={() => dispatchKey('s', 'keyup')}>▼</button>
          <button type="button" aria-label="오른쪽" onPointerDown={event => { event.preventDefault(); dispatchKey('d', 'keydown'); }} onPointerUp={() => dispatchKey('d', 'keyup')} onPointerLeave={() => dispatchKey('d', 'keyup')} onPointerCancel={() => dispatchKey('d', 'keyup')}>▶</button>
        </div>
      </div>
      <div className="camera-touch-hint" aria-hidden="true">화면 오른쪽 드래그 · 두 손가락 줌</div>
    </div>
  );
}
