# Performance und mobile Grafikabbrüche

## Offene Befunde

**Pixel 7, Chrome, High:** schnelle Erwärmung, nach längerer Spielzeit Freeze/`webglcontextlost`; sofortiger Reload meldete vorübergehend fehlendes WebGL 2. Karte, Dauer, Browser-/Buildversion und Last fehlen. GPU-Reset, Speicher-/Thermikdruck sind Hypothesen, kein bewiesener Leak. Abbrüche werden weiterhin gelegentlich gemeldet.

**Lokale Nutzeraufnahme:** Firefox 140/Linux, Mothership Seed 84473642, High/4× MSAA, Tempo 2, 139–202 Gesamtentitäten. Im letzten rund 102-s-Ausschnitt etwa 58,7 Render-FPS; Callback-p99 15 ms, Maximum 66 ms, davon bis 64 ms Simulation/Effekttick. Starke Spitzen um 543 s. Keine GPU-Timer, keine Buildkennung, keine konkrete Unterpfadursache. Spätere Pause/Resize separat betrachten; kein Vorher-/Nachhervergleich.

**Diagnose-Zuordnung:** Statische Codeprüfung auf Stand `e588cf2`: [Diagnoseexport](../../src/diagnostics/browser.ts) übernimmt `applicationVersion` aus der fest eingetragenen Runtime-Version `1.0.0` in [der Anwendung](../../src/app.ts). Eine eindeutige Build-/Commitkennung fehlt; verschiedene Quellstände sind damit im Export nicht zuverlässig unterscheidbar.

**Baumodus, Seed 29973391:** Nutzer meldet bei ausgebauter Basis 30–40 statt 60 FPS, mit geöffnetem Baumodus bis 7 FPS; Aufnahme zeigt das flächige Bauplatzraster. Zusätzlich kurze Hänger/FPS-Abfall bei Einheitenbefehlen; laut Nutzer vermutlich nicht bei einer einzelnen Einheit auf freier Fläche. Gerät, Browser, Karte, Qualität und Spielstand fehlen. Den Befehlsbefund getrennt vom Raster untersuchen; eine gemeinsame Ursache ist nicht belegt.

