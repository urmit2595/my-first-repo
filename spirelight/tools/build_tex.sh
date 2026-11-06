#!/bin/bash
# Usage: tools/build_tex.sh name...   (art-src/tex/NAME.png -> assets/tex/NAME.webp + NAME_n.webp)
cd "$(dirname "$0")/.."
mkdir -p assets/tex art-src/tex/work
for n in "$@"; do
  uv run tools/kit_tools.py seamless art-src/tex/$n.png art-src/tex/work/$n.png --size 1024
  python3 tools/webpify.py --quality ${Q:-80} --keep art-src/tex/work/$n.png >/dev/null
  mv art-src/tex/work/$n.webp assets/tex/$n.webp
  python3 tools/normalmap.py art-src/tex/work/$n.png assets/tex/${n}_n.webp --strength ${S:-2.0}
done
du -ch assets/tex/* | tail -1
