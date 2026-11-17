import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  DOOR_HEIGHT,
  DOOR_MAX_Z,
  DOOR_MIN_Z,
  ROOM_MAX_X,
  ROOM_MAX_Z,
  ROOM_MIN_X,
  ROOM_MIN_Z,
  ceilingHeightAt,
} from '../game/physics';
import type { RoomTextureSet } from './textures';

export interface InteractableTarget {
  id: string;
  kind: 'prop' | 'fan' | 'tubeLight' | 'northWindow' | 'eastWindow';
  label: string;
  mesh: THREE.Object3D;
}

export interface RoomSceneHandles {
  root: THREE.Group;
  propMeshes: Map<string, THREE.Object3D>;
  interactables: InteractableTarget[];
  fanRotor: THREE.Group;
  tubeEmissiveMat: THREE.MeshStandardMaterial;
  northWindowSash: THREE.Group;
  eastWindowSash: THREE.Group;
  rainGlassUniforms: { uTime: { value: number }; uRain: { value: number } };
  curtainWindUniforms: { uTime: { value: number }; uWind: { value: number } };
  basketTargetRing: THREE.Mesh;
  dispose: () => void;
}

function addWindSwayShader(
  mat: THREE.MeshStandardMaterial,
  uniforms: { uTime: { value: number }; uWind: { value: number } },
  anchorTopY: number,
  ampScale: number,
): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader =
      `uniform float uTime;\nuniform float uWind;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float drop = clamp((${anchorTopY.toFixed(2)} - position.y) * 0.55, 0.0, 1.0);
         float wave = sin(uTime * 2.5 + position.y * 3.1 + position.x * 2.4) * 0.022
                    + sin(uTime * 4.5 + position.z * 3.5) * 0.008;
         transformed.z += wave * drop * uWind * ${ampScale.toFixed(2)};
         transformed.x += wave * 0.35 * drop * uWind * ${ampScale.toFixed(2)};`,
      );
  };
}

