import { useEffect, useState } from 'react';
import type { GameMode, HudSnapshot, WeatherPreset } from '../game/types';
import type { GameControllerApi } from './GameCanvas';
import { TouchControls } from './TouchControls';

interface GameHudProps {
  hud: HudSnapshot;
  api: GameControllerApi | null;
}

const WEATHER_OPTIONS: { id: WeatherPreset; keyNum: string; label: string; dot: string }[] = [
  { id: 'sunny', keyNum: '1', label: 'Cerah', dot: '#f3c15a' },
  { id: 'overcast', keyNum: '2', label: 'Mendung', dot: '#a3b8c2' },
  { id: 'storm', keyNum: '3', label: 'Badai', dot: '#57a8ff' },
  { id: 'night', keyNum: '4', label: 'Malam', dot: '#7d75c9' },
];

export function GameHud({ hud, api }: GameHudProps) {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>(hud.mode);
  const [isMobileOrTouch, setIsMobileOrTouch] = useState(false);
  const [showTouchPad, setShowTouchPad] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(true);

  useEffect(() => {
    const check = () => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      const small = window.innerWidth < 860;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const touchDevice = coarse || (hasTouch && small) || small;
      setIsMobileOrTouch(touchDevice);
      setShowTouchPad(touchDevice);
      if (window.innerWidth < 640) {
        setMissionsOpen(false);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleStart = () => {
    api?.startGame(selectedMode);
  };

  // =========================================================================
  // TITLE SCREEN (Live 3D Room Tour + Bespoke SVG Emblem + Clean Negative Space)
  // =========================================================================
  if (hud.gameState === 'title') {
    return (
      <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 md:p-10">
        {/* Top-Left Bespoke Inline SVG Title Emblem over calm negative space */}
        <div className="max-w-md pointer-events-auto">
          <div className="inline-block bg-[#181c13]/85 border border-[#8b9169]/40 px-5 py-4 sm:px-6 sm:py-5 shadow-2xl">
            <svg
              viewBox="0 0 360 88"
              className="w-64 sm:w-72 md:w-80 h-auto block"
              aria-label="Bilik Tropis: RTX Physics"
            >
              {/* Window Grille Emblem Mark */}
              <g transform="translate(4, 10)">
                <rect x="0" y="0" width="58" height="58" rx="4" fill="#23291b" stroke="#e89376" strokeWidth="2.5" />
                <line x1="19" y1="2" x2="19" y2="56" stroke="#eae8e2" strokeWidth="1.5" />
                <line x1="39" y1="2" x2="39" y2="56" stroke="#eae8e2" strokeWidth="1.5" />
                <line x1="2" y1="19" x2="56" y2="19" stroke="#eae8e2" strokeWidth="1.5" />
                <line x1="2" y1="39" x2="56" y2="39" stroke="#eae8e2" strokeWidth="1.5" />
                <path d="M36 3 C48 20, 44 42, 54 55 L56 55 L56 3 Z" fill="#e0582c" opacity="0.88" />
              </g>
              <text
                x="78"
                y="40"
                fill="#f4efe3"
                fontSize="31"
                fontWeight="800"
                letterSpacing="1.5"
              >
                BILIK TROPIS
              </text>
              <text
                x="80"
                y="64"
                fill="#e89376"
                fontSize="13"
                fontWeight="600"
                letterSpacing="3"
              >
                SIMULASI FISIKA &amp; CUACA
              </text>
            </svg>

            {/* Mode Selector (<= 2 compact options) */}
            <div className="mt-4 sm:mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedMode('challenge')}
                className={`px-3.5 py-2 text-xs font-semibold uppercase tracking-wider border transition-colors cursor-pointer ${
                  selectedMode === 'challenge'
                    ? 'bg-[#e0582c] text-[#fff8f2] border-[#f49f80]'
                    : 'bg-[#22271b] text-[#c7cbb8] border-[#5f664a] hover:border-[#8b9169]'
                }`}
              >
                Misi Badai
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('sandbox')}
                className={`px-3.5 py-2 text-xs font-semibold uppercase tracking-wider border transition-colors cursor-pointer ${
                  selectedMode === 'sandbox'
                    ? 'bg-[#e0582c] text-[#fff8f2] border-[#f49f80]'
                    : 'bg-[#22271b] text-[#c7cbb8] border-[#5f664a] hover:border-[#8b9169]'
                }`}
              >
                Eksplorasi Bebas
              </button>
            </div>

            {/* Primary Start CTA */}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={handleStart}
                className="px-7 py-3 bg-[#e89376] hover:bg-[#f0a58b] text-[#171a12] font-bold text-sm uppercase tracking-widest shadow-lg transition-colors cursor-pointer"
              >
                Masuk Kamar
              </button>
              {hud.bestScore > 0 && (
                <div className="text-xs text-[#c7cbb8] tabular-nums">
                  Rekor: <span className="text-[#f4efe3] font-bold">{hud.bestScore}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Single flat control hint line in bottom safe margin */}
        <div className="text-center text-[11px] sm:text-xs tracking-wide text-[#e8e4d8]/90 bg-[#141710]/70 px-3.5 py-1.5 self-center border border-[#8b9169]/30 max-w-[95vw]">
          {isMobileOrTouch
            ? 'Joystick Kiri Gerak · Geser Kanan Kamera · Tombol Kanan Lompat/Jongkok/Ambil · 1-4 Cuaca'
            : 'WASD Gerak · Shift Lari · C Jongkok · Space Lompat · Klik/E Ambil · F/Klik Kanan Lempar · T Saklar · 1-4 Cuaca'}
        </div>
      </div>
    );
  }

  // =========================================================================
  // PLAYING HUD (>= 85% unobstructed center, no backdrop-filter!)
  // =========================================================================
  const integrityPct = Math.max(0, Math.min(100, (hud.roomIntegrity / hud.maxIntegrity) * 100));

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Android / Mobile Touch Controls Overlay */}
      {hud.gameState === 'playing' && showTouchPad && (
        <TouchControls api={api} holdingProp={Boolean(hud.heldPropLabel)} />
      )}

      {/* Top-Left Compact World-Matched Status Cluster */}
      <div className="fixed top-3 left-3 sm:top-4 sm:left-4 flex flex-col gap-1.5 max-w-[200px] sm:max-w-[290px] z-20">
        <div className="bg-[#181c13]/85 border border-[#8b9169]/45 px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-lg">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#b8be9f]">Skor</div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#f4efe3] leading-none tabular-nums" data-testid="hud-score">
                {hud.score}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-[#b8be9f]">Kombo</div>
              <div className="text-base sm:text-lg font-bold text-[#e89376] leading-none tabular-nums">
                x{hud.combo}
              </div>
            </div>
          </div>

          {hud.mode === 'challenge' && (
            <div className="mt-2">
              <div className="flex justify-between gap-2 text-[10px] uppercase tracking-wider text-[#c7cbb8] mb-1">
                <span>Ketahanan</span>
                <span className="tabular-nums font-semibold">{hud.roomIntegrity}%</span>
              </div>
              <div className="h-1.5 sm:h-2 w-full bg-[#2b3022] overflow-hidden">
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${integrityPct}%`,
                    backgroundColor:
                      integrityPct > 55 ? '#62c987' : integrityPct > 25 ? '#e6a838' : '#e04f3d',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Compact Objectives Checklist in Challenge mode (collapsible on small mobile screens) */}
        {hud.mode === 'challenge' && (
          <div className="bg-[#181c13]/82 border border-[#8b9169]/35 px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                setMissionsOpen((v) => !v);
              }}
              className="w-full flex items-center justify-between text-[10px] uppercase tracking-widest text-[#e89376] font-semibold cursor-pointer"
            >
              <span>Misi ({hud.completedCount}/{hud.totalObjectives})</span>
              <span>{missionsOpen ? '▾' : '▸'}</span>
            </button>
            {missionsOpen && (
              <div className="mt-1 space-y-1">
                {hud.objectives.map((obj) => (
                  <div
                    key={obj.id}
                    className={`flex items-center justify-between gap-2 ${
                      obj.completed ? 'text-[#7ce3a2] line-through opacity-75' : 'text-[#e8e4d8]'
                    }`}
                  >
                    <span className="truncate">{obj.title}</span>
                    <span className="tabular-nums shrink-0 font-semibold">
                      {obj.current}/{obj.target}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top-Right Utility Controls (Touch Pad toggle, Mute [M], Pause [P], Restart [R]) */}
      <div className="fixed top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 sm:gap-2 pointer-events-auto z-20">
        <button
          type="button"
          tabIndex={-1}
          aria-label={showTouchPad ? 'Sembunyikan Kontrol Sentuh' : 'Tampilkan Kontrol Sentuh'}
          onClick={(e) => {
            e.currentTarget.blur();
            setShowTouchPad((v) => !v);
          }}
          className={`w-9 h-9 border flex items-center justify-center cursor-pointer ${
            showTouchPad
              ? 'bg-[#2c3322] border-[#e89376] text-[#e89376]'
              : 'bg-[#181c13]/88 border-[#8b9169]/50 hover:border-[#e89376] text-[#f4efe3]'
          }`}
          title="Kontrol Sentuh Android"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="6" width="20" height="12" rx="3" />
            <path d="M6 12h4M8 10v4" />
            <circle cx="15" cy="11" r="1" fill="currentColor" />
            <circle cx="18" cy="13" r="1" fill="currentColor" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label={hud.muted ? 'Nyalakan Suara' : 'Bisukan Suara'}
          onClick={(e) => {
            e.currentTarget.blur();
            api?.toggleMute();
          }}
          className="w-9 h-9 bg-[#181c13]/88 border border-[#8b9169]/50 hover:border-[#e89376] flex items-center justify-center text-[#f4efe3] cursor-pointer"
          title="Suara [M]"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            {hud.muted ? (
              <path d="M23 9l-6 6M17 9l6 6" stroke="#e0582c" />
            ) : (
              <path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" />
            )}
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Jeda Game"
          onClick={(e) => {
            e.currentTarget.blur();
            api?.setGameState(hud.gameState === 'paused' ? 'playing' : 'paused');
          }}
          className="w-9 h-9 bg-[#181c13]/88 border border-[#8b9169]/50 hover:border-[#e89376] flex items-center justify-center text-[#f4efe3] cursor-pointer"
          title="Jeda [P]"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Ulangi Game"
          onClick={(e) => {
            e.currentTarget.blur();
            api?.restartGame();
          }}
          className="w-9 h-9 bg-[#181c13]/88 border border-[#8b9169]/50 hover:border-[#e89376] flex items-center justify-center text-[#f4efe3] cursor-pointer"
          title="Ulangi [R]"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      {/* Exact Center Crosshair & Contextual Action Prompt */}
      {hud.gameState === 'playing' && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-10">
          <div className="relative w-5 h-5 flex items-center justify-center">
            <div
              className={`w-1.5 h-1.5 rounded-full border border-[#141710] ${
                hud.interactPrompt ? 'bg-[#e89376] scale-125' : 'bg-[#f4efe3]/90'
              }`}
            />
            {hud.throwCharge > 0.02 && (
              <svg viewBox="0 0 24 24" className="absolute inset-0 w-5 h-5 -rotate-90">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="#e0582c"
                  strokeWidth="2.5"
                  strokeDasharray={56.5}
                  strokeDashoffset={56.5 * (1 - hud.throwCharge)}
                />
              </svg>
            )}
          </div>
          {hud.interactPrompt && (
            <div className="mt-4 px-2.5 py-1 bg-[#181c13]/88 border border-[#e89376]/60 text-[11px] font-medium text-[#f4efe3] whitespace-nowrap max-w-[88vw] truncate">
              {hud.interactPrompt}
            </div>
          )}
        </div>
      )}

      {/* Collapsible Bottom-Center Weather & Camera Dock */}
      {hud.gameState === 'playing' && (
        <div className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-20 max-w-[96vw]">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              setDockCollapsed((prev) => !prev);
            }}
            className="px-3 py-0.5 bg-[#181c13]/85 border border-b-0 border-[#8b9169]/45 text-[10px] uppercase tracking-widest text-[#c7cbb8] hover:text-[#f4efe3] cursor-pointer"
          >
            {dockCollapsed ? '▴ Cuaca' : '▾ Sembunyikan'}
          </button>

          {!dockCollapsed && (
            <div className="flex flex-nowrap justify-center items-center gap-1 sm:gap-1.5 bg-[#181c13]/88 border border-[#8b9169]/45 px-1.5 py-1 sm:px-2.5 sm:py-1.5 shadow-lg">
              {WEATHER_OPTIONS.map((w) => {
                const active = hud.weather === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      api?.setWeather(w.id);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 text-[11px] sm:text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#2c3322] text-[#f4efe3] border-[#e89376]'
                        : 'bg-[#1c2116] text-[#b8be9f] border-transparent hover:border-[#5f664a]'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0" style={{ backgroundColor: w.dot }} />
                    <span className="hidden sm:inline tabular-nums text-[10px] opacity-75">[{w.keyNum}]</span>
                    <span>{w.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pause Modal */}
      {hud.gameState === 'paused' && (
        <div className="fixed inset-0 bg-[#0d100a]/65 flex items-center justify-center p-4 pointer-events-auto z-30">
          <div className="w-full max-w-sm bg-[#181c13] border border-[#8b9169]/60 p-6 shadow-2xl">
            <h2 className="text-xl font-extrabold uppercase tracking-wider text-[#f4efe3]">
              Permainan Dijeda
            </h2>
            <p className="mt-1 text-xs text-[#b8be9f]">
              Cuaca: {hud.weatherLabel} · Skor: <span className="tabular-nums font-bold">{hud.score}</span>
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => api?.setGameState('playing')}
                className="w-full py-2.5 bg-[#e89376] hover:bg-[#f0a58b] text-[#171a12] font-bold text-xs uppercase tracking-widest cursor-pointer"
              >
                Lanjutkan [Esc]
              </button>
              <button
                type="button"
                onClick={() => api?.restartGame()}
                className="w-full py-2.5 bg-[#262c1e] hover:bg-[#323a27] text-[#f4efe3] border border-[#5f664a] font-semibold text-xs uppercase tracking-widest cursor-pointer"
              >
                Mulai Ulang [R]
              </button>
              <button
                type="button"
                onClick={() => api?.setGameState('title')}
                className="w-full py-2.5 bg-transparent hover:bg-[#22271b] text-[#c7cbb8] border border-[#3e4431] font-semibold text-xs uppercase tracking-widest cursor-pointer"
              >
                Kembali ke Judul
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Game Over Modal */}
      {hud.gameState === 'gameover' && (
        <div className="fixed inset-0 bg-[#0d100a]/72 flex items-center justify-center p-4 pointer-events-auto z-30">
          <div className="w-full max-w-md bg-[#181c13] border border-[#e89376]/65 p-7 shadow-2xl">
            <div className="text-[11px] uppercase tracking-widest text-[#e89376] font-bold">
              {hud.victory ? 'Misi Kamar Berhasil' : 'Kamar Terkena Badai'}
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-[#f4efe3]">
              {hud.victory ? 'Badai Berhasil Dijinakkan!' : 'Permainan Selesai'}
            </h2>

            <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-[#22271b] border border-[#4a503a] p-2.5">
                <div className="text-[10px] uppercase text-[#b8be9f]">Skor</div>
                <div className="text-lg font-extrabold text-[#f4efe3] tabular-nums">{hud.score}</div>
              </div>
              <div className="bg-[#22271b] border border-[#4a503a] p-2.5">
                <div className="text-[10px] uppercase text-[#b8be9f]">Trick Shot</div>
                <div className="text-lg font-extrabold text-[#e89376] tabular-nums">{hud.trickShots}</div>
              </div>
              <div className="bg-[#22271b] border border-[#4a503a] p-2.5">
                <div className="text-[10px] uppercase text-[#b8be9f]">Waktu</div>
                <div className="text-lg font-extrabold text-[#f4efe3] tabular-nums">{hud.elapsedTime}s</div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                data-start="true"
                onClick={() => api?.restartGame()}
                className="flex-1 py-3 bg-[#e89376] hover:bg-[#f0a58b] text-[#171a12] font-bold text-xs uppercase tracking-widest cursor-pointer"
              >
                Main Lagi
              </button>
              <button
                type="button"
                onClick={() => api?.setGameState('title')}
                className="px-4 py-3 bg-[#262c1e] hover:bg-[#323a27] text-[#f4efe3] border border-[#5f664a] font-semibold text-xs uppercase tracking-widest cursor-pointer"
              >
                Judul
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
