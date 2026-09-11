# Arbeitsprotokoll

Einzige fortlaufende Änderungshistorie unter `docs/`. Neue Einträge kurz nach oben setzen: Änderung, tatsächlich ausgeführte Prüfung und relevante Grenzen. Zusammengehörige Schritte bündeln; ältere Einträge verdichten. Referenzen beschreiben den Ist-Zustand, frühere Details bleiben in Git.

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
