// Write·Edit 훅: src·app 파일을 FSD 규칙(scripts/check-fsd.mjs)으로 검사한다.
// PreToolUse: 아직 없는 파일이면 위치만 본다. 레이어 밖에 새 파일을 만드는 Write를 막는다.
// PostToolUse: 고친 파일의 위치와 import 방향을 본다. 어기면 사유를 Claude에게 돌려준다.
// 둘 다 exit 2로 알리고 stderr의 사유가 Claude에게 전달된다.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const filePath = input.tool_input?.file_path;
if (!filePath || !/^(src|app)\//.test(relative(projectDir, filePath))) {
  process.exit(0);
}

const result = spawnSync(
  "node",
  [join(projectDir, "scripts/check-fsd.mjs"), filePath],
  { cwd: projectDir, encoding: "utf8" },
);

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.stderr.write(
    "FSD 규칙을 우회하지 말고 docs/architecture.md대로 위치나 import를 고친다.\n",
  );
  process.exit(2);
}
