import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

// Projection is adapted to the community Juniper mesh; it is not Tesla's factory UV rig.
// Every decorative sample comes from the downloadable atlas, never the concept render.
const projection=/* glsl */`
uniform sampler2D wrapAtlas;
uniform sampler2D wrapMask;
uniform vec3 wrapBase;
varying vec3 vWrapP;
varying vec3 vWrapN;
vec2 atlasXY(vec2 pixel){return vec2(pixel.x/1024.0,1.0-pixel.y/1024.0);}
vec2 wrapProjection(vec3 p,vec3 n){
 float side=step(0.0,p.x);
 float height=clamp((p.y-0.34)/0.84,0.015,0.985);
 float u=clamp((p.z+1.03)/2.25,0.012,0.988);
 if(p.z < -0.93 && p.y>0.79 && abs(p.x)<0.81 && n.y>0.48){
  return atlasXY(vec2(375.0+clamp((p.x+0.83)/1.66,0.025,0.975)*271.0,110.0+clamp((p.z+2.27)/1.35,0.025,0.975)*230.0));
 }
 if(p.z < -2.09 && abs(n.z)>abs(n.x)*0.75){
  return atlasXY(vec2(244.0+clamp((p.x+1.0)/2.0,0.02,0.98)*534.0,8.0+clamp(1.0-p.y/1.03,0.04,0.94)*110.0));
 }
 if(p.z > 2.04 && abs(n.z)>abs(n.x)*0.75){
  return atlasXY(vec2(395.0+clamp((1.0-p.x)/2.0,0.03,0.97)*236.0,938.0+clamp((1.15-p.y)/0.8,0.03,0.97)*77.0));
 }
 if(p.y>1.21){
  return atlasXY(vec2(mix(341.0,631.0,side)+24.0,346.0+clamp((p.z+1.1)/3.0,0.02,0.98)*466.0));
 }
 if(p.z < -1.03){
  float f=clamp((p.z+2.18)/1.15,0.03,0.97);
  return side<0.5?atlasXY(vec2(110.0+height*222.0,114.0+f*254.0)):atlasXY(vec2(693.0+(1.0-height)*220.0,113.0+f*256.0));
 }
 if(p.z > 1.22){
  float r=clamp((p.z-1.22)/1.1,0.03,0.97);
  return side<0.5?atlasXY(vec2(123.0+height*142.0,779.0+r*172.0)):atlasXY(vec2(756.0+(1.0-height)*143.0,782.0+r*172.0));
 }
 return side<0.5?atlasXY(vec2(68.0+height*192.0,347.0+u*446.0)):atlasXY(vec2(761.0+(1.0-height)*190.0,349.0+u*447.0));
}`;

