import * as THREE from './build/three.module.js';
import Stats from './build/stats.module.js';
import { GLTFLoader } from './build/GLTFLoader.js';
import {PMREMGenerator} from './build/PMREMGenerator.js';
import { DRACOLoader } from './build/DRACOLoader.js';
import { CarControls } from './build/CarControls.js';
import { PMREMCubeUVPacker } from './build/PMREMCubeUVPacker.js';

var camera, scene, renderer, stats, carModel, materialsLib, envMap;
var bodyMatSelect = document.getElementById( 'body-mat' );
var rimMatSelect = document.getElementById( 'rim-mat' );
var glassMatSelect = document.getElementById( 'glass-mat' );
var followCamera = document.getElementById( 'camera-toggle' );
var clock = new THREE.Clock();
var carControls = new CarControls();
carControls.turningRadius = 75;
var carParts = {
  body: [],
  rims: [],
  glass: [],
};
var damping = 5.0;
var distance = 5;
var cameraTarget = new THREE.Vector3();

function init() {
  var container = document.getElementById( 'container' );
  camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 200 );
  camera.position.set( 3.25, 2.0, - 5 );
  camera.lookAt( 0, 0.5, 0 );
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog( 0xd7cbb1, 1, 80 );
  var urls = [ 'px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg' ];
  var loader = new THREE.CubeTextureLoader().setPath( `textures/cube/skyboxsun25deg/` );
  loader.load( urls, function ( texture ) {
    scene.background = texture;
    var pmremGenerator = new PMREMGenerator( texture );
    pmremGenerator.update( renderer );
    var pmremCubeUVPacker = new PMREMCubeUVPacker( pmremGenerator.cubeLods );
    pmremCubeUVPacker.update( renderer );
    envMap = pmremCubeUVPacker.CubeUVRenderTarget.texture;
    pmremGenerator.dispose();
    pmremCubeUVPacker.dispose();
    //
    initCar();
    initMaterials();
    initMaterialSelectionMenus();
  } );

  var ground = new THREE.Mesh(
    new THREE.PlaneBufferGeometry( 2400, 2400 ),
    new THREE.ShadowMaterial( { color: 0x000000, opacity: 0.15, depthWrite: false }
    ) );
  ground.rotation.x = - Math.PI / 2;
  ground.receiveShadow = true;
  ground.renderOrder = 1;
  scene.add( ground );
  var grid = new THREE.GridHelper( 400, 40, 0x000000, 0x000000 );
  grid.material.opacity = 0.2;
  grid.material.depthWrite = false;
  grid.material.transparent = true;
  scene.add( grid );
  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.gammaOutput = true;
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  container.appendChild( renderer.domElement );
  stats = new Stats();
  container.appendChild( stats.dom );
  window.addEventListener( 'resize', onWindowResize, false );
  renderer.setAnimationLoop( function () {
    update();
    renderer.render( scene, camera );
  } );
}

function initCar() {
  DRACOLoader.setDecoderPath( `js/libs/draco/gltf/` );
  var loader = new GLTFLoader();
  loader.setDRACOLoader( new DRACOLoader() );
  loader.load( `models/ferrari.glb`, function ( gltf ) {
    carModel = gltf.scene.children[ 0 ];
    carControls.setModel( carModel );
    carModel.traverse( function ( child ) {
      if ( child.isMesh ) {
        child.material.envMap = envMap;
      }
    } );
    // shadow
    var texture = new THREE.TextureLoader().load( `models/ferrari_ao.png` );
    var shadow = new THREE.Mesh(
      new THREE.PlaneBufferGeometry( 0.655 * 4, 1.3 * 4 ).rotateX( - Math.PI / 2 ),
      new THREE.MeshBasicMaterial( { map: texture, opacity: 0.8, transparent: true } )
    );
    shadow.renderOrder = 2;
    carModel.add( shadow );
    scene.add( carModel );
    // car parts for material selection
    carParts.body.push( carModel.getObjectByName( 'body' ) );
    carParts.rims.push(
      carModel.getObjectByName( 'rim_fl' ),
      carModel.getObjectByName( 'rim_fr' ),
      carModel.getObjectByName( 'rim_rr' ),
      carModel.getObjectByName( 'rim_rl' ),
      carModel.getObjectByName( 'trim' ),
    );
    carParts.glass.push(
      carModel.getObjectByName( 'glass' ),
     );
    updateMaterials();
  } );
}

