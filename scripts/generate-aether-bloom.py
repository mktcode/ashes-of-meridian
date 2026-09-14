#!/usr/bin/env python3
"""Aether Bloom: bright, guitar-free electronic listening sketch.

Requires Python 3 and local FFmpeg. It reads no recordings or game assets and
writes only music-drafts/05-aether-bloom.mp3.
"""
from array import array
from functools import lru_cache
from math import exp, pi, sin, sqrt, tanh
from pathlib import Path
import json
import runpy
import sys
import tempfile
import wave

SOUNDS = runpy.run_path(str(Path(__file__).with_name('generate-music-drafts.py')))
SR, drum, frequency, run = (SOUNDS[key] for key in ('SR', 'drum', 'frequency', 'run'))
BPM = 122
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 36
DURATION = BARS * BAR + 3.2
TAU = pi * 2
OUT = Path(__file__).resolve().parents[1] / 'music-drafts'


class Mix:
    def __init__(self):
        self.left = array('f', [0]) * round(DURATION * SR)
        self.right = self.left[:]

    def put(self, sample, time, gain=1, pan=0):
        start = round(time * SR)
        left, right = sqrt((1 - pan) / 2) * gain, sqrt((1 + pan) / 2) * gain
        for i, value in enumerate(sample):
            position = start + i
            if position < 0:
                continue
            if position >= len(self.left):
                break
            self.left[position] += value * left
            self.right[position] += value * right

    def write(self, path):
        peak = max(max(map(abs, self.left)), max(map(abs, self.right)))
        gain = .84 / max(peak, .001)
        pcm = array('h')
        for i, (left, right) in enumerate(zip(self.left, self.right)):
            fade = min(1, i / (SR * .012), (len(self.left) - i) / (SR * .8))
            pcm.extend((round(tanh(left * gain) * fade * 32767),
                        round(tanh(right * gain) * fade * 32767)))
        if sys.byteorder != 'little':
            pcm.byteswap()
        with wave.open(str(path), 'wb') as output:
            output.setparams((2, 2, SR, 0, 'NONE', 'not compressed'))
            output.writeframes(pcm.tobytes())


@lru_cache(maxsize=128)
def bell(midi, length=.52):
    """A clear FM glass tone with a short, non-pad decay."""
    hz = frequency(midi)
    data = array('f')
    for i in range(round(length * SR)):
        time = i / SR
        modulation = 1.7 * exp(-time * 10) * sin(TAU * hz * 3.49 * time)
        body = sin(TAU * hz * time + modulation)
        body += .12 * sin(TAU * hz * 6.02 * time) * exp(-time * 14)
        body += .04 * sin(TAU * hz * 9.01 * time) * exp(-time * 24)
        envelope = min(1, time / .003, (length - time) / .06) * exp(-time * 3.7)
        data.append(tanh(body * 1.15) * envelope)
    return data


@lru_cache(maxsize=128)
def keys(midi, length=.34):
    """Rounded electric-key click; deliberately unlike the draft guitars."""
    hz = frequency(midi)
    data = array('f')
    low = 0.0
    for i in range(round(length * SR)):
        time = i / SR
        phase = TAU * hz * time
        raw = sin(phase) + .34 * sin(phase * 2) + .16 * sin(phase * 3.01)
        low += .24 * (raw - low)
        click = sin(TAU * 2100 * time) * exp(-time * 55) * .12
        envelope = min(1, time / .004, (length - time) / .035) * exp(-time * 5.8)
        data.append(tanh((low + click) * 1.3) * envelope)
    return data


@lru_cache(maxsize=64)
def bass_note(midi, length=.42):
    """A light, percussive sine bass: punctuation rather than a low drone."""
    hz = frequency(midi)
    data = array('f')
    for i in range(round(length * SR)):
        time = i / SR
        tone = sin(TAU * hz * time) + .17 * sin(TAU * hz * 2 * time)
        envelope = min(1, time / .006, (length - time) / .045) * exp(-time * 5.2)
        data.append(tanh(tone * 1.25) * envelope)
    return data


