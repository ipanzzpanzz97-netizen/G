import { useCallback, useMemo, useState } from 'react';
import { GameCanvas, type GameControllerApi } from './components/GameCanvas';
import { GameHud } from './components/GameHud';
import type { GameMode, GameState, HudSnapshot } from './game/types';

function getAutostartState(): { initialState: GameState; initialMode: GameMode } {
  const params = new URLSearchParams(window.location.search);
  const auto = params.get('autostart') === '1';
  const modeParam = params.get('mode') === 'sandbox' ? 'sandbox' : 'challenge';
  return {
    initialState: auto ? 'playing' : 'title',
    initialMode: modeParam,
  };
}

export default function App() {
  const { initialState, initialMode } = useMemo(() => getAutostartState(), []);
  const [controllerApi, setControllerApi] = useState<GameControllerApi | null>(null);

  const [hud, setHud] = useState<HudSnapshot>({
    gameState: initialState,
    mode: initialMode,
    weather: initialMode === 'challenge' ? 'overcast' : 'sunny',
    weatherLabel: initialMode === 'challenge' ? 'Mendung Angin' : 'Cerah Tropis',
    score: 0,
    bestScore: 0,
    combo: 1,
    trickShots: 0,
    roomIntegrity: 100,
    maxIntegrity: 100,
    elapsedTime: 0,
    objectives: [],
    completedCount: 0,
    totalObjectives: 5,
    heldPropLabel: null,
    throwCharge: 0,
    interactPrompt: null,
    fanSpeed: 1,
    tubeLightOn: true,
    northWindowOpen: true,
    eastWindowOpen: false,
    breakerTripped: false,
    victory: false,
    muted: false,
    activeAnomalies: 0,
  });

  const handleHudUpdate = useCallback((snapshot: HudSnapshot) => {
    setHud(snapshot);
  }, []);

  const handleControllerReady = useCallback((api: GameControllerApi) => {
    setControllerApi(api);
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#141710]">
      <GameCanvas
        initialState={initialState}
        initialMode={initialMode}
        onHudUpdate={handleHudUpdate}
        onControllerReady={handleControllerReady}
      />
      <GameHud hud={hud} api={controllerApi} />
    </main>
  );
}
