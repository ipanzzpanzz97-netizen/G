import { useRef, useState } from 'react';
import type { GameControllerApi } from './GameCanvas';

interface TouchControlsProps {
  api: GameControllerApi | null;
  holdingProp: boolean;
}

export function TouchControls({ api, holdingProp }: TouchControlsProps) {
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [crouching, setCrouching] = useState(false);

  const stickTouchId = useRef<number | null>(null);
  const stickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const maxRadius = 40;

  const updateStick = (clientX: number, clientY: number) => {
    const dx = clientX - stickCenter.current.x;
    const dy = clientY - stickCenter.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;
    setKnobOffset({ x: ox, y: oy });

    const normRight = ox / maxRadius;
    const normForward = -oy / maxRadius;
    const sprint = dist > maxRadius * 0.85;
    api?.setTouchMove(normForward, normRight, sprint);
  };

  const resetStick = () => {
    stickTouchId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    api?.setTouchMove(0, 0, false);
  };

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-10">
      {/* Right-half Touch-Look Drag Zone (behind action buttons) */}
      <div
        data-testid="touch-look-zone"
        className="fixed right-0 top-14 bottom-14 left-[40%] pointer-events-auto"
        style={{ touchAction: 'none' }}
        onTouchStart={(e) => {
          if (lookTouchId.current !== null) return;
          const t = e.changedTouches[0];
          if (!t) return;
          lookTouchId.current = t.identifier;
          lastLookPos.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchMove={(e) => {
          if (lookTouchId.current === null) return;
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === lookTouchId.current) {
              const dx = t.clientX - lastLookPos.current.x;
              const dy = t.clientY - lastLookPos.current.y;
              lastLookPos.current = { x: t.clientX, y: t.clientY };
              api?.addTouchLook(dx * 0.0055, dy * 0.0045);
              break;
            }
          }
        }}
        onTouchEnd={(e) => {
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === lookTouchId.current) {
              lookTouchId.current = null;
              break;
            }
          }
        }}
        onTouchCancel={() => {
          lookTouchId.current = null;
        }}
      />

      {/* Left-Thumb Virtual Analog Joystick */}
      <div
        data-testid="touch-joystick"
        className="fixed left-4 sm:left-6 bottom-20 sm:bottom-10 w-28 h-28 rounded-full bg-[#181c13]/70 border-2 border-[#8b9169]/65 flex items-center justify-center pointer-events-auto"
        style={{ touchAction: 'none' }}
        onTouchStart={(e) => {
          e.stopPropagation();
          if (stickTouchId.current !== null) return;
          const t = e.changedTouches[0];
          if (!t) return;
          const rect = e.currentTarget.getBoundingClientRect();
          stickTouchId.current = t.identifier;
          stickCenter.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          updateStick(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
          if (stickTouchId.current === null) return;
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === stickTouchId.current) {
              updateStick(t.clientX, t.clientY);
              break;
            }
          }
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === stickTouchId.current) {
              resetStick();
              break;
            }
          }
        }}
        onTouchCancel={resetStick}
      >
        <div
          className="w-11 h-11 rounded-full bg-[#e89376]/90 border-2 border-[#f4efe3]/85 shadow-md"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Right-Side Tactile Action Buttons (>= 46px hit targets) */}
      <div className="fixed right-4 sm:right-6 bottom-20 sm:bottom-10 flex flex-col items-end gap-2.5 pointer-events-auto">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Saklar Benda"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              api?.triggerSwitch();
            }}
            className="w-12 h-12 rounded-full bg-[#181c13]/85 border border-[#8b9169]/70 active:bg-[#2c3322] text-[#f4efe3] text-[10px] font-bold uppercase tracking-tight flex items-center justify-center cursor-pointer"
          >
            Saklar
          </button>
          <button
            type="button"
            aria-label="Jongkok"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const next = !crouching;
              setCrouching(next);
              api?.setTouchCrouch(next);
            }}
            className={`w-12 h-12 rounded-full border text-[10px] font-bold uppercase tracking-tight flex items-center justify-center cursor-pointer ${
              crouching
                ? 'bg-[#e89376] text-[#171a12] border-[#f4efe3]'
                : 'bg-[#181c13]/85 text-[#f4efe3] border-[#8b9169]/70'
            }`}
          >
            Jongkok
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label={holdingProp ? 'Lempar Benda' : 'Ambil Benda'}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (holdingProp) api?.triggerThrow();
              else api?.triggerGrabOrDrop();
            }}
            className={`w-14 h-14 rounded-full border-2 text-[11px] font-extrabold uppercase tracking-tight flex items-center justify-center cursor-pointer ${
              holdingProp
                ? 'bg-[#e0582c] text-[#fff8f2] border-[#f49f80]'
                : 'bg-[#262c1e]/90 text-[#f4efe3] border-[#e89376]/80'
            }`}
          >
            {holdingProp ? 'Lempar' : 'Ambil'}
          </button>

          <button
            type="button"
            aria-label="Lompat"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              api?.triggerJump();
            }}
            className="w-14 h-14 rounded-full bg-[#181c13]/85 border-2 border-[#e89376]/85 active:bg-[#e89376] active:text-[#171a12] text-[#f4efe3] text-[11px] font-extrabold uppercase tracking-tight flex items-center justify-center cursor-pointer"
          >
            Lompat
          </button>
        </div>
      </div>
    </div>
  );
}
