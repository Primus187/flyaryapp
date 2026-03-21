/**
 * Barometer service using a custom Capacitor plugin.
 * Falls back gracefully when running in the browser (no barometer available).
 *
 * The native plugin must register under "BarometerPlugin" and expose:
 *   - startListening(): Promise<void>
 *   - stopListening(): Promise<void>
 *   - addListener('pressureChange', callback): Promise<PluginListenerHandle>
 *
 * On native Android, implement via SensorManager TYPE_PRESSURE.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

interface BarometerData {
  /** Atmospheric pressure in hPa (millibar) */
  pressure: number;
}

interface BarometerPlugin {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  addListener(
    eventName: 'pressureChange',
    callback: (data: BarometerData) => void,
  ): Promise<PluginListenerHandle>;
}

const Barometer = registerPlugin<BarometerPlugin>('BarometerPlugin');

// ---- Barometric altitude helpers ----

/** Standard sea-level pressure in hPa */
const P0 = 1013.25;

/**
 * Convert pressure (hPa) to pressure altitude (m) using the
 * International Barometric Formula (ISA, troposphere).
 */
export function pressureToAltitude(pressure: number, qnh: number = P0): number {
  return 44330 * (1 - Math.pow(pressure / qnh, 0.1903));
}

// ---- Altitude provider ----

export type AltitudeCallback = (altitude: number, source: 'barometer' | 'gps') => void;

export class BarometerService {
  private listener: PluginListenerHandle | null = null;
  private _available = false;
  private qnh = P0; // Configurable sea-level reference
  private callback: AltitudeCallback | null = null;

  // Exponential smoothing state
  private smoothedAltitude: number | null = null;
  private readonly alpha = 0.15; // smoothing factor (0–1, lower = smoother)

  get available() {
    return this._available;
  }

  /** Set the QNH (sea-level pressure) for accurate altitude readings */
  setQNH(qnh: number) {
    this.qnh = qnh;
  }

  /** Start listening for barometer data. Returns true if barometer is available. */
  async start(cb: AltitudeCallback): Promise<boolean> {
    this.callback = cb;

    if (!Capacitor.isNativePlatform()) {
      this._available = false;
      return false;
    }

    try {
      this.listener = await Barometer.addListener('pressureChange', (data) => {
        const raw = pressureToAltitude(data.pressure, this.qnh);

        // Apply exponential smoothing
        if (this.smoothedAltitude === null) {
          this.smoothedAltitude = raw;
        } else {
          this.smoothedAltitude = this.alpha * raw + (1 - this.alpha) * this.smoothedAltitude;
        }

        this.callback?.(this.smoothedAltitude, 'barometer');
      });

      await Barometer.startListening();
      this._available = true;
      return true;
    } catch {
      this._available = false;
      return false;
    }
  }

  async stop() {
    try {
      await this.listener?.remove();
      await Barometer.stopListening();
    } catch {
      // ignore
    }
    this.listener = null;
    this._available = false;
    this.smoothedAltitude = null;
  }
}
