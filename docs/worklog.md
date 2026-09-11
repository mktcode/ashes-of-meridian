# Arbeitsprotokoll

Einzige fortlaufende Änderungshistorie unter `docs/`. Neue Einträge kurz nach oben setzen: Änderung, tatsächlich ausgeführte Prüfung und relevante Grenzen. Zusammengehörige Schritte bündeln; ältere Einträge verdichten. Referenzen beschreiben den Ist-Zustand, frühere Details bleiben in Git.

## Reproduzierbare TypeScript-Auslieferung

- TypeScript 7.0.2 als einzige lokale Entwicklungsabhängigkeit ergänzt. `npm run build` leert `dist/` und erzeugt aus den weiterhin handgepflegten Quellen klassische Skripte samt Source Maps unter `dist/src/`; `index.html` und die Tests laden ausschließlich diese nicht eingecheckte Ausgabe. Kein Bundle, Laufzeitimport oder Server; synchrone Skriptreihenfolge und `file://` bleiben erhalten.
- `npm test`: Build und **207 Node-Tests bestanden** (rund 17 s), keine Fixtures geändert. Der Loader schützt weiterhin klassische Bindungen, Reihenfolge, Fragment-APIs und lokale Pfade der tatsächlichen Build-Ausgabe.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Laden der Build-Ausgabe, Touch-Menüs, Käufe bis fünf Startworker, Gefechtsstarts, zusätzliche Rekrutierung, Reload/Neustart und kontrollierter Abbau bestanden; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerät- oder anderer Browser-/GPU-Test.

## Renderer-, Stylesheet- und Testladegruppen

- Wiederholte Listen der fünf Simulations- und fünf UI-Skripte als eingefrorene, benannte Gruppen im Testloader gebündelt; beim anschließenden Renderer-Umbau eine entsprechende Vierergruppe ergänzt. Aufrufstellen wählen Abhängigkeiten weiterhin ausdrücklich, der Loader führt sie weiterhin ausschließlich in Dokumentreihenfolge aus.
- `src/renderer.js` in vier synchrone klassische Skripte unter `src/renderer/` geteilt: eingebettete Assets/Materialien, Geometrie, Shader und WebGL-Laufzeit. Alle vier verschobenen Deklarationsblöcke sind textidentisch; Material-/Textur-/Shaderwerte, Geometriefunktionen sowie Texte, Reihenfolge und Deskriptoren aller 24 `MeridianRenderer`-Prototyp-Properties wurden direkt mit dem vorherigen Stand verglichen. Eine Harness-Regression schützt Dateireihenfolge, Bindungen und Klassen-API.
- `styles.css` entlang der vorhandenen Grenzen in `styles/base.css`, `styles/screens.css` und `styles/hud.css` geteilt. Die Verkettung in HTML-Reihenfolge ist bytegleich zum vorherigen Stylesheet; eine Steuerungsregression schützt lokale Pfade und Kaskadenreihenfolge.
- Abschließend einmal **207 Node-Tests bestanden** (rund 16 s), keine Fixtures geändert. Syntax, Diff und veraltete Quellpfade geprüft.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Laden der neuen Renderer- und Stylesheetdateien, Touch-Menüs, Gefechtsstarts, Upgrade-/Einstellungs-Persistenz, Rekrutierung, Reload/Neustart und kontrollierter Abbau bestanden. Menü- und Gefechtsbilder gesichtet; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerät-, anderer Browser-/GPU- oder weiterer Qualitätsstufentest.

## Fachlich geteilte Benutzeroberfläche

