#!/usr/bin/env python3
"""Last Light Relay: sparse 96-BPM industrial dub, listening draft only.

Python standard library + local FFmpeg/Flite. Reuses original drum/radio
constructors, never reads recordings or changes the three game tracks.
"""
from array import array
from functools import lru_cache
from math import exp, pi, sin, tanh
from pathlib import Path
from random import Random
import json
import runpy
import tempfile

SOUNDS = runpy.run_path(str(Path(__file__).with_name('generate-music-drafts.py')))
SR, OUT, run = (SOUNDS[k] for k in ('SR', 'OUT', 'run'))
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 32
DURATION = BARS * BAR + 2.8
TAU = 2 * pi


class Mix(SOUNDS['Mix']):
    # The inherited sample mixer and WAV writer use the same sample rate;
    # only this arrangement's buffer duration differs from the 116-BPM drafts.
    def __init__(self):
        self.left = array('f', [0]) * round(DURATION * SR)
        self.right = self.left[:]


@lru_cache(maxsize=32)
def sub(midi, duration=.85):
    """Round, slightly overdriven sub with harmonics audible on small speakers."""
    hz = SOUNDS['frequency'](midi)
    data = array('f')
    for i in range(round(duration * SR)):
        t = i / SR
        phase = TAU * hz * t
        body = sin(phase) + .27 * sin(phase * 2) + .12 * sin(phase * 3)
        env = min(1, t / .009, (duration - t) / .065) * exp(-t * 1.7)
        data.append(tanh(body * 1.3) * env)
    return data


@lru_cache(maxsize=32)
def signal(midi, duration=.68):
    """A lonely reed/radio oscillator: soft attack, tape-like pitch wander."""
    hz = SOUNDS['frequency'](midi)
    data = array('f')
    phase = low = 0.0
    for i in range(round(duration * SR)):
        t = i / SR
        detune = .055 * sin(TAU * 3.7 * t) + .09 * exp(-t * 18)
        phase += TAU * hz * 2 ** (detune / 12) / SR
        raw = sin(phase + .3 * sin(phase * 2) * exp(-t * 4))
        raw += .19 * sin(phase * 3) + .055 * sin(phase * 5)
        low += .18 * (raw - low)
        env = min(1, t / .035, (duration - t) / .12) * exp(-t * 1.8)
        data.append(tanh(low * 1.2) * env)
    return data


@lru_cache(maxsize=16)
def chord(root):
    """Short minor/major ninth organ stab, not a sustained pad or guitar."""
    third = 4 if root in (31, 36) else 3
    notes = [SOUNDS['frequency'](root + n) for n in (24, 24 + third, 31, 38)]
    duration = .48
    data = array('f')
    low = 0.0
    for i in range(round(duration * SR)):
        t = i / SR
        raw = sum(sin(TAU * hz * t) + .23 * sin(TAU * hz * 2 * t)
                  for hz in notes) / 4
        low += .12 * (raw - low)
        env = min(1, t / .006, (duration - t) / .05) * exp(-t * 6)
        data.append(tanh(low * 2.5) * env)
    return data


def rim():
    """Woody, low snare/rim hybrid, one clear halftime backbeat."""
    rng = Random(4417)
    data = array('f')
    low = 0.0
    duration = .29
    for i in range(round(duration * SR)):
        t = i / SR
        noise = rng.uniform(-1, 1)
        low += .28 * (noise - low)
        body = (.65 * sin(TAU * 187 * t) + .3 * sin(TAU * 421 * t)
                + .18 * sin(TAU * 973 * t)) * exp(-t * 36)
        skin = (.35 * (noise - low) + .2 * low) * exp(-t * 22)
        env = min(1, t / .0008, (duration - t) / .025)
        data.append(tanh((body + skin) * 1.7) * env)
    return SOUNDS['normalized'](data)


def tape(sample):
    """Darker, softer echo copy; dry voices retain their existing processing."""
    data = array('f')
    low = 0.0
    for value in sample:
        low += .13 * (value - low)
        data.append(tanh(low * 1.1) / 1.1)
    return data


