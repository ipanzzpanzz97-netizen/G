import type {
  AABB,
  ImpactEvent,
  PhysicsProp,
  PlayerInput,
  PlayerState,
  RoomMechanismState,
  WeatherPreset,
} from './types';

export const ROOM_MIN_X = -1.7;
export const ROOM_MAX_X = 1.7;
export const ROOM_MIN_Z = -1.9;
export const ROOM_MAX_Z = 1.9;

export const DOOR_MIN_Z = 0.58;
export const DOOR_MAX_Z = 1.48;
export const DOOR_HEIGHT = 2.04;

export const HALL_MIN_X = -3.05;
export const HALL_MIN_Z = 0.05;
export const HALL_MAX_Z = 1.85;

export const PLAYER_RADIUS = 0.24;
export const PLAYER_STAND_HEIGHT = 1.68;
export const PLAYER_CROUCH_HEIGHT = 0.68;
export const PLAYER_STAND_EYE = 1.54;
export const PLAYER_CROUCH_EYE = 0.58;

export const GRAVITY = 21.0;
export const PROP_GRAVITY = 15.5;

export function ceilingHeightAt(x: number, z: number): number {
  return 2.66 + 0.065 * x - 0.045 * z;
}

export function createStaticColliders(): AABB[] {
  return [
    // Bed (dark leather divan + pillow-top mattress)
    { id: 'bed_base', minX: -1.68, maxX: 0.27, minY: 0, maxY: 0.56, minZ: -1.88, maxZ: -0.80, solid: true },
    // NE corner structural column
    { id: 'ne_pillar', minX: 1.34, maxX: 1.70, minY: 0, maxY: 2.86, minZ: -1.90, maxZ: -1.54, solid: true },
    // White corner table
    { id: 'corner_table', minX: 0.55, maxX: 1.33, minY: 0, maxY: 0.74, minZ: -1.88, maxZ: -1.16, solid: true },
    // Folding chair stacked with bolster & pillows
    { id: 'folding_chair', minX: 0.96, maxX: 1.54, minY: 0, maxY: 0.86, minZ: -0.92, maxZ: -0.36, solid: true },
    // Reddish-mahogany 3-door wardrobe
    { id: 'wardrobe', minX: 1.14, maxX: 1.69, minY: 0, maxY: 1.96, minZ: 0.24, maxZ: 1.64, solid: true },
    // Stool with colorful clothes pile in front of wardrobe
    { id: 'clothes_stool', minX: 0.76, maxX: 1.14, minY: 0, maxY: 0.48, minZ: 0.72, maxZ: 1.18, solid: true },
    // Study desk top (open underneath so crouched player can crawl under!)
    { id: 'desk_top', minX: -1.34, maxX: -0.04, minY: 0.70, maxY: 0.76, minZ: 1.22, maxZ: 1.88, solid: true },
    { id: 'desk_left', minX: -1.34, maxX: -1.27, minY: 0, maxY: 0.74, minZ: 1.22, maxZ: 1.88, solid: true },
    { id: 'desk_right', minX: -0.11, maxX: -0.04, minY: 0, maxY: 0.74, minZ: 1.22, maxZ: 1.88, solid: true },
    // Canon printer + router stacked under desk
    { id: 'printer_stack', minX: -1.26, maxX: -0.80, minY: 0, maxY: 0.34, minZ: 1.40, maxZ: 1.82, solid: true },
    // Green laundry basket in hallway outside door
    { id: 'laundry_basket', minX: -2.42, maxX: -1.96, minY: 0, maxY: 0.40, minZ: 0.92, maxZ: 1.38, solid: true },
    // Hallway storage rack
    { id: 'hall_rack', minX: -3.02, maxX: -2.46, minY: 0, maxY: 1.75, minZ: 0.10, maxZ: 0.75, solid: true },
  ];
}

export function createInitialPlayerState(): PlayerState {
  return {
    x: 0.18,
    y: 0,
    z: 0.28,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: -0.42,
    pitch: -0.05,
    grounded: true,
    crouching: false,
    crouchBlend: 0,
    sprinting: false,
    coyoteTimer: 0.1,
    jumpBufferTimer: 0,
    strideDistance: 0,
    heldPropId: null,
    throwCharge: 0,
    chargingThrow: false,
    dashCooldown: 0,
  };
}

