#!/bin/bash
# codex.sh <workdir> <prompt.txt> <img>...: one Codex image_gen call in <workdir> (a temp dir outside any repo);
# output <workdir>/out.png, log <workdir>/codex.log.
d="$1"; p="$2"; shift 2
args=(); for i in "$@"; do args+=(-i "$i"); done
cd "$d" && codex exec --skip-git-repo-check --sandbox workspace-write "${args[@]}" - < "$p" > "$d/codex.log" 2>&1
echo "exit $? $d"