export function buildBedroomScene(textures: RoomTextureSet, isSoftwareGl: boolean): RoomSceneHandles {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const propMeshes = new Map<string, THREE.Object3D>();
  const interactables: InteractableTarget[] = [];

  const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const regMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Sculpted organic pillow geometry (smooth RoundedBox base + soft pillow puff & center dip)
  const createPillowGeo = (w: number, h: number, d: number, crease = 0.0): THREE.BufferGeometry => {
    const rad = Math.min(w, h, d) * 0.36;
    const geo = regGeo(new RoundedBoxGeometry(w, h, d, 5, rad));
    const pos = geo.attributes.position;
    const hw = w * 0.5;
    const hd = d * 0.5;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      let y = pos.getY(i);
      const z = pos.getZ(i);
      const nx = x / Math.max(0.001, hw);
      const nz = z / Math.max(0.001, hd);
      const ny = y / Math.max(0.001, h * 0.5);
      const centerBell = Math.exp(-(nx * nx + nz * nz) * 1.4);
      const fold = Math.sin(nx * 4.5 + nz * 3.0) * h * 0.03 * Math.abs(ny);
      y += ny * centerBell * h * (0.075 - crease * 0.28) + (ny > 0 ? fold : 0);
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  };

  // Sculpted folded/crumpled cloth & soft bag geometry (smooth RoundedBox base + soft drapes)
  const createFoldedClothGeo = (w: number, h: number, d: number, foldAmp = 0.16): THREE.BufferGeometry => {
    const rad = Math.min(w, h, d) * 0.34;
    const geo = regGeo(new RoundedBoxGeometry(w, h, d, 5, rad));
    const pos = geo.attributes.position;
    const hw = w * 0.5;
    const hd = d * 0.5;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const nx = x / Math.max(0.001, hw);
      const nz = z / Math.max(0.001, hd);
      const wrinkle = Math.sin(nx * 5.2 + nz * 3.6) * Math.cos(nz * 4.2) * h * foldAmp;
      y += y > 0 ? wrinkle : -wrinkle * 0.2;
      x += Math.sin(nz * 3.2) * w * 0.035;
      z += Math.cos(nx * 3.0) * d * 0.035;
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const contactShadowMat = regMat(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadowTex,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  const addContactShadow = (w: number, d: number, x: number, y: number, z: number, opacity = 0.55) => {
    const mat = opacity === 0.58 ? contactShadowMat : regMat(contactShadowMat.clone());
    if (opacity !== 0.58) mat.opacity = opacity;
    const m = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(w, d)), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 1;
    root.add(m);
  };

  const rainGlassUniforms = { uTime: { value: 0 }, uRain: { value: 0 } };
  const curtainWindUniforms = { uTime: { value: 0 }, uWind: { value: 0.4 } };

  // =========================================================================
  // 1. ARCHITECTURAL SHELL (Floors, Olive-Moss Walls, Sloped Ceiling, Trim)
  // =========================================================================
  const creamFloorMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.floorMap,
      roughnessMap: textures.floorRoughMap,
      bumpMap: textures.floorBumpMap,
      bumpScale: 0.01,
      roughness: 0.46,
      metalness: 0.03,
      envMapIntensity: 0.32,
    }),
  );
  const floorMesh = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(3.44, 3.84)), creamFloorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  root.add(floorMesh);

  // Hallway terracotta floor (outside West doorway)
  const hallFloorMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.hallFloorMap,
      roughness: 0.52,
      metalness: 0.02,
      envMapIntensity: 0.25,
    }),
  );
  const hallFloor = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(1.65, 2.2)), hallFloorMat);
  hallFloor.rotation.x = -Math.PI / 2;
  hallFloor.position.set(-2.52, -0.002, 0.95);
  hallFloor.receiveShadow = true;
  root.add(hallFloor);

  // Olive-moss plaster wall material
  const wallMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.wallMap,
      bumpMap: textures.wallBumpMap,
      bumpScale: 0.014,
      roughness: 0.9,
      metalness: 0.0,
      envMapIntensity: 0.14,
    }),
  );

  // South Wall (z = +1.90, behind study desk)
  const southWall = new THREE.Mesh(regGeo(new THREE.BoxGeometry(3.52, 2.95, 0.12)), wallMat);
  southWall.position.set(0, 1.475, ROOM_MAX_Z + 0.06);
  southWall.receiveShadow = true;
  root.add(southWall);

  // North Wall (z = -1.90) with window cutout: x in [-1.10, 0.45], y in [0.88, 2.13]
  const nWinMinX = -1.10;
  const nWinMaxX = 0.45;
  const nWinMinY = 0.88;
  const nWinMaxY = 2.13;
  const buildWallSeg = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(regGeo(new THREE.BoxGeometry(w, h, d)), wallMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  };
  // North wall segments around window
  buildWallSeg(nWinMinX - (ROOM_MIN_X - 0.06), 2.95, 0.12, (ROOM_MIN_X - 0.06 + nWinMinX) / 2, 1.475, ROOM_MIN_Z - 0.06);
  buildWallSeg(ROOM_MAX_X + 0.06 - nWinMaxX, 2.95, 0.12, (nWinMaxX + ROOM_MAX_X + 0.06) / 2, 1.475, ROOM_MIN_Z - 0.06);
  buildWallSeg(nWinMaxX - nWinMinX, nWinMinY, 0.12, (nWinMinX + nWinMaxX) / 2, nWinMinY / 2, ROOM_MIN_Z - 0.06);
  buildWallSeg(nWinMaxX - nWinMinX, 2.95 - nWinMaxY, 0.12, (nWinMinX + nWinMaxX) / 2, (nWinMaxY + 2.95) / 2, ROOM_MIN_Z - 0.06);

  // East Wall (x = +1.70) with window cutout: z in [-0.95, 0.25], y in [0.86, 2.13]
  const eWinMinZ = -0.95;
  const eWinMaxZ = 0.25;
  const eWinMinY = 0.86;
  const eWinMaxY = 2.13;
  buildWallSeg(0.12, 2.95, eWinMinZ - (ROOM_MIN_Z - 0.06), ROOM_MAX_X + 0.06, 1.475, (ROOM_MIN_Z - 0.06 + eWinMinZ) / 2);
  buildWallSeg(0.12, 2.95, ROOM_MAX_Z + 0.06 - eWinMaxZ, ROOM_MAX_X + 0.06, 1.475, (eWinMaxZ + ROOM_MAX_Z + 0.06) / 2);
  buildWallSeg(0.12, eWinMinY, eWinMaxZ - eWinMinZ, ROOM_MAX_X + 0.06, eWinMinY / 2, (eWinMinZ + eWinMaxZ) / 2);
  buildWallSeg(0.12, 2.95 - eWinMaxY, eWinMaxZ - eWinMinZ, ROOM_MAX_X + 0.06, (eWinMaxY + 2.95) / 2, (eWinMinZ + eWinMaxZ) / 2);

  // West Wall (x = -1.70) with doorway cutout: z in [0.58, 1.48], y in [0, 2.04]
  buildWallSeg(0.12, 2.95, DOOR_MIN_Z - (ROOM_MIN_Z - 0.06), ROOM_MIN_X - 0.06, 1.475, (ROOM_MIN_Z - 0.06 + DOOR_MIN_Z) / 2);
  buildWallSeg(0.12, 2.95, ROOM_MAX_Z + 0.06 - DOOR_MAX_Z, ROOM_MIN_X - 0.06, 1.475, (DOOR_MAX_Z + ROOM_MAX_Z + 0.06) / 2);
  buildWallSeg(0.12, 2.95 - DOOR_HEIGHT, DOOR_MAX_Z - DOOR_MIN_Z, ROOM_MIN_X - 0.06, (DOOR_HEIGHT + 2.95) / 2, (DOOR_MIN_Z + DOOR_MAX_Z) / 2);

  // NE structural concrete corner pillar (matching 00:06, 00:40)
  buildWallSeg(0.36, 2.95, 0.36, ROOM_MAX_X - 0.18, 1.475, ROOM_MIN_Z + 0.18);

  // Hallway walls (outside doorway so hallway is an enclosed realistic space)
  buildWallSeg(1.65, 2.95, 0.12, -2.52, 1.475, -0.02);
  buildWallSeg(1.65, 2.95, 0.12, -2.52, 1.475, 1.92);
  buildWallSeg(0.12, 2.95, 2.05, -3.32, 1.475, 0.95);

  // Sloped off-white ceiling (matching video 00:04-00:06, 00:30-00:33)
  const ceilGeo = regGeo(new THREE.PlaneGeometry(5.2, 4.1, 4, 4));
  const posAttr = ceilGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const px = posAttr.getX(i) - 0.7;
    const pz = posAttr.getY(i); // before -PI/2 X rotation, Y is -Z
    posAttr.setZ(i, ceilingHeightAt(px, -pz));
  }
  ceilGeo.computeVertexNormals();
  const ceilMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xb7b5ac,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.12,
      side: THREE.DoubleSide,
    }),
  );
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
  ceiling.rotation.x = Math.PI / 2; // Normal pointing downward
  ceiling.position.set(-0.7, 0, 0);
  // Fix Z sign after rotation: easier to build custom quad vertices directly
  root.remove(ceiling);

  const customCeilGeo = regGeo(new THREE.BufferGeometry());
  const cx0 = -3.35, cx1 = 1.75, cz0 = -1.95, cz1 = 1.95;
  const cVerts = new Float32Array([
    cx0, ceilingHeightAt(cx0, cz0), cz0,
    cx1, ceilingHeightAt(cx1, cz0), cz0,
    cx1, ceilingHeightAt(cx1, cz1), cz1,
    cx0, ceilingHeightAt(cx0, cz1), cz1,
  ]);
  customCeilGeo.setAttribute('position', new THREE.BufferAttribute(cVerts, 3));
  customCeilGeo.setIndex([0, 1, 2, 0, 2, 3]);
  customCeilGeo.computeVertexNormals();
  const customCeil = new THREE.Mesh(customCeilGeo, ceilMat);
  customCeil.receiveShadow = true;
  root.add(customCeil);

  // Dark cornice trim strip & white concrete top wall beam (visible in 00:04, 00:30-00:33)
  const trimMat = regMat(new THREE.MeshStandardMaterial({ color: 0x181614, roughness: 0.78, envMapIntensity: 0.1 }));
  const addTrimLine = (x1: number, z1: number, x2: number, z2: number) => {
    const y1 = ceilingHeightAt(x1, z1) - 0.015;
    const y2 = ceilingHeightAt(x2, z2) - 0.015;
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    const bar = new THREE.Mesh(regGeo(new THREE.BoxGeometry(len, 0.035, 0.035)), trimMat);
    bar.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    bar.lookAt(x2, y2, z2);
    bar.rotateY(Math.PI / 2);
    root.add(bar);
  };
  addTrimLine(-1.69, -1.89, 1.69, -1.89);
  addTrimLine(1.69, -1.89, 1.69, 1.89);
  addTrimLine(1.69, 1.89, -1.69, 1.89);
  addTrimLine(-1.69, 1.89, -1.69, -1.89);

  // =========================================================================
  // 2. WINDOWS, WHITE SECURITY GRILLES, RAIN GLASS & CURTAINS
  // =========================================================================
  const aluMat = regMat(new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.38, metalness: 0.72, envMapIntensity: 0.45 }));
  const grilleMat = regMat(new THREE.MeshStandardMaterial({ color: 0xc9c6bd, roughness: 0.5, metalness: 0.2, envMapIntensity: 0.2 }));

  const createRainGlassMaterial = () => {
    const m = regMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xdff0f5,
        roughness: 0.06,
        metalness: 0.0,
        transmission: isSoftwareGl ? 0 : 0.88,
        transparent: true,
        opacity: isSoftwareGl ? 0.26 : 1.0,
        ior: 1.5,
        thickness: 0.02,
        depthWrite: false,
      }),
    );
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = rainGlassUniforms.uTime;
      shader.uniforms.uRain = rainGlassUniforms.uRain;
      shader.vertexShader =
        `varying vec2 vGlassUv;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n  vGlassUv = position.xy * 0.65 + 0.5;`,
        );
      shader.fragmentShader =
        `uniform float uTime;\nuniform float uRain;\nvarying vec2 vGlassUv;\n` +
        shader.fragmentShader.replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           float dropGrid = sin(vGlassUv.x * 95.0) * sin(vGlassUv.y * 28.0 + uTime * 3.8);
           float streak = smoothstep(0.65, 0.95, dropGrid) * uRain;
           roughnessFactor = clamp(roughnessFactor + streak * 0.35, 0.04, 0.8);`,
        );
    };
    return m;
  };
  const glassMat = createRainGlassMaterial();

  const buildWindowUnit = (
    width: number,
    height: number,
    cols: number,
    rows: number,
    isNorth: boolean,
  ): { frameGroup: THREE.Group; sashGroup: THREE.Group } => {
    const group = new THREE.Group();
    const frameThick = 0.04;
    // Outer frame
    const topBar = new THREE.Mesh(regGeo(new THREE.BoxGeometry(width, frameThick, 0.08)), aluMat);
    topBar.position.y = height / 2 - frameThick / 2;
    const botBar = new THREE.Mesh(regGeo(new THREE.BoxGeometry(width, frameThick, 0.08)), aluMat);
    botBar.position.y = -height / 2 + frameThick / 2;
    const leftBar = new THREE.Mesh(regGeo(new THREE.BoxGeometry(frameThick, height, 0.08)), aluMat);
    leftBar.position.x = -width / 2 + frameThick / 2;
    const rightBar = new THREE.Mesh(regGeo(new THREE.BoxGeometry(frameThick, height, 0.08)), aluMat);
    rightBar.position.x = width / 2 - frameThick / 2;
    group.add(topBar, botBar, leftBar, rightBar);

    // White square security grille (matching video 00:00, 00:05)
    for (let c = 1; c < cols; c++) {
      const gx = -width / 2 + (c / cols) * width;
      const bar = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.016, height - 0.04, 0.016)), grilleMat);
      bar.position.set(gx, 0, -0.01);
      bar.castShadow = true;
      group.add(bar);
    }
    for (let r = 1; r < rows; r++) {
      const gy = -height / 2 + (r / rows) * height;
      const bar = new THREE.Mesh(regGeo(new THREE.BoxGeometry(width - 0.04, 0.016, 0.016)), grilleMat);
      bar.position.set(0, gy, -0.01);
      bar.castShadow = true;
      group.add(bar);
    }

    // Fixed left glass pane + sliding/opening right glass sash
    const halfW = (width - 0.06) / 2;
    const fixedGlass = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(halfW, height - 0.06)), glassMat);
    fixedGlass.position.set(-halfW / 2, 0, 0.015);
    fixedGlass.renderOrder = 4;
    group.add(fixedGlass);

    const sashGroup = new THREE.Group();
    sashGroup.position.set(halfW / 2, 0, 0.028);
    const sashFrame = new THREE.Mesh(regGeo(new THREE.BoxGeometry(halfW + 0.02, height - 0.04, 0.02)), aluMat);
    // Cutout visual: build 4 thin sash rails around glass
    sashFrame.visible = false;
    const sTop = new THREE.Mesh(regGeo(new THREE.BoxGeometry(halfW, 0.025, 0.022)), aluMat);
    sTop.position.y = (height - 0.06) / 2;
    const sBot = new THREE.Mesh(regGeo(new THREE.BoxGeometry(halfW, 0.025, 0.022)), aluMat);
    sBot.position.y = -(height - 0.06) / 2;
    const sGlass = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(halfW, height - 0.07)), glassMat);
    sGlass.renderOrder = 5;
    sashGroup.add(sTop, sBot, sGlass);
    group.add(sashGroup);

    if (!isNorth) {
      group.rotation.y = -Math.PI / 2;
    }
    return { frameGroup: group, sashGroup };
  };

  // North Window (above bed)
  const northWin = buildWindowUnit(nWinMaxX - nWinMinX, nWinMaxY - nWinMinY, 5, 4, true);
  northWin.frameGroup.position.set((nWinMinX + nWinMaxX) / 2, (nWinMinY + nWinMaxY) / 2, ROOM_MIN_Z - 0.03);
  root.add(northWin.frameGroup);
  interactables.push({
    id: 'northWindow',
    kind: 'northWindow',
    label: 'Jendela Kasur',
    mesh: northWin.frameGroup,
  });

  // East Window (behind folding chair / orange curtain)
  const eastWin = buildWindowUnit(eWinMaxZ - eWinMinZ, eWinMaxY - eWinMinY, 4, 4, false);
  eastWin.frameGroup.position.set(ROOM_MAX_X + 0.03, (eWinMinY + eWinMaxY) / 2, (eWinMinZ + eWinMaxZ) / 2);
  root.add(eastWin.frameGroup);
  interactables.push({
    id: 'eastWindow',
    kind: 'eastWindow',
    label: 'Jendela Tirai Oranye',
    mesh: eastWin.frameGroup,
  });

  // Curtain Rod + Translucent Peach Sheer Curtain (North Window, pooling onto bed!)
  const rodMat = regMat(new THREE.MeshStandardMaterial({ color: 0xe2e0da, roughness: 0.4, metalness: 0.3 }));
  const nRod = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.012, 0.012, 1.72, 12)), rodMat);
  nRod.rotation.z = Math.PI / 2;
  nRod.position.set(-0.32, 2.22, ROOM_MIN_Z + 0.05);
  root.add(nRod);

  const peachCurtainMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.peachCurtainMap,
      roughness: 0.78,
      transparent: true,
      opacity: 0.76,
      side: THREE.DoubleSide,
    }),
  );
  addWindSwayShader(peachCurtainMat, curtainWindUniforms, 2.22, 1.35);

  // Curved curtain panel sweeping from top rod down to bed surface (y = 0.56)
  const pCurtainGeo = regGeo(new THREE.PlaneGeometry(0.65, 1.66, 14, 18));
  const pAttr = pCurtainGeo.attributes.position;
  for (let i = 0; i < pAttr.count; i++) {
    const px = pAttr.getX(i);
    const py = pAttr.getY(i); // +0.83 top, -0.83 bottom
    const normDrop = (0.83 - py) / 1.66;
    const pleat = Math.sin(px * 26) * 0.032;
    // Sweep slightly toward +Z onto mattress at bottom
    const zSweep = Math.pow(normDrop, 2.2) * 0.34 + pleat;
    const xPinch = px * (1 - normDrop * 0.25) + normDrop * 0.14;
    pAttr.setXYZ(i, xPinch, py, zSweep);
  }
  pCurtainGeo.computeVertexNormals();
  const peachCurtain = new THREE.Mesh(pCurtainGeo, peachCurtainMat);
  peachCurtain.position.set(0.22, 1.39, ROOM_MIN_Z + 0.07);
  peachCurtain.castShadow = true;
  root.add(peachCurtain);

  // East Window Rod + Vibrant Burnt-Orange Grommet Curtain (matching 00:07, 00:23)
  const eRod = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 12)), rodMat);
  eRod.rotation.x = Math.PI / 2;
  eRod.position.set(ROOM_MAX_X - 0.05, 2.22, -0.35);
  root.add(eRod);

  const orangeCurtainMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.orangeCurtainMap,
      roughness: 0.78,
      emissive: new THREE.Color(0x4a1204),
      emissiveIntensity: 0.14,
      envMapIntensity: 0.18,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    }),
  );
  addWindSwayShader(orangeCurtainMat, curtainWindUniforms, 2.22, 0.82);
  const oCurtainGeo = regGeo(new THREE.PlaneGeometry(1.18, 1.38, 16, 14));
  const oAttr = oCurtainGeo.attributes.position;
  for (let i = 0; i < oAttr.count; i++) {
    const px = oAttr.getX(i);
    oAttr.setZ(i, Math.sin(px * 22) * 0.03);
  }
  oCurtainGeo.computeVertexNormals();
  const orangeCurtain = new THREE.Mesh(oCurtainGeo, orangeCurtainMat);
  orangeCurtain.rotation.y = -Math.PI / 2;
  orangeCurtain.position.set(ROOM_MAX_X - 0.09, 1.52, -0.35);
  orangeCurtain.castShadow = true;
  root.add(orangeCurtain);

  // =========================================================================
  // 3. DOORWAY, KNOTTED MUSTARD CURTAIN, FLUORESCENT TUBE & HALLWAY (West Wall)
  // =========================================================================
  const mahoganyMat = regMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: textures.mahoganyMap,
      roughnessMap: textures.mahoganyRoughMap,
      roughness: 0.36,
      metalness: 0.05,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
    }),
  );
  // Doorframe jambs & lintel
  const dJamb1 = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.14, DOOR_HEIGHT, 0.05)), mahoganyMat);
  dJamb1.position.set(ROOM_MIN_X - 0.06, DOOR_HEIGHT / 2, DOOR_MIN_Z + 0.025);
  const dJamb2 = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.14, DOOR_HEIGHT, 0.05)), mahoganyMat);
  dJamb2.position.set(ROOM_MIN_X - 0.06, DOOR_HEIGHT / 2, DOOR_MAX_Z - 0.025);
  const dTop = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.14, 0.06, DOOR_MAX_Z - DOOR_MIN_Z)), mahoganyMat);
  dTop.position.set(ROOM_MIN_X - 0.06, DOOR_HEIGHT - 0.03, (DOOR_MIN_Z + DOOR_MAX_Z) / 2);
  root.add(dJamb1, dJamb2, dTop);

  // Knotted Mustard-Ochre Doorway Curtain (matching 00:43-00:45)
  const mustardMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.mustardCurtainMap,
      roughness: 0.85,
      side: THREE.DoubleSide,
    }),
  );
  const dCurtainGeo = regGeo(new THREE.PlaneGeometry(0.54, 1.42, 10, 14));
  const dcAttr = dCurtainGeo.attributes.position;
  for (let i = 0; i < dcAttr.count; i++) {
    const px = dcAttr.getX(i);
    const py = dcAttr.getY(i);
    // Pinch inward near py = -0.35 for the tied knot!
    const distFromKnot = Math.abs(py + 0.35);
    const pinch = distFromKnot < 0.25 ? 0.32 + distFromKnot * 2.7 : 1.0;
    dcAttr.setX(i, px * pinch);
    dcAttr.setZ(i, Math.sin(px * 18) * 0.028 * pinch);
  }
  dCurtainGeo.computeVertexNormals();
  const doorCurtain = new THREE.Mesh(dCurtainGeo, mustardMat);
  doorCurtain.rotation.y = Math.PI / 2;
  doorCurtain.position.set(ROOM_MIN_X - 0.03, 1.28, 0.92);
  doorCurtain.castShadow = true;
  root.add(doorCurtain);
  const knotBall = new THREE.Mesh(regGeo(new THREE.SphereGeometry(0.065, 12, 10)), mustardMat);
  knotBall.scale.set(0.85, 1.25, 0.85);
  knotBall.position.set(ROOM_MIN_X - 0.02, 0.93, 0.92);
  root.add(knotBall);

  // White Fluorescent Tube Light above doorway (matching 00:44-00:45)
  const tubeHousing = new THREE.Group();
  tubeHousing.position.set(ROOM_MIN_X + 0.03, DOOR_HEIGHT + 0.14, (DOOR_MIN_Z + DOOR_MAX_Z) / 2);
  const tubeBase = new THREE.Mesh(
    regGeo(new THREE.BoxGeometry(0.06, 0.05, 0.96)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xe6e6e2, roughness: 0.45 })),
  );
  const tubeEmissiveMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(0xf6faff),
      emissiveIntensity: 2.2,
      roughness: 0.2,
    }),
  );
  const tubeBulb = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.90, 12)), tubeEmissiveMat);
  tubeBulb.rotation.x = Math.PI / 2;
  tubeBulb.position.x = 0.035;
  tubeHousing.add(tubeBase, tubeBulb);
  root.add(tubeHousing);
  interactables.push({
    id: 'tubeLight',
    kind: 'tubeLight',
    label: 'Lampu Neon Pintu',
    mesh: tubeHousing,
  });

  // Hallway Green Laundry Basket (outside door, target zone for laundry tosses!)
  const basketGroup = new THREE.Group();
  basketGroup.position.set(-2.18, 0, 1.15);
  const greenPlasticMat = regMat(new THREE.MeshStandardMaterial({ color: 0x1e8c68, roughness: 0.48 }));
  const basketWall = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.24, 0.19, 0.38, 16, 1, true)), greenPlasticMat);
  basketWall.material.side = THREE.DoubleSide;
  basketWall.position.y = 0.19;
  const basketRim = new THREE.Mesh(regGeo(new THREE.TorusGeometry(0.24, 0.018, 8, 24)), greenPlasticMat);
  basketRim.rotation.x = Math.PI / 2;
  basketRim.position.y = 0.38;
  const basketBottom = new THREE.Mesh(regGeo(new THREE.CircleGeometry(0.19, 16)), greenPlasticMat);
  basketBottom.rotation.x = -Math.PI / 2;
  basketBottom.position.y = 0.01;
  const basketTargetRing = new THREE.Mesh(
    regGeo(new THREE.RingGeometry(0.25, 0.29, 24)),
    regMat(new THREE.MeshBasicMaterial({ color: 0x62f5a8, side: THREE.DoubleSide, transparent: true, opacity: 0.0 })),
  );
  basketTargetRing.rotation.x = -Math.PI / 2;
  basketTargetRing.position.y = 0.40;
  basketGroup.add(basketWall, basketRim, basketBottom, basketTargetRing);
  root.add(basketGroup);

  // Hallway Metal/Wood Storage Rack with Brown Crates (matching 00:44)
  const rackGroup = new THREE.Group();
  rackGroup.position.set(-2.74, 0, 0.42);
  const rackMetalMat = regMat(new THREE.MeshStandardMaterial({ color: 0x453d38, roughness: 0.6, metalness: 0.45 }));
  const crateMat = regMat(new THREE.MeshStandardMaterial({ color: 0x6d3b2b, roughness: 0.72 }));
  for (const sx of [-0.26, 0.26]) {
    for (const sz of [-0.28, 0.28]) {
      const post = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.035, 1.72, 0.035)), rackMetalMat);
      post.position.set(sx, 0.86, sz);
      rackGroup.add(post);
    }
  }
  for (const sy of [0.22, 0.72, 1.22, 1.68]) {
    const shelf = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.56, 0.025, 0.60)), rackMetalMat);
    shelf.position.y = sy;
    rackGroup.add(shelf);
    if (sy < 1.5) {
      const crate = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.42, 0.24, 0.46)), crateMat);
      crate.position.set(0, sy + 0.13, 0);
      rackGroup.add(crate);
    }
  }
  root.add(rackGroup);

  // =========================================================================
  // 4. BED, PILLOW-TOP MATTRESS, BLUE SHEET, HEADBOARD PILLOWS (NW Corner)
  // =========================================================================
  const bedGroup = new THREE.Group();
  bedGroup.position.set(-0.70, 0, -1.34); // Covers x:[-1.68, 0.28], z:[-1.88, -0.80]
  const leatherMat = regMat(new THREE.MeshStandardMaterial({ color: 0x161413, roughness: 0.56, metalness: 0.06, envMapIntensity: 0.28 }));
  const bedBase = new THREE.Mesh(regGeo(new RoundedBoxGeometry(1.94, 0.30, 1.06, 4, 0.055)), leatherMat);
  bedBase.position.y = 0.16;
  bedBase.castShadow = true;
  bedBase.receiveShadow = true;
  // Padded rounded faux-leather sofa-bed headboard/armrest at West end (frame_01.jpg)
  const headboard = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.16, 0.44, 1.06, 4, 0.068)), leatherMat);
  headboard.position.set(-0.90, 0.29, 0);
  headboard.castShadow = true;

  // Thick rounded pillow-top quilted mattress with dark side piping
  const mattressMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.mattressMap,
      bumpMap: textures.mattressBumpMap,
      bumpScale: 0.015,
      roughness: 0.88,
      envMapIntensity: 0.18,
    }),
  );
  const mattress = new THREE.Mesh(regGeo(new RoundedBoxGeometry(1.88, 0.24, 1.02, 4, 0.068)), mattressMat);
  mattress.position.set(0.02, 0.43, 0);
  mattress.castShadow = true;
  mattress.receiveShadow = true;

  const piping = new THREE.Mesh(
    regGeo(new RoundedBoxGeometry(1.90, 0.032, 1.04, 3, 0.015)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x332e2b, roughness: 0.72, envMapIntensity: 0.15 })),
  );
  piping.position.set(0.02, 0.33, 0);

  // Rumpled light-blue swirled bedsheet draped across right/front of mattress & curling down edge
  const blueSheetMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.blueSheetMap,
      roughness: 0.88,
      envMapIntensity: 0.18,
      side: THREE.DoubleSide,
    }),
  );
  const sheetGeo = regGeo(new THREE.PlaneGeometry(1.06, 0.96, 18, 16));
  const shAttr = sheetGeo.attributes.position;
  for (let i = 0; i < shAttr.count; i++) {
    const sx = shAttr.getX(i);
    const sy = shAttr.getY(i); // +0.48 back, -0.48 front edge
    const frontCurl = sy < -0.34 ? Math.pow((-0.34 - sy) / 0.14, 1.5) * 0.09 : 0;
    const ripple = 0.012 + Math.sin(sx * 8.5 + sy * 6) * 0.007 + Math.cos(sx * 13 - sy * 8) * 0.004;
    shAttr.setZ(i, ripple - frontCurl);
  }
  sheetGeo.computeVertexNormals();
  const blueSheet = new THREE.Mesh(sheetGeo, blueSheetMat);
  blueSheet.rotation.x = -Math.PI / 2;
  blueSheet.position.set(0.30, 0.562, 0.04);
  blueSheet.receiveShadow = true;

  // Sculpted plump headboard pillows (plaid check pillow + cream pillow leaning at West headboard)
  const plaidPillowMat = regMat(new THREE.MeshStandardMaterial({ color: 0xffffff, map: textures.plaidPillowMap, roughness: 0.9, envMapIntensity: 0.16 }));
  const whiteFabricMat = regMat(new THREE.MeshStandardMaterial({ color: 0xc7c2b7, roughness: 0.9, envMapIntensity: 0.16 }));

  const headPillow1 = new THREE.Mesh(createPillowGeo(0.16, 0.34, 0.44, 0.05), plaidPillowMat);
  headPillow1.position.set(-0.76, 0.68, 0.24);
  headPillow1.rotation.z = -0.35;
  headPillow1.castShadow = true;

  const headPillow2 = new THREE.Mesh(createPillowGeo(0.16, 0.32, 0.44, 0.05), whiteFabricMat);
  headPillow2.position.set(-0.76, 0.67, -0.22);
  headPillow2.rotation.z = -0.32;
  headPillow2.castShadow = true;

  bedGroup.add(bedBase, headboard, mattress, piping, blueSheet, headPillow1, headPillow2);
  root.add(bedGroup);
  addContactShadow(2.25, 1.35, -0.70, 0.003, -1.34, 0.62);

  // Small black pen resting on floor tile beside thermos (matching 00:01)
  const penMesh = new THREE.Mesh(
    regGeo(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 8)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.4 })),
  );
  penMesh.rotation.z = Math.PI / 2;
  penMesh.rotation.y = 0.28;
  penMesh.position.set(-0.66, 0.006, -0.32);
  root.add(penMesh);

  // =========================================================================
  // 5. NE CURVED CORNER TABLE, CHAIRS & MAHOGANY 3-DOOR WARDROBE (East Wall)
  // =========================================================================
  const whiteWoodMat = regMat(new THREE.MeshStandardMaterial({ color: 0xc2bfb7, roughness: 0.56, envMapIntensity: 0.22 }));
  const chromeMat = regMat(new THREE.MeshStandardMaterial({ color: 0xc8cdd3, roughness: 0.18, metalness: 0.9, envMapIntensity: 0.75 }));

  // Curved quarter-round white corner table (matching frame_03.jpg & frame_b_04.jpg!)
  const cornerTable = new THREE.Group();
  cornerTable.position.set(0.94, 0, -1.52);
  const ctShape = new THREE.Shape();
  ctShape.moveTo(-0.36, -0.32);
  ctShape.lineTo(0.36, -0.32);
  ctShape.lineTo(0.36, 0.06);
  ctShape.quadraticCurveTo(0.28, 0.34, -0.06, 0.34);
  ctShape.quadraticCurveTo(-0.36, 0.30, -0.36, -0.32);
  const ctTopGeo = regGeo(
    new THREE.ExtrudeGeometry(ctShape, {
      depth: 0.026,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.01,
      bevelSegments: 4,
    }),
  );
  const ctTop = new THREE.Mesh(ctTopGeo, whiteWoodMat);
  ctTop.rotation.x = Math.PI / 2;
  ctTop.position.y = 0.73;
  ctTop.castShadow = true;
  ctTop.receiveShadow = true;
  for (const [lx, lz] of [[-0.28, -0.24], [0.28, -0.24], [-0.24, 0.22], [0.24, 0.18]]) {
    const leg = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.016, 0.014, 0.71, 10)), chromeMat);
    leg.position.set(lx, 0.355, lz);
    cornerTable.add(leg);
  }
  // Soft plump folded dusty-mauve quilt/duvet cushion leaning on corner wall (frame_b_04.jpg!)
  const mauveMat = regMat(new THREE.MeshStandardMaterial({ color: 0x7e7273, roughness: 0.9, envMapIntensity: 0.15 }));
  const leanCushion = new THREE.Mesh(createFoldedClothGeo(0.40, 0.16, 0.36, 0.14), mauveMat);
  leanCushion.position.set(0.04, 0.89, -0.14);
  leanCushion.rotation.x = Math.PI / 2 - 0.30;
  leanCushion.castShadow = true;
  cornerTable.add(ctTop, leanCushion);
  root.add(cornerTable);
  addContactShadow(0.95, 0.90, 0.94, 0.003, -1.52, 0.48);

  // Hanging coiled white/tan ropes & medal lanyard on wall grid rack above corner table (frame_03.jpg!)
  const hookBar = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.56, 0.032, 0.02, 2, 0.008)), whiteWoodMat);
  hookBar.position.set(0.92, 1.58, ROOM_MIN_Z + 0.015);
  root.add(hookBar);

  // Coiled ropes (white & tan) + dark strap + hanging lanyard with round medals
  const ropeMatWhite = regMat(new THREE.MeshStandardMaterial({ color: 0xc8c5bd, roughness: 0.85, envMapIntensity: 0.15 }));
  const ropeMatTan = regMat(new THREE.MeshStandardMaterial({ color: 0x9c7b4c, roughness: 0.85, envMapIntensity: 0.15 }));
  const strapMatDark = regMat(new THREE.MeshStandardMaterial({ color: 0x222022, roughness: 0.78 }));

  const addCoiledRope = (cx: number, cy: number, mat: THREE.Material) => {
    const coil = new THREE.Mesh(regGeo(new THREE.TorusGeometry(0.055, 0.014, 8, 18)), mat);
    coil.scale.set(0.65, 1.45, 0.7);
    coil.position.set(cx, cy, ROOM_MIN_Z + 0.032);
    const knotBand = new THREE.Mesh(regGeo(new THREE.TorusGeometry(0.022, 0.009, 6, 12)), mat);
    knotBand.rotation.x = Math.PI / 2;
    knotBand.position.set(cx, cy, ROOM_MIN_Z + 0.036);
    root.add(coil, knotBand);
  };
  addCoiledRope(0.72, 1.44, strapMatDark);
  addCoiledRope(0.84, 1.45, ropeMatWhite);
  addCoiledRope(0.96, 1.45, ropeMatTan);

  // Lanyard with round medals (frame_03.jpg right hook)
  const lanyardCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.06, 1.57, ROOM_MIN_Z + 0.028),
    new THREE.Vector3(1.05, 1.38, ROOM_MIN_Z + 0.032),
    new THREE.Vector3(1.08, 1.22, ROOM_MIN_Z + 0.035),
    new THREE.Vector3(1.10, 1.38, ROOM_MIN_Z + 0.03),
    new THREE.Vector3(1.08, 1.57, ROOM_MIN_Z + 0.028),
  ]);
  const lanyardMesh = new THREE.Mesh(
    regGeo(new THREE.TubeGeometry(lanyardCurve, 18, 0.008, 6, false)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x452d30, roughness: 0.7 })),
  );
  const medalDisc = new THREE.Mesh(
    regGeo(new THREE.CylinderGeometry(0.026, 0.026, 0.008, 16)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xc29e68, roughness: 0.35, metalness: 0.6 })),
  );
  medalDisc.rotation.x = Math.PI / 2;
  medalDisc.position.set(1.08, 1.20, ROOM_MIN_Z + 0.036);
  root.add(lanyardMesh, medalDisc);

  // Folding metal chair stacked with floral dark bolster & curved plump white pillow (frame_03.jpg, frame_b_04.jpg!)
  const foldChair = new THREE.Group();
  foldChair.position.set(1.06, 0, -0.64);
  const fSeat = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.45, 0.048, 0.45, 3, 0.018)), leatherMat);
  fSeat.position.y = 0.44;
  // Continuous curved tubular chrome arch backrest
  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.20, 0.44, -0.19),
    new THREE.Vector3(0.20, 0.82, -0.18),
    new THREE.Vector3(0.20, 0.93, -0.10),
    new THREE.Vector3(0.20, 0.95, 0.0),
    new THREE.Vector3(0.20, 0.93, 0.10),
    new THREE.Vector3(0.20, 0.82, 0.18),
    new THREE.Vector3(0.20, 0.44, 0.19),
  ]);
  const fArchTube = new THREE.Mesh(regGeo(new THREE.TubeGeometry(archCurve, 28, 0.012, 10, false)), chromeMat);
  const fMidBar = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.37, 8)), chromeMat);
  fMidBar.rotation.x = Math.PI / 2;
  fMidBar.position.set(0.20, 0.78, 0);
  for (const [lx, lz] of [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]]) {
    const fLeg = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.011, 0.011, 0.44, 8)), chromeMat);
    fLeg.position.set(lx, 0.22, lz);
    foldChair.add(fLeg);
  }
  const bolster = new THREE.Mesh(
    regGeo(new THREE.CapsuleGeometry(0.105, 0.28, 8, 16)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xffffff, map: textures.bolsterMap, roughness: 0.88, envMapIntensity: 0.15 })),
  );
  bolster.rotation.x = Math.PI / 2;
  bolster.position.set(-0.02, 0.56, 0);
  const topPillow = new THREE.Mesh(createPillowGeo(0.38, 0.12, 0.50, 0.14), whiteFabricMat);
  topPillow.position.set(-0.07, 0.69, 0);
  topPillow.rotation.z = 0.18;
  foldChair.add(fSeat, fArchTube, fMidBar, bolster, topPillow);
  root.add(foldChair);
  addContactShadow(0.68, 0.68, 1.06, 0.003, -0.64, 0.52);

  // Brown floor cushion in front of East window (00:36)
  const brownFloorCushion = new THREE.Mesh(
    createPillowGeo(0.44, 0.11, 0.44, 0.08),
    regMat(new THREE.MeshStandardMaterial({ color: 0x34261f, roughness: 0.92, envMapIntensity: 0.14 })),
  );
  brownFloorCushion.position.set(1.42, 0.05, 0.02);
  brownFloorCushion.receiveShadow = true;
  root.add(brownFloorCushion);
  addContactShadow(0.56, 0.56, 1.42, 0.003, 0.02, 0.48);

  // Glossy Reddish-Mahogany 3-Door Wardrobe with Oval Arched Mirror (00:08, 00:25-00:33)
  const wardrobe = new THREE.Group();
  wardrobe.position.set(1.41, 0, 0.94); // Depth 0.54 (x: 1.14..1.68), Width 1.40 (z: 0.24..1.64)
  const wBody = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.52, 1.94, 1.38, 3, 0.022)), mahoganyMat);
  wBody.position.y = 0.97;
  wBody.castShadow = true;
  wBody.receiveShadow = true;
  wardrobe.add(wBody);

  // 3 beveled door panels + handles facing -X
  for (let i = -1; i <= 1; i++) {
    const door = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.026, 1.82, 0.43, 3, 0.01)), mahoganyMat);
    door.position.set(-0.27, 0.96, i * 0.45);
    const knob = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.09, 8)), chromeMat);
    knob.position.set(-0.292, 0.98, i * 0.45 + (i === 1 ? -0.16 : 0.16));
    wardrobe.add(door, knob);
  }
  // Oval Arched Mirror on middle door!
  const mirrorMat = regMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdce6ea,
      roughness: 0.04,
      metalness: 0.96,
      envMapIntensity: 1.15,
      clearcoat: 1.0,
    }),
  );
  const mirrorGeo = regGeo(new THREE.CircleGeometry(0.16, 28));
  mirrorGeo.scale(1.0, 2.35, 1.0);
  const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
  mirror.rotation.y = -Math.PI / 2;
  mirror.position.set(-0.286, 1.24, 0);
  wardrobe.add(mirror);

  // Soft pleated hanging beige & striped blue towels on wardrobe front/side (00:08, 00:25-00:26)
  const towelBeige = new THREE.Mesh(
    createFoldedClothGeo(0.045, 0.62, 0.30, 0.16),
    regMat(new THREE.MeshStandardMaterial({ color: 0xa89b89, roughness: 0.92, envMapIntensity: 0.15 })),
  );
  towelBeige.position.set(-0.30, 1.15, -0.34);
  const towelBlue = new THREE.Mesh(
    createFoldedClothGeo(0.045, 0.68, 0.28, 0.16),
    regMat(new THREE.MeshStandardMaterial({ color: 0x5c7c93, roughness: 0.92, envMapIntensity: 0.15 })),
  );
  towelBlue.position.set(-0.30, 1.25, 0.48);
  wardrobe.add(towelBeige, towelBlue);

  // Rounded bags on top of wardrobe (00:30-00:33: black laptop bag, long badminton bag with yellow strip)
  const blackBagMat = regMat(new THREE.MeshStandardMaterial({ color: 0x16171b, roughness: 0.78, envMapIntensity: 0.2 }));
  const laptopBag = new THREE.Mesh(createFoldedClothGeo(0.32, 0.11, 0.38, 0.18), blackBagMat);
  laptopBag.position.set(0, 1.99, -0.05);
  const badBag = new THREE.Mesh(createFoldedClothGeo(0.24, 0.09, 0.68, 0.16), blackBagMat);
  badBag.position.set(-0.04, 1.98, 0.32);
  const badStripe = new THREE.Mesh(
    regGeo(new RoundedBoxGeometry(0.23, 0.03, 0.14, 2, 0.01)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xc2ba22, roughness: 0.52 })),
  );
  badStripe.position.set(-0.04, 1.99, 0.25);
  wardrobe.add(laptopBag, badBag, badStripe);
  root.add(wardrobe);
  addContactShadow(0.80, 1.65, 1.38, 0.003, 0.94, 0.62);

  // Stool with folded colorful plaid clothes in front of wardrobe (00:08, 00:25)
  const clothesStool = new THREE.Group();
  clothesStool.position.set(0.95, 0, 0.95);
  const stoolTop = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.36, 0.36, 0.44, 3, 0.03)), blackBagMat);
  stoolTop.position.y = 0.18;
  const plaidHeap = new THREE.Mesh(
    createFoldedClothGeo(0.36, 0.15, 0.42, 0.22),
    regMat(new THREE.MeshStandardMaterial({ color: 0xffffff, map: textures.plaidClothMap, roughness: 0.9, envMapIntensity: 0.16 })),
  );
  plaidHeap.position.y = 0.41;
  clothesStool.add(stoolTop, plaidHeap);
  root.add(clothesStool);
  addContactShadow(0.60, 0.66, 0.95, 0.003, 0.95, 0.52);

  // =========================================================================
  // 6. STUDY DESK, CANON PRINTER UNDERNEATH, WALL FAN & CABLES (South Wall)
  // =========================================================================
  const deskGroup = new THREE.Group();
  deskGroup.position.set(-0.69, 0, 1.55); // x: [-1.34, -0.04], z: [1.22, 1.88]
  const darkDeskMat = regMat(new THREE.MeshStandardMaterial({ color: 0x1d1b1a, roughness: 0.48 }));
  const deskTop = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.30, 0.045, 0.66)), darkDeskMat);
  deskTop.position.y = 0.735;
  deskTop.castShadow = true;
  deskTop.receiveShadow = true;
  // Wood front edge trim (matching 00:14)
  const woodEdge = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.30, 0.048, 0.022)), mahoganyMat);
  woodEdge.position.set(0, 0.735, -0.325);
  // Light-grey desk mat on top (matching 00:10, 00:13)
  const greyDeskMat = new THREE.Mesh(
    regGeo(new RoundedBoxGeometry(1.16, 0.01, 0.56, 2, 0.004)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xa2a49e, roughness: 0.68, envMapIntensity: 0.18 })),
  );
  greyDeskMat.position.set(0.02, 0.761, 0);
  greyDeskMat.receiveShadow = true;
  // Left and Right solid desk side panels (open center underneath!)
  const deskLeft = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.04, 0.72, 0.64, 2, 0.01)), darkDeskMat);
  deskLeft.position.set(-0.63, 0.36, 0);
  deskLeft.castShadow = true;
  const deskRight = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.04, 0.72, 0.64, 2, 0.01)), darkDeskMat);
  deskRight.position.set(0.63, 0.36, 0);
  deskRight.castShadow = true;
  // Back modesty panel (high enough that crawled space under desk matches 00:15!)
  const deskModesty = new THREE.Mesh(
    regGeo(new THREE.BoxGeometry(1.22, 0.24, 0.025)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xb6b4ac, roughness: 0.72, envMapIntensity: 0.15 })),
  );
  deskModesty.position.set(0, 0.59, 0.28);
  // Draped brown/beige cloth on left half of desk (00:09, 00:48)
  const deskCloth = new THREE.Mesh(
    createFoldedClothGeo(0.46, 0.024, 0.68, 0.18),
    regMat(new THREE.MeshStandardMaterial({ color: 0x625849, roughness: 0.92, envMapIntensity: 0.15 })),
  );
  deskCloth.position.set(-0.41, 0.768, -0.02);
  deskGroup.add(deskTop, woodEdge, greyDeskMat, deskLeft, deskRight, deskModesty, deskCloth);
  root.add(deskGroup);
  addContactShadow(1.55, 0.88, -0.69, 0.003, 1.55, 0.55);

  // Canon White & Black Printer + Router under desk (matching 00:17!)
  const printerGroup = new THREE.Group();
  printerGroup.position.set(-1.02, 0, 1.62);
  const pBody = new THREE.Mesh(
    regGeo(new RoundedBoxGeometry(0.42, 0.14, 0.28, 3, 0.02)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.45 })),
  );
  pBody.position.y = 0.07;
  const pTopWhite = new THREE.Mesh(
    regGeo(new RoundedBoxGeometry(0.38, 0.10, 0.24, 3, 0.018)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xbab8b0, roughness: 0.54, envMapIntensity: 0.2 })),
  );
  pTopWhite.position.set(0, 0.19, 0.01);
  const pRouter = new THREE.Mesh(
    regGeo(new RoundedBoxGeometry(0.28, 0.04, 0.18, 2, 0.01)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.4 })),
  );
  pRouter.position.set(0, 0.26, 0.01);
  printerGroup.add(pBody, pTopWhite, pRouter);
  root.add(printerGroup);
  addContactShadow(0.55, 0.40, -1.02, 0.003, 1.62, 0.55);

  // Crumpled Royal Blue bag under desk next to printer (smooth cloth pouch, not a crystal!)
  const blueBag = new THREE.Mesh(
    createFoldedClothGeo(0.28, 0.11, 0.22, 0.32),
    regMat(new THREE.MeshStandardMaterial({ color: 0x1548bd, roughness: 0.62, envMapIntensity: 0.2 })),
  );
  blueBag.position.set(-0.56, 0.055, 1.48);
  root.add(blueBag);

  // Wall-Mounted Electric Fan above Study Desk (matching 00:09-00:10, 00:46-00:47)
  const fanGroup = new THREE.Group();
  fanGroup.position.set(-0.58, 1.76, ROOM_MAX_Z - 0.02);
  const fanWhiteMat = regMat(new THREE.MeshStandardMaterial({ color: 0xc2c2ba, roughness: 0.4, envMapIntensity: 0.22 }));
  const fanMount = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.12, 0.18, 0.04, 2, 0.01)), fanWhiteMat);
  const fanNeck = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.028, 0.035, 0.18, 12)), fanWhiteMat);
  fanNeck.rotation.x = Math.PI / 2;
  fanNeck.position.set(0, 0.04, -0.09);
  const fanCageMat = regMat(new THREE.MeshStandardMaterial({ color: 0xb6b8b2, roughness: 0.42, metalness: 0.3, envMapIntensity: 0.25 }));
  const fanCage = new THREE.Mesh(regGeo(new THREE.TorusGeometry(0.22, 0.008, 8, 28)), fanCageMat);
  fanCage.position.set(0, 0.04, -0.20);
  const fanCageRing2 = new THREE.Mesh(regGeo(new THREE.TorusGeometry(0.14, 0.005, 6, 24)), fanWhiteMat);
  fanCageRing2.position.set(0, 0.04, -0.21);
  // Radial fan guard spokes + center badge (matching frame_b_06.jpg)
  for (let s = 0; s < 12; s++) {
    const spoke = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.0022, 0.0022, 0.43, 5)), fanCageMat);
    spoke.position.set(0, 0.04, -0.208);
    spoke.rotation.z = (s * Math.PI) / 12;
    fanGroup.add(spoke);
  }
  const fanBadge = new THREE.Mesh(
    regGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 16)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xd4ccb8, roughness: 0.35 })),
  );
  fanBadge.rotation.x = Math.PI / 2;
  fanBadge.position.set(0, 0.04, -0.215);

  const fanRotor = new THREE.Group();
  fanRotor.position.set(0, 0.04, -0.18);
  const bladeMat = regMat(
    new THREE.MeshStandardMaterial({ color: 0xbac2c7, roughness: 0.32, transparent: true, opacity: 0.78 }),
  );
  for (let b = 0; b < 3; b++) {
    const blade = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.068, 0.17, 0.008, 2, 0.004)), bladeMat);
    const ang = (b * Math.PI * 2) / 3;
    blade.position.set(Math.cos(ang) * 0.09, Math.sin(ang) * 0.09, 0);
    blade.rotation.z = ang + Math.PI / 2;
    blade.rotation.y = 0.28;
    fanRotor.add(blade);
  }
  const fanHub = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14)), fanWhiteMat);
  fanHub.rotation.x = Math.PI / 2;
  fanRotor.add(fanHub);
  fanGroup.add(fanMount, fanNeck, fanCage, fanCageRing2, fanBadge, fanRotor);
  root.add(fanGroup);
  interactables.push({
    id: 'fan',
    kind: 'fan',
    label: 'Kipas Angin Dinding',
    mesh: fanGroup,
  });

  // Electrical Switches, Pink/White Power Strip, U-loop White Cord & Diagonal Cables (frame_b_06.jpg)
  const switchPlate = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.16, 0.09, 0.025, 2, 0.006)), fanWhiteMat);
  switchPlate.position.set(-0.26, 1.48, ROOM_MAX_Z - 0.012);
  const powerStrip = new THREE.Mesh(
    regGeo(new RoundedBoxGeometry(0.28, 0.065, 0.025, 2, 0.008)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xc97b90, roughness: 0.48, envMapIntensity: 0.2 })),
  );
  powerStrip.position.set(-0.34, 1.28, ROOM_MAX_Z - 0.014);
  root.add(switchPlate, powerStrip);

  const whiteLoopCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.24, 1.44, ROOM_MAX_Z - 0.014),
    new THREE.Vector3(-0.20, 1.10, ROOM_MAX_Z - 0.018),
    new THREE.Vector3(-0.34, 1.00, ROOM_MAX_Z - 0.018),
    new THREE.Vector3(-0.46, 1.12, ROOM_MAX_Z - 0.018),
    new THREE.Vector3(-0.44, 1.26, ROOM_MAX_Z - 0.014),
  ]);
  const whiteLoopCord = new THREE.Mesh(
    regGeo(new THREE.TubeGeometry(whiteLoopCurve, 20, 0.006, 6, false)),
    fanWhiteMat,
  );
  root.add(whiteLoopCord);

  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.34, 1.48, ROOM_MAX_Z - 0.015),
    new THREE.Vector3(-0.95, 1.62, ROOM_MAX_Z - 0.015),
    new THREE.Vector3(-1.66, 2.04, 1.85),
    new THREE.Vector3(-1.66, 2.16, 1.48),
  ]);
  const cableMesh = new THREE.Mesh(
    regGeo(new THREE.TubeGeometry(cableCurve, 20, 0.008, 6, false)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x1e1e20, roughness: 0.7 })),
  );
  root.add(cableMesh);

  // =========================================================================
  // 7. DYNAMIC PHYSICS PROPS (12 Interactive Multi-Part 3D Objects!)
  // =========================================================================
  const registerProp = (id: string, label: string, group: THREE.Group) => {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    propMeshes.set(id, group);
    root.add(group);
    interactables.push({ id, kind: 'prop', label, mesh: group });
  };

  // (1) White Ceramic Mug (on desk)
  const mugGroup = new THREE.Group();
  const cerMat = regMat(new THREE.MeshPhysicalMaterial({ color: 0xd4d0c7, roughness: 0.18, clearcoat: 0.85, envMapIntensity: 0.38 }));
  const mugCup = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.044, 0.04, 0.11, 18)), cerMat);
  const mugHandle = new THREE.Mesh(regGeo(new THREE.TorusGeometry(0.032, 0.007, 8, 16, Math.PI)), cerMat);
  mugHandle.rotation.z = -Math.PI / 2;
  mugHandle.position.x = 0.042;
  const coffeeTop = new THREE.Mesh(
    regGeo(new THREE.CircleGeometry(0.038, 14)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x3b2214, roughness: 0.15 })),
  );
  coffeeTop.rotation.x = -Math.PI / 2;
  coffeeTop.position.y = 0.046;
  mugGroup.add(mugCup, mugHandle, coffeeTop);
  registerProp('desk_mug', 'Mug Keramik Putih', mugGroup);

  // (2) Clear Snack Jar with Red Lid & Golden Crackers (on desk)
  const jarGroup = new THREE.Group();
  const snacksCore = new THREE.Mesh(
    regGeo(new THREE.CylinderGeometry(0.068, 0.068, 0.16, 16)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xc28b36, roughness: 0.78 })),
  );
  snacksCore.position.y = -0.015;
  const jarGlass = new THREE.Mesh(
    regGeo(new THREE.CylinderGeometry(0.078, 0.076, 0.19, 18)),
    regMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xe6eef2,
        roughness: 0.1,
        transparent: true,
        opacity: 0.36,
        clearcoat: 1,
        envMapIntensity: 0.5,
      }),
    ),
  );
  const redLid = new THREE.Mesh(
    regGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.035, 18)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xb8211d, roughness: 0.38 })),
  );
  redLid.position.y = 0.095;
  jarGroup.add(snacksCore, jarGlass, redLid);
  registerProp('snack_jar', 'Toples Kue Tutup Merah', jarGroup);

  // (3) Teal Drawstring Cloth Bag (soft crinkled cloth bag, not a rigid box!)
  const tealGroup = new THREE.Group();
  const tealBagMesh = new THREE.Mesh(
    createFoldedClothGeo(0.28, 0.08, 0.22, 0.24),
    regMat(new THREE.MeshStandardMaterial({ color: 0x096e65, roughness: 0.9, envMapIntensity: 0.16 })),
  );
  const tealCord = new THREE.Mesh(
    regGeo(new THREE.TorusGeometry(0.06, 0.005, 6, 14)),
    whiteFabricMat,
  );
  tealCord.rotation.x = Math.PI / 2;
  tealCord.position.set(0.08, 0.032, 0);
  tealGroup.add(tealBagMesh, tealCord);
  registerProp('teal_pouch', 'Tas Kain Toska', tealGroup);

  // (4) Purple & Silver Thermos Bottle (floor beside bed, matching 00:01)
  const thermosGroup = new THREE.Group();
  const tBody = new THREE.Mesh(
    regGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 16)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x452d59, roughness: 0.32, metalness: 0.45 })),
  );
  const tCap = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.036, 0.04, 0.04, 16)), chromeMat);
  tCap.position.y = 0.095;
  thermosGroup.add(tBody, tCap);
  registerProp('purple_thermos', 'Botol Termos Ungu', thermosGroup);

  // (5) Plump White Bed Pillow with center head-indent (matching frame_01.jpg!)
  const pillowGroup = new THREE.Group();
  const pillowMesh = new THREE.Mesh(createPillowGeo(0.46, 0.14, 0.32, 0.22), whiteFabricMat);
  pillowGroup.add(pillowMesh);
  registerProp('bed_pillow_center', 'Bantal Putih Kasur', pillowGroup);

  // (6) Rumpled Dusty-Rose / Purple Draped Cloth on bed (matching frame_01.jpg!)
  const roseGroup = new THREE.Group();
  const roseMesh = new THREE.Mesh(
    createFoldedClothGeo(0.32, 0.085, 0.25, 0.3),
    regMat(new THREE.MeshStandardMaterial({ color: 0x7c4054, roughness: 0.92, envMapIntensity: 0.15 })),
  );
  roseGroup.add(roseMesh);
  registerProp('rose_cloth', 'Kain Lipat Merah Muda', roseGroup);

  // (7) Folded Plaid Cloth near wardrobe (soft organic folds)
  const plaidGroup = new THREE.Group();
  const plaidMesh = new THREE.Mesh(
    createFoldedClothGeo(0.28, 0.085, 0.25, 0.22),
    regMat(new THREE.MeshStandardMaterial({ color: 0xffffff, map: textures.plaidClothMap, roughness: 0.9, envMapIntensity: 0.16 })),
  );
  plaidGroup.add(plaidMesh);
  registerProp('plaid_shirt', 'Kain Kotak-Kotak Lemari', plaidGroup);

  // (8) Yellow Shoebox (on top of wardrobe, matching 00:32-00:33)
  const boxGroup = new THREE.Group();
  const yellowBoxMat = regMat(new THREE.MeshStandardMaterial({ color: 0xc2ad2c, roughness: 0.72 }));
  const shoeBoxBase = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.28, 0.13, 0.20, 2, 0.008)), yellowBoxMat);
  const shoeBoxLid = new THREE.Mesh(
    regGeo(new RoundedBoxGeometry(0.295, 0.035, 0.215, 2, 0.008)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xd1bf3d, roughness: 0.65 })),
  );
  shoeBoxLid.position.y = 0.065;
  boxGroup.add(shoeBoxBase, shoeBoxLid);
  registerProp('yellow_shoebox', 'Kotak Sepatu Kuning', boxGroup);

  // (9) Corner Table Plump Folded Taupe Cushion (matching frame_b_04.jpg!)
  const cCushGroup = new THREE.Group();
  cCushGroup.add(new THREE.Mesh(createPillowGeo(0.38, 0.15, 0.30, 0.12), mauveMat));
  registerProp('corner_cushion', 'Bantal Abu Meja Sudut', cCushGroup);

  // (10) Rolling Black Office Stool (near East window, 00:07, 00:22)
  const stoolGroup = new THREE.Group();
  const sSeat = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.075, 20)), leatherMat);
  sSeat.position.y = 0.21;
  const sStem = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 12)), chromeMat);
  sStem.position.y = 0.04;
  for (let a = 0; a < 5; a++) {
    const ang = (a * Math.PI * 2) / 5;
    const arm = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.22, 0.024, 0.03, 2, 0.008)), chromeMat);
    arm.position.set(Math.cos(ang) * 0.11, -0.18, Math.sin(ang) * 0.11);
    arm.rotation.y = -ang;
    const wheel = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12)), blackBagMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(Math.cos(ang) * 0.21, -0.22, Math.sin(ang) * 0.21);
    stoolGroup.add(arm, wheel);
  }
  stoolGroup.add(sSeat, sStem);
  registerProp('rolling_stool', 'Kursi Putar Hitam', stoolGroup);

  // (11) Study Desk Rolling Chair with Softly Draped Light-Blue Towel (frame_b_06.jpg!)
  const chairGroup = new THREE.Group();
  const cSeat = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.44, 0.075, 0.44, 3, 0.025)), leatherMat);
  cSeat.position.y = 0.04;
  const cBack = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.40, 0.44, 0.06, 3, 0.025)), leatherMat);
  cBack.position.set(0, 0.28, -0.20);
  // Curved towel draped smoothly over top and sides of chair backrest
  const cTowelGeo = regGeo(new THREE.PlaneGeometry(0.44, 0.46, 10, 12));
  const ctPos = cTowelGeo.attributes.position;
  for (let i = 0; i < ctPos.count; i++) {
    const tx = ctPos.getX(i);
    const ty = ctPos.getY(i);
    const fold = Math.sin(tx * 22) * 0.012;
    const drapeBack = ty > 0.12 ? -((ty - 0.12) * 0.28) : 0;
    ctPos.setZ(i, fold + drapeBack);
  }
  cTowelGeo.computeVertexNormals();
  const cTowel = new THREE.Mesh(
    cTowelGeo,
    regMat(new THREE.MeshStandardMaterial({ color: 0x679ca4, roughness: 0.92, envMapIntensity: 0.15, side: THREE.DoubleSide })),
  );
  cTowel.position.set(0, 0.30, -0.158);
  const cTowelBack = new THREE.Mesh(
    createFoldedClothGeo(0.41, 0.34, 0.04, 0.15),
    regMat(new THREE.MeshStandardMaterial({ color: 0x679ca4, roughness: 0.92, envMapIntensity: 0.15 })),
  );
  cTowelBack.position.set(0, 0.31, -0.22);
  const cStem = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.026, 0.026, 0.34, 12)), chromeMat);
  cStem.position.y = -0.16;
  for (let a = 0; a < 5; a++) {
    const ang = (a * Math.PI * 2) / 5;
    const arm = new THREE.Mesh(regGeo(new RoundedBoxGeometry(0.25, 0.028, 0.035, 2, 0.01)), chromeMat);
    arm.position.set(Math.cos(ang) * 0.13, -0.34, Math.sin(ang) * 0.13);
    arm.rotation.y = -ang;
    const wheel = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.028, 0.028, 0.024, 12)), blackBagMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(Math.cos(ang) * 0.24, -0.39, Math.sin(ang) * 0.24);
    chairGroup.add(arm, wheel);
  }
  chairGroup.add(cSeat, cBack, cTowel, cTowelBack, cStem);
  registerProp('desk_chair', 'Kursi Belajar Handuk Biru', chairGroup);

  // (12) Bouncy Sport Ball for Trick Shots & Deflecting Storm Orbs
  const ballGroup = new THREE.Group();
  const ballBody = new THREE.Mesh(
    regGeo(new THREE.SphereGeometry(0.065, 18, 14)),
    regMat(new THREE.MeshStandardMaterial({ color: 0xe37d2b, roughness: 0.45 })),
  );
  const ballSeam = new THREE.Mesh(
    regGeo(new THREE.TorusGeometry(0.065, 0.004, 6, 20)),
    regMat(new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.5 })),
  );
  ballGroup.add(ballBody, ballSeam);
  registerProp('sport_ball', 'Bola Karet Pantul', ballGroup);

  return {
    root,
    propMeshes,
    interactables,
    fanRotor,
    tubeEmissiveMat,
    northWindowSash: northWin.sashGroup,
    eastWindowSash: eastWin.sashGroup,
    rainGlassUniforms,
    curtainWindUniforms,
    basketTargetRing,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
