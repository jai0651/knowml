#!/usr/bin/env bash
# Wide KaTeX equations silently overflow their container and get clipped, which
# is easy to miss because the page still looks fine until you scroll. This
# expands every collapsed derivation, then reports any equation whose rendered
# width exceeds its box.
#
#   ./scripts/check-equation-overflow.sh                # all topic pages
#   ./scripts/check-equation-overflow.sh topics/12-*.html
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME"; exit 1; }

PORT=8781
PAGES=("$@")
if [ ${#PAGES[@]} -eq 0 ]; then
  PAGES=(topics/*.html)
fi

python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true; rm -f "$ROOT/assets/js/_overflow_probe.js"' EXIT
sleep 1

cat > assets/js/_overflow_probe.js <<'PROBE'
window.addEventListener('load', function () {
  setTimeout(function () {
    document.querySelectorAll('details').forEach(function (d) { d.open = true; });
    setTimeout(function () {
      var bad = [];
      document.querySelectorAll('.drv-eq, .eq-block, .katex-display').forEach(function (e) {
        // a .katex-display nested inside an equation container is the same
        // equation counted twice, and its own margins fake a few px of overflow
        if (e.classList.contains('katex-display') && e.closest('.drv-eq, .eq-block')) return;
        var over = e.scrollWidth - e.clientWidth;
        if (over > 4) bad.push(over + 'px');
      });
      document.title = 'OF[' + bad.length + ']' + (bad.length ? ' ' + bad.join(',') : '');
    }, 600);
  }, 800);
});
PROBE

fail=0
for page in "${PAGES[@]}"; do
  [ -f "$page" ] || continue
  base="$(basename "$page")"
  tmp="topics/_of_${base}"
  python3 - "$page" "$tmp" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
marker = '<div class="progress-bar" id="progressBar"></div>'
s = s.replace(marker, marker + '\n<script src="../assets/js/_overflow_probe.js"></script>', 1)
open(dst, "w", encoding="utf-8").write(s)
PY
  title=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=6000 \
            --window-size=1250,20000 --dump-dom "http://127.0.0.1:$PORT/$tmp" 2>/dev/null \
          | grep -o '<title>OF\[[^<]*' | head -1 | sed 's/<title>//')
  rm -f "$tmp"
  count="${title#OF[}"; count="${count%%]*}"
  if [ "${count:-0}" != "0" ]; then
    printf '  \033[31mFAIL\033[0m %-46s %s\n' "$base" "$title"
    fail=1
  else
    printf '  ok   %-46s\n' "$base"
  fi
done

exit $fail
