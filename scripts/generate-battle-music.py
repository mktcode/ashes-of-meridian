#!/usr/bin/env python3
"""Generate Ashes of Meridian's original looping battlefield score.

Requires Python 3 and ffmpeg. The generated OGG is a maintained source asset;
this script is not part of npm build or browser runtime.
"""

from array import array
from math import exp, pi, sin, sqrt, tanh
from pathlib import Path
from random import Random
import subprocess
import tempfile
import wave

SAMPLE_RATE = 44_100
BPM = 128
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 32
DURATION = BAR * BARS  # exactly 60 seconds
SAMPLES = round(DURATION * SAMPLE_RATE)
TAU = 2 * pi
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "audio" / "music-battlefield.ogg"

left = array("f", [0.0]) * SAMPLES
right = array("f", [0.0]) * SAMPLES


def pan_gains(pan):
    angle = (max(-1, min(1, pan)) + 1) * pi / 4
    return sqrt(2) * 0.5 * sin(pi / 2 - angle), sqrt(2) * 0.5 * sin(angle)


def add_tone(start, duration, frequency, volume, pan=0, voice="pulse", attack=0.004, release=0.12):
    first = round(start * SAMPLE_RATE) % SAMPLES
    count = round(duration * SAMPLE_RATE)
    if count <= 0:
        return
    lg, rg = pan_gains(pan)
    phase = 0.0
    step = frequency / SAMPLE_RATE
    for j in range(count):
        t = j / SAMPLE_RATE
        phase = (phase + step) % 1.0
        if voice == "bass":
            raw = tanh(1.7 * (sin(TAU * phase) + 0.48 * sin(TAU * phase * 2) + 0.22 * sin(TAU * phase * 3)))
        elif voice == "alarm":
            raw = 0.72 * sin(TAU * phase) + 0.2 * sin(TAU * phase * 2.01) + 0.08 * sin(TAU * phase * 5.03)
        elif voice == "metal":
            raw = 0.5 * sin(TAU * phase) + 0.3 * sin(TAU * phase * 1.607) + 0.2 * sin(TAU * phase * 2.413)
        else:
            raw = sin(TAU * phase) + 0.32 * sin(TAU * phase * 2) + 0.14 * sin(TAU * phase * 4)
        rise = min(1.0, t / max(attack, 1 / SAMPLE_RATE))
        fall = min(1.0, (duration - t) / max(release, 1 / SAMPLE_RATE))
        envelope = rise * fall
        sample = raw * envelope * volume
        index = (first + j) % SAMPLES
        left[index] += sample * lg
        right[index] += sample * rg


def add_kick(start, volume=0.72):
    duration = 0.42
    first = round(start * SAMPLE_RATE) % SAMPLES
    count = round(duration * SAMPLE_RATE)
    phase = 0.0
    rng = Random(0xA0C0 + first)
    for j in range(max(0, count)):
        t = j / SAMPLE_RATE
        frequency = 42 + 92 * exp(-t * 24)
        phase += frequency / SAMPLE_RATE
        body = sin(TAU * phase) * exp(-t * 10.5)
        click = (rng.random() * 2 - 1) * exp(-t * 95) * min(1, t / 0.002) * 0.24
        sample = (body + click) * volume
        index = (first + j) % SAMPLES
        left[index] += sample * 0.72
        right[index] += sample * 0.72


def add_noise(start, duration, volume, pan=0, color="high", seed=1, shape="decay"):
    first = round(start * SAMPLE_RATE) % SAMPLES
    count = round(duration * SAMPLE_RATE)
    rng = Random(seed)
    lg, rg = pan_gains(pan)
    low = previous = 0.0
    for j in range(max(0, count)):
        t = j / SAMPLE_RATE
        white = rng.random() * 2 - 1
        low += (white - low) * (0.035 if color == "low" else 0.18)
        if color == "high":
            value = white - low
        elif color == "band":
            value = low - previous
            previous += (low - previous) * 0.012
        else:
            value = low
        if shape == "rise":
            envelope = (t / duration) ** 1.7
        elif shape == "flat":
            envelope = min(1, t / 0.06, (duration - t) / 0.06)
        else:
            envelope = exp(-t * (18 if duration < 0.2 else 7))
        sample = value * envelope * volume
        index = (first + j) % SAMPLES
        left[index] += sample * lg
        right[index] += sample * rg


