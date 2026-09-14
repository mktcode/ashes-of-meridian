# Musikentwürfe

Dieses Verzeichnis enthält Hör- und Masterfassungen selbst erzeugter Musik. Freigegebene Stücke werden bytegleich nach [`../audio/`](../audio/) kopiert; die tatsächlich abgespielte Reihenfolge steht in [`src/audio.ts`](../src/audio.ts).

## Sporewake – freigegeben

[**06 – Sporewake anhören**](06-sporewake.mp3) – **108 BPM**, rund **83 Sekunden**, Stereo-MP3/44,1 kHz/224 kbit/s.

Ein Stück für den Alienplaneten: tiefe Membran- und Wurzelperkussion halten einen klaren Vierviertelpuls, während langsam atmende Intervallflächen, asymmetrische Bassimpulse und weich gleitende Kreaturenrufe den porösen Pilzwald aufgreifen. Der Anfang bleibt frei von Rauschen; die späteren Waldatem-Übergänge gehören zum Arrangement. Sechs sehr leise Sporenakzente setzen nur Farbe. Keine Glocken, Gitarren, Stimmen oder Samples.

## Rootmind – freigegeben

[**07 – Rootmind anhören**](07-rootmind.mp3) – **108 BPM**, rund **83 Sekunden**, Stereo-MP3/44,1 kHz/224 kbit/s.

Die kinetischere Alienplanet-Variante: weiche, vokalartige Samenimpulse wandern auf den Offbeats durch ein imaginäres Wurzelnetz, getragen von federnden Membranen und kurzen Basssignalen. Wenige Kreaturenrufe und Sporenakzente verbinden den Klang mit `Sporewake`; das eigenständige Arrangement verwendet kein Rauschbett, keine Glocken, Gitarren, Stimmen oder Samples.

`Sporewake` und `Rootmind` stehen in der InGame-Playlist direkt hintereinander.

## Herstellung und Grenzen

Entwürfe bei Bedarf neu erzeugen:

```bash
python3 scripts/generate-sporewake.py
python3 scripts/generate-rootmind.py
```

Die Generatoren verwenden ausschließlich lokale Synthese sowie Python 3 und FFmpeg; sie lesen keine Aufnahmen oder Spielassets und überschreiben jeweils nur ihre eigene MP3. Die Lautheit ist technisch auf −15 LUFS bei −1,5 dBTP ausgerichtet. Technische Prüfung ersetzt kein Hörurteil.

Freigegebene Fassungen bytegleich nach `audio/` kopieren, nicht neu kodieren. Bei einer Playliständerung Auswahl in `src/audio.ts` sowie die Audioeinträge in `Dockerfile` und `.dockerignore` gemeinsam anpassen.
