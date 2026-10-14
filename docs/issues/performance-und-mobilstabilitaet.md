# Performance und Mobilstabilität

Zentrale offene Messfragen, keine Optimierungsfreigabe. [Werkzeuge](../scene-capture.md),
[Messgrenzen](../testing.md), [Freigaben](../../AGENTS.md#prüfungen).
Abgeschlossene Optimierungen und A/B-Zahlen stehen in Git, nicht als aktuelle FPS-Zusage hier.

## Nutzerbefunde

- **Dichte Armeen/Auswahl:** Firefox mit maximaler Armee nach Korrekturen laut Nutzer
  meistens über 55 FPS, deutlich verbessert. Einzelne Auswahlhänger nicht gesondert
  abgenommen; Spielstand/Kamera/Tageszeit/Auflösung fehlen. Kurze synthetische Proben
  zeigen sowohl Bewegung/Kollision als auch dichteabhängige Nachtlichtkosten,
  keine bewiesene Ursache des Nutzerfalls. Jüngste 144-Schützen-Probe auf `f7491a8`,
  High/DPR 1, Chromium/ANGLE OpenGL, RTX 3090: überwiegend 60-Hz-Intervalle, aber
  CPU-Spitzen über 20 ms; Nacht-GPU meist etwa 5 ms. Nur fünf Sekunden je Fall,
  streuende Ergebnisse, kein Firefox-/Mobil-/Langrunbeleg.
- **Unerreichbare Gruppenziele, Firefox:** wiederkehrende Hänger nach Gruppenbefehl
  gemeldet; Screenshot, aber kein Save/Build/Seed/Gruppengröße/Intervall gesichert.
  Wiederholte Wegsuche/Recovery nur Hypothese. Lokale Gruppenzielkorrektur garantiert
  keine vollständige Erreichbarkeit. Nicht mit [Generierungsabbruch](terrain-generation.md#generierungsabbrüche) verwechseln.
- **Pixel 7, Chrome, High:** schnelle Erwärmung, Freezes/`webglcontextlost`, unmittelbar
  nach Reload vorübergehend kein WebGL 2. Dauer/Build/Szene fehlen; GPU-Reset,
  Speicher-/Thermikdruck sind Hypothesen, kein bewiesener Leak.
- Frühere RTX-3090-Rückmeldung: Chromium nahezu 60 FPS, Firefox weniger konstant.
  Keine kontrollierte Browser-A/B-Probe. Integrierte GPUs/andere Szenen nicht allgemein abgenommen.

## Nächste Eingrenzung

- [ ] Dichte Armee laufend/pausiert und Tag/Nacht getrennt am Nutzer-Spielstand;
  Kollisions-/Yieldarbeit, Szenenaufbau, HUD/Layout und kalte Porträts unterscheiden.
  [Ankunftswackeln](navigation-worker-und-gruppenankunft.md#gruppenankunft-und-ausweichwackeln)
  ist unabhängig von FPS.
- [ ] Auswahl kalt versus wiederverwendetes Modell, auch pausiert. Picking, HUD/Layout,
  GPU-/Canvas-Kopie und folgende Ticks separat erfassen, Auswahl nicht pauschal als Wegsuche behandeln.
- [ ] Unerreichbares Ziel: kurzen auffälligen Abschnitt samt Such-/Recoveryaufrufen,
  Pause-Gegenprobe und Autosavezeitpunkten sichern, bevor Budgets/Recovery geändert werden.
- [ ] Mobilabbruch mit Gerät/OS/Browser, Build, Karte/Seed, Save, Qualität/Tempo,
  Dauer, Akku/Ladezustand und Temperaturkontext erfassen. Freeze, Context-loss und
  Reloadfehler trennen; bei Überhitzungswarnung abbrechen.

## Weitere Kandidaten nur bei gemessenem Anteil

- [ ] Snapshot/Autosave: Kopien, Upgrade-Aggregation, Gesamtserialisierung und synchrone
  Storagewrites am realen Archiv messen. `window.Meridian.ui.battleSaveMilliseconds`
  und `battleSaveBytes` sind Dauer/UTF-16-Schätzung, keine Quota/Residenz.
  `setTimeout` beseitigt keine Hauptthreadblockade; Speichergrenzen nicht ändern.
- [ ] Wegsuche/Live-Körper: Suchstarts, Terrain-/Kanten-Clearance und verbleibende
  geordnete Scans. Nur identische unveränderliche Prüfungen wiederverwenden.
  Flowfields, globales Budget oder Verteilung über Ticks ändern Verhalten und brauchen Entscheidung.
- [ ] Straßen/Siedlung: tatsächliche Raster-/Maskenupdates und restliche Geometrie getrennt;
  Wachstumstakt, Kandidatenreihenfolge und Platzierungsentscheidungen erhalten.
- [ ] Baugrid: Erstaufbau/Kamerawechsel bei weitem Zoom/dichtem Bestand, Terrainproben,
  Meshaufbau, Belegungsvalidierung und Uploads unterscheiden. Keine geänderte Rasterdichte/
  Ringoptik; Leerlaufzeit ist nicht garantiert, normale Vorbereitung muss weiterlaufen.
- [ ] GPU: Material/Relief, lokale Nachtlampen, nasse Böden, Detailgeometrie und zusätzliche
  Schatten-/Konturpässe auf Zielhardware. Persistente Instanzen/Teiluploads/Culling nur
  bei dominantem Anteil; mehr Buckets/`bufferSubData` sind nicht automatisch billiger.
- [ ] Start/Weltwechsel: CPU-Generation, Modelle, Shader/Materialbereitschaft, Restore,
  erster Draw getrennt; teilweise außerhalb rAF. Kein Preload aller Welten.
- [ ] Residenz bei Welt-/Qualitäts-/Größen-/Vorschauwechseln: kurze Spitzen gegen dauerhaftes
  Wachstum unterscheiden. Caches begrenzt/schwach, Ressourcenfreigabe gezielt prüfen.

Keine pauschale Reduktion von Qualität, Auflösung, Details, Lampen, Bloom oder gewünschtem
Tilt-Shift. Sicht-/KI-/Wirtschaftsvollscans allein beweisen keinen Engpass.

## Konservativer Randfall

Bei weiterer Terrain-Ray-Kandidatensuche Toleranzen erhalten: `extent=64`, `step=2`,
`size=65`, Höhe 2 mit entferntem Peak 4; Strahl von `[-65.00000005,4,-63.00000005]`
nach `[-63.00000005,0,-65.00000005]`. Exaktes X/Z-Clipping verliert den von der
Dreieckstoleranz erlaubten Treffer `(-64.00000005,-64.00000005)`.
Radiusbehaftete Segmente brauchen quadratische Clearance, nicht bloße Mittellinien-DDA.
Lichtshader klemmt Außenpositionen auf Randzellen; konservative Lichtbeiträge und
Fallbacks erhalten, bei Teiluploads alle referenzierten Zeilen aktualisieren.

## Vergleichsvertrag

Gleicher Save, Kamera/Zoom, Tageszeit, Auflösung/DPR, Qualität/Tempo; andere Tabs schließen.
Buildkennung sichern, kalte/warme Fälle, Laden/Save/Hintergrund und thermischen Start trennen.
Mehrere kurze wechselnde A/B-Proben; CPU, Renderintervalle/p95/p99, Eingabearbeit und GPU
nicht addieren oder verwechseln. Software-/synthetische Szenen sind kein Geräte-FPS-Nachweis.
Ziel: gleichmäßigere 60-FPS-/16,7-ms-Intervalle und weniger Hänger bei gleicher Bildwirkung,
Spielzeit und Regeln. Keine allgemeine FPS-/Speicherzusage; [Run-Abnahme](playtest-validation.md).
