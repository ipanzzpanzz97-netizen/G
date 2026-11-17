import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import type { WeatherPreset } from '../game/types';

export interface LightingRigHandles {
  updateLighting: (
    weather: WeatherPreset,
    tubeLightOn: boolean,
    tubeFlickerTimer: number,
    lightningFlash: number,
    elapsed: number,
  ) => void;
  renderFrame: () => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createLightingRig(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  isSoftwareGl: boolean,
): LightingRigHandles {
  // 1. Studio Environment Reflections kept subtle so matte walls/floors keep deep shadow contrast
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.28;
  pmremGenerator.dispose();

  // Horizon-matched atmospheric fog
  const fog = new THREE.FogExp2(0x9fb0a8, 0.012);
  scene.fog = fog;

  // 2. Global Illumination Approximation: Cool Window Daylight vs Warm Floor Bounce
  const hemiLight = new THREE.HemisphereLight(0xa7c4d6, 0x5d5242, 0.42);
  hemiLight.position.set(0, 3.0, 0);
  scene.add(hemiLight);

  // 3. Key Directional Sunlight (casts window-grille shadows into the bedroom)
  const sunLight = new THREE.DirectionalLight(0xffe7c2, 1.55);
  sunLight.position.set(2.4, 3.4, -3.6);
  sunLight.target.position.set(-0.3, 0.4, 0.3);
  scene.add(sunLight.target);
  if (!isSoftwareGl) {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 14;
    sunLight.shadow.camera.left = -3.6;
    sunLight.shadow.camera.right = 3.6;
    sunLight.shadow.camera.top = 3.6;
    sunLight.shadow.camera.bottom = -3.6;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    sunLight.shadow.radius = 2.5;
  }
  scene.add(sunLight);

  // 4. Curtain-Tinted Indirect Bounce Lights (rich local orange/peach tint, tight decay)
  const peachBounce = new THREE.PointLight(0xf29a76, 0.38, 3.4, 1.8);
  peachBounce.position.set(-0.1, 1.45, -1.45);
  scene.add(peachBounce);

  const orangeBounce = new THREE.PointLight(0xe85a24, 0.58, 3.6, 1.7);
  orangeBounce.position.set(1.25, 1.4, -0.35);
  scene.add(orangeBounce);

  // Doorway Fluorescent Tube Light (switchable!)
  const tubeLight = new THREE.PointLight(0xdcebf7, 0.55, 5.2, 1.6);
  tubeLight.position.set(-1.32, 2.08, 1.02);
  scene.add(tubeLight);

  // Hallway dim warm light outside door
  const hallLight = new THREE.PointLight(0xd9b592, 0.32, 3.5, 1.7);
  hallLight.position.set(-2.35, 2.1, 0.95);
  scene.add(hallLight);

  // 5. Subtle Volumetric God-Ray Sunbeam Shafts through North & East Windows
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0xffe4b8,
    transparent: true,
    opacity: 0.028,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const northShaftGeo = new THREE.PlaneGeometry(1.45, 2.5);
  const northShaft = new THREE.Mesh(northShaftGeo, rayMat);
  northShaft.position.set(-0.32, 1.15, -1.05);
  northShaft.rotation.x = -0.68;
  northShaft.rotation.y = 0.25;
  scene.add(northShaft);

  const eastShaftGeo = new THREE.PlaneGeometry(1.1, 2.2);
  const eastShaft = new THREE.Mesh(eastShaftGeo, rayMat);
  eastShaft.position.set(0.95, 1.1, -0.35);
  eastShaft.rotation.z = 0.72;
  eastShaft.rotation.y = Math.PI / 2;
  scene.add(eastShaft);

  // 6. GPU Post-Processing Pipeline (skipped cleanly on Software WebGL)
  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;

  if (!isSoftwareGl) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.14,
      0.45,
      0.98,
    );
    composer.addPass(bloomPass);

    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms['offset'].value = 1.02;
    vignettePass.uniforms['darkness'].value = 0.52;
    composer.addPass(vignettePass);

    composer.addPass(new OutputPass());
  }

  const updateLighting = (
    weather: WeatherPreset,
    tubeLightOn: boolean,
    tubeFlickerTimer: number,
    lightningFlash: number,
    elapsed: number,
  ) => {
    if (weather === 'sunny') {
      sunLight.color.setHex(0xffe7c2);
      sunLight.intensity = 1.65;
      hemiLight.color.setHex(0x9fc4de);
      hemiLight.groundColor.setHex(0x6b5d4a);
      hemiLight.intensity = 0.44;
      peachBounce.intensity = 0.42;
      orangeBounce.intensity = 0.68;
      fog.color.setHex(0xa8b9b0);
      rayMat.opacity = 0.032;
    } else if (weather === 'overcast') {
      sunLight.color.setHex(0xb8cbd6);
      sunLight.intensity = 0.82;
      hemiLight.color.setHex(0x88a2b3);
      hemiLight.groundColor.setHex(0x524b40);
      hemiLight.intensity = 0.38;
      peachBounce.intensity = 0.28;
      orangeBounce.intensity = 0.46;
      fog.color.setHex(0x7c8a88);
      rayMat.opacity = 0.01;
    } else if (weather === 'storm') {
      const flash = lightningFlash * lightningFlash;
      sunLight.color.setHex(flash > 0.1 ? 0xd9ecff : 0x5c768f);
      sunLight.intensity = 0.45 + flash * 4.2;
      hemiLight.color.setHex(0x556e85);
      hemiLight.groundColor.setHex(0x3b362f);
      hemiLight.intensity = 0.28 + flash * 0.95;
      peachBounce.intensity = 0.2 + flash * 0.65;
      orangeBounce.intensity = 0.34 + flash * 0.8;
      fog.color.setHex(0x414d54);
      rayMat.opacity = 0.005 + flash * 0.065;
    } else {
      // Night rain
      const flash = lightningFlash * lightningFlash;
      sunLight.color.setHex(flash > 0.1 ? 0xc2e2ff : 0x324b6e);
      sunLight.intensity = 0.22 + flash * 3.8;
      hemiLight.color.setHex(0x21334d);
      hemiLight.groundColor.setHex(0x241e19);
      hemiLight.intensity = 0.2 + flash * 0.75;
      peachBounce.intensity = 0.12 + flash * 0.45;
      orangeBounce.intensity = 0.2 + flash * 0.55;
      fog.color.setHex(0x101721);
      rayMat.opacity = 0.004 + flash * 0.05;
    }

    // Fluorescent doorway tube flicker & intensity (brighter at night/storm, restrained in daylight)
    if (!tubeLightOn) {
      tubeLight.intensity = 0;
    } else if (tubeFlickerTimer > 0) {
      const flick = Math.sin(elapsed * 65) > 0 ? 1.25 : 0.15;
      tubeLight.intensity = flick;
    } else {
      tubeLight.intensity = weather === 'night' || weather === 'storm' ? 1.35 : 0.52;
    }
  };

  const renderFrame = () => {
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  };

  const resize = (width: number, height: number) => {
    if (composer) {
      composer.setSize(width, height);
    }
    if (bloomPass) {
      bloomPass.resolution.set(width, height);
    }
  };

  return {
    updateLighting,
    renderFrame,
    resize,
    dispose: () => {
      envTex.dispose();
      rayMat.dispose();
      northShaftGeo.dispose();
      eastShaftGeo.dispose();
      composer?.dispose();
    },
  };
}
