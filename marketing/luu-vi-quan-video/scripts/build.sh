#!/usr/bin/env bash
# End-to-end build: soundtrack -> frames -> muxed MP4.
#
#   bash scripts/build.sh                      # the photo cut, 1080x1920 @30fps
#   FILM=cg bash scripts/build.sh              # the 3D/CG cut
#   FPS=15 SCALE=0.5 bash scripts/build.sh     # quick low-res draft
set -euo pipefail

cd "$(dirname "$0")/.."

FPS="${FPS:-30}"
SCALE="${SCALE:-1}"
WORKERS="${WORKERS:-3}"
DURATION="${DURATION:-34}"
FILM="${FILM:-photo}"                 # photo = real photographs, cg = the 3D scene
VOICE="${VOICE:-}"                    # optional voice-over WAV mixed under/over the music
AUDIO="${AUDIO:-}"                    # optional music track replacing the synthesised one
AUDIO_START="${AUDIO_START:-0}"       # second of that track to start from (pick a chorus)
FRAMES="${FRAMES:-frames}"

if [ "$FILM" = "photo" ]; then
  PAGE="scene/film.html"
  TIMELINE="audio/timeline-photo.json"
  TRACK="audio/soundtrack-photo.wav"
  OUT="${OUT:-output/luu-vi-quan-promo-photo.mp4}"
else
  PAGE="scene/index.html"
  TIMELINE="audio/timeline.json"
  TRACK="audio/soundtrack.wav"
  OUT="${OUT:-output/luu-vi-quan-promo.mp4}"
fi

FFMPEG="${FFMPEG:-$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || echo ffmpeg)}"

echo "==> 1/4  export timeline ($FILM cut)"
node scripts/export-timeline.mjs --film "$FILM"

if [ -n "$AUDIO" ]; then
  echo "==> 2/4  use the supplied music: $AUDIO"
  "$FFMPEG" -y -loglevel error -ss "$AUDIO_START" -t "$DURATION" -i "$AUDIO" -vn -ac 2 -ar 44100 \
    -af "afade=t=in:st=0:d=0.3,afade=t=out:st=$(echo "$DURATION - 1.1" | bc):d=1.1,loudnorm=I=-14:TP=-1.5:LRA=11" \
    "$TRACK"
else
  echo "==> 2/4  synthesise soundtrack"
  python3 audio/soundtrack.py --timeline "$TIMELINE" --out "$TRACK" ${VOICE:+--voice "$VOICE"}
fi

echo "==> 2b   map the beat"
python3 audio/beatmap.py --audio "$TRACK" --fps "$FPS"

echo "==> 3/4  render frames (${FPS}fps, scale ${SCALE}, ${WORKERS} workers)"
rm -rf "$FRAMES"
node scripts/render.mjs --fps "$FPS" --duration "$DURATION" --workers "$WORKERS" --scale "$SCALE" --out "$FRAMES" --page "$PAGE"

echo "==> 4/4  mux video + audio"
mkdir -p "$(dirname "$OUT")"
"$FFMPEG" -y -loglevel error \
  -framerate "$FPS" -i "$FRAMES/frame_%05d.jpg" \
  -i "$TRACK" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -c:a aac -b:a 192k -movflags +faststart -shortest \
  "$OUT"

echo "Done -> $OUT"
ls -lh "$OUT"
