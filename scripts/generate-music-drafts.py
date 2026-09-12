#!/usr/bin/env python3
"""Offline 116-BPM listening sketches; never imported by the game or npm build.

Python standard library + ffmpeg (libflite and libmp3lame). All percussion,
strings and synths are synthesized here; speech is local, generic Flite TTS.
No downloaded samples, reference recordings or existing game assets are read.
"""
from array import array
from functools import lru_cache
from math import exp, pi, sin, sqrt, tanh
from pathlib import Path
from random import Random
import argparse
import json
import subprocess
import sys
import tempfile
import wave

SR = 32000
BEAT = 60 / 116
BAR = 4 * BEAT
BARS = 32
DURATION = BARS * BAR + 0.8
TAU = 2 * pi
OUT = Path(__file__).resolve().parents[1] / 'music-drafts'
VARIANTS = [
    ('01-ratchet-theory', 'Ratchet Theory', 40, 0.017, 11),
    ('02-breach-protocol', 'Breach Protocol', 38, 0.006, 29),
    ('03-black-channel', 'Black Channel', 36, 0.023, 47),
]


def run(args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', *args],
                          check=True, capture_output=True)


def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def normalized(samples, peak=0.9):
    mean = sum(samples) / len(samples)
    scale = peak / max(0.001, max(abs(s - mean) for s in samples))
    return array('f', ((s - mean) * scale for s in samples))


@lru_cache(maxsize=256)
def drum(kind, flavor=0):
    """Reusable one-shots: body modes, noise skin, room slap, sampler crunch."""
    rng = Random(1701 + flavor * 101 + sum(map(ord, kind)))
    duration = {'kick': .36, 'snare': .31, 'hat': .09, 'open': .32,
                'metal': .53, 'tom': .27, 'clap': .23}[kind]
    data = array('f')
    phase = low = cabinet = held = 0.0
    for i in range(round(duration * SR)):
        t = i / SR
        n = rng.uniform(-1, 1)
        low += .22 * (n - low)
        hiss = n - low
        if kind == 'kick':
            phase += TAU * (48 + flavor * 3 + 100 * exp(-t * 44)) / SR
            x = sin(phase) * exp(-t * 15) + .32 * hiss * exp(-t * 150)
            x += .13 * sin(phase * 2.17) * exp(-t * 32)
        elif kind == 'snare':
            x = .7 * hiss * exp(-t * 19) + .45 * low * exp(-t * 10)
            x += (.64 * sin(TAU * (182 + flavor * 13) * t)
                  + .28 * sin(TAU * 329 * t)) * exp(-t * 27)
            x += .18 * hiss * exp(-max(0, t - .018) * 45) * (t > .018)
        elif kind == 'clap':
            x = sum(hiss * exp(-(t - a) * 85) for a in (0, .011, .024) if t >= a)
            x += .22 * low * exp(-t * 13)
        elif kind in ('hat', 'open'):
            ring = sum(sin(TAU * f * t) for f in (3217, 4423, 5987, 7103)) * .09
            x = (hiss * .72 + ring) * exp(-t * (57 if kind == 'hat' else 15))
        elif kind == 'tom':
            phase += TAU * (92 + 60 * exp(-t * 30)) / SR
            x = sin(phase) * exp(-t * 15) + .09 * n * exp(-t * 40)
        else:
            x = sum(sin(TAU * f * t) * exp(-t * d) for f, d in
                    ((427, 8), (683, 11), (1139, 16), (2363, 24))) * .3
            x += .14 * hiss * exp(-t * 40)
        # Short attack/release avoids clicks while retaining drum transients.
        x *= min(1, t / .0006, (duration - t) / .015)
        cabinet += .68 * (tanh(x * 1.65) - cabinet)
        if i % 2 == 0:
            held = round(cabinet * 2048) / 2048
        data.append(held)
    if kind in ('snare', 'clap', 'metal'):
        dry = data[:]
        for delay, gain in ((.027, .16), (.043, .10), (.071, .045)):
            offset = round(delay * SR)
            for i in range(offset, len(data)):
                data[i] += dry[i - offset] * gain
    return normalized(data)


