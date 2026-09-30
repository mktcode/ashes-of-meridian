# Projektanalyse und Fahrplan nach Project Tomorrow

**Analysebasis:** Commit `41243af`. Dieser Bericht ist eine Empfehlung und Entscheidungsgrundlage, **kein Implementierungsauftrag**. Er bündelt die nächsten Prioritäten; technische Einzelheiten und Abnahmen bleiben in den verlinkten Fachissues. Nach Umsetzung bzw. neuer Planung aktualisieren oder auflösen, nicht als dauerhaftes Worklog fortschreiben.

## Kurzurteil

Ashes of Meridian braucht derzeit **keine neue Engine**, sondern einen Konsolidierungszyklus. Die wichtigsten übertragbaren Ideen aus [Project Tomorrow](project-tomorrow.md) sind bereits gut umgesetzt. Der nächste große Qualitätsgewinn entsteht nicht durch noch mehr prozedurale Details, sondern durch **verlässliche Bedienung, taktische Lesbarkeit, gemessene Performance und abwechslungsreiche Entscheidungen**.

Die technische Vielfalt ist deutlich weiter als ihre Spiel- und Geräteabnahme. Deshalb zunächst vorhandene Systeme zu einem verlässlich guten Spiel zusammenführen, dann gezielt erweitern. „Alle Bilder ersetzen“ oder „alles poolen“ sind keine sinnvollen Abschlusskriterien.

## Was bereits gut umgesetzt ist

| Idee aus dem Video | Tatsächlicher Stand | Bewertung |
| --- | --- | --- |
| Materialrezepte statt Einzeltexturen | `renderer/materials.ts` bäckt acht begrenzte Oberflächenrezepte mit gemeinsamer Albedo/Mikrohöhe; kosmetische Seedvariation ohne Texturcache je Welt. | Sehr gute Übertragung. Eigene TypeScript-Rezepte reichen; Substance ist keine Voraussetzung. |
| Detail ohne zusätzliche Geometrie | High/Balanced leiten Oberflächengradienten aus der gebackenen Höhe ab; Performance verzichtet darauf. | Funktional dem Normalmap-Gedanken verwandt, aber kein identischer Normalmap-/Painter-Workflow und kein belegter FPS-Gewinn. |
| Datengetriebene Landschaften | Alle sieben Katalogkarten komponieren eigene Familien. Frontier variiert zusätzlich Größe und Routengraph; Haven fixiert ein Design. Landschaft, Gefecht und Atmosphäre sind getrennt. | Solide Content-Architektur, weit mehr als bloße Farbwechsel. |
| Prozedurale Vegetation/Modelle | Wiederverwendbare Pflanzenfamilien, einmalig erzeugte Meshes, Instanzierung; individuell registrierte Einheiten/Gebäude. | Gute Skalierung der Autorenarbeit. Neue Silhouetten erfordern trotzdem Gestaltung und Abnahme. |
| Wiederverwendung kurzlebiger Objekte | `effects.ts` poolt Partikel/Rauch und verdichtet Effekt-/Textarrays in-place; freie Poolobjekte sind gemeinsam begrenzt. | Sinnvoll begrenzt. Geschosse und Einheiten bewusst nicht pauschal wiederverwenden. |
| Gemeinsame Simulation statt eigener Logik pro Gegner | Feste Schritte, gemeinsame Bewegungs-/Kampf-/Wirtschaftsaktionen, KI als regulärer Akteur; Server nutzt denselben CPU-Code. | Bereits eine gute Ausgangslage. Kein Unity-DOTS/Burst und keine parallele Mehrkernsimulation, aber auch kein belegter Bedarf für eine Neuimplementierung. |
| Systemische Animation | Tender-Lauf, Mottenflügel, gerichtete Türme, Fahrzeug-Hanglage und lokale Flugfreiraumhüllen folgen gemeinsamem Zustand/Geometrie. | Gute Ansätze ohne Animation pro Sonderfall. Keine allgemeine IK-/Waffen-Körper-Reaktionsarchitektur; deren Nutzen müsste zuerst an konkreten Modellen sichtbar werden. |

Besonders wertvoll ist die gemeinsame CPU-Oberfläche: Geländehaut, Picking, Navigation, Fundamente und Höhenposen sind nicht unabhängig nachgebaut. Diesen Vertrag ebenso wie Sichtfilter, Ressourceninitialisierung und Zufallsreihenfolgen schützen.

## Wo die Video-Vision noch nicht vollständig erreicht ist

### 1. Varianten sind noch nicht überall neue Spielsituationen

