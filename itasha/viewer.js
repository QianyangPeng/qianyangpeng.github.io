import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

// Each connected shell maps to its own Tesla atlas island. Portrait-bearing doors
// use the same exported source crops before masking, with a shared equal-scale
// projection so a different community mesh cannot bend faces to its contours.
const projection=/* glsl */`
uniform sampler2D wrapAtlas;
uniform sampler2D panelLookup;
uniform sampler2D surfaceLookup;
uniform sampler2D doorArtwork;
varying vec3 vPanelCoord;
varying vec3 vBodyPosition;
vec2 wrapProjection(vec3 p){
 float along=clamp(p.x,0.0,1.0)*1023.0;
 float row=(floor(p.z+0.5)+0.5)/32.0;
 float index=floor(along);
 vec4 first=texture2D(panelLookup,vec2((index+0.5)/1024.0,row));
 vec4 second=texture2D(panelLookup,vec2((min(index+1.0,1023.0)+0.5)/1024.0,row));
 vec4 bounds=mix(first,second,fract(along));
 vec2 surface=mix(texture2D(surfaceLookup,vec2((index+0.5)/1024.0,row)).rg,texture2D(surfaceLookup,vec2((min(index+1.0,1023.0)+0.5)/1024.0,row)).rg,fract(along));
 float across=clamp((p.y-surface.x)/max(surface.y-surface.x,0.0001),0.0,1.0);
 vec2 atlas=mix(bounds.xy,bounds.zw,across);
 return vec2(atlas.x,1.0-atlas.y);
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
  const [gltf,mapping,lookup,surface]=await Promise.all([loader.loadAsync('./assets/model/juniper.glb'),fetch('./assets/model/panel-mapping.json?v=2').then(r=>{if(!r.ok)throw Error('Panel mapping unavailable');return r.json();}),fetch('./assets/model/panel-lookup.bin?v=2').then(r=>{if(!r.ok)throw Error('Panel lookup unavailable');return r.arrayBuffer();}),fetch('./assets/model/surface-lookup.bin?v=2').then(r=>{if(!r.ok)throw Error('Surface lookup unavailable');return r.arrayBuffer();})]);
  this.panelLookup=new THREE.DataTexture(new Float32Array(lookup),mapping.lookupWidth,mapping.lookupHeight,THREE.RGBAFormat,THREE.FloatType);this.panelLookup.needsUpdate=true;this.panelLookup.minFilter=THREE.NearestFilter;this.panelLookup.magFilter=THREE.NearestFilter;this.mappingVersion=mapping.version;this.mappedPanels=mapping.panels.length;
  this.surfaceLookup=new THREE.DataTexture(new Float32Array(surface),mapping.lookupWidth,mapping.lookupHeight,THREE.RGBAFormat,THREE.FloatType);this.surfaceLookup.needsUpdate=true;this.surfaceLookup.minFilter=THREE.NearestFilter;this.surfaceLookup.magFilter=THREE.NearestFilter;
  this.car=gltf.scene;this.car.updateMatrixWorld(true);const meshes=[];this.car.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const tireCenters=meshes.filter(m=>m.material.name==='tire_rubber').map(m=>new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()));
  for(const center of tireCenters){const group=new THREE.Group();group.name='wheel_'+this.wheels.length;group.position.copy(center);this.car.add(group);this.wheels.push(group);}
  const dummy=new THREE.DataTexture(new Uint8Array([220,216,204,255]),1,1);dummy.needsUpdate=true;dummy.colorSpace=THREE.SRGBColorSpace;
  this.uniforms={wrapAtlas:{value:dummy},panelLookup:{value:this.panelLookup},surfaceLookup:{value:this.surfaceLookup}};
  this.uniforms.doorArtwork={value:dummy};
  for(const mesh of meshes){
   mesh.castShadow=true;mesh.receiveShadow=true;const role=mesh.material.name;const original=mesh.material;
   const meshIndex=gltf.parser.associations.get(mesh)?.meshes,coordinates=mapping.geometries.find(g=>g.mesh===meshIndex);
   if(role==='exterior_paint'&&coordinates){
    if(mesh.geometry.attributes.position.count!==coordinates.count)throw Error('Model and panel map differ');
    const bytes=Uint8Array.from(atob(coordinates.coordinates),c=>c.charCodeAt(0));mesh.geometry.setAttribute('panelCoord',new THREE.BufferAttribute(new Float32Array(bytes.buffer),3));
    const material=new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:.04,roughness:.48,clearcoat:.25,clearcoatRoughness:.3,envMapIntensity:.55,side:THREE.DoubleSide});
    material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,this.uniforms);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 panelCoord;\nvarying vec3 vPanelCoord;\nvarying vec3 vBodyPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPanelCoord=panelCoord;vBodyPosition=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+projection).replace('#include <map_fragment>',`float panel=floor(vPanelCoord.z+0.5);
     if(panel>=3.0&&panel<=6.0){
      float rightSide=mod(panel,2.0)<0.5?1.0:0.0;
      float horizontal=(vBodyPosition.z+1.005)/2.32;
      float physicalHeight=mix(2.32*192.0/446.0,2.32*190.0/447.0,rightSide);
      float vertical=clamp((0.69+physicalHeight*0.5-vBodyPosition.y)/physicalHeight,0.001,0.999);
      vec2 doorUV=vec2(mix(horizontal,1.0-horizontal,rightSide),1.0-(rightSide+vertical)*0.5);
      diffuseColor.rgb=texture2D(doorArtwork,doorUV).rgb;
     }else{vec2 atlasUV=wrapProjection(vPanelCoord);diffuseColor.rgb=texture2D(wrapAtlas,atlasUV).rgb;}`);};material.customProgramCacheKey=()=> 'juniper-independent-panels-v3';mesh.material=material;this.paintMaterials.push(material);
   }else{
    mesh.material=original.clone();const m=mesh.material;
    if(role==='exterior_paint'){m.color.set('#20252a');m.metalness=.04;m.roughness=.66;}
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
  if(this.currentId===design.id)return;const token=++this.designToken;const [texture,doors]=await Promise.all([new THREE.TextureLoader().loadAsync(design.wrap),new THREE.TextureLoader().loadAsync(design.previewDoors)]);if(token!==this.designToken){texture.dispose();doors.dispose();return;}for(const map of [texture,doors]){map.colorSpace=THREE.SRGBColorSpace;map.flipY=true;map.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());}this.uniforms.wrapAtlas.value=texture;this.uniforms.doorArtwork.value=doors;this.texture?.dispose();this.doorTexture?.dispose();this.texture=texture;this.doorTexture=doors;this.currentId=design.id;this.resetCamera();
 }
 setActive(active){this.active=active;this.lastFrame=0;}
 setMode(mode){this.mode=mode;this.controls.autoRotate=mode==='orbit';this.road.visible=mode==='drive';this.setLighting(this.lighting||'studio');if(this.car){this.car.position.y=0;this.car.rotation.z=0;}this.controls.update();}
 setSpeed(speed){this.speed=speed;}
 setLighting(name){this.lighting=name;const settings={studio:{bg:'#eae5dd',key:'#fff6e9',fill:'#d8e4ef',exposure:.95,keyPower:2.3,hemi:1.2,rim:1.1,env:.65},sunset:{bg:'#d9b8a2',key:'#ffcf97',fill:'#b9c4eb',exposure:.88,keyPower:2.6,hemi:.8,rim:.9,env:.5},night:{bg:'#202736',key:'#abc4ff',fill:'#dfbddc',exposure:.9,keyPower:1.6,hemi:.35,rim:.7,env:.2}}[name];this.scene.background.set(settings.bg);this.scene.fog.color.set(settings.bg);this.scene.environmentIntensity=settings.env;this.key.color.set(settings.key);this.key.intensity=settings.keyPower;this.rim.color.set(settings.fill);this.rim.intensity=settings.rim;this.hemi.intensity=settings.hemi;this.renderer.toneMappingExposure=settings.exposure;this.floor.material.color.set(this.mode==='drive'?(name==='night'?'#18251e':'#6e7c64'):name==='night'?'#252936':name==='sunset'?'#bcaa96':'#e4ddd2');this.lamps.forEach(m=>m.emissiveIntensity=name==='night'?2.2:.65);}
 resetCamera(){this.controls.target.set(0,.77,0);this.camera.position.set(-4.25,1.38,-4.85).multiplyScalar(this.fitScale||1).add(this.controls.target);this.controls.update();}
 resize(){const box=this.host.getBoundingClientRect();if(box.width<1||box.height<1)return;const aspect=box.width/box.height,nextScale=Math.max(1,Math.min(1.8,1.35/aspect)),priorScale=this.fitScale||1;if(nextScale!==priorScale){this.camera.position.sub(this.controls.target).multiplyScalar(nextScale/priorScale).add(this.controls.target);this.fitScale=nextScale;}this.camera.aspect=aspect;this.camera.updateProjectionMatrix();this.renderer.setSize(box.width,box.height,false);}
 renderFrame(time){this.raf=requestAnimationFrame(this.renderFrame);if(!this.active)return;const dt=this.lastFrame?Math.min((time-this.lastFrame)/1000,.05):0;this.lastFrame=time;this.elapsed+=dt;if(this.mode==='drive'){const metersPerSecond=this.speed/3.6;for(const wheel of this.wheels)wheel.rotation.x-=metersPerSecond/.36*dt;for(const item of this.moving){item.mesh.position.z+=metersPerSecond*dt;if(item.mesh.position.z>65)item.mesh.position.z-=140;}if(this.car){this.car.position.y=Math.sin(this.elapsed*7)*.003;this.car.rotation.z=Math.sin(this.elapsed*1.6)*.002;}}this.controls.update(dt);this.renderer.render(this.scene,this.camera);}
 dispose(){cancelAnimationFrame(this.raf);this.observer.disconnect();this.controls.dispose();this.texture?.dispose();this.doorTexture?.dispose();this.panelLookup?.dispose();this.surfaceLookup?.dispose();this.environment.dispose();this.renderer.dispose();}
}
