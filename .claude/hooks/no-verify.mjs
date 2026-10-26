// PreToolUse(Bash) 훅: git 훅(husky)을 건너뛰는 명령을 막는다.
// pre-commit·pre-push가 git flow, 브랜치 이름, FSD 구조를 검사하므로 우회하지 않는다.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = input.tool_input?.command ?? "";

const reasons = [];
for (const segment of command.split(/&&|\|\||;|\||\n/)) {
  const tokens = segment.trim().replace(/["']/g, "").split(/\s+/);
  if (tokens.some((t) => /^HUSKY=0$/.test(t))) reasons.push("HUSKY=0");
  const g = tokens.indexOf("git");
  if (g === -1) continue;
  const rest = tokens.slice(g + 1);
  if (rest.some((t) => /^core\.hooksPath=/i.test(t)))
    reasons.push("core.hooksPath");
  if (rest.includes("--no-verify")) reasons.push("--no-verify");
  // git commit -n 은 --no-verify다 (git push -n 은 dry-run이라 제외).
  const sub = rest.find((t) => !t.startsWith("-"));
  if (sub === "commit" && rest.some((t) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(t))) {
    reasons.push("git commit -n");
  }
}

if (reasons.length) {
  process.stderr.write(
    `git 훅을 건너뛰는 ${[...new Set(reasons)].join(", ")}은 쓰지 않는다. ` +
      "훅이 막은 사유(git flow, 브랜치 이름, FSD 구조)를 고친 뒤 다시 실행한다. " +
      "정말 필요하면 사용자에게 직접 실행해 달라고 한다.\n",
  );
  process.exit(2);
}
