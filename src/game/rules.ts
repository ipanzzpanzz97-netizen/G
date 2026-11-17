import type {
  GameMode,
  ObjectiveStatus,
  PhysicsProp,
  RoomMechanismState,
  ScoreEvent,
  StormAnomaly,
  WeatherPreset,
} from './types';

export interface GameRulesState {
  mode: GameMode;
  weather: WeatherPreset;
  score: number;
  bestScore: number;
  combo: number;
  comboTimer: number;
  trickShots: number;
  roomIntegrity: number;
  maxIntegrity: number;
  elapsedTime: number;
  victory: boolean;
  gameOverReason: string | null;
  objectives: ObjectiveStatus[];
  anomalies: StormAnomaly[];
  anomalySpawnTimer: number;
  lightningTimer: number;
  lightningFlash: number;
  windGustX: number;
  windGustZ: number;
  windPhase: number;
  hitstopTimer: number;
  cameraTrauma: number;
}

export const WEATHER_LABELS: Record<WeatherPreset, string> = {
  sunny: 'Cerah Tropis',
  overcast: 'Mendung Angin',
  storm: 'Badai Petir',
  night: 'Malam Hujan',
};

export function createInitialMechanisms(): RoomMechanismState {
  return {
    fanSpeed: 1,
    fanAngle: 0,
    tubeLightOn: true,
    tubeFlickerTimer: 0,
    northWindowOpen: true,
    eastWindowOpen: false,
    northWindowOpenBlend: 1,
    eastWindowOpenBlend: 0,
    breakerTripped: false,
  };
}

export function createInitialRulesState(mode: GameMode = 'challenge', bestScore = 0): GameRulesState {
  return {
    mode,
    weather: mode === 'challenge' ? 'overcast' : 'sunny',
    score: 0,
    bestScore,
    combo: 1,
    comboTimer: 0,
    trickShots: 0,
    roomIntegrity: 100,
    maxIntegrity: 100,
    elapsedTime: 0,
    victory: false,
    gameOverReason: null,
    objectives: [
      { id: 'laundry_basket', title: 'Masukkan 3 Kain/Tas ke Keranjang Pintu', current: 0, target: 3, completed: false },
      { id: 'secure_desk', title: 'Raih & Amankan Mug + Toples ke Meja/Kasur', current: 0, target: 2, completed: false },
      { id: 'fan_and_light', title: 'Atur Kipas Angin & Lampu Pintu', current: 0, target: 2, completed: false },
      { id: 'close_windows', title: 'Tutup Jendela Saat Angin Kencang', current: 0, target: 1, completed: false },
      { id: 'clear_anomalies', title: 'Hantam Bola Angin Badai dengan Lemparan', current: 0, target: 3, completed: false },
    ],
    anomalies: [],
    anomalySpawnTimer: 12.0, // Calm opening 12s!
    lightningTimer: 7.0,
    lightningFlash: 0,
    windGustX: 0,
    windGustZ: 0,
    windPhase: 0,
    hitstopTimer: 0,
    cameraTrauma: 0,
  };
}

export function isInsideBasketZone(prop: PhysicsProp): boolean {
  return (
    prop.x >= -2.50 &&
    prop.x <= -1.90 &&
    prop.z >= 0.85 &&
    prop.z <= 1.45 &&
    prop.y >= 0.05 &&
    prop.y <= 0.60
  );
}

export function isOnBedOrCornerSafeZone(prop: PhysicsProp): boolean {
  const onBed = prop.x >= -1.68 && prop.x <= 0.28 && prop.z >= -1.88 && prop.z <= -0.78 && prop.y >= 0.50;
  const onCornerTable = prop.x >= 0.52 && prop.x <= 1.35 && prop.z >= -1.90 && prop.z <= -1.12 && prop.y >= 0.68;
  return onBed || onCornerTable;
}

