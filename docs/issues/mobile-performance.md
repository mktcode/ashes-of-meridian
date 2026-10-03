# Performance und mobile Grafikabbrüche

## Offene Befunde

**Pixel 7, Chrome, High:** schnelle Erwärmung, nach längerer Spielzeit Freeze/`webglcontextlost`; sofortiger Reload meldete vorübergehend fehlendes WebGL 2. Karte, Dauer, Browser-/Buildversion und Last fehlen. GPU-Reset, Speicher-/Thermikdruck sind Hypothesen, kein bewiesener Leak. Abbrüche werden weiterhin gelegentlich gemeldet.

**Lokale Nutzeraufnahme:** Firefox 140/Linux, Mothership Seed 84473642, High/4× MSAA, Tempo 2, 139–202 Gesamtentitäten. Im letzten rund 102-s-Ausschnitt etwa 58,7 Render-FPS; Callback-p99 15 ms, Maximum 66 ms, davon bis 64 ms Simulation/Effekttick. Starke Spitzen um 543 s. Keine GPU-Timer, keine Buildkennung, keine konkrete Unterpfadursache. Spätere Pause/Resize separat betrachten; kein Vorher-/Nachhervergleich.

**Diagnose-Zuordnung:** Statische Codeprüfung auf Stand `e588cf2`: [Diagnoseexport](../../src/diagnostics/browser.ts) übernimmt `applicationVersion` aus der fest eingetragenen Runtime-Version `1.0.0` in [der Anwendung](../../src/app.ts). Eine eindeutige Build-/Commitkennung fehlt; verschiedene Quellstände sind damit im Export nicht zuverlässig unterscheidbar.

**Baumodus, Seed 29973391:** Nutzer meldet bei ausgebauter Basis 30–40 statt 60 FPS, mit geöffnetem Baumodus bis 7 FPS; Aufnahme zeigt das flächige Bauplatzraster. Zusätzlich kurze Hänger/FPS-Abfall bei Einheitenbefehlen; laut Nutzer vermutlich nicht bei einer einzelnen Einheit auf freier Fläche. Gerät, Browser, Karte, Qualität und Spielstand fehlen. Den Befehlsbefund getrennt vom Raster untersuchen; eine gemeinsame Ursache ist nicht belegt.

**Rasterentlastung implementiert, Geräteabnahme offen:** Wiederholte vollständige Bauprüfungen und Chunk-/Pufferneubauten sind durch einen begrenzten View-Cache und frische Belegungsbatches ersetzt; [Besitz-/Sicht-/Verzögerungsvertrag](../rendering.md#viewport-und-hud). Gezielter Node-CPU-Vergleich mit echter App-/Renderergeometrieschleife, Desert Seed 29973391, synthetischen 150 Entitäten, vollständig sichtbarem 120×90-Ausschnitt, ohne Simulationsschritte/GPU: wiederholte Rasterupdates etwa 315 → 6 ms; erster Callback etwa 331 → 12 ms. Abschluss des kalten Meshaufbaus hatte weiterhin eine Spitze bis etwa 82 ms. Keine Echtgeräte-FPS oder Rekonstruktion des Nutzerstands. Chromium über `file://` bestätigt Wiederverwendung/Freigabe der Streaming-Puffer ohne GL-Fehler; kein vollständiger laufender Baumodus- oder Performancecheck. [Modellkacheln](modell-kacheln.md) bleiben separat.

## Nächste Eingrenzung

1. Rasterentlastung auf dem Nutzergerät mit gleichem Spielstand abnehmen: geschlossenes Menü, geöffnetes Menü ohne Bauauswahl und aktives Bauplatzraster unterscheiden. Verzögertes Erscheinen, Kamerafahrt und verbleibende Erst-Meshspitze prüfen; keine pauschale Raster-/Qualitätsreduktion.
2. Befehls-Hänger eingrenzen: Befehlstyp, Zahl ausgewählter Einheiten, freies Ziel versus Engstelle sowie sofortiger Eingabehänger versus folgende Bewegung sichern. Pfadberechnung/Ausweichsuche sind nur Kandidaten; noch kein Profilbeleg.
3. Simulationsphase bei Bedarf feiner messen: Schritte je Callback, Bewegung/A*, KI, Sicht, Kampf/Wirtschaft, Effekte. Bisherige Spitzen rechtfertigen keine pauschale Optimierung eines Vollscans.
4. Handy-Reproduktion mit Gerät/Browser/Build, Karte/Seed, Qualität, Tempo, Dauer, Kartenwechsel und Akku/Ladezustand sichern. Freeze, Context-loss und Reloadfehler unterscheiden.
5. Gleichen kurzen Abschnitt getrennt in High/Balanced/Performance aufzeichnen; vergleichbaren thermischen Start herstellen, bei Überhitzungswarnung abbrechen. [Diagnosebedienung](../testing.md#lokale-performancediagnose).

## Kandidaten erst nach Profilbeleg

- **GPU:** Pixel-/MSAA-Budget, Schattenzeit, Materialshader, Effekt-Overdraw und Instanzuploads getrennt prüfen. High erhöht Szenenpixel gegenüber Balanced erheblich; weder Draw Calls noch kurze GL-Einreichung schließen einen GPU-Engpass aus.
- **CPU:** Bewegungs-/Yield-Vollscans und A*-Arbeitsfelder, erfolglose Worker-Ressourcensuche, Kampfhash-Allokationen, Mehrparteien-Sicht und Snapshot-/Interpolationsarbeit. Ein Körperindex muss während Bewegung aktuell sein, nicht der möglicherweise veraltete Kampfhash. Reihenfolge, Sicht und RNG erhalten.
- **Speicher:** tatsächliche Meshresidenz, Renderziel-/Resize-Spitzen und Materialbytes prüfen; Diagnosebytes sind Schätzungen, keine Treibermessung.

Vorhandene Entlastungen sind implementiert, nicht auf dem Handy abgenommen: 60-FPS-Renderlimit, Freigabe alter Weltgeometrie, Chunk-/Effektculling, Resize-Guards und reduzierte UI-Schreibarbeit. Keine neue Qualitätsreduktion daraus ableiten. Pause-Entlastung und 30-FPS-Modus bleiben zurückgestellt; gewünschter Tilt-Shift bleibt erhalten.

## Messplan und Abnahme

- [ ] Eindeutige Kennung des ausgelieferten Builds im Diagnoseexport ergänzen, ohne Laufzeit-Git, Serverpflicht oder zusätzliche Telemetrie. Gezielter Nachweis: unterschiedliche Builds sind unterscheidbar, Kennung entspricht dem ausgelieferten Stand. Bis dahin den Commit/Build bei jeder Aufnahme separat notieren.
- [ ] Kurze vergleichbare CPU-/GPU-Aufnahmen mit Kontext sichern; fehlende Timer nicht als Nullkosten lesen.
- [ ] Reale Kartenwechsel, Kamerafahrt, Engstelle/große bewegte Armee prüfen; nach erster Messung eingrenzen, kein Vollkreuzprodukt.
- [ ] Culling-Ränder, Bewegungswirkung des Limits und HUD unter Last menschlich abnehmen.
- [ ] Wärme, Framerate und Stabilität auf betroffenem Handy erneut beurteilen; Desktop/Software-WebGL ist kein Ersatz.

Priorität: aktive Spielperformance messen, dann bestätigten Engpass auswählen. Keine automatische Umsetzung oder Lastlauf-Freigabe. [Arbeits-/Zeitregeln](../testing.md).
