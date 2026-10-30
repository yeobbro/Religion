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
    let yaw=0,drag=false,lastX=0,lastY=0,pitch=-.13;
    const down=(e:PointerEvent)=>{drag=true;lastX=e.clientX;lastY=e.clientY;};
    const move=(e:PointerEvent)=>{if(!drag)return;yaw-=(e.clientX-lastX)*.004;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.002,-.35,.2);lastX=e.clientX;lastY=e.clientY;};
    const up=()=>drag=false;
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
    const resize=()=>{camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);};window.addEventListener('resize',resize);
    let frame=0;const tick=()=>{frame=requestAnimationFrame(tick);camera.position.set(Math.sin(yaw)*13,5.2+pitch*5,Math.cos(yaw)*13);camera.lookAt(0,1,-3);renderer.render(scene,camera);};tick();
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});renderer.dispose();el.removeChild(renderer.domElement);};
  },[]);
  return <div className="scene3d-canvas" ref={host} aria-label="나무와 분수가 있는 성당 정원 3D 공간"/>;
}