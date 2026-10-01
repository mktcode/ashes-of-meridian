# Architektur

Entscheidungen und Änderungsrisiken; Implementierungsdetails stehen in Quellen und Tests.

## Auslieferung

Das Spiel muss nach `npm run build` direkt über `file://` funktionieren. Deshalb klassische, synchron in HTML-Reihenfolge geladene Skripte mit gemeinsamen globalen Bindungen: keine Laufzeit-Imports, CDN-Abhängigkeiten, `async` oder `defer`. TypeScript wird strikt geprüft; generierte Asset-Einbettungen bleiben Ausnahmen. `window.Meridian` bietet gezielte Runtime-Inspektion.

Neue Skripte in `index.html` und den betroffenen Gruppen von `tests/helpers/game-scripts.cjs` eintragen. Prototypfragmente erweitern Klassen über nicht aufzählbare Methoden und Declaration Merging. **Ladereihenfolge ist Vertrag**, ebenso die gesamte CSS-Kaskade. Quellen bearbeiten, nie `dist/` oder generierte Einbettungen von Hand.

Das [UI-Designsystem](ui-design-system.md) beschreibt die auf UI-Wurzeln begrenzte
Theme-Schicht einschließlich Gefechts-HUD und Meldungen sowie ihre Pflegegrenzen.
Weltcanvas, Viewport-/Picking-Geometrie und Diagnoseanzeigen gehören nicht zur Theme-Schicht.

[Webhosting](deployment.md) liefert denselben statischen Singleplayer-Stand. Es gibt keinen Spielserver oder Netzwerkmodus.

## Zustands- und Verantwortungsgrenzen

- **Simulation:** `MeridianGame` besitzt CPU-Welt und Effekte, keinen Renderer. Feste Simulationsticks sind von rAF-basierten UI-/Audiouhren und dem 60-FPS-Renderbudget getrennt. Verpasste Rendertermine werden nicht nachgeholt. Spieltempo skaliert Simulationszeit, nicht die Audio-Uhr.
- **UI:** orchestriert Expedition, Befehle, Dialoge und Profil. Templates erzeugen nur Markup; DOM, Speicherung und Zufall bleiben beim Controller. Ergebnisverarbeitung und Auszahlung müssen pro Gefecht genau einmal erfolgen.
- **Persistenz:** Profil und Expeditionscheckpoint werden unabhängig normalisiert; Regeln und Storage sind injiziert, keine UI-/Spielabhängigkeit. Der Checkpoint speichert das Startrezept samt Deployment-Policy, Loadout und slotgebundenen Vorteilen, **keine Entitäten oder laufende Welt**. Alte Checkpointformate werden verworfen, nicht migriert. Storage-Ausfälle bieten nur flüchtigen Ersatz.
- **Lebenszyklus:** Gefechtsstart erzeugt Welt, Indizes, RNG und Sicht neu. `game.s`/`world` können fehlen; eine noch referenzierte Menüwelt ist kein aktives Gefecht. Reload, Menü oder Grafikverlust verwerfen das Gefecht; Tab-Rückkehr setzt eine Pause nicht automatisch fort. Kein Snapshot-/Restore-API.
- **Landschaftsarchiv:** separater visueller Datensatz aus Stage, Karte und Seed. Er muss eine lückenlose Folge bis zum exakt aktuellen Checkpoint bilden; sonst startet nur das Archiv dort neu. Schreibvorgänge sind nicht transaktional: höchstens Historie verlieren, niemals einen fremden Run zuordnen. Vorschauauswahl beeinflusst keinen Gefechtsstart und rekonstruiert keine unbekannten Seeds.

## Technische IDs und Anzeigenamen

Fraktion, Partei, Entitätstyp und Karte sind unabhängige technische Identitäten; Anzeigenamen sind Content. Gegner-Slots behalten ihre Identität und Vorteile über Fraktionswechsel hinweg. Modelle/Assets verwenden technische IDs, keine Namen oder numerischen Karten-Aliasse.

