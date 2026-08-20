#!/usr/bin/env python3
"""Sound design for the Lưu Vị Quán promo.

Everything is synthesised from scratch with numpy - an upbeat 120 BPM bed plus a
foley layer (sizzle, pops, cheese stretch, dings, whooshes) whose hit times come
from the very same timeline.js the animation uses, so picture and sound lock.

    python3 audio/soundtrack.py [--out audio/soundtrack.wav]
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import wave

import numpy as np

SR = 44100
HERE = pathlib.Path(__file__).resolve().parent
RNG = np.random.default_rng(20240815)   # fixed seed -> identical track every run


# ---------------------------------------------------------------------------
# small DSP helpers
# ---------------------------------------------------------------------------

def t_axis(dur: float) -> np.ndarray:
    return np.arange(int(dur * SR)) / SR


def env_exp(n: int, attack: float = 0.002, decay: float = 0.3, power: float = 1.0) -> np.ndarray:
    """Percussive attack/decay envelope."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-5), 0, 1)
    d = np.exp(-t / max(decay, 1e-5)) ** power
    return a * d


def env_adsr(n: int, a=0.01, d=0.08, s=0.7, r=0.2) -> np.ndarray:
    t = np.arange(n) / SR
    total = t[-1] if n else 0
    out = np.ones(n) * s
    out = np.where(t < a, t / max(a, 1e-6), out)
    dec = (t >= a) & (t < a + d)
    out = np.where(dec, 1 + (s - 1) * (t - a) / max(d, 1e-6), out)
    rel = t > max(total - r, 0)
    out = np.where(rel, np.clip(s * (total - t) / max(r, 1e-6), 0, s), out)
    return np.clip(out, 0, 1)


def fft_filter(x: np.ndarray, low: float = 0.0, high: float = SR / 2, slope: float = 0.35) -> np.ndarray:
    """Zero-phase band filter with soft edges - fast and good enough for foley."""
    n = len(x)
    if n == 0:
        return x
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    mask = np.ones_like(freqs)
    if low > 0:
        mask *= 1 / (1 + (np.maximum(freqs, 1e-6) / low) ** (-2 / max(slope, 0.05)))
    if high < SR / 2:
        mask *= 1 / (1 + (freqs / high) ** (2 / max(slope, 0.05)))
    return np.fft.irfft(spec * mask, n)


def sweep_filter(x: np.ndarray, f_start: float, f_end: float, mode: str = 'band', width: float = 2.2,
                 blocks: int = 48) -> np.ndarray:
    """Time-varying filter: overlap-add block-wise FFT filtering with a log sweep."""
    n = len(x)
    if n < blocks * 8:
        return x
    hop = n // blocks
    win = hop * 2
    window = np.hanning(win)
    out = np.zeros(n + win)
    norm = np.zeros(n + win)
    for b in range(blocks + 1):
        start = b * hop
        seg = np.zeros(win)
        s1 = min(n, start + win)
        if s1 <= start:
            break
        seg[:s1 - start] = x[start:s1]
        p = b / blocks
        f = f_start * (f_end / max(f_start, 1e-6)) ** p
        seg = seg * window
        if mode == 'band':
            seg = fft_filter(seg, low=f / width, high=f * width)
        elif mode == 'low':
            seg = fft_filter(seg, high=f)
        else:
            seg = fft_filter(seg, low=f)
        out[start:start + win] += seg
        norm[start:start + win] += window
    return (out / np.maximum(norm, 1e-6))[:n]


def noise(n: int) -> np.ndarray:
    return RNG.standard_normal(n)