Die sieben Karten haben viel mehr Erscheinungs- und Höhenvariation. Das bedeutet aber nicht sieben beliebig wandelbare strategische Grundrisse. `battlefields/catalog.ts` komponiert weiterhin authored Basisrezepte; Frontier besitzt mit `highlands.ts` den deutlichsten variablen Aufbau. Alien ergänzt eigenständige Berg-/Kraterrandfelder, schützt aber die bestehenden Wirtschaftsflächen und Korridore.

Das ist sinnvoll für Fairness und Reproduzierbarkeit. Es erklärt zugleich, warum mehr Vegetationsfamilien nicht automatisch andere Entscheidungen erzeugen. Der nächste Ausbau sollte **ein** Rezept nachweisbar strategisch variabler machen, statt alle Karten noch einmal grafisch zu überziehen: andere Flankenverbindungen, zusammenhängende Baugebiete und Expansionsrisiken. Ressourcenverschiebung oder neue Engstellen sind bewusste Gameplay-/Layoutänderungen, keine kosmetische Optimierung.

### 2. „Smart Materials“ sind teilweise umgesetzt

Geländematerialien reagieren bereits auf Neigung, Höhe und Habitat. Gebäudematerialien verwenden überwiegend lokale Projektion, Vertex-Tints, prozedurale Muster und modellierte Kanten. Eine allgemeine automatische Erkennung echter Meshkanten und Vertiefungen mit gebackenen Verschleiß-/Schmutzmasken ist damit nicht umgesetzt.

**Empfehlung:** später ein einzelnes Cinder-Pact-Gebäude als Pilot für geometriebezogene Verschleißmasken wählen, sofern der Unterschied bei normalem Spielzoom erkennbar ist. Kein neuer Materialgraph-Editor, keine flächendeckende Modellmigration und keine zusätzliche teure Frame-Analyse.

### 3. Die Welt reagiert optisch, aber heilt nicht als Spielsystem

Wetter, Kampfspuren und Lebens-/Produktionsanimationen geben der Szene Aktivität. Ein systemischer Weltwandel wie die Terraforming-Heilung im Video existiert nicht. Das ist **keine notwendige Lücke**: Ashes of Meridian hat einen anderen Core Loop. Terrainheilung, dynamische Vegetation und Terraforming würden Regeln, Navigation und Persistenz verändern. Nicht aus dem Inspirationsvideo heraus übernehmen.

### 4. Skalierbarkeit ist konstruiert, aber nur teilweise empirisch belegt

Instanzierung, Chunk-Culling, Ressourcenfreigabe und begrenzte Budgets sind vorhanden. Alle Qualitätsstufen behalten jedoch dieselben Einheitenmodelle, und mehrere komplexe Materialien bleiben auch in Performance rechenintensiv. `renderer/runtime.ts` allokiert bei `resize()` Renderziele erneut, selbst wenn deren Maße unverändert bleiben; dynamische Instanzbuckets beginnen regulär mit 1024 Einträgen. A* legt pro Suche rastergroße Arbeitsfelder an, und Bewegungsproben lesen lebende Einheiten über Vollscans.

Das sind konkrete Kostenformen, **keine bewiesenen Engpässe**. Die dokumentierte Nutzeraufnahme lokalisiert bereits relevante Spitzen in der Simulationsphase, trennt aber noch nicht Bewegung/Wegsuche, KI, Sicht, Kampf und GC. Mobile Kontextverluste sind gemeldet; ihre Ursache ist nicht geklärt. Maßgeblich: [Mobile Performance](mobile-performance.md).

## Karten, Modelle und Spielfluss

### Karten

- **Frontier:** beste technische Referenz für variable Welten. Hier zunächst Größe, frühe Wirtschaftswege, vier Starts und Landungspakete gemeinsam spielen; grafische und strategische Vielfalt getrennt beurteilen.
- **Alien Planet:** starkes Identitätsangebot durch acht Pflanzen-/Materialfamilien und zwei Großformen. Im gezielt betrachteten Seed 9 bleiben breite helle Freiflächen und deutlich pigmentierte Wege dominant; Berge gliedern Teile des Ausschnitts. Das ist plausibel aus den geschützten Talreserven, nicht automatisch ein Generierungsfehler. Nächste Stilfrage: wirken Wege und offene Flächen natürlich komponiert, und bleibt hinter hohen Formen die Armee bedienbar? Keine pauschale Verdichtung der gesamten Fläche.
- **Desert:** gute eigenständige Canyonidentität. Innen-/Außenanschluss, Fahrzeug-Gegenverkehr, Bauflächen und Flugabstände haben mehr Wert als eine weitere Materialfamilie.
- **Westmark:** Flüsse und Brücken liefern bereits räumliche Orientierung und strategische Struktur. Jahreszeitgestaltung darf diese Orientierung nicht überdecken; Brücken sind wichtige Crowd- und Eingabeprüfstellen.
- **Mothership:** Decks/Rampen und Höhensicht sind echte spielerische Identität. Lesbarkeit der Stufen und der offenen Angriffsachse prüfen, statt generische Naturvariation anzustreben.
- **Aurelion:** Stadtidentität plus Echo-Bergung erzeugen bereits einen anderen Entscheidungsraum. Dieses vorhandene Missionssystem zuerst auf Transporte, Eskorten und Rückmeldung spielen, bevor Holdout dazukommt.
- **Haven:** wertvoller kuratierter Gegenpol und reproduzierbare Vergleichskarte. Nicht jede Karte muss maximal zufällig sein.