export class WrapViewer{
 constructor(host){
  this.host=host;this.active=false;this.mode='static';this.speed=55;this.elapsed=0;this.wheels=[];this.paintMaterials=[];this.lamps=[];this.texture=null;this.designToken=0;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#eae5dd');this.scene.fog=new THREE.Fog('#eae5dd',24,85);
  this.camera=new THREE.PerspectiveCamera(35,1,0.05,150);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.28;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','可拖动旋转的 Model Y Juniper 车衣三维预览');
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.075;this.controls.enablePan=false;this.controls.minDistance=4;this.controls.maxDistance=13;this.controls.minPolarAngle=.18;this.controls.maxPolarAngle=Math.PI/2-.025;this.controls.autoRotateSpeed=.7;this.controls.target.set(0,.76,0);this.resetCamera();
  this.hemi=new THREE.HemisphereLight('#fff5e5','#776d68',2.4);this.scene.add(this.hemi);
  this.key=new THREE.DirectionalLight('#fff6e9',4.2);this.key.position.set(-4,7,-4);this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);Object.assign(this.key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:25});this.key.shadow.bias=-.0002;this.key.shadow.normalBias=.02;this.scene.add(this.key);
  this.rim=new THREE.DirectionalLight('#d8e4ef',2.0);this.rim.position.set(4,4,3);this.scene.add(this.rim);
  const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.035).texture;this.scene.environment=this.environment;room.dispose();pmrem.dispose();
  this.floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:'#e4ddd2',roughness:.96,metalness:0}));this.floor.rotation.x=-Math.PI/2;this.floor.position.y=-.016;this.floor.receiveShadow=true;this.scene.add(this.floor);
  this.makeRoad();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
  this.lastFrame=0;this.renderFrame=this.renderFrame.bind(this);this.raf=requestAnimationFrame(this.renderFrame);
 }
 makeRoad(){
  this.road=new THREE.Group();this.road.visible=false;this.scene.add(this.road);
  const surface=new THREE.Mesh(new THREE.PlaneGeometry(12,150),new THREE.MeshStandardMaterial({color:'#525552',roughness:.98}));surface.rotation.x=-Math.PI/2;surface.position.y=-.01;surface.receiveShadow=true;this.road.add(surface);
  for(const x of [-5.5,5.5]){const edge=new THREE.Mesh(new THREE.PlaneGeometry(.12,150),new THREE.MeshBasicMaterial({color:'#b5b29f'}));edge.rotation.x=-Math.PI/2;edge.position.set(x,-.002,0);this.road.add(edge);}
  this.moving=[];const stripeMaterial=new THREE.MeshBasicMaterial({color:'#e4dbc7'});
  for(let i=0;i<28;i++){const stripe=new THREE.Mesh(new THREE.PlaneGeometry(.11,2.5),stripeMaterial);stripe.rotation.x=-Math.PI/2;stripe.position.set(2.3,.001,-70+i*5);this.road.add(stripe);this.moving.push({mesh:stripe,start:stripe.position.z});}
  const poleMat=new THREE.MeshStandardMaterial({color:'#a5a495',roughness:.65}),trunkMat=new THREE.MeshStandardMaterial({color:'#635b51',roughness:1}),leafMat=new THREE.MeshStandardMaterial({color:'#738171',roughness:1});
  for(let i=0;i<24;i++){
   const side=i%2?1:-1,post=new THREE.Group();const stem=new THREE.Mesh(new THREE.BoxGeometry(.065,.7,.065),poleMat);stem.position.y=.35;post.add(stem);const cap=new THREE.Mesh(new THREE.BoxGeometry(.08,.13,.08),new THREE.MeshBasicMaterial({color:side>0?'#d2bf91':'#f0e6ce'}));cap.position.y=.57;post.add(cap);post.position.set(side*5.25,0,-70+Math.floor(i/2)*12);this.road.add(post);this.moving.push({mesh:post,start:post.position.z});
   const tree=new THREE.Group(),trunk=new THREE.Mesh(new THREE.CylinderGeometry(.09,.15,1.5,7),trunkMat);trunk.position.y=.75;tree.add(trunk);const foliage=new THREE.Mesh(new THREE.ConeGeometry(1.1,3.8,7),leafMat);foliage.position.y=2.7;tree.add(foliage);tree.position.set(side*(8+(i%3)*1.8),0,-68+Math.floor(i/2)*12);tree.scale.setScalar(.8+(i%5)*.13);this.road.add(tree);this.moving.push({mesh:tree,start:tree.position.z});
  }
 }
 async load(){
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [gltf,mask]=await Promise.all([loader.loadAsync('./assets/model/juniper.glb'),new THREE.TextureLoader().loadAsync('./assets/model/template.png')]);
  this.mask=mask;mask.colorSpace=THREE.NoColorSpace;mask.flipY=true;
  this.car=gltf.scene;this.car.updateMatrixWorld(true);const meshes=[];this.car.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const tireCenters=meshes.filter(m=>m.material.name==='tire_rubber').map(m=>new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()));
  for(const center of tireCenters){const group=new THREE.Group();group.name='wheel_'+this.wheels.length;group.position.copy(center);this.car.add(group);this.wheels.push(group);}
  const dummy=new THREE.DataTexture(new Uint8Array([220,216,204,255]),1,1);dummy.needsUpdate=true;dummy.colorSpace=THREE.SRGBColorSpace;
  this.uniforms={wrapAtlas:{value:dummy},wrapMask:{value:mask},wrapBase:{value:new THREE.Color('#e0dacf')}};
  for(const mesh of meshes){
   mesh.castShadow=true;mesh.receiveShadow=true;const role=mesh.material.name;const original=mesh.material;
   if(role==='exterior_paint'){
    const material=new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:.04,roughness:.48,clearcoat:.25,clearcoatRoughness:.3,envMapIntensity:.55,side:THREE.DoubleSide});
    material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,this.uniforms);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWrapP;\nvarying vec3 vWrapN;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWrapP=position;vWrapN=normal;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+projection).replace('#include <map_fragment>',`vec2 atlasUV=wrapProjection(vWrapP,normalize(vWrapN));vec4 ink=texture2D(wrapAtlas,atlasUV);float painted=smoothstep(0.02,0.13,texture2D(wrapMask,atlasUV).r);diffuseColor.rgb=mix(wrapBase,ink.rgb,painted);`);};material.customProgramCacheKey=()=> 'juniper-atlas-projection-v1';mesh.material=material;this.paintMaterials.push(material);
   }else{
    mesh.material=original.clone();const m=mesh.material;
    if(role==='glass'){m.color.set('#172632');m.transparent=true;m.opacity=.69;m.depthWrite=false;m.metalness=.15;m.roughness=.16;}
    if(role==='wheel_finish'){m.color.set('#373b3e');m.metalness=.72;m.roughness=.28;}
    if(role==='tire_rubber'){m.color.set('#202326');m.roughness=.93;}
    if(role==='signature_led'||role==='taillight_led'){m.emissive?.set('#000000');m.emissiveIntensity=0;m.color.set('#252d35');m.transparent=false;m.opacity=1;}
    if(role==='headlight_led'){m.emissive?.set('#e4edf2');m.emissiveIntensity=.6;this.lamps.push(m);}
    if(/^(tire_rubber|wheel_finish|brake_rotor)$/.test(role)&&this.wheels.length){const center=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());const nearest=[...this.wheels].sort((a,b)=>a.position.distanceTo(center)-b.position.distanceTo(center))[0];if(nearest.position.distanceTo(center)<.62)nearest.attach(mesh);}
   }
  }
  this.scene.add(this.car);this.modelLoaded=true;this.setLighting('studio');this.resize();return this;
 }
 async setDesign(design){
  if(this.currentId===design.id)return;const token=++this.designToken;const texture=await new THREE.TextureLoader().loadAsync(design.wrap);if(token!==this.designToken){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=true;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.uniforms.wrapAtlas.value=texture;this.uniforms.wrapBase.value.set(design.base||'#c3b89e');this.texture?.dispose();this.texture=texture;this.currentId=design.id;this.resetCamera();
 }
 setActive(active){this.active=active;this.lastFrame=0;}
 setMode(mode){this.mode=mode;this.controls.autoRotate=mode==='orbit';this.road.visible=mode==='drive';this.setLighting(this.lighting||'studio');if(this.car){this.car.position.y=0;this.car.rotation.z=0;}this.controls.update();}
 setSpeed(speed){this.speed=speed;}
 setLighting(name){this.lighting=name;const settings={studio:{bg:'#eae5dd',key:'#fff6e9',fill:'#d8e4ef',exposure:.95,keyPower:2.3,hemi:1.2,rim:1.1,env:.65},sunset:{bg:'#d9b8a2',key:'#ffcf97',fill:'#b9c4eb',exposure:.88,keyPower:2.6,hemi:.8,rim:.9,env:.5},night:{bg:'#202736',key:'#abc4ff',fill:'#dfbddc',exposure:.9,keyPower:1.6,hemi:.35,rim:.7,env:.2}}[name];this.scene.background.set(settings.bg);this.scene.fog.color.set(settings.bg);this.scene.environmentIntensity=settings.env;this.key.color.set(settings.key);this.key.intensity=settings.keyPower;this.rim.color.set(settings.fill);this.rim.intensity=settings.rim;this.hemi.intensity=settings.hemi;this.renderer.toneMappingExposure=settings.exposure;this.floor.material.color.set(this.mode==='drive'?(name==='night'?'#18251e':'#6e7c64'):name==='night'?'#252936':name==='sunset'?'#bcaa96':'#e4ddd2');this.lamps.forEach(m=>m.emissiveIntensity=name==='night'?2.2:.65);}
 resetCamera(){this.camera.position.set(-4.25,2.15,-4.85);this.controls.target.set(0,.77,0);this.controls.update();}
 resize(){const box=this.host.getBoundingClientRect();if(box.width<1||box.height<1)return;this.camera.aspect=box.width/box.height;this.camera.updateProjectionMatrix();this.renderer.setSize(box.width,box.height,false);}
 renderFrame(time){this.raf=requestAnimationFrame(this.renderFrame);if(!this.active)return;const dt=this.lastFrame?Math.min((time-this.lastFrame)/1000,.05):0;this.lastFrame=time;this.elapsed+=dt;if(this.mode==='drive'){const metersPerSecond=this.speed/3.6;for(const wheel of this.wheels)wheel.rotation.x-=metersPerSecond/.36*dt;for(const item of this.moving){item.mesh.position.z+=metersPerSecond*dt;if(item.mesh.position.z>65)item.mesh.position.z-=140;}if(this.car){this.car.position.y=Math.sin(this.elapsed*7)*.003;this.car.rotation.z=Math.sin(this.elapsed*1.6)*.002;}}this.controls.update(dt);this.renderer.render(this.scene,this.camera);}
 dispose(){cancelAnimationFrame(this.raf);this.observer.disconnect();this.controls.dispose();this.texture?.dispose();this.mask?.dispose();this.environment.dispose();this.renderer.dispose();}
}
