#!/usr/bin/env python3
"""Vietnamese voice-over for the promo.

Reads the script below, speaks it with the Piper `vi-25hours-single-low` voice
(female, ~200 Hz, InfoRe dataset), lays every line on its timeline position and
masters it like a radio ad. The result drops straight into the soundtrack:

    python3 audio/voice.py --model <piper .onnx> --out audio/voice.wav
    python3 audio/soundtrack.py --voice audio/voice.wav      # music ducks under it

KNOWN LIMITATION - read before shipping this voice to customers. That model's
phoneme table has no tone markers, so espeak's tone digits are dropped and every
syllable comes out on a flat pitch. In Vietnamese a missing tone is not an
accent, it is a different word. `--retone` attempts to rebuild the contours by
hand (tone from the diacritics -> TD-PSOLA pitch reshaping) but the pitch
tracking and syllable segmentation are not reliable enough on 16 kHz vocoder
output, so it is OFF by default and should be treated as an experiment.

For a voice-over that a customer should hear, record a real person (a phone
voice memo is enough) or use a tone-correct Vietnamese TTS (CapCut, Vbee,
FPT.AI, Zalo), then hand the file to soundtrack.py --voice: everything else in
the pipeline stays the same.

The model is not in the repo (56 MB); download it once from
https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-vi-25hours-single-low.tar.gz
"""

from __future__ import annotations

import argparse
import json
import pathlib
import unicodedata
import wave

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
SR_OUT = 44100

# --------------------------------------------------------------------------
# the script: what she says, and the second she starts saying it
# --------------------------------------------------------------------------
LINES = [
    (0.35, 'Đói chưa?'),
    (1.15, 'Vài phút thôi là có bữa ngon.'),
    (4.30, 'Nem chua Trần Công Châu, giòn rụm, nóng hổi.'),
    (7.10, 'Chỉ từ năm mươi nghìn một chục.'),
    (10.30, 'Cá viên chiên sốt mắm tỏi, cay thấm đẫm.'),
    (13.10, 'Com bo chỉ từ năm mươi nghìn.'),
    (16.30, 'Mì trộn cá viên, phô mai kéo sợi.'),
    (19.40, 'Ăn là ghiền.'),
    (22.30, 'Trái cây cắt sẵn, tươi mới mỗi ngày.'),
    (25.20, 'Mát lành, thanh ngọt.'),
    (27.60, 'Gọi ngay, không chín bốn bảy, tám một năm, ba một sáu.'),
    (31.00, 'Lưu Vị Quán. Vị ngon đáng lưu lại.'),
]

# --------------------------------------------------------------------------
# tones
# --------------------------------------------------------------------------
TONE_MARKS = {
    '̀': 'huyen',   # à
    '́': 'sac',     # á
    '̃': 'nga',     # ã
    '̉': 'hoi',     # ả
    '̣': 'nang',    # ạ
}

# Pitch multiplier through the syllable, relative to the speaker's own level.
TONE_CONTOUR = {
    'ngang': [1.00, 1.02, 1.02, 1.00],
    'huyen': [0.90, 0.85, 0.80, 0.76],
    'sac':   [0.98, 1.06, 1.20, 1.32],
    'hoi':   [0.96, 0.86, 0.84, 0.98],
    'nga':   [0.98, 0.88, 1.02, 1.28],
    'nang':  [0.88, 0.82, 0.76, 0.74],
}


def syllable_tone(word: str) -> str:
    for ch in unicodedata.normalize('NFD', word):
        if ch in TONE_MARKS:
            return TONE_MARKS[ch]
    return 'ngang'


def syllables(text: str) -> list[str]:
    out = []
    for raw in text.split():
        w = ''.join(c for c in raw if c.isalpha() or unicodedata.combining(c))
        if w:
            out.append(w)
    return out


# --------------------------------------------------------------------------
# pitch analysis / TD-PSOLA
# --------------------------------------------------------------------------

