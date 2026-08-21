#!/usr/bin/env python3
"""Find the beat in any piece of music, so the picture can move with it.

Give it a WAV or MP3 and it writes `scene/beats.json`: the tempo, every beat, the
onsets between them with how hard each one hits, and a per-frame energy curve
split into bass / mid / high. The film shader reads that file and punches the
zoom, shakes the frame and flashes the highlights on the beat - which is what
makes an ad feel like it is dancing rather than just playing.

    python3 audio/beatmap.py --audio audio/soundtrack-photo.wav
    python3 audio/beatmap.py --audio nhac-cua-ban.mp3 --fps 30

Nothing but numpy: spectral-flux onset detection, autocorrelation tempo, and a
phase search that lands the grid where the music actually accents.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import tempfile
import wave

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent


def load_audio(path: pathlib.Path) -> tuple[np.ndarray, int]:
    """Any format ffmpeg understands, returned as mono float."""
    if path.suffix.lower() != '.wav':
        try:
            import imageio_ffmpeg
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg = 'ffmpeg'
        tmp = pathlib.Path(tempfile.mkdtemp()) / 'in.wav'
        subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', str(path),
                        '-ac', '1', '-ar', '44100', str(tmp)], check=True)
        path = tmp
    with wave.open(str(path), 'rb') as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32768
        if w.getnchannels() == 2:
            x = x.reshape(-1, 2).mean(axis=1)
    return x, sr


def spectrogram(x: np.ndarray, sr: int, hop: int, win: int):
    frames = max(1, (len(x) - win) // hop + 1)
    window = np.hanning(win)
    spec = np.empty((frames, win // 2 + 1), np.float32)
    for i in range(frames):
        seg = x[i * hop:i * hop + win]
        if len(seg) < win:
            seg = np.pad(seg, (0, win - len(seg)))
        spec[i] = np.abs(np.fft.rfft(seg * window))
    return spec


def onset_envelope(spec: np.ndarray) -> np.ndarray:
    """Spectral flux: how much new energy appeared since the previous frame."""
    log = np.log1p(spec * 8.0)
    flux = np.diff(log, axis=0, prepend=log[:1])
    env = np.maximum(flux, 0).sum(axis=1)
    # subtract a moving average so quiet and loud passages are treated alike
    k = 24
    base = np.convolve(env, np.ones(k) / k, mode='same')
    env = np.maximum(env - base, 0)
    return env / (env.max() + 1e-9)


def estimate_tempo(env: np.ndarray, fps: float, lo=60.0, hi=190.0) -> float:
    env = env - env.mean()
    ac = np.correlate(env, env, 'full')[len(env) - 1:]
    ac /= (ac[0] + 1e-9)
    best, best_bpm = -1.0, 120.0
    for bpm in np.arange(lo, hi, 0.25):
        lag = 60.0 / bpm * fps
        i = int(round(lag))
        if i < 2 or i >= len(ac) - 1:
            continue
        # the lag itself plus its half, so a track that also accents the offbeat
        # is not mistaken for half the tempo
        score = ac[i] + 0.5 * ac[max(2, i // 2)]
        # people hear tempo around 120 BPM; weight the search that way, which is
        # what stops 120 from being reported as 60
        score *= float(np.exp(-0.5 * (np.log2(bpm / 120.0) / 0.85) ** 2))
        if score > best:
            best, best_bpm = score, float(bpm)
    return best_bpm


def beat_grid(env: np.ndarray, fps: float, bpm: float) -> np.ndarray:
    """Lay a grid at `bpm` and slide it to where the accents actually are."""
    period = 60.0 / bpm * fps
    best, best_phase = -1.0, 0.0
    for phase in np.arange(0, period, max(1.0, period / 48)):
        idx = np.round(np.arange(phase, len(env), period)).astype(int)
        idx = idx[idx < len(env)]
        score = float(env[idx].sum() / max(len(idx), 1))
        if score > best:
            best, best_phase = score, float(phase)
    beats = np.arange(best_phase, len(env), period) / fps
    return beats


def pick_onsets(env: np.ndarray, fps: float, min_gap: float = 0.11):
    peaks = []
    gap = int(min_gap * fps)
    thresh = env.mean() + 0.9 * env.std()
    i = 1
    while i < len(env) - 1:
        if env[i] > thresh and env[i] >= env[i - 1] and env[i] >= env[i + 1]:
            peaks.append((i / fps, float(env[i])))
            i += gap
        else:
            i += 1
    return peaks


def band_energy(spec: np.ndarray, sr: int, win: int):
    freqs = np.fft.rfftfreq(win, 1 / sr)
    bands = {'bass': (30, 160), 'mid': (160, 2000), 'high': (2000, 12000)}
    out = {}
    for name, (a, b) in bands.items():
        sel = (freqs >= a) & (freqs < b)
        e = spec[:, sel].sum(axis=1)
        e = e / (np.percentile(e, 98) + 1e-9)
        out[name] = np.clip(e, 0, 1.6)
    return out


def resample_curve(y: np.ndarray, src_fps: float, dst_fps: float, duration: float):
    n = int(duration * dst_fps)
    t_dst = np.arange(n) / dst_fps
    t_src = np.arange(len(y)) / src_fps
    return np.interp(t_dst, t_src, y)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--audio', required=True)
    ap.add_argument('--out', default=str(ROOT / 'scene' / 'beats.json'))
    ap.add_argument('--fps', type=float, default=30.0, help='fps of the exported curves')
    ap.add_argument('--bpm', type=float, default=0.0, help='force a tempo instead of detecting it')
    args = ap.parse_args()

    x, sr = load_audio(pathlib.Path(args.audio))
    duration = len(x) / sr
    hop, win = 512, 2048
    fps_an = sr / hop

    spec = spectrogram(x, sr, hop, win)
    env = onset_envelope(spec)
    bpm = args.bpm or estimate_tempo(env, fps_an)
    beats = beat_grid(env, fps_an, bpm)
    onsets = pick_onsets(env, fps_an)
    bands = band_energy(spec, sr, win)

    data = {
        'audio': pathlib.Path(args.audio).name,
        'duration': round(duration, 3),
        'bpm': round(bpm, 2),
        'fps': args.fps,
        'beats': [round(float(b), 4) for b in beats if b < duration],
        'onsets': [{'t': round(t, 4), 'v': round(v, 4)} for t, v in onsets if t < duration],
        'energy': {
            name: [round(float(v), 4) for v in resample_curve(curve, fps_an, args.fps, duration)]
            for name, curve in bands.items()
        },
    }
    pathlib.Path(args.out).write_text(json.dumps(data))
    print(f'{data["bpm"]:.1f} BPM · {len(data["beats"])} phách · {len(data["onsets"])} điểm nhấn '
          f'· {duration:.1f}s -> {args.out}')


if __name__ == '__main__':
    main()
