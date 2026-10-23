# git flow

이 저장소는 git flow로 진행한다. 아래 규칙은 git 훅(husky)이 강제하므로 사람이든 에이전트든 같은 규칙을 따른다. `pnpm install`이 `prepare`에서 husky를 설치하고 훅을 켠다.

## 브랜치

| 브랜치 | 바뀌는 방법 |
|---|---|
| `main` | 릴리스. `release/<버전>` 브랜치의 PR로만 바뀐다. 병합하면 main에 태그를 단다. |
| `develop` | 다음 릴리스를 모으는 곳. 작업 브랜치의 PR로 바뀐다. 릴리스 뒤에는 main을 가져오는 back-merge(`git merge main`)를 로컬에서 커밋하고 push한다. |
| `feat/…` `fix/…` `refactor/…` `chore/…` `docs/…` `test/…` | develop에서 딴 작업 브랜치. 자유롭게 커밋하고 push한 뒤 develop으로 PR을 연다. |
| `release/<버전>` | develop에서 따서 버전과 CHANGELOG를 정리하고 main으로 PR을 연다. |

작업 브랜치는 PR에서 `--no-ff` 병합(Create a merge commit)으로 develop에 들어간다. 커밋 메시지는 conventional type(feat, fix, refactor, chore, docs, build, style, test)과 한국어 제목·본문으로 쓴다.

## 훅이 막는 것

| 훅 | 막는 것 |
|---|---|
| `pre-commit` | main·develop에 직접 하는 커밋. 충돌을 풀고 마치는 병합 커밋도 여기서 검사한다. |
| `pre-merge-commit` | main에서 하는 로컬 병합. develop에서는 main이 아닌 브랜치를 병합하는 것. |
| `pre-push` | 규칙에 맞지 않는 브랜치 이름(`scripts/check-branch-name.sh`), main으로 직접 하는 push, develop에 PR 없이 올라가는 커밋. develop push는 back-merge 커밋만 허용한다. fast-forward 병합처럼 병합 커밋 없이 들어온 커밋도 여기서 잡힌다. |

규칙은 `scripts/check-git-flow.sh` 한 곳에 있다. `--no-verify`나 `HUSKY=0`으로 우회하지 않는다.

GitHub의 branch protection(main·develop에 PR 필수)을 함께 켜면 훅이 없는 환경(웹 편집, 훅을 끈 클론)도 막을 수 있다. 이 설정은 저장소 설정에서 따로 켠다.
