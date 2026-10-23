#!/bin/sh
# git flow 검사. .husky의 pre-commit · pre-merge-commit · pre-push가 함께 쓴다.
#
#   main, develop  PR로만 바뀐다. 로컬 커밋·병합과 직접 push를 막는다. (태그 push는 된다)
#                  릴리스 뒤 main → develop back-merge도 PR로 한다.
#                  GitHub branch protection도 같은 규칙을 서버에서 막는다. 훅은 push 전에 미리 알려 준다.
#   그 밖          develop에서 딴 작업 브랜치(feat/…, fix/…)는 자유롭게 커밋하고 push한다.
#
# 사용법: check-git-flow.sh commit
#         check-git-flow.sh push <원격 ref> <로컬 sha>

fail() {
  echo "git flow: $1" >&2
  echo "작업 브랜치(feat/…, fix/…, chore/…)를 develop에서 따고 PR로 병합하세요. 규칙: docs/git-flow.md" >&2
  exit 1
}

# 충돌을 풀고 마치는 병합 커밋도 pre-commit으로 오므로 병합 여부와 상관없이 막는다.
check_commit() {
  branch=$(git rev-parse --abbrev-ref HEAD)
  case "$branch" in
    main | develop)
      fail "$branch 브랜치에서는 커밋·병합하지 않습니다. PR로만 바뀝니다."
      ;;
  esac
}

check_push() {
  remote_ref=$1 local_sha=$2
  zero=0000000000000000000000000000000000000000
  # 삭제는 검사하지 않는다. (서버의 branch protection이 main·develop 삭제를 막는다)
  [ "$local_sha" = "$zero" ] && exit 0

  case "$remote_ref" in
    refs/heads/main | refs/heads/develop)
      fail "${remote_ref#refs/heads/}에 직접 push할 수 없습니다. PR을 여세요."
      ;;
  esac
}

case "$1" in
  commit) check_commit ;;
  push) shift && check_push "$@" ;;
  *) echo "사용법: $0 commit | push <원격 ref> <로컬 sha>" >&2 && exit 2 ;;
esac