def track_f0(x: np.ndarray, sr: int, hop: int = 80, fmin: float = 80, fmax: float = 400):
    """Autocorrelation pitch track. Returns (f0 per hop, voiced flag per hop)."""
    win = int(sr * 0.040)
    n = len(x)
    frames = max(1, (n - win) // hop + 1)
    f0 = np.zeros(frames)
    voiced = np.zeros(frames, bool)
    lo, hi = int(sr / fmax), int(sr / fmin)
    for i in range(frames):
        seg = x[i * hop: i * hop + win]
        if len(seg) < win or np.max(np.abs(seg)) < 0.02:
            continue
        seg = seg - seg.mean()
        seg = seg * np.hanning(len(seg))
        ac = np.correlate(seg, seg, 'full')[len(seg) - 1:]
        ac = ac / (ac[0] + 1e-12)
        k = int(np.argmax(ac[lo:hi])) + lo
        if ac[k] > 0.30:
            f0[i] = sr / k
            voiced[i] = True
    # fill unvoiced gaps so the pitch curve is continuous
    if voiced.any():
        idx = np.arange(frames)
        f0 = np.interp(idx, idx[voiced], f0[voiced])
    else:
        f0[:] = 200.0
    return f0, voiced


def voiced_blobs(voiced: np.ndarray, energy: np.ndarray, want: int) -> list[tuple[int, int]]:
    """Split the line into `want` syllable spans (in hop units)."""
    blobs = []
    start = None
    for i, v in enumerate(voiced):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= 3:
                blobs.append((start, i))
            start = None
    if start is not None and len(voiced) - start >= 3:
        blobs.append((start, len(voiced)))
    if not blobs:
        return [(0, len(voiced))] * want

    # too few blobs: split the longest ones at their quietest point
    while len(blobs) < want:
        j = int(np.argmax([b - a for a, b in blobs]))
        a, b = blobs[j]
        if b - a < 8:
            break
        mid = a + 4 + int(np.argmin(energy[a + 4:b - 4])) if b - a > 10 else (a + b) // 2
        blobs[j:j + 1] = [(a, mid), (mid, b)]
    # too many: merge the shortest neighbours
    while len(blobs) > want:
        lens = [b - a for a, b in blobs]
        j = int(np.argmin(lens))
        k = j - 1 if j > 0 and (j == len(blobs) - 1 or lens[j - 1] <= lens[j + 1]) else j + 1
        lo, hi = min(j, k), max(j, k)
        blobs[lo:hi + 1] = [(blobs[lo][0], blobs[hi][1])]
    return blobs


def psola_pitch(x: np.ndarray, sr: int, f0: np.ndarray, ratio: np.ndarray, hop: int) -> np.ndarray:
    """Time-domain PSOLA: change pitch by `ratio(t)`, keep the duration."""
    n = len(x)
    out = np.zeros(n + sr)
    # analysis marks, one per source period
    marks = []
    t = 0.0
    while t < n - 1:
        marks.append(int(t))
        fi = min(len(f0) - 1, int(t / hop))
        t += sr / max(f0[fi], 60.0)
    if len(marks) < 3:
        return x
    marks = np.array(marks)

    t = float(marks[0])
    while t < n - 1:
        fi = min(len(f0) - 1, int(t / hop))
        period_in = sr / max(f0[fi], 60.0)
        r = ratio[min(len(ratio) - 1, int(t / hop))]
        # nearest analysis mark to this output position
        m = int(marks[np.argmin(np.abs(marks - t))])
        half = int(period_in)
        a0, a1 = max(0, m - half), min(n, m + half)
        grain = x[a0:a1] * np.hanning(a1 - a0)
        o0 = int(t) - (m - a0)
        if o0 < 0:
            grain = grain[-o0:]
            o0 = 0
        out[o0:o0 + len(grain)] += grain
        t += period_in / max(r, 0.4)
    return out[:n]


def retone(x: np.ndarray, sr: int, text: str) -> np.ndarray:
    syls = syllables(text)
    if not syls:
        return x
    hop = 80
    f0, voiced = track_f0(x, sr, hop=hop)
    frames = len(f0)
    energy = np.array([np.sqrt(np.mean(x[i * hop:i * hop + 320] ** 2) + 1e-9)
                       for i in range(frames)])
    spans = voiced_blobs(voiced, energy, len(syls))

    base = float(np.median(f0[voiced])) if voiced.any() else 200.0
    ratio = np.ones(frames)
    for (a, b), syl in zip(spans, syls):
        contour = np.array(TONE_CONTOUR[syllable_tone(syl)])
        span = np.linspace(0, 1, b - a)
        target = np.interp(span, np.linspace(0, 1, len(contour)), contour) * base
        ratio[a:b] = target / np.maximum(f0[a:b], 60.0)
    # smooth the ratio so syllable joins do not click
    k = np.hanning(7)
    ratio = np.convolve(ratio, k / k.sum(), mode='same')
    ratio[ratio < 0.5] = 0.5
    return psola_pitch(x, sr, f0, ratio, hop)


# --------------------------------------------------------------------------
# synthesis + mastering
# --------------------------------------------------------------------------

def synth_line(voice, text: str) -> tuple[np.ndarray, int]:
    import io
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        voice.synthesize_wav(text, w)
    buf.seek(0)
    with wave.open(buf, 'rb') as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32768
    return x, sr


def resample(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    n_out = int(len(x) * sr_out / sr_in)
    return np.interp(np.linspace(0, len(x) - 1, n_out), np.arange(len(x)), x)


def voice_eq(x: np.ndarray, sr: int) -> np.ndarray:
    """Radio-ad treatment: high-pass, presence lift, soft compression."""
    spec = np.fft.rfft(x)
    freq = np.fft.rfftfreq(len(x), 1 / sr)
    gain = np.ones_like(freq)
    gain *= 1 / (1 + (np.maximum(freq, 1e-6) / 120.0) ** -3)          # high-pass
    gain *= 1 + 0.55 * np.exp(-((freq - 3200) / 1600.0) ** 2)          # presence
    gain *= 1 + 0.25 * np.exp(-((freq - 700) / 400.0) ** 2)            # body
    gain *= 1 / (1 + (freq / 7600.0) ** 4)                             # tame the 16k hiss
    x = np.fft.irfft(spec * gain, len(x))

    env = np.abs(x)
    k = int(sr * 0.02)
    env = np.convolve(env, np.ones(k) / k, mode='same')
    comp = 1 / (1 + np.maximum(env - 0.16, 0) * 4.5)
    x = x * comp
    peak = np.max(np.abs(x)) or 1.0
    return x / peak * 0.92


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True, help='piper vi .onnx model')
    ap.add_argument('--out', default=str(HERE / 'voice.wav'))
    ap.add_argument('--duration', type=float, default=34.0)
    ap.add_argument('--report', default='')
    ap.add_argument('--retone', action='store_true',
                    help='experimental: rebuild the tone contours (see the module docstring)')
    args = ap.parse_args()

    from piper import PiperVoice
    voice = PiperVoice.load(args.model)

    track = np.zeros(int((args.duration + 2) * SR_OUT))
    report = []
    for start, text in LINES:
        raw, sr = synth_line(voice, text)
        fixed = retone(raw, sr, text) if args.retone else raw
        up = resample(fixed, sr, SR_OUT)
        up = voice_eq(up, SR_OUT)
        i = int(start * SR_OUT)
        n = min(len(up), len(track) - i)
        fade = np.ones(n)
        f = min(int(0.01 * SR_OUT), n // 2)
        fade[:f] = np.linspace(0, 1, f)
        fade[-f:] = np.linspace(1, 0, f)
        track[i:i + n] += up[:n] * fade
        report.append({'t': start, 'text': text, 'dur': round(len(up) / SR_OUT, 2)})
        print(f'{start:6.2f}s  {len(up)/SR_OUT:4.2f}s  {text}')

    peak = np.max(np.abs(track)) or 1.0
    track = track / peak * 0.95
    pcm = (np.clip(track[:int(args.duration * SR_OUT)], -1, 1) * 32767).astype('<i2')
    with wave.open(args.out, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR_OUT)
        w.writeframes(pcm.tobytes())
    print(f'\nWrote {args.out}')

    if args.report:
        pathlib.Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
