# Hörentwürfe – Industrial Breakbeat und Dub

Die ersten drei Themen in mehreren Vergleichsfassungen mit **116 BPM**, jeweils **67 Sekunden** (32 Takte plus Ausklang), Stereo-MP3/44,1 kHz/224 kbit/s. Die **Minimal Mixes sind freigegeben** und als bytegleiche Kopien unter `audio/music-*.mp3` im Spiel eingebaut: zusammen mit **Last Light Relay** als feste Viererplaylist (**Ratchet Theory → Last Light Relay → Breach Protocol → Black Channel**), mit 10 Sekunden Startverzögerung und 10 Sekunden Musikpause zwischen den Stücken. Dieser Entwurfsordner selbst bleibt außerhalb des Docker-Buildkontexts; Originale und Reduced Mixes dienen weiterhin nur dem Vergleich.

## Last Light Relay – freigegeben

[**04 – Last Light Relay anhören**](04-last-light-relay.mp3) – **96 BPM**, rund **83 Sekunden**, Stereo-MP3/44,1 kHz/224 kbit/s. **Freigegeben und als zweiter Track eingebaut**, bytegleich unter `audio/music-last-light-relay.mp3`, auch im Container enthalten.

Ein langsamer Industrial-Dub-Gegenpol: trockener Halftime-Beat, runder Subbass mit hörbaren Obertönen, kurze Moll-/Dur-Nonen-Orgelakkorde mit dunklen Echos und eine leicht verstimmte, einsame Signalmelodie. Keine Gitarren, Hi-Hats oder durchgehende Klangfläche. Akkorde, Melodie und Funk bekommen getrennte Fenster; die Echos bleiben rhythmisch gebunden.

- **0–5 s:** nur Kick und holziger Snare/Rim-Klang; **ab 5 s:** Bass; **ab 10 s:** Orgel-Echos; **ab 20 s:** erste Melodie.
- **Ab 30 s:** „We are still here“. **40–45 s:** Beat setzt aus, Bass und Signal bleiben; anschließend Rückkehr des Grooves. Später „Follow the signal“ und „See you at dawn“, zum Schluss ein ausklingender Grundton.
- Neue lokale Syntheseklänge; Drum-/Funk-Grundfunktionen aus dem bisherigen Generator, weiterhin generische Flite-Stimme mit schmalbandiger Verzerrung. Keine fremden Samples oder Referenzaufnahmen. Kein Ersatz einer bisherigen Fassung; Hörabnahme durch den Nutzer erfolgt.

## Erste drei Themen – Originale und Vergleichsmixe

| Original | Luftigerer Vergleichsmix | Schwerpunkt |
|---|---|---|
| [01 – Ratchet Theory](01-ratchet-theory.mp3) | [Reduced Mix](01-ratchet-theory-reduced.mp3) | Funkig-mechanisch: federnde Oktavbassfigur, versetzte Kicks, Ghost-Snares, kurze Synthantworten; Gitarrenakzente ab dem zweiten Abschnitt. |
| [02 – Breach Protocol](02-breach-protocol.mp3) | [Reduced Mix](02-breach-protocol-reduced.mp3) | Härter: gedämpfte Powerchord-Salven, engerer Groove, Halbtonspannung, Snare/Clap-Schicht und harte Unterbrechungen. |
| [03 – Black Channel](03-black-channel.mp3) | [Reduced Mix](03-black-channel-reduced.mp3) | Düsterer: mehr Swing und Platz, tiefere Bassfigur, metallische FM-Signale, Funkfragmente und ein ausgedünnter Halftime-Abschnitt. |

Die Dateien direkt im Audioplayer öffnen, etwa mit `ffplay -autoexit music-drafts/01-ratchet-theory.mp3` vom Projektverzeichnis aus.

## Minimal Mixes – neuer, deutlich sparsamerer Aufbau

- [01 – Ratchet Theory / Minimal](01-ratchet-theory-minimal.mp3)
- [02 – Breach Protocol / Minimal](02-breach-protocol-minimal.mp3)
- [03 – Black Channel / Minimal](03-black-channel-minimal.mp3)

**0–4,1 s:** nur Kick/Snare. **Ab 4,1 s:** eine einzelne Gitarre. **Ab 12,4 s:** wenige dazu passende Bassnoten. **Ab 20,7 s:** Funkfenster; **ab 24,8 s:** kurze Melodieantworten. Gitarre, Melodie und Funk lösen sich ab – höchstens Hauptbeat, Bass und eine Vordergrundstimme gleichzeitig. Zwischendurch geht die Besetzung wieder zurück.

