#!/usr/bin/env python3
"""Rootmind: kinetic companion to the Sporewake alien-forest draft.

Python standard library + local FFmpeg. Reuses only local synthesis helpers,
reads no recordings or game assets and writes only 07-rootmind.mp3.
"""
from array import array
from functools import lru_cache
from math import exp, pi, sin, tanh
from pathlib import Path
import json
import runpy
import tempfile

SOUNDS = runpy.run_path(str(Path(__file__).with_name('generate-sporewake.py')))
SR, BPM, BEAT, BAR, BARS, DURATION, TAU, OUT = (
    SOUNDS[key] for key in ('SR', 'BPM', 'BEAT', 'BAR', 'BARS', 'DURATION', 'TAU', 'OUT'))
Mix, frequency, pod_drum, root_click, pulse, canopy, forest_call, spore_chirp, run = (
    SOUNDS[key] for key in ('Mix', 'frequency', 'pod_drum', 'root_click', 'pulse',
                            'canopy', 'forest_call', 'spore_chirp', 'run'))


@lru_cache(maxsize=128)
def seed_voice(midi, length=.36):
    """A rounded vowel-like seed pulse: tonal and organic, never bell-like."""
    hz = frequency(midi)
    data = array('f')
    phase = low = 0.0
    for i in range(round(length * SR)):
        time = i / SR
        phase += TAU * hz * (1 + .002 * sin(TAU * 2.3 * time)) / SR
        raw = sin(phase + .48 * sin(phase * 2)) + .09 * sin(phase * 4)
        low += .16 * (raw - low)
        envelope = min(1, time / .022, (length - time) / .075) * exp(-time * 3.9)
        data.append(tanh(low * .88) * envelope)
    return data


def arrangement():
    mix = Mix()
    # The same six-note habitat scale as Sporewake, reorganized into a faster
    # root-network ostinato rather than long woodland ambience.
    harmony = (
        (39, (58, 63, 69)),
        (42, (54, 61, 67)),
        (36, (60, 66, 69)),
        (43, (55, 62, 68)),
    )
    network = (
        (63, 66, 69, 67),
        (66, 67, 72, 69),
        (60, 63, 66, 62),
        (67, 69, 72, 68),
    )
    calls = {
        10: ((0, 63, 66), (8, 69, 67)),
        18: ((0, 72, 69), (8, 66, 63)),
        26: ((0, 67, 72), (8, 69, 66)),
        34: ((0, 63, 67), (8, 69, 60)),
    }
    spores = {15: (12, 78), 23: (4, 81), 31: (12, 84)}
    events = []

    def put(part, sample, bar, step, gain, pan=0):
        time = bar * BAR + step * BEAT / 4
        assert time + len(sample) / SR <= DURATION
        mix.put(sample, time, gain, pan)
        events.append((part, bar, step))

    for bar in range(BARS):
        harmonic_index = (bar // 2) % len(harmony)
        root, chord = harmony[harmonic_index]
        intro = bar < 4
        hollow = 20 <= bar < 24
        full = not intro and not hollow

        # A slow bloom marks sections but never opens with broadband noise.
        if bar % 4 == 0:
            put('canopy', canopy(chord, 4.0 if hollow else 3.2), bar, 0,
                .16 if intro else .18, -.10 if bar % 8 == 0 else .10)

        # Interlocking offbeat seed voices suggest signals moving through roots.
        if bar >= 2:
            notes = network[harmonic_index]
            for index, (step, note) in enumerate(zip((2, 6, 10, 14), notes)):
                if bar in calls and step in (6, 14):
                    continue
                put('network', seed_voice(note), bar, step, .115 if full else .085,
                    -.32 if index % 2 == 0 else .32)

        if full:
            for step in (0, 6, 8, 14):
                put('drums', pod_drum(36 if step in (0, 8) else 39, .40, step % 3),
                    bar, step, .68 if step in (0, 8) else .42, -.06)
            for step in (4, 12):
                put('drums', pod_drum(50, .27, 1), bar, step, .36, .10)
            for step in (2, 10):
                put('roots', root_click((bar + step) % 4), bar, step, .06,
                    -.22 if step == 2 else .22)
        elif hollow:
            put('drums', pod_drum(36, .44, 0), bar, 0, .42)

        if bar >= 6 and not hollow:
            for step, interval in ((0, 0), (8, 0), (12, 7), (14, 6)):
                put('pulse', pulse(root + interval, .40), bar, step, .27)

        if bar in calls:
            for index, (step, start, end) in enumerate(calls[bar]):
                put('call', forest_call(start, end, .78), bar, step, .155,
                    -.27 if index == 0 else .27)

        if bar in spores:
            step, note = spores[bar]
            put('spore', spore_chirp(note, bar % 3), bar, step, .045,
                -.38 if bar % 2 else .38)

    put('canopy', canopy((48, 55, 63), 2.6), BARS, 0, .14)
    assert all(step % 2 == 0 for _, _, step in events)
    assert not any(part in ('bell', 'guitar', 'speech', 'breath') for part, _, _ in events)
    assert sum(part == 'spore' for part, _, _ in events) == 3
    return mix, events


def main():
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='meridian-rootmind-') as directory:
        wav = Path(directory) / 'rootmind.wav'
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
        output = OUT / '07-rootmind.mp3'
        run(['-v', 'error', '-y', '-i', str(wav), '-af', normalization, '-ar', '44100',
             '-c:a', 'libmp3lame', '-b:a', '224k', '-metadata', 'title=Rootmind',
             '-metadata', 'artist=Ashes of Meridian - listening drafts', '-metadata', 'TBPM=108',
             '-metadata',
             'comment=Original kinetic alien-forest sketch; local synthesis, no samples or noise bed',
             str(output)])
        print(f'{output.relative_to(OUT.parent)}: {DURATION:.2f} s, {BPM} BPM; '
              f'{len(events)} eighth-grid events, no opening noise', flush=True)


if __name__ == '__main__':
    main()
