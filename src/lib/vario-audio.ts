/**
 * Acoustic variometer using Web Audio API.
 * - Climbing: pulsed tones, frequency & pulse rate increase with climb rate
 * - Sinking: steady low tone below threshold
 * - Dead band: silence
 */
export class VarioAudio {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private pulseInterval: ReturnType<typeof setInterval> | null = null;
  private _enabled = false;

  // Thresholds (m/s)
  private climbThreshold = 0.2;
  private sinkThreshold = -1.5;

  get enabled() {
    return this._enabled;
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(this.ctx.destination);
    this.oscillator = this.ctx.createOscillator();
    this.oscillator.type = "sine";
    this.oscillator.frequency.value = 440;
    this.oscillator.connect(this.gain);
    this.oscillator.start();
    this._enabled = true;
  }

  update(vario: number) {
    if (!this.ctx || !this.gain || !this.oscillator || !this._enabled) return;

    // Clear any existing pulse
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }

    if (vario >= this.climbThreshold) {
      // Climbing – pulsed beeps
      const freq = 500 + Math.min(vario, 8) * 90; // 500–1220 Hz
      this.oscillator.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const pulseRate = Math.max(80, 400 - vario * 50); // ms between pulses
      let on = true;
      this.gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      this.pulseInterval = setInterval(() => {
        if (!this.gain || !this.ctx) return;
        on = !on;
        this.gain.gain.setValueAtTime(on ? 0.25 : 0, this.ctx.currentTime);
      }, pulseRate);
    } else if (vario <= this.sinkThreshold) {
      // Sinking – steady low tone
      const freq = 250 + Math.max(vario, -8) * 10; // lower with stronger sink
      this.oscillator.frequency.setValueAtTime(freq, this.ctx.currentTime);
      this.gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    } else {
      // Dead band – silence
      this.gain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  toggle() {
    if (this._enabled) {
      this.mute();
    } else {
      this.unmute();
    }
  }

  private mute() {
    this._enabled = false;
    if (this.gain && this.ctx) {
      this.gain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }
  }

  private unmute() {
    this._enabled = true;
  }

  destroy() {
    this._enabled = false;
    if (this.pulseInterval) clearInterval(this.pulseInterval);
    this.oscillator?.stop();
    this.ctx?.close();
    this.ctx = null;
    this.oscillator = null;
    this.gain = null;
  }
}
