# Hörentwürfe – Industrial Breakbeat

Drei eigenständige Skizzen mit **116 BPM**, jeweils **67 Sekunden** (32 Takte plus Ausklang), Stereo-MP3/44,1 kHz/224 kbit/s. Nur zum Anhören und Auswählen: **nicht im Spiel verknüpft, nicht im Docker-Buildkontext**. Der bestehende Kampftrack bleibt unverändert.

| Original | Luftigerer Vergleichsmix | Schwerpunkt |
|---|---|---|
| [01 – Ratchet Theory](01-ratchet-theory.mp3) | [Reduced Mix](01-ratchet-theory-reduced.mp3) | Funkig-mechanisch: federnde Oktavbassfigur, versetzte Kicks, Ghost-Snares, kurze Synthantworten; Gitarrenakzente ab dem zweiten Abschnitt. |
| [02 – Breach Protocol](02-breach-protocol.mp3) | [Reduced Mix](02-breach-protocol-reduced.mp3) | Härter: gedämpfte Powerchord-Salven, engerer Groove, Halbtonspannung, Snare/Clap-Schicht und harte Unterbrechungen. |
| [03 – Black Channel](03-black-channel.mp3) | [Reduced Mix](03-black-channel-reduced.mp3) | Düsterer: mehr Swing und Platz, tiefere Bassfigur, metallische FM-Signale, Funkfragmente und ein ausgedünnter Halftime-Abschnitt. |

Die Dateien direkt im Audioplayer öffnen, etwa mit `ffplay -autoexit music-drafts/01-ratchet-theory.mp3` vom Projektverzeichnis aus.

## Reduced Mixes

Die Originale bleiben erhalten. Die Vergleichsversionen reduzieren konkurrierende Zwischenrhythmen, statt nur den Gesamtpegel zu senken: weniger Sechzehntel-Hi-Hats, Ghost-Snares, Clap-Dopplungen und Fills; Metalltexturen sparsamer, Gitarrendopplung leiser. Bei Ratchet Theory und Black Channel weichen Gitarren den Melodien/Durchsagen bis auf einen Taktanfangsakzent. Breach Protocol behält sein prägendes Riff, nimmt es unter den Vordergrundstimmen aber zurück.

Bass, Melodien samt Echo, Funkdurchsagen, Kick/Hauptsnare, Tempo, Swing und Abschnittswechsel behalten ihre ursprünglichen Noten, Samples und Einsatzzeiten. Stumme Zusatzereignisse verbrauchen weiterhin dieselben Zufallsaufrufe, damit sich das Mikrotiming nicht verschiebt. Die abschließende Lautheitsanpassung gilt jeweils für den gesamten Mix; auch die reduzierten Fassungen liegen bei etwa −15 LUFS. Ob sich der Groove dadurch klarer anfühlt, bleibt ein Hörvergleich.

## Herstellung und Grenzen

- Eigene synthetische Drum-One-Shots werden wie Samplersounds wiederholt, in Tonhöhe/Timing variiert und mit Ghostnotes, kurzen Raumreflexionen und reduzierter Auflösung bearbeitet. Kein fremder Drumloop.
- Bass aus gefilterten Oszillatoren; Gitarrenannäherung durch gezupfte Saitenmodelle (Karplus–Strong), Verzerrung und Lautsprecherfilter. Keine tatsächlich eingespielten Gitarren.
- Funkkommandos aus lokaler generischer **Flite-TTS** (`rms`), schmalbandig verzerrt, zerhackt und rhythmisch wiederholt; kein Gesang, keine nachgeahmte reale Person. Beispielsweise „Stand by“, „Weapons free“ und „Unknown transmission“.
- Keine Downloads, Referenzaufnahmen oder bestehenden Audioassets als Klangquelle. Auch `audio/Ashes Of Meridian - Recording Sample.mp3` wird nicht verwendet.
- Für fairen Vergleich auf etwa −15 LUFS angeglichen. Bewusst kurze Skizzen mit harten Abschnittswechseln, **keine fertig abgenommenen oder nahtlosen Spielloops**. Technische Prüfung ist kein Hörurteil.

Erneut erzeugen (überschreibt nur die jeweils gewählte Fassung):

```bash
python3 scripts/generate-music-drafts.py
# Nur einen Entwurf:
python3 scripts/generate-music-drafts.py --variant 2
# Luftige Vergleichsmixe, ohne die Originale zu überschreiben:
python3 scripts/generate-music-drafts.py --reduced
# Nur ein Vergleichsmix:
python3 scripts/generate-music-drafts.py --reduced --variant 2
```

Benötigt Python 3 und `ffmpeg` mit `flite`, `loudnorm` und `libmp3lame`; keine Python-Zusatzpakete. Der Generator gehört weder zum Spiel noch zu `npm run build`. Gleiche Werkzeugversionen und Seeds reproduzieren den Entwurf; Codec-/TTS-Versionen können das Ergebnis verändern.