## Einzelspieler-Missionen

Alle Katalogkarten verwenden HQ-Eliminierung; Ergebnis und Deployment-Grace gehören in die Simulation, nicht in UI oder Kartenrezept. Encounter-Auswahl erhält die Reihenfolge Gegnerfraktionen → Karte → Seed. Die Deployment-Policy benötigt keine Zufallsziehung und bleibt im Checkpoint erhalten, auch wenn das Tutorial inzwischen abgeschlossen wurde. Die aktuelle Rezeptversion ist 6; entfernte Karten und frühere Rezeptversionen werden verworfen, nicht auf andere Karten umgebogen. [Fachregeln](gameplay.md#gefecht-und-fortschritt).

## Teamzustand, Sicht und KI

Parteizustand bündelt Fraktion, Controller, Konten, Loadout, Deployment-Grace und kopierte Upgrades/Vorteile. Permanente Profilupgrades gelten nur für den Spieler. Die KI verwendet dieselben bezahlten Wirtschafts-/Kampfaktionen wie Menschen; sie beobachtet verzögert kopierte Kontakte statt verborgene Live-Entitäten. Doktrin und Druck werden aus Fraktion/Tiefe abgeleitet, nicht zusätzlich gewürfelt. Vor dem HQ-Bau sucht sie unbekanntes öffentlich begehbares Gelände und baut erst anhand beobachteter Ressourcenkontakte. Layoutanker und versteckte Entitäten dürfen die Ressourcenentscheidung nicht ersetzen. Entwicklerregler: `src/simulation/ai-rules.ts`; keine Balancegarantie durch technische Obergrenzen.

`submitAction` bindet den Akteur getrennt von der Nutzlast und validiert bekannte Felder. Fachregeln bleiben in der Simulation; HUD ist keine Berechtigungsgrenze. Im Einzelspiel erfolgt Ausführung unmittelbar. Szenarien reihen kopierte Aktionen für den nächsten Tick ein: Annahme ist **kein Erfolg**, Ressourcen werden nicht reserviert. Vor Ausführung werden Besitz, Sicht und aktuelle Regeln erneut geprüft.

Szenarioeingaben laufen in Annahmereihenfolge vor den übrigen Tickphasen; KI handelt unmittelbar in ihrer festen Phase. Rekursive Ticks sind gesperrt. Neustart ersetzt Queue/Tickets, Stopp verwirft Eingaben. Unerwartete Ausführungsfehler stoppen das Szenario ohne automatischen Retry oder zugesicherten Rollback. Die Queue ist keine Replay-Historie oder Netzwerkauthentifizierung.

Jede Partei besitzt eigene Sicht/Erkundung. Lokale Perspektivwechsel verwerfen Auswahl, Gesten und Effekte, verändern aber keine Simulation oder Zufallsströme. Expeditionen bleiben auf Partei 0 beschränkt. Interne Szenarien haben begrenzte Dauer und keine Expeditionsauszahlung; Nichtfeindschaft bedeutet weder Allianz noch geteilte Kontrolle/Sicht.

## Weltrezepte und feste Designs

Die sechs Katalogfamilien verwenden gemeinsame seedbasierte Erzeugung mit variablen Maßen, verteilten Wirtschaftsregionen und verbindenden Wegen. Terrain, Wirtschaft und Dekor entstehen vor der Parteienzuordnung; weder Parteienzahl noch privater Startseed dürfen sie verändern. Alle Nutzer lesen dasselbe aufgelöste Layout. Katalog: `src/battlefields/catalog.ts`.

Landschaftsseed, Gefechtsseed und Atmosphäre sind getrennt: ein festes Design fixiert Terrain/Dekor, nicht Startzuordnung oder Kampfzufall. Tageszeit ist eine einmalige Gestaltung, kein laufender Zyklus. Reproduzierbarer Gefechtsanfang braucht Rezept, Seed, Parteien und Loadouts; Seed allein konserviert keine Landschaft über Rezeptänderungen hinweg.

Geländeerzeugung formt Wirtschaftsflächen und Wege, keine vier vorbestimmten Basen. Die CPU-Oberfläche entsteht **vor** kosmetischer Ökologie. Letztere darf weder Blocker, Ressourcen noch Navigation verändern. Unspielbare Konstruktionen scheitern, statt einen Ersatzseed zu würfeln. CPU-Rezepte und Darstellung werden als ein zusammenhängender Browserstand ausgeliefert.

## Welt, Darstellung und Zufall

Eine statische triangulierte `BattlefieldSurface` liefert genau eine spielbare Bodenhöhe je `x/z`. Navigation, Picking, Meshes, Fundamente und Höhenposen verwenden dieselben Samples/Diagonalen; kein nachgebautes Renderer-Noise. Maschinenaufbauten, Dächer und äußerer Dekor sind keine zweite Spielebene. Instanzmaße gelten auch für Sicht-/Minimap-Puffer; Größenwechsel darf keine alten Daten behalten.

Klippen und permanente Terrainbarrieren bleiben auch bei Recovery mit temporärem Belegungsraster wirksam. Baumaske und Bewegungssperre sind unabhängig, etwa auf Brücken. Fundamente prüfen konservativ den ganzen Fußabdruck: begrenzte lokale Ebenensteigung und Restabweichung erlauben sanfte Hänge, nicht beliebige Hügel. Gebäude stehen auf dem höchsten abgedeckten Datum; der Renderer ergänzt nötige Unterbauten. Bodengebundene Arbeit verlangt einen klippenfreien Zugang; ein nahes X/Z-Ziel ist nicht automatisch erreichbar.

Wegsuche unterscheidet vollständigen/Teilweg, unerreichbar und verbrauchtes Suchbudget. Nur vollständige Erreichbarkeit eines Arbeitsbereichs erlaubt eine Bauzusage vor Zahlung. Servicepunkte müssen innerhalb des Arbeitsradius liegen; ein Rückweg behält ein stabiles Ziel, sonst können Umwege endlos zwischen HQ-Zentrum und Servicepunkt wechseln. Direkte Live-Körper verwenden, wenn der Kampfhash innerhalb des Ticks veraltet sein kann.

Diskrete CPU-Sichtstufen sind unabhängig von Modellhöhen: Bodensicht reicht nur auf gleiche/niedrigere Stufen, Flugzeuge/Scans umgehen diese Grenze. Kein allgemeiner Gelände-Raytest. Lokale Flugfreiraumhüllen schützen den gesamten Fußabdruck vor CPU-Terrain, **nicht** vor beliebig hohem Dekor. Kampfentfernungen und Fernheilung bleiben planar; Hanglage/Flugpose sind abgeleitet, kein zusätzlicher autoritativer Zustand.

Öffentliche Startkandidaten gehören zur größten fahrzeugbreit verbundenen Terrainkomponente mit Zugang zur Wirtschaft und erreichbarer HQ-Baufläche. Die separate private Zuteilung sucht ausreichend getrennte Parteienstarts. Zusatzeinheiten werden in passendem erreichbarem Freiraum um den zugewiesenen Start platziert, nicht blind auf historischen Offsets. Startsuche und Zuteilung haben eigene deterministische Regeln; zusätzliche Parteien dürfen Terrain-/Ressourcen-RNG nicht verschieben. Sichtbare Hindernisse und CPU-Umrisse müssen übereinstimmen.

**RNG ist Verhaltensvertrag:** Terrain, Dekor und Startzuteilung nutzen getrennte Quellen. Neue Kosmetik erhält einen eigenen stabilen Salt; reservierte Samples nicht als toten Code löschen. Einzelspieler-Effekte nutzen teilweise Simulations-RNG und dürfen bei Unsichtbarkeit nicht einfach entfallen. Szenarien besitzen einen getrennten Effektstream; reines Zeichnen verbraucht keinen RNG. [Referenzpflege](reference-tests.md).
