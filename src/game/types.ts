export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type GameMode = 'challenge' | 'sandbox';

export type WeatherPreset = 'sunny' | 'overcast' | 'storm' | 'night';

export type PropMaterialKind =
  | 'ceramic'
  | 'plastic'
  | 'fabric'
  | 'cardboard'
  | 'metal'
  | 'rubber';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AABB {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  solid?: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  grounded: boolean;
  crouching: boolean;
  crouchBlend: number; // 0 = standing, 1 = crouched
  sprinting: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  strideDistance: number;
  heldPropId: string | null;
  throwCharge: number; // 0..1
  chargingThrow: boolean;
  dashCooldown: number;
}

export interface PhysicsProp {
  id: string;
  label: string;
  category: 'laundry' | 'pillow' | 'desk' | 'toy' | 'storage' | 'chair';
  material: PropMaterialKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  avx: number;
  avy: number;
  avz: number;
  halfW: number;
  halfH: number;
  halfD: number;
  mass: number;
  restitution: number;
  friction: number;
  windSensitive: boolean;
  held: boolean;
  bounces: number;
  lastImpactSpeed: number;
  scoredZone?: string;
}

export interface RoomMechanismState {
  fanSpeed: 0 | 1 | 2 | 3; // 0 = off, 1-3 = speed levels
  fanAngle: number;
  tubeLightOn: boolean;
  tubeFlickerTimer: number;
  northWindowOpen: boolean;
  eastWindowOpen: boolean;
  northWindowOpenBlend: number;
  eastWindowOpenBlend: number;
  breakerTripped: boolean;
}

export interface StormAnomaly {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  active: boolean;
  chargeTime: number;
}

export interface ObjectiveStatus {
  id: string;
  title: string;
  current: number;
  target: number;
  completed: boolean;
}

export interface PlayerInput {
  forward: number; // -1..1
  right: number; // -1..1
  sprint: boolean;
  crouchHeld: boolean;
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  dashJustPressed: boolean;
  lookDeltaX: number;
  lookDeltaY: number;
}

export interface ImpactEvent {
  propId: string;
  material: PropMaterialKind;
  speed: number;
  x: number;
  y: number;
  z: number;
}

export interface ScoreEvent {
  points: number;
  label: string;
  isTrickShot: boolean;
  x: number;
  y: number;
  z: number;
}

export interface HudSnapshot {
  gameState: GameState;
  mode: GameMode;
  weather: WeatherPreset;
  weatherLabel: string;
  score: number;
  bestScore: number;
  combo: number;
  trickShots: number;
  roomIntegrity: number;
  maxIntegrity: number;
  elapsedTime: number;
  objectives: ObjectiveStatus[];
  completedCount: number;
  totalObjectives: number;
  heldPropLabel: string | null;
  throwCharge: number;
  interactPrompt: string | null;
  fanSpeed: number;
  tubeLightOn: boolean;
  northWindowOpen: boolean;
  eastWindowOpen: boolean;
  breakerTripped: boolean;
  victory: boolean;
  muted: boolean;
  activeAnomalies: number;
}