- `src/ui.js` in fünf weiterhin klassische, synchron geladene Skripte unter `src/ui/` geteilt: Klasse/Ereignisse, Menüs/Dialoge, Aktionen/HUD, Eingabe sowie Minimap/Overlay. `core.js` deklariert `MeridianUI`; `defineMeridianUIMethods` registriert die ausgelagerten Methoden mit denselben nicht aufzählbaren, konfigurierbaren und schreibbaren Deskriptoren. `$` und `esc` bleiben gemeinsame lexikalische Bindungen; keine Imports oder Buildschritte ergänzt.
- Konstruktor und alle **45 Methodentexte** direkt mit dem vorherigen Stand verglichen: textidentisch. Signaturen, Deskriptoren und Reihenfolge aller 46 Prototyp-Properties stimmen ebenfalls überein. Neue Harness-Regression schützt Dateireihenfolge, vollständige Montage, Nichtaufzählbarkeit und die von `app.js` verwendete `esc`-Bindung.
- **205 Node-Tests bestanden** (rund 22 s), keine Fixtures geändert. Syntax, Diff, Quellpfade und lokale Dokumentationslinks geprüft.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Laden der fünf UI-Skripte, native Touch-Menüaktionen, Gefechtsstarts, Upgrade-/Einstellungs-Persistenz, Rekrutierung, Reload/Neustart und kontrollierter Abbau bestanden; Gefechtsbild gesichtet, keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerätetest.

## Fachlich geteilte Gefechtssimulation

- `src/simulation.js` in fünf weiterhin klassische, synchron geladene Skripte unter `src/simulation/` geteilt: Klasse/Entitäten, Bewegung, Wirtschaft, Kampf und Laufzeit. `game.js` deklariert `MeridianGame`; `defineMeridianGameMethods` registriert die übrigen Methoden mit denselben nicht aufzählbaren, konfigurierbaren und schreibbaren Deskriptoren. Öffentliche Methodennamen und Signaturen bleiben erhalten; keine Imports oder Buildschritte ergänzt.
- Alle **58 ausgelagerten Methodentexte** und `formatTime` direkt mit dem vorherigen Stand verglichen: textidentisch. Die Signaturen/Deskriptoren aller 59 Prototyp-Properties stimmen ebenfalls überein. Neue Harness-Regression schützt Dateireihenfolge, vollständige Montage und Nichtaufzählbarkeit.
- **204 Node-Tests bestanden** (rund 15 s), keine Fixtures geändert. Syntax, Diff und lokale Dokumentationslinks geprüft.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Laden der fünf Skripte, Gefechtsstarts, Käufe, Reload/Neustart, Rekrutierung und kontrollierter Abbau bestanden; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerätetest.

## Laufzeitquellen unter `src/`

- Alle zwölf direkt ausgelieferten JavaScript-Quellen mechanisch nach `src/` verschoben. `index.html`, Testpfade und Dokumentation folgen den neuen relativen Pfaden; Dateiinhalte und synchrone Ladefolge bleiben unverändert. Stylesheet und Bildquellen verbleiben bewusst in der Rootebene.
- Alte und verschobene Quellen bytegleich verglichen, Syntax und Diff geprüft; **203 Node-Tests bestanden** (rund 16 s), keine Fixtures geändert.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Laden aller Quellen, Start, kostenlose Startworker-Käufe, Reload, Neustart, Rekrutierung und kontrollierter Abbau bestanden; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerätetest.

## Permanentes Startworker-Upgrade

- Command, Resolve und Industry samt Spieleffekten durch `Starting workers` ersetzt: kostenlos zum Testen, Stufen 0–5, ein sofort verfügbarer Worker je Stufe. 250 Alloy / 0 Aether bleiben erhalten; Wirkung nur bei neuem Gefecht/Neustart. Profil lädt nur aktuelle, begrenzte Ganzzahlstufen; alte Schlüssel werden verworfen, nicht migriert. Menü, Startanzeige, Funkhinweis und Hilfe angepasst.
- Bonusworker werden nach dem ursprünglichen Welt-/Gegneraufbau auf freien Plätzen nahe dem HQ erzeugt. Ressourcen/Gegner behalten ihre Seedwerte; je Worker kommt nur der reguläre Spawn-RNG-Aufruf hinzu. Keine Änderungen an Terrain, Kollisionsradien oder Fixtures.
- **203 Node-Tests bestanden** (abschließend rund 21 s bei parallelem Browsercheck). Unter anderem alle sechs Stufen × drei Fraktionen × fünf Biome, Abstände, RNG-Verbrauch, automatischer Abbau, Upgrade-Übernahme/Neustart, Speicherung und entfernte Boni geprüft. Syntax, Diff und lokale Dokumentationslinks geprüft.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: native Käufe bis Stufe 5, Maximalsperre, Starts mit 0/1/5 Workern, zusätzliche bezahlte Rekrutierung, Reload und Neustart bestanden; 60 Simulationssekunden Abbau kontrolliert durchlaufen. Upgrade-/Gefechtsbilder angesehen; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerät- oder Langzeitbalancing-Nachweis.