**Rasterentlastung implementiert, Geräteabnahme offen:** Wiederholte vollständige Bauprüfungen und Chunk-/Pufferneubauten sind durch einen begrenzten View-Cache und frische Belegungsbatches ersetzt; [Besitz-/Sicht-/Verzögerungsvertrag](../rendering.md#viewport-und-hud). Gezielter Node-CPU-Vergleich mit echter App-/Renderergeometrieschleife, Desert Seed 29973391, synthetischen 150 Entitäten, vollständig sichtbarem 120×90-Ausschnitt, ohne Simulationsschritte/GPU: wiederholte Rasterupdates etwa 315 → 6 ms; erster Callback etwa 331 → 12 ms. Abschluss des kalten Meshaufbaus hatte weiterhin eine Spitze bis etwa 82 ms. Keine Echtgeräte-FPS oder Rekonstruktion des Nutzerstands. Chromium über `file://` bestätigt Wiederverwendung/Freigabe der Streaming-Puffer ohne GL-Fehler; kein vollständiger laufender Baumodus- oder Performancecheck. [Modellkacheln](modell-kacheln.md) bleiben separat.

## Codebasierter Verbesserungsplan

Aktueller Nutzerbericht: auch der Startbildschirm fällt teilweise unter 60 FPS; viele Einheiten/Gebäude verschärfen die Last, Einheitenbefehle verursachen kurze Hänger. Gerät, Browser, Qualität und Spielstand für diesen Bericht fehlen. Folgende Befunde stammen aus **statischer Quellprüfung auf `6d49078`**, nicht aus einem neuen Laufzeitprofil. Aufwand ist vorhanden, sein Anteil an den gemeldeten Framezeiten noch nicht bewiesen. Ziel: unnötige Arbeit entfernen, nicht Details, Schatten, Licht, Bloom oder Tilt-Shift abschalten.

### P0 – kurze Messung richtig zuordnen

- [ ] Diagnose um opt-in Unterphasen/Zähler ergänzen: Eingabehandler/Befehlsausführung **außerhalb rAF**, Schritte je Callback, Wegsuche (Anzahl, expandierte Knoten, Direktweg versus A*), Bewegung/Yield, KI, Sicht sowie Autosave getrennt von allgemeiner UI. Keine Timer je Nachbar-/Shaderoperation; begrenzte Aggregate. Der bestehende Export kann einen Eingabehänger nicht ausreichend dem Befehlspfad zuordnen.
- [ ] Ein Menüabschnitt und ein dichter Gefechtsabschnitt auf betroffener Hardware: CPU-Framezeit und GPU `shadow`/`scene`/`bloom`/`post`, Renderintervalle und lange Einzelbilder erfassen. Für Menü zusätzlich Himmel separat messen; Browsertrace bei niedriger FPS trotz kurzer CPU-/GPU-Phasen für Compositor, GC und Scheduling. Warmzustand und Erstöffnung getrennt halten.
- [ ] Im selben Gefechtsstand Einzel- und Gruppenbefehl, freies Ziel und Hindernis unterscheiden. Eingabe bis erstes neues Bild sowie unmittelbar folgende Ticks messen. Nicht vorsorglich alle Karten/Qualitäten kreuzen.

### P1 – identische Arbeit wiederverwenden

**Menühimmel: Cache implementiert, Geräteabnahme offen.** Der zeit-/kameraunabhängige Himmels-/Planetenhintergrund wird in voller Szenenauflösung einschließlich vorhandener MSAA-Kantenglättung wiederverwendet; [Cache- und Ressourcenvertrag](../rendering.md#menü-landschaftswechsel). Warme Frames zeichnen nur eine Texelkopie statt Noise/Sterne und Planetenkugeln. Welt, dynamische Schatten, Szenen-MSAA, Bloom und Post bleiben live: ein Startbildschirm ist weiterhin keine billige 2D-Ansicht.

- [ ] Menüframerate und Wärme auf betroffenem Gerät sowie Planetenkanten/Überdeckung bei Kamerafahrt menschlich abnehmen; zusätzlicher Bildspeicher gegen Entlastung beurteilen. Gezielte Cachetests prüfen Wiederverwendung, Invalidierung und Allokationsfallback. Technischer Chromium-Check über `file://`: kalter und warmer isolierter Himmel in Atmosphären-/Weltraumvariante bei allen drei Qualitätsstufen pixelgleich, einschließlich 4× MSAA; Resize und Freigabe ohne GL-/Seitenfehler. Keine FPS-Messung oder Echtgeräte-/visuelle Abnahme.

**Menü-/Ergebnisscreens:** Nutzer bestätigt Entlastung durch die bisherigen Änderungen, meldet aber weiterhin niedrige FPS auch außerhalb des Startbildschirms. Quellprüfung zeigt: andere Menüs zeichnen ebenfalls die bewegte 3D-Kulisse, Sieg/Niederlage bauten trotz gestoppter Simulation weiterhin Szene/Schatten/Bloom auf und aktualisierten das versteckte HUD. Nun werden [statische Kinoschatten](../rendering.md#menü-landschaftswechsel) und die [stationäre Ergebnisszene](../rendering.md#ergebnisdarstellung) wiederverwendet. Keine pauschale Reduktion von Auflösung, Grafikdetails oder Animationen.

- [ ] Menüs sowie Sieg/Niederlage auf betroffenem Gerät vergleichen, inklusive Rückkehr, Resize/Qualitätswechsel und CSS-Unschärfe im Ergebnis. Gezielte Tests sichern Passauslassung, Invalidierung, Allokationsfallback, HUD- und Uhrengrenzen. Chromium/Software-WebGL über `file://` bestätigt Tiefenkopie, warme Frames ohne statischen Schatten-Draw, wiederverwendeten Ergebnis-Post-Pass und Freigabe ohne GL-Fehler (Balanced/High mit 4× MSAA). Bildvergleich zeigte nur vereinzelte Kanalabweichungen von 1/255, auch zwischen wiederholten direkten Renderings; keine Zusage bitidentischer Gesamtausgabe. Keine Echtgeräte-FPS-/Wärmemessung oder menschliche visuelle Abnahme. Tiefencache kostet bei aktueller Schattenauflösung geschätzt 9 MiB zusätzlich; Ergebniswiederverwendung benötigt keinen Zusatzbildspeicher.

**Wegsuche (CPU/Allokationen; mittlerer Eingriff).** [`setOrder`](../../src/simulation/movement.ts) leert Wege und setzt `nextPath = 0` für jede betroffene Einheit. `command` selbst berechnet bei normalen Bewegungsbefehlen **keine Wege**; im folgenden Tick ruft `move` je Einheit `pathTo` auf. Hindernisse können so viele synchrone A*-Suchen bündeln. [`Battlefield.path`](../../src/world.ts) hat einen Direktweg-Fastpath und verwendet A*-Arbeitsfelder/Heap jetzt wieder. Pro expandierter Kante bleiben wiederholte Terrain-/Clearanceprüfungen bestehen. Ein Gruppenpfad ist wegen verschiedener Start-/Formationsziele und Radien nicht einfach austauschbar.

**Suchspeicher wiederverwendet, Befehlsabnahme offen:** weltgebundene Arbeitsfelder und Heap-Einträge vermeiden erneute rastergroße Allokationen je A*-Suche; Zurücksetzen betrifft nur berührte Zellen. [Besitz-/Verhaltensvertrag](../architecture.md#welt-darstellung-und-zufall). Gezielte Prüfungen sichern Wiederverwendung, Gleichstände, getrennte Welten/verschachtelte Aufrufe und Bereinigung bei Fehler/Budgetende. Direkter Vergleich mit dem bisherigen Code auf kleinen Raster-/Terrainfällen ergab identische Wege, Status und Heap-Entnahmereihenfolgen; betroffene Arbeitsbereichs-, Recovery-, Bau- und Exitregressionen bestehen. Keine Framerate-/Befehlslatenzmessung oder breite KI-/Simulationsabnahme.

- [ ] Gruppenbefehle an freiem Ziel und Engstellen auf betroffenem Gerät abnehmen. Die synchrone Bündelung vieler Suchen bleibt bestehen; geringere Allokationslast ist keine Garantie, dass sämtliche Befehlsruckler verschwinden.
- [ ] Danach statische Zell-/Kanten-Clearance für die tatsächlich verwendeten Körperradien begrenzt cachen, wenn Terrainprüfungen dominieren. Dynamische Belegung, exakte Start-/Zielsegmente, Arbeitsbereiche und Recovery-Raster weiter frisch prüfen. Nicht allein nach `pathVersion` vermeintlich identische Suchen teilen.
- [ ] Kein vorgezogener Scheduler-/Flowfield-Umbau: ein globales Pfadbudget oder verteilte Gruppenplanung ändert Reaktionszeit und Tickverhalten. Nur gesondert entscheiden, falls identische Wiederverwendung die Spitzen nicht ausreichend senkt; [Navigationsgrenzen](worker-bauwegfindung/issue.md).

### P2 – Skalierung bei Armeen und Basen

**Live-Körperindex (CPU; höheres Verhaltensrisiko).** [`unitFits`, `move`, `yieldUnitSpace`](../../src/simulation/movement.ts) scannen wiederholt `s.entities`. Bis zu sieben Lenkwinkel, weitere Gleitversuche und rekursives Yield verstärken die Kosten in Engstellen. Bei vielen bewegten Einheiten entsteht ein annähernd quadratischer Anteil, inklusive unnötiger Prüfung weit entfernter Einheiten/Ressourcen/Gebäude.

- [ ] Eigenen räumlichen Broadphase-Index für Live-Körper und reservierte Exitpositionen einsetzen, nicht den einmal pro Tick gebauten Kampfhash. Jede Positionsänderung, Spawn, Tod, Recall, Exitänderung und Restore berücksichtigen. Kandidaten in bisheriger Entitätsreihenfolge prüfen; exakte Kollisionsprüfung, Radien, Flug/Boden-Trennung und Yield-Prioritäten bleiben gleich. Zunächst Vollscan/Index auf identische Ergebnisse vergleichen. Keine Grafikänderung, aber gezielte Navigations-/Simulationsregression erforderlich.

**Modellaufbau und Uploads (CPU/GPU; mittlerer bis größerer Eingriff).** [`battlefield`](../../src/app.ts) ruft für sichtbare Entitäten je Renderbild `renderEntity` auf. [`begin`/`upload`](../../src/renderer/runtime.ts) leeren dynamische Instanzzahlen und laden schmutzige Buckets mit `bufferData` neu. Meshgeometrie selbst wird bereits wiederverwendet; betroffen sind Modellaufbau, Transforms und Instanzdaten, nicht ein Neubau sämtlicher Meshes. Auch Gebäude mit vielen unbewegten Teilen laufen durch diesen Pfad; Verdeckungskonturen und Schatten zeichnen zusätzliche Geometrie.

- [ ] Bei dominanter `sceneBuild`-/Uploadzeit zuerst feste Gebäudeteile von Türmen, Baufortschritt, Nachtakzenten und Animationen trennen bzw. fertige Instanzdaten cachen. Invalidierung bei Pose, Bau-/Schadensdarstellung, Teamtönung, Tageszeit und Weltwechsel definieren; Lichtmeldung und Konturen müssen aktuell bleiben. Keinesfalls ganze Gebäudeanimationen einfrieren.
- [ ] Pufferkapazität behalten und nur geänderte Bereiche hochladen; `bufferSubData` gegen bisheriges Orphaning messen, nicht pauschal als schneller annehmen (Treiberstalls möglich). Instanzbytes und CPU/GPU-Zeit statt nur Draw Calls vergleichen.
- [ ] Erst bei bestätigter GPU-Geometrielast dynamische Buckets räumlich unterteilen. Entitäts-/Terrainculling existiert bereits; zusätzliche Grenzen müssen große Modelle, Konturen und außerhalb des Bildes liegende Schattenwerfer erhalten. Mehr Buckets können zusätzliche Draw Calls kosten.

### P3 – weitere Spitzen gezielt statt pauschal angehen

- **Autosave:** [`autosaveBattle`](../../src/ui/core.ts) sichert im aktiven Spiel alle fünf Sekunden synchron Snapshot und Profil über `localStorage` im rAF-Pfad. Savezeit/-bytes existieren bereits als UI-Werte. Periodische Spitzen damit korrelieren; erst dann Kopien/Serialisierung reduzieren. Ein bloßes `setTimeout` beseitigt die Hauptthreadblockade nicht. Speicherintervall, konsistenter Tick-Snapshot und Lebenszyklussicherungen nicht still ändern; [Spielstand](expeditions-spielstand.md).
- **Sicht/KI/Wirtschaft:** Sicht wird bereits nur alle 0,35 Simulationssekunden erneuert, HUD/Minimap etwa alle 0,25 Echtzeitsekunden. Wiederkehrende Vollscans allein belegen keinen Hauptengpass. Nur dominante Unterphase weiter untersuchen; Sichtfrequenz und KI-Reaktion nicht vorsorglich reduzieren.
- **Kacheln/Bauplatzraster:** Standbildcache beziehungsweise View-Cache sind bereits implementiert. Verbleibende Erstaufnahme kann synchron aus WebGL nach Canvas kopieren; Thumbnail-Update liest außerdem jedes Renderbild DOM-Rechtecke, auch bei Cachetreffern. Bei Layoutkosten Dirty-/Resize-/Scroll-getriebene Sichtbarkeitsprüfung prüfen. Kalte Raster-Meshspitze separat messen. Nicht dieselben Caches erneut planen; [Kacheln](modell-kacheln.md), Rasterbefund oben.
- **Material-/Postshader:** neun Schattenabfragen, triplanare Materialien, bis zu acht lokale Lampen und High-Tilt-Shift sind reale Fragmentarbeit, aber ohne GPU-Profil keine belegte Ursache. Bei Bedarf gleiche Resultate günstiger berechnen oder verdeckte Arbeit vermeiden; keine pauschale Senkung von Auflösung, MSAA, Lichtbudget oder Details. Statische Schatten nicht blind cachen: animierte Modelle/Vegetation und veränderliche Projektionsgrenzen bleiben relevant.

### Reihenfolge und Erfolgskriterien

P0 schafft Zuordnung, danach den gemessenen Hauptpfad wählen: für Menü P1-Himmel, für Befehle P1-Wegsuche, für laufende dichte Armeen P2-Körperindex, für dichte sichtbare Basen P2-Instanzdaten. Kleine Einzeländerungen mit gleichem Ausgangsstand vergleichen, keine gleichzeitige Großsanierung.

Ziel sind gleichmäßigere Renderintervalle bei 60 FPS (16,7 ms Budget), kleinere p95/p99-/Maximalspitzen und kürzere Befehlslatenz bei gleicher Szene/Qualität/Spielgeschwindigkeit; keine zugesagten FPS-Gewinne ohne Messung. CPU und GPU nicht einfach addieren, da ihre Arbeit überlappen kann. Mehr Cache darf keinen unbeschränkten Speicheranstieg verursachen. Culling-/Cacheänderungen technisch auf Weltwechsel, Resize, Nacht, Fog und Schattenränder prüfen, Bildwirkung menschlich abnehmen. Navigation zusätzlich auf identische Wege, Ergebnisse, Reihenfolge und RNG prüfen, ohne Referenzen neu zu erzeugen. `test:ai`/`test:simulation` auch gefiltert nur mit gesondertem aktuellem Auftrag.

## Ergänzende Geräteabnahme

- Rasterentlastung mit gleichem Spielstand abnehmen: geschlossenes Menü, geöffnetes Menü ohne Bauauswahl und aktives Bauplatzraster unterscheiden. Verzögertes Erscheinen, Kamerafahrt und verbleibende Erst-Meshspitze prüfen.
- Handy-Reproduktion mit Gerät/Browser/Build, Karte/Seed, Qualität, Tempo, Dauer, Kartenwechsel und Akku/Ladezustand sichern. Freeze, Context-loss und Reloadfehler unterscheiden. Tatsächliche Meshresidenz, Renderziel-/Resize-Spitzen und Materialbytes prüfen; Diagnosebytes sind Schätzungen, keine Treibermessung.
- Qualitätsvergleich nur zur Eingrenzung eines bestätigten GPU-Problems: gleicher kurzer Abschnitt, vergleichbarer thermischer Start, bei Überhitzungswarnung abbrechen. High erhöht das Pixelbudget gegenüber Balanced; weder Draw Calls noch kurze GL-Einreichung schließen einen GPU-Engpass aus. [Diagnosebedienung](../testing.md#lokale-performancediagnose).

Vorhandene Entlastungen sind implementiert, nicht auf dem Handy abgenommen: 60-FPS-Renderlimit, Freigabe alter Weltgeometrie, Chunk-/Effektculling, Resize-Guards und reduzierte UI-Schreibarbeit. Keine neue Qualitätsreduktion daraus ableiten. Pause-Entlastung und 30-FPS-Modus bleiben zurückgestellt; gewünschter Tilt-Shift bleibt erhalten.

## Messplan und Abnahme

- [ ] Eindeutige Kennung des ausgelieferten Builds im Diagnoseexport ergänzen, ohne Laufzeit-Git, Serverpflicht oder zusätzliche Telemetrie. Gezielter Nachweis: unterschiedliche Builds sind unterscheidbar, Kennung entspricht dem ausgelieferten Stand. Bis dahin den Commit/Build bei jeder Aufnahme separat notieren.
- [ ] Kurze vergleichbare CPU-/GPU-Aufnahmen mit Kontext sichern; fehlende Timer nicht als Nullkosten lesen.
- [ ] Reale Kartenwechsel, Kamerafahrt, Engstelle/große bewegte Armee prüfen; nach erster Messung eingrenzen, kein Vollkreuzprodukt.
- [ ] Culling-Ränder, Bewegungswirkung des Limits und HUD unter Last menschlich abnehmen.
- [ ] Wärme, Framerate und Stabilität auf betroffenem Handy erneut beurteilen; Desktop/Software-WebGL ist kein Ersatz.

Priorität: aktive Spielperformance messen, dann bestätigten Engpass auswählen. Keine automatische Umsetzung oder Lastlauf-Freigabe. [Arbeits-/Zeitregeln](../testing.md).
