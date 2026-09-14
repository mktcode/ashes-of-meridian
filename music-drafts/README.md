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

[**Worker Select 01 – Rig Checked anhören**](worker-select-01-rig-checked.mp3) – „Rig checked, ready to work.“, rund **1,78 Sekunden**, Mono-MP3/44,1 kHz/128 kbit/s.

Eine knappe Auswahlbestätigung mit dezenter Funk-/Helmfilterung und lokaler generischer Flite-Stimme. Keine nachgeahmte Figur oder reale Person und noch nicht ins Spiel eingebunden. Dies ist bewusst zunächst die einzige Voice-Line.

## Herstellung und Grenzen

Entwürfe bei Bedarf neu erzeugen:

```bash
python3 scripts/generate-sporewake.py
python3 scripts/generate-rootmind.py
```

Die Worker-Zeile wurde lokal mit FFmpegs generischer `flite`-Stimme `slt` erzeugt, auf Sprache beschnitten, dezent bandbegrenzt und auf −18 LUFS ausgerichtet. Es werden keine Aufnahmen oder externen Samples verwendet.

Die Musikgeneratoren verwenden ausschließlich lokale Synthese sowie Python 3 und FFmpeg; sie lesen keine Aufnahmen oder Spielassets und überschreiben jeweils nur ihre eigene MP3. Die Musiklautheit ist technisch auf −15 LUFS bei −1,5 dBTP ausgerichtet. Technische Prüfung ersetzt kein Hörurteil.

Freigegebene Fassungen bytegleich nach `audio/` kopieren, nicht neu kodieren. Bei einer Playliständerung Auswahl in `src/audio.ts` sowie die Audioeinträge in `Dockerfile` und `.dockerignore` gemeinsam anpassen.