Die Aussagen zu den übrigen Karten basieren auf Quellen und vorhandenen Befunden, nicht auf neuen vollständigen Partien auf allen Karten.

### Modelle

Die eigene Registrierung pro Fraktion/Rolle ist wartbar. Stichproben im Tender und Sky-Sepulcher zeigen einmalig gebackene komplexe Körper, kleine Renderassembler und zustandsabhängige Animation statt Meshaufbau im Frame. Choir/Court unterscheiden Rollen bereits über Anatomie und Form, nicht nur Farbe.

Nächste Priorität ist **Erkennbarkeit bei Gefechtszoom**, nicht zusätzliche Nahaufnahmendetails: Worker vs. Kampftruppe, Medic vs. Commander, Panzer vs. Artillerie sowie eigene vs. feindliche Partei derselben Fraktion. Portraits nach bestätigtem Modellstil gezielt abgleichen/erneuern; die [Choir-/Court-Abnahme](choir-court-einheiten.md) benennt das bereits als Folgearbeit. Die künstlerische Qualität sämtlicher Modelle wurde in diesem Audit nicht neu visuell bestätigt.

### Spielfluss

Basisbau, Rekrutierung, Vorteile, permanente Upgrades und FFA ergeben bereits einen vollständigen Core Loop. Die größte offene Produktfrage ist nicht „fehlt genug Content?“, sondern „bleibt ein Run nach mehreren Gefechten interessant und verständlich?“.

Wichtige Prüfstellen: Einstieg ohne permanente Upgrades; erkennbarer Nutzen der Vorteilswahl; Sprünge auf Stage 4/8; Nutzen aller Fraktionen; frühe Rush-Kombinationen und tiefe Ressourcenstapel. Fraktionsfreischaltung bei Tiefe 10/25 ist technisch vorhanden, ihre motivierende Wirkung aber keine technische Gewissheit. Siehe [Run-Validierung](playtest-validation.md) und [Progression](expeditions-schwierigkeit-und-upgrades.md).

## Was ich auf jeden Fall als nächste Implementierungen einplanen würde

**P0/P1 heißt hier Prioritätsempfehlung, nicht aktuelle Freigabe.**