export function evaluateGameRules(
  rules: GameRulesState,
  props: PhysicsProp[],
  mechanisms: RoomMechanismState,
  fanToggledByPlayer: boolean,
  lightToggledByPlayer: boolean,
  rawDt: number,
): { scoreEvents: ScoreEvent[]; lightningTriggered: boolean; ended: boolean } {
  const dt = Math.min(rawDt, 0.05);
  const scoreEvents: ScoreEvent[] = [];
  let lightningTriggered = false;

  rules.elapsedTime += dt;
  rules.windPhase += dt * (rules.weather === 'storm' ? 2.4 : rules.weather === 'overcast' ? 1.4 : 0.7);
  rules.cameraTrauma = Math.max(0, rules.cameraTrauma - dt * 1.8);
  rules.lightningFlash = Math.max(0, rules.lightningFlash - dt * 3.2);

  if (rules.comboTimer > 0) {
    rules.comboTimer -= dt;
    if (rules.comboTimer <= 0) {
      rules.combo = 1;
    }
  }

  // Wind gusts based on weather
  const windMag =
    rules.weather === 'storm' ? 3.8 : rules.weather === 'overcast' ? 1.9 : rules.weather === 'night' ? 1.5 : 0.45;
  rules.windGustX = (Math.sin(rules.windPhase) + 0.5 * Math.sin(rules.windPhase * 2.3)) * windMag;
  rules.windGustZ = (Math.cos(rules.windPhase * 0.85) + 0.4 * Math.cos(rules.windPhase * 1.9)) * windMag;

  // Dynamic lightning in storm/night weather
  if (rules.weather === 'storm' || rules.weather === 'night') {
    rules.lightningTimer -= dt;
    if (rules.lightningTimer <= 0) {
      rules.lightningTimer = rules.weather === 'storm' ? 4.5 + Math.random() * 5.5 : 9.0 + Math.random() * 8.0;
      rules.lightningFlash = 1.0;
      lightningTriggered = true;
    }
  }

  // Smooth mechanism blends
  const nTarget = mechanisms.northWindowOpen ? 1 : 0;
  const eTarget = mechanisms.eastWindowOpen ? 1 : 0;
  mechanisms.northWindowOpenBlend += (nTarget - mechanisms.northWindowOpenBlend) * (1 - Math.exp(-10 * dt));
  mechanisms.eastWindowOpenBlend += (eTarget - mechanisms.eastWindowOpenBlend) * (1 - Math.exp(-10 * dt));

  if (!mechanisms.breakerTripped && mechanisms.fanSpeed > 0) {
    const speedRpm = mechanisms.fanSpeed === 1 ? 8 : mechanisms.fanSpeed === 2 ? 15 : 23;
    mechanisms.fanAngle = (mechanisms.fanAngle + speedRpm * dt) % (Math.PI * 2);
  }
  if (mechanisms.tubeFlickerTimer > 0) {
    mechanisms.tubeFlickerTimer = Math.max(0, mechanisms.tubeFlickerTimer - dt);
  }

  // 1. Check Laundry Basket Tosses (Trick Shots!)
  let laundryCount = 0;
  for (const prop of props) {
    if (prop.category === 'laundry' && !prop.held && isInsideBasketZone(prop)) {
      laundryCount += 1;
      if (prop.scoredZone !== 'basket') {
        prop.scoredZone = 'basket';
        const isTrick = prop.bounces >= 1 || Math.hypot(prop.vx, prop.vz) > 1.5;
        const pts = (isTrick ? 250 : 150) * rules.combo;
        rules.score += pts;
        if (isTrick) rules.trickShots += 1;
        rules.combo = Math.min(5, rules.combo + 1);
        rules.comboTimer = 8.0;
        scoreEvents.push({
          points: pts,
          label: isTrick ? 'TRICK SHOT KERANJANG!' : 'Kain Masuk Keranjang',
          isTrickShot: isTrick,
          x: prop.x,
          y: prop.y + 0.35,
          z: prop.z,
        });
      }
    }
  }

  // 2. Check Desk / Cushion placement & Sport Ball trick shots
  const mug = props.find((p) => p.id === 'desk_mug');
  const jar = props.find((p) => p.id === 'snack_jar');
  const securedCount =
    (mug && !mug.held && isOnBedOrCornerSafeZone(mug) ? 1 : 0) +
    (jar && !jar.held && isOnBedOrCornerSafeZone(jar) ? 1 : 0);

  // Sport ball trick shot into basket gives bonus points!
  const ball = props.find((p) => p.id === 'sport_ball');
  if (ball && !ball.held && isInsideBasketZone(ball) && ball.scoredZone !== 'basket') {
    ball.scoredZone = 'basket';
    const pts = 300 * rules.combo;
    rules.score += pts;
    rules.trickShots += 1;
    rules.combo = Math.min(5, rules.combo + 1);
    rules.comboTimer = 8.0;
    scoreEvents.push({
      points: pts,
      label: 'SLAM DUNK BOLA!',
      isTrickShot: true,
      x: ball.x,
      y: ball.y + 0.35,
      z: ball.z,
    });
  } else if (ball && !isInsideBasketZone(ball)) {
    ball.scoredZone = undefined;
  }

  // 3. Challenge mode: escalating weather + storm wind-orb anomalies
  if (rules.mode === 'challenge') {
    // Escalate weather smoothly after 25s if still overcast
    if (rules.elapsedTime > 25 && rules.weather === 'overcast') {
      rules.weather = 'storm';
    }

    // Open windows during storm slowly erode Room Integrity
    if (rules.weather === 'storm' && (mechanisms.northWindowOpen || mechanisms.eastWindowOpen)) {
      const openCount = (mechanisms.northWindowOpen ? 1 : 0) + (mechanisms.eastWindowOpen ? 1 : 0);
      rules.roomIntegrity = Math.max(0, rules.roomIntegrity - openCount * 1.45 * dt);
    }

    // Spawn Storm Gale Orbs (up to 2 concurrent) from open windows or corners
    rules.anomalySpawnTimer -= dt;
    const activeCount = rules.anomalies.filter((a) => a.active).length;
    if (rules.anomalySpawnTimer <= 0 && activeCount < 2) {
      const spawnFromNorth = Math.random() > 0.4;
      const id = `orb_${Math.round(rules.elapsedTime * 100)}_${activeCount}`;
      rules.anomalies.push({
        id,
        x: spawnFromNorth ? -0.45 + (Math.random() - 0.5) * 0.6 : 1.35,
        y: 1.25,
        z: spawnFromNorth ? -1.45 : -0.15,
        vx: (Math.random() - 0.5) * 0.9,
        vy: 0,
        vz: spawnFromNorth ? 0.65 : (Math.random() - 0.5) * 0.7,
        radius: 0.24,
        active: true,
        chargeTime: 0,
      });
      rules.anomalySpawnTimer = Math.max(5.5, 11.0 - rules.elapsedTime * 0.08);
    }

    // Update active storm orbs & check thrown prop collisions
    const objAnomalies = rules.objectives.find((o) => o.id === 'clear_anomalies')!;
    for (const orb of rules.anomalies) {
      if (!orb.active) continue;
      orb.chargeTime += dt;
      orb.x += orb.vx * dt;
      orb.z += orb.vz * dt;
      orb.y = 1.15 + Math.sin(orb.chargeTime * 3.2) * 0.16;

      // Bounce gently inside room
      if (orb.x < -1.3 || orb.x > 1.3) orb.vx *= -1;
      if (orb.z < -1.45 || orb.z > 1.45) orb.vz *= -1;

      // Telegraph pulse: every 6s orb zaps room integrity by 14 unless knocked out!
      if (orb.chargeTime >= 6.0) {
        orb.chargeTime = 0;
        rules.roomIntegrity = Math.max(0, rules.roomIntegrity - 14);
        rules.cameraTrauma = Math.min(1, rules.cameraTrauma + 0.45);
      }

      // Check collision with any fast-moving thrown prop!
      for (const prop of props) {
        if (prop.held) continue;
        const speed = Math.hypot(prop.vx, prop.vy, prop.vz);
        if (speed < 2.2) continue;
        const dist = Math.hypot(prop.x - orb.x, prop.y - orb.y, prop.z - orb.z);
        if (dist < orb.radius + Math.max(prop.halfW, prop.halfH) + 0.14) {
          orb.active = false;
          objAnomalies.current = Math.min(objAnomalies.target, objAnomalies.current + 1);
          rules.hitstopTimer = 0.045;
          rules.cameraTrauma = Math.min(1, rules.cameraTrauma + 0.35);
          const pts = 350 * rules.combo;
          rules.score += pts;
          rules.trickShots += 1;
          rules.combo = Math.min(5, rules.combo + 1);
          rules.comboTimer = 8.0;
          scoreEvents.push({
            points: pts,
            label: 'BOLA BADAI HANCUR!',
            isTrickShot: true,
            x: orb.x,
            y: orb.y,
            z: orb.z,
          });
          break;
        }
      }
    }
    // Prune inactive anomalies
    rules.anomalies = rules.anomalies.filter((a) => a.active);
  }

  // Update objective counters
  const objLaundry = rules.objectives.find((o) => o.id === 'laundry_basket')!;
  objLaundry.current = Math.min(objLaundry.target, laundryCount);
  objLaundry.completed = objLaundry.current >= objLaundry.target;

  const objDesk = rules.objectives.find((o) => o.id === 'secure_desk')!;
  objDesk.current = Math.min(objDesk.target, securedCount);
  objDesk.completed = objDesk.current >= objDesk.target;

  const objMech = rules.objectives.find((o) => o.id === 'fan_and_light')!;
  objMech.current = (fanToggledByPlayer ? 1 : 0) + (lightToggledByPlayer ? 1 : 0);
  objMech.completed = objMech.current >= objMech.target;

  const objWin = rules.objectives.find((o) => o.id === 'close_windows')!;
  objWin.current = !mechanisms.northWindowOpen && !mechanisms.eastWindowOpen ? 1 : 0;
  objWin.completed = objWin.current >= objWin.target;

  const objAnom = rules.objectives.find((o) => o.id === 'clear_anomalies')!;
  objAnom.completed = objAnom.current >= objAnom.target;

  if (rules.score > rules.bestScore) {
    rules.bestScore = rules.score;
  }

  // Victory / Defeat evaluation in Challenge mode
  let ended = false;
  if (rules.mode === 'challenge') {
    if (rules.roomIntegrity <= 0) {
      rules.victory = false;
      rules.gameOverReason = 'Kamar kebanjiran angin & korsleting badai!';
      ended = true;
    } else if (rules.objectives.every((o) => o.completed)) {
      rules.victory = true;
      rules.score += Math.round(rules.roomIntegrity * 10);
      if (rules.score > rules.bestScore) rules.bestScore = rules.score;
      rules.gameOverReason = 'Semua misi kamar selesai & badai berhasil dijinakkan!';
      ended = true;
    }
  }

  return { scoreEvents, lightningTriggered, ended };
}
