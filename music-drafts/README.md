# Hörentwürfe – Industrial Breakbeat

Drei eigenständige Skizzen mit **116 BPM**, jeweils **67 Sekunden** (32 Takte plus Ausklang), Stereo-MP3/44,1 kHz/224 kbit/s. Nur zum Anhören und Auswählen: **nicht im Spiel verknüpft, nicht im Docker-Buildkontext**. Der bestehende Kampftrack bleibt unverändert.

| Entwurf | Schwerpunkt |
|---|---|
| [01 – Ratchet Theory](01-ratchet-theory.mp3) | Funkig-mechanisch: federnde Oktavbassfigur, versetzte Kicks, Ghost-Snares, kurze Synthantworten; Gitarrenakzente ab dem zweiten Abschnitt. |
| [02 – Breach Protocol](02-breach-protocol.mp3) | Härter: gedämpfte Powerchord-Salven, engerer Groove, Halbtonspannung, Snare/Clap-Schicht und harte Unterbrechungen. |
| [03 – Black Channel](03-black-channel.mp3) | Düsterer: mehr Swing und Platz, tiefere Bassfigur, metallische FM-Signale, Funkfragmente und ein ausgedünnter Halftime-Abschnitt. |

Die Dateien direkt im Audioplayer öffnen, etwa mit `ffplay -autoexit music-drafts/01-ratchet-theory.mp3` vom Projektverzeichnis aus.

## Herstellung und Grenzen

- Eigene synthetische Drum-One-Shots werden wie Samplersounds wiederholt, in Tonhöhe/Timing variiert und mit Ghostnotes, kurzen Raumreflexionen und reduzierter Auflösung bearbeitet. Kein fremder Drumloop.
- Bass aus gefilterten Oszillatoren; Gitarrenannäherung durch gezupfte Saitenmodelle (Karplus–Strong), Verzerrung und Lautsprecherfilter. Keine tatsächlich eingespielten Gitarren.
- Funkkommandos aus lokaler generischer **Flite-TTS** (`rms`), schmalbandig verzerrt, zerhackt und rhythmisch wiederholt; kein Gesang, keine nachgeahmte reale Person. Beispielsweise „Stand by“, „Weapons free“ und „Unknown transmission“.
- Keine Downloads, Referenzaufnahmen oder bestehenden Audioassets als Klangquelle. Auch `audio/Ashes Of Meridian - Recording Sample.mp3` wird nicht verwendet.
- Für fairen Vergleich auf etwa −15 LUFS angeglichen. Bewusst kurze Skizzen mit harten Abschnittswechseln, **keine fertig abgenommenen oder nahtlosen Spielloops**. Technische Prüfung ist kein Hörurteil.

Erneut erzeugen (überschreibt nur diese Entwürfe):

```bash
python3 scripts/generate-music-drafts.py
# Nur einen Entwurf:
python3 scripts/generate-music-drafts.py --variant 2
```

Benötigt Python 3 und `ffmpeg` mit `flite`, `loudnorm` und `libmp3lame`; keine Python-Zusatzpakete. Der Generator gehört weder zum Spiel noch zu `npm run build`. Gleiche Werkzeugversionen und Seeds reproduzieren den Entwurf; Codec-/TTS-Versionen können das Ergebnis verändern.
