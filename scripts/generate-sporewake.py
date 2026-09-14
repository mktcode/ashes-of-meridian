#!/usr/bin/env python3
"""Sporewake: organic alien-forest listening draft.

Python standard library + local FFmpeg. All sounds are synthesized here; the
script reads no recordings or game assets and writes only 06-sporewake.mp3.
"""
from array import array
from functools import lru_cache
from math import exp, pi, sin, sqrt, tanh
from pathlib import Path
from random import Random
import json
import subprocess
import sys
import tempfile
import wave

SR = 32000
BPM = 108
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 36
DURATION = BARS * BAR + 3.2
TAU = 2 * pi
OUT = Path(__file__).resolve().parents[1] / 'music-drafts'


def run(args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', *args],
                          check=True, capture_output=True)


def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)


class Mix:
    def __init__(self):
        self.left = array('f', [0]) * round(DURATION * SR)
        self.right = self.left[:]

    def put(self, sample, time, gain=1, pan=0):
        start = round(time * SR)
        left = sqrt((1 - pan) / 2) * gain
        right = sqrt((1 + pan) / 2) * gain
        for i, value in enumerate(sample):
            position = start + i
            if position >= len(self.left):
                break
            if position >= 0:
                self.left[position] += value * left
                self.right[position] += value * right

    def write(self, path):
        peak = max(max(map(abs, self.left)), max(map(abs, self.right)))
        gain = .82 / max(peak, .001)
        pcm = array('h')
        for i, (left, right) in enumerate(zip(self.left, self.right)):
            fade = min(1, i / (SR * .02), (len(self.left) - i) / (SR * .9))
            pcm.extend((round(tanh(left * gain) * fade * 32767),
                        round(tanh(right * gain) * fade * 32767)))
        if sys.byteorder != 'little':
            pcm.byteswap()
        with wave.open(str(path), 'wb') as output:
            output.setparams((2, 2, SR, 0, 'NONE', 'not compressed'))
            output.writeframes(pcm.tobytes())


@lru_cache(maxsize=64)
def pod_drum(midi, length=.42, skin=0):
    """Pitch-bending membrane hit with a soft, fibrous attack."""
    hz = frequency(midi)
    rng = Random(6109 + midi * 97 + skin * 271)
    data = array('f')
    phase = low = 0.0
    for i in range(round(length * SR)):
        time = i / SR
        sweep = hz * (1 + 1.7 * exp(-time * 31))
        phase += TAU * sweep / SR
        noise = rng.uniform(-1, 1)
        low += .16 * (noise - low)
        fiber = (noise - low) * exp(-time * 48) * (.15 + skin * .025)
        body = sin(phase) + .18 * sin(phase * 1.49) * exp(-time * 12)
        envelope = min(1, time / .002, (length - time) / .045) * exp(-time * 7.5)
        data.append(tanh((body + fiber) * 1.25) * envelope)
    return data


@lru_cache(maxsize=16)
def root_click(flavor=0):
    """Dry woody/root percussion, avoiding a conventional hi-hat layer."""
    rng = Random(3191 + flavor * 307)
    length = .11
    data = array('f')
    low = 0.0
    for i in range(round(length * SR)):
        time = i / SR
        noise = rng.uniform(-1, 1)
        low += .10 * (noise - low)
        knock = sin(TAU * (640 + flavor * 43) * time) * exp(-time * 42)
        grain = (noise - low) * exp(-time * 75) * .28
        envelope = min(1, time / .0015, (length - time) / .018)
        data.append(tanh((knock + grain) * 1.3) * envelope)
    return data


@lru_cache(maxsize=64)
def pulse(midi, length=.46):
    """Short asymmetrical bass pulse, more biological than a held synth bass."""
    hz = frequency(midi)
    data = array('f')
    phase = low = 0.0
    for i in range(round(length * SR)):
        time = i / SR
        phase = (phase + hz / SR) % 1
        raw = sin(TAU * phase) + .23 * sin(TAU * phase * 2)
        raw += .10 * (2 * phase - 1)
        cutoff = 260 + 1050 * exp(-time * 12)
        low += (1 - exp(-TAU * cutoff / SR)) * (raw - low)
        envelope = min(1, time / .009, (length - time) / .055) * exp(-time * 3.8)
        data.append(tanh(low * 1.45) * envelope)
    return data


