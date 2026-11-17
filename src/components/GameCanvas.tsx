import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SoundEngine } from '../audio/soundEngine';
import {
  createInitialPlayerState,
  createInitialProps,
  createStaticColliders,
  getPlayerEyePosition,
  getPlayerLookDirection,
  stepPlayerPhysics,
  stepPropsPhysics,
  throwHeldProp,
} from '../game/physics';
import {
  WEATHER_LABELS,
  createInitialMechanisms,
  createInitialRulesState,
  evaluateGameRules,
} from '../game/rules';
import type {
  GameMode,
  GameState,
  HudSnapshot,
  PhysicsProp,
  PlayerInput,
  WeatherPreset,
} from '../game/types';
import { buildExteriorAndParticles } from '../scene/exteriorBuilder';
import { createLightingRig } from '../scene/lightingRig';
import { type InteractableTarget, buildBedroomScene } from '../scene/roomBuilder';
import { createRoomTextures } from '../scene/textures';

export interface GameControllerApi {
  startGame: (mode?: GameMode) => void;
  setGameState: (next: GameState) => void;
  setWeather: (weather: WeatherPreset) => void;
  setMode: (mode: GameMode) => void;
  toggleMute: () => void;
  restartGame: () => void;
  setTouchMove: (forward: number, right: number, sprint: boolean) => void;
  addTouchLook: (dx: number, dy: number) => void;
  triggerJump: () => void;
  setTouchCrouch: (crouch: boolean) => void;
  triggerGrabOrDrop: () => void;
  triggerThrow: () => void;
  triggerSwitch: () => void;
}

interface GameCanvasProps {
  initialState: GameState;
  initialMode: GameMode;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onControllerReady: (api: GameControllerApi) => void;
}