## Produktionsabfrage, Industriefaktor und HUD-Signatur

- In drei separaten Refactorings Produktionsfilter für Simulation/HUD und damaligen Industriefaktor gebündelt sowie ungenutztes `updateHUD(force)` bereinigt. Sortierung, Rechenreihenfolge und Aktualisierungszeitpunkte blieben gleich. Der Industriefaktor wurde mit dem obigen Upgrade-Wechsel wieder entfernt.
- Damals **200 Node-Tests bestanden** (rund 13 s), nach 14 beziehungsweise 7 gezielten Tests. Syntax, Diff und Links geprüft; keine Fixtures geändert. Kein Browsercheck für diese verhaltensneutralen Refactorings.

## Fähigkeitsdefinitionen, Minimap-Koordinaten und HUD-Versorgung

- Energiekosten/Cooldowns unverändert nach `content.js` (`ABILITIES`) verschoben; Simulation und HUD lesen dieselbe Kostendefinition. Zielprüfungen, Effekte und Prüfungsreihenfolge bleiben unverändert. Fünf gezielte neue Node-Tests bestanden: alle vier Energie-/Cooldown-Grenzen samt Bezahlung sowie HUD-Badges/Sperren.
- `ui.js`: lokale Funktion `minimapPosition` für Drücken/Ziehen, weiterhin aktuelle Elementgrenzen pro Aufruf. **44 Steuerungstests bestanden**, darunter neue Prüfung mit wechselnden Abmessungen/Offsets, Abbruch und Rechtsklickauftrag.
- Gezielt **`file://`**, Chromium/Performance, **390×844 und 430×932**: native Touch-Taps, Ziehen und Kameragrenzen nach Größenwechsel geprüft; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. Kontrolliertes CDP-Touch, kein Echtgerätetest.
- `updateHUD()` berechnet Versorgung/Kapazität einmal pro Aufruf und verwendet sie für Text, Warnfarbe und Rekrutierungssperren; kein Cache über Aufrufe hinweg. Neue Prüfung deckt Grenzwerte und Aktualisierung nach Versorgungs-/Kapazitätsänderungen ab.
- Abschließend **196 Node-Tests bestanden** (rund 13 s) über alle drei getrennten Refactorings. Syntax, Diff und lokale Dokumentationslinks geprüft; keine Fixtures geändert. Der obige Browsercheck wurde nach der Minimap-Extraktion, vor der reinen HUD-Berechnungsbündelung ausgeführt.

## Gemeinsame Hilfezeilen und Bewegungsgeschwindigkeit

- `ui.js`: drei identische Hilfezeilen-Templates in die lokale Funktion `renderHelpLines` innerhalb von `showHelp()` gezogen. `simulation.js`: `move()` und `moveYield()` verwenden dieselbe Methode `movementSpeed(e)`; Faktoren, Berechnungsreihenfolge, Kollisions-/Weglogik und unterschiedliche `walk`-Fortschritte unverändert.
- **189 Node-Tests bestanden** (rund 12 s), einschließlich neuer Prüfung für Worker-/Fluggeschwindigkeit aller Fraktionen, aktive/abgelaufene Verlangsamung und Mutations-/RNG-Freiheit. Syntax und Diff geprüft; keine Fixtures geändert.
- Erzeugtes Hilfe-HTML, Modalargumente und Pausenverhalten für Hauptmenü/Gefecht direkt gegen den vorherigen Git-Stand verglichen: identisch. Kein neuer Browsercheck, da weder ausgeliefertes Markup noch Eingabe-/Layout-/Renderverhalten geändert wurden.

