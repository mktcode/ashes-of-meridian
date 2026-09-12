#!/usr/bin/env python3
"""Three sparse listening arrangements using the existing draft sounds and voices.

Python 3 + ffmpeg/Flite; no game integration. Writes only *-minimal.mp3.
Instrument attacks share an exact eighth-note grid; no timing jitter, layered
percussion, doubled guitars or competing lead parts. Radio processing is intact.
"""
from pathlib import Path
import argparse
import json
import runpy
import tempfile

# Load sound constructors without running the original generator or writing caches.
SOUNDS = runpy.run_path(str(Path(__file__).with_name('generate-music-drafts.py')))
SR, BEAT, BAR, BARS, OUT = (SOUNDS[k] for k in ('SR', 'BEAT', 'BAR', 'BARS', 'OUT'))
Mix, drum, bass, guitar, synth, speech, run = (
    SOUNDS[k] for k in ('Mix', 'drum', 'bass', 'guitar', 'synth', 'speech', 'run'))
COMMANDS = (
    ('Stand by', 'Move to sector nine', 'Keep moving', 'Go go go'),
    ('Breach team ready', 'Weapons free', 'Move in', 'Signal lost'),
    ('This is control', 'Unknown transmission', 'Hold position', 'Radio silence'),
)
RADIO_BARS = (10, 18, 26, 30)
HOOK_BARS = (12, 20, 28)


def arrangement(variant):
    """Render drums + bass + at most ONE of guitar, melody or radio."""
    mix = Mix()
    root = SOUNDS['VARIANTS'][variant][2]
    commands = [speech(text) for text in COMMANDS[variant]]
    # Radio gets a full two-bar window, including original chops and echoes.
    assert all(len(voice) / SR + BEAT * 2.5 < BAR * 2 for voice in commands)
    kicks = ((0, 6, 8), (0, 8, 14), (0, 8))[variant]
    riff = ((0, 6, 12), (0, 8, 14), (0, 8))[variant]
    for bar in range(BARS):
        start = bar * BAR
        at = lambda step: start + step * BEAT / 4
        # Slower harmonic movement; retain the original pitch palette.
        shifts = ((0, 0, 3, -2), (0, 1, 0, -2), (0, -2, 3, -2))[variant]
        note = root + shifts[(bar // 4) % 4]
        radio_window = any(first <= bar < first + 2 for first in RADIO_BARS)
        hook_window = any(first <= bar < first + 2 for first in HOOK_BARS)
        guitar_active = bar >= 2 and not radio_window and not hook_window
        bass_active = bar >= 6 and bar not in (16, 17)

        # Same uncluttered anchor throughout: no hats, fills, ghosts or claps.
        for step in kicks:
            mix.put(drum('kick', variant), at(step), .88 if step in (0, 8) else .73)
        for step in (4, 12):
            mix.put(drum('snare', variant), at(step), .70, 0)

        if guitar_active:
            for j, step in enumerate(riff):
                offset = (3 if bar % 2 else -2) if j == len(riff) - 1 else 0
                # One take, centered: no independently timed stereo doubling.
                mix.put(guitar(note + offset, 1.6, 0), at(step), (.28, .33, .27)[variant], 0)

        if bass_active:
            # Support the guitar's accents, not a second syncopated sequence.
            steps = riff if guitar_active else (0, 8)
            for j, step in enumerate(steps):
                offset = (3 if bar % 2 else -2) if guitar_active and j == len(steps) - 1 else 0
                length = min(2.4, 16 - step - .25)
                mix.put(bass(note + offset, length, variant), at(step), .35, 0)

        if bar in HOOK_BARS:
            # Familiar notes, one short phrase with silence around it; no echo.
            motif = (((0, 19), (4, 15), (8, 12), (12, 10)),
                     ((0, 12), (6, 13), (12, 7)),
                     ((0, 24), (6, 19), (12, 22)))[variant]
            for step, interval in motif:
                mix.put(synth(note + interval, 1.4 if variant != 2 else 2.7, variant),
                        at(step), (.12, .10, .12)[variant], .15)

        if bar in RADIO_BARS:
            voice = commands[RADIO_BARS.index(bar)]
            when = start + BEAT * .5
            fragment = voice[:round(.115 * SR)]
            # Exactly the original voice sound, retrigger spacing, gains and echo.
            mix.put(fragment, when, .20, -.2)
            mix.put(fragment, when + BEAT / 4, .16, .2)
            mix.echo(voice, when + BEAT / 2, .24, -.12)

    # Let the last radio echo finish, then one on-grid kick as a simple endpoint.
    mix.put(drum('kick', variant), BARS * BAR, .75)
    return mix


def compose(variant, directory):
    slug, title = SOUNDS['VARIANTS'][variant][:2]
    slug += '-minimal'
    wav = directory / f'{slug}.wav'
    mix = arrangement(variant)
    mix.write(wav)
    del mix
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
         '-c:a', 'libmp3lame', '-b:a', '224k', '-metadata', f'title={title} - Minimal Mix',
         '-metadata', 'artist=Ashes of Meridian - listening drafts', '-metadata', 'TBPM=116',
         '-metadata', 'comment=Sparse original arrangement; unchanged generic Flite radio sound', str(output)])
    print(f'{output.relative_to(OUT.parent)}: {SOUNDS["DURATION"]:.2f} s, 116 BPM', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--variant', type=int, choices=(1, 2, 3))
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='meridian-minimal-') as directory:
        for variant in ([args.variant - 1] if args.variant else range(3)):
            compose(variant, Path(directory))


if __name__ == '__main__':
    main()
