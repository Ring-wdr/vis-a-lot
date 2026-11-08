// 제조/IoT 센서 데이터 절차적 생성기.
// 시간 순서(바깥) × 센서(안쪽)로 행을 만들고, COPY에 바로 넣을 CSV 조각으로 내보낸다.

import { createRandom, deriveSeed, type Random } from "./random";
import { type RowSize, SEED } from "./schema";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** 2026-09-01 00:00 KST */
export const START_MS = Date.UTC(2026, 7, 31, 15);
export const DURATION_MS = 30 * DAY;

export const FACTORIES = ["판교", "구미", "울산"] as const;
export const LINES_PER_FACTORY = 4;
export const MACHINES_PER_LINE = 10;
export const SENSOR_TYPES = ["온도", "진동", "압력", "전류"] as const;
export const SENSOR_COUNT =
  FACTORIES.length *
  LINES_PER_FACTORY *
  MACHINES_PER_LINE *
  SENSOR_TYPES.length;

type SensorType = (typeof SENSOR_TYPES)[number];
type Shift = "주간" | "야간" | "심야";

type SensorProfile = {
  base: [number, number];
  sigma: number;
  drift: [number, number];
  dailyAmp: number;
  envCoef: number;
  loadCoef: number;
  digits: number;
};

const PROFILES: Record<SensorType, SensorProfile> = {
  온도: {
    base: [55, 8],
    sigma: 0.8,
    drift: [-3, 3],
    dailyAmp: 2.5,
    envCoef: 0.6,
    loadCoef: 0.05,
    digits: 2,
  },
  진동: {
    base: [2.4, 0.5],
    sigma: 0.25,
    drift: [0, 1.2],
    dailyAmp: 0.1,
    envCoef: 0,
    loadCoef: 0.015,
    digits: 3,
  },
  압력: {
    base: [5, 0.6],
    sigma: 0.08,
    drift: [-0.3, 0.3],
    dailyAmp: 0.05,
    envCoef: 0.02,
    loadCoef: 0.004,
    digits: 3,
  },
  전류: {
    base: [18, 3],
    sigma: 0.9,
    drift: [-1.5, 1.5],
    dailyAmp: 0.6,
    envCoef: 0,
    loadCoef: 0.12,
    digits: 2,
  },
};

const SHIFT_LOAD: Record<Shift, number> = { 주간: 82, 야간: 71, 심야: 38 };

type AnomalyKind = "spike" | "level" | "missing";
type Anomaly = {
  kind: AnomalyKind;
  start: number;
  end: number;
  offset: number;
};

type Sensor = {
  factory: number;
  line: number; // 전체 라인 인덱스 (0..11)
  machine: string;
  type: SensorType;
  lineLabel: string;
  base: number;
  drift: number;
  anomalies: Anomaly[];
  cursor: number;
  rng: Random;
};

export function shiftOf(offsetMs: number): Shift {
  const hour = Math.floor(offsetMs / HOUR) % 24;
  if (hour >= 6 && hour < 14) return "주간";
  if (hour >= 14 && hour < 22) return "야간";
  return "심야";
}

function round(v: number, digits: number) {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
}

function buildSensors(intervalMs: number): Sensor[] {
  const sensors: Sensor[] = [];
  let machineNo = 0;
  for (let f = 0; f < FACTORIES.length; f++) {
    for (let l = 0; l < LINES_PER_FACTORY; l++) {
      for (let m = 0; m < MACHINES_PER_LINE; m++) {
        machineNo++;
        const machine = `M${String(machineNo).padStart(3, "0")}`;
        for (const type of SENSOR_TYPES) {
          const rng = createRandom(deriveSeed(SEED, `${machine}:${type}`));
          const p = PROFILES[type];
          sensors.push({
            factory: f,
            line: f * LINES_PER_FACTORY + l,
            lineLabel: `L${l + 1}`,
            machine,
            type,
            base: p.base[0] + rng.normal() * p.base[1],
            drift: rng.range(p.drift[0], p.drift[1]),
            anomalies: buildAnomalies(rng, p.sigma, intervalMs),
            cursor: 0,
            rng,
          });
        }
      }
    }
  }
  return sensors;
}

function buildAnomalies(rng: Random, sigma: number, intervalMs: number) {
  const list: Anomaly[] = [];
  const count = rng.int(2, 8);
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    const start = rng.range(0, DURATION_MS);
    const sign = rng.next() < 0.5 ? -1 : 1;
    if (roll < 0.5) {
      list.push({
        kind: "spike",
        start,
        end: start + intervalMs * rng.int(1, 3),
        offset: sign * rng.range(5, 8) * sigma,
      });
    } else if (roll < 0.8) {
      list.push({
        kind: "level",
        start,
        end: start + rng.range(2, 12) * HOUR,
        offset: sign * rng.range(2.5, 4) * sigma,
      });
    } else {
      list.push({
        kind: "missing",
        start,
        end: start + rng.range(1, 6) * HOUR,
        offset: 0,
      });
    }
  }
  return list.sort((a, b) => a.start - b.start);
}

