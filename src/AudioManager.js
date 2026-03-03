export class AudioManager {
    constructor() {
        this.ctx = null;
    }

    _init() {
        if (!this.ctx) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    this.ctx = new AudioContext();
                }
            } catch (e) {
                console.warn('AudioContext failed to initialize:', e);
            }
        }
        return this.ctx;
    }

    playPistol() {
        this._playNoise(0.05, 0.1, 400, 50, 'square');
    }

    playShotgun() {
        this._playNoise(0.2, 0.3, 200, 20, 'sawtooth');
    }

    playSniper() {
        this._playNoise(0.1, 0.4, 800, 100, 'sine');
    }

    playEnemyShot() {
        this._playNoise(0.05, 0.15, 600, 300, 'triangle');
    }

    playHit() {
        this._playNoise(0.1, 0.2, 100, 10, 'sine');
    }

    playMachineGun() {
        this._playNoise(0.08, 0.1, 300, 100, 'square');
    }

    _playNoise(volume, duration, freqStart, freqEnd, type) {
        const ctx = this._init();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);

        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
    }
}

export const audioManager = new AudioManager();