def sine(freq, n: int, phase: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    if np.isscalar(freq):
        return np.sin(2 * math.pi * freq * t + phase)
    return np.sin(2 * math.pi * np.cumsum(np.asarray(freq)) / SR + phase)


def saw(freq, n: int) -> np.ndarray:
    t = np.arange(n) / SR
    ph = (freq * t) % 1.0 if np.isscalar(freq) else (np.cumsum(freq) / SR) % 1.0
    return 2 * ph - 1


def soft_clip(x: np.ndarray, drive: float = 1.0) -> np.ndarray:
    return np.tanh(x * drive) / np.tanh(drive)


def reverb_ir(seconds: float = 1.1, decay: float = 4.5, damp: float = 4200.0) -> np.ndarray:
    n = int(seconds * SR)
    ir = noise(n) * np.exp(-np.arange(n) / SR * decay)
    ir = fft_filter(ir, high=damp)
    ir[:int(0.008 * SR)] *= np.linspace(0, 1, int(0.008 * SR))   # tame the pre-delay click
    return ir / (np.max(np.abs(ir)) + 1e-9)


def convolve(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    n = len(x) + len(ir) - 1
    size = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    return y


class Track:
    """A stereo buffer you can drop sounds into at absolute times."""

    def __init__(self, duration: float):
        self.n = int(duration * SR)
        self.buf = np.zeros((self.n, 2))

    def add(self, sound: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0):
        start = int(at * SR)
        if start >= self.n:
            return
        if sound.ndim == 1:
            sound = np.stack([sound, sound], axis=1)
        end = min(self.n, start + len(sound))
        seg = sound[:end - max(start, 0)]
        left = math.cos((pan + 1) * math.pi / 4)
        right = math.sin((pan + 1) * math.pi / 4)
        if start < 0:
            seg = seg[-start:]
            start = 0
        self.buf[start:start + len(seg), 0] += seg[:, 0] * gain * left * 1.41
        self.buf[start:start + len(seg), 1] += seg[:, 1] * gain * right * 1.41


# ---------------------------------------------------------------------------
# instruments
# ---------------------------------------------------------------------------

def kick(punch: float = 1.0) -> np.ndarray:
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    freq = 46 + 115 * np.exp(-t * 33)
    body = np.sin(2 * math.pi * np.cumsum(freq) / SR) * env_exp(n, 0.001, 0.16)
    click = noise(n) * env_exp(n, 0.0005, 0.008) * 0.35
    return soft_clip(body * 1.15 * punch + click, 1.6)


def snare(bright: float = 1.0) -> np.ndarray:
    n = int(0.3 * SR)
    body = sine(185, n) * env_exp(n, 0.001, 0.055) * 0.5
    hiss = fft_filter(noise(n), low=1500 * bright, high=9000) * env_exp(n, 0.001, 0.11)
    return soft_clip(body + hiss * 0.85, 1.3)


def clap() -> np.ndarray:
    n = int(0.34 * SR)
    out = np.zeros(n)
    for i, delay in enumerate((0.0, 0.011, 0.022, 0.034)):
        d = int(delay * SR)
        burst = fft_filter(noise(n - d), low=1100, high=6500) * env_exp(n - d, 0.0008, 0.035 + i * 0.02)
        out[d:] += burst * (1.0 - i * 0.18)
    return out * 0.6


def hat(open_: bool = False) -> np.ndarray:
    n = int((0.19 if open_ else 0.07) * SR)
    return fft_filter(noise(n), low=5200, high=11500) * env_exp(n, 0.0004, 0.05 if open_ else 0.018) * 0.5


def bell(freq: float, dur: float = 1.2, bright: float = 1.0) -> np.ndarray:
    """FM-ish bell used for the dings, chimes and sparkles."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * math.pi * freq * 2.76 * t) * np.exp(-t * 6) * 2.4 * bright
    tone = np.sin(2 * math.pi * freq * t + mod)
    tone += 0.4 * np.sin(2 * math.pi * freq * 2.01 * t) * np.exp(-t * 5)
    return tone * env_exp(n, 0.002, dur * 0.32)


def marimba(freq: float, dur: float = 0.5) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    tone = (np.sin(2 * math.pi * freq * t)
            + 0.35 * np.sin(2 * math.pi * freq * 4 * t) * np.exp(-t * 22)
            + 0.18 * np.sin(2 * math.pi * freq * 9.2 * t) * np.exp(-t * 30))
    return tone * env_exp(n, 0.003, dur * 0.28)


def pluck(freq: float, dur: float = 0.42) -> np.ndarray:
    """Karplus-Strong-ish pluck for the bright lead."""
    n = int(dur * SR)
    tone = saw(freq, n) * 0.6 + sine(freq * 2, n) * 0.2
    tone = fft_filter(tone, high=freq * 7)
    return tone * env_exp(n, 0.004, dur * 0.3)


def bass(freq: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    tone = saw(freq, n) * 0.6 + sine(freq, n) * 0.8 + saw(freq * 1.005, n) * 0.25
    tone = fft_filter(tone, high=freq * 5.5)
    return tone * env_adsr(n, 0.006, 0.09, 0.72, min(0.12, dur * 0.4)) * 0.9


def pad(freqs, dur: float) -> np.ndarray:
    n = int(dur * SR)
    out = np.zeros(n)
    for f in freqs:
        for detune in (-6, 0, 7):
            out += saw(f * (1 + detune / 10000.0), n) * 0.16
    out = fft_filter(out, high=2400)
    return out * env_adsr(n, 0.25, 0.3, 0.8, 0.5)


# ---------------------------------------------------------------------------
# foley / SFX - one generator per cue type used in timeline.js
# ---------------------------------------------------------------------------

def sfx_riser(dur: float = 1.9) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    air = sweep_filter(noise(n), 420, 7200, mode='band', width=2.6, blocks=64)
    tone = np.sin(2 * math.pi * np.cumsum(180 * (2 ** (t / dur * 2.6))) / SR) * 0.35
    swell = (t / dur) ** 2.1
    body = (air * 0.9 + tone) * swell
    body[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    return body * 0.7


def sfx_impact() -> np.ndarray:
    n = int(1.5 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * math.pi * np.cumsum(38 + 90 * np.exp(-t * 12)) / SR) * env_exp(n, 0.001, 0.42)
    thud = fft_filter(noise(n), high=900) * env_exp(n, 0.001, 0.16) * 0.6
    tail = fft_filter(noise(n), low=200, high=3000) * env_exp(n, 0.01, 0.5) * 0.12
    return soft_clip(boom * 1.2 + thud + tail, 1.4)


def sfx_whoosh() -> np.ndarray:
    n = int(0.75 * SR)
    t = np.arange(n) / SR
    body = sweep_filter(noise(n), 600, 4800, mode='band', width=2.4, blocks=48)
    shape = np.sin(np.pi * np.clip(t / (n / SR), 0, 1)) ** 1.6
    return body * shape * 0.75


def sfx_sizzle(dur: float = 2.4) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    fry = fft_filter(noise(n), low=2200, high=9500)
    # crackle: random amplitude bursts riding on the hiss
    crackle = np.zeros(n)
    for _ in range(int(dur * 55)):
        pos = int(RNG.uniform(0, n - 900))
        ln = int(RNG.uniform(120, 700))
        crackle[pos:pos + ln] += noise(ln) * np.exp(-np.arange(ln) / (ln * 0.35)) * RNG.uniform(0.3, 1.0)
    crackle = fft_filter(crackle, low=1800, high=11000)
    shape = np.clip(t / 0.25, 0, 1) * np.clip((dur - t) / 0.5, 0, 1)
    return (fry * 0.35 + crackle * 0.6) * shape * 0.3


def sfx_crunch() -> np.ndarray:
    n = int(0.32 * SR)
    out = np.zeros(n)
    for _ in range(7):
        pos = int(RNG.uniform(0, n * 0.45))
        ln = int(RNG.uniform(400, 1800))
        ln = min(ln, n - pos)
        out[pos:pos + ln] += noise(ln) * env_exp(ln, 0.0005, 0.02) * RNG.uniform(0.5, 1.0)
    return fft_filter(out, low=900, high=8000) * 0.45


def sfx_pop() -> np.ndarray:
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    freq = 640 * np.exp(-t * 26) + 130
    body = np.sin(2 * math.pi * np.cumsum(freq) / SR) * env_exp(n, 0.0006, 0.05)
    click = fft_filter(noise(n), low=1800, high=7000) * env_exp(n, 0.0003, 0.006) * 0.4
    return (body + click) * 0.8


def mix(*parts: np.ndarray) -> np.ndarray:
    """Sum signals of different lengths."""
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out


def sfx_ding() -> np.ndarray:
    return mix(bell(1568, 1.1) * 0.6, bell(2349, 0.9, 0.8) * 0.3) * 0.7


def sfx_sparkle() -> np.ndarray:
    n = int(1.4 * SR)
    out = np.zeros(n)
    scale = [1568, 1760, 2093, 2637, 3136, 3520]
    for i in range(9):
        at = int(RNG.uniform(0, 0.55) * SR)
        f = scale[min(len(scale) - 1, int(RNG.uniform(0, len(scale))))]
        b = bell(f, 0.9, 1.2) * RNG.uniform(0.25, 0.6)
        end = min(n, at + len(b))
        out[at:end] += b[:end - at]
    return out * 0.55


def sfx_chime() -> np.ndarray:
    n = int(2.2 * SR)
    out = np.zeros(n)
    for i, f in enumerate((1046, 1318, 1568, 2093)):
        at = int(i * 0.085 * SR)
        b = bell(f, 1.8 - i * 0.15, 1.1) * (0.55 - i * 0.06)
        end = min(n, at + len(b))
        out[at:end] += b[:end - at]
    return out * 0.7


def sfx_bell() -> np.ndarray:
    """Bright two-stroke bell - the 'order now' attention grabber."""
    n = int(2.4 * SR)
    out = np.zeros(n)
    for at in (0.0, 0.22):
        b = mix(bell(1244, 2.0, 1.3) * 0.5, bell(1864, 1.4, 1.0) * 0.25)
        i = int(at * SR)
        end = min(n, i + len(b))
        out[i:end] += b[:end - i]
    return out * 0.75


def sfx_stretch(dur: float = 1.4) -> np.ndarray:
    """Cheese pull: a slow, gooey upward glide."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    tone = np.sin(2 * math.pi * np.cumsum(220 * (1 + p * 1.6)) / SR)
    tone += 0.4 * np.sin(2 * math.pi * np.cumsum(330 * (1 + p * 1.6)) / SR)
    gooey = fft_filter(noise(n), low=300, high=1800) * 0.25 * (0.4 + p)
    shape = np.sin(np.pi * np.clip(p, 0, 1)) ** 1.2
    return fft_filter((tone * 0.35 + gooey) * shape, high=3200) * 0.6


def sfx_pour(dur: float = 1.4) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    stream = fft_filter(noise(n), low=300, high=2600)
    wobble = 0.7 + 0.3 * np.sin(2 * math.pi * 6.5 * t + np.sin(2 * math.pi * 2.1 * t))
    bubbles = np.zeros(n)
    for _ in range(int(dur * 14)):
        at = int(RNG.uniform(0, n - 3000))
        ln = int(RNG.uniform(700, 2400))
        f0 = RNG.uniform(300, 900)
        bt = np.arange(ln) / SR
        bubbles[at:at + ln] += np.sin(2 * math.pi * np.cumsum(f0 * (1 + 2.2 * bt / (ln / SR))) / SR) \
            * env_exp(ln, 0.001, 0.03) * RNG.uniform(0.2, 0.5)
    shape = np.clip(t / 0.15, 0, 1) * np.clip((dur - t) / 0.35, 0, 1)
    return (stream * wobble * 0.35 + bubbles * 0.5) * shape * 0.7


def sfx_slurp(dur: float = 1.0) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    body = sweep_filter(noise(n), 2600, 420, mode='band', width=1.9, blocks=40)
    tone = np.sin(2 * math.pi * np.cumsum(520 * (1 - 0.55 * p)) / SR) * 0.25
    shape = np.sin(np.pi * np.clip(p, 0, 1)) ** 1.4
    return (body * 0.7 + tone) * shape * 0.6


def sfx_splash() -> np.ndarray:
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    burst = fft_filter(noise(n), low=700, high=8000) * env_exp(n, 0.001, 0.09)
    drops = np.zeros(n)
    for _ in range(8):
        at = int(RNG.uniform(0.05, 0.6) * SR)
        ln = int(0.12 * SR)
        dt = np.arange(ln) / SR
        drops[at:at + ln] += np.sin(2 * math.pi * np.cumsum(RNG.uniform(700, 1800) * (1 + 3 * dt)) / SR) \
            * env_exp(ln, 0.001, 0.02) * 0.35
    return (burst + drops) * 0.75


SFX = {
    'riser': lambda dur=1.9: sfx_riser(dur),
    'impact': lambda dur=None: sfx_impact(),
    'whoosh': lambda dur=None: sfx_whoosh(),
    'sizzle': lambda dur=2.4: sfx_sizzle(dur),
    'crunch': lambda dur=None: sfx_crunch(),
    'pop': lambda dur=None: sfx_pop(),
    'ding': lambda dur=None: sfx_ding(),
    'sparkle': lambda dur=None: sfx_sparkle(),
    'chime': lambda dur=None: sfx_chime(),
    'bell': lambda dur=None: sfx_bell(),
    'stretch': lambda dur=1.4: sfx_stretch(dur),
    'pour': lambda dur=1.4: sfx_pour(dur),
    'slurp': lambda dur=1.0: sfx_slurp(dur),
    'splash': lambda dur=None: sfx_splash(),
}


# ---------------------------------------------------------------------------
# arrangement
# ---------------------------------------------------------------------------

NOTE = {
    'C2': 65.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'C3': 130.81, 'E3': 164.81,
    'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63,
    'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25,
    'G5': 783.99, 'A5': 880.00,
}

# One bar per chord, looping: C - G - Am - F (bright, hopeful, very "street food ad")
PROGRESSION = [
    {'root': NOTE['C3'], 'triad': [NOTE['C4'], NOTE['E4'], NOTE['G4']]},
    {'root': NOTE['G2'], 'triad': [NOTE['G3'], NOTE['D4'], NOTE['E4']]},
    {'root': NOTE['A2'], 'triad': [NOTE['A3'], NOTE['C4'], NOTE['E4']]},
    {'root': NOTE['F2'], 'triad': [NOTE['F3'], NOTE['A3'], NOTE['C4']]},
]

# Pentatonic hook, in beats-from-bar-start with note names.
LEAD_PHRASES = [
    [(0.0, 'G4'), (0.5, 'A4'), (1.0, 'C5'), (1.5, 'A4'), (2.5, 'G4'), (3.0, 'E4')],
    [(0.0, 'C5'), (0.5, 'D5'), (1.5, 'E5'), (2.0, 'D5'), (3.0, 'C5')],
    [(0.0, 'A4'), (0.5, 'C5'), (1.0, 'E5'), (2.0, 'D5'), (2.5, 'C5'), (3.0, 'A4')],
    [(0.0, 'G4'), (1.0, 'A4'), (1.5, 'G4'), (2.0, 'E4'), (3.0, 'C5'), (3.5, 'D5')],
]


def build_music(track: Track, cfg: dict) -> np.ndarray:
    """Drums, bass, pad and lead. Returns the kick times for sidechain pumping."""
    beat = 60.0 / cfg['VIDEO']['bpm']
    bar = beat * 4
    music_start = cfg['MUSIC']['main']['start']
    music_end = cfg['MUSIC']['outro']['end'] - 1.5
    kick_times = []

    bar_index = 0
    t = 0.0
    while t < music_end:
        chord = PROGRESSION[bar_index % len(PROGRESSION)]
        drums_on = t >= music_start - 0.001
        lift = t >= cfg['MUSIC']['outro']['start']         # final chorus
        intro = t < music_start

        # --- pad: present from the very first bar, quiet under the riser -----
        track.add(pad(chord['triad'], bar * 1.02), t, gain=0.09 if intro else 0.12)

        if drums_on:
            for b in range(4):
                bt = t + b * beat
                # kick: 1 and 3, with a pickup before the turnaround
                if b in (0, 2):
                    track.add(kick(1.0), bt, gain=1.05)
                    kick_times.append(bt)
                if b == 3 and bar_index % 4 == 3:
                    track.add(kick(0.8), bt + beat * 0.5, gain=0.75)
                    kick_times.append(bt + beat * 0.5)
                # clap on the backbeat
                if b in (1, 3):
                    track.add(clap(), bt, gain=0.3)
                    track.add(snare(0.9), bt, gain=0.09)
                # hats on eighths, offbeats accented
                track.add(hat(False), bt, gain=0.09, pan=-0.15)
                track.add(hat(b == 3), bt + beat * 0.5, gain=0.14, pan=0.2)

                # bass: root pulse with a fifth on the last eighth of the bar
                f = chord['root']
                track.add(bass(f, beat * 0.9), bt, gain=0.6)
                if b == 3:
                    track.add(bass(f * 1.5, beat * 0.45), bt + beat * 0.5, gain=0.45)

            # --- lead hook ---------------------------------------------------
            if t >= 4.0:
                phrase = LEAD_PHRASES[bar_index % len(LEAD_PHRASES)]
                for pos, name in phrase:
                    at = t + pos * beat
                    track.add(marimba(NOTE[name], 0.55), at, gain=0.24, pan=0.12)
                    track.add(pluck(NOTE[name], 0.4), at, gain=0.09, pan=-0.1)
                    if lift:   # octave doubling for the call-to-action chorus
                        track.add(marimba(NOTE[name] * 2, 0.4), at, gain=0.09, pan=-0.2)

        t += bar
        bar_index += 1

    return kick_times


def sidechain(buf: np.ndarray, kick_times, depth: float = 0.26, release: float = 0.16) -> np.ndarray:
    """Classic pumping so the beat breathes under the voice-of-god foley."""
    n = len(buf)
    gain = np.ones(n)
    t = np.arange(n) / SR
    for kt in kick_times:
        i = int(kt * SR)
        if i >= n:
            continue
        seg = slice(i, min(n, i + int(release * 4 * SR)))
        local = t[seg] - kt
        gain[seg] = np.minimum(gain[seg], 1 - depth * np.exp(-local / release))
    return buf * gain[:, None]


def build_sfx(track: Track, cfg: dict):
    for cue in cfg['CUES']:
        maker = SFX.get(cue['type'])
        if maker is None:
            print(f"  ! unknown cue type: {cue['type']}")
            continue
        sound = maker(cue['dur']) if 'dur' in cue and cue['dur'] else maker()
        pan = {'whoosh': -0.35, 'sparkle': 0.3, 'ding': 0.18, 'chime': -0.2}.get(cue['type'], 0.0)
        track.add(sound, cue['t'], gain=cue.get('gain', 1.0) * 0.5, pan=pan)


def master(music: np.ndarray, sfx: np.ndarray, duration: float, cfg: dict) -> np.ndarray:
    ir = reverb_ir(1.0, 4.2, 4000)
    wet = np.stack([convolve(sfx[:, 0], ir), convolve(sfx[:, 1], ir)], axis=1)
    bus = music * 0.9 + sfx * 1.0 + wet * 0.12

    # master EQ: shave the top-end hiss, keep the kick weighty
    bus = np.stack([fft_filter(bus[:, 0], high=13000), fft_filter(bus[:, 1], high=13000)], axis=1)

    # gentle bus compression + limiting
    bus = soft_clip(bus * 0.9, 0.8)
    peak = np.max(np.abs(bus))
    if peak > 0:
        bus = bus / peak * 0.89

    n = len(bus)
    t = np.arange(n) / SR
    fade_in = np.clip(t / 0.08, 0, 1)
    fo = cfg['MUSIC']['fadeOut']
    fade_out = np.clip((duration - t) / max(duration - fo['start'], 0.1), 0, 1) ** 1.4
    return bus * (fade_in * fade_out)[:, None]


def write_wav(path: pathlib.Path, audio: np.ndarray):
    data = np.clip(audio, -1, 1)
    pcm = (data * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(HERE / 'soundtrack.wav'))
    ap.add_argument('--timeline', default=str(HERE / 'timeline.json'))
    args = ap.parse_args()

    cfg = json.loads(pathlib.Path(args.timeline).read_text())
    duration = cfg['VIDEO']['duration']
    print(f"Scoring {duration}s at {cfg['VIDEO']['bpm']} BPM, {len(cfg['CUES'])} foley cues")

    music_track = Track(duration + 2)
    kicks = build_music(music_track, cfg)
    music = sidechain(music_track.buf, kicks)

    sfx_track = Track(duration + 2)
    build_sfx(sfx_track, cfg)

    n = int(duration * SR)
    out = master(music[:n], sfx_track.buf[:n], duration, cfg)
    write_wav(pathlib.Path(args.out), out)
    print(f"Wrote {args.out} ({len(out) / SR:.2f}s, peak {np.max(np.abs(out)):.2f})")


if __name__ == '__main__':
    main()