function initMaterials() {
  materialsLib = {
    main: [
      new THREE.MeshStandardMaterial( { color: 0xff4400, envMap: envMap, metalness: 0.9, roughness: 0.2, name: 'orange' } ),
      new THREE.MeshStandardMaterial( { color: 0x6577B3, envMap: envMap, metalness: 0.9, roughness: 0.2, name: 'blue' } ),
      new THREE.MeshStandardMaterial( { color: 0xA62C2B, envMap: envMap, metalness: 0.9, roughness: 0.2, name: 'red' } ),
      new THREE.MeshStandardMaterial( { color: 0x28282B, envMap: envMap, metalness: 0.9, roughness: 0.5, name: 'black' } ),
      new THREE.MeshStandardMaterial( { color: 0xffffff, envMap: envMap, metalness: 0.9, roughness: 0.5, name: 'white' } ),
      new THREE.MeshStandardMaterial( { color: 0xEDD94C, envMap: envMap, metalness: 0.9, roughness: 0.5, name: 'yellow' } ),
      new THREE.MeshStandardMaterial( { color: 0x555555, envMap: envMap, envMapIntensity: 2.0, metalness: 1.0, roughness: 0.2, name: 'metallic' } ),
    ],
    glass: [
      new THREE.MeshStandardMaterial( { color: 0xffffff, envMap: envMap, metalness: 1, roughness: 0, opacity: 0.2, transparent: true, premultipliedAlpha: true, name: 'clear' } ),
      new THREE.MeshStandardMaterial( { color: 0x000000, envMap: envMap, metalness: 1, roughness: 0, opacity: 0.2, transparent: true, premultipliedAlpha: true, name: 'smoked' } ),
      new THREE.MeshStandardMaterial( { color: 0x001133, envMap: envMap, metalness: 1, roughness: 0, opacity: 0.2, transparent: true, premultipliedAlpha: true, name: 'blue' } ),
    ],
  };
}

function initMaterialSelectionMenus() {
  function addOption( name, menu ) {
    var option = document.createElement( 'option' );
    option.text = name;
    option.value = name;
    menu.add( option );
  }
  materialsLib.main.forEach( function ( material ) {
    addOption( material.name, bodyMatSelect );
    addOption( material.name, rimMatSelect );
  } );
  materialsLib.glass.forEach( function ( material ) {
    addOption( material.name, glassMatSelect );
  } );
  bodyMatSelect.selectedIndex = 3;
  rimMatSelect.selectedIndex = 5;
  glassMatSelect.selectedIndex = 0;
  bodyMatSelect.addEventListener( 'change', updateMaterials );
  rimMatSelect.addEventListener( 'change', updateMaterials );
  glassMatSelect.addEventListener( 'change', updateMaterials );
}

// set materials to the current values of the selection menus
function updateMaterials() {
  var bodyMat = materialsLib.main[ bodyMatSelect.selectedIndex ];
  var rimMat = materialsLib.main[ rimMatSelect.selectedIndex ];
  var glassMat = materialsLib.glass[ glassMatSelect.selectedIndex ];
  carParts.body.forEach( part => part.material = bodyMat );
  carParts.rims.forEach( part => part.material = rimMat );
  carParts.glass.forEach( part => part.material = glassMat );
}
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

function update() {
  var delta = clock.getDelta();
  if ( carModel ) {
    carControls.update( delta / 3 );
    if ( carModel.position.length() > 200 ) {
      carModel.position.set( 0, 0, 0 );
      carControls.speed = 0;
    }
    if ( followCamera.checked ) {
      carModel.getWorldPosition( cameraTarget );
      cameraTarget.y = 2.5;
      cameraTarget.z += distance;
      camera.position.lerp( cameraTarget, delta * damping );
    } else {
      carModel.getWorldPosition( cameraTarget );
      cameraTarget.y += 0.5;
      camera.position.set( 3.25, 2.0, - 5 );
    }
    camera.lookAt( carModel.position );
  }
  stats.update();
}

init();
