#!/usr/bin/env bash
# End-to-end build: soundtrack -> frames -> muxed MP4.
#
#   bash scripts/build.sh                 # full 1080x1920 @30fps
#   FPS=15 SCALE=0.5 bash scripts/build.sh   # quick low-res draft
set -euo pipefail

cd "$(dirname "$0")/.."

FPS="${FPS:-30}"
SCALE="${SCALE:-1}"
WORKERS="${WORKERS:-3}"
DURATION="${DURATION:-34}"
OUT="${OUT:-output/luu-vi-quan-promo.mp4}"
FRAMES="${FRAMES:-frames}"

FFMPEG="${FFMPEG:-$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || echo ffmpeg)}"

echo "==> 1/4  export timeline"
node scripts/export-timeline.mjs

echo "==> 2/4  synthesise soundtrack"
python3 audio/soundtrack.py

echo "==> 3/4  render frames (${FPS}fps, scale ${SCALE}, ${WORKERS} workers)"
rm -rf "$FRAMES"
node scripts/render.mjs --fps "$FPS" --duration "$DURATION" --workers "$WORKERS" --scale "$SCALE" --out "$FRAMES"

echo "==> 4/4  mux video + audio"
mkdir -p "$(dirname "$OUT")"
"$FFMPEG" -y -loglevel error \
  -framerate "$FPS" -i "$FRAMES/frame_%05d.jpg" \
  -i audio/soundtrack.wav \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -c:a aac -b:a 192k -movflags +faststart -shortest \
  "$OUT"

echo "Done -> $OUT"
ls -lh "$OUT"
