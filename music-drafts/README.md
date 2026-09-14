# Musikentwürfe

Dieses Verzeichnis enthält Hörentwürfe, die nicht Teil des Spiels sind.

## Aether Bloom

- [**05 – Aether Bloom / Glass anhören**](05-aether-bloom.mp3)
- [**05 – Aether Bloom / Soft Glow anhören**](05-aether-bloom-soft-glow.mp3)

Beide Fassungen haben **122 BPM**, laufen rund **74 Sekunden** und verwenden dasselbe Arrangement sowie dieselben Melodien. `Soft Glow` ersetzt den gläsernen FM-Klang durch einen leiseren, weich einschwingenden Sinus-Pluck mit sehr wenigen Obertönen.

Ein heller Elektronikentwurf auf klarem Achtelraster: abgesetzte E-Piano-Akkorde und eine leichte Bassfigur in einer offenen lydischen Klangfarbe. Die Melodie erscheint nur in einzelnen Phrasen; der Mittelteil und der spätere luftige Abschnitt lassen bewusst Raum. Es gibt keine Gitarren, Sprachsamples oder dauerhafte Klangfläche. Beide Hördateien sind Stereo-MP3 mit 44,1 kHz und 224 kbit/s.

## Herstellung und Grenzen

`Aether Bloom` bei Bedarf neu erzeugen:

```bash
python3 scripts/generate-aether-bloom.py
python3 scripts/generate-aether-bloom.py --soft
```

Der Generator verwendet ausschließlich lokale Synthese sowie Python 3 und FFmpeg; er liest keine Aufnahmen oder Spielassets und überschreibt nur die jeweils gewählte Fassung. Die Lautheit ist technisch auf −15 LUFS bei −1,5 dBTP ausgerichtet. Technische Prüfung ersetzt kein Hörurteil.

Freigegebene Fassungen bytegleich nach `audio/` kopieren, nicht neu kodieren. Bei einer Playliständerung Auswahl in `src/audio.ts` sowie die Audioeinträge in `Dockerfile` und `.dockerignore` gemeinsam anpassen. Entwürfe bleiben bis zu einer ausdrücklichen Freigabe außerhalb der Laufzeit.
