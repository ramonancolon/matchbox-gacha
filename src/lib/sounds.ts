/**
 * Sound utility for Matchbox Gacha.
 * Uses Web Audio API tones to avoid remote audio fetch failures (403/CORS).
 */

type SoundName = 'flip' | 'match' | 'win' | 'hint';

interface ToneConfig {
  frequency: number;
  duration: number;
  type: OscillatorType;
  volume: number;
}

const SOUND_TONES: Record<SoundName, ToneConfig[]> = {
  flip: [{ frequency: 540, duration: 0.06, type: 'square', volume: 0.06 }],
  match: [
    { frequency: 660, duration: 0.07, type: 'sine', volume: 0.06 },
    { frequency: 880, duration: 0.09, type: 'sine', volume: 0.06 }
  ],
  hint: [
    { frequency: 480, duration: 0.06, type: 'triangle', volume: 0.05 },
    { frequency: 620, duration: 0.08, type: 'triangle', volume: 0.05 }
  ],
  win: [
    { frequency: 523, duration: 0.08, type: 'sine', volume: 0.06 },
    { frequency: 659, duration: 0.1, type: 'sine', volume: 0.06 },
    { frequency: 784, duration: 0.12, type: 'sine', volume: 0.06 },
    { frequency: 1047, duration: 0.16, type: 'sine', volume: 0.07 }
  ]
};

class SoundManager {
  private enabled = true;
  private audioContext: AudioContext | null = null;

  setEnabled(val: boolean) {
    this.enabled = val;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.audioContext) return this.audioContext;

    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    this.audioContext = new AudioCtx();
    return this.audioContext;
  }

  private scheduleTone(ctx: AudioContext, when: number, tone: ToneConfig): number {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const end = when + tone.duration;

    oscillator.type = tone.type;
    oscillator.frequency.value = tone.frequency;

    gainNode.gain.setValueAtTime(0.0001, when);
    gainNode.gain.exponentialRampToValueAtTime(tone.volume, when + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(when);
    oscillator.stop(end);

    return end + 0.01;
  }

  play(soundName: SoundName) {
    if (!this.enabled) return;
    const ctx = this.getAudioContext();
    const tones = SOUND_TONES[soundName];
    if (!ctx || !tones) return;

    try {
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      let when = ctx.currentTime;
      tones.forEach((tone) => {
        when = this.scheduleTone(ctx, when, tone);
      });
    } catch {
      // Silent fail (audio is non-critical UX enhancement)
    }
  }
}

export const soundManager = new SoundManager();