Keine Hi-Hats, Ghostnotes, Clap-/Gitarrendopplungen, Fills oder Metallkulisse. Instrumenteneinsätze liegen gemeinsam auf einem exakten Achtelraster ohne zufällige Verzögerung; Bass/Gitarre teilen ihre Akzente. Vertraute Sounds und Tonmaterial, aber bewusst vereinfachte Rhythmen und langsamerer Harmoniewechsel. **Stimmen unverändert erzeugt und bearbeitet**, einschließlich ursprünglicher Funkfilter, Retriggerabstände, Pegelverhältnisse und Echo; nur später platziert, mit eigenem Platz im Arrangement. Originale und Reduced Mixes werden nicht überschrieben.

## Reduced Mixes

Die Originale bleiben erhalten. Die Vergleichsversionen reduzieren konkurrierende Zwischenrhythmen, statt nur den Gesamtpegel zu senken: weniger Sechzehntel-Hi-Hats, Ghost-Snares, Clap-Dopplungen und Fills; Metalltexturen sparsamer, Gitarrendopplung leiser. Bei Ratchet Theory und Black Channel weichen Gitarren den Melodien/Durchsagen bis auf einen Taktanfangsakzent. Breach Protocol behält sein prägendes Riff, nimmt es unter den Vordergrundstimmen aber zurück.

Bass, Melodien samt Echo, Funkdurchsagen, Kick/Hauptsnare, Tempo, Swing und Abschnittswechsel behalten ihre ursprünglichen Noten, Samples und Einsatzzeiten. Stumme Zusatzereignisse verbrauchen weiterhin dieselben Zufallsaufrufe, damit sich das Mikrotiming nicht verschiebt. Die abschließende Lautheitsanpassung gilt jeweils für den gesamten Mix; auch die reduzierten Fassungen liegen bei etwa −15 LUFS. Ob sich der Groove dadurch klarer anfühlt, bleibt ein Hörvergleich.

## Herstellung und Grenzen

- Eigene synthetische Drum-One-Shots werden wie Samplersounds wiederholt, in Tonhöhe/Timing variiert und mit Ghostnotes, kurzen Raumreflexionen und reduzierter Auflösung bearbeitet. Kein fremder Drumloop.
- Bass aus gefilterten Oszillatoren; Gitarrenannäherung durch gezupfte Saitenmodelle (Karplus–Strong), Verzerrung und Lautsprecherfilter. Keine tatsächlich eingespielten Gitarren.
- Funkkommandos aus lokaler generischer **Flite-TTS** (`rms`), schmalbandig verzerrt, zerhackt und rhythmisch wiederholt; kein Gesang, keine nachgeahmte reale Person. Beispielsweise „Stand by“, „Weapons free“ und „Unknown transmission“.
- Keine Downloads, Referenzaufnahmen oder bestehenden Audioassets als Klangquelle. Auch `audio/Ashes Of Meridian - Recording Sample.mp3` wird nicht verwendet.
- Für fairen Vergleich auf etwa −15 LUFS angeglichen. Kurze Stücke, keine nahtlosen Einzeldatei-Loops; die freigegebenen Minimalfassungen spielen im Gefecht mit Ruhepausen. Technische Prüfung ist kein Hörurteil.

Erneut erzeugen (überschreibt nur die jeweils gewählte Fassung):

```bash
python3 scripts/generate-music-drafts.py
# Nur einen Entwurf:
python3 scripts/generate-music-drafts.py --variant 2
# Luftige Vergleichsmixe, ohne die Originale zu überschreiben:
python3 scripts/generate-music-drafts.py --reduced
# Nur ein Vergleichsmix:
python3 scripts/generate-music-drafts.py --reduced --variant 2
# Neue minimalistische Arrangements; verwendet die vorhandenen Soundfunktionen:
python3 scripts/generate-minimal-music-drafts.py
python3 scripts/generate-minimal-music-drafts.py --variant 2
# Nur den separaten vierten Entwurf erzeugen:
python3 scripts/generate-last-light-relay.py
```

Benötigt Python 3 und `ffmpeg` mit `flite`, `loudnorm` und `libmp3lame`; keine Python-Zusatzpakete. Die Generatoren gehören weder zum Spiel noch zu `npm run build`. Gleiche Werkzeugversionen und Seeds reproduzieren den Entwurf; Codec-/TTS-Versionen können das Ergebnis verändern.
