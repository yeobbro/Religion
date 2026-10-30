'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Garden3DScene() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current; if (!el) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#aeb9a2'); scene.fog = new THREE.Fog('#aeb9a2', 18, 48);
    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, .1, 100);
    camera.position.set(0, 5.2, 13); camera.lookAt(0, 1, -3);
    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6)); renderer.setSize(el.clientWidth,el.clientHeight);
    renderer.shadowMap.enabled=true; renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight('#e7efdf','#4a5541',2));
    const sun=new THREE.DirectionalLight('#fff0ce',2.4); sun.position.set(-8,14,7); sun.castShadow=true; scene.add(sun);
    const mat=(c:string,r=.9)=>new THREE.MeshStandardMaterial({color:c,roughness:r});
    const add=(geo:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;};
    add(new THREE.PlaneGeometry(42,42),mat('#52684c'),0,0,0).rotation.x=-Math.PI/2;
    const path=add(new THREE.PlaneGeometry(3.5,35),mat('#b6aa91'),0,.015,0);path.rotation.x=-Math.PI/2;
    for(const x of [-9,-6,6,9]) for(const z of [-10,-3,5,12]){
      add(new THREE.CylinderGeometry(.18,.3,3,9),mat('#594936'),x,1.5,z);
      for(let i=0;i<4;i++) add(new THREE.IcosahedronGeometry(1.6-i*.12,1),mat(i%2?'#486346':'#58734f'),x+(i%2)*.35,3.1+i*.45,z);
    }
    const basin=add(new THREE.CylinderGeometry(1.5,1.65,.45,32),mat('#928b7a'),0,.24,-5);
    add(new THREE.CylinderGeometry(1.28,1.28,.08,32),mat('#8caeae',.2),0,.5,-5);
    add(new THREE.CylinderGeometry(.17,.25,1.1,16),mat('#aaa18d'),0,1.05,-5);
    add(new THREE.SphereGeometry(.28,16,12),mat('#a4c5c2',.15),0,1.68,-5);
    for(const x of [-4.8,4.8]){
      add(new THREE.BoxGeometry(1.2,.28,8),mat('#5a5140'),x,.14,-1);
      for(let i=0;i<18;i++) add(new THREE.SphereGeometry(.12,8,8),mat(['#e4c9a5','#c68f83','#e0c46e'][i%3]),x+(Math.random()-.5)*.7,.48,-4+i*.35);
      add(new THREE.BoxGeometry(2.6,.18,.55),mat('#61472f'),x*1.45,.8,6);
      for(const dx of [-1,1]) add(new THREE.BoxGeometry(.15,.75,.18),mat('#61472f'),x*1.45+dx,.4,6);
    }
    // A quiet chapel silhouette at the far end of the garden.
    add(new THREE.BoxGeometry(10,5,.6),mat('#d0c7b3'),0,2.5,-17);
    add(new THREE.ConeGeometry(1.1,2.4,4),mat('#756c5b'),0,6.2,-17);
    add(new THREE.BoxGeometry(.18,1.4,.12),mat('#9d865c'),0,6.5,-17);
    add(new THREE.BoxGeometry(.9,.15,.12),mat('#9d865c'),0,6.65,-17);
    let yaw=0,drag=false,lastX=0,lastY=0,pitch=-.13,distance=13,cameraX=0,cameraZ=0;
    const keys=new Set<string>();
    const onKeyDown=(e:KeyboardEvent)=>{if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keys.add(e.key.toLowerCase());if(e.key.startsWith('Arrow'))e.preventDefault();}};
    const onKeyUp=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
    const onWheel=(e:WheelEvent)=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.012,7,22);};
    const down=(e:PointerEvent)=>{drag=true;lastX=e.clientX;lastY=e.clientY;};
    const move=(e:PointerEvent)=>{if(!drag)return;yaw-=(e.clientX-lastX)*.004;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.002,-.35,.2);lastX=e.clientX;lastY=e.clientY;};
    const up=()=>drag=false;
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('wheel',onWheel,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('keydown',onKeyDown);window.addEventListener('keyup',onKeyUp);
    const resize=()=>{camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);};window.addEventListener('resize',resize);
    const clock=new THREE.Clock();let frame=0;const tick=()=>{frame=requestAnimationFrame(tick);const delta=Math.min(clock.getDelta(),.04);const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);const side=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);cameraX+=side*delta*3*Math.cos(yaw)+forward*delta*3*Math.sin(yaw);cameraZ+=side*delta*3*Math.sin(yaw)-forward*delta*3*Math.cos(yaw);cameraX=THREE.MathUtils.clamp(cameraX,-8,8);cameraZ=THREE.MathUtils.clamp(cameraZ,-12,9);camera.position.set(cameraX+Math.sin(yaw)*distance,5.2+pitch*5,cameraZ+Math.cos(yaw)*distance);camera.lookAt(cameraX,1+pitch,-3+cameraZ*.35);renderer.render(scene,camera);};tick();
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.removeEventListener('pointerup',up);window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);renderer.domElement.removeEventListener('wheel',onWheel);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});renderer.dispose();el.removeChild(renderer.domElement);};
  },[]);
  return <div className="scene3d-wrap"><div className="scene3d-canvas" ref={host} aria-label="키보드와 마우스로 둘러볼 수 있는 나무와 분수가 있는 성당 정원 3D 공간"/><div className="scene3d-overlay"><span className="scene3d-live"><i/> QUIET GARDEN</span><span className="scene3d-hint">정원을 천천히 둘러보세요</span></div><div className="scene3d-bottom"><span>🌿 바람과 새소리가 머무는 정원</span><span className="desktop-controls-hint">WASD 이동 · 드래그 회전 · 휠 확대</span></div><div className="touch-pad" aria-label="모바일 이동 조작"><button type="button" aria-label="앞으로 이동" onPointerDown={e=>{e.preventDefault();window.dispatchEvent(new KeyboardEvent('keydown',{key:'w'}));}} onPointerUp={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'w'}))} onPointerLeave={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'w'}))} onPointerCancel={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'w'}))}>▲</button><div><button type="button" aria-label="왼쪽 이동" onPointerDown={e=>{e.preventDefault();window.dispatchEvent(new KeyboardEvent('keydown',{key:'a'}));}} onPointerUp={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'a'}))} onPointerLeave={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'a'}))} onPointerCancel={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'a'}))}>◀</button><button type="button" aria-label="뒤로 이동" onPointerDown={e=>{e.preventDefault();window.dispatchEvent(new KeyboardEvent('keydown',{key:'s'}));}} onPointerUp={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'s'}))} onPointerLeave={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'s'}))} onPointerCancel={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'s'}))}>▼</button><button type="button" aria-label="오른쪽 이동" onPointerDown={e=>{e.preventDefault();window.dispatchEvent(new KeyboardEvent('keydown',{key:'d'}));}} onPointerUp={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}))} onPointerLeave={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}))} onPointerCancel={()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'d'}))}>▶</button></div></div></div>;
}