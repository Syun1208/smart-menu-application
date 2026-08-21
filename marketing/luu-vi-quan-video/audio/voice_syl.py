#!/usr/bin/env python3
"""Vietnamese voice-over, built one syllable at a time so the tones are right.

The Piper voice we can run offline (`vi-25hours-single-low`, female, InfoRe)
drops every tone marker, and trying to find the syllable boundaries inside a
whole spoken line - so we can put the tones back - turned out to be the weak
link. So we never let it speak a whole line: each syllable is synthesised on its
own, which makes its boundaries exact by construction, and then

  1. its tone is read from the diacritics (NFD combining marks)
  2. TD-PSOLA reshapes its pitch onto that tone's real contour and stretches it
     to the length the tone wants (nặng short and clipped, ngã longer)
  3. syllables are laid down with word-level spacing, a phrase-level pitch
     declination and a small "sing" on the last syllable, then cross-faded

Finally the whole take is lifted a few percent in pitch and given a warm
broadcast EQ, which is what makes a voice read as light and sweet rather than
flat and administrative.

    python3 audio/voice_syl.py --model <piper .onnx> --out audio/voice.wav
    python3 audio/voice_syl.py --model ... --check      # print tone contours

The model is not in the repo (56 MB); download it once from
https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-vi-25hours-single-low.tar.gz
"""

from __future__ import annotations

import argparse
import io
import math
import pathlib
import unicodedata
import wave

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
SR_OUT = 44100

# --------------------------------------------------------------------------
# script
# --------------------------------------------------------------------------
LINES = [
    (0.35, 'Đói chưa?'),
    (1.20, 'Vài phút thôi, là có bữa ngon.'),
    (4.30, 'Nem chua Trần Công Châu.'),
    (6.20, 'Giòn rụm, nóng hổi.'),
    (7.60, 'Chỉ từ năm mươi nghìn.'),
    (10.30, 'Cá viên chiên sốt mắm tỏi.'),
    (12.30, 'Cay thấm đẫm, ăn là ghiền.'),
    (14.30, 'Com bo chỉ từ năm mươi nghìn.'),
    (16.40, 'Mì trộn cá viên.'),
    (17.80, 'Phô mai mozzarella kéo sợi.'),
    (20.10, 'Béo thơm, ngon khỏi bàn.'),
    (22.30, 'Trái cây cắt sẵn, tươi mới mỗi ngày.'),
    (25.00, 'Mát lành, thanh ngọt.'),
    (27.60, 'Gọi ngay, không chín bốn bảy.'),
    (29.30, 'Tám một năm, ba một sáu.'),
    (31.30, 'Lưu Vị Quán.'),
    (32.30, 'Vị ngon đáng lưu lại.'),
]

# --------------------------------------------------------------------------
# tones: pitch shape through the syllable, and how long it wants to be
# --------------------------------------------------------------------------
TONE_MARKS = {'̀': 'huyen', '́': 'sac', '̃': 'nga',
              '̉': 'hoi', '̣': 'nang'}

TONE = {
    #          pitch contour, sampled at 0 / 25 / 50 / 75 / 100 %      length  loud
    'ngang': ([1.00, 1.03, 1.04, 1.04, 1.03],                          1.00,   1.00),
    'huyen': ([0.92, 0.86, 0.80, 0.76, 0.75],                          1.05,   0.95),
    'sac':   ([0.97, 1.10, 1.26, 1.36, 1.36],                          0.95,   1.06),
    'hoi':   ([0.98, 0.88, 0.83, 0.92, 1.00],                          1.12,   0.97),
    'nga':   ([1.00, 0.90, 1.02, 1.30, 1.32],                          1.10,   1.03),
    'nang':  ([0.92, 0.83, 0.75, 0.72, 0.72],                          0.78,   1.02),
}


def tone_of(word: str) -> str:
    for ch in unicodedata.normalize('NFD', word):
        if ch in TONE_MARKS:
            return TONE_MARKS[ch]
    return 'ngang'


def parse_line(text: str):
    """-> [(syllable, pause_after_seconds)]"""
    out = []
    for raw in text.split():
        pause = 0.0
        if raw.endswith(','):
            pause = 0.13
        elif raw.endswith(('.', '!', '?')):
            pause = 0.22
        w = ''.join(c for c in unicodedata.normalize('NFC', raw)
                    if c.isalpha() or unicodedata.combining(c))
        if w:
            out.append((w, pause))
    return out


# --------------------------------------------------------------------------
# DSP
# --------------------------------------------------------------------------