## Benannte Simulationsschrittweite und risikogerechte Testpflicht

- `app.js`: vier identische Schrittweiten durch die lokale Konstante `SIMULATION_STEP_SECONDS = 0.05` ersetzt; Aufrufreihenfolge und Schrittbegrenzung unverändert.
- Für die Konstantenextraktion **188 Node-Tests bestanden** (rund 13 s), Diff geprüft. Kein Browsercheck für die reine Konstantenextraktion.
- Anschließend Testpflicht in `AGENTS.md` und `docs/testing.md` gelockert: Für mechanische, verhaltensneutrale JavaScript-Kleinständerungen genügen Syntaxprüfung und Diff-Sichtung; bei Logik-/RNG-/Schnittstellen-/Teständerungen sowie im Zweifel weiterhin vollständiger Node-Lauf. Für diese reine Regeländerung nur Diff und lokale Dokumentationslinks geprüft, keine erneuten Spieltests.

## Startökonomie nur durch Worker und Raffinerien

- Neue Runs beginnen fest mit **250 Alloy / 0 Aether**. Worker kosten für alle Fraktionen 50 Alloy, sodass genau fünf sofort bezahlbar sind. Passives HQ-Alloy/-Aether und das permanente Start-Alloy-Upgrade entfernt; Energie-Regeneration bleibt unverändert. Reguläres Alloy-/Aether-Einkommen kommt nur durch Worker beziehungsweise Raffinerien.
- Ausgebaute Testbasen deklarieren ihre 1100/400 Testwirtschaft nun ausdrücklich; feste Gelände-/RNG-Referenzen und übriges Balancing bleiben unverändert.
- **188 Node-Tests bestanden**, darunter 60 s ohne Worker/Refinery und ohne Alloy-/Aether-Zuwachs, exakt fünf bezahlbare Worker für jede Fraktion, Abbau, Raffinerieeinkommen und verbliebene Upgrades. Keine Fixtures neu erzeugt. Kein Browsercheck für die reine Simulations-/Balancingänderung; manueller Spieltest steht aus.

## Runs ohne Speicherung

- Manuelles Speichern/Laden, Autosave, Home-Resume, Retry checkpoint, Backup-Import/-Export und Simulation-Snapshot/Restore entfernt. Alte Checkpoints werden ignoriert, keine Migration. Nur Upgrades/Einstellungen bleiben im unveränderten lokalen Profil.
- Pause/Fortsetzen und automatisches Pausieren bei verborgenem Tab bleiben; Hauptmenü/Reload/Schließen verwerfen den Run. Nach Sieg/Niederlage ausschließlich Neustart oder Hauptmenü; beendete Runs lassen sich nicht fortsetzen. Hilfe, Abbruchwarnung und Grafikfehlertexte angepasst.
- **187 Node-Tests bestanden**. Entfallene Save-Tests entfernt, verbleibende Produktions-/Bewegungsprüfungen laufen ohne Restore weiter; neue Lebenszyklus-/Profiltests prüfen Abbruch, frischen Neustart, Pause und fehlende Speicherpfade. Feste Fixtures unverändert.
- Kurzer **`file://`-Check**, Chromium/CDP, Performance, **390×844**: native Rekrutierung/Pause/Fortsetzen, kein Autosave nach 45 s, Reload verliert Run und behält Profil, alter Checkpoint ignoriert, Niederlage → HQ-Neustart sowie Abbruch ins Hauptmenü. Pause-/Ergebnisbilder gesichtet; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. Kontrollierter Headless-Check, kein Echtgerät- oder Langzeitspielnachweis.

## Gefechtsstart nur mit dem HQ

