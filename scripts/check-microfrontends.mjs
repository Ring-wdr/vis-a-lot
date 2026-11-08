// microfrontends.json과 자식 앱 package.json의 값이 같은지 본다. pnpm lint(lint:root)가 늘 전체로 돌린다.
//
// 자식 앱(help)의 빌드는 apps/web/microfrontends.json의 asset prefix를 읽는다. 그런데 이 파일은 web 앱 폴더에
// 있어서, 이 파일만 바꾼 커밋은 Vercel의 skip unaffected projects와 turbo --affected 모두 web만 바뀐 것으로 본다.
// 그러면 help는 옛 prefix로 빌드된 배포가 남아 자산이 404가 난다 (docs/deploy.md).
// 그래서 자식 앱이 쓰는 값(앱 이름, assetPrefix)을 그 앱 package.json의 "vis-a-lot".microfrontend에도 적게 하고,
// 둘이 다르면 멈춘다. 값을 바꾸려면 두 파일을 함께 고쳐야 하므로 자식 앱도 바뀐 것으로 잡혀 다시 빌드된다.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const configs = fs
  .readdirSync(path.join(root, "apps"))
  .map((app) => `apps/${app}/microfrontends.json`)
  .filter((p) => fs.existsSync(path.join(root, p)));

const errors = [];
const apps = fs
  .readdirSync(path.join(root, "apps"))
  .filter((app) => fs.existsSync(path.join(root, "apps", app, "package.json")))
  .map((app) => ({
    dir: `apps/${app}`,
    pkg: readJson(`apps/${app}/package.json`),
  }));

for (const file of configs) {
  const { applications } = readJson(file);
  for (const [key, app] of Object.entries(applications)) {
    if (!app.routing) continue; // 기본 앱은 prefix가 없다
    const owner = apps.find((a) => a.pkg.name === (app.packageName ?? key));
    if (!owner) {
      errors.push(
        `${file}: ${key}의 packageName(${app.packageName})에 맞는 apps/* 패키지가 없다`,
      );
      continue;
    }
    const declared = owner.pkg["vis-a-lot"]?.microfrontend;
    const expected = { name: key, assetPrefix: app.assetPrefix };
    if (!declared) {
      errors.push(
        `${owner.dir}/package.json: "vis-a-lot".microfrontend가 없다. ${JSON.stringify(expected)}를 적는다`,
      );
      continue;
    }
    for (const field of ["name", "assetPrefix"]) {
      if (declared[field] !== expected[field])
        errors.push(
          `${owner.dir}/package.json의 "vis-a-lot".microfrontend.${field}(${declared[field]})가 ${file}의 값(${expected[field]})과 다르다. 두 파일을 함께 고친다`,
        );
    }
  }
}

// 반대로 package.json에만 선언하고 microfrontends.json에서 빠진 자식 앱
for (const { dir, pkg } of apps) {
  const declared = pkg["vis-a-lot"]?.microfrontend;
  if (!declared) continue;
  const found = configs.some(
    (file) => readJson(file).applications[declared.name],
  );
  if (!found)
    errors.push(
      `${dir}/package.json: microfrontends.json에 ${declared.name} 앱이 없다`,
    );
}

if (errors.length > 0) {
  for (const e of errors) console.error(`check-microfrontends: ${e}`);
  process.exit(1);
}
console.log(`check-microfrontends: ${configs.join(", ")} 일치`);