@lru_cache(maxsize=512)
def bass(midi, length, flavor=0, slide=0):
    """Plucked electric/saw hybrid, moving low-pass and octave-string attack."""
    duration = length * BEAT / 4
    phase = low = second = 0.0
    samples = array('f')
    for i in range(round(duration * SR)):
        t = i / SR
        hz = frequency(midi + slide * exp(-t * 33))
        phase = (phase + hz / SR) % 1
        saw = 2 * phase - 1
        raw = .62 * sin(TAU * phase) + .29 * saw + .16 * sin(TAU * phase * 2)
        cutoff = (450 if flavor == 2 else 650) + (2400 if flavor == 0 else 1600) * exp(-t * 24)
        a = 1 - exp(-TAU * cutoff / SR)
        low += a * (raw - low)
        second += a * (low - second)
        env = min(1, t / .002, (duration - t) / .023) * exp(-t * 2.7)
        samples.append(tanh(second * (2.4 if flavor == 1 else 1.65)) * env)
    return samples


@lru_cache(maxsize=256)
def guitar(midi, length, take=0):
    """Karplus-Strong power chord; palm damping, amp drive and cabinet filter."""
    rng = Random(983 + midi * 71 + take * 357)
    duration = length * BEAT / 4
    data = array('f', [0]) * round(duration * SR)
    for interval, gain in ((0, .65), (7, .43), (12, .28)):
        hz = frequency(midi + interval + (.035 if take else -.035))
        size = round(SR / hz - .5)
        string = [rng.uniform(-1, 1) for _ in range(size)]
        # Smooth excitation approximates a picked string rather than white hiss.
        string = [(string[j] + string[(j + 1) % size]) * .5 for j in range(size)]
        index = 0
        for i in range(len(data)):
            value = string[index]
            string[index] = .496 * (value + string[(index + 1) % size])
            index = (index + 1) % size
            data[i] += gain * value
    low = high = dc = 0.0
    for i, value in enumerate(data):
        t = i / SR
        dc += .012 * (value - dc)
        clipped = tanh((value - dc) * 15)
        low += .38 * (clipped - low)
        high += .38 * (low - high)
        env = min(1, t / .001, (duration - t) / .018) * exp(-t * (7 if length < 2 else 3))
        data[i] = high * env
    return data


@lru_cache(maxsize=128)
def synth(midi, length, flavor=0):
    duration = length * BEAT / 4
    data = array('f')
    low = 0.0
    for i in range(round(duration * SR)):
        t = i / SR
        hz = frequency(midi)
        if flavor == 2:
            raw = sin(TAU * hz * t + 1.7 * sin(TAU * hz * 1.502 * t) * exp(-t * 7))
        else:
            raw = ((t * hz) % 1) * 2 - 1
            raw += .45 * (((t * hz * 1.006) % 1) * 2 - 1)
        cutoff = 650 + 3400 * exp(-t * 17)
        low += (1 - exp(-TAU * cutoff / SR)) * (raw - low)
        env = min(1, t / .004, (duration - t) / .05) * exp(-t * 4)
        data.append(tanh(low * 1.8) * env)
    return data


def speech(text):
    # Generic offline male TTS, deliberately narrow-band and ring-modulated.
    source = f"flite=text='{text}':voice=rms"
    raw = run(['-v', 'error', '-f', 'lavfi', '-i', source, '-af',
               'highpass=f=480,lowpass=f=2600,acompressor=threshold=0.1:ratio=5:makeup=2',
               '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-']).stdout
    values = array('f')
    values.frombytes(raw)
    if sys.byteorder != 'little':
        values.byteswap()
    # Remove TTS leading/trailing silence before slicing it on the grid.
    active = [i for i, x in enumerate(values) if abs(x) > .015]
    if not active:
        raise ValueError('Empty speech synthesis')
    values = values[max(0, active[0] - 160):min(len(values), active[-1] + 320)]
    for i, x in enumerate(values):
        x = tanh(x * 2.5) * (.78 + .22 * sin(TAU * 53 * i / SR))
        values[i] = round(x * 512) / 512
    return normalized(values, .75)


class Mix:
    def __init__(self):
        self.left = array('f', [0]) * round(DURATION * SR)
        self.right = self.left[:]

    def put(self, sample, time, volume=1, pan=0, speed=1):
        start = round(time * SR)
        lg, rg = sqrt((1 - pan) / 2) * volume, sqrt((1 + pan) / 2) * volume
        count = min(round(len(sample) / speed), len(self.left) - start)
        for i in range(max(0, count)):
            index = start + i
            if index < 0:
                continue
            position = i * speed
            k = int(position)
            if k >= len(sample):
                break
            x = sample[k] + (sample[min(k + 1, len(sample) - 1)] - sample[k]) * (position - k)
            self.left[index] += x * lg
            self.right[index] += x * rg

    def echo(self, sample, time, volume, pan=0):
        self.put(sample, time, volume, pan)
        self.put(sample, time + BEAT * .75, volume * .20, -.65)
        self.put(sample, time + BEAT * 1.5, volume * .075, .65)

    def cut(self, start, end):
        first, last = round(start * SR), round(end * SR)
        for i in range(first, min(last, len(self.left))):
            gain = max(0, 1 - (i - first) / (SR * .005))
            self.left[i] *= gain
            self.right[i] *= gain

    def write(self, path):
        peak = max(max(map(abs, self.left)), max(map(abs, self.right)))
        gain = .83 / max(peak, .001)
        pcm = array('h')
        for i, (l, r) in enumerate(zip(self.left, self.right)):
            fade = min(1, i / (SR * .008), (len(self.left) - i) / (SR * .3))
            pcm.extend((round(tanh(l * gain) * fade * 32767),
                        round(tanh(r * gain) * fade * 32767)))
        if sys.byteorder != 'little':
            pcm.byteswap()
        with wave.open(str(path), 'wb') as target:
            target.setparams((2, 2, SR, 0, 'NONE', 'not compressed'))
            target.writeframes(pcm.tobytes())