- Spieler startet ohne weitere Gebäude oder Einheiten; auch der erste Worker muss über Infanterie rekrutiert werden. Starttruppen-/Startworker-Upgrades aus Katalog und Startlogik entfernt, damals vier übrige Upgrades erhalten. Gegneraufstellung, Ressourcen und Wellenzeiten waren in diesem Schritt unverändert; kein neues Worker-Startupgrade oder Save-Umbau.
- Starttext/Hilfe und Referenzen angepasst. 24 reservierte Samples erhalten die festen Ressourcen-/RNG-Referenzen. Ausgebaute Basen sind jetzt ausdrückliche Testaufbauten, kein echter Spielstart.
- **196 Node-Tests bestanden**, einschließlich HQ-only über alle Fraktionen/Biome, erster Worker samt Bezahlung/Produktion/Restore/Abbau und erstem Gebäude, übrigen Upgrades sowie bestehenden Crowd-/Effektreferenzen. Keine Fixtures neu erzeugt. Browsercheck auf Nutzerwunsch ausgelassen; manueller Spiel- und Balancingtest steht aus.

## Seitliches und kontinuierliches Platzmachen

- `29fbfc4` begrenzte das Mitschieben auf seitliche Verschiebung mit Sperrzeit; trotz 193 bestandener Node-Tests meldete der Nutzer sichtbares Ruckeln durch Positionssprünge und 0,35-s-Pausen.
- Statt sofortiger Versetzung jetzt ein kurzes `yieldTo`-Manöver mit normaler Geschwindigkeit, Drehung und Bewegungsanimation, auch für untätige Einheiten. Möglichst den ganzen Laufweg freimachen, bei Platzmangel einen kürzeren Schritt. Normale Aufträge bleiben erhalten; die Sperrzeit stoppt nicht mehr die eigene Bewegung. Eigenes Umgehen vor Platzanforderung; bereits ausweichende Verbündete nicht seitlich verfolgen.
- **194 Node-Tests bestanden**: kontinuierliche Schritte ohne Anfangssprung, Auftrags-/Standplatzschutz, Save/Load und neu blockiertes Ausweichziel; bestehende sechsminütige Worker-Gegenverkehrstests weiterhin bestanden. Keine Fixtures geändert. Kein eigener neuer Browsercheck; Nutzer meldete eine Verbesserung, weitere Pathfinding-Arbeit ist zurückgestellt.

## Worker-Gegenverkehr und sichtbare Produktionsausfahrt

- Den gemeldeten Stau reproduziert: Der isolierte Acht-Worker-Probelauf blieb mit dem vorherigen Code über den sechsminütigen Test bei insgesamt 18 Alloy stehen. Die bisherigen Kurzprüfungen waren dafür unzureichend.
- Gleichbleibende Ausweichseite, Vorrang für beladene Worker, kurze Wartezeit nach Ausweichen und begrenztes gemeinsames Platzmachen ersetzen gegenseitiges Zurückdrücken. Bei Stillstand plant die vorhandene Wegsuche um Einheiten herum. Automatische Ressourcenzuweisung berücksichtigt Auslastung; Abbaurate/Ladung bleiben unverändert.
- Produktion startet im Gebäude und bewegt die Einheit tatsächlich zum reservierten Ausgang. Erst anschließend laufen normale Aufträge; Flugzeuge steigen dabei auf. Ausfahrt und Wartezeit überstehen Save/Load, bestehende Strukturen/Assets bleiben erhalten.
- **193 Node-Tests bestanden**, inklusive vier sechsminütiger Abbau-Szenarien mit acht/zwölf Workern, drei Fraktionen, eigener Startarmee, gemeinsamem Einzelvorkommen und Restore. Jeder Worker muss in jeder Minute liefern; anhaltende Richtungswechsel werden erkannt. Außerdem Ausfahrt aller sieben Typen, Reservierung, Verkauf des Produzenten, fehlerhafte Exit-Daten, Navigationsraster/RNG und Flugdarstellung geprüft. Feste Fixtures unverändert; `git diff --check` sauber.
- Gezieltes **`file://`**, Chromium 152/Performance, **390×844**: rekonstruierter gespeicherter Stau löst sich; alle acht Worker liefern in jeder der sechs Simulationsminuten (22–30 Ablieferungen je Worker insgesamt), auch nach erneutem Restore. Keine anhaltende Richtungswechselserie im gemessenen Ablauf. Live-Bildfolge beim Abbau sowie native Rifle-/Tank-/Air-Rekrutierung und Ausfahrt aufgenommen und angesehen; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler.
- Grenzen: kontrollierter Aufbau und Simulationsschritte, ergänzende Live-Sequenzen; Gegnerwellen für die Abbau-Dauertests ausgesetzt. Kein Echtgerät-, großer Armee-/Crowd-Performance-, andere Browser-/Qualitätsstufen- oder allgemeiner Engstellen-Nachweis.

