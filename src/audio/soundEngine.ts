import type { PropMaterialKind, WeatherPreset } from '../game/types';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private fanGain: GainNode | null = null;
  private fanOsc: OscillatorNode | null = null;
  private tubeGain: GainNode | null = null;
  private muted = false;
  private initialized = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.72, this.ctx.currentTime, 0.04);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public ensureStarted(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;
      this.initialized = true;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.72;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Shared pink/white noise buffer (2 seconds) for rain & wind
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
      }

      // Rain ambient loop
      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = noiseBuffer;
      rainSrc.loop = true;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 1400;
      rainFilter.Q.value = 0.7;
      const rainGain = ctx.createGain();
      rainGain.gain.value = 0.0;
      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(master);
      rainSrc.start();
      this.rainFilter = rainFilter;
      this.rainGain = rainGain;

      // Wind ambient loop
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = noiseBuffer;
      windSrc.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 340;
      windFilter.Q.value = 1.8;
      const windGain = ctx.createGain();
      windGain.gain.value = 0.02;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSrc.start();
      this.windFilter = windFilter;
      this.windGain = windGain;

      // Wall Fan motor hum
      const fanOsc = ctx.createOscillator();
      fanOsc.type = 'triangle';
      fanOsc.frequency.value = 54;
      const fanFilter = ctx.createBiquadFilter();
      fanFilter.type = 'lowpass';
      fanFilter.frequency.value = 180;
      const fanGain = ctx.createGain();
      fanGain.gain.value = 0.0;
      fanOsc.connect(fanFilter);
      fanFilter.connect(fanGain);
      fanGain.connect(master);
      fanOsc.start();
      this.fanOsc = fanOsc;
      this.fanGain = fanGain;

      // Fluorescent tube subtle 60Hz hum
      const tubeOsc = ctx.createOscillator();
      tubeOsc.type = 'sine';
      tubeOsc.frequency.value = 100;
      const tubeGain = ctx.createGain();
      tubeGain.gain.value = 0.0;
      tubeOsc.connect(tubeGain);
      tubeGain.connect(master);
      tubeOsc.start();
      this.tubeGain = tubeGain;
    } catch {
      // Ignore Web Audio errors in headless environments
    }
  }

  public updateAmbience(
    weather: WeatherPreset,
    fanSpeed: number,
    tubeOn: boolean,
    windowsOpenCount: number,
    paused: boolean,
  ): void {
    if (!this.ctx || !this.rainGain || !this.windGain || !this.fanGain || !this.tubeGain) return;
    const now = this.ctx.currentTime;

    if (paused) {
      this.rainGain.gain.setTargetAtTime(0, now, 0.12);
      this.windGain.gain.setTargetAtTime(0, now, 0.12);
      this.fanGain.gain.setTargetAtTime(0, now, 0.12);
      this.tubeGain.gain.setTargetAtTime(0, now, 0.12);
      return;
    }

    const openMult = 0.55 + windowsOpenCount * 0.38;
    const rainTarget =
      weather === 'storm' ? 0.24 * openMult : weather === 'night' ? 0.14 * openMult : weather === 'overcast' ? 0.03 : 0;
    const windTarget =
      weather === 'storm' ? 0.19 * openMult : weather === 'overcast' ? 0.09 * openMult : weather === 'night' ? 0.07 : 0.025;

    this.rainGain.gain.setTargetAtTime(rainTarget, now, 0.35);
    this.rainFilter?.frequency.setTargetAtTime(windowsOpenCount > 0 ? 1850 : 950, now, 0.25);
    this.windGain.gain.setTargetAtTime(windTarget, now, 0.35);
    this.windFilter?.frequency.setTargetAtTime(weather === 'storm' ? 520 : 300, now, 0.35);

    const fanTarget = fanSpeed === 0 ? 0 : 0.015 + fanSpeed * 0.012;
    this.fanGain.gain.setTargetAtTime(fanTarget, now, 0.2);
    this.fanOsc?.frequency.setTargetAtTime(48 + fanSpeed * 11, now, 0.2);

    this.tubeGain.gain.setTargetAtTime(tubeOn ? 0.008 : 0, now, 0.1);
  }

  public playThunder(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 1.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(55, now + 2.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.42, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 2.25);
  }

  public playImpact(material: PropMaterialKind, speed: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.42, Math.max(0.04, (speed - 0.8) * 0.065));
    const jitter = 0.92 + Math.random() * 0.16;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (material === 'ceramic') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1480 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(620 * jitter, now + 0.14);
      gain.gain.setValueAtTime(vol * 0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    } else if (material === 'metal') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(760 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(340 * jitter, now + 0.22);
      gain.gain.setValueAtTime(vol * 0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    } else if (material === 'rubber') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(110 * jitter, now + 0.12);
      gain.gain.setValueAtTime(vol * 0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    } else if (material === 'fabric') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);
      gain.gain.setValueAtTime(vol * 0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    } else {
      // plastic / cardboard
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(290 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(95 * jitter, now + 0.11);
      gain.gain.setValueAtTime(vol * 0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playFootstep(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const jitter = 0.9 + Math.random() * 0.2;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.055);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playGrab(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.07);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playThrow(power: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240 + power * 180, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playSwitch(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.04);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playScore(isTrickShot: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = isTrickShot ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const t = now + idx * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playVictory(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const t = now + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.42);
    });
  }

  public playDefeat(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [329.6, 293.6, 246.9, 196.0].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const t = now + i * 0.13;
      osc.frequency.setValueAtTime(freq, t);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.initialized = false;
    }
  }
}