def compose(variant, directory):
    slug, title, root, swing, seed = VARIANTS[variant]
    rng = Random(seed)
    mix = Mix()
    commands = [speech(text) for text in (
        ('Stand by', 'Move to sector nine', 'Keep moving', 'Go go go'),
        ('Breach team ready', 'Weapons free', 'Move in', 'Signal lost'),
        ('This is control', 'Unknown transmission', 'Hold position', 'Radio silence'),
    )[variant]]
    # Deliberately different two-bar bass phrases, not transpositions of one cue.
    bass_lines = [
        [(0, 0, 1.5), (2.7, 12, .65), (3.5, 0, .6), (6, 0, 1.3),
         (7.5, 10, .65), (9, 12, 1), (10.5, 7, 1), (13, 0, 1.4), (15, 3, .8)],
        [(0, 0, 1), (1.5, 0, .7), (3, 0, .65), (6, 1, 1),
         (8, 0, 1.5), (10.5, 7, 1), (12.75, 0, .65), (14, 10, 1.5)],
        [(0, 0, 2.1), (3.5, 12, .8), (6.5, 7, 1), (8, 0, 1.4),
         (10, 10, 1.3), (13.5, 3, .8), (15, 7, .7)],
    ]
    kick_grids = [([0, 2.5, 6, 8, 10.5], [0, 3, 6.5, 9.5, 14]),
                  ([0, 1.5, 6, 8, 11], [0, 3, 7, 8.5, 14.5]),
                  ([0, 3.5, 6.5, 10], [0, 2.5, 8, 11, 14.5])]
    for bar in range(BARS):
        start = bar * BAR
        intro = bar < 2
        breakdown = (16 <= bar < 20) if variant != 2 else (12 <= bar < 16)
        full = not intro and not breakdown
        final = bar >= 24
        shift = ([0, 0, 0, -2, 0, 0, 3, -2],
                 [0, 0, 1, 0, 0, 0, -2, 0],
                 [0, 0, -2, 0, 3, 0, -2, -2])[variant][bar % 8]
        note = root + shift

        def at(step, human=True):
            off = swing if round(step) % 2 else 0
            return start + step * BEAT / 4 + off + (rng.uniform(-.003, .003) if human and step else 0)

        kicks = kick_grids[variant][bar % 2] if not breakdown else [0, 10.5]
        if intro:
            kicks = [0, 8] if variant != 1 else kicks
        for step in kicks:
            mix.put(drum('kick', variant), at(step), .91 if step in (0, 8) else .78)
        snares = [4, 12] if not breakdown else ([8] if variant == 2 else [12])
        for step in snares:
            mix.put(drum('snare', variant), at(step) + .009, .76 + rng.uniform(-.035, .035), -.035)
            if variant == 1 or final:
                mix.put(drum('clap', variant), at(step) + .019, .13, .17)
        if full:
            for step in ([3.25, 7.5, 11, 14.75] if bar % 2 else [2, 10, 15]):
                mix.put(drum('snare', variant), at(step), rng.uniform(.095, .19), .09, 1.08)
        for step in range(16):
            if intro and step % 2 == 1 or breakdown and step % 4 != 2:
                continue
            volume = (.105 if step % 2 == 0 else .045) * rng.uniform(.8, 1.15)
            opened = step in (6, 14) and full and bar % 2 == 1
            mix.put(drum('open' if opened else 'hat', variant), at(step),
                    volume * (1.05 if opened else 1), -.30 if step % 2 else .25,
                    rng.choice((.97, 1, 1.035)))
        if full and bar % 2 == 0:
            mix.put(drum('metal', variant), at(7.5), .13 if variant != 2 else .24, -.5)
        if full and bar % 4 == 3:
            for j, step in enumerate((13.5, 14.25, 15, 15.5)):
                mix.put(drum('tom' if j < 2 else 'snare', variant), at(step), .27 + j * .035,
                        -.3 + j * .2, 1 - .06 * j)

        if not intro or variant == 0:
            phrase = bass_lines[variant]
            for j, (step, interval, length) in enumerate(phrase):
                if breakdown and j % 3 != 0:
                    continue
                if bar % 2 and j == len(phrase) - 1:
                    interval = 10 if variant == 0 else 1 if variant == 1 else -2
                mix.put(bass(note + interval, length, variant, -2 if j in (1, 5) else 0),
                        at(step), .43 if variant != 2 else .47)
            if full and bar % 2:
                mix.put(bass(note + 12, .35, variant), at(5.5), .13)

        guitar_active = full and (variant == 1 or variant == 0 and bar >= 8 or variant == 2 and final)
        if guitar_active:
            riff = ([0, 6, 10.5], [0, 1.5, 6, 8, 10.5, 14], [0, 7, 10.5])[variant]
            for j, step in enumerate(riff):
                offset = 0 if j < len(riff) - 1 else (3 if bar % 2 else -2)
                length = 1 if j % 2 else 1.6
                vol = (.18, .29, .14)[variant]
                mix.put(guitar(note + offset, length, 0), at(step), vol, -.64)
                mix.put(guitar(note + offset, length, 1), at(step) + .012, vol * .83, .64)

        # Short minor-key answer, with rests instead of continuous arpeggiation.
        if full and bar % 4 in (1, 3) and (variant != 1 or final):
            motif = ([(2, 19), (7, 15), (11, 12), (14.5, 10)],
                     [(2.5, 12), (7, 13), (14, 7)],
                     [(1.5, 24), (6, 19), (10.5, 22)])[variant]
            for step, interval in motif:
                mix.echo(synth(note + interval, 1.4 if variant != 2 else 2.7, variant),
                         at(step), (.12, .075, .12)[variant], .2)
        if breakdown:
            mix.echo(synth(note + 24, 5, 2), at(2), .105, -.4)

        # Machinery: low motor scrape plus gated metallic strokes, no large pad bed.
        if bar % 2 == 0:
            mix.put(drum('metal', 2), start + BEAT * 1.5, .065, .6, .27)
        if (bar in (0, 7, 17, 23, 30) and variant != 2) or (variant == 2 and bar in (0, 7, 12, 19, 27)):
            index = (bar // 6) % 4
            voice = commands[index]
            when = start + (0 if bar == 0 else BEAT * .5)
            fragment = voice[:round(.115 * SR)]
            # Explicit sample retriggers ahead of the complete command.
            mix.put(fragment, when, .20, -.2)
            mix.put(fragment, when + BEAT / 4, .16, .2)
            mix.echo(voice, when + BEAT / 2, .24, -.12)

    # Hard edits before new sections, no riser/EDM drop. Tiny boundary fades.
    for bar in (8, 16, 20, 24, 28):
        mix.cut(bar * BAR - BEAT * (.5 if variant == 1 else .25), bar * BAR)
    mix.cut(BARS * BAR, DURATION)
    mix.put(drum('metal', variant), BARS * BAR, .15, -.2, .8)
    wav = directory / f'{slug}.wav'
    mix.write(wav)
    del mix

    # Two-pass static loudness alignment makes comparison fair, not louder=better.
    first = run(['-v', 'info', '-i', str(wav), '-af',
                 'loudnorm=I=-15:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
    report = first.stderr.decode()
    measured = json.loads(report[report.rfind('{'):report.rfind('}') + 1])
    norm = ('loudnorm=I=-15:TP=-1.5:LRA=11:linear=true:'
            f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
            f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
            f"offset={measured['target_offset']}")
    output = OUT / f'{slug}.mp3'
    run(['-v', 'error', '-y', '-i', str(wav), '-af', norm, '-ar', '44100',
         '-c:a', 'libmp3lame', '-b:a', '224k', '-metadata', f'title={title}',
         '-metadata', 'artist=Ashes of Meridian - listening drafts', '-metadata', 'TBPM=116',
         '-metadata', 'comment=Original synthesized sketch; generic offline Flite radio speech', str(output)])
    print(f'{output.relative_to(OUT.parent)}: {DURATION:.2f} s, 116 BPM', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--variant', type=int, choices=(1, 2, 3), help='Only regenerate this draft')
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='meridian-drafts-') as directory:
        for variant in ([args.variant - 1] if args.variant else range(3)):
            compose(variant, Path(directory))


if __name__ == '__main__':
    main()
