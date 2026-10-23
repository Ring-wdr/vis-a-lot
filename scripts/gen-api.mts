// code-first OAS 생성: 서비스 라우트 정의(zod) → public/openapi/<서비스>.json → TS 타입.
// 원본에서 Spring(springdoc)이 swagger를 내고 프런트가 generator로 받던 흐름을 그대로 따른다.
// 사용: pnpm gen:api (CI에서는 pnpm gen:api --check 로 생성물이 최신인지 확인)

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
import {
  createServiceApp,
  SERVICE_DOC_VERSION,
} from "../server/services/common/http";
import { SERVICES, type ServiceName } from "../server/services/registry";

const root = path.resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");

/** 생성한 타입을 쓰는 곳. 화면은 모든 서비스를, chart 서비스는 auth(서비스 토큰)와 data를 부른다. */
const CONSUMERS: Record<ServiceName, string[]> = {
  auth: [
    "src/shared/api/generated/auth.ts",
    "server/services/chart/generated/auth.ts",
  ],
  data: [
    "src/shared/api/generated/data.ts",
    "server/services/chart/generated/data.ts",
  ],
  chart: ["src/shared/api/generated/chart.ts"],
  feed: ["src/shared/api/generated/feed.ts"],
};

const HEADER =
  "// 자동 생성 파일. 직접 고치지 말고 `pnpm gen:api`로 다시 만든다.\n\n";

const outputs: { file: string; content: string }[] = [];

for (const [name, service] of Object.entries(SERVICES) as [
  ServiceName,
  (typeof SERVICES)[ServiceName],
][]) {
  const app = createServiceApp();
  if ("securitySchemes" in service)
    for (const [scheme, value] of Object.entries(service.securitySchemes))
      app.openAPIRegistry.registerComponent("securitySchemes", scheme, value);
  for (const route of Object.values(service.routes)) {
    app.openAPIRegistry.registerPath(route);
  }
  const doc = app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: {
      title: service.title,
      description: service.description,
      version: SERVICE_DOC_VERSION,
    },
    servers: [{ url: service.basePath }],
  });
  const json = `${JSON.stringify(doc, null, 2)}\n`;
  // public에 두어 정적 파일로도 열 수 있게 한다 (/openapi/<서비스>.json, API 문서 페이지).
  outputs.push({ file: `public/openapi/${name}.json`, content: json });

  const ast = await openapiTS(JSON.parse(json), {
    alphabetize: false,
    exportType: true,
  });
  const ts = HEADER + astToString(ast);
  for (const file of CONSUMERS[name]) outputs.push({ file, content: ts });
}

/** 커밋된 파일과 같은 모양이 되도록 biome 포맷을 거친다. */
function formatted(file: string, content: string) {
  return execFileSync("npx", ["biome", "format", `--stdin-file-path=${file}`], {
    cwd: root,
    input: content,
    encoding: "utf8",
  });
}

const stale: string[] = [];
for (const { file, content } of outputs) {
  const full = path.join(root, file);
  const next = formatted(file, content);
  if (check) {
    let current = "";
    try {
      current = readFileSync(full, "utf8");
    } catch {}
    if (current !== next) stale.push(file);
    continue;
  }
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, next);
}

if (check) {
  if (stale.length) {
    console.error(
      `생성물이 최신이 아닙니다. pnpm gen:api를 실행하세요:\n${stale.join("\n")}`,
    );
    process.exit(1);
  }
  console.log("OAS 생성물이 최신입니다.");
} else {
  console.log(outputs.map((o) => `  ${o.file}`).join("\n"));
}
