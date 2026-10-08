# Performance: verbleibendes Potenzial und Geräteabnahme

Zentrale Übersicht für Singleplayer-Performance, Speicher-/Thermikdruck und Grafikabbrüche. Fachissues behalten Spielregeln, Bedienung und visuelle Abnahme; Performancebefunde und nächste Messfragen werden hier gepflegt. Technische Verträge stehen in [Architektur](../../architecture.md) und [Rendering](../../rendering.md), Diagnosebedienung und Prüfgrenzen unter [Prüfungen](../../testing.md#lokale-performancediagnose). Optimierungshistorie bleibt in Git.

## Aktueller Stand und Priorität

- **Frühere Desktop-Rückmeldung, RTX 3090 laut Nutzer:** In einem früheren Spielabschnitt war der Nutzer zufrieden. Chromium erschien im getesteten Spielabschnitt nahezu konstant bei 60 FPS, gelegentlich 59 und selten 58; Firefox erreichte nicht konstant 60 FPS. Dies war menschliche Rückmeldung, keine kontrollierte Browser-A/B-Aufnahme oder allgemeine Leistungszusage.
- **Chromium bleibt die Diagnosebasis.** Die verbleibende Firefox-Differenz ist offen, aber kein Anlass für einen vorsorglichen Engine- oder Qualitätsumbau. Ein gleicher Seed allein reicht nicht zum Browservergleich: Spielstand, Kamera, Tageszeit, Auflösung und parallele Tabs beeinflussen die Last.
- **Dichte Einheiten und Auswahl:** Aktuell meldet der Nutzer spürbare Framedrops bei dicht beieinanderstehenden Einheiten; Verteilen auf der Karte verbessert die Framerate. Auch einzelne Auswahlen können kurze Einbrüche auslösen. Keine aktuelle CPU-/GPU-Zuordnung: Bewegung/Yield/Recovery und räumlich überlappende Licht-/Renderarbeit getrennt prüfen, Auswahl nicht automatisch als Wegsuche interpretieren.
- **Mobilstabilität bleibt offen:** Pixel 7, Chrome, High: schnelle Erwärmung, gelegentliche Freezes bzw. `webglcontextlost`; nach sofortigem Reload wurde vorübergehend fehlendes WebGL 2 gemeldet. Dauer, Karten-/Buildkontext und konkrete Abbruchdaten fehlen. GPU-Reset, Speicher- oder Thermikdruck sind Hypothesen, kein bewiesener Leak.
- **Integrierte GPUs und andere Szenen sind nicht allgemein abgenommen.** Positive Desktop-Rückmeldung ersetzt keine Mobil-/Laptop-, dichte-Armee-, Langrun- oder Weltwechselabnahme.

Aktuell dichte Armeen und Auswahlhänger getrennt eingrenzen; mobile Abbrüche bleiben ebenfalls offen. Die folgenden Kandidaten sind Messfragen, keine automatische Implementierungs- oder Lastlauffreigabe.

## Verbleibende CPU-Spitzen

Frühere Chromium-Unterphasenaufnahmen ordnen synchrone Saves, einzelne Wegsuchen und tatsächliche Straßenupdates konkreten Hängern zu. Die damaligen Siedlungsspitzen wurden vor der jüngsten Entlastung gemessen; ihr Restanteil ist nicht neu quantifiziert. Keinen alten Spitzenwert als aktuellen Engpass weiterführen.

- [ ] **Snapshot und Autosave:** Kopien, Gesamtserialisierung und synchrones `localStorage` können das Bildbudget überschreiten; Archivwachstum und wiederholte Upgrade-Aggregation getrennt betrachten; laufende Gefechtsrezepte und getrennte Save-Ziele bleiben unverändert. Erst am realen Spielstand Zeit und Payload messen, dann identische Arbeit reduzieren. `window.Meridian.ui.battleSaveMilliseconds` zeigt die letzte Snapshot-/Speicherdauer, `battleSaveBytes` die geschätzte UTF-16-Payloadgröße, nicht Browserquota oder Residenz. Ein `setTimeout` beseitigt keine Hauptthreadblockade. Speicherintervall, sichere Snapshotgrenze und Lebenszyklussicherungen nicht still ändern. [Spielstandsvertrag und Abnahme](../expeditions-spielstand.md).
- [ ] **Wegsuche:** Gruppenbewegung kann synchrone Suchstarts bündeln; wiederholte Terrain-/Kanten-Clearance ist ein möglicher Kostenanteil. Nur unveränderliche Prüfungen für tatsächlich verwendete Körperradien begrenzt wiederverwenden; dynamische Belegung, exakte Start-/Zielsegmente, Arbeitsbereiche und Recovery bleiben aktuell. Identische Wege, Gleichstände, Reihenfolge und RNG nachweisen. Verteilen über Ticks, Flowfields oder ein globales Suchbudget ändern Reaktionsverhalten und brauchen eine eigene Entscheidung.
- [ ] **Straßen und Siedlungslayout:** Tatsächliche Raster-/Maskenupdates und restliche Geometrieprüfungen separat messen, nicht ihre Durchschnittskosten zum dauerhaften Hauptengpass erklären. Nur identische Berechnungen günstiger ausführen; Wachstumsintervall, Kandidatenzahl/-reihenfolge, Platzierungsentscheidungen und RNG erhalten.
- [ ] **Sicht, KI, Wirtschaft und HUD:** Vollscans allein belegen keinen Engpass. Nur eine gemessen dominante Unterphase weiter aufteilen; Frequenzen, KI-Reaktion und Spielregeln nicht vorsorglich reduzieren.

## Bewegte Armeen und Navigation

- [ ] **Live-Körperprüfungen:** Viele Lenkwinkel, Gleitversuche und rekursives Yield verstärken wiederholte Entitätsscans. Einen räumlichen Broadphase-Index erst bei bestätigtem Kostenanteil prüfen. Er muss jede Positionsänderung innerhalb eines Ticks, Spawn/Tod, Recall, Restore und reservierte Ausgänge berücksichtigen; der einmal pro Tick aufgebaute Kampfhash reicht dafür nicht. Entitätsreihenfolge, exakte Prüfung, Radien, Flug-/Bodentrennung und Yield-Prioritäten unverändert lassen.
- [ ] **Befehlslatenz:** Einzel-/Gruppenbefehl, freies Ziel und Engstelle unterscheiden. Eingabe bis erstes Bild sowie unmittelbar folgende Ticks betrachten. Die derzeitige rAF-Diagnose erfasst Eingabehandler außerhalb rAF nicht vollständig; bei konkretem Bedarf begrenzte Befehlsmarker ergänzen.

**Ankunftswackeln separat behandeln.** Der Nutzer meldete anhaltendes Ausweichen trotz annähernd 60 FPS. Aggregierte Kollisions-/Yield-Aufrufe identifizieren weder eine Einheit noch ihren Ziel-/Recoveryzustand. Die offene Reproduktion gehört zur [Navigation](../worker-bauwegfindung/issue.md#gruppenankunft-und-ausweichwackeln); ein schnellerer Index behebt nicht automatisch den Verhaltensfehler.

## Renderer und GPU

- [ ] **Modellaufbau und Instanzdaten:** Bei dominanter Szenenaufbau-/Uploadzeit unveränderte Gebäudeteile bzw. fertige Transforms wiederverwenden. Baufortschritt, Waffenbewegung, Schaden, Teamfarbe, Nachtakzente, Lampen und Konturen müssen aktuell bleiben. Pufferkapazität/Teiluploads gegen bisherigen Uploadpfad messen; `bufferSubData` ist wegen möglicher Treiberstalls nicht pauschal schneller.
- [ ] **Szenenshader:** Material-/Relief-, Schatten- und lokale Lichtarbeit können auf integrierten GPUs teuer sein. Erst den tatsächlichen Szenenpass auf Zielhardware eingrenzen; gleiche Bildwirkung günstiger berechnen. Dichte beleuchtete Basen und nasse Materialien sind relevante Fälle. Bloom/Post waren in vorhandenen Chromium-Aufnahmen klein und sind ohne neuen Befund keine ersten Kandidaten.
- [ ] **Geometrie und Culling:** Detailreiche Foren, Zerstörer, Vegetation und zusätzliche Schatten-/Konturpässe können bei großen Beständen teuer werden. Räumliche Batchunterteilung nur bei bestätigter Geometrielast; mehr Buckets können mehr Draws verursachen. Vollständige Bounds einschließlich Animationen und außerhalb der Kamera liegender Schattenwerfer erhalten.
- [ ] **Menü und Ergebnis:** Nur bei erneutem konkretem Symptom untersuchen. Bewegte Weltkulisse, eigentliche UI-Öffnung und Renderziel-/Filterkosten trennen; ein Menü ist keine automatisch billige 2D-Szene.

Keine pauschale Reduktion von Auflösung, MSAA, Details, Lichtmenge, Bloom oder gewünschtem Tilt-Shift. GPU-Kosten und Treiber-/Compositoranteile lassen sich weder aus Draw-Zahlen noch aus kurzer GL-Einreichung allein ableiten. [Darstellungsabnahme](../modelle.md), [Landschaften](../project-tomorrow.md), [Bodenmaterial](../ground-material.md).

## UI und Erstaufbau

### Bauplatzraster

- [ ] Bei weitem Zoom/dichtem Bestand Erstaufbau und Kamerawechsel auf dem Nutzergerät messen: neue Terrainproben, Planung/Meshaufbau, aktuelle Belegungsvalidierung und Uploads unterscheiden. Ein früher sichtbarer Anfang und kleinere Einzelspitzen sind das Ziel, nicht eine veränderte Abtastdichte oder Ringoptik.
- [ ] Leerlaufzeit ist unter hoher Last nicht garantiert; Vorbereitung muss auch über den normalen portionierten Renderpfad fortschreiten. Geschlossenes Menü, geöffnetes Menü ohne Bauauswahl und aktives Raster als getrennte Fälle betrachten.

Genaue Klickprüfung und aktuelle Sicht-/Belegung erhalten, keine zusätzliche Wegsuche je Rasterprobe. Die bisherige Darstellung wurde im Firefox positiv bewertet; dies ersetzt keine Kostenmessung bei weitem Zoom. [Visuelle/Bauabnahme](../citybuilding.md#baugrid-darstellung-und-bedienung).

### Modellkacheln

- [ ] **Einheitenauswahl:** Kalte Portraitaufnahme und Wiederwahl eines bereits aufgenommenen Modells getrennt messen, auch bei pausierter Simulation. Unveränderte Auswahlwerte dürfen befüllte Porträts nicht verdrängen; [DOM-/Cachevertrag](../../rendering.md#modellkacheln). Verbleibende HUD-/Layoutarbeit und der Gelände-Raytest im Eingabehandler sind mögliche Kostenanteile, keine gemessenen Ursachen der Nutzer-Drops; Eingabehandler liegen außerhalb der bisherigen rAF-Zeitzuordnung.
- [ ] Bei erneutem Einbruch beim Öffnen von Codex/Baumenü erste Aufnahme und Wiederanzeige getrennt messen. Historisch wurden 60 → 30 FPS oder weniger gemeldet, aber ohne Geräte-/Diagnosekontext; kein belegter aktueller Dauerzustand.
- [ ] CPU-Layout-/Sichtbarkeitsprüfungen von kalter GPU-/Canvas-Kopie trennen. Dirty-/Resize-/Scroll-getriebene Prüfung ist ein Kandidat, falls wiederholte DOM-Rechtecke dominieren. Laufende Weltkulisse separat erfassen; `thumbnails` nicht mit deren Kosten verwechseln.

Ausschnitt, Teamfarben, Einblenden und Touchbedienung bleiben unter [Modellkacheln](../modell-kacheln.md); [Cache-/Ressourcenvertrag](../../rendering.md#modellkacheln).

## Initialisierung und Weltwechsel

- [ ] Bei konkret störender Start-/Wechselzeit CPU-Welterzeugung, Modellgeometrie, Textur-/Shaderbereitschaft, Restore und ersten Draw getrennt erfassen. Diese Arbeit liegt teilweise außerhalb rAF und wird von der laufenden Framediagnose nicht vollständig erfasst. Kalter Start, wiederholter Weltbesuch und Freigabe des vorigen Bestands sind unterschiedliche Fälle.

Identische abgeleitete Daten sind ein Wiederverwendungskandidat; Weltrezepte, Hindernisverteilung, öffentliche Terrain-/private Startquellen und RNG-Reihenfolge bleiben erhalten. Keine zweite Terrainimplementierung oder vorsorglicher Preload aller Welten. [Startabnahme](../procedural-battlefields.md), [Weltbesuche](../expeditions-spielstand.md).

## Mobilstabilität und Speicher

- [ ] Abbruch mit Gerät, Betriebssystem, Browser, Build/Commit, Karte/Seed, Spielstand, Qualität, Tempo, Dauer, Akku-/Ladezustand und Temperaturkontext sichern. Freeze, Context-loss und Reloadfehler unterscheiden; bei Überhitzungswarnung abbrechen.
- [ ] Speicherentwicklung bei Kartenwechsel, Resize, dichter Bebauung und geöffneten Vorschauen prüfen: residente Modell-/Vorschau-Meshes, Materialtexturen, Instanzpuffer, MSAA-/Schatten-/Postziele und Caches berücksichtigen. Kurzzeitige Allokationsspitzen von dauerhaft wachsender Residenz unterscheiden; Diagnosebytes sind Schätzungen, keine Treibermessung.
- [ ] Wärme, Akku, Renderintervalle und Fortsetzen nach Hintergrund/Reload auf dem betroffenen Handy beurteilen. Desktop- oder Software-WebGL-Checks ersetzen dies nicht. Qualitätsgegenproben nur zur Eingrenzung mit vergleichbarem thermischem Start, keine neue automatische Qualitätsreduktion.

Autosaves beheben nicht die Ursache von Grafikabbrüchen. Der gesonderte [Texturladefehler](../texture-loading.md) ist keine bewiesene Abbruchursache. Browserstabilität zuerst, eine [Android/WebView-Verpackung](../android.md) separat bewerten. Ein 30-FPS-Modus oder geändertes Pauseverhalten ist nicht beschlossen.

## Messplan und Erfolgskriterien

- [ ] Eindeutige Build-/Commitkennung im Diagnoseexport ergänzen; die Runtime-Versionsangabe ist derzeit nicht build-eindeutig. Bis dahin den ausgelieferten Commit separat notieren. Keine Laufzeit-Git-Abfrage, Serverpflicht oder Telemetrie.
- [ ] Nur den auffälligen kurzen Abschnitt reproduzieren: gleicher Spielstand, Kamera/Zoom, Tageszeit, interne Auflösung/DPR, Qualität und Tempo; andere Spiel-Tabs schließen. Laden/Warmup, Pause, Save und Hintergrundlücken separat kennzeichnen. Firefox und Chromium verwenden getrennte Browserprofile/Spielstände.
- [ ] CPU-Haupt-/Unterphasen, Renderintervalle/p95/p99/Maximalspitzen, Eingabelatenz und verfügbare GPU-Passzeiten unterscheiden. Unterphasen sind exklusive Anteile der Hauptphase, Aufrufe keine Einheitenzahlen. CPU und GPU überlappen; Zeiten nicht einfach addieren. Fehlende GPU-Timer sind keine Nullkosten.
- [ ] Kalte und warme Fälle sowie Allokations-/Speicherwirkung getrennt vergleichen; wechselnde A/B-Reihenfolge und mehrere kurze Proben statt unkontrollierter Vorher-/Nachheraufnahmen. Diagnose hat selbst Aufwand; synthetische CPU- oder Software-WebGL-Proben belegen keine Nutzer-FPS.

Ziel: gleichmäßigere Renderintervalle im 60-FPS-/16,7-ms-Budget, kleinere Einzelhänger und kürzere Befehlslatenz bei gleicher Szene, Bildwirkung und Spielgeschwindigkeit. Keine FPS-Zusage für alle Geräte. Caches bleiben begrenzt oder schwach referenziert; Welt-/Objektwechsel, Resize, Nacht, Fog, Schattenränder und Freigabe gezielt prüfen. Gameplay, Hindernisverteilung, Körperradien und RNG schützen; Referenzen nicht zum Grünmachen ersetzen.

[Prüf- und Freigaberegeln](../../testing.md) gelten weiterhin: kein automatischer Volllauf oder Gerätekreuzprodukt; `test:ai`/`test:simulation` auch gefiltert nur mit aktuellem ausdrücklichem Auftrag. Vollständiges Spielen bleibt unter [Run-Abnahme](../playtest-validation.md), zukünftige Netzwerkleistung unter [Multiplayer](../multiplayer.md).
