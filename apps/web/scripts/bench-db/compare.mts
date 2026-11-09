// bench:db 결과 두 개(--out JSON)를 케이스별 중앙값 표(markdown)로 비교한다.
// 사용: tsx scripts/bench-db/compare.mts before.json after.json

import { readFileSync } from "node:fs";

type Result = {
  name: string;
  medianMs: number;
  p95Ms: number;
  statements: number;
};
type Report = {
  feed?: { results: Result[] };
  data?: { results: Result[] };
};

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  console.error("사용: compare.mts before.json after.json");
  process.exit(1);
}
const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Report;
const before = read(beforePath);
const after = read(afterPath);

const ms = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));

for (const part of ["feed", "data"] as const) {
  const a = before[part]?.results ?? [];
  const b = new Map((after[part]?.results ?? []).map((r) => [r.name, r]));
  if (a.length === 0) continue;
  console.log(`\n### ${part}\n`);
  console.log("| 케이스 | 전 (ms) | 후 (ms) | 배율 | 문장 수 전→후 |");
  console.log("| --- | ---: | ---: | ---: | ---: |");
  for (const r of a) {
    const n = b.get(r.name);
    if (!n) continue;
    const ratio = r.medianMs / n.medianMs;
    console.log(
      `| ${r.name} | ${ms(r.medianMs)} | ${ms(n.medianMs)} | ${ratio >= 1 ? `${ratio.toFixed(1)}×` : `**${ratio.toFixed(2)}×**`} | ${r.statements}→${n.statements} |`,
    );
  }
}