const _raycaster = new THREE.Raycaster();
const _centerNDC = new THREE.Vector2(0, 0);
const _lookTarget = new THREE.Vector3();
const _camGoal = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function GameCanvas({
  initialState,
  initialMode,
  onHudUpdate,
  onControllerReady,
}: GameCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onHudUpdateRef = useRef(onHudUpdate);
  const onControllerReadyRef = useRef(onControllerReady);
  onHudUpdateRef.current = onHudUpdate;
  onControllerReadyRef.current = onControllerReady;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.84;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      68,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.06,
      180,
    );

    const textures = createRoomTextures(renderer.capabilities.getMaxAnisotropy());
    const room = buildBedroomScene(textures, isSoftwareGl);
    scene.add(room.root);

    const exterior = buildExteriorAndParticles(textures);
    scene.add(exterior.root);

    const lighting = createLightingRig(renderer, scene, camera, isSoftwareGl);
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const sound = new SoundEngine();

    // Simulation state
    const colliders = createStaticColliders();
    let gameState: GameState = initialState;
    let gameMode: GameMode = initialMode;
    let bestScore = Number(localStorage.getItem('bilik_tropis_best') || '0') || 0;
    let player = createInitialPlayerState();
    let props: PhysicsProp[] = createInitialProps();
    let mechanisms = createInitialMechanisms();
    let rules = createInitialRulesState(gameMode, bestScore);
    let fanToggledByPlayer = false;
    let lightToggledByPlayer = false;
    let lastStrideStep = 0;
    let prevCamShakeX = 0;
    let prevCamShakeY = 0;
    let currentTarget: InteractableTarget | null = null;
    let lastHudPush = 0;

    // Unified Input Hub
    const heldKeys = new Set<string>();
    let justPressedJump = false;
    let justPressedDash = false;
    let mouseLookAccumX = 0;
    let mouseLookAccumY = 0;
    let isDraggingLook = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let touchForward = 0;
    let touchRight = 0;
    let touchSprint = false;
    let touchCrouch = false;

    const clearInputs = () => {
      heldKeys.clear();
      justPressedJump = false;
      justPressedDash = false;
      isDraggingLook = false;
      touchForward = 0;
      touchRight = 0;
      touchSprint = false;
      touchCrouch = false;
      player.chargingThrow = false;
    };

    const syncBodyState = (s: GameState) => {
      document.body.dataset.state = s;
      if (s !== 'playing' && document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    };
    syncBodyState(gameState);

    const syncPropMeshes = () => {
      for (const p of props) {
        const m = room.propMeshes.get(p.id);
        if (m) {
          m.position.set(p.x, p.y, p.z);
          m.rotation.set(p.rx, p.ry, p.rz);
        }
      }
    };
    syncPropMeshes();

    const resetWorld = (mode: GameMode) => {
      gameMode = mode;
      player = createInitialPlayerState();
      props = createInitialProps();
      mechanisms = createInitialMechanisms();
      rules = createInitialRulesState(mode, bestScore);
      fanToggledByPlayer = false;
      lightToggledByPlayer = false;
      lastStrideStep = 0;
      clearInputs();
      syncPropMeshes();
    };

    const pushHud = (force = false) => {
      const now = performance.now();
      if (!force && now - lastHudPush < 95) return;
      lastHudPush = now;

      let interactPrompt: string | null = null;
      if (gameState === 'playing') {
        if (player.heldPropId) {
          const held = props.find((p) => p.id === player.heldPropId);
          interactPrompt = `Memegang ${held?.label ?? 'Benda'} · [F / Klik Kanan] Lempar · [E] Taruh`;
        } else if (currentTarget) {
          if (currentTarget.kind === 'prop') {
            interactPrompt = `[E / Klik] Ambil ${currentTarget.label}`;
          } else if (currentTarget.kind === 'fan') {
            interactPrompt = `[T / E] Kipas Angin (Level ${mechanisms.fanSpeed}/3)`;
          } else if (currentTarget.kind === 'tubeLight') {
            interactPrompt = `[T / E] ${mechanisms.tubeLightOn ? 'Matikan' : 'Nyalakan'} Lampu Pintu`;
          } else if (currentTarget.kind === 'northWindow') {
            interactPrompt = `[T / E] ${mechanisms.northWindowOpen ? 'Tutup' : 'Buka'} Jendela Kasur`;
          } else if (currentTarget.kind === 'eastWindow') {
            interactPrompt = `[T / E] ${mechanisms.eastWindowOpen ? 'Tutup' : 'Buka'} Jendela Oranye`;
          }
        }
      }

      const heldObj = player.heldPropId ? props.find((p) => p.id === player.heldPropId) : null;
      onHudUpdateRef.current({
        gameState,
        mode: gameMode,
        weather: rules.weather,
        weatherLabel: WEATHER_LABELS[rules.weather],
        score: Math.round(rules.score),
        bestScore: Math.round(rules.bestScore),
        combo: rules.combo,
        trickShots: rules.trickShots,
        roomIntegrity: Math.round(rules.roomIntegrity),
        maxIntegrity: rules.maxIntegrity,
        elapsedTime: Math.round(rules.elapsedTime),
        objectives: rules.objectives.map((o) => ({ ...o })),
        completedCount: rules.objectives.filter((o) => o.completed).length,
        totalObjectives: rules.objectives.length,
        heldPropLabel: heldObj ? heldObj.label : null,
        throwCharge: player.throwCharge,
        interactPrompt,
        fanSpeed: mechanisms.fanSpeed,
        tubeLightOn: mechanisms.tubeLightOn,
        northWindowOpen: mechanisms.northWindowOpen,
        eastWindowOpen: mechanisms.eastWindowOpen,
        breakerTripped: mechanisms.breakerTripped,
        victory: rules.victory,
        muted: sound.isMuted(),
        activeAnomalies: rules.anomalies.filter((a) => a.active).length,
      });
    };

    const performInteract = (allowPropGrab: boolean) => {
      if (gameState !== 'playing') return;
      sound.ensureStarted();

      // If already holding a prop and user presses E, gently drop it
      if (player.heldPropId && allowPropGrab) {
        const held = props.find((p) => p.id === player.heldPropId);
        if (held) {
          held.held = false;
          const look = getPlayerLookDirection(player);
          held.vx = look.x * 1.4;
          held.vy = 0.6;
          held.vz = look.z * 1.4;
        }
        player.heldPropId = null;
        player.chargingThrow = false;
        player.throwCharge = 0;
        sound.playGrab();
        pushHud(true);
        return;
      }

      if (!currentTarget) return;

      if (currentTarget.kind === 'prop' && allowPropGrab) {
        const targetProp = props.find((p) => p.id === currentTarget!.id);
        if (targetProp) {
          targetProp.held = true;
          targetProp.scoredZone = undefined;
          player.heldPropId = targetProp.id;
          sound.playGrab();
        }
      } else if (currentTarget.kind === 'fan') {
        mechanisms.fanSpeed = ((mechanisms.fanSpeed + 1) % 4) as 0 | 1 | 2 | 3;
        fanToggledByPlayer = true;
        sound.playSwitch();
      } else if (currentTarget.kind === 'tubeLight') {
        mechanisms.tubeLightOn = !mechanisms.tubeLightOn;
        if (mechanisms.tubeLightOn) mechanisms.tubeFlickerTimer = 0.45;
        lightToggledByPlayer = true;
        sound.playSwitch();
      } else if (currentTarget.kind === 'northWindow') {
        mechanisms.northWindowOpen = !mechanisms.northWindowOpen;
        sound.playSwitch();
      } else if (currentTarget.kind === 'eastWindow') {
        mechanisms.eastWindowOpen = !mechanisms.eastWindowOpen;
        sound.playSwitch();
      }
      pushHud(true);
    };

    const performQuickThrow = () => {
      if (gameState !== 'playing' || !player.heldPropId) return;
      sound.ensureStarted();
      const charge = Math.max(0.45, player.throwCharge);
      throwHeldProp(props, player, charge);
      sound.playThrow(charge);
      pushHud(true);
    };

    const api: GameControllerApi = {
      startGame: (mode) => {
        sound.ensureStarted();
        if (mode) gameMode = mode;
        resetWorld(gameMode);
        gameState = 'playing';
        syncBodyState('playing');
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        pushHud(true);
      },
      setGameState: (next) => {
        gameState = next;
        syncBodyState(next);
        clearInputs();
        if (next === 'title') {
          resetWorld(gameMode);
        }
        pushHud(true);
      },
      setWeather: (weather) => {
        sound.ensureStarted();
        rules.weather = weather;
        if (weather === 'storm') {
          rules.lightningFlash = 0.85;
          sound.playThunder();
        }
        pushHud(true);
      },
      setMode: (mode) => {
        gameMode = mode;
        rules.mode = mode;
        pushHud(true);
      },
      toggleMute: () => {
        sound.ensureStarted();
        sound.toggleMute();
        pushHud(true);
      },
      restartGame: () => {
        sound.ensureStarted();
        resetWorld(gameMode);
        gameState = 'playing';
        syncBodyState('playing');
        pushHud(true);
      },
      setTouchMove: (forward, right, sprint) => {
        touchForward = forward;
        touchRight = right;
        touchSprint = sprint;
      },
      addTouchLook: (dx, dy) => {
        mouseLookAccumX += dx;
        mouseLookAccumY += dy;
      },
      triggerJump: () => {
        if (gameState === 'playing') {
          sound.ensureStarted();
          justPressedJump = true;
        }
      },
      setTouchCrouch: (crouch) => {
        touchCrouch = crouch;
      },
      triggerGrabOrDrop: () => {
        performInteract(true);
      },
      triggerThrow: () => {
        performQuickThrow();
      },
      triggerSwitch: () => {
        performInteract(false);
      },
    };
    onControllerReadyRef.current(api);

    // Event Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (gameState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          api.startGame(gameMode);
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameState === 'playing') {
          api.setGameState('paused');
        } else if (gameState === 'paused') {
          api.setGameState('playing');
        }
        return;
      }

      if (e.code === 'KeyM') {
        api.toggleMute();
        return;
      }
      if (gameState === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR') {
          api.restartGame();
        }
        return;
      }

      if (e.code === 'KeyR' && (gameState === 'playing' || gameState === 'paused')) {
        api.restartGame();
        return;
      }

      if (gameState !== 'playing') return;

      if (!e.repeat) {
        if (e.code === 'Space') justPressedJump = true;
        if (e.code === 'KeyQ') justPressedDash = true;
        if (e.code === 'KeyE') performInteract(true);
        if (e.code === 'KeyT') performInteract(false);
        if (e.code === 'KeyF') {
          if (player.heldPropId) {
            player.chargingThrow = true;
          }
        }
        if (e.code === 'Digit1') api.setWeather('sunny');
        if (e.code === 'Digit2') api.setWeather('overcast');
        if (e.code === 'Digit3') api.setWeather('storm');
        if (e.code === 'Digit4') api.setWeather('night');
      }
      heldKeys.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
      if (e.code === 'KeyF' && player.chargingThrow) {
        performQuickThrow();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (gameState !== 'playing') return;
      sound.ensureStarted();
      if (e.button === 0) {
        if (document.pointerLockElement !== renderer.domElement && !isSoftwareGl) {
          try {
            renderer.domElement.requestPointerLock?.();
          } catch {
            // Pointer lock may be unsupported in mobile/Android WebView
          }
        }
        isDraggingLook = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        if (currentTarget) {
          performInteract(true);
        }
      } else if (e.button === 2) {
        if (player.heldPropId) {
          player.chargingThrow = true;
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isDraggingLook = false;
      if (e.button === 2 && player.chargingThrow) {
        performQuickThrow();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (gameState !== 'playing') return;
      if (document.pointerLockElement === renderer.domElement) {
        mouseLookAccumX += e.movementX * 0.0024;
        mouseLookAccumY += e.movementY * 0.0022;
      } else if (isDraggingLook) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        mouseLookAccumX += dx * 0.0036;
        mouseLookAccumY += dy * 0.0032;
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      lighting.resize(w, h);
      lighting.renderFrame();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', onResize);

    // Build raycast list once
    const raycastMeshes: THREE.Object3D[] = room.interactables.map((t) => t.mesh);

    // Main Simulation & Render Loop
    let lastTime = performance.now();
    let elapsedTotal = 0;
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      elapsedTotal += dt;

      if (gameState === 'title') {
        // Atmospheric live-world camera tour inside the exact room!
        const angle = elapsedTotal * 0.16;
        _camGoal.set(
          0.35 + Math.sin(angle) * 0.65,
          1.38 + Math.sin(angle * 0.7) * 0.12,
          0.75 + Math.cos(angle) * 0.55,
        );
        camera.position.lerp(_camGoal, 1 - Math.exp(-4 * dt));
        _lookTarget.set(-0.25 + Math.cos(angle * 0.8) * 0.45, 1.05, -1.25);
        camera.lookAt(_lookTarget);
        exterior.updateWeather('sunny', elapsedTotal, dt, 0.4, 0.2, 0);
        lighting.updateLighting('sunny', true, 0, 0, elapsedTotal);
        room.curtainWindUniforms.uTime.value = elapsedTotal;
        room.curtainWindUniforms.uWind.value = 0.55;
        room.fanRotor.rotation.z += 7.5 * dt;
      } else if (gameState === 'playing') {
        // Hitstop freeze for heavy anomaly hits
        if (rules.hitstopTimer > 0) {
          rules.hitstopTimer = Math.max(0, rules.hitstopTimer - dt);
        } else {
          // Build unified PlayerInput (Keyboard + Android Touch)
          const keyForward =
            (heldKeys.has('KeyW') || heldKeys.has('ArrowUp') ? 1 : 0) -
            (heldKeys.has('KeyS') || heldKeys.has('ArrowDown') ? 1 : 0);
          const keyRight =
            (heldKeys.has('KeyD') || heldKeys.has('ArrowRight') ? 1 : 0) -
            (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft') ? 1 : 0);

          const input: PlayerInput = {
            forward: Math.max(-1, Math.min(1, keyForward + touchForward)),
            right: Math.max(-1, Math.min(1, keyRight + touchRight)),
            sprint: heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight') || touchSprint,
            crouchHeld: heldKeys.has('KeyC') || heldKeys.has('ControlLeft') || touchCrouch,
            jumpHeld: heldKeys.has('Space'),
            jumpJustPressed: justPressedJump,
            dashJustPressed: justPressedDash,
            lookDeltaX: mouseLookAccumX,
            lookDeltaY: mouseLookAccumY,
          };
          justPressedJump = false;
          justPressedDash = false;
          mouseLookAccumX = 0;
          mouseLookAccumY = 0;

          if (player.chargingThrow && player.heldPropId) {
            player.throwCharge = Math.min(1, player.throwCharge + dt * 1.45);
          }

          stepPlayerPhysics(player, input, colliders, dt);

          // Footstep audio synced to stride distance
          const currentStride = Math.floor(player.strideDistance / 0.82);
          if (currentStride > lastStrideStep && player.grounded) {
            lastStrideStep = currentStride;
            sound.playFootstep();
          }

          const impacts = stepPropsPhysics(
            props,
            player,
            colliders,
            mechanisms,
            rules.weather,
            rules.windGustX,
            rules.windGustZ,
            dt,
          );
          for (const imp of impacts) {
            sound.playImpact(imp.material, imp.speed);
            const pCol =
              imp.material === 'ceramic' ? 0xf5efe4 : imp.material === 'rubber' ? 0xff9f45 : 0xd9d2c4;
            exterior.spawnParticles(imp.x, imp.y, imp.z, pCol, Math.min(12, Math.round(imp.speed * 2.2)), 0.7);
          }

          const ruleOut = evaluateGameRules(
            rules,
            props,
            mechanisms,
            fanToggledByPlayer,
            lightToggledByPlayer,
            dt,
          );

          for (const se of ruleOut.scoreEvents) {
            sound.playScore(se.isTrickShot);
            exterior.spawnParticles(se.x, se.y, se.z, se.isTrickShot ? 0x62f5a8 : 0xffe066, 18, 1.3);
          }
          if (ruleOut.lightningTriggered) {
            sound.playThunder();
          }
          if (ruleOut.ended) {
            bestScore = Math.max(bestScore, Math.round(rules.bestScore));
            localStorage.setItem('bilik_tropis_best', String(bestScore));
            if (rules.victory) sound.playVictory();
            else sound.playDefeat();
            gameState = 'gameover';
            syncBodyState('gameover');
            pushHud(true);
          }
        }

        // Sync 3D visuals with simulation state
        syncPropMeshes();
        exterior.stepParticles(dt);
        exterior.syncAnomalies(rules.anomalies, elapsedTotal);

        const winOpenCount = (mechanisms.northWindowOpen ? 1 : 0) + (mechanisms.eastWindowOpen ? 1 : 0);
        exterior.updateWeather(
          rules.weather,
          elapsedTotal,
          dt,
          rules.windGustX,
          rules.windGustZ,
          rules.lightningFlash,
        );
        lighting.updateLighting(
          rules.weather,
          mechanisms.tubeLightOn,
          mechanisms.tubeFlickerTimer,
          rules.lightningFlash,
          elapsedTotal,
        );
        sound.updateAmbience(rules.weather, mechanisms.fanSpeed, mechanisms.tubeLightOn, winOpenCount, false);

        // Animate mechanisms & shaders
        room.fanRotor.rotation.z = mechanisms.fanAngle;
        room.tubeEmissiveMat.emissiveIntensity = mechanisms.tubeLightOn ? 2.2 : 0.05;
        room.northWindowSash.position.x = 0.36 - mechanisms.northWindowOpenBlend * 0.56;
        room.eastWindowSash.position.x = 0.28 - mechanisms.eastWindowOpenBlend * 0.44;
        room.rainGlassUniforms.uTime.value = elapsedTotal;
        room.rainGlassUniforms.uRain.value =
          rules.weather === 'storm' ? 1.0 : rules.weather === 'night' ? 0.7 : rules.weather === 'overcast' ? 0.25 : 0;
        room.curtainWindUniforms.uTime.value = elapsedTotal;
        room.curtainWindUniforms.uWind.value =
          (rules.weather === 'storm' ? 1.9 : rules.weather === 'overcast' ? 1.15 : 0.45) +
          (mechanisms.fanSpeed * 0.22);

        // Show glowing green ring on hallway laundry basket while player holds laundry or sport ball
        const heldProp = player.heldPropId ? props.find((p) => p.id === player.heldPropId) : null;
        const showBasketRing = heldProp && (heldProp.category === 'laundry' || heldProp.category === 'toy');
        (room.basketTargetRing.material as THREE.MeshBasicMaterial).opacity = showBasketRing
          ? 0.55 + 0.3 * Math.sin(elapsedTotal * 5)
          : 0.0;

        // First-Person Camera + stride-synced head-bob + trauma shake
        const eye = getPlayerEyePosition(player);
        const speedHoriz = Math.hypot(player.vx, player.vz);
        const bobAmp = player.grounded && speedHoriz > 0.2 ? Math.min(0.028, speedHoriz * 0.007) : 0;
        const bobY = Math.sin(player.strideDistance * 5.2) * bobAmp;
        const shake = rules.cameraTrauma * rules.cameraTrauma * 0.04;
        prevCamShakeX = (Math.random() - 0.5) * shake;
        prevCamShakeY = (Math.random() - 0.5) * shake;

        camera.position.set(eye.x + prevCamShakeX, eye.y + bobY + prevCamShakeY, eye.z);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;
        camera.rotation.z = 0;

        // Fast raycast against interactables array only (within 2.35m reach)
        _raycaster.setFromCamera(_centerNDC, camera);
        _raycaster.far = 2.35;
        const hits = _raycaster.intersectObjects(raycastMeshes, true);
        currentTarget = null;
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0].object;
          while (obj) {
            const found = room.interactables.find((t) => t.mesh === obj);
            if (found) {
              currentTarget = found;
              break;
            }
            obj = obj.parent;
          }
        }
      } else {
        // Paused or GameOver
        sound.updateAmbience(rules.weather, 0, false, 0, true);
      }

      lighting.renderFrame();
      pushHud(false);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    // Render first frame synchronously so initial screenshot / first paint is never blank
    exterior.updateWeather(rules.weather, 0, 0.016, 0, 0, 0);
    lighting.updateLighting(rules.weather, mechanisms.tubeLightOn, 0, 0, 0);
    if (gameState === 'title') {
      camera.position.set(0.35, 1.38, 1.30);
      camera.lookAt(-0.25, 1.05, -1.25);
    } else {
      const eye = getPlayerEyePosition(player);
      camera.position.set(eye.x, eye.y, eye.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
    }
    lighting.renderFrame();

    pushHud(true);
    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);
      sound.dispose();
      lighting.dispose();
      exterior.dispose();
      room.dispose();
      textures.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [initialMode, initialState]);

  return (
    <div
      ref={mountRef}
      data-testid="game-canvas-mount"
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#141710]"
    />
  );
}