def add_snare(start, volume=0.32, seed=1):
    add_noise(start, 0.28, volume, -0.08, "high", seed)
    add_tone(start, 0.18, 176, volume * 0.38, 0.08, "metal", 0.001, 0.15)


def add_clang(start, pan, seed):
    base = 310 + (seed % 5) * 37
    add_tone(start, 0.46, base, 0.11, pan, "metal", 0.001, 0.42)
    add_noise(start, 0.15, 0.055, pan, "band", seed)


# A continuous, pitch-quantized machinery bed starts and ends at zero phase.
def add_bed():
    rng = Random(0x4D455249)
    frequencies = [36.7, 55.05, 73.4, 110.1]
    for frequency, volume, pan in zip(frequencies, [0.045, 0.022, 0.014, 0.009], [-0.2, 0.22, -0.48, 0.5]):
        cycles = round(frequency * DURATION)
        exact = cycles / DURATION
        lg, rg = pan_gains(pan)
        for i in range(SAMPLES):
            t = i / SAMPLE_RATE
            edge = min(1, t / 0.04, (DURATION - t) / 0.04)
            tremolo = 0.76 + 0.24 * sin(TAU * (t / (BAR * 4)) + pan)
            value = sin(TAU * exact * t) + 0.18 * sin(TAU * exact * 2 * t)
            sample = value * volume * edge * tremolo
            left[i] += sample * lg
            right[i] += sample * rg
    low_l = low_r = 0.0
    for i in range(SAMPLES):
        t = i / SAMPLE_RATE
        edge = min(1, t / 0.08, (DURATION - t) / 0.08)
        low_l += ((rng.random() * 2 - 1) - low_l) * 0.006
        low_r += ((rng.random() * 2 - 1) - low_r) * 0.006
        pulse = 0.55 + 0.45 * (0.5 + 0.5 * sin(TAU * t / (BAR * 2)))
        left[i] += low_l * 0.032 * edge * pulse
        right[i] += low_r * 0.032 * edge * pulse


add_bed()
roots = [36.708, 36.708, 29.135, 32.703, 36.708, 43.654, 32.703, 36.708]
bass_offsets = [0, 0, 12, 0, 7, 0, 0, 12, 10, 7, 0, 3]
bass_steps = [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]
pulse_offsets = [12, 19, 15, 12, 22, 19, 15, 10, 12, 19, 24, 22, 15, 19, 10, 12]

