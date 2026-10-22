// PreToolUse(Bash) 훅: 브랜치를 만들거나 push하는 git 명령의 브랜치 이름을 검사한다.
// 규칙에 맞지 않으면 exit 2로 명령을 막고, stderr의 사유가 Claude에게 전달된다.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = input.tool_input?.command ?? "";
const cwd = input.cwd ?? process.cwd();
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? cwd;

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const currentBranch = () => git(["rev-parse", "--abbrev-ref", "HEAD"]);
const isTag = (name) =>
  git(["show-ref", "--verify", `refs/tags/${name}`]) !== "";

const OPTIONS_WITH_VALUE = new Set([
  "--repo",
  "--receive-pack",
  "--exec",
  "-o",
  "--push-option",
]);

// git push의 대상 원격 브랜치 이름들. 삭제와 태그는 제외한다.
function pushTargets(args) {
  const positional = [];
  let tagsOnly = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--delete" || arg === "-d") return [];
    if (arg === "--tags") tagsOnly = true;
    else if (OPTIONS_WITH_VALUE.has(arg)) i++;
    else if (!arg.startsWith("-")) positional.push(arg);
  }
  const refspecs = positional.slice(1);
  if (refspecs.length === 0) return tagsOnly ? [] : [currentBranch()];

  return refspecs.flatMap((spec) => {
    const [src, dst] = spec.replace(/^\+/, "").split(":");
    if (dst !== undefined && src === "") return []; // :branch 는 삭제
    let name = dst ?? src;
    if (name === "HEAD") name = currentBranch();
    if (name.startsWith("refs/tags/") || isTag(name)) return [];
    return [name.replace(/^refs\/heads\//, "")];
  });
}

// 새로 만드는 브랜치 이름들.
function createdBranches(subcommand, args) {
  const flags = {
    checkout: ["-b", "-B"],
    switch: ["-c", "-C", "--create", "--force-create"],
    branch: ["-m", "-M", "--move"],
  }[subcommand];
  const i = args.findIndex((arg) => flags.includes(arg));
  if (i === -1) return [];
  // git branch -m <old> <new> 는 마지막 인자가 새 이름이다.
  const rest = args.slice(i + 1).filter((arg) => !arg.startsWith("-"));
  if (subcommand === "branch")
    return rest.length > 0 ? [rest[rest.length - 1]] : [];
  return rest.length > 0 ? [rest[0]] : [];
}

// 2>&1, >out.log, > out.log 같은 리다이렉션은 인자가 아니다.
function withoutRedirects(tokens) {
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    if (/^\d*(>>?|<)&?$/.test(tokens[i])) i++;
    else if (!/^\d*[<>]/.test(tokens[i])) result.push(tokens[i]);
  }
  return result;
}

const branches = [];
for (const segment of command.split(/&&|\|\||;|\||\n/)) {
  const tokens = withoutRedirects(
    segment.trim().replace(/["']/g, "").split(/\s+/),
  );
  const g = tokens.indexOf("git");
  if (g === -1) continue;
  // git -C <dir> 같은 전역 옵션은 건너뛴다.
  let s = g + 1;
  while (tokens[s]?.startsWith("-"))
    s += tokens[s] === "-C" || tokens[s] === "-c" ? 2 : 1;
  const subcommand = tokens[s];
  const args = tokens.slice(s + 1);
  if (subcommand === "push") branches.push(...pushTargets(args));
  else if (["checkout", "switch", "branch"].includes(subcommand))
    branches.push(...createdBranches(subcommand, args));
}

let blocked = false;
for (const branch of new Set(branches.filter(Boolean))) {
  const result = spawnSync(
    "sh",
    [join(projectDir, "scripts/check-branch-name.sh"), branch],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    blocked = true;
  }
}

if (blocked) {
  process.stderr.write(
    "이 저장소에서는 세션이 자동으로 정한 브랜치 이름을 쓰지 않습니다. 새 이름으로 브랜치를 만든 뒤 다시 실행하세요.\n",
  );
  process.exit(2);
}