def arrangement():
    mix = Mix()
    # Two bars per chord make the D-Lydian progression easy to follow.
    harmony = (
        (50, (62, 66, 69)),  # D major
        (52, (64, 68, 71)),  # E major, with the bright Lydian G-sharp
        (47, (59, 62, 66)),  # B minor
        (45, (57, 61, 64)),  # A major
    )
    lead_phrases = (
        ((0, 74), (4, 76), (8, 78), (12, 81)),
        ((0, 76), (4, 78), (8, 80), (12, 83)),
        ((0, 73), (4, 76), (8, 78), (12, 81)),
        ((0, 69), (4, 73), (8, 76), (12, 78)),
    )
    lead_bars = (12, 20, 24, 32)
    events = []

    def put(part, sample, bar, step, gain, pan=0):
        time = bar * BAR + step * BEAT / 4
        assert time + len(sample) / SR <= DURATION
        mix.put(sample, time, gain, pan)
        events.append((part, bar, step))

    for bar in range(BARS):
        root, chord = harmony[(bar // 2) % len(harmony)]
        intro = bar < 4
        bridge = 16 <= bar < 20
        air = 28 <= bar < 32
        finale = bar >= 32
        rhythmic = not intro and not bridge and not air
        bass_active = bar >= 8 and not air

        # Complete chord stabs land on strong eighth-note positions. Keeping the
        # chord for two bars avoids the restless, apparently off-grid movement.
        chord_steps = (0,) if intro or bridge or air else (0, 8)
        for step in chord_steps:
            for note, pan in zip(chord, (-.25, 0, .25)):
                put('keys', keys(note), bar, step, .105 if intro else .13, pan)

        # Four compact statements replace the previous near-continuous chimes.
        if bar in lead_bars:
            for step, note in lead_phrases[lead_bars.index(bar)]:
                put('bell', bell(note), bar, step, .135, -.14 if step in (0, 8) else .14)
        elif intro and bar in (1, 3):
            put('bell', bell(78 if bar == 1 else 80, .62), bar, 8, .105, .12)
        elif bar == 30:
            for step, note in ((0, 76), (8, 78), (12, 81)):
                put('bell', bell(note, .62), bar, step, .10, (step - 6) / 24)

        if rhythmic:
            # Kick, snare, hats and bass now share an unambiguous eighth grid.
            for step in (0, 6, 8, 14):
                put('drums', drum('kick', 7), bar, step, .69 if step else .82)
            for step in (4, 12):
                put('drums', drum('snare', 7), bar, step, .42, .04)
            for step in range(2, 16, 2):
                if finale and step in (10, 14):
                    continue
                put('drums', drum('hat', 7), bar, step, .06, -.22 if step % 4 else .22)
        elif bridge:
            put('drums', drum('kick', 7), bar, 0, .62)
            put('drums', drum('snare', 7), bar, 12, .34)

        if bass_active:
            for step, interval in ((0, 0), (6, 7), (8, 0), (14, 7)):
                if bridge and step in (6, 14):
                    continue
                put('bass', bass_note(root + interval), bar, step, .255)

    # A restrained final tone resolves with the chord rather than another high peal.
    put('bell', bell(78, 1.25), BARS, 0, .10, .10)
    bell_count = sum(part == 'bell' for part, _, _ in events)
    assert bell_count <= 22
    assert not any(part == 'guitar' for part, _, _ in events)
    assert all(step % 2 == 0 for _, _, step in events)
    return mix, events


def main():
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='meridian-aether-bloom-') as directory:
        wav = Path(directory) / 'aether-bloom.wav'
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
        output = OUT / '05-aether-bloom.mp3'
        run(['-v', 'error', '-y', '-i', str(wav), '-af', normalization, '-ar', '44100',
             '-c:a', 'libmp3lame', '-b:a', '224k', '-metadata', 'title=Aether Bloom',
             '-metadata', 'artist=Ashes of Meridian - listening drafts', '-metadata', 'TBPM=122',
             '-metadata', 'comment=Original bright electronic sketch; glass FM, keys and no guitar',
             str(output)])
        print(f'{output.relative_to(OUT.parent)}: {DURATION:.2f} s, {BPM} BPM; '
              f'{len(events)} eighth-grid events, {sum(e[0] == "bell" for e in events)} bell notes, no guitar',
              flush=True)


if __name__ == '__main__':
    main()