@lru_cache(maxsize=32)
def canopy(notes, length=3.0):
    """Slow additive bloom: open dyads and clusters that breathe, never chime."""
    data = array('f')
    phases = [0.0] * len(notes)
    for i in range(round(length * SR)):
        time = i / SR
        body = 0.0
        for j, midi in enumerate(notes):
            drift = 1 + .0009 * sin(TAU * (.17 + j * .037) * time + j)
            phases[j] += TAU * frequency(midi) * drift / SR
            body += (sin(phases[j]) + .07 * sin(phases[j] * 2)) / len(notes)
        envelope = sin(pi * min(1, time / length)) ** 1.4
        movement = .88 + .12 * sin(TAU * .31 * time)
        data.append(tanh(body * 1.15) * envelope * movement)
    return data


@lru_cache(maxsize=128)
def forest_call(start_midi, end_midi, length=.48):
    """Rounded formant call with a small continuous glide and no bell transient."""
    data = array('f')
    phase = low = 0.0
    start_hz, end_hz = frequency(start_midi), frequency(end_midi)
    for i in range(round(length * SR)):
        time = i / SR
        position = min(1, time / max(.001, length * .7))
        position = position * position * (3 - 2 * position)
        hz = start_hz * (end_hz / start_hz) ** position
        phase += TAU * hz / SR
        raw = sin(phase + .34 * sin(phase * 2)) + .11 * sin(phase * 3)
        low += .20 * (raw - low)
        envelope = min(1, time / .035, (length - time) / .11) * exp(-time * 1.35)
        tremolo = .92 + .08 * sin(TAU * 4.7 * time)
        data.append(tanh(low * .95) * envelope * tremolo)
    return data


@lru_cache(maxsize=32)
def spore_chirp(midi, flavor=0):
    """Tiny quiet bioluminescent accent; color, not a melodic bell part."""
    rng = Random(8803 + midi * 17 + flavor * 101)
    length = .17
    data = array('f')
    phase = 0.0
    for i in range(round(length * SR)):
        time = i / SR
        hz = frequency(midi) * (1 + .38 * time / length)
        phase += TAU * hz / SR
        breath = rng.uniform(-1, 1) * .035
        envelope = sin(pi * time / length) ** 1.8
        data.append((sin(phase) * .72 + breath) * envelope)
    return data


@lru_cache(maxsize=8)
def forest_breath(flavor=0, length=3.4):
    """Seeded band-limited air for the porous woodland transitions."""
    rng = Random(44021 + flavor * 809)
    data = array('f')
    low = slow = 0.0
    for i in range(round(length * SR)):
        time = i / SR
        noise = rng.uniform(-1, 1)
        low += .025 * (noise - low)
        slow += .0025 * (low - slow)
        band = low - slow
        envelope = sin(pi * time / length) ** 1.5
        data.append(tanh(band * 4.5) * envelope)
    return data