## Frühere Abstandsprüfung (`5182adf`, überarbeitet)

Freie Spawnplätze und Körperabstand eingeführt. Damals 183 Node-Tests und ein Portrait-Browsercheck bestanden; trotzdem traten anschließend Worker-Stau und Zittern auf. Diese Prüfung war keine ausreichende Langzeit-Gegenverkehrsabsicherung und wird durch die obigen Fälle ergänzt.

## Rally und Portrait-Deck (`ff63503`, `c588abd`)

- Rally nur über die Menü-Schaltfläche; Boden-Tap/-Klick wählt Gebäude ab. Damals 175 Node-Tests und gezielter Portrait-`file://`-Check bestanden.
- Aufklärer entfernt, Spawn-RNG-Sample für Kristallmengen reserviert. Minimap links halbbreit, rechts Kategorien/Zurück und feste Gebäudeaktionen; Fähigkeiten dauerhaft darüber. Globale Rekrutierung verteilt auf gebundene Gebäude-Queues; aggregierte Typ-Symbole zählen Aufträge und zeigen Fortschritt/Abbruch.
- Damals 172 Node-Tests und Chromium/CDP-Touch über `file://` bei 390×844, 320×568 und 430×932 bestanden. Kontrollierte Setups, keine Echtgerät-/Desktop-/Langzeitfreigabe; die damaligen sofortigen Spawnplätze sind inzwischen ersetzt.

## Dokumentation und Arbeitsregeln (`664c2fb`)

Einzelberichte durch aktuelle Referenzen und dieses Protokoll ersetzt; risikogerechte Prüfungen und regelmäßige Bereinigung in `AGENTS.md`. Lokale Links/Anker und Diff geprüft, keine Spieltests für die reine Dokumentationsänderung.

## Zusammengefasste frühere Entwicklung

- Klassische lokale Skripte statt Inline-Monolith; Speicherung, CPU-Welt und kosmetische Effekte getrennt. Feste Referenzen schützen Terrain/RNG/Zeichenverhalten. Skybox-Einbettung, MSAA und modellfeste Texturen umgesetzt; damalige Chromium-GPU-Prüfungen waren positiv, keine aktuelle vollständige Grafikfreigabe.
- Desktop-Kamera, Hotkeys, Rechteck-/Shift-Auswahl, Kontrollgruppen, Befehls-Auftragsketten, Bauhilfe, Forschung und Tooltips entfernt. Arbeitergestützte Gebäude-Reparatur und bestätigter Verkauf ergänzt.
- `cbd37f2`: wiederholbare HQ-Gefechte statt Kampagne/Sondermodi; kostenlose permanente Test-Upgrades. `3e7705d`: Dreifachtap für sichtbare Nicht-Worker, Timing nur kontrolliert geprüft.
- `71952f3`: Schwierigkeit entfernt, frühere Standard-Regeln fest, Checkpoints v3. Drei 120-s-Vergleiche entsprachen nach Normalisierung dem vorherigen Standard-Zustand samt Effekten/Folge-RNG.
- `7f81c48` bis `565b108`: Hinweisleiste, Dekoration und sechs Befehlsbuttons entfernt; Boden-Tap auf Attack-move (Worker: move), Deck randbündig/rahmenlos. Damals 170 Node-Tests und fünf Chromium-Viewportchecks bestanden; durch spätere Umbauten als UI-Nachweis überholt.

Offene Punkte: [Spiel und Bedienung](gameplay.md#offen-nicht-zur-umsetzung-freigegeben) · [technische Risiken](architecture.md#schutzgrenzen-und-offene-architekturfragen).
