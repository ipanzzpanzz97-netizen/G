import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import type { StormAnomaly, WeatherPreset } from '../game/types';
import type { RoomTextureSet } from './textures';

export interface ExteriorHandles {
  root: THREE.Group;
  sky: Sky;
  updateWeather: (
    weather: WeatherPreset,
    elapsed: number,
    dt: number,
    windX: number,
    windZ: number,
    lightningFlash: number,
  ) => void;
  spawnParticles: (x: number, y: number, z: number, colorHex: number, count: number, speedScale?: number) => void;
  stepParticles: (dt: number) => void;
  syncAnomalies: (anomalies: StormAnomaly[], elapsed: number) => void;
  dispose: () => void;
}

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export function buildExteriorAndParticles(textures: RoomTextureSet): ExteriorHandles {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const regMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // 1. Procedural Atmospheric Sky
  const sky = new Sky();
  sky.scale.setScalar(120);
  root.add(sky);

  // 2. Tropical Backyard Ground & Garden Wall (extending far beyond windows, never boxed in!)
  const yardMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0x4b6a34,
      roughness: 0.94,
    }),
  );
  const yard = new THREE.Mesh(regGeo(new THREE.CircleGeometry(65, 32)), yardMat);
  yard.rotation.x = -Math.PI / 2;
  yard.position.y = -0.15;
  yard.receiveShadow = true;
  root.add(yard);

  // Concrete garden walkway & low fence wall visible outside North window (00:05, 00:40)
  const pathMesh = new THREE.Mesh(
    regGeo(new THREE.BoxGeometry(12, 0.06, 2.2)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xb6b2a6, roughness: 0.9 })),
  );
  pathMesh.position.set(0, -0.11, -4.4);
  const gardenWall = new THREE.Mesh(
    regGeo(new THREE.BoxGeometry(18, 1.35, 0.25)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x9c998f, roughness: 0.88 })),
  );
  gardenWall.position.set(0, 0.52, -7.8);
  root.add(pathMesh, gardenWall);

  // Blue Plastic Water Tank visible outside North window (matching video 00:40!)
  const tankGroup = new THREE.Group();
  tankGroup.position.set(0.28, -0.12, -5.2);
  const tankStand = new THREE.Mesh(
    regGeo(new THREE.BoxGeometry(1.1, 0.65, 1.1)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x4b4540, roughness: 0.85 })),
  );
  tankStand.position.y = 0.325;
  const tankPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.50, 0.0),
    new THREE.Vector2(0.52, 0.25),
    new THREE.Vector2(0.49, 0.32),
    new THREE.Vector2(0.52, 0.42),
    new THREE.Vector2(0.52, 0.85),
    new THREE.Vector2(0.49, 0.92),
    new THREE.Vector2(0.52, 1.02),
    new THREE.Vector2(0.50, 1.24),
    new THREE.Vector2(0.38, 1.36),
    new THREE.Vector2(0.24, 1.38),
    new THREE.Vector2(0.24, 1.48),
    new THREE.Vector2(0.0, 1.48),
  ];
  const tankBody = new THREE.Mesh(
    regGeo(new THREE.LatheGeometry(tankPoints, 24)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x157fb8, roughness: 0.36 })),
  );
  tankBody.position.y = 0.65;
  const tankCap = new THREE.Mesh(
    regGeo(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 20)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x0c547d, roughness: 0.4 })),
  );
  tankCap.position.y = 2.13;
  tankGroup.add(tankStand, tankBody, tankCap);
  root.add(tankGroup);

  // Smooth multi-lobed tropical garden shrubs outside windows (no blocky dodecahedrons!)
  const bushMatA = regMat(new THREE.MeshStandardMaterial({ color: 0x3b6e28, roughness: 0.88 }));
  const bushMatB = regMat(new THREE.MeshStandardMaterial({ color: 0x4b8033, roughness: 0.84 }));
  const bushSpots: [number, number, number][] = [
    [-1.2, -3.5, 0.65],
    [-0.5, -4.2, 0.78],
    [0.9, -4.0, 0.72],
    [2.6, -0.8, 0.68],
    [2.8, 0.5, 0.74],
  ];
  bushSpots.forEach(([bx, bz, bs], idx) => {
    const shrub = new THREE.Group();
    shrub.position.set(bx, 0, bz);
    const main = new THREE.Mesh(regGeo(new THREE.SphereGeometry(bs, 16, 12)), idx % 2 === 0 ? bushMatA : bushMatB);
    main.scale.set(1.15, 0.75, 1.05);
    main.position.y = bs * 0.42;
    const lobe1 = new THREE.Mesh(regGeo(new THREE.SphereGeometry(bs * 0.68, 14, 10)), bushMatB);
    lobe1.scale.set(1.1, 0.85, 1.0);
    lobe1.position.set(-bs * 0.45, bs * 0.32, bs * 0.22);
    const lobe2 = new THREE.Mesh(regGeo(new THREE.SphereGeometry(bs * 0.62, 14, 10)), bushMatA);
    lobe2.position.set(bs * 0.48, bs * 0.28, -bs * 0.18);
    shrub.add(main, lobe1, lobe2);
    root.add(shrub);
  });

  // 3. Instanced Tropical Banana & Heliconia Leaves swaying outside both windows (matching 00:00, 00:04)
  const leafWindUniforms = { uTime: { value: 0 }, uWind: { value: 0.4 } };
  const trunkMat = regMat(new THREE.MeshStandardMaterial({ color: 0x564630, roughness: 0.92 }));
  const leafMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.leafMap,
      roughness: 0.56,
      side: THREE.DoubleSide,
    }),
  );
  leafMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = leafWindUniforms.uTime;
    shader.uniforms.uWind = leafWindUniforms.uWind;
    shader.vertexShader =
      `uniform float uTime;\nuniform float uWind;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float tip = clamp(uv.y, 0.0, 1.0);
         transformed.x += sin(uTime * 2.2 + position.y * 2.0) * 0.12 * tip * uWind;
         transformed.y -= abs(cos(uTime * 1.9)) * 0.06 * tip * uWind;`,
      );
  };

  const treeSpots: [number, number, number][] = [
    [-1.25, -3.65, 0.95],
    [-0.18, -4.15, 1.12],
    [0.95, -3.75, 0.92],
    [-2.4, -5.2, 1.2],
    [3.55, -1.35, 1.05],
    [3.75, 0.15, 1.0],
    [4.0, -3.1, 1.15],
  ];
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.05, 0.65, 0.03),
    new THREE.Vector3(-0.02, 1.35, -0.04),
    new THREE.Vector3(0.03, 1.95, 0.02),
  ]);
  const trunkGeo = regGeo(new THREE.TubeGeometry(trunkCurve, 10, 0.065, 10, false));

  // Tapered curved tropical banana leaf blade (not a square rectangle!)
  const leafGeo = regGeo(new THREE.PlaneGeometry(0.46, 1.42, 6, 10));
  leafGeo.translate(0, 0.71, 0);
  const lPos = leafGeo.attributes.position;
  for (let i = 0; i < lPos.count; i++) {
    const lx = lPos.getX(i);
    const ly = lPos.getY(i);
    const t = Math.max(0, Math.min(1, ly / 1.42));
    const widthProfile = Math.sin(Math.pow(t, 0.62) * Math.PI);
    lPos.setX(i, lx * (0.2 + widthProfile * 0.95));
    lPos.setZ(i, -Math.pow(t, 2.0) * 0.52 + Math.abs(lx) * 0.08);
  }
  leafGeo.computeVertexNormals();

  const leafCount = treeSpots.length * 10;
  const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  let li = 0;
  for (const [tx, tz, sc] of treeSpots) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(tx, -0.1, tz);
    trunk.rotation.y = tx * 1.1;
    trunk.scale.setScalar(sc);
    root.add(trunk);

    for (let b = 0; b < 10; b++) {
      const ang = (b * Math.PI * 2) / 10 + tx * 0.4;
      _dummy.position.set(tx, 1.65 * sc, tz);
      _dummy.rotation.set(0.45 + (b % 3) * 0.22, ang, 0);
      _dummy.scale.setScalar(sc * (0.85 + (b % 3) * 0.12));
      _dummy.updateMatrix();
      leafInst.setMatrixAt(li, _dummy.matrix);
      _color.setHSL(0.26 + (b % 3) * 0.02, 0.62, 0.40 + (b % 2) * 0.08);
      leafInst.setColorAt(li, _color);
      li++;
    }
  }
  leafInst.instanceMatrix.needsUpdate = true;
  if (leafInst.instanceColor) leafInst.instanceColor.needsUpdate = true;
  leafInst.computeBoundingSphere();
  root.add(leafInst);

  // 4. Outdoor Rain Streaks (InstancedMesh strictly outside the roofed room!)
  const rainCount = 260;
  const rainGeo = regGeo(new THREE.BoxGeometry(0.009, 0.55, 0.009));
  const rainMat = regMat(
    new THREE.MeshBasicMaterial({
      color: 0xc8e0f4,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );
  const rainInst = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
  rainInst.frustumCulled = false;
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    const onNorthSide = i < 150;
    rainPos[i * 3] = onNorthSide ? -3.5 + Math.random() * 8.5 : 2.1 + Math.random() * 3.8;
    rainPos[i * 3 + 1] = Math.random() * 5.0;
    rainPos[i * 3 + 2] = onNorthSide ? -2.2 - Math.random() * 4.5 : -2.6 + Math.random() * 5.5;
  }
  root.add(rainInst);

  // 5. Zero-GC Pooled Indoor Particle Ring Buffer (dust bursts, impact sparks, orb pop)
  const MAX_PARTICLES = 120;
  const pool: PooledParticle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: -10,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 1,
    size: 0.02,
  }));
  let poolHead = 0;
  const partGeo = regGeo(new THREE.DodecahedronGeometry(1, 0));
  const partMat = regMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const partInst = new THREE.InstancedMesh(partGeo, partMat, MAX_PARTICLES);
  partInst.frustumCulled = false;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    _dummy.position.set(0, -20, 0);
    _dummy.scale.setScalar(0.001);
    _dummy.updateMatrix();
    partInst.setMatrixAt(i, _dummy.matrix);
    partInst.setColorAt(i, _color.setHex(0xffffff));
  }
  partInst.instanceMatrix.needsUpdate = true;
  if (partInst.instanceColor) partInst.instanceColor.needsUpdate = true;
  root.add(partInst);

  // 6. Storm Wind-Gale Anomaly Visuals (max 2 concurrent)
  const anomalyMeshes: THREE.Group[] = [];
  const orbCoreMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0x72d8ff,
      emissive: new THREE.Color(0x2ca8ff),
      emissiveIntensity: 2.2,
      roughness: 0.15,
    }),
  );
  const orbRingMat = regMat(
    new THREE.MeshBasicMaterial({
      color: 0xff9b42,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    }),
  );
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(regGeo(new THREE.IcosahedronGeometry(0.16, 1)), orbCoreMat);
    const ring1 = new THREE.Mesh(regGeo(new THREE.TorusGeometry(0.24, 0.012, 8, 24)), orbRingMat);
    const ring2 = new THREE.Mesh(regGeo(new THREE.TorusGeometry(0.27, 0.01, 8, 24)), orbRingMat);
    ring2.rotation.x = Math.PI / 2;
    g.add(core, ring1, ring2);
    g.visible = false;
    root.add(g);
    anomalyMeshes.push(g);
  }

  const updateWeather = (
    weather: WeatherPreset,
    elapsed: number,
    dt: number,
    windX: number,
    windZ: number,
    lightningFlash: number,
  ) => {
    leafWindUniforms.uTime.value = elapsed;
    leafWindUniforms.uWind.value =
      weather === 'storm' ? 1.85 : weather === 'overcast' ? 1.0 : weather === 'night' ? 0.8 : 0.35;

    // Update procedural Sky uniforms
    const uniforms = sky.material.uniforms;
    const sunPos = new THREE.Vector3();
    let elev = 32;
    let turbidity = 4.5;
    let rayleigh = 1.6;
    if (weather === 'sunny') {
      elev = 34;
      turbidity = 3.2;
      rayleigh = 1.4;
    } else if (weather === 'overcast') {
      elev = 16;
      turbidity = 11.0;
      rayleigh = 3.2;
    } else if (weather === 'storm') {
      elev = 5 + lightningFlash * 25;
      turbidity = 16.0;
      rayleigh = 3.8;
    } else {
      elev = -4 + lightningFlash * 22;
      turbidity = 2.0;
      rayleigh = 0.4;
    }
    const phi = THREE.MathUtils.degToRad(90 - elev);
    const theta = THREE.MathUtils.degToRad(38);
    sunPos.setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition'].value.copy(sunPos);
    uniforms['turbidity'].value = turbidity;
    uniforms['rayleigh'].value = rayleigh;
    uniforms['mieCoefficient'].value = weather === 'sunny' ? 0.005 : 0.02;
    uniforms['mieDirectionalG'].value = 0.82;

    // Update rain streaks
    const rainActive = weather === 'storm' || weather === 'night' || weather === 'overcast';
    rainInst.visible = rainActive;
    if (rainActive) {
      const fallSpeed = weather === 'storm' ? 15.5 : weather === 'night' ? 11.0 : 6.5;
      const activeStreaks = weather === 'storm' ? rainCount : weather === 'night' ? 160 : 65;
      rainMat.opacity = weather === 'storm' ? 0.56 : weather === 'night' ? 0.42 : 0.22;
      const tiltZ = Math.atan2(windZ, fallSpeed) * 0.35;
      const tiltX = Math.atan2(windX, fallSpeed) * 0.35;
      for (let i = 0; i < rainCount; i++) {
        if (i >= activeStreaks) {
          _dummy.position.set(0, -30, 0);
          _dummy.scale.setScalar(0.001);
          _dummy.updateMatrix();
          rainInst.setMatrixAt(i, _dummy.matrix);
          continue;
        }
        rainPos[i * 3] += windX * 0.35 * dt;
        rainPos[i * 3 + 1] -= fallSpeed * dt;
        rainPos[i * 3 + 2] += windZ * 0.35 * dt;
        if (rainPos[i * 3 + 1] < 0) {
          rainPos[i * 3 + 1] = 4.6 + Math.random() * 0.6;
          const onNorth = i < 150;
          rainPos[i * 3] = onNorth ? -3.5 + Math.random() * 8.5 : 2.1 + Math.random() * 3.8;
          rainPos[i * 3 + 2] = onNorth ? -2.2 - Math.random() * 4.5 : -2.6 + Math.random() * 5.5;
        }
        _dummy.position.set(rainPos[i * 3], rainPos[i * 3 + 1], rainPos[i * 3 + 2]);
        _dummy.rotation.set(tiltZ, 0, -tiltX);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        rainInst.setMatrixAt(i, _dummy.matrix);
      }
      rainInst.instanceMatrix.needsUpdate = true;
    }
  };

  const spawnParticles = (x: number, y: number, z: number, colorHex: number, count: number, speedScale = 1) => {
    _color.setHex(colorHex);
    for (let i = 0; i < count; i++) {
      const slotIdx = poolHead;
      const p = pool[slotIdx];
      poolHead = (poolHead + 1) % MAX_PARTICLES;
      p.active = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = (Math.random() - 0.5) * 3.2 * speedScale;
      p.vy = (0.8 + Math.random() * 2.4) * speedScale;
      p.vz = (Math.random() - 0.5) * 3.2 * speedScale;
      p.maxLife = 0.32 + Math.random() * 0.32;
      p.life = p.maxLife;
      p.size = 0.018 + Math.random() * 0.022;
      partInst.setColorAt(slotIdx, _color);
    }
    if (partInst.instanceColor) partInst.instanceColor.needsUpdate = true;
  };

  const stepParticles = (dt: number) => {
    let anyUpdated = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[i];
      if (!p.active) continue;
      anyUpdated = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -20, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        partInst.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.vy -= 9.5 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.01, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const s = p.size * (p.life / p.maxLife);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 6, p.life * 4, 0);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      partInst.setMatrixAt(i, _dummy.matrix);
    }
    if (anyUpdated) partInst.instanceMatrix.needsUpdate = true;
  };

  const syncAnomalies = (anomalies: StormAnomaly[], elapsed: number) => {
    for (let i = 0; i < anomalyMeshes.length; i++) {
      const g = anomalyMeshes[i];
      const a = anomalies[i];
      if (!a || !a.active) {
        g.visible = false;
        continue;
      }
      g.visible = true;
      g.position.set(a.x, a.y, a.z);
      g.children[0].rotation.y = elapsed * 3.4;
      g.children[1].rotation.z = elapsed * 5.2;
      g.children[2].rotation.y = -elapsed * 4.5;
      // Telegraph scale pulse as charge approaches 6.0s!
      const pulse = 1 + Math.max(0, (a.chargeTime - 4.0) * 0.22) * Math.sin(elapsed * 22);
      g.scale.setScalar(pulse);
    }
  };

  return {
    root,
    sky,
    updateWeather,
    spawnParticles,
    stepParticles,
    syncAnomalies,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
