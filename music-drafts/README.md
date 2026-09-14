# Musikentwürfe

Dieses Verzeichnis enthält Hör- und Masterfassungen selbst erzeugter Musik. Freigegebene Stücke werden bytegleich nach [`../audio/`](../audio/) kopiert; die tatsächlich abgespielte Reihenfolge steht in [`src/audio.ts`](../src/audio.ts).

## Sporewake – freigegeben

[**06 – Sporewake anhören**](06-sporewake.mp3) – **108 BPM**, rund **83 Sekunden**, Stereo-MP3/44,1 kHz/224 kbit/s.

Ein Stück für den Alienplaneten: tiefe Membran- und Wurzelperkussion halten einen klaren Vierviertelpuls, während langsam atmende Intervallflächen, asymmetrische Bassimpulse und weich gleitende Kreaturenrufe den porösen Pilzwald aufgreifen. Der Anfang bleibt frei von Rauschen; die späteren Waldatem-Übergänge gehören zum Arrangement. Sechs sehr leise Sporenakzente setzen nur Farbe. Keine Glocken, Gitarren, Stimmen oder Samples.

## Rootmind – freigegeben

[**07 – Rootmind anhören**](07-rootmind.mp3) – **108 BPM**, rund **83 Sekunden**, Stereo-MP3/44,1 kHz/224 kbit/s.

Die kinetischere Alienplanet-Variante: weiche, vokalartige Samenimpulse wandern auf den Offbeats durch ein imaginäres Wurzelnetz, getragen von federnden Membranen und kurzen Basssignalen. Wenige Kreaturenrufe und Sporenakzente verbinden den Klang mit `Sporewake`; das eigenständige Arrangement verwendet kein Rauschbett, keine Glocken, Gitarren, Stimmen oder Samples.

`Sporewake` und `Rootmind` stehen in der InGame-Playlist direkt hintereinander.

## Worker-Voice-Lines

- [**01 – Worker Ready**](worker-select-01-worker-ready-awb.mp3) – „Worker ready.“; männliche Stimme `awb`, 0,84 s.
- [**02 – Awaiting Orders**](worker-select-02-awaiting-orders-rms.mp3) – „Awaiting orders.“; männliche Stimme `rms`, 1,15 s.
- [**03 – Tools Ready**](worker-select-03-tools-ready-awb.mp3) – „Tools ready.“; männliche Stimme `awb`, 0,89 s.
- [**04 – Name the Job**](worker-select-04-name-the-job-rms.mp3) – „Name the job.“; männliche Stimme `rms`, 1,07 s.
- [**05 – Where Am I Needed**](worker-select-05-where-needed-awb.mp3) – „Where am I needed?“; männliche Stimme `awb`, 1,07 s.

Jede Datei enthält genau eine kurze Äußerung. Die Varianten sind zugunsten der Verständlichkeit nahezu trocken, nur leicht verlangsamt, normalisiert und auf vergleichbare Lautheit gebracht; `awb` dient als klare Referenz, `rms` als zweite akzeptierte Stimme. Alle Fassungen sind Mono-MP3 mit 44,1 kHz/128 kbit/s, verwenden lokale generische Flite-Stimmen, ahmen keine Figur oder reale Person nach und sind noch nicht ins Spiel eingebunden.

## Herstellung und Grenzen

Entwürfe bei Bedarf neu erzeugen:

```bash
python3 scripts/generate-sporewake.py
python3 scripts/generate-rootmind.py
```

Die Worker-Zeilen wurden lokal mit FFmpegs generischen `flite`-Stimmen erzeugt, auf Sprache beschnitten und auf −18 LUFS ausgerichtet. Für bessere Verständlichkeit bleibt die Bearbeitung nahezu trocken. Es werden keine Aufnahmen oder externen Samples verwendet.

Die Musikgeneratoren verwenden ausschließlich lokale Synthese sowie Python 3 und FFmpeg; sie lesen keine Aufnahmen oder Spielassets und überschreiben jeweils nur ihre eigene MP3. Die Musiklautheit ist technisch auf −15 LUFS bei −1,5 dBTP ausgerichtet. Technische Prüfung ersetzt kein Hörurteil.

Freigegebene Fassungen bytegleich nach `audio/` kopieren, nicht neu kodieren. Bei einer Playliständerung Auswahl in `src/audio.ts` sowie die Audioeinträge in `Dockerfile` und `.dockerignore` gemeinsam anpassen.