for bar in range(BARS):
    start = bar * BAR
    root = roots[bar % len(roots)]
    section = bar // 4
    intensity = 0.86 if section in (0, 7) else 1.0 if section in (1, 2, 3) else 1.12

    # Slow harmonic weight connects the battle cue to the menu's dark atmosphere.
    add_tone(start, BAR * 0.96, root * 2, 0.032, -0.28, "alarm", 0.16, 0.5)
    add_tone(start + BEAT * 0.5, BAR * 0.78, root * 3, 0.018, 0.34, "pulse", 0.2, 0.55)

    for index, step in enumerate(bass_steps):
        offset = bass_offsets[index]
        frequency = root * 2 * (2 ** (offset / 12))
        accent = 1.16 if step in (0, 8) else 1
        add_tone(start + step * BEAT / 4, BEAT * 0.38, frequency, 0.105 * intensity * accent, -0.08, "bass", 0.002, 0.08)

    kick_steps = [0, 7, 8, 11, 14] if bar % 2 == 0 else [0, 6, 8, 10, 15]
    if 16 <= bar < 20:
        kick_steps = [0, 8, 14]
    for step in kick_steps:
        add_kick(start + step * BEAT / 4, 0.62 * intensity)
    for step in (4, 12):
        add_snare(start + step * BEAT / 4, 0.29 * intensity, bar * 31 + step)

    hat_spacing = 1 if 20 <= bar < 28 else 2
    for step in range(0, 16, hat_spacing):
        swing = 0.012 if step % 2 else 0
        accent = 1.35 if step % 4 == 0 else 0.72
        add_noise(start + step * BEAT / 4 + swing, 0.065, 0.065 * accent * intensity,
                  -0.52 if step % 4 else 0.48, "high", bar * 97 + step)

    if 8 <= bar < 16 or 20 <= bar < 28:
        for step, offset in enumerate(pulse_offsets):
            if step in (3, 7, 11, 15) and bar % 2:
                continue
            frequency = root * 2 * (2 ** (offset / 12))
            add_tone(start + step * BEAT / 4, BEAT * 0.2, frequency, 0.031 * intensity,
                     -0.42 if step % 2 else 0.42, "pulse", 0.002, 0.055)

    if bar % 2 == 1:
        add_clang(start + BEAT * (2.72 if bar % 4 == 1 else 3.45), 0.58 if bar % 4 == 1 else -0.58, bar)

    # Sparse original two-part command signal, absent from the opening loop section.
    if bar in (10, 14, 22, 26):
        motif = [(0.5, 12), (1.25, 15), (2.0, 19), (2.75, 10), (3.2, 12)]
        for beat_offset, semitones in motif:
            add_tone(start + beat_offset * BEAT, BEAT * 0.42,
                     root * 4 * (2 ** (semitones / 12)), 0.045, 0.18, "alarm", 0.012, 0.12)

    if bar in (7, 15, 19, 27):
        add_noise(start + BAR - BEAT, BEAT, 0.12, 0, "band", 5000 + bar, "rise")

# Remove the tiny stochastic DC component, then rotate to a quiet zero crossing.
# Circular event writes make the new end and start adjacent points in the score.
mean_left = sum(left) / SAMPLES
mean_right = sum(right) / SAMPLES
for i in range(SAMPLES):
    left[i] -= mean_left
    right[i] -= mean_right
search_start = round(0.15 * SAMPLE_RATE)
search_end = round(BAR * SAMPLE_RATE)
seam = min(range(search_start, search_end), key=lambda i: (
    left[i - 1] ** 2 + right[i - 1] ** 2 + left[i] ** 2 + right[i] ** 2
))
left = left[seam:] + left[:seam]
right = right[seam:] + right[:seam]

# Keep transients firm while leaving headroom for battlefield effects.
peak = max(max(abs(v) for v in left), max(abs(v) for v in right))
scale = 0.86 / peak
pcm = array("h")
for l, r in zip(left, right):
    pcm.append(round(max(-1, min(1, tanh(l * scale * 1.18))) * 32767))
    pcm.append(round(max(-1, min(1, tanh(r * scale * 1.18))) * 32767))

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix="meridian-music-") as directory:
    wav_path = Path(directory) / "battlefield.wav"
    with wave.open(str(wav_path), "wb") as target:
        target.setnchannels(2)
        target.setsampwidth(2)
        target.setframerate(SAMPLE_RATE)
        target.writeframes(pcm.tobytes())
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
        "-c:a", "libvorbis", "-q:a", "6",
        "-metadata", "title=Frontier Pressure", "-metadata", "artist=Ashes of Meridian",
        "-metadata", "comment=Original procedural battlefield score",
        str(OUTPUT)
    ], check=True)

print(f"Wrote {OUTPUT.relative_to(ROOT)} ({DURATION:.1f}s, {BPM} BPM)")