def arrangement():
    mix, events = Mix(), []

    def put(part, sample, step, gain, pan=0):
        time = step * BEAT / 4
        assert time >= 0 and time + len(sample) / SR <= DURATION
        mix.put(sample, time, gain, pan)
        events.append((part, time, time + len(sample) / SR))

    def echo(part, sample, step, gain, spacing, pan=0):
        put(part, sample, step, gain, pan)
        reflected = tape(sample)
        put(part, reflected, step + spacing, gain * .22, -.58)
        put(part, reflected, step + spacing * 2, gain * .075, .58)

    kick, backbeat = SOUNDS['drum']('kick', 2), rim()
    voices = {12: SOUNDS['speech']('We are still here'),
              22: SOUNDS['speech']('Follow the signal'),
              30: SOUNDS['speech']('See you at dawn')}
    melody = {8: ((0, 7), (6, 3), (12, 0), (22, 2)),
              10: ((0, 7), (8, 10), (16, 7), (22, 3)),
              18: ((0, 7), (6, 3), (12, 0), (22, 2)),
              20: ((0, 10), (8, 7), (16, 5), (22, 2)),
              26: ((0, 7), (6, 4), (12, 0), (22, 2)),
              28: ((0, 7), (8, 3), (16, 2), (22, 12))}
    stab_bars = (4, 5, 6, 7, 14, 15, 24, 25)
    for bar in range(BARS):
        start = bar * 16
        root = (33, 33, 33, 36, 38, 38, 31, 33)[bar // 4]
        # Two bars of drums alone; no hats, fills or extra percussion layers.
        if bar not in (16, 17):
            put('drums', kick, start, .90)
            put('drums', kick, start + (10 if bar % 2 == 0 else 14), .64)
            put('drums', backbeat, start + 8, .69)
        if bar >= 2:
            put('bass', sub(root), start, .44)
            if bar % 2 == 0 and bar not in (16, 30):
                put('bass', sub(root, .65), start + 10, .34)
        if bar in stab_bars:
            # Stab + two quarter-note echoes fit wholly inside their bar.
            echo('chord', chord(root), start + 4, .25, 4, -.12)
        if bar in melody:
            for step, interval in melody[bar]:
                echo('signal', signal(root + 24 + interval), start + step, .19, 2, .12)
        if bar == 16:
            # Five-second drum dropout: a small signal answers the bare bass.
            echo('signal', signal(62, .9), start + 4, .12, 4)
            echo('signal', signal(64, .9), start + 20, .11, 4)
        if bar in voices:
            voice = voices[bar]
            fragment = voice[:round(.115 * SR)]
            put('radio', fragment, start + 2, .15, -.2)
            put('radio', fragment, start + 4, .12, .2)
            echo('radio', voice, start + 6, .24, 4, -.12)

    # Resolve the last phrase instead of abruptly cutting the playback draft.
    put('drums', kick, BARS * 16, .70)
    put('bass', sub(33, 1.5), BARS * 16, .38)
    echo('signal', signal(57, .9), BARS * 16, .14, 4)

    # Preserve the spacious arrangement, including audible echo/voice tails.
    leads = [e for e in events if e[0] in ('chord', 'signal', 'radio')]
    for i, (part, start, end) in enumerate(leads):
        for other, a, b in leads[i + 1:]:
            assert part == other or end <= a or b <= start, 'competing lead parts'
    assert all(part == 'drums' for part, start, _ in events if start < BAR * 2)
    assert all(abs(start / (BEAT / 4) - round(start / (BEAT / 4))) < 1e-8
               for _, start, _ in events)
    return mix, events


def main():
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='meridian-last-light-') as directory:
        wav = Path(directory) / 'last-light.wav'
        mix, events = arrangement()
        mix.write(wav)
        del mix
        first = run(['-v', 'info', '-i', str(wav), '-af',
                     'loudnorm=I=-15:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'])
        report = first.stderr.decode()
        measured = json.loads(report[report.rfind('{'):report.rfind('}') + 1])
        norm = ('loudnorm=I=-15:TP=-2:LRA=11:linear=true:'
                f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
                f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
                f"offset={measured['target_offset']}")
        output = OUT / '04-last-light-relay.mp3'
        run(['-v', 'error', '-y', '-i', str(wav), '-af', norm, '-ar', '44100',
             '-c:a', 'libmp3lame', '-b:a', '224k', '-metadata', 'title=Last Light Relay',
             '-metadata', 'artist=Ashes of Meridian - listening drafts',
             '-metadata', 'TBPM=96', '-metadata',
             'comment=Original industrial dub sketch; local synthesis and generic Flite radio',
             str(output)])
        print(f'{output.relative_to(OUT.parent)}: {DURATION:.2f} s, {BPM} BPM; '
              f'{len(events)} grid-aligned events, no competing lead parts', flush=True)


if __name__ == '__main__':
    main()