def f0_track(x: np.ndarray, sr: int, hop: int, fmin=140.0, fmax=320.0):
    """Normalised cross-correlation pitch track, kept inside this speaker's range."""
    win = int(sr * 0.035)
    frames = max(1, (len(x) - win) // hop + 1)
    f0 = np.zeros(frames)
    lo, hi = int(sr / fmax), int(sr / fmin)
    for i in range(frames):
        seg = x[i * hop:i * hop + win]
        if len(seg) < win or np.max(np.abs(seg)) < 0.02:
            continue
        seg = seg - seg.mean()
        e0 = np.sqrt(np.sum(seg ** 2)) + 1e-9
        best, bestk = 0.0, 0
        for k in range(lo, min(hi, len(seg) - 1)):
            a, b = seg[:-k], seg[k:]
            r = float(np.dot(a, b) / (np.sqrt(np.sum(a ** 2) * np.sum(b ** 2)) + 1e-9))
            if r > best:
                best, bestk = r, k
        if best > 0.35 and bestk:
            f0[i] = sr / bestk
    voiced = f0 > 0
    if voiced.any():
        idx = np.arange(frames)
        f0 = np.interp(idx, idx[voiced], f0[voiced])
        # median smooth to kill the odd octave slip
        pad = np.pad(f0, 2, mode='edge')
        f0 = np.array([np.median(pad[i:i + 5]) for i in range(frames)])
    else:
        f0[:] = 200.0
    return f0, voiced


def psola(x: np.ndarray, sr: int, f0: np.ndarray, hop: int,
          pitch: np.ndarray, stretch: float = 1.0) -> np.ndarray:
    """TD-PSOLA: pitch x `pitch(t)`, duration x `stretch`."""
    n = len(x)
    if n < sr // 50:
        return x
    marks = []
    t = 0.0
    while t < n - 1:
        marks.append(int(t))
        t += sr / max(f0[min(len(f0) - 1, int(t / hop))], 80.0)
    if len(marks) < 3:
        return x
    marks = np.array(marks)

    n_out = int(n * stretch)
    out = np.zeros(n_out + int(sr * 0.05))
    tout = 0.0
    while tout < n_out:
        tin = tout / stretch                       # where we are in the source
        fi = min(len(f0) - 1, int(tin / hop))
        period_in = sr / max(f0[fi], 80.0)
        r = pitch[min(len(pitch) - 1, int(tin / hop))]
        m = int(marks[np.argmin(np.abs(marks - tin))])
        half = int(period_in)
        a0, a1 = max(0, m - half), min(n, m + half)
        if a1 - a0 < 8:
            tout += period_in
            continue
        grain = x[a0:a1] * np.hanning(a1 - a0)
        o0 = int(tout) - (m - a0)
        if o0 < 0:
            grain, o0 = grain[-o0:], 0
        o1 = min(len(out), o0 + len(grain))
        out[o0:o1] += grain[:o1 - o0]
        tout += period_in / max(r, 0.5)
    return out[:n_out]


def trim(x: np.ndarray, thresh: float = 0.012) -> np.ndarray:
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    return x[max(0, idx[0] - 120):min(len(x), idx[-1] + 240)]


def shape_syllable(x: np.ndarray, sr: int, tone: str, base: float, target_len: float):
    contour, len_mul, loud = TONE[tone]
    hop = 64
    f0, _ = f0_track(x, sr, hop)
    frames = len(f0)
    span = np.linspace(0, 1, frames)
    tgt = np.interp(span, np.linspace(0, 1, len(contour)), np.array(contour)) * base
    ratio = np.clip(tgt / np.maximum(f0, 80.0), 0.55, 1.9)
    k = np.hanning(5)
    ratio = np.convolve(ratio, k / k.sum(), mode='same')
    want = target_len * len_mul
    stretch = float(np.clip(want / (len(x) / sr), 0.62, 1.7))
    y = psola(x, sr, f0, hop, ratio, stretch)
    return y * loud


# --------------------------------------------------------------------------
# synthesis
# --------------------------------------------------------------------------

def synth(voice, text: str):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        voice.synthesize_wav(text, w)
    buf.seek(0)
    with wave.open(buf, 'rb') as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32768
    return x, sr


def speak_line(voice, text: str, sr_hint: int, base: float, syl_len: float, cache: dict):
    parts = parse_line(text)
    pieces = []
    n = len(parts)
    for i, (syl, pause) in enumerate(parts):
        if syl not in cache:
            cache[syl] = synth(voice, syl)
        raw, sr = cache[syl]
        raw = trim(raw)
        # phrase melody: start a touch high, drift down, lift the final syllable
        pos = i / max(1, n - 1)
        decl = 1.06 - 0.13 * pos
        if i == n - 1:
            decl *= 1.04
        y = shape_syllable(raw, sr, tone_of(syl), base * decl, syl_len)
        pieces.append((y, pause, sr))

    sr = pieces[0][2]
    xfade = int(0.018 * sr)
    total = sum(len(p) for p, _, _ in pieces) + int(sum(pa for _, pa, _ in pieces) * sr) + sr
    out = np.zeros(total)
    pos = 0
    for y, pause, _ in pieces:
        y = y.copy()
        f = min(xfade, len(y) // 3)
        y[:f] *= np.linspace(0, 1, f)
        y[-f:] *= np.linspace(1, 0, f)
        start = max(0, pos - f)
        out[start:start + len(y)] += y
        pos = start + len(y) + int(pause * sr)
    return trim(out, 0.004), sr


# --------------------------------------------------------------------------
# mastering
# --------------------------------------------------------------------------

def resample(x, sr_in, sr_out):
    n = int(len(x) * sr_out / sr_in)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)


def sweeten(x: np.ndarray, sr: int) -> np.ndarray:
    """Warm, light, close-mic'd - the sound of a friendly ad read."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / sr)
    g = np.ones_like(f)
    g *= 1 / (1 + (np.maximum(f, 1e-6) / 135.0) ** -3)        # high-pass rumble
    g *= 1 + 0.30 * np.exp(-((f - 260) / 180.0) ** 2)          # chest warmth
    g *= 1 - 0.22 * np.exp(-((f - 950) / 450.0) ** 2)          # scoop the boxiness
    g *= 1 + 0.65 * np.exp(-((f - 3400) / 1500.0) ** 2)        # presence / clarity
    g *= 1 + 0.35 * np.exp(-((f - 6200) / 1800.0) ** 2)        # air
    g *= 1 / (1 + (f / 7400.0) ** 6)                           # the model tops out at 8k
    x = np.fft.irfft(spec * g, len(x))

    # gentle de-ess: pull back the 5-7k band where it spikes
    hiss = np.fft.irfft(np.fft.rfft(x) * (1 / (1 + ((f - 6000) / 1200.0) ** 4)), len(x))
    env = np.convolve(np.abs(hiss), np.ones(int(sr * 0.006)) / int(sr * 0.006), mode='same')
    x -= hiss * np.clip((env - 0.05) * 6, 0, 0.6)

    # soft compression, then a hint of room so it is not bone dry
    e = np.convolve(np.abs(x), np.ones(int(sr * 0.015)) / int(sr * 0.015), mode='same')
    x = x / (1 + np.maximum(e - 0.14, 0) * 5.0)
    ir = np.zeros(int(sr * 0.16))
    ir[0] = 1.0
    idx = (np.arange(1, 26) * sr * 0.006).astype(int)
    ir[idx[idx < len(ir)]] = np.random.default_rng(7).normal(0, 0.10, len(idx[idx < len(ir)]))
    wet = np.convolve(x, ir)[:len(x)]
    x = x * 0.94 + wet * 0.06
    return x / (np.max(np.abs(x)) or 1.0) * 0.95


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--out', default=str(HERE / 'voice.wav'))
    ap.add_argument('--duration', type=float, default=34.0)
    ap.add_argument('--base', type=float, default=228.0, help='mid pitch in Hz')
    ap.add_argument('--syl', type=float, default=0.235, help='seconds per syllable')
    ap.add_argument('--check', action='store_true', help='print measured tone contours')
    args = ap.parse_args()

    from piper import PiperVoice
    voice = PiperVoice.load(args.model)
    cache: dict[str, tuple[np.ndarray, int]] = {}

    if args.check:
        text = 'ma mà má mả mã mạ'
        for syl, _ in parse_line(text):
            raw, sr = synth(voice, syl)
            y = shape_syllable(trim(raw), sr, tone_of(syl), args.base, args.syl)
            f0, _ = f0_track(y, sr, 64)
            n = len(f0)
            print(f'  {syl:4s} {tone_of(syl):6s} '
                  f'start {f0[max(0,n//8)]:5.0f}  mid {f0[n//2]:5.0f}  end {f0[-max(1,n//8)]:5.0f} Hz')
        return

    track = np.zeros(int((args.duration + 2) * SR_OUT))
    for start, text in LINES:
        y, sr = speak_line(voice, text, 16000, args.base, args.syl, cache)
        up = sweeten(resample(y, sr, SR_OUT), SR_OUT)
        i = int(start * SR_OUT)
        n = min(len(up), len(track) - i)
        env = np.ones(n)
        f = min(int(0.012 * SR_OUT), n // 2)
        env[:f] = np.linspace(0, 1, f)
        env[-f:] = np.linspace(1, 0, f)
        track[i:i + n] += up[:n] * env
        print(f'{start:6.2f}s  {n / SR_OUT:4.2f}s  {text}')

    track /= (np.max(np.abs(track)) or 1.0) / 0.95
    pcm = (np.clip(track[:int(args.duration * SR_OUT)], -1, 1) * 32767).astype('<i2')
    with wave.open(args.out, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR_OUT)
        w.writeframes(pcm.tobytes())
    print(f'\nWrote {args.out}')


if __name__ == '__main__':
    main()
