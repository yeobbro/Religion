'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Space = 'chapel' | 'garden';
type Props = { space: Space; displayName: string };

export default function ImmersiveAvatarScene({ space, displayName }: Props) {
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

    const chapel = space === 'chapel';
    const background = chapel ? '#262b2b' : '#a5b59d';
    const fogColor = chapel ? '#262b2b' : '#a5b59d';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);
    scene.fog = new THREE.Fog(fogColor, chapel ? 24 : 28, chapel ? 52 : 58);

    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 120);
    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = chapel ? 1.12 : 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(background, 1);
    host.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(chapel ? '#eadfc8' : '#e6f0dc', chapel ? '#24231f' : '#4b6244', chapel ? 1.9 : 2.3);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(chapel ? '#ffe5b6' : '#fff1cf', chapel ? 2.35 : 2.8);
    keyLight.position.set(-7, 12, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1536, 1536);
    keyLight.shadow.camera.left = -18;
    keyLight.shadow.camera.right = 18;
    keyLight.shadow.camera.top = 20;
    keyLight.shadow.camera.bottom = -20;
    keyLight.shadow.bias = -0.00025;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(chapel ? '#b7c5cf' : '#d5e6c9', 0.8);
    fillLight.position.set(7, 6, -10);
    scene.add(fillLight);

    const material = (color: string, roughness = 0.84, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const stone = material(chapel ? '#827f75' : '#999784');
    const darkStone = material(chapel ? '#454943' : '#535c4d');
    const floorStone = material(chapel ? '#77766d' : '#627653');
    const gold = material('#b49a69', 0.38, 0.45);
    const wood = material('#4a3829');
    const ivory = material('#e0d5bc');
    const skin = material('#d4a17d');
    const coat = material('#c8bda9');
    const coatShade = material('#a89c89');
    const hair = material('#292321');
    const trousers = material('#343a3c');
    const shoes = material('#202527');
    const bag = material('#554c40');

    const addMesh = (
      parent: THREE.Object3D,
      geometry: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      castShadow = true,
      receiveShadow = true,
    ) => {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      parent.add(mesh);
      return mesh;
    };
    const addBox = (parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) =>
      addMesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
    const addCylinder = (parent: THREE.Object3D, rt: number, rb: number, h: number, mat: THREE.Material, x: number, y: number, z: number, segments = 16) =>
      addMesh(parent, new THREE.CylinderGeometry(rt, rb, h, segments), mat, x, y, z);

    // The visitor walks inside a modeled environment, not on top of a flat photograph.
    const environment = new THREE.Group();
    scene.add(environment);

    if (chapel) {
      const floor = addMesh(environment, new THREE.PlaneGeometry(24, 36), floorStone, 0, -0.12, -3, false, true);
      floor.rotation.x = -Math.PI / 2;
      for (let x = -10; x <= 10; x += 2) {
        for (let z = -19; z <= 11; z += 2) {
          const tile = addBox(environment, 1.94, 0.025, 1.94, material((Math.abs(x + z) % 4 === 0) ? '#88867a' : '#77766d'), x, -0.085, z);
          tile.receiveShadow = true;
        }
      }
      addBox(environment, 22, 0.4, 36, darkStone, 0, 7.7, -3);
      addBox(environment, 0.55, 8, 36, stone, -11.1, 3.8, -3);
      addBox(environment, 0.55, 8, 36, stone, 11.1, 3.8, -3);
      addBox(environment, 22, 8, 0.55, stone, 0, 3.8, 15);
      addBox(environment, 22, 8, 0.55, darkStone, 0, 3.8, -21);

      // Repeated stone columns and high arch ribs create a deep nave.
      for (const x of [-8.3, -5.5, 5.5, 8.3]) {
        for (const z of [-16, -10, -4, 2, 8]) {
          addCylinder(environment, 0.34, 0.42, 7.1, ivory, x, 3.45, z, 18);
          addCylinder(environment, 0.55, 0.55, 0.28, gold, x, 7.08, z, 16);
          addBox(environment, 0.78, 0.16, 0.78, gold, x, 7.28, z);
        }
      }
      for (const z of [-15, -9, -3, 3, 9]) {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(5.5, 0.13, 10, 40, Math.PI),
          ivory,
        );
        arch.position.set(0, 5.2, z);
        arch.castShadow = true;
        environment.add(arch);
      }

      // Tall stained-glass panels set into both side walls.
      const glassMats = ['#527d8b', '#b36e54', '#d1ae63', '#6e8d79', '#9d7894'].map(color =>
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
      );
      for (const side of [-1, 1]) {
        for (const z of [-13, -6, 1, 8]) {
          const x = side * 10.78;
          const glass = addMesh(environment, new THREE.PlaneGeometry(2.05, 3.85), glassMats[(Math.abs(z) + (side > 0 ? 1 : 0)) % glassMats.length], x, 4.45, z, false, false);
          glass.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          const frame = material('#493e31', 0.5, 0.2);
          addBox(environment, 0.13, 4.05, 2.22, frame, x - side * 0.015, 4.45, z);
          const inset = addMesh(environment, new THREE.PlaneGeometry(1.88, 3.68), glassMats[(Math.abs(z) + (side > 0 ? 2 : 1)) % glassMats.length], x - side * 0.09, 4.45, z, false, false);
          inset.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }

      // Altar, tabernacle and a prominent cross at the far end of the nave.
      addBox(environment, 6.2, 0.45, 2.1, gold, 0, 1.25, -16.8);
      addBox(environment, 5.4, 1.15, 1.8, ivory, 0, 0.55, -16.8);
      addBox(environment, 2.3, 2.1, 1.4, wood, 0, 2.48, -19.1);
      addBox(environment, 0.2, 2.9, 0.2, gold, 0, 5.1, -19.85);
      addBox(environment, 1.75, 0.2, 0.2, gold, 0, 5.62, -19.85);
      addBox(environment, 8.2, 0.14, 0.22, gold, 0, 0.35, -15.35);

      // Wooden pews in two banks, leaving an open centre aisle.
      for (const z of [-7.5, -4, -0.5, 3]) {
        for (const x of [-4.1, 4.1]) {
          addBox(environment, 3.1, 0.2, 0.52, wood, x, 0.78, z);
          addBox(environment, 3.1, 0.92, 0.2, wood, x, 1.18, z + 0.43);
          for (const dx of [-1.28, 1.28]) addBox(environment, 0.15, 0.78, 0.2, gold, x + dx, 0.36, z);
        }
      }
      // Candle stands and warm lights around the altar.
      for (const x of [-2.6, -1.7, -0.85, 0, 0.85, 1.7, 2.6]) {
        addCylinder(environment, 0.12, 0.18, 0.72, gold, x, 0.38, -14.5, 12);
        addCylinder(environment, 0.1, 0.12, 0.62, ivory, x, 1.05, -14.5, 12);
        const flame = addMesh(environment, new THREE.SphereGeometry(0.085, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffc66e' }), x, 1.42, -14.5, false, false);
        flame.scale.set(0.78, 1.45, 0.78);
        const light = new THREE.PointLight('#ffbf70', 1.15, 3.2, 2);
        light.position.set(x, 1.55, -14.5);
        environment.add(light);
      }
      const aisle = addMesh(environment, new THREE.PlaneGeometry(2.8, 28), material('#927c57'), 0, -0.045, -3, false, false);
      aisle.rotation.x = -Math.PI / 2;

      // Holy-water font near the entrance.
      const font = new THREE.Group();
      font.position.set(-1.65, 0, 3.45);
      environment.add(font);
      addCylinder(font, 0.43, 0.5, 0.18, gold, 0, 0.09, 0, 24);
      addCylinder(font, 0.18, 0.25, 0.72, stone, 0, 0.52, 0, 18);
      addCylinder(font, 0.4, 0.23, 0.22, stone, 0, 0.99, 0, 28);
      const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.045, 10, 28), gold);
      bowlRim.rotation.x = Math.PI / 2;
      bowlRim.position.y = 1.11;
      font.add(bowlRim);
      const waterTop = addMesh(font, new THREE.CircleGeometry(0.32, 28), new THREE.MeshStandardMaterial({ color: '#91bbb6', roughness: 0.16, metalness: 0.25, emissive: '#244947', emissiveIntensity: 0.3 }), 0, 1.1, 0, false, false);
      waterTop.rotation.x = -Math.PI / 2;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.018, 8, 36), new THREE.MeshBasicMaterial({ color: '#ead8ad', transparent: true, opacity: 0.48 }));
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.035;
      font.add(halo);
      const glow = new THREE.PointLight('#c7e4d8', 1.8, 4.2, 2);
      glow.position.y = 1.7;
      font.add(glow);
      (font.userData as { halo?: THREE.Mesh; glow?: THREE.PointLight }).halo = halo;
      (font.userData as { halo?: THREE.Mesh; glow?: THREE.PointLight }).glow = glow;
      (font.userData as { waterTop?: THREE.Mesh }).waterTop = waterTop;

      // Warm side sconces and a rose window at the rear.
      for (const side of [-1, 1]) {
        for (const z of [-11, -3, 5]) {
          const sconce = addMesh(environment, new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffc778' }), side * 9.7, 3.1, z, false, false);
          const lamp = new THREE.PointLight('#edbd77', 1.25, 5, 2);
          lamp.position.copy(sconce.position);
          environment.add(lamp);
        }
      }
      const rose = addMesh(environment, new THREE.CircleGeometry(1.4, 36), glassMats[2], 0, 5.7, -20.67, false, false);
      rose.rotation.y = Math.PI;
    } else {
      // An outdoor garden with terrain, winding stone paths, a reflecting pond and trees.
      const ground = addMesh(environment, new THREE.PlaneGeometry(46, 54), material('#617b55'), 0, -0.1, -2, false, true);
      ground.rotation.x = -Math.PI / 2;
      const path = addMesh(environment, new THREE.PlaneGeometry(4.2, 37), material('#bdb39b'), 0, -0.035, -3.2, false, true);
      path.rotation.x = -Math.PI / 2;
      const pathEdge = material('#827a65');
      for (const x of [-2.18, 2.18]) addBox(environment, 0.18, 0.09, 37, pathEdge, x, -0.01, -3.2);

      // Gentle hills close off the horizon.
      for (const [x, z, s] of [[-15, -15, 7], [0, -21, 9], [15, -16, 8], [-17, 9, 8], [17, 8, 8]] as [number, number, number][]) {
        const hill = addMesh(environment, new THREE.SphereGeometry(1, 20, 14), material('#708866'), x, 1.5, z, false, true);
        hill.scale.set(s, s * 0.48, s * 0.9);
      }

      // Trees, trunks and layered canopies are separate 3D geometry.
      for (const x of [-11, -8, 8, 11]) {
        for (const z of [-15, -8, 0, 8, 15]) {
          addCylinder(environment, 0.22, 0.34, 3.2, material('#66503a'), x, 1.55, z, 12);
          for (let layer = 0; layer < 3; layer += 1) {
            const crown = addMesh(environment, new THREE.IcosahedronGeometry(1.65 - layer * 0.12, 1), material(layer === 1 ? '#54734d' : '#66835c'), x + (layer % 2 ? 0.25 : -0.18), 3.0 + layer * 0.72, z, true, true);
            crown.scale.set(1.1, 0.94, 1);
          }
        }
      }
      // Flowering shrubs along the path.
      for (const x of [-5.3, 5.3]) {
        for (let i = 0; i < 15; i += 1) {
          const z = -13 + i * 1.75;
          addMesh(environment, new THREE.IcosahedronGeometry(0.55, 1), material(i % 2 ? '#54744c' : '#6b8558'), x + Math.sin(i * 1.7) * 0.25, 0.45, z, true, true);
          const bloom = ['#d6b0a4', '#ead0a0', '#d6c3d8'][i % 3];
          for (let petal = 0; petal < 4; petal += 1) {
            addMesh(environment, new THREE.SphereGeometry(0.095, 8, 8), material(bloom), x + Math.cos(petal * Math.PI / 2) * 0.28, 0.85, z + Math.sin(petal * Math.PI / 2) * 0.28, false, false);
          }
        }
      }

      // A stone fountain and water surface at the centre of the garden.
      addCylinder(environment, 1.65, 1.85, 0.48, material('#999887'), 0, 0.24, -7, 32);
      addCylinder(environment, 1.38, 1.38, 0.08, material('#7fa9a5', 0.18, 0.2), 0, 0.52, -7, 32);
      addCylinder(environment, 0.2, 0.29, 1.18, material('#aaa28f'), 0, 1.1, -7, 18);
      addMesh(environment, new THREE.SphereGeometry(0.27, 16, 12), material('#90bab3', 0.15, 0.2), 0, 1.82, -7, false, false);
      const fountainLight = new THREE.PointLight('#c4e2d8', 1.3, 7, 2);
      fountainLight.position.set(0, 2.3, -7);
      environment.add(fountainLight);

      // Benches and lanterns offer smaller points of interest.
      for (const x of [-5.4, 5.4]) {
        addBox(environment, 1.8, 0.18, 0.58, wood, x, 0.76, 2.5);
        addBox(environment, 1.8, 0.85, 0.15, wood, x, 1.17, 2.8);
        for (const dx of [-0.68, 0.68]) addBox(environment, 0.12, 0.72, 0.16, gold, x + dx, 0.38, 2.5);
        const lantern = new THREE.Group();
        lantern.position.set(x * 1.4, 0, -1.4);
        environment.add(lantern);
        addCylinder(lantern, 0.16, 0.16, 0.75, gold, 0, 0.38, 0, 12);
        const light = new THREE.PointLight('#ffd48e', 1.5, 4, 2);
        light.position.y = 0.9;
        lantern.add(light);
      }

      // A small chapel visible in the far end of the garden.
      addBox(environment, 7.2, 4.6, 4.8, material('#d2c7ad'), 0, 2.3, -21);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(5.3, 3.1, 4), material('#695a47'));
      roof.position.set(0, 6.15, -21);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      environment.add(roof);
      addBox(environment, 0.16, 1.45, 0.12, gold, 0, 8.05, -21);
      addBox(environment, 0.88, 0.15, 0.12, gold, 0, 8.3, -21);
      addBox(environment, 1.45, 2.5, 0.2, wood, 0, 1.25, -18.55);
      const pond = addMesh(environment, new THREE.CircleGeometry(2.3, 48), new THREE.MeshStandardMaterial({ color: '#729a98', roughness: 0.17, metalness: 0.2, transparent: true, opacity: 0.92 }), 5.3, 0.02, -10.5, false, false);
      pond.rotation.x = -Math.PI / 2;
    }

    // Movable visitor character. Slightly smaller in frame with a more distant follow camera.
    const avatar = new THREE.Group();
    avatar.position.set(0, 0, 4.8);
    avatar.scale.setScalar(0.84);
    scene.add(avatar);
    const addAvatar = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) =>
      addMesh(avatar, geo, mat, x, y, z);

    addAvatar(new THREE.CapsuleGeometry(0.31, 0.66, 5, 12), coat, 0, 1.34, 0);
    addAvatar(new THREE.CylinderGeometry(0.1, 0.11, 0.18, 12), skin, 0, 1.85, 0);
    const head = addAvatar(new THREE.SphereGeometry(0.235, 18, 14), skin, 0, 2.08, -0.02);
    head.scale.set(0.92, 1.08, 0.95);
    const hairCap = addAvatar(new THREE.SphereGeometry(0.24, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, 0, 2.16, 0.01);
    hairCap.scale.set(1.02, 0.88, 1.03);
    addAvatar(new THREE.BoxGeometry(0.51, 0.68, 0.2), bag, 0, 1.34, 0.29);

    const makeLimb = (x: number, y: number, mat: THREE.Material, length: number, radius: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      avatar.add(pivot);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 10), mat);
      body.position.y = -length * 0.46;
      body.castShadow = true;
      pivot.add(body);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), skin);
      hand.position.y = -length;
      pivot.add(hand);
      return pivot;
    };
    const leftArm = makeLimb(-0.39, 1.64, coatShade, 0.62, 0.105);
    const rightArm = makeLimb(0.39, 1.64, coatShade, 0.62, 0.105);
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
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ color: '#090b09', transparent: true, opacity: 0.26, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.025;
    avatar.add(shadow);

    // Tiny baptismal-name marker attached to the avatar in the 3D world.
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 112;
    const context = labelCanvas.getContext('2d');
    if (context) {
      context.fillStyle = 'rgba(18, 22, 19, 0.72)';
      context.beginPath();
      context.roundRect(8, 8, 496, 96, 44);
      context.fill();
      context.font = '600 42px -apple-system, BlinkMacSystemFont, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#f7f0df';
      context.fillText(displayName.trim().slice(0, 18) || '순례자', 256, 57, 460);
    }
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    const nameLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false }));
    nameLabel.scale.set(1.35, 0.29, 1);
    nameLabel.position.set(0, 2.72, 0);
    avatar.add(nameLabel);

    const keys = new Set<string>();
    let yaw = 0;
    let pitch = 0.04;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let frame = 0;
    let lastNear = false;
    const clock = new THREE.Clock();
    const cameraTarget = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const holyFont = scene.getObjectByName('holy-water-font');

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keys.add(key);
        if (key.startsWith('arrow')) event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const onBlur = () => keys.clear();
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      yaw = THREE.MathUtils.clamp(yaw - (event.clientX - lastX) * 0.004, -1.3, 1.3);
      pitch = THREE.MathUtils.clamp(pitch + (event.clientY - lastY) * 0.002, -0.14, 0.28);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = () => { dragging = false; };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      pitch = THREE.MathUtils.clamp(pitch + event.deltaY * 0.0003, -0.14, 0.28);
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
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('wheel', onWheel, { passive: false });

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.04);
      const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const sideways = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const moving = Math.abs(forward) + Math.abs(sideways) > 0;
      if (moving) {
        const length = Math.hypot(forward, sideways) || 1;
        const dx = Math.sin(yaw) * (forward / length) + Math.cos(yaw) * (sideways / length);
        const dz = -Math.cos(yaw) * (forward / length) + Math.sin(yaw) * (sideways / length);
        avatar.position.x = THREE.MathUtils.clamp(avatar.position.x + dx * delta * 3.05, chapel ? -8.2 : -9.5, chapel ? 8.2 : 9.5);
        avatar.position.z = THREE.MathUtils.clamp(avatar.position.z + dz * delta * 3.05, -17.5, 11.5);
        avatar.rotation.y = Math.atan2(dx, -dz);
      }

      const gait = moving ? Math.sin(clock.elapsedTime * 10.2) * 0.48 : 0;
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

      cameraTarget.set(
        avatar.position.x + Math.sin(yaw) * 5.35,
        3.15 + pitch * 3.4,
        avatar.position.z + Math.cos(yaw) * 5.35,
      );
      camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 5));
      lookTarget.set(avatar.position.x, 1.08, avatar.position.z - 0.8);
      camera.lookAt(lookTarget);

      if (holyFont) {
        const distance = Math.hypot(avatar.position.x - holyFont.position.x, avatar.position.z - holyFont.position.z);
        const near = chapel && distance < 2.15;
        if (near !== lastNear) { lastNear = near; setNearFont(near); }
        const data = holyFont.userData as { halo?: THREE.Mesh; glow?: THREE.PointLight; waterTop?: THREE.Mesh };
        if (data.halo) (data.halo.material as THREE.MeshBasicMaterial).opacity = near ? 0.92 : 0.48;
        if (data.glow) data.glow.intensity = near ? 3 : 1.8;
        if (data.waterTop) data.waterTop.rotation.z = Math.sin(clock.elapsedTime * 0.9) * 0.015;
      }

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
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('wheel', onWheel);
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(item => item.dispose());
        }
      });
      labelTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [space, displayName]);

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
      <div ref={hostRef} className="immersive-avatar-canvas" aria-label={space === 'chapel' ? '3D 성당 내부와 이동 가능한 아바타' : '3D 정원과 이동 가능한 아바타'} />
      {nearFont && step !== 'done' ? (
        <div className="holy-water-actions" role="group" aria-label="성수대 액션">
          <span aria-hidden="true">{step === 'water' ? '✧' : '✝'}</span>
          {step === 'water'
            ? <button type="button" className="holy-water-primary" onClick={dip}>💧 성수 찍기</button>
            : <button type="button" className="holy-water-primary" onClick={sign}>성호 긋기</button>}
          <button type="button" className="holy-water-skip" onClick={() => setStep('done')}>건너뛰기</button>
        </div>
      ) : null}
      <div className="touch-pad avatar-touch-pad" aria-label="아바타 이동">
        <button type="button" aria-label="앞으로" onPointerDown={event => { event.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' })); }} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }))} onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }))} onPointerCancel={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }))}>▲</button>
        <div>
          <button type="button" aria-label="왼쪽" onPointerDown={event => { event.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); }} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }))} onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }))} onPointerCancel={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }))}>◀</button>
          <button type="button" aria-label="뒤로" onPointerDown={event => { event.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' })); }} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }))} onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }))} onPointerCancel={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }))}>▼</button>
          <button type="button" aria-label="오른쪽" onPointerDown={event => { event.preventDefault(); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' })); }} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }))} onPointerLeave={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }))} onPointerCancel={() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }))}>▶</button>
        </div>
      </div>
    </div>
  );
}
