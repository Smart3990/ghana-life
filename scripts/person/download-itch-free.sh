#!/bin/bash
# Downloads every file of a free itch.io pack: itch-free.sh <creator> <slug> <outdir>
set -e
C=$1; G=$2; OUT=$3; mkdir -p "$OUT"; J=$(mktemp)
BASE="https://$C.itch.io/$G"
curl -s -c $J -b $J -m 30 "$BASE" -o "$OUT/.page.html"
CSRF=$(grep -oE 'name="csrf_token" value="[^"]+"' "$OUT/.page.html" | head -1 | sed 's/.*value="//;s/"//')
DL=$(curl -s -c $J -b $J -m 30 -X POST -d "csrf_token=$CSRF" "$BASE/download_url" | python3 -c 'import sys,json;print(json.load(sys.stdin)["url"])')
curl -s -c $J -b $J -m 30 "$DL" -o "$OUT/.dl.html"
python3 - "$OUT/.dl.html" > "$OUT/.files" <<'PY'
import re,sys,html
t=open(sys.argv[1]).read()
for m in re.finditer(r'data-upload_id="(\d+)".*?class="name"[^>]*>([^<]+)<',t,re.S): print(m.group(1), html.unescape(m.group(2)))
PY
cat "$OUT/.files"
while read -r ID NAME; do
  U=$(curl -s -c $J -b $J -m 30 -X POST -d "csrf_token=$CSRF" "$BASE/file/$ID?source=game_download" | python3 -c 'import sys,json;print(json.load(sys.stdin)["url"])')
  curl -sL -m 900 "$U" -o "$OUT/$NAME"; ls -la "$OUT/$NAME"
done < "$OUT/.files"
