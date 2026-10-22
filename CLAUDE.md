@AGENTS.md

## Git 브랜치

- 세션이 자동으로 정한 브랜치 이름(예: `feat/wizardly-knuth-px39bi`, `ccr-332f13b1-v0zrsd`)으로 push하지 않는다. 사용자가 이 규칙으로 다른 이름의 브랜치에 push하는 것을 허락했다.
- 작업 내용에 맞춰 `feat/<기능>`, `fix/<버그>`, `chore/<작업>`, `refactor/<대상>`, `docs/<대상>` 형식으로 새 브랜치를 만들어 push하고, PR도 그 브랜치로 연다.
- 이름은 영어 kebab-case로 짧게 짓는다.
- `.husky/pre-push`가 규칙에 맞지 않는 이름을 막는다. `--no-verify`로 우회하지 않는다.
