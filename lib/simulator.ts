import { classify, type Limits, type Status } from "./alarms";

/**
 * Stateless instrument simulator.
 *
 * Every reading is a pure function of (instrument, time). Nothing is stored,
 * so the API behaves the same on a laptop, in Docker or on a serverless host
 * where each request may land on a different instance.
 */

export interface InstrumentDef {
  id: string;
  name: string;
  subsystem: string;
  unit: string;
  base: number;
  amplitude: number;
  periodSec: number;
  phase: number;
  noise: number;
  limits: Limits;
  /** Optional recurring excursion, to give the demo some alarms. */
  excursion?: { everySec: number; durationSec: number; offsetSec: number; delta: number };
}

export interface Reading {
  t: number; // epoch milliseconds
  value: number;
}

export interface InstrumentSnapshot extends InstrumentDef {
  value: number;
  status: Status;
  updatedAt: number;
}

export const INSTRUMENTS: InstrumentDef[] = [
  {
    id: "rx-lna-temp",
    name: "Receiver LNA Temperature",
    subsystem: "Receiver",
    unit: "°C",
    base: 20,
    amplitude: 1.6,
    periodSec: 240,
    phase: 0.4,
    noise: 0.15,
    limits: { warnHigh: 21.2, faultHigh: 24 },
    excursion: { everySec: 420, durationSec: 40, offsetSec: 30, delta: 5 },
  },
  {
    id: "rx-gain",
    name: "Receiver Gain",
    subsystem: "Receiver",
    unit: "dB",
    base: 32,
    amplitude: 0.8,
    periodSec: 300,
    phase: 1.1,
    noise: 0.1,
    limits: { warnLow: 31.4, faultLow: 30 },
  },
  {
    id: "rx-noise-temp",
    name: "System Noise Temperature",
    subsystem: "Receiver",
    unit: "K",
    base: 55,
    amplitude: 4,
    periodSec: 360,
    phase: 2.0,
    noise: 0.6,
    limits: { warnHigh: 58.5, faultHigh: 64 },
  },
  {
    id: "pwr-bus-voltage",
    name: "Power Bus Voltage",
    subsystem: "Power",
    unit: "V",
    base: 48,
    amplitude: 0.7,
    periodSec: 180,
    phase: 0.2,
    noise: 0.05,
    limits: { warnLow: 47.4, warnHigh: 48.6, faultLow: 46, faultHigh: 50 },
  },
  {
    id: "pwr-load-current",
    name: "Station Load Current",
    subsystem: "Power",
    unit: "A",
    base: 12,
    amplitude: 1.8,
    periodSec: 200,
    phase: 2.7,
    noise: 0.2,
    limits: { warnHigh: 13.4, faultHigh: 15 },
    excursion: { everySec: 600, durationSec: 60, offsetSec: 200, delta: 4 },
  },
  {
    id: "pwr-ups-charge",
    name: "UPS Battery Charge",
    subsystem: "Power",
    unit: "%",
    base: 92,
    amplitude: 6,
    periodSec: 420,
    phase: 4.0,
    noise: 0.4,
    limits: { warnLow: 88, faultLow: 80 },
  },
  {
    id: "net-link-latency",
    name: "Uplink Latency",
    subsystem: "Network",
    unit: "ms",
    base: 8,
    amplitude: 2.5,
    periodSec: 150,
    phase: 1.6,
    noise: 0.6,
    limits: { warnHigh: 10, faultHigh: 14 },
    excursion: { everySec: 480, durationSec: 30, offsetSec: 90, delta: 7 },
  },
  {
    id: "net-packet-loss",
    name: "Packet Loss",
    subsystem: "Network",
    unit: "%",
    base: 0.05,
    amplitude: 0.04,
    periodSec: 260,
    phase: 0.9,
    noise: 0.01,
    limits: { warnHigh: 0.09, faultHigh: 0.5 },
  },
  {
    id: "net-throughput",
    name: "Data Throughput",
    subsystem: "Network",
    unit: "Gb/s",
    base: 80,
    amplitude: 9,
    periodSec: 330,
    phase: 3.3,
    noise: 1.2,
    limits: { warnLow: 73, faultLow: 60 },
  },
  {
    id: "env-wind-speed",
    name: "Wind Speed",
    subsystem: "Environment",
    unit: "m/s",
    base: 6,
    amplitude: 3.5,
    periodSec: 280,
    phase: 5.1,
    noise: 0.8,
    limits: { warnHigh: 8.8, faultHigh: 14 },
  },
  {
    id: "env-humidity",
    name: "Relative Humidity",
    subsystem: "Environment",
    unit: "%",
    base: 28,
    amplitude: 7,
    periodSec: 500,
    phase: 0.6,
    noise: 0.7,
    limits: { warnHigh: 33, faultHigh: 60 },
  },
  {
    id: "cryo-coldhead-temp",
    name: "Cold Head Temperature",
    subsystem: "Cooling",
    unit: "K",
    base: 15,
    amplitude: 0.5,
    periodSec: 220,
    phase: 2.3,
    noise: 0.05,
    limits: { warnHigh: 15.3, faultHigh: 17 },
    excursion: { everySec: 540, durationSec: 50, offsetSec: 350, delta: 3 },
  },
];

/** Deterministic pseudo-random number in [-1, 1) from a string seed and an integer. */
export function noiseAt(seed: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= n;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/** The raw simulated value of one instrument at a given time. */
export function readValue(def: InstrumentDef, nowMs: number): number {
  const tSec = nowMs / 1000;
  const wave = def.amplitude * Math.sin((2 * Math.PI * tSec) / def.periodSec + def.phase);
  const jitter = def.noise * noiseAt(def.id, Math.floor(tSec));

  let excursion = 0;
  if (def.excursion) {
    const { everySec, durationSec, offsetSec, delta } = def.excursion;
    const inCycle = (((tSec + offsetSec) % everySec) + everySec) % everySec;
    if (inCycle < durationSec) excursion = delta;
  }

  const raw = def.base + wave + jitter + excursion;
  // Round so the UI and the tests are not fighting floating-point dust.
  return Math.round(raw * 1000) / 1000;
}

export function snapshot(def: InstrumentDef, nowMs: number): InstrumentSnapshot {
  const value = readValue(def, nowMs);
  return { ...def, value, status: classify(value, def.limits), updatedAt: nowMs };
}

export function snapshotAll(nowMs: number): InstrumentSnapshot[] {
  return INSTRUMENTS.map((def) => snapshot(def, nowMs));
}

export function findInstrument(id: string): InstrumentDef | undefined {
  return INSTRUMENTS.find((i) => i.id === id);
}

/** Past readings, oldest first, ending at `nowMs`. */
export function history(
  def: InstrumentDef,
  nowMs: number,
  points: number,
  stepSeconds: number,
): Reading[] {
  const out: Reading[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const t = nowMs - i * stepSeconds * 1000;
    out.push({ t, value: readValue(def, t) });
  }
  return out;
}