export function createInitialProps(): PhysicsProp[] {
  return [
    // Desk props (matching video 00:09-00:13)
    {
      id: 'desk_mug',
      label: 'Mug Keramik Putih',
      category: 'desk',
      material: 'ceramic',
      x: -0.34,
      y: 0.82,
      z: 1.42,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0.4,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.055,
      halfH: 0.06,
      halfD: 0.055,
      mass: 0.45,
      restitution: 0.35,
      friction: 0.75,
      windSensitive: false,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
    {
      id: 'snack_jar',
      label: 'Toples Kue Tutup Merah',
      category: 'desk',
      material: 'plastic',
      x: -0.22,
      y: 0.87,
      z: 1.62,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: -0.2,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.08,
      halfH: 0.11,
      halfD: 0.08,
      mass: 0.65,
      restitution: 0.45,
      friction: 0.65,
      windSensitive: false,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
    {
      id: 'teal_pouch',
      label: 'Tas Kain Toska',
      category: 'laundry',
      material: 'fabric',
      x: -0.68,
      y: 0.80,
      z: 1.48,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0.25,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.14,
      halfH: 0.04,
      halfD: 0.11,
      mass: 0.35,
      restitution: 0.15,
      friction: 0.85,
      windSensitive: true,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
    // Floor beside bed (matching video 00:01)
    {
      id: 'purple_thermos',
      label: 'Botol Termos Ungu',
      category: 'desk',
      material: 'metal',
      x: -0.62,
      y: 0.10,
      z: -0.58,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.045,
      halfH: 0.10,
      halfD: 0.045,
      mass: 0.55,
      restitution: 0.4,
      friction: 0.6,
      windSensitive: false,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
    // Bed pillows & clothes
    {
      id: 'bed_pillow_center',
      label: 'Bantal Putih Kasur',
      category: 'pillow',
      material: 'fabric',
      x: -0.65,
      y: 0.64,
      z: -1.36,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0.12,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.22,
      halfH: 0.075,
      halfD: 0.15,
      mass: 0.4,
      restitution: 0.2,
      friction: 0.88,
      windSensitive: true,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
    {
      id: 'rose_cloth',
      label: 'Kain Lipat Merah Muda',
      category: 'laundry',
      material: 'fabric',
      x: -1.18,
      y: 0.62,
      z: -1.18,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0.45,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.15,
      halfH: 0.045,
      halfD: 0.12,
      mass: 0.3,
      restitution: 0.12,
      friction: 0.9,
      windSensitive: true,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
    // Loose laundry on floor / clothes pile
    {
      id: 'plaid_shirt',
      label: 'Kain Kotak-Kotak Lemari',
      category: 'laundry',
      material: 'fabric',
      x: 0.72,
      y: 0.06,
      z: 0.62,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: -0.35,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.14,
      halfH: 0.045,
      halfD: 0.13,
      mass: 0.32,
      restitution: 0.12,
      friction: 0.9,
      windSensitive: true,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
    // Yellow shoebox (matching top of wardrobe 00:32-00:33)
    {
      id: 'yellow_shoebox',
      label: 'Kotak Sepatu Kuning',
      category: 'storage',
      material: 'cardboard',
      x: 1.38,
      y: 2.04,
      z: 0.48,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0.08,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.15,
      halfH: 0.08,
      halfD: 0.11,
      mass: 0.5,
      restitution: 0.25,
      friction: 0.78,
      windSensitive: true,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
    // Corner table extra cushion
    {
      id: 'corner_cushion',
      label: 'Bantal Abu Meja Sudut',
      category: 'pillow',
      material: 'fabric',
      x: 0.92,
      y: 0.84,
      z: -1.52,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: -0.25,
      ry: -0.4,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.19,
      halfH: 0.08,
      halfD: 0.15,
      mass: 0.42,
      restitution: 0.22,
      friction: 0.85,
      windSensitive: true,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
    // Rolling office stool near East window (pushable!)
    {
      id: 'rolling_stool',
      label: 'Kursi Putar Hitam',
      category: 'chair',
      material: 'plastic',
      x: 1.24,
      y: 0.25,
      z: -0.05,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0.6,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.22,
      halfH: 0.25,
      halfD: 0.22,
      mass: 2.8,
      restitution: 0.2,
      friction: 0.35, // Low rolling friction on tiles!
      windSensitive: false,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
    // Desk rolling chair (with light-blue towel on backrest, matching 00:48)
    {
      id: 'desk_chair',
      label: 'Kursi Belajar Handuk Biru',
      category: 'chair',
      material: 'plastic',
      x: -0.54,
      y: 0.42,
      z: 0.92,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0.35,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.25,
      halfH: 0.42,
      halfD: 0.25,
      mass: 3.6,
      restitution: 0.15,
      friction: 0.3,
      windSensitive: false,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
    // Bouncy shuttlecock/rubber ball for physics trick-shots & deflecting storm orbs
    {
      id: 'sport_ball',
      label: 'Bola Karet Pantul',
      category: 'toy',
      material: 'rubber',
      x: 0.10,
      y: 0.07,
      z: -0.30,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      halfW: 0.065,
      halfH: 0.065,
      halfD: 0.065,
      mass: 0.25,
      restitution: 0.84,
      friction: 0.55,
      windSensitive: true,
      held: false,
      bounces: 0,
      lastImpactSpeed: 0,
    },
  ];
}

export function stepPlayerPhysics(
  player: PlayerState,
  input: PlayerInput,
  colliders: AABB[],
  rawDt: number,
): void {
  const dt = Math.min(rawDt, 0.05);

  // Look rotation
  player.yaw -= input.lookDeltaX;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - input.lookDeltaY));

  // Timers
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  if (player.grounded) {
    player.coyoteTimer = 0.11;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }

  if (input.jumpJustPressed) {
    player.jumpBufferTimer = 0.12;
  } else {
    player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
  }

  // Crouch state (cannot stand up if under the desk!)
  const wantsCrouch = input.crouchHeld;
  const blockedAbove = isHeadBlocked(player.x, player.y, player.z, PLAYER_STAND_HEIGHT, colliders);
  player.crouching = wantsCrouch || (player.crouching && blockedAbove);
  const targetCrouch = player.crouching ? 1 : 0;
  player.crouchBlend += (targetCrouch - player.crouchBlend) * (1 - Math.exp(-14 * dt));

  const currentHeight =
    PLAYER_STAND_HEIGHT + (PLAYER_CROUCH_HEIGHT - PLAYER_STAND_HEIGHT) * player.crouchBlend;

  // Movement vector in XZ plane from yaw
  const sinY = Math.sin(player.yaw);
  const cosY = Math.cos(player.yaw);
  // Forward in Three.js camera space with yaw=0 looks toward -Z: (-sinY, -cosY)
  const fwdX = -sinY;
  const fwdZ = -cosY;
  const rightX = cosY;
  const rightZ = -sinY;

  let wishX = fwdX * input.forward + rightX * input.right;
  let wishZ = fwdZ * input.forward + rightZ * input.right;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 1e-4) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  player.sprinting = input.sprint && !player.crouching && wishLen > 0.1;
  const baseSpeed = player.crouching ? 1.85 : player.sprinting ? 4.35 : 2.85;

  // Dash burst
  if (input.dashJustPressed && player.dashCooldown <= 0 && !player.crouching) {
    const dirX = wishLen > 0.1 ? wishX : fwdX;
    const dirZ = wishLen > 0.1 ? wishZ : fwdZ;
    player.vx += dirX * 4.6;
    player.vz += dirZ * 4.6;
    player.dashCooldown = 0.85;
  }

  // Snappy ground accel / air control
  const accel = player.grounded ? 22.0 : 8.5;
  const targetVx = wishX * baseSpeed;
  const targetVz = wishZ * baseSpeed;
  const blend = 1 - Math.exp(-accel * dt);
  player.vx += (targetVx - player.vx) * blend;
  player.vz += (targetVz - player.vz) * blend;

  // Jump with coyote time + input buffering + variable jump cut
  if (player.jumpBufferTimer > 0 && player.coyoteTimer > 0 && !blockedAbove) {
    player.vy = 6.5;
    player.grounded = false;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
  }
  if (!input.jumpHeld && player.vy > 1.8) {
    player.vy *= 0.65;
  }

  // Gravity
  player.vy -= GRAVITY * dt;

  // Horizontal integration & sub-stepped collision resolution
  const steps = 2;
  const subDt = dt / steps;
  for (let s = 0; s < steps; s++) {
    player.x += player.vx * subDt;
    resolvePlayerHorizontal(player, currentHeight, colliders);
    player.z += player.vz * subDt;
    resolvePlayerHorizontal(player, currentHeight, colliders);
  }

  // Vertical integration & ground/furniture top support
  const prevY = player.y;
  player.y += player.vy * dt;
  player.grounded = false;

  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.grounded = true;
  }

  // Land on top of solid furniture (e.g., jumping onto the bed or corner table)
  for (const box of colliders) {
    if (!box.solid) continue;
    if (
      player.x + PLAYER_RADIUS > box.minX &&
      player.x - PLAYER_RADIUS < box.maxX &&
      player.z + PLAYER_RADIUS > box.minZ &&
      player.z - PLAYER_RADIUS < box.maxZ
    ) {
      // Landing from above
      if (prevY >= box.maxY - 0.14 && player.y <= box.maxY && player.vy <= 0) {
        player.y = box.maxY;
        player.vy = 0;
        player.grounded = true;
      } else if (prevY + currentHeight <= box.minY + 0.08 && player.y + currentHeight > box.minY && player.vy > 0) {
        // Bonk head on underside of desk top
        player.y = box.minY - currentHeight;
        player.vy = 0;
      }
    }
  }

  // Ceiling clamp
  const ceilY = ceilingHeightAt(player.x, player.z);
  if (player.y + currentHeight > ceilY - 0.05) {
    player.y = ceilY - 0.05 - currentHeight;
    if (player.vy > 0) player.vy = 0;
  }

  if (player.grounded) {
    player.strideDistance += Math.hypot(player.vx, player.vz) * dt;
  }
}

function isHeadBlocked(x: number, y: number, z: number, testHeight: number, colliders: AABB[]): boolean {
  for (const box of colliders) {
    if (!box.solid) continue;
    if (
      x + PLAYER_RADIUS > box.minX &&
      x - PLAYER_RADIUS < box.maxX &&
      z + PLAYER_RADIUS > box.minZ &&
      z - PLAYER_RADIUS < box.maxZ
    ) {
      if (y + testHeight > box.minY && y + 0.35 < box.maxY && y < box.minY) {
        return true;
      }
    }
  }
  return false;
}

function resolvePlayerHorizontal(player: PlayerState, height: number, colliders: AABB[]): void {
  // Room & Hallway perimeter bounds
  const inDoorZ = player.z > DOOR_MIN_Z + PLAYER_RADIUS && player.z < DOOR_MAX_Z - PLAYER_RADIUS;

  if (player.x >= ROOM_MIN_X) {
    // Inside main bedroom
    if (player.x > ROOM_MAX_X - PLAYER_RADIUS) {
      player.x = ROOM_MAX_X - PLAYER_RADIUS;
      player.vx = 0;
    }
    if (player.z < ROOM_MIN_Z + PLAYER_RADIUS) {
      player.z = ROOM_MIN_Z + PLAYER_RADIUS;
      player.vz = 0;
    }
    if (player.z > ROOM_MAX_Z - PLAYER_RADIUS) {
      player.z = ROOM_MAX_Z - PLAYER_RADIUS;
      player.vz = 0;
    }
    // West wall except through doorway
    if (player.x < ROOM_MIN_X + PLAYER_RADIUS && (!inDoorZ || player.y + height > DOOR_HEIGHT)) {
      player.x = ROOM_MIN_X + PLAYER_RADIUS;
      player.vx = 0;
    }
  } else {
    // Inside terracotta hallway outside doorway
    if (player.x < HALL_MIN_X + PLAYER_RADIUS) {
      player.x = HALL_MIN_X + PLAYER_RADIUS;
      player.vx = 0;
    }
    if (player.z < HALL_MIN_Z + PLAYER_RADIUS) {
      player.z = HALL_MIN_Z + PLAYER_RADIUS;
      player.vz = 0;
    }
    if (player.z > HALL_MAX_Z - PLAYER_RADIUS) {
      player.z = HALL_MAX_Z - PLAYER_RADIUS;
      player.vz = 0;
    }
    // Doorframe jambs when exiting back to room
    if (player.x > ROOM_MIN_X - PLAYER_RADIUS && !inDoorZ) {
      player.x = ROOM_MIN_X - PLAYER_RADIUS;
      player.vx = 0;
    }
  }

  // Furniture AABBs (with 0.14m step-up tolerance for small ledges)
  for (const box of colliders) {
    if (!box.solid) continue;
    if (player.y + 0.14 >= box.maxY || player.y + height <= box.minY) continue;

    const overlapLeft = player.x + PLAYER_RADIUS - box.minX;
    const overlapRight = box.maxX - (player.x - PLAYER_RADIUS);
    const overlapFront = player.z + PLAYER_RADIUS - box.minZ;
    const overlapBack = box.maxZ - (player.z - PLAYER_RADIUS);

    if (overlapLeft > 0 && overlapRight > 0 && overlapFront > 0 && overlapBack > 0) {
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapFront, overlapBack);
      if (minOverlap === overlapLeft) {
        player.x = box.minX - PLAYER_RADIUS;
        player.vx = Math.min(0, player.vx);
      } else if (minOverlap === overlapRight) {
        player.x = box.maxX + PLAYER_RADIUS;
        player.vx = Math.max(0, player.vx);
      } else if (minOverlap === overlapFront) {
        player.z = box.minZ - PLAYER_RADIUS;
        player.vz = Math.min(0, player.vz);
      } else {
        player.z = box.maxZ + PLAYER_RADIUS;
        player.vz = Math.max(0, player.vz);
      }
    }
  }
}

export function getPlayerEyePosition(player: PlayerState): { x: number; y: number; z: number } {
  const eyeOffset = PLAYER_STAND_EYE + (PLAYER_CROUCH_EYE - PLAYER_STAND_EYE) * player.crouchBlend;
  return { x: player.x, y: player.y + eyeOffset, z: player.z };
}

export function getPlayerLookDirection(player: PlayerState): { x: number; y: number; z: number } {
  const cosP = Math.cos(player.pitch);
  return {
    x: -Math.sin(player.yaw) * cosP,
    y: Math.sin(player.pitch),
    z: -Math.cos(player.yaw) * cosP,
  };
}

export function stepPropsPhysics(
  props: PhysicsProp[],
  player: PlayerState,
  colliders: AABB[],
  mechanisms: RoomMechanismState,
  weather: WeatherPreset,
  windGustX: number,
  windGustZ: number,
  rawDt: number,
): ImpactEvent[] {
  const dt = Math.min(rawDt, 0.05);
  const impacts: ImpactEvent[] = [];
  const eye = getPlayerEyePosition(player);
  const look = getPlayerLookDirection(player);

  for (const prop of props) {
    if (prop.held) {
      // Spring-damper carry in front of camera
      const holdDist = 0.85;
      const targetX = eye.x + look.x * holdDist;
      const targetY = Math.max(prop.halfH + 0.05, eye.y + look.y * holdDist - 0.12);
      const targetZ = eye.z + look.z * holdDist;
      const spring = 18.0;
      prop.vx = (targetX - prop.x) * spring;
      prop.vy = (targetY - prop.y) * spring;
      prop.vz = (targetZ - prop.z) * spring;
      prop.x += prop.vx * dt;
      prop.y += prop.vy * dt;
      prop.z += prop.vz * dt;
      prop.ry += (player.yaw - prop.ry) * Math.min(1, 10 * dt);
      prop.rx *= 0.85;
      prop.rz *= 0.85;
      continue;
    }

    // Player nudge / kick on rolling chairs or small floor props
    const dx = prop.x - player.x;
    const dz = prop.z - player.z;
    const distXZ = Math.hypot(dx, dz);
    const pushRad = PLAYER_RADIUS + Math.max(prop.halfW, prop.halfD);
    if (distXZ < pushRad && distXZ > 1e-4 && Math.abs(prop.y - prop.halfH - player.y) < 0.65) {
      const nx = dx / distXZ;
      const nz = dz / distXZ;
      const overlap = pushRad - distXZ;
      prop.x += nx * overlap * 0.65;
      prop.z += nz * overlap * 0.65;
      const playerSpeed = Math.hypot(player.vx, player.vz);
      const impulse = Math.max(1.2, playerSpeed * 0.9) / Math.max(0.4, prop.mass * 0.45);
      prop.vx += nx * impulse;
      prop.vz += nz * impulse;
    }

    // Gravity
    prop.vy -= PROP_GRAVITY * dt;

    // Wall fan directional wind field (fan sits at x=-0.58, y=1.82, z=1.84 blowing toward -Z)
    if (mechanisms.fanSpeed > 0 && prop.windSensitive) {
      const dzFan = 1.84 - prop.z;
      const dxFan = Math.abs(prop.x - -0.58);
      if (dzFan > 0 && dzFan < 3.4 && dxFan < 0.95 && prop.y < 2.2) {
        const strength = (mechanisms.fanSpeed * 1.4) / (0.6 + dzFan * 0.45);
        prop.vz -= strength * dt;
        prop.vx += ((prop.x + 0.58) * 0.35) * dt;
      }
    }

    // Window storm wind gusts
    if (prop.windSensitive && (weather === 'storm' || weather === 'overcast')) {
      if (mechanisms.northWindowOpen && prop.z < -0.6) {
        prop.vz += Math.abs(windGustZ) * 0.85 * dt;
        prop.vx += windGustX * 0.4 * dt;
      }
      if (mechanisms.eastWindowOpen && prop.x > 0.5) {
        prop.vx -= Math.abs(windGustX) * 0.85 * dt;
        prop.vz += windGustZ * 0.4 * dt;
      }
    }

    // Air damping
    const airDrag = Math.exp(-0.65 * dt);
    prop.vx *= airDrag;
    prop.vz *= airDrag;

    // Integrate
    prop.x += prop.vx * dt;
    prop.y += prop.vy * dt;
    prop.z += prop.vz * dt;

    prop.rx += prop.avx * dt;
    prop.ry += prop.avy * dt;
    prop.rz += prop.avz * dt;
    prop.avx *= Math.exp(-4.0 * dt);
    prop.avy *= Math.exp(-4.0 * dt);
    prop.avz *= Math.exp(-4.0 * dt);

    // Floor collision
    if (prop.y - prop.halfH < 0) {
      const impactV = Math.abs(prop.vy);
      prop.y = prop.halfH;
      if (impactV > 1.1) {
        prop.vy = impactV * prop.restitution;
        prop.bounces += 1;
        prop.lastImpactSpeed = impactV;
        impacts.push({ propId: prop.id, material: prop.material, speed: impactV, x: prop.x, y: 0.02, z: prop.z });
      } else {
        prop.vy = 0;
        const groundFriction = Math.exp(-prop.friction * 12 * dt);
        prop.vx *= groundFriction;
        prop.vz *= groundFriction;
        prop.rx *= 0.85;
        prop.rz *= 0.85;
      }
    }

    // Furniture surface & side collisions
    for (const box of colliders) {
      if (!box.solid) continue;
      // Don't collide rolling chairs with their own bounding shadow, only walls/desk/bed
      if (prop.category === 'chair' && box.id === 'clothes_stool') continue;

      const withinX = prop.x + prop.halfW > box.minX && prop.x - prop.halfW < box.maxX;
      const withinZ = prop.z + prop.halfD > box.minZ && prop.z - prop.halfD < box.maxZ;
      const withinY = prop.y + prop.halfH > box.minY && prop.y - prop.halfH < box.maxY;

      if (withinX && withinZ && withinY) {
        const penTop = box.maxY - (prop.y - prop.halfH);
        const penLeft = prop.x + prop.halfW - box.minX;
        const penRight = box.maxX - (prop.x - prop.halfW);
        const penFront = prop.z + prop.halfD - box.minZ;
        const penBack = box.maxZ - (prop.z - prop.halfD);

        const minPen = Math.min(penTop, penLeft, penRight, penFront, penBack);
        if (minPen === penTop && prop.vy <= 0.6) {
          const impactV = Math.abs(prop.vy);
          prop.y = box.maxY + prop.halfH;
          if (impactV > 1.2) {
            prop.vy = impactV * prop.restitution;
            prop.bounces += 1;
            impacts.push({ propId: prop.id, material: prop.material, speed: impactV, x: prop.x, y: box.maxY, z: prop.z });
          } else {
            prop.vy = 0;
            const f = Math.exp(-prop.friction * 12 * dt);
            prop.vx *= f;
            prop.vz *= f;
          }
        } else if (minPen === penLeft) {
          prop.x = box.minX - prop.halfW;
          if (Math.abs(prop.vx) > 1.0) {
            impacts.push({ propId: prop.id, material: prop.material, speed: Math.abs(prop.vx), x: prop.x, y: prop.y, z: prop.z });
          }
          prop.vx = -Math.abs(prop.vx) * prop.restitution;
        } else if (minPen === penRight) {
          prop.x = box.maxX + prop.halfW;
          if (Math.abs(prop.vx) > 1.0) {
            impacts.push({ propId: prop.id, material: prop.material, speed: Math.abs(prop.vx), x: prop.x, y: prop.y, z: prop.z });
          }
          prop.vx = Math.abs(prop.vx) * prop.restitution;
        } else if (minPen === penFront) {
          prop.z = box.minZ - prop.halfD;
          if (Math.abs(prop.vz) > 1.0) {
            impacts.push({ propId: prop.id, material: prop.material, speed: Math.abs(prop.vz), x: prop.x, y: prop.y, z: prop.z });
          }
          prop.vz = -Math.abs(prop.vz) * prop.restitution;
        } else {
          prop.z = box.maxZ + prop.halfD;
          if (Math.abs(prop.vz) > 1.0) {
            impacts.push({ propId: prop.id, material: prop.material, speed: Math.abs(prop.vz), x: prop.x, y: prop.y, z: prop.z });
          }
          prop.vz = Math.abs(prop.vz) * prop.restitution;
        }
      }
    }

    // Room wall bounds (allow passing through doorway into hallway!)
    const inDoorZ = prop.z > DOOR_MIN_Z + prop.halfD && prop.z < DOOR_MAX_Z - prop.halfD;
    if (prop.x + prop.halfW > ROOM_MAX_X) {
      prop.x = ROOM_MAX_X - prop.halfW;
      if (Math.abs(prop.vx) > 1.2) {
        impacts.push({ propId: prop.id, material: prop.material, speed: Math.abs(prop.vx), x: prop.x, y: prop.y, z: prop.z });
      }
      prop.vx = -Math.abs(prop.vx) * prop.restitution;
    }
    if (prop.x - prop.halfW < ROOM_MIN_X && (!inDoorZ || prop.y + prop.halfH > DOOR_HEIGHT)) {
      if (prop.x > ROOM_MIN_X - 0.15) {
        prop.x = ROOM_MIN_X + prop.halfW;
        if (Math.abs(prop.vx) > 1.2) {
          impacts.push({ propId: prop.id, material: prop.material, speed: Math.abs(prop.vx), x: prop.x, y: prop.y, z: prop.z });
        }
        prop.vx = Math.abs(prop.vx) * prop.restitution;
      }
    }
    if (prop.x < HALL_MIN_X + prop.halfW) {
      prop.x = HALL_MIN_X + prop.halfW;
      prop.vx = Math.abs(prop.vx) * prop.restitution;
    }
    if (prop.z - prop.halfD < ROOM_MIN_Z) {
      prop.z = ROOM_MIN_Z + prop.halfD;
      if (Math.abs(prop.vz) > 1.2) {
        impacts.push({ propId: prop.id, material: prop.material, speed: Math.abs(prop.vz), x: prop.x, y: prop.y, z: prop.z });
      }
      prop.vz = Math.abs(prop.vz) * prop.restitution;
    }
    if (prop.z + prop.halfD > ROOM_MAX_Z) {
      prop.z = ROOM_MAX_Z - prop.halfD;
      if (Math.abs(prop.vz) > 1.2) {
        impacts.push({ propId: prop.id, material: prop.material, speed: Math.abs(prop.vz), x: prop.x, y: prop.y, z: prop.z });
      }
      prop.vz = -Math.abs(prop.vz) * prop.restitution;
    }
  }

  return impacts;
}

export function throwHeldProp(
  props: PhysicsProp[],
  player: PlayerState,
  charge: number,
): PhysicsProp | null {
  if (!player.heldPropId) return null;
  const prop = props.find((p) => p.id === player.heldPropId);
  if (!prop) return null;

  const look = getPlayerLookDirection(player);
  const power = 4.8 + charge * 7.8; // 4.8 m/s gentle toss up to 12.6 m/s power throw
  prop.held = false;
  prop.bounces = 0;
  prop.vx = look.x * power + player.vx * 0.35;
  prop.vy = look.y * power + 1.65;
  prop.vz = look.z * power + player.vz * 0.35;
  prop.avx = (Math.random() - 0.5) * 9;
  prop.avy = (Math.random() - 0.5) * 9;
  prop.avz = (Math.random() - 0.5) * 9;
  player.heldPropId = null;
  player.throwCharge = 0;
  player.chargingThrow = false;
  return prop;
}