/** 라인별 LOT 경계. 1~2.5시간마다 LOT가 바뀐다. */
function buildLots(lineCount: number) {
  return Array.from({ length: lineCount }, (_, line) => {
    const rng = createRandom(deriveSeed(SEED, `lot:${line}`));
    const ends: number[] = [];
    for (let t = 0; t < DURATION_MS; ) {
      t += rng.range(1, 2.5) * HOUR;
      ends.push(t);
    }
    return ends;
  });
}

function activeAnomaly(sensor: Sensor, offsetMs: number) {
  const { anomalies } = sensor;
  while (
    sensor.cursor < anomalies.length &&
    anomalies[sensor.cursor].end <= offsetMs
  ) {
    sensor.cursor++;
  }
  // 겹친 이상 구간이 있을 수 있어 커서부터 시작 시각이 지난 것까지 훑는다.
  for (let i = sensor.cursor; i < anomalies.length; i++) {
    const a = anomalies[i];
    if (a.start > offsetMs) break;
    if (a.end > offsetMs) return a;
  }
  return undefined;
}

export type CsvChunk = { csv: string; rows: number };

/**
 * `rows`개 행을 `chunkRows`개씩 CSV 문자열로 내보낸다.
 * 측정값 누락은 빈 필드(= NULL)로 표현한다.
 */
export function* generateCsvChunks(
  rows: RowSize,
  chunkRows = 25_000,
): Generator<CsvChunk> {
  const steps = Math.ceil(rows / SENSOR_COUNT);
  const intervalMs = DURATION_MS / steps;
  const sensors = buildSensors(intervalMs);
  const lineCount = FACTORIES.length * LINES_PER_FACTORY;
  const lots = buildLots(lineCount);
  const lotCursor = new Array<number>(lineCount).fill(0);
  const envRng = createRandom(deriveSeed(SEED, "env"));
  const loadRng = createRandom(deriveSeed(SEED, "load"));
  const lineLoadOffset = Array.from({ length: lineCount }, () =>
    loadRng.range(-6, 6),
  );

  let produced = 0;
  let lines: string[] = [];

  for (let step = 0; step < steps && produced < rows; step++) {
    const offset = step * intervalMs;
    const ts = new Date(START_MS + offset).toISOString();
    const hourOfDay = (offset / HOUR) % 24;
    const shift = shiftOf(offset);

    const env = FACTORIES.map(
      (_, f) =>
        22 +
        f * 1.5 +
        4 * Math.sin((2 * Math.PI * (hourOfDay - 9)) / 24) +
        2 * Math.sin((2 * Math.PI * offset) / DURATION_MS) +
        envRng.normal() * 0.3,
    );
    const load = lineLoadOffset.map((o) =>
      Math.min(100, Math.max(5, SHIFT_LOAD[shift] + o + loadRng.normal() * 4)),
    );
    const lotIds = lots.map((ends, line) => {
      while (
        lotCursor[line] < ends.length - 1 &&
        ends[lotCursor[line]] <= offset
      ) {
        lotCursor[line]++;
      }
      const f = Math.floor(line / LINES_PER_FACTORY);
      const l = (line % LINES_PER_FACTORY) + 1;
      return `${f + 1}L${l}-${String(lotCursor[line] + 1).padStart(4, "0")}`;
    });

    for (const s of sensors) {
      if (produced >= rows) break;
      const p = PROFILES[s.type];
      const noise = s.rng.normal();
      const anomaly = activeAnomaly(s, offset);

      let valueField = "";
      let status = "정상";
      if (anomaly?.kind === "missing") {
        status = "이상";
      } else {
        const value =
          s.base +
          s.drift * (offset / DURATION_MS) +
          p.dailyAmp * Math.sin((2 * Math.PI * (hourOfDay - 14)) / 24) +
          p.envCoef * (env[s.factory] - 22) +
          p.loadCoef * (load[s.line] - 60) +
          noise * p.sigma +
          (anomaly?.offset ?? 0);
        valueField = String(round(value, p.digits));
        if (anomaly) status = "이상";
        else if (Math.abs(noise) > 2) status = "경고";
      }

      lines.push(
        `${ts},${FACTORIES[s.factory]},${s.lineLabel},${s.machine},${s.type},${shift},${lotIds[s.line]},${status},${valueField},${round(env[s.factory], 2)},${round(load[s.line], 1)}`,
      );
      produced++;

      if (lines.length === chunkRows) {
        yield { csv: lines.join("\n"), rows: lines.length };
        lines = [];
      }
    }
  }

  if (lines.length > 0) yield { csv: lines.join("\n"), rows: lines.length };
}