1. **Diagnose gezielt vervollständigen:** Buildkennung und Anzahl der Simulationsschritte pro Callback mitgeben; optional Bewegung/Wegsuche, KI, Sicht, Kampf/Wirtschaft und Effekttick getrennt messen. Zähler für Pfadsuchen und Suchbudget ergänzen, soweit nötig. Ohne Diagnoseparameter keine neue Frame-Messarbeit. Ziel: die bekannten Ausreißer einem Unterpfad zuordnen können.
2. **Blockierte Worker/Produktion nachvollziehbar machen:** ausgewählter Worker bzw. Produktionsstätte zeigt, ob ein Auftrag läuft, auf freien Ausgang wartet oder wiederholt keinen Weg findet. Temporäre Blockade nicht als endgültigen Fehler behandeln; keine automatischen Teleports, Erstattungen oder Auftragsabbrüche. Erst Rückmeldung, dann belegte Livenessfehler reparieren. [Navigation](worker-bauwegfindung/issue.md).
3. **Taktische Verdeckung:** nach bestätigtem Nutzerbefund ist der [Kontursilhouetten-Pilot](../rendering.md#kontursilhouetten-bei-verdeckung) für beobachtete Modelle und erkundete Ressourcen hinter statischer Geometrie umgesetzt. Menschliche Lesbarkeits- und Mobilabnahme bleiben [offen](project-tomorrow.md#noch-nicht-erreicht--abnahme); Berge werden nicht transparent und der Fog bleibt die Beobachtungsgrenze.
4. **Kleine, klar begrenzte Ressourcenkorrekturen:** der Größen-/Qualitätsguard vor unnötiger Renderziel-Neuallokation ist umgesetzt; CSS-Viewport/Picking bleiben aktuell. [Echtgerätewirkung und übrige Kandidaten](mobile-performance.md) sind weiter offen. Kleinere Startkapazitäten bestehender dynamischer Buckets nur bei Messbeleg, keine beiläufige Qualitätsänderung.

**Danach:** ein kleiner freier Test-/Skirmish-Start mit Karte, Seed, Fraktionen und profilfreiem Zustand. Die Experiment-URLs sind technisch hilfreich, aber keine gut zugängliche Spieleroberfläche. Dafür zunächst [Skirmish-Regeln](new-battle-screen.md) entscheiden. Seedfavoriten lassen sich später daran anschließen; ein allgemeiner Kartenimporter ist ein anderes, wesentlich größeres Projekt.

## Refactoring-Empfehlungen

- **Kein ECS-/Worker-/Engine-Großumbau.** Die vorhandenen Verantwortungsgrenzen sind brauchbar. Browserworker hätten zusätzlich Synchronisation, Befehls-/Sichtverträge und einen `file://`-Ladevertrag zu lösen. Erst ein klarer Main-Thread-Engpass rechtfertigt diesen Aufwand.
- **Messung vor Datenstrukturwechsel:** bei bestätigter Bewegungsdominanz einen während der Bewegung aktuellen Körperindex pilotieren; der einmal je Tick aktualisierte Kampfhash ist kein Ersatz. Reihenfolge und Live-Mutationen erhalten. Bei A*-Allokationsdominanz weltlokale Arbeitsfelder prüfen; Bauvalidierung und temporäre Raster erfordern klare Besitz-/Reentranzgrenzen.
- **Modellhelfer nur aus tatsächlicher Wiederholung gewinnen:** lokale Leaf-/Rod-/Shell-Fabriken müssen nicht vorsorglich vereinheitlicht werden. Ein enger reiner Meshhelfer lohnt sich erst bei identischer Logik in mehreren Modellen; lokale Silhouetten, Bounds und Portraits bleiben eigenständig.
- **Renderer fachlich schneiden, nicht nach Dateilänge:** Materialresidenz oder Renderzielverwaltung sind mögliche spätere Extraktionsgrenzen. Rund tausend Zeilen in `runtime.ts` allein beweisen keinen Refactoringbedarf. Nur auslagern, wenn das nächste konkrete Paket dadurch isolierter wird; Verhalten und Struktur getrennt committen.
- **Planung lesbarer halten:** Project Tomorrow enthält viel abgeschlossene Umsetzungshistorie, frühere Aufträge und offene Abnahme gleichzeitig. In einer eigenen Dokumentationsrunde auf Ziel, aktuelles Gap und Abnahmelinks reduzieren; veraltete Fraktionsnamen in Abnahmeissues korrigieren. Nicht bei jedem Codepaket weitere Testzahlen und Laufhistorien anhängen.

## Fahrplan für Tage und Wochen

Zeitangaben sind eine Reihenfolge für einen Soloentwickler, keine belastbare Lieferzusage. Pro Phase möglichst ein Implementierungsstrang plus menschliche Rückmeldung.

| Zeitraum | Arbeitspaket | Entscheidung/Abschlusskriterium |
| --- | --- | --- |
| **Tag 1–2** | Repräsentative Referenzszenen wählen; frischen Einstieg und kurzen Aurelion-Einsatz menschlich spielen; Desktop- und Pixel-7-Diagnose getrennt aufzeichnen. | Build, Seed, Qualität, Tempo und Fehlerkontext sind bekannt; konkrete Hauptprobleme benannt. Keine flächige Screenshot-/Seedmatrix. |
| **Tag 2–4** | Diagnoseergänzung; gezielte 1×/2×-Aufnahme und Qualitätsvergleich. | CPU-Unterpfad oder GPU-/Pixelbudget eingrenzbar; sonst noch nicht optimieren. |
| **Tag 4–7** | Wichtigsten belegten Engpass oder Zuverlässigkeitsfehler beheben; Worker-/Ausgangsstatus ergänzen. Resizeguard als eigenes kleines Paket. | Gleicher Abschnitt vorher/nachher vergleichen; keine RNG-/Sicht-/Pickingregression, kein lediglich verschobener Engpass. |
| **Woche 2** | Konsolidierter Karten-/Modellpolish: Verdeckungspilot bei Bedarf, Weg-/Bodenkontrast und Wetterzurückhaltung; Portraitabgleich der bestätigten Modelle. | Bei normalem Zoom verständlich und bedienbar; High/Balanced/Performance stilistisch akzeptiert. Start mit Alien/Frontier, dann nur konkret betroffene Karten. |
| **Woche 3** | Mehrere vollständige menschliche Runs, besonders Stage 1–4 und Übergang zu 8; Aurelion und Frontier-Landungen einbeziehen. Nur beobachtete Progressionsprobleme gezielt ändern. Optional kleiner Test-/Skirmish-Dialog nach Regelentscheidung. | Früher Einstieg, Vorteilsentscheidungen und Gegnerdruck nachvollziehbar; Änderungen aus konkreten Runbefunden statt Bauchgefühl. |
| **Woche 4 und danach** | **Ein** Ausbau: strategisch variableres Kartenrezept **oder** Holdout-Pilot. Multiplayer-Expeditionen nur als eigenständige Regel-/Persistenzplanung. | Neue Spielsituationen statt nur neuer Optik; vorhandene Karten und Standardmission unverändert geschützt. |

Holdout ist der stärkere Kandidat, falls menschliche Runs trotz verschiedener Karten zu gleichförmig sind. Zuerst Ziel, Wellenökonomie, gegnerische Vorteile und Belohnung klären; [Holdout-Issue](expeditions-missionsziele-und-holdout.md). Topologievariation ist der kleinere Kandidat, wenn hauptsächlich Wege und Expansionen gleich wirken. Nicht beide parallel beginnen.

### Bewusst zurückstellen

Vollständiger Ersatz der verbleibenden Himmel-/Zweig-/Atlasbilder; allgemeiner Materialeditor; generische IK; automatisches Pooling aller Entitäten; dynamische Terraformingwelt; Community-Kartenplattform; weitere gleichzeitige Missionen. Auch Multiplayer-Expeditionen nicht nebenbei aus dem funktionierenden Transportprototyp ableiten. Diese Themen sind nicht wertlos, haben aber derzeit ungünstigere Kosten/Nutzen bzw. ungelöste Produktverträge.

## Ausgeführte Prüfung und Grenzen

- Quellen-/Dokumentationsanalyse zu Materialien, Weltkomposition, Highlands/Alien-Großformen, Modellregistrierung und ausgewählten Modellen, Effekten, Simulation, Navigation, Diagnose, UI und bestehenden Issues. Keine vollständige Zeile-für-Zeile-Prüfung des gesamten Projekts.
- `npm run build` erfolgreich. Keine Quellcodeänderung, deshalb keine neue Standardtestsuite; vorhandene historische Testergebnisse sind kein neuer Prüflauf.
- Kurzer technischer Chromium-Headless-Lauf über direktes `file://`, Sandbox aktiv, isoliertes Profil, **Alien Planet Seed 9**: über echte HUD-Buttons Infantry geöffnet und einen Worker rekrutiert. Drei eigene Worker nach rund 11,9 Simulationssekunden; ursprüngliche Worker im Abbau, Produktionsqueue leer, Konto 254 Cinder nach Rekrutierung für 50 aus 250 Startmitteln. Der neue Worker befand sich noch im anfänglichen Idle-/Ausfahrtszustand; kein Stillstandsbeleg daraus.
- Abschließender Lauf ohne JavaScript-Seitenfehler, ohne externe Seitenrequests und mit WebGL-Fehlercode 0. Zwei gezielte Diagnosebilder für Basislesbarkeit und Großformen; für die statische Übersicht wurde Sicht künstlich freigegeben. **Keine** reguläre Aufklärungs-/Fogprüfung dadurch. Ein früherer Rekrutierungsversuch überschritt das Echtzeit-Wartefenster; Wiederholung mit längerem Fenster erfolgreich. Daraus weder Performance noch einen Spielfehler ableiten.
- Kein vollständiger menschlicher Playtest, kein Sieg-/Vorteils-/Reloaddurchlauf, keine neue Mobil-/Thermik-, Audio- oder Langzeitbalanceabnahme. Keine `test:ai`-/`test:simulation`-Läufe und keine automatische Zuschauerpartie. Diese Grenzen bleiben Gegenstand der verlinkten Abnahmen.

**Empfohlene nächste Freigabe:** Diagnose vervollständigen und die vorhandenen Performance-/Workerbefunde eingrenzen. Parallel dazu menschliche Spielrunden, aber noch keine weitere große Contentwelle.