def arrangement():
    mix = Mix()
    # A symmetrical six-note habitat scale: C, D, E-flat, F-sharp, G, A.
    harmony = (
        (36, (60, 67, 74)),
        (39, (63, 70, 78)),
        (43, (55, 62, 68, 75)),
        (42, (54, 61, 67, 72)),
    )
    phrases = {
        12: ((0, 67, 69), (4, 72, 69), (8, 66, 67), (12, 63, 62)),
        14: ((0, 62, 63), (4, 66, 67), (8, 69, 72), (12, 67, 66)),
        20: ((0, 72, 69), (8, 67, 63)),
        22: ((0, 66, 62), (8, 63, 67)),
        26: ((0, 67, 69), (4, 72, 74), (8, 69, 67), (12, 63, 62)),
        30: ((0, 62, 66), (4, 67, 69), (8, 72, 69), (12, 66, 67)),
        34: ((0, 63, 62), (4, 66, 67), (8, 69, 72), (12, 67, 60)),
    }
    chirps = {6: (10, 81), 10: (14, 84), 18: (6, 78), 25: (10, 81),
              29: (14, 84), 33: (6, 78)}
    events = []

    def put(part, sample, bar, step, gain, pan=0):
        time = bar * BAR + step * BEAT / 4
        assert time + len(sample) / SR <= DURATION
        mix.put(sample, time, gain, pan)
        events.append((part, bar, step))

    for bar in range(BARS):
        root, chord = harmony[(bar // 2) % len(harmony)]
        intro = bar < 4
        clearing = 20 <= bar < 24
        full = not intro and not clearing

        if bar % 2 == 0:
            length = 3.8 if clearing else 3.0
            put('canopy', canopy(chord, length), bar, 0, .16 if intro else .20,
                -.12 if bar % 4 == 0 else .12)
        if bar in (16, 20, 28):
            put('breath', forest_breath(bar // 4), bar, 0, .11, -.35)
            put('breath', forest_breath(bar // 4 + 1), bar, 2, .08, .35)

        if full:
            for step in (0, 8):
                put('drums', pod_drum(35, .46, bar % 3), bar, step, .72)
            for step in (4, 12):
                put('drums', pod_drum(48, .30, 2), bar, step, .39, .08)
            if bar % 2:
                put('drums', pod_drum(38, .34, 1), bar, 14, .35, -.12)
            for step in (2, 6, 10, 14):
                if bar in phrases and step in (6, 14):
                    continue
                put('roots', root_click((bar + step) % 4), bar, step, .075,
                    -.28 if step in (2, 10) else .28)
        elif clearing:
            put('drums', pod_drum(35, .46, 0), bar, 0, .48)
            if bar % 2:
                put('roots', root_click(bar % 4), bar, 12, .055, .20)

        if bar >= 8 and not clearing:
            for step, interval in ((0, 0), (6, 7), (8, 0), (14, 6)):
                put('pulse', pulse(root + interval), bar, step, .30)

        if bar in phrases:
            for index, (step, start, end) in enumerate(phrases[bar]):
                length = .82 if clearing else .48
                put('call', forest_call(start, end, length), bar, step, .17,
                    -.30 if index % 2 == 0 else .30)

        if bar in chirps:
            step, note = chirps[bar]
            put('spore', spore_chirp(note, bar % 3), bar, step, .055,
                -.42 if bar % 2 else .42)

    put('canopy', canopy((48, 55, 62), 2.7), BARS, 0, .15)
    assert all(step % 2 == 0 for _, _, step in events)
    assert [(bar, step) for part, bar, step in events if part == 'breath'] == [
        (16, 0), (16, 2), (20, 0), (20, 2), (28, 0), (28, 2)]
    assert sum(part == 'spore' for part, _, _ in events) == 6
    assert not any(part in ('bell', 'guitar', 'speech') for part, _, _ in events)
    return mix, events


def main():
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='meridian-sporewake-') as directory:
        wav = Path(directory) / 'sporewake.wav'
        mix, events = arrangement()
        mix.write(wav)
        first = run(['-v', 'info', '-i', str(wav), '-af',
                     'loudnorm=I=-15:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
        report = first.stderr.decode()
        measured = json.loads(report[report.rfind('{'):report.rfind('}') + 1])
        normalization = ('loudnorm=I=-15:TP=-1.5:LRA=11:linear=true:'
                         f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
                         f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
                         f"offset={measured['target_offset']}")
        output = OUT / '06-sporewake.mp3'
        run(['-v', 'error', '-y', '-i', str(wav), '-af', normalization, '-ar', '44100',
             '-c:a', 'libmp3lame', '-b:a', '224k', '-metadata', 'title=Sporewake',
             '-metadata', 'artist=Ashes of Meridian - listening drafts', '-metadata', 'TBPM=108',
             '-metadata',
             'comment=Original alien-forest sketch; local synthesis, no samples, guitars or bells',
             str(output)])
        counts = {part: sum(event[0] == part for event in events)
                  for part in ('call', 'spore', 'canopy')}
        print(f'{output.relative_to(OUT.parent)}: {DURATION:.2f} s, {BPM} BPM; '
              f'{len(events)} eighth-grid events, {counts}', flush=True)


if __name__ == '__main__':
    main()
