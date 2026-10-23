#!/bin/sh
# git flow 검사. .husky의 pre-commit · pre-merge-commit · pre-push가 함께 쓴다.
#
#   main     PR로만 바뀐다. 로컬 커밋·병합·직접 push를 막는다. (태그 push는 된다)
#   develop  작업 브랜치는 PR로 병합한다. 로컬에서는 릴리스 뒤 main을 가져오는
#            back-merge(git merge main)만 커밋할 수 있고, push도 그 커밋만 된다.
#   그 밖    develop에서 딴 작업 브랜치(feat/…, fix/…)는 자유롭게 커밋한다.
#
# 사용법: check-git-flow.sh commit
#         check-git-flow.sh push <원격 ref> <로컬 sha> <원격 sha>

fail() {
  echo "git flow: $1" >&2
  echo "작업 브랜치(feat/…, fix/…, chore/…)를 develop에서 따고 PR로 병합하세요. 규칙: docs/git-flow.md" >&2
  exit 1
}

# main의 기록에 있는 커밋인지 (로컬 main이 오래됐을 수 있어 origin/main도 본다)
in_main() {
  for ref in origin/main main; do
    git rev-parse -q --verify "$ref" >/dev/null &&
      git merge-base --is-ancestor "$1" "$ref" && return 0
  done
  return 1
}

check_commit() {
  branch=$(git rev-parse --abbrev-ref HEAD)
  case "$branch" in
    main | develop) ;;
    *) exit 0 ;;
  esac

  # 병합 대상. git merge 중(pre-merge-commit)에는 MERGE_HEAD가 아직 없고 GITHEAD_<sha> 환경 변수로 온다.
  # 충돌을 풀고 git commit으로 마칠 때(pre-commit)는 MERGE_HEAD가 있다.
  merge_heads=$(
    env | sed -n 's/^GITHEAD_\([0-9a-f]*\)=.*/\1/p'
    git_dir=$(git rev-parse --git-dir)
    [ -f "$git_dir/MERGE_HEAD" ] && cat "$git_dir/MERGE_HEAD"
  )
  if [ -z "$merge_heads" ]; then
    fail "$branch 브랜치에 직접 커밋할 수 없습니다."
  fi
  if [ "$branch" = main ]; then
    fail "main은 release 브랜치의 PR로만 바뀝니다. 로컬에서 병합하지 않습니다."
  fi
  for head in $merge_heads; do
    in_main "$head" ||
      fail "develop에는 main을 가져오는 back-merge만 로컬에서 병합합니다. 작업 브랜치는 PR로 병합하세요."
  done
}

check_push() {
  remote_ref=$1 local_sha=$2 remote_sha=$3
  zero=0000000000000000000000000000000000000000
  # 삭제는 검사하지 않는다.
  [ "$local_sha" = "$zero" ] && exit 0

  case "$remote_ref" in
    refs/heads/main)
      fail "main에 직접 push할 수 없습니다. release 브랜치에서 PR을 여세요."
      ;;
    refs/heads/develop) ;;
    *) exit 0 ;;
  esac

  [ "$remote_sha" = "$zero" ] && exit 0
  # develop에 새로 올라가는 커밋(첫 부모 줄)은 모두 main을 가져온 병합이어야 한다.
  for commit in $(git rev-list --first-parent "$remote_sha..$local_sha"); do
    second=$(git rev-parse -q --verify "$commit^2")
    if [ -z "$second" ] || ! in_main "$second"; then
      fail "develop에 PR 없이 올라가는 커밋이 있습니다: $(git log -1 --format='%h %s' "$commit")"
    fi
  done
}

case "$1" in
  commit) check_commit ;;
  push) shift && check_push "$@" ;;
  *) echo "사용법: $0 commit | push <원격 ref> <로컬 sha> <원격 sha>" >&2 && exit 2 ;;
esac
